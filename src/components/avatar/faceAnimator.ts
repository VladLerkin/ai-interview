import { getTargetEmotionWeights, NEUTRAL_EMOTION_WEIGHTS, type AvatarEmotion, type EmotionWeights } from './emotions';
import { pickSyllable, VISEME_SILENCE, type Viseme } from './visemes';

// ── Helper: lerp ────────────────────────────────────────────────────
export function lerp(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * Math.min(1, speed * dt);
}

const VISEME_LERP_SPEED = 14;
const EMOTION_LERP_SPEED = 3;
const GAZE_LERP_SPEED = 3;
const BLINK_DURATION_S = 0.12;

/** Model-agnostic facial state for a single frame. Rigs translate it into bones / blendshapes. */
export interface FaceFrame {
  dt: number;
  elapsed: number;
  speaking: boolean;
  emotion: AvatarEmotion;
  /** 0 = open, 1 = closed */
  blink: number;
  viseme: Viseme;
  emotionWeights: EmotionWeights;
  gazeX: number;
  gazeY: number;
}

/**
 * Creates a stateful procedural face animator: lip-sync visemes, blinking,
 * smoothed emotions and idle gaze. Call the returned function once per frame.
 */
export function createFaceAnimator() {
  let elapsed = 0;

  // Blink state
  let nextBlinkTime = 1.5 + Math.random() * 3;
  let doubleBlinkChance = false;

  // Viseme state (lip sync)
  const currentViseme: Viseme = { ...VISEME_SILENCE };
  let targetViseme: Viseme = { ...VISEME_SILENCE };
  let visemeHoldRemaining = 0;

  // Emotion state (smoothly interpolated)
  const currentEmotionWeights: EmotionWeights = { ...NEUTRAL_EMOTION_WEIGHTS };

  // Gaze state
  let gazeTargetX = 0;
  let gazeTargetY = 0;
  let currentGazeX = 0;
  let currentGazeY = 0;
  let nextGazeChange = 1 + Math.random() * 3;

  return (dt: number, speaking: boolean, emotion: AvatarEmotion): FaceFrame => {
    elapsed += dt;

    // 1. Viseme Lip Sync
    if (speaking) {
      visemeHoldRemaining -= dt * 1000;
      if (visemeHoldRemaining <= 0) {
        const syl = pickSyllable();
        targetViseme = { ...syl.viseme };
        visemeHoldRemaining = syl.holdMs;
      }
    } else {
      targetViseme = { ...VISEME_SILENCE };
    }
    for (const key of Object.keys(currentViseme) as (keyof Viseme)[]) {
      currentViseme[key] = lerp(currentViseme[key], targetViseme[key], VISEME_LERP_SPEED, dt);
    }

    // 2. Blinking
    let blink = 0;
    if (elapsed > nextBlinkTime) {
      const p = (elapsed - nextBlinkTime) / BLINK_DURATION_S;
      if (p < 1) {
        blink = p < 0.5 ? p * 2 : 2 - p * 2;
      } else if (doubleBlinkChance) {
        nextBlinkTime = elapsed + 0.2;
        doubleBlinkChance = false;
      } else {
        nextBlinkTime = elapsed + 2 + Math.random() * 5;
        doubleBlinkChance = Math.random() < 0.2;
      }
    }

    // 3. Emotions
    const targetEmotions = getTargetEmotionWeights(emotion, speaking);
    for (const key of Object.keys(currentEmotionWeights) as (keyof EmotionWeights)[]) {
      currentEmotionWeights[key] = lerp(currentEmotionWeights[key], targetEmotions[key], EMOTION_LERP_SPEED, dt);
    }

    // 4. Gaze
    if (elapsed > nextGazeChange) {
      if (Math.random() < 0.3) {
        gazeTargetX = (Math.random() - 0.5) * 0.4;
        gazeTargetY = (Math.random() - 0.5) * 0.2;
      } else {
        gazeTargetX = 0;
        gazeTargetY = 0;
      }
      nextGazeChange = elapsed + 1.5 + Math.random() * 4;
    }
    currentGazeX = lerp(currentGazeX, gazeTargetX, GAZE_LERP_SPEED, dt);
    currentGazeY = lerp(currentGazeY, gazeTargetY, GAZE_LERP_SPEED, dt);

    return {
      dt,
      elapsed,
      speaking,
      emotion,
      blink,
      viseme: currentViseme,
      emotionWeights: currentEmotionWeights,
      gazeX: currentGazeX,
      gazeY: currentGazeY,
    };
  };
}

/** Shared idle head motion (slow sway + nodding while speaking), in radians. */
export function idleHeadMotion(elapsed: number, speaking: boolean) {
  const speakNod = speaking ? Math.sin(elapsed * 2.5) * 0.008 : 0;
  return {
    yaw: Math.sin(elapsed * 0.35) * 0.025,
    pitch: Math.sin(elapsed * 0.55) * 0.012 + speakNod,
  };
}

/** Breathing phase in [-1, 1]; rigs scale it to their own amplitude. */
export const breathPhase = (elapsed: number) => Math.sin(elapsed * 1.5);
