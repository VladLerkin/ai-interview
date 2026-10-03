import type { AvatarEmotion } from '../avatar/emotions';

/** Avatar mood while the interviewer is talking, by interview stage. */
const SPEAKING_EMOTION_BY_STAGE: Record<string, AvatarEmotion> = {
  warmup: 'greeting',
  introduction: 'greeting',
  technical_deepdive: 'thinking',
  system_design: 'thinking',
  problem_solving: 'thinking',
  wrapup: 'happy',
};

interface EmotionInput {
  isEvaluating: boolean;
  isSpeaking: boolean;
  hasSpeech: boolean;
  stage: string | undefined;
}

export const getAvatarEmotion = ({ isEvaluating, isSpeaking, hasSpeech, stage }: EmotionInput): AvatarEmotion => {
  if (isEvaluating) {
    // "Услышав мой ответ, улыбнулась"
    return 'happy';
  }
  if (!isSpeaking) {
    // "Закончила говорить, улыбнулась мило"
    return hasSpeech ? 'happy' : 'neutral';
  }
  // While speaking, match the stage tone
  return (stage && SPEAKING_EMOTION_BY_STAGE[stage]) || 'neutral';
};
