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

    // Calculate energy across key speech frequency bands (assuming ~48kHz sample rate, ~94 Hz/bin):
    // Sub-voice / F0 (100–350 Hz): bins 1–4
    const f0Energy = getRangeEnergy(1, 4);

    // Formant 1 (F1: 350–850 Hz): bins 4–9 (vowel jaw height: high for /a/, low for /i/, /u/)
    const f1Energy = getRangeEnergy(4, 9);

    // Formant 2 (F2: 900–2400 Hz): bins 10–25 (front vs back tongue: high for /e/, /i/, low for /o/, /u/)
    const f2Energy = getRangeEnergy(10, 25);

    // High frequencies (Fricatives: 2500–6000 Hz): bins 26–64 (s, z, sh, f, dental consonants)
    const highEnergy = getRangeEnergy(26, 64);

    // Total speech energy
    const totalVoiceEnergy = (f0Energy * 0.3) + (f1Energy * 0.4) + (f2Energy * 0.2) + (highEnergy * 0.1);

    // Noise gate threshold: ignore background hum or silence
    if (totalVoiceEnergy < 0.04) {
      return { ...VISEME_SILENCE };
    }

    // Dynamic scale based on loudness
    const scale = Math.min(1.0, (totalVoiceEnergy - 0.04) * 2.2);

    // Open vowel /aa/: characterized by high energy in both F0 and F1
    const aaWeight = Math.min(1.0, (f1Energy * 1.6 + f0Energy * 0.5) * scale);

    // Front high vowels /ee/, /ih/: high F2 relative to F1
    const eeRatio = f2Energy / (f1Energy + 0.001);
    const eeWeight = eeRatio > 1.1 ? Math.min(0.8, (f2Energy * 1.4) * scale) : 0;
    const ihWeight = eeRatio > 0.9 ? Math.min(0.6, (f2Energy * 0.8) * scale) : 0;

    // Rounded back vowels /oh/, /ou/: high F1 with low F2
    const roundness = Math.max(0, f1Energy - f2Energy * 0.7);
    const ohWeight = Math.min(0.7, roundness * 1.5 * scale);
    const ouWeight = Math.min(0.6, (f0Energy * 0.8 + roundness * 0.6) * scale);

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
