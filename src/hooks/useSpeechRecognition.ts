import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechRecognitionCtor, isAndroid } from '../lib/speech';
import type { Language } from '../types/interview';

/** Errors that happen in normal use (manual stop, silence timeout) and shouldn't be shown. */
const IGNORED_ERRORS = new Set(['no-speech', 'aborted']);

const appendText = (prev: string, text: string) => prev + (prev ? ' ' : '') + text;

/** Speech-to-text via the Web Speech API, with a manually editable transcript. */
export const useSpeechRecognition = (language: Language) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscriptState] = useState('');
  const [interimTranscript, setInterimState] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Mirrors `interimTranscript` so `onend` can read it without side effects inside a state updater.
  const interimRef = useRef('');

  const setInterim = useCallback((value: string) => {
    interimRef.current = value;
    setInterimState(value);
  }, []);

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = !isAndroid(); // continuous mode is extremely buggy on Android
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) setTranscriptState((prev) => appendText(prev, finalText));
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (!IGNORED_ERRORS.has(event.error)) {
        setTranscriptState((prev) => prev + ` [Mic Error: ${event.error}]`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // On Android a manual stop aborts and drops interim results — keep them.
      const pending = interimRef.current.trim();
      if (pending) setTranscriptState((prev) => appendText(prev, pending));
      setInterim('');
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [language, setInterim]);

  const start = useCallback(() => {
    setTranscriptState('');
    setInterim('');
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch (err) {
      console.error('Mic start error', err);
    }
  }, [setInterim]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => (isListening ? stop() : start()), [isListening, start, stop]);

  /** Manual edit from the textarea: replaces the transcript and drops any pending interim text. */
  const setTranscript = useCallback(
    (value: string) => {
      setTranscriptState(value);
      setInterim('');
    },
    [setInterim],
  );

  const clearTranscript = useCallback(() => setTranscriptState(''), []);

  return {
    isListening,
    transcript,
    interimTranscript,
    start,
    stop,
    toggle,
    setTranscript,
    clearTranscript,
  };
};
