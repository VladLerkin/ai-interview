import { useCallback, useEffect, useRef, useState } from 'react';
import { computeProsody, pickVoice, sanitizeForSpeech, splitSentences } from '../lib/speech';
import { globalAudioAnalyser, globalSpeechVisemeTracker, playEdgeSpeech, stopAllSpeech } from '../lib/audio';
import type { Language } from '../types/interview';

/** How long to wait for `voiceschanged` before speaking with the default voice. */
const VOICES_LOAD_TIMEOUT_MS = 1000;

/** Text-to-speech via Microsoft Edge Neural TTS with Web Audio FFT, falling back to window.speechSynthesis. */
export const useSpeechSynthesis = (language: Language) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cancelPendingRef = useRef(false);
  const voiceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stop = useCallback(() => {
    cancelPendingRef.current = true;
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = undefined;
    }
    stopAllSpeech();
    setIsSpeaking(false);
  }, []);

  // Cleanup speech synthesis automatically on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const speak = useCallback(
    async (text: string) => {
      if (!text) return;
      cancelPendingRef.current = false;
      if (voiceTimeoutRef.current) {
        clearTimeout(voiceTimeoutRef.current);
        voiceTimeoutRef.current = undefined;
      }

      // Synchronously resume AudioContext within any active user gesture
      globalAudioAnalyser.resume().catch(() => {});

      const speechText = sanitizeForSpeech(text);

      // 1. Try Microsoft Edge Neural TTS with real-time Web Audio FFT analysis
      const success = await playEdgeSpeech(speechText, language, {
        onStart: () => {
          if (!cancelPendingRef.current) {
            setIsSpeaking(true);
          }
        },
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });

      if (cancelPendingRef.current) {
        stopAllSpeech();
        setIsSpeaking(false);
        return;
      }

      if (success) {
        return;
      }

      // 2. Fallback to native window.speechSynthesis
      const synth = window.speechSynthesis;
      try {
        synth.cancel();
        synth.resume();
      } catch {
        /* ignore */
      }
      let started = false;

      const doSpeak = () => {
        if (started || cancelPendingRef.current) return;
        started = true;
        synth.removeEventListener('voiceschanged', doSpeak);

        const sentences = splitSentences(speechText);
        if (sentences.length === 0) return;

        setIsSpeaking(true);
        globalSpeechVisemeTracker.reset();
        globalSpeechVisemeTracker.setActive(true);

        const voice = pickVoice(synth.getVoices(), language);

        sentences.forEach((sentence, index) => {
          const { pitch, rate } = computeProsody(sentence, index, sentences.length);
          const utterance = new SpeechSynthesisUtterance(sentence);
          utterance.lang = language;
          if (voice) utterance.voice = voice;
          utterance.pitch = pitch;
          utterance.rate = rate;
          utterance.volume = 1.0;

          utterance.onboundary = (event) => {
            if (event.name === 'word') {
              globalSpeechVisemeTracker.onWordBoundary(sentence, event.charIndex, event.charLength, rate);
            }
          };

          if (index === sentences.length - 1) {
            utterance.onend = () => {
              setIsSpeaking(false);
              globalSpeechVisemeTracker.setActive(false);
            };
            utterance.onerror = () => {
              setIsSpeaking(false);
              globalSpeechVisemeTracker.setActive(false);
            };
          }
          synth.speak(utterance);
        });
      };

      // Voices load asynchronously in Chrome.
      if (synth.getVoices().length > 0) {
        doSpeak();
      } else {
        synth.addEventListener('voiceschanged', doSpeak, { once: true });
        voiceTimeoutRef.current = setTimeout(doSpeak, VOICES_LOAD_TIMEOUT_MS);
      }
    },
    [language],
  );

  return { isSpeaking, speak, stop };
};
