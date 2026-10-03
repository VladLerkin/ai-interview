// ── Emotion type ────────────────────────────────────────────────────
export type AvatarEmotion = 'neutral' | 'happy' | 'thinking' | 'concerned' | 'greeting' | 'smirk';

/** Blend weights for the VRM emotion presets; GLB models map them onto ARKit blendshapes. */
export interface EmotionWeights {
  happy: number;
  relaxed: number;
  surprised: number;
  sad: number;
}

export const NEUTRAL_EMOTION_WEIGHTS: EmotionWeights = { happy: 0, relaxed: 0.15, surprised: 0, sad: 0 };

/** Minimum smile while talking so the avatar never looks stern mid-sentence. */
const SPEAKING_MIN_HAPPY = 0.25;

export function getTargetEmotionWeights(emotion: AvatarEmotion, speaking: boolean): EmotionWeights {
  const target = { ...NEUTRAL_EMOTION_WEIGHTS };
  switch (emotion) {
    case 'happy':
      target.happy = 0.7; target.relaxed = 0.3; break;
    case 'greeting':
      target.happy = 0.5; target.relaxed = 0.25; break;
    case 'thinking':
      target.relaxed = 0.1; target.happy = 0; break;
    case 'smirk':
      target.happy = 0.2;
      target.relaxed = 0.3;
      target.surprised = 0;
      break;
    case 'concerned':
      target.sad = 0.2; target.relaxed = 0; break;
    case 'neutral':
    default:
      target.relaxed = 0.15; break;
  }
  if (speaking) {
    target.happy = Math.max(target.happy, SPEAKING_MIN_HAPPY);
  }
  return target;
}
