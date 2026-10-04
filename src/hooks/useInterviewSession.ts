import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInterviewAgent,
  type InterviewAgent,
  type InterviewGraphState,
} from '../agent/interviewGraph';
import { DEFAULT_AGENT_INTERVIEW_TYPE } from '../agent/stages';
import { getStoredData, setStoredData } from '../lib/store';
import type { InterviewConfig, InterviewSnapshot } from '../types/interview';

/** Pause before the first line so the avatar can "smile" at the candidate first. */
const GREETING_DELAY_MS = 1500;

const INITIAL_SNAPSHOT: InterviewSnapshot = {
  history: [],
  interviewStage: 'warmup',
  nextInterviewerSpeech: '',
  latestFeedback: null,
};

const toSnapshot = (state: InterviewGraphState): InterviewSnapshot => ({
  history: state.history,
  interviewStage: state.interviewStage,
  nextInterviewerSpeech: state.nextInterviewerSpeech,
  // The graph always has a default (empty) feedback object; only show it once something was evaluated.
  latestFeedback: state.lastCandidateAnswer ? state.latestFeedback : null,
  isCompleted: state.isCompleted,
});

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Owns the LangGraph agent for one interview: starts it (or restores a saved session),
 * submits answers, persists progress and triggers the interviewer's speech.
 */
export const useInterviewSession = (config: InterviewConfig, speak: (text: string) => void) => {
  const [agent, setAgent] = useState<InterviewAgent | null>(null);
  const [snapshot, setSnapshot] = useState<InterviewSnapshot>(INITIAL_SNAPSHOT);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [threadId] = useState(() => crypto.randomUUID());

  const initCalledRef = useRef(false);
  const speakRef = useRef(speak);
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Speech waits for the 3D model to finish loading.
  const modelReadyRef = useRef(false);
  const pendingSpeechRef = useRef<string | null>(null);

  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  useEffect(() => () => clearTimeout(greetingTimerRef.current), []);

  const runConfig = useMemo(() => ({ configurable: { thread_id: threadId } }), [threadId]);

  // Sent with every invocation so the graph has full context even after a page reload
  // (the in-memory checkpointer does not survive it).
  const interviewContext = useMemo(
    () => ({
      resumeText: config.resumeText,
      jobDescription: config.jobDescription,
      companyInfo: config.companyInfo,
      interviewType: config.interviewType || DEFAULT_AGENT_INTERVIEW_TYPE,
      interviewerGender: config.interviewerGender,
    }),
    [config.resumeText, config.jobDescription, config.companyInfo, config.interviewType, config.interviewerGender],
  );

  const speakAfterGreeting = useCallback((text: string) => {
    clearTimeout(greetingTimerRef.current);
    greetingTimerRef.current = setTimeout(() => speakRef.current(text), GREETING_DELAY_MS);
  }, []);

  /** Pass to the avatar: flushes speech that arrived while the model was still loading. */
  const handleModelReady = useCallback(() => {
    modelReadyRef.current = true;
    const pending = pendingSpeechRef.current;
    if (pending) {
      pendingSpeechRef.current = null;
      speakAfterGreeting(pending);
    }
  }, [speakAfterGreeting]);

  const commit = useCallback(async (state: InterviewGraphState) => {
    const next = toSnapshot(state);
    setSnapshot(next);
    await setStoredData('interviewState', next);
    return next;
  }, []);

  const showError = useCallback((text: string) => {
    setSnapshot((prev) => ({ ...prev, nextInterviewerSpeech: text }));
  }, []);

  // Create the agent and either restore the saved session or ask the first question.
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    const graph = createInterviewAgent(config.provider, config.apiKey, config.language);
    setAgent(graph);

    (async () => {
      try {
        const saved = await getStoredData('interviewState');
        if (saved) {
          // Don't auto-speak on restore: without a user gesture the browser blocks TTS
          // and `isSpeaking` would get stuck at true.
          setSnapshot(saved);
          return;
        }

        const result = await graph.invoke({ ...interviewContext, interviewStage: 'warmup', history: [] }, runConfig);
        const next = await commit(result);

        if (next.nextInterviewerSpeech) {
          if (modelReadyRef.current) speakAfterGreeting(next.nextInterviewerSpeech);
          else pendingSpeechRef.current = next.nextInterviewerSpeech;
        }
      } catch (err) {
        console.error('Agent execution failed:', err);
        showError(`Error starting interview. Please check your API key and connection. (${errorMessage(err)})`);
      }
    })();
  }, [config.provider, config.apiKey, config.language, interviewContext, runConfig, commit, speakAfterGreeting, showError]);

  /** Sends the candidate's answer. Resolves to `true` on success. */
  const submitAnswer = useCallback(
    async (answer: string): Promise<boolean> => {
      const text = answer.trim();
      if (!text || !agent) return false;

      setIsEvaluating(true);
      try {
        const result = await agent.invoke(
          {
            ...interviewContext,
            nextInterviewerSpeech: snapshot.nextInterviewerSpeech,
            lastCandidateAnswer: text,
            history: [
              ...snapshot.history,
              { role: 'interviewer', content: snapshot.nextInterviewerSpeech },
              { role: 'candidate', content: text },
            ],
          },
          runConfig,
        );
        const next = await commit(result);
        if (next.nextInterviewerSpeech) speakRef.current(next.nextInterviewerSpeech);
        return true;
      } catch (err) {
        console.error('Agent execution failed:', err);
        showError(`Error communicating with AI. (${errorMessage(err)})`);
        return false;
      } finally {
        setIsEvaluating(false);
      }
    },
    [agent, interviewContext, snapshot, runConfig, commit, showError],
  );

  return { snapshot, isEvaluating, submitAnswer, handleModelReady };
};
