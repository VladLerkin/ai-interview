import { VISEME_SILENCE, type Viseme } from './types';

/**
 * Web Audio API Analyser for real-time FFT spectrum & formant analysis.
 * Analyzes audio signals into lip-sync visemes with zero latency.
 */
export class AudioAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: AudioNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private isConnected = false;

  constructor(existingContext?: AudioContext) {
    if (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = existingContext ?? new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.65;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  /** Connects an HTMLAudioElement to the Web Audio pipeline */
  connectAudioElement(element: HTMLAudioElement): void {
    if (!this.ctx || !this.analyser) return;
    this.resume();

    try {
      this.sourceNode?.disconnect();
      const node = this.ctx.createMediaElementSource(element);
      node.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.sourceNode = node;
      this.isConnected = true;
    } catch (e) {
      console.warn('AudioAnalyser connectAudioElement warning:', e);
    }
  }

  /** Disconnects the current audio source */
  disconnect(): void {
    try {
      this.sourceNode?.disconnect();
    } catch { /* ignore */ }
    this.sourceNode = null;
    this.isConnected = false;
  }

  /** Ensures AudioContext is active (handles browser autoplay policies) */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch { /* ignore */ }
    }
  }

  /** Returns true if an active audio source is feeding into the analyser */
  get active(): boolean {
    return this.isConnected;
  }

  /**
   * Returns normalized audio speech energy (0.0 to 1.0) with noise gate.
   * Useful for modulating mouth openness in sync with voice volume envelope.
   */
  getAudioEnergy(): number {
    if (!this.analyser || !this.freqData || !this.isConnected) {
      return 0;
    }
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    const count = Math.min(this.freqData.length, 64);
    for (let i = 1; i < count; i++) {
      sum += this.freqData[i];
    }
    const avg = sum / ((count - 1) * 255);
    if (avg < 0.025) return 0;
    return Math.min(1.0, (avg - 0.025) * 2.6);
  }

  /**
   * Computes current Viseme weights from FFT frequency bins.
   * Uses formant ratios (F1, F2) and frequency bands for real-time speech articulation.
   */
  getViseme(): Viseme | null {
    if (!this.analyser || !this.freqData || !this.isConnected) {
      return null;
    }

    this.analyser.getByteFrequencyData(this.freqData);
    const data = this.freqData;
    const len = data.length; // 256 bins for fftSize 512

    // Helper: average magnitude across a bin range (0-255 normalized to 0-1)
    const getRangeEnergy = (startBin: number, endBin: number): number => {
      const start = Math.max(0, Math.min(len - 1, startBin));
      const end = Math.max(start, Math.min(len - 1, endBin));
      let sum = 0;
      for (let i = start; i <= end; i++) {
        sum += data[i];
      }
      return sum / ((end - start + 1) * 255);
    };

    // Sub-voice / F0 (100–350 Hz): bins 1–4
    const f0Energy = getRangeEnergy(1, 4);

    // Formant 1 (F1: 350–850 Hz): bins 4–9
    const f1Energy = getRangeEnergy(4, 9);

    // Formant 2 (F2: 900–2400 Hz): bins 10–25
    const f2Energy = getRangeEnergy(10, 25);

    // High frequencies (Fricatives: 2500–6000 Hz): bins 26–64
    const highEnergy = getRangeEnergy(26, 64);

    // Total speech energy
    const totalVoiceEnergy = (f0Energy * 0.3) + (f1Energy * 0.4) + (f2Energy * 0.2) + (highEnergy * 0.1);

    // Noise gate threshold: ignore background hum or silence
    if (totalVoiceEnergy < 0.04) {
      return { ...VISEME_SILENCE };
    }

    // Dynamic scale based on loudness
    const scale = Math.min(1.0, (totalVoiceEnergy - 0.04) * 2.2);

    // Open vowel /aa/: balanced jaw height
    const aaWeight = Math.min(0.65, (f1Energy * 1.1 + f0Energy * 0.3) * scale);

    // Front high vowels /ee/, /ih/
    const eeRatio = f2Energy / (f1Energy + 0.001);
    const eeWeight = eeRatio > 0.8 ? Math.min(0.6, (f2Energy * 1.1) * scale) : 0;
    const ihWeight = eeRatio > 0.7 ? Math.min(0.4, (f2Energy * 0.7) * scale) : 0;

    // Rounded back vowels /oh/, /ou/
    const roundness = Math.max(0, f1Energy - f2Energy * 0.7);
    const ohWeight = Math.min(0.55, roundness * 1.2 * scale);
    const ouWeight = Math.min(0.45, (f0Energy * 0.6 + roundness * 0.5) * scale);

    return {
      aa: Math.max(0, Math.min(1, aaWeight)),
      ee: Math.max(0, Math.min(1, eeWeight)),
      ih: Math.max(0, Math.min(1, ihWeight)),
      oh: Math.max(0, Math.min(1, ohWeight)),
      ou: Math.max(0, Math.min(1, ouWeight)),
    };
  }

  dispose(): void {
    this.disconnect();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch { /* ignore */ }
    }
    this.ctx = null;
    this.analyser = null;
    this.freqData = null;
  }
}

// Global audio analyser instance for shared playback tracking
export const globalAudioAnalyser = new AudioAnalyser();
