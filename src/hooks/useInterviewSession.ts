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

  const isMountedRef = useRef(true);
  const initCalledRef = useRef(false);
  const speakRef = useRef(speak);
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Speech waits for the 3D model to finish loading.
  const modelReadyRef = useRef(false);
  const pendingSpeechRef = useRef<string | null>(null);

  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  useEffect(() => {
    // Must be reset on (re)mount: StrictMode runs cleanup and then the effect again in dev.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimeout(greetingTimerRef.current);
    };
  }, []);

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
    if (!isMountedRef.current) return;
    greetingTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        speakRef.current(text);
      }
    }, GREETING_DELAY_MS);
  }, []);

  /** Pass to the avatar: flushes speech that arrived while the model was still loading. */
  const handleModelReady = useCallback(() => {
    modelReadyRef.current = true;
    if (!isMountedRef.current) return;
    const pending = pendingSpeechRef.current;
    if (pending) {
      pendingSpeechRef.current = null;
      speakAfterGreeting(pending);
    }
  }, [speakAfterGreeting]);

  const commit = useCallback(async (state: InterviewGraphState) => {
    const next = toSnapshot(state);
    if (!isMountedRef.current) return next;
    setSnapshot(next);
    await setStoredData('interviewState', next);
    return next;
  }, []);

  const showError = useCallback((text: string) => {
    if (!isMountedRef.current) return;
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
        if (!isMountedRef.current) return;
        if (saved?.nextInterviewerSpeech) {
          setSnapshot(saved);
          if (!saved.isCompleted) {
            if (modelReadyRef.current) speakAfterGreeting(saved.nextInterviewerSpeech);
            else pendingSpeechRef.current = saved.nextInterviewerSpeech;
          }
          return;
        }

        const result = await graph.invoke({ ...interviewContext, interviewStage: 'warmup', history: [] }, runConfig);
        if (!isMountedRef.current) return;
        const next = await commit(result);
        if (!isMountedRef.current) return;

        if (next.nextInterviewerSpeech) {
          if (modelReadyRef.current) speakAfterGreeting(next.nextInterviewerSpeech);
          else pendingSpeechRef.current = next.nextInterviewerSpeech;
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('Agent execution failed:', err);
        showError(`Error starting interview. Please check your API key and connection. (${errorMessage(err)})`);
      }
    })();
  }, [config.provider, config.apiKey, config.language, interviewContext, runConfig, commit, speakAfterGreeting, showError]);

  /** Sends the candidate's answer. Resolves to `true` on success. */
  const submitAnswer = useCallback(
    async (answer: string): Promise<boolean> => {
      const text = answer.trim();
      if (!text || !agent || !isMountedRef.current) return false;

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
        if (!isMountedRef.current) return false;
        const next = await commit(result);
        if (isMountedRef.current && next.nextInterviewerSpeech) {
          speakRef.current(next.nextInterviewerSpeech);
        }
        return true;
      } catch (err) {
        if (!isMountedRef.current) return false;
        console.error('Agent execution failed:', err);
        showError(`Error communicating with AI. (${errorMessage(err)})`);
        return false;
      } finally {
        if (isMountedRef.current) {
          setIsEvaluating(false);
        }
      }
    },
    [agent, interviewContext, snapshot, runConfig, commit, showError],
  );

  return { snapshot, isEvaluating, submitAnswer, handleModelReady };
};
