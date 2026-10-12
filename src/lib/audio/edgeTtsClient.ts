import { globalAudioAnalyser } from './audioAnalyser';
import { globalSpeechVisemeTracker } from './speechVisemeTracker';

let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;
let currentAbortController: AbortController | null = null;
let currentRequestId = 0;

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
  const requestId = ++currentRequestId;
  const abortController = new AbortController();
  currentAbortController = abortController;

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: abortController.signal,
    });

    if (abortController.signal.aborted || requestId !== currentRequestId) {
      return false;
    }

    if (!res.ok) {
      throw new Error(`TTS server responded with status: ${res.status}`);
    }

    const blob = await res.blob();
    if (abortController.signal.aborted || requestId !== currentRequestId) {
      return false;
    }

    if (blob.size === 0) {
      throw new Error('Received empty audio blob');
    }

    const url = URL.createObjectURL(blob);
    if (abortController.signal.aborted || requestId !== currentRequestId) {
      try {
        URL.revokeObjectURL(url);
      } catch { /* ignore */ }
      return false;
    }

    currentBlobUrl = url;
    const audio = new Audio(url);
    currentAudio = audio;

    // Connect this audio to Web Audio API FFT analyser for zero-latency lip sync
    globalAudioAnalyser.connectAudioElement(audio);

    // Initialize phonetic syllable timeline for the spoken text
    globalSpeechVisemeTracker.startSpeech(text);

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        globalSpeechVisemeTracker.adjustDuration(audio.duration);
      }
    };

    audio.onplay = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        globalSpeechVisemeTracker.adjustDuration(audio.duration);
      }
      callbacks?.onStart?.();
    };

    audio.onended = () => {
      globalSpeechVisemeTracker.reset();
      globalAudioAnalyser.disconnect();
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
      globalSpeechVisemeTracker.reset();
      globalAudioAnalyser.disconnect();
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
      if (!abortController.signal.aborted && requestId === currentRequestId) {
        callbacks?.onError?.(new Error('Audio playback failed'));
      }
    };

    await audio.play();
    return true;
  } catch (err: unknown) {
    globalSpeechVisemeTracker.reset();
    globalAudioAnalyser.disconnect();
    if (abortController.signal.aborted || requestId !== currentRequestId) {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      currentAudio = null;
      return false;
    }
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn('[EdgeTTS] Could not play edge speech, falling back to browser synthesis:', error.message);
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    currentAudio = null;
    return false;
  }
}

/**
 * Immediately stops any playing Edge TTS audio and cleans up resources.
 */
export function stopEdgeSpeech(): void {
  currentRequestId++;
  if (currentAbortController) {
    try {
      currentAbortController.abort();
    } catch { /* ignore */ }
    currentAbortController = null;
  }
  globalSpeechVisemeTracker.reset();
  globalAudioAnalyser.disconnect();
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
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

/**
 * Immediately stops all speech synthesis, both Edge Neural TTS audio and
 * native browser SpeechSynthesis (window.speechSynthesis).
 */
export function stopAllSpeech(): void {
  stopEdgeSpeech();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch { /* ignore */ }
  }
  globalSpeechVisemeTracker.setActive(false);
}
