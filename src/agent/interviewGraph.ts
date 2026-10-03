import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { getLanguageLabel } from '../config/languages';
import { getTranslation } from '../lib/i18n';
import type { HistoryEntry, InterviewFeedback, InterviewType, Language, Provider } from '../types/interview';
import { createChatModel } from './llm';
import {
  SYSTEM_PROMPTS_BY_TYPE,
  START_INTERVIEW_MESSAGE,
  buildEvaluationPrompt,
  buildInterviewerSystemPrompt,
} from './prompts';
import { DEFAULT_AGENT_INTERVIEW_TYPE, formatStageName, getStages, resolveStage } from './stages';

const EVALUATION_TEMPERATURE = 0;
const INTERVIEWER_TEMPERATURE = 0.7;

const replace = <T>(_current: T, update: T) => update;

const EMPTY_FEEDBACK: InterviewFeedback = {
  grammarCorrections: [],
  vocabularySuggestions: [],
  contentScore: 0,
  comment: '',
  suggestedAnswer: '',
};

const FALLBACK_SCORE = 5;

export const InterviewState = Annotation.Root({
  resumeText: Annotation<string>(),
  jobDescription: Annotation<string>(),
  companyInfo: Annotation<string>(),
  interviewType: Annotation<InterviewType>(),
  interviewStage: Annotation<string>(),
  history: Annotation<HistoryEntry[]>({ reducer: replace, default: () => [] }),
  lastCandidateAnswer: Annotation<string>(),
  latestFeedback: Annotation<InterviewFeedback>({ reducer: replace, default: () => ({ ...EMPTY_FEEDBACK }) }),
  nextInterviewerSpeech: Annotation<string>(),
  isCompleted: Annotation<boolean>({ reducer: replace, default: () => false }),
});

export type InterviewGraphState = typeof InterviewState.State;
export type InterviewGraphUpdate = typeof InterviewState.Update;

/** Parses the evaluator's JSON reply, tolerating markdown fences and surrounding prose. */
const parseFeedback = (raw: string): InterviewFeedback => {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const json = start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(json) as Partial<InterviewFeedback>;
  return {
    grammarCorrections: parsed.grammarCorrections || [],
    vocabularySuggestions: parsed.vocabularySuggestions || [],
    contentScore: parsed.contentScore || FALLBACK_SCORE,
    comment: parsed.comment || '',
    suggestedAnswer: parsed.suggestedAnswer || '',
  };
};

const toChatMessage = (entry: HistoryEntry): BaseMessage =>
  entry.role === 'interviewer' ? new AIMessage(entry.content) : new HumanMessage(entry.content);

export const createInterviewAgent = (provider: Provider, apiKey: string, language: Language) => {
  const targetLanguage = getLanguageLabel(language);

  const evaluateAnswerNode = async (state: InterviewGraphState): Promise<InterviewGraphUpdate> => {
    if (!state.lastCandidateAnswer) return {};

    const llm = createChatModel(provider, apiKey, EVALUATION_TEMPERATURE);
    const prompt = buildEvaluationPrompt({
      question: state.nextInterviewerSpeech,
      answer: state.lastCandidateAnswer,
      resumeText: state.resumeText,
      interviewType: state.interviewType,
      targetLanguage,
    });

    try {
      const response = await llm.invoke([new HumanMessage(prompt)]);
      return { latestFeedback: parseFeedback(response.text) };
    } catch (e) {
      console.error('Failed to parse feedback JSON', e);
      return {
        latestFeedback: { ...EMPTY_FEEDBACK, contentScore: FALLBACK_SCORE, comment: 'Failed to evaluate answer.' },
      };
    }
  };

  const routeNextStageNode = async (state: InterviewGraphState): Promise<InterviewGraphUpdate> => {
    const answeredCount = (state.history || []).filter((h) => h.role === 'candidate').length;
    const { stage, isCompleted } = resolveStage(state.interviewType, answeredCount);
    return { interviewStage: stage, isCompleted };
  };

  const formulateQuestionNode = async (state: InterviewGraphState): Promise<InterviewGraphUpdate> => {
    if (state.isCompleted) {
      return { nextInterviewerSpeech: getTranslation(language, 'closingRemark') };
    }

    const type = state.interviewType || DEFAULT_AGENT_INTERVIEW_TYPE;
    const stages = getStages(type);
    const currentStage = state.interviewStage || stages[0];

    const systemPrompt = buildInterviewerSystemPrompt({
      typePrompt: SYSTEM_PROMPTS_BY_TYPE[type] ?? SYSTEM_PROMPTS_BY_TYPE[DEFAULT_AGENT_INTERVIEW_TYPE],
      companyInfo: state.companyInfo,
      jobDescription: state.jobDescription,
      resumeText: state.resumeText,
      stageName: formatStageName(currentStage),
      stageNumber: stages.indexOf(currentStage) + 1,
      totalStages: stages.length,
      targetLanguage,
    });

    const chatHistory = (state.history || []).map(toChatMessage);
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt), ...chatHistory];
    if (chatHistory.length === 0) {
      messages.push(new HumanMessage(START_INTERVIEW_MESSAGE));
    }

    const llm = createChatModel(provider, apiKey, INTERVIEWER_TEMPERATURE);
    const response = await llm.invoke(messages);
    return { nextInterviewerSpeech: response.text };
  };

  return new StateGraph(InterviewState)
    .addNode('evaluateAnswerNode', evaluateAnswerNode)
    .addNode('routeNextStageNode', routeNextStageNode)
    .addNode('formulateQuestionNode', formulateQuestionNode)
    .addEdge(START, 'evaluateAnswerNode')
    .addEdge('evaluateAnswerNode', 'routeNextStageNode')
    .addEdge('routeNextStageNode', 'formulateQuestionNode')
    .addEdge('formulateQuestionNode', END)
    .compile({ checkpointer: new MemorySaver() });
};

export type InterviewAgent = ReturnType<typeof createInterviewAgent>;
