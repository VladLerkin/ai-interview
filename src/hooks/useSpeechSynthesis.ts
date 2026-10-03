import { useCallback, useState } from 'react';
import { computeProsody, pickVoice, splitSentences } from '../lib/speech';
import type { Language } from '../types/interview';

/** How long to wait for `voiceschanged` before speaking with the default voice. */
const VOICES_LOAD_TIMEOUT_MS = 1000;

/** Text-to-speech via `window.speechSynthesis`, one utterance per sentence for natural intonation. */
export const useSpeechSynthesis = (language: Language) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      const synth = window.speechSynthesis;
      let started = false;

      const doSpeak = () => {
        if (started) return;
        started = true;
        synth.removeEventListener('voiceschanged', doSpeak);

        const sentences = splitSentences(text);
        if (sentences.length === 0) return;

        setIsSpeaking(true);
        const voice = pickVoice(synth.getVoices(), language);

        sentences.forEach((sentence, index) => {
          const { pitch, rate } = computeProsody(sentence, index, sentences.length);
          const utterance = new SpeechSynthesisUtterance(sentence);
          utterance.lang = language;
          if (voice) utterance.voice = voice;
          utterance.pitch = pitch;
          utterance.rate = rate;
          utterance.volume = 1.0;

          if (index === sentences.length - 1) {
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
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
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
};
