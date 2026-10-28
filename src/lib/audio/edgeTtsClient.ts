import { globalAudioAnalyser } from './audioAnalyser';
import { globalSpeechVisemeTracker } from './speechVisemeTracker';

let currentAudio: HTMLAudioElement | null = null;
let currentBufferSource: AudioBufferSourceNode | null = null;
let currentBlobUrl: string | null = null;
let currentAbortController: AbortController | null = null;
let cleanupUnlockListeners: (() => void) | null = null;
let currentRequestId = 0;

export interface PlaySpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

async function resumeAnalyserWithTimeout(timeoutMs = 150): Promise<void> {
  try {
    await Promise.race([
      globalAudioAnalyser.resume(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    /* ignore */
  }
}

async function fetchEdgeTtsAudio(
  text: string,
  lang: string,
  signal: AbortSignal,
  maxAttempts = 3,
): Promise<ArrayBuffer> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
        signal,
      });

      if (!res.ok) {
        throw new Error(`TTS server responded with status: ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Received empty audio blob');
      }

      return arrayBuffer;
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw err;
      }
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
  throw lastError || new Error('Failed to fetch Edge TTS audio');
}

async function playViaAudioContext(
  ctx: AudioContext,
  arrayBuffer: ArrayBuffer,
  text: string,
  requestId: number,
  callbacks?: PlaySpeechCallbacks,
): Promise<boolean> {
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  if (requestId !== currentRequestId) {
    return true;
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  currentBufferSource = source;

  globalAudioAnalyser.connectSourceNode(source);
  globalSpeechVisemeTracker.startSpeech(text);
  if (audioBuffer.duration > 0) {
    globalSpeechVisemeTracker.adjustDuration(audioBuffer.duration);
  }

  source.onended = () => {
    if (currentBufferSource === source) {
      currentBufferSource = null;
      globalSpeechVisemeTracker.reset();
      globalAudioAnalyser.disconnect();
      callbacks?.onEnd?.();
    }
  };

  source.start(0);
  callbacks?.onStart?.();
  return true;
}

function schedulePlayOnFirstGesture(
  arrayBuffer: ArrayBuffer,
  text: string,
  requestId: number,
  callbacks?: PlaySpeechCallbacks,
): void {
  if (typeof window === 'undefined') return;
  if (cleanupUnlockListeners) {
    cleanupUnlockListeners();
  }

  const onGesture = async () => {
    if (cleanupUnlockListeners) {
      cleanupUnlockListeners();
    }
    if (requestId !== currentRequestId) return;

    await resumeAnalyserWithTimeout(300);
    if (requestId !== currentRequestId) return;

    const ctx = globalAudioAnalyser.context;
    if (ctx && ctx.state === 'running') {
      try {
        await playViaAudioContext(ctx, arrayBuffer, text, requestId, callbacks);
      } catch {
        /* ignore */
      }
    }
  };

  const remove = () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('touchstart', onGesture);
    window.removeEventListener('keydown', onGesture);
    cleanupUnlockListeners = null;
  };

  cleanupUnlockListeners = remove;
  window.addEventListener('pointerdown', onGesture, { once: true, passive: true });
  window.addEventListener('touchstart', onGesture, { once: true, passive: true });
  window.addEventListener('keydown', onGesture, { once: true, passive: true });
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
    const arrayBuffer = await fetchEdgeTtsAudio(text, lang, abortController.signal);
    if (abortController.signal.aborted || requestId !== currentRequestId) {
      return true;
    }

    await resumeAnalyserWithTimeout();
    if (abortController.signal.aborted || requestId !== currentRequestId) {
      return true;
    }

    const ctx = globalAudioAnalyser.context;
    if (ctx && ctx.state === 'running') {
      try {
        return await playViaAudioContext(ctx, arrayBuffer, text, requestId, callbacks);
      } catch (decodeErr) {
        console.warn('[EdgeTTS] AudioContext decode failed, falling back to HTMLAudioElement:', decodeErr);
      }
    }

    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    if (abortController.signal.aborted || requestId !== currentRequestId) {
      try {
        URL.revokeObjectURL(url);
      } catch { /* ignore */ }
      return true;
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

    try {
      await audio.play();
      return true;
    } catch (playErr: unknown) {
      globalSpeechVisemeTracker.reset();
      globalAudioAnalyser.disconnect();
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      currentAudio = null;

      if ((playErr as Error)?.name === 'NotAllowedError') {
        schedulePlayOnFirstGesture(arrayBuffer, text, requestId, callbacks);
        return true;
      }
      throw playErr;
    }
  } catch (err: unknown) {
    globalSpeechVisemeTracker.reset();
    globalAudioAnalyser.disconnect();
    if (abortController.signal.aborted || requestId !== currentRequestId) {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      currentAudio = null;
      return true;
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
  if (cleanupUnlockListeners) {
    cleanupUnlockListeners();
  }
  if (currentAbortController) {
    try {
      currentAbortController.abort();
    } catch { /* ignore */ }
    currentAbortController = null;
  }
  if (currentBufferSource) {
    try {
      currentBufferSource.onended = null;
      currentBufferSource.stop();
      currentBufferSource.disconnect();
    } catch { /* ignore */ }
    currentBufferSource = null;
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
