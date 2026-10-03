import { useCallback, useState } from 'react';
import { computeProsody, pickVoice, splitSentences } from '../lib/speech';
import { globalSpeechVisemeTracker, playEdgeSpeech, stopEdgeSpeech } from '../lib/audio';
import type { Language } from '../types/interview';

/** How long to wait for `voiceschanged` before speaking with the default voice. */
const VOICES_LOAD_TIMEOUT_MS = 1000;

/** Text-to-speech via Microsoft Edge Neural TTS with Web Audio FFT, falling back to window.speechSynthesis. */
export const useSpeechSynthesis = (language: Language) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
    async (text: string) => {
      if (!text) return;

      // 1. Try Microsoft Edge Neural TTS with real-time Web Audio FFT analysis
      const success = await playEdgeSpeech(text, language, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });

      if (success) {
        setIsSpeaking(true);
        return;
      }

      // 2. Fallback to native window.speechSynthesis
      const synth = window.speechSynthesis;
      let started = false;

      const doSpeak = () => {
        if (started) return;
        started = true;
        synth.removeEventListener('voiceschanged', doSpeak);

        const sentences = splitSentences(text);
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
        setTimeout(doSpeak, VOICES_LOAD_TIMEOUT_MS);
      }
    },
    [language],
  );

  const stop = useCallback(() => {
    stopEdgeSpeech();
    window.speechSynthesis.cancel();
    globalSpeechVisemeTracker.setActive(false);
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
};
