import { StateGraph, START, END, Annotation, MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import type { InterviewType } from '../types/interview';


// Stage definitions per interview type
const stagesByType: Record<InterviewType, string[]> = {
  hr_screening: ['introduction', 'background', 'motivation', 'culture_fit', 'salary_expectations', 'candidate_questions'],
  technical: ['warmup', 'core_skills', 'problem_solving', 'technical_deepdive', 'edge_cases', 'wrapup'],
  system_design: ['requirements', 'high_level_design', 'detailed_design', 'tradeoffs', 'scalability', 'wrapup'],
  behavioral: ['introduction', 'teamwork_star', 'leadership_star', 'conflict_star', 'growth_star', 'wrapup'],
  full_loop: ['warmup', 'technical_deepdive', 'system_design', 'behavioral_star', 'wrapup'],
};

// System prompts per interview type
const systemPromptsByType: Record<InterviewType, string> = {
  hr_screening: `You are an HR recruiter doing a brief initial screening call (not a deep technical interview).
Focus ONLY on typical screening questions:
- Basic background check
- Notice period / availability to start
- Salary expectations
- Location / willingness to relocate
- High-level interest in the company
Do not ask deep technical questions. Keep the tone casual and fast-paced.`,

  technical: `You are a Principal Software Engineer conducting a technical interview.
Focus on:
- Deep knowledge of their tech stack and tools
- Problem-solving approach and algorithmic thinking
- Code quality, testing, and best practices
- System-level understanding and debugging skills
Ask progressively harder questions. Start friendly, then drill deeper into their technical expertise.`,

  system_design: `You are a Staff Engineer conducting a system design interview.
Focus on:
- Clarifying requirements and constraints before designing
- High-level architecture and component breakdown
- Data modeling, API design, and database choices
- Scalability, reliability, and trade-off discussions
Guide the candidate through the design process. Ask probing questions about trade-offs.`,

  behavioral: `You are a senior hiring manager conducting a behavioral interview using the STAR method.
Focus on:
- Real past experiences (Situation, Task, Action, Result)
- Leadership, teamwork, and conflict resolution examples
- How they handle failure, feedback, and ambiguity
- Growth mindset and self-awareness
Encourage specific, detailed stories. Push for concrete results and learnings.`,

  full_loop: `You are a Principal Software Engineer conducting a comprehensive interview.
This is a full interview loop that covers all aspects: initial warmup, technical deep-dive, behavioral assessment, and wrap-up.
Adapt your style to the current stage. Be thorough but also conversational.`,
};

export const InterviewState = Annotation.Root({
  resumeText: Annotation<string>(),
  jobDescription: Annotation<string>(),
  companyInfo: Annotation<string>(),
  interviewType: Annotation<InterviewType>(),
  interviewStage: Annotation<string>(),
  history: Annotation<{ role: 'candidate' | 'interviewer'; content: string }[]>({
    reducer: (_curr, update) => update,
    default: () => [],
  }),
  lastCandidateAnswer: Annotation<string>(),
  latestFeedback: Annotation<{
    grammarCorrections: string[];
    vocabularySuggestions: string[];
    contentScore: number;
    comment: string;
    suggestedAnswer: string;
  }>({
    reducer: (_curr, update) => update,
    default: () => ({ grammarCorrections: [], vocabularySuggestions: [], contentScore: 0, comment: '', suggestedAnswer: '' }),
  }),
  nextInterviewerSpeech: Annotation<string>(),
  isCompleted: Annotation<boolean>({
    reducer: (_curr, update) => update,
    default: () => false,
  }),
});

export const createInterviewAgent = (provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek', apiKey: string) => {
  const getLLM = (temperature = 0.7) => {
    if (provider === 'openai') {
      return new ChatOpenAI({
        apiKey: apiKey,
        model: 'gpt-4o-mini',
        temperature,
        configuration: {
          dangerouslyAllowBrowser: true
        }
      });
    } else if (provider === 'deepseek') {
      return new ChatOpenAI({
        apiKey: apiKey,
        model: 'deepseek-chat',
        temperature,
        configuration: {
          baseURL: 'https://api.deepseek.com/v1',
          dangerouslyAllowBrowser: true
        }
      });
    } else if (provider === 'anthropic') {
      return new ChatAnthropic({
        apiKey: apiKey,
        model: 'claude-3-haiku-20240307',
        temperature,
        clientOptions: {
          dangerouslyAllowBrowser: true
        }
      });
    } else {
      return new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: 'gemini-3.8-flash',
        temperature,
      });
    }
  };

  const evaluateAnswerNode = async (state: typeof InterviewState.State) => {
    if (!state.lastCandidateAnswer) return {};

    const llm = getLLM(0.0);
    const languageMap: Record<string, string> = {
      'en-US': 'English (American)',
      'en-GB': 'English (British)',
      'ru-RU': 'Russian (Русский)',
      'de-DE': 'German (Deutsch)'
    };
    const targetLang = languageMap[config.language || 'en-US'] || 'English (American)';

    const prompt = `You are an expert interviewer.
Evaluate the candidate's last answer. 
Previous Interviewer Speech: ${state.nextInterviewerSpeech || 'Tell me about yourself.'}
Candidate Answer: ${state.lastCandidateAnswer}
Candidate Resume Context: ${(state.resumeText || '').slice(0, 500)}
Interview Type: ${state.interviewType || 'technical'}

IMPORTANT: You MUST write your feedback (all text, comments, and suggested answers) entirely in ${targetLang}.

Provide feedback strictly in the following JSON format:
{
  "grammarCorrections": ["list of corrected sentences or empty"],
  "vocabularySuggestions": ["better words/phrases to use or empty"],
  "contentScore": 1-10,
  "comment": "short comment on their performance in ${targetLang}",
  "suggestedAnswer": "Write a short, simple, and punchy conversational answer (1-2 sentences MAXIMUM) that the candidate COULD have given. It must be very easy to say out loud. Keep vocabulary simple and natural. MUST be written in ${targetLang}."
}`;
    
    try {
      const response = await llm.invoke([new HumanMessage(prompt)]);
      // simple json extraction
      const content = (response.content as string).replace(/```json/g, '').replace(/```/g, '').trim();
      const feedback = JSON.parse(content);
      return {
        latestFeedback: {
          grammarCorrections: feedback.grammarCorrections || [],
          vocabularySuggestions: feedback.vocabularySuggestions || [],
          contentScore: feedback.contentScore || 5,
          comment: feedback.comment || '',
          suggestedAnswer: feedback.suggestedAnswer || '',
        }
      };
    } catch (e) {
      console.error('Failed to parse feedback JSON', e);
      return {
        latestFeedback: {
          grammarCorrections: [],
          vocabularySuggestions: [],
          contentScore: 5,
          comment: 'Failed to evaluate answer.',
          suggestedAnswer: '',
        }
      };
    }
  };

  const routeNextStageNode = async (state: typeof InterviewState.State) => {
    const type = state.interviewType || 'full_loop';
    const stages = stagesByType[type] || stagesByType.full_loop;
    const exchanges = (state.history || []).filter(h => h.role === 'candidate').length;

    // Map exchange count to stage index
    const stageIndex = Math.min(exchanges, stages.length - 1);
    const isCompleted = exchanges >= stages.length;
    const nextStage = isCompleted ? stages[stages.length - 1] : stages[stageIndex];

    return { interviewStage: nextStage, isCompleted };
  };

  const formulateQuestionNode = async (state: typeof InterviewState.State) => {
    if (state.isCompleted) {
      return { nextInterviewerSpeech: "Thank you for your time today. It was great getting to know you. We'll be in touch!" };
    }

    const llm = getLLM(0.7);
    const type = state.interviewType || 'full_loop';
    const typePrompt = systemPromptsByType[type] || systemPromptsByType.full_loop;
    const stages = stagesByType[type] || stagesByType.full_loop;
    const currentStageIndex = stages.indexOf(state.interviewStage || stages[0]);
    const totalStages = stages.length;
    
    const languageMap: Record<string, string> = {
      'en-US': 'English (American)',
      'en-GB': 'English (British)',
      'ru-RU': 'Russian (Русский)',
      'de-DE': 'German (Deutsch)'
    };
    const targetLang = languageMap[config.language || 'en-US'] || 'English (American)';

    let sysMsg = `${typePrompt}

Company: ${state.companyInfo || 'a leading tech company'}.
Target role: ${state.jobDescription}.
Candidate Resume: ${state.resumeText}.

Current Stage: ${(state.interviewStage || stages[0]).replace(/_/g, ' ')} (${currentStageIndex + 1} of ${totalStages}).
LANGUAGE REQUIREMENT: You MUST conduct this interview exclusively in ${targetLang}. All your responses MUST be in ${targetLang}.
CRITICAL RULES:
- Keep your responses extremely concise, conversational, and simple.
- Speak in very short phrases, maximum 1 or 2 short sentences per response. 
- Avoid long monologues, complex paragraphs, or reading back their resume to them.
- Act like a real person having a quick chat. 
- Do not include stage directions or labels.
- NEVER explicitly mention the internal stage name (e.g. do not say "Welcome to the culture fit stage" or "Now let's move to the system design stage"). Just ask the questions naturally.`;

    const chatHistory = (state.history || []).map(h => 
      h.role === 'interviewer' ? new AIMessage(h.content) : new HumanMessage(h.content)
    );

    const messages: any[] = [new SystemMessage(sysMsg), ...chatHistory];
    
    // Gemini requires at least one user message in the contents array.
    if (chatHistory.length === 0) {
      messages.push(new HumanMessage("Please start the interview."));
    }

    const response = await llm.invoke(messages);

    return { nextInterviewerSpeech: response.content as string };
  };

  const workflow = new StateGraph(InterviewState)
    .addNode('evaluateAnswerNode', evaluateAnswerNode)
    .addNode('routeNextStageNode', routeNextStageNode)
    .addNode('formulateQuestionNode', formulateQuestionNode)
    .addEdge(START, 'evaluateAnswerNode')
    .addEdge('evaluateAnswerNode', 'routeNextStageNode')
    .addEdge('routeNextStageNode', 'formulateQuestionNode')
    .addEdge('formulateQuestionNode', END);

  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer });
};
