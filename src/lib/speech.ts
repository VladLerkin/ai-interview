/** Pure helpers around the Web Speech API (TTS + STT). No React here. */

const PREFERRED_VOICE_HINTS = ['samantha', 'karen', 'female', 'zira', 'milena', 'google'];

export const isAndroid = (): boolean => /Android/i.test(navigator.userAgent);

export const getSpeechRecognitionCtor = (): SpeechRecognitionConstructor | undefined =>
  window.SpeechRecognition ?? window.webkitSpeechRecognition;

/**
 * Safari/iOS only allow speech synthesis after it was triggered from a user gesture.
 * Call this from a click handler to unlock it for later programmatic use.
 */
export const unlockSpeechSynthesis = (): void => {
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
};

/** Picks a pleasant (preferably female / Google) voice for the language, falling back to any match. */
export const pickVoice = (voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined => {
  const langPrefix = lang.split('-')[0];
  const matchesLang = (v: SpeechSynthesisVoice) => v.lang === lang || v.lang.replace('_', '-').startsWith(lang);
  const hasPreferredName = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    return PREFERRED_VOICE_HINTS.some((hint) => name.includes(hint));
  };

  return (
    voices.find((v) => matchesLang(v) && hasPreferredName(v)) ||
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith(langPrefix))
  );
};

/** Splits text into sentences. Avoids regex lookbehind for older Safari. */
export const splitSentences = (text: string): string[] =>
  text
    .match(/[^.!?…]+[.!?…]*/g)
    ?.map((s) => s.trim())
    .filter((s) => s.length > 0) || [text];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Computes pitch/rate for one sentence so speech sounds less robotic:
 * questions rise, exclamations speed up, the final sentence settles down,
 * plus a small random jitter.
 */
export const computeProsody = (sentence: string, index: number, total: number) => {
  const wordCount = sentence.split(/\s+/).length;
  const isQuestion = sentence.endsWith('?');
  const isExclamation = sentence.endsWith('!');
  const isFirst = index === 0;
  const isLast = index === total - 1;

  let pitch = 1.0 + (Math.random() - 0.5) * 0.1;
  let rate = 0.95 + (Math.random() - 0.5) * 0.06;

  if (isQuestion) {
    pitch += 0.12;
    rate -= 0.03;
  } else if (isExclamation) {
    pitch += 0.08;
    rate += 0.05;
  }

  if (isFirst) {
    pitch += 0.03;
    rate -= 0.02;
  }
  if (isLast && !isQuestion) {
    pitch -= 0.05;
    rate -= 0.03;
  }

  if (wordCount <= 5) rate -= 0.04;
  else if (wordCount > 20) rate += 0.03;

  return { pitch: clamp(pitch, 0.8, 1.3), rate: clamp(rate, 0.8, 1.15) };
};
