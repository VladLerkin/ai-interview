import { globalAudioAnalyser } from './audioAnalyser';

let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

export interface PlaySpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Synthesizes and plays high-quality Microsoft Edge Neural Speech via `/api/tts`.
 * Directly feeds the audio into the Web Audio API Analyser for real-time FFT lip sync.
 * Returns true if played successfully, or false if fallback is required.
 */
export async function playEdgeSpeech(
  text: string,
  lang = 'en-US',
  callbacks?: PlaySpeechCallbacks,
): Promise<boolean> {
  stopEdgeSpeech();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });

    if (!res.ok) {
      throw new Error(`TTS server responded with status: ${res.status}`);
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error('Received empty audio blob');
    }

    const url = URL.createObjectURL(blob);
    currentBlobUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;

    // Connect this audio to Web Audio API FFT analyser for zero-latency lip sync
    globalAudioAnalyser.connectAudioElement(audio);

    audio.onplay = () => {
      callbacks?.onStart?.();
    };

    audio.onended = () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
      callbacks?.onEnd?.();
    };

    audio.onerror = () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
      callbacks?.onError?.(new Error('Audio playback failed'));
    };

    await audio.play();
    return true;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn('[EdgeTTS] Could not play edge speech, falling back to browser synthesis:', error.message);
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    currentAudio = null;
    callbacks?.onError?.(error);
    return false;
  }
}

/**
 * Immediately stops any playing Edge TTS audio and cleans up resources.
 */
export function stopEdgeSpeech(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch { /* ignore */ }
    currentAudio = null;
  }
  if (currentBlobUrl) {
    try {
      URL.revokeObjectURL(currentBlobUrl);
    } catch { /* ignore */ }
    currentBlobUrl = null;
  }
}
