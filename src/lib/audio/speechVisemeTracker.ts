import {
  VISEME_AH,
  VISEME_CLOSED,
  VISEME_DENTAL,
  VISEME_EE,
  VISEME_IH,
  VISEME_OH,
  VISEME_OO,
  VISEME_SILENCE,
  VISEME_WIDE,
  type Viseme,
} from './types';

interface TimedViseme {
  viseme: Viseme;
  startMs: number;
  endMs: number;
}

/**
 * Universal character-to-viseme mapping covering:
 * English, Spanish, Russian, Georgian, French, German, and common international phonemes.
 */
function charToViseme(char: string): Viseme {
  const c = char.toLowerCase();

  // 1. Bilabials (lips completely touch / close)
  if (['m', 'b', 'p', 'м', 'б', 'п', 'მ', 'ბ', 'პ', 'ფ'].includes(c)) {
    return VISEME_CLOSED;
  }

  // 2. Open back vowels (/a/, /ah/)
  if (['a', 'á', 'à', 'â', 'ä', 'а', 'я', 'ა'].includes(c)) {
    return VISEME_AH;
  }

  // 3. Rounded back vowels (/o/, /oh/)
  if (['o', 'ó', 'ò', 'ô', 'ö', 'о', 'ё', 'ო'].includes(c)) {
    return VISEME_OH;
  }

  // 4. Puckered closed vowels (/u/, /oo/, /w/)
  if (['u', 'ú', 'ù', 'û', 'ü', 'w', 'у', 'ю', 'უ'].includes(c)) {
    return VISEME_OO;
  }

  // 5. Front spread vowels (/e/, /eh/)
  if (['e', 'é', 'è', 'ê', 'ë', 'е', 'э', 'ე'].includes(c)) {
    return VISEME_WIDE;
  }

  // 6. High front vowels (/i/, /ee/)
  if (['i', 'í', 'ì', 'î', 'ï', 'y', 'и', 'ი'].includes(c)) {
    return VISEME_EE;
  }

  // 7. Neutral central vowel (/ih/, /ы/)
  if (['ы'].includes(c)) {
    return VISEME_IH;
  }

  // 8. Dental / Fricative consonants (/f/, /v/, /s/, /z/, etc. — teeth touch / slight smile)
  if ([
    'f', 'v', 's', 'z', 'c', 'x',
    'в', 'ф', 'с', 'з', 'ц', 'ш', 'щ', 'ж',
    'ს', 'ზ', 'ც', 'ძ', 'წ', 'შ', 'ჟ', 'ჩ', 'ჯ', 'ჭ'
  ].includes(c)) {
    return VISEME_DENTAL;
  }

  // 9. Alveolar / Lingual consonants (/t/, /d/, /n/, /l/, /r/, /k/, /g/, etc. — slight wide opening)
  if ([
    't', 'd', 'n', 'l', 'r', 'k', 'g', 'h', 'j', 'q',
    'д', 'т', 'н', 'л', 'р', 'к', 'г', 'х', 'ч',
    'დ', 'თ', 'ნ', 'ლ', 'რ', 'კ', 'გ', 'ხ', 'ყ', 'ღ'
  ].includes(c)) {
    return VISEME_WIDE;
  }

  // Default fallback for other letters
  return VISEME_AH;
}

/**
 * Tracks speech and creates a synchronized timeline of Visemes matching spoken words and syllables.
 * Works seamlessly with both Web Speech API (boundary events) and Audio playback (Edge TTS).
 */
export class SpeechVisemeTracker {
  private queue: TimedViseme[] = [];
  private active = false;
  private speechStartTimestamp = 0;
  private plannedDurationMs = 0;

  /** Resets queue when speech begins or ends */
  reset(): void {
    this.queue = [];
    this.active = false;
    this.speechStartTimestamp = 0;
    this.plannedDurationMs = 0;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.reset();
    }
  }

  /**
   * Builds and schedules a full phonetic timeline for an entire utterance text.
   * Synchronizes syllables to the actual audio duration (in seconds).
   */
  startSpeech(text: string, durationSec?: number): void {
    this.reset();
    if (!text || !text.trim()) return;

    this.active = true;
    const now = performance.now();
    this.speechStartTimestamp = now;

    // Split text into tokens (words and punctuation pauses)
    const tokens = text.match(/[^\s.,!?;:…]+|[.,!?;:…]+/g) || [text];
    
    // First pass: compute nominal durations
    interface TokenStep {
      chars: string;
      isPause: boolean;
      nominalMs: number;
    }

    const steps: TokenStep[] = [];
    let totalNominalMs = 0;

    for (const token of tokens) {
      if (/^[.,!?;:…]+$/.test(token)) {
        // Punctuation pause
        const isSentenceEnd = /[.!?]/.test(token);
        const pauseMs = isSentenceEnd ? 280 : 140;
        steps.push({ chars: '', isPause: true, nominalMs: pauseMs });
        totalNominalMs += pauseMs;
      } else {
        const cleanChars = token.trim();
        if (!cleanChars) continue;

        // ~65ms per character nominally
        const wordMs = Math.max(120, cleanChars.length * 65);
        steps.push({ chars: cleanChars, isPause: false, nominalMs: wordMs });
        totalNominalMs += wordMs;

        // Small inter-word pause
        steps.push({ chars: '', isPause: true, nominalMs: 35 });
        totalNominalMs += 35;
      }
    }

    if (steps.length === 0) return;

    // Determine target duration
    const targetDurationMs = (durationSec && durationSec > 0)
      ? durationSec * 1000
      : Math.max(totalNominalMs, 1000);

    this.plannedDurationMs = targetDurationMs;
    const scale = targetDurationMs / Math.max(1, totalNominalMs);

    // Second pass: schedule visemes with scaled durations
    let currentTime = now;

    for (const step of steps) {
      const stepDuration = step.nominalMs * scale;

      if (step.isPause) {
        this.queue.push({
          viseme: VISEME_SILENCE,
          startMs: currentTime,
          endMs: currentTime + stepDuration,
        });
        currentTime += stepDuration;
      } else {
        // Distribute characters across this word's duration
        const charDuration = stepDuration / Math.max(1, step.chars.length);
        for (let i = 0; i < step.chars.length; i++) {
          const char = step.chars[i];
          const viseme = charToViseme(char);
          const end = currentTime + charDuration;

          this.queue.push({
            viseme,
            startMs: currentTime,
            endMs: end,
          });

          currentTime = end;
        }
      }
    }
  }

  /**
   * Adjusts the timeline when the exact audio duration becomes known after metadata loads.
   */
  adjustDuration(durationSec: number): void {
    if (!this.active || this.queue.length === 0 || !durationSec || durationSec <= 0) return;
    const newTargetMs = durationSec * 1000;
    if (Math.abs(newTargetMs - this.plannedDurationMs) < 150) return; // negligible difference

    const oldTotal = this.queue[this.queue.length - 1].endMs - this.speechStartTimestamp;
    if (oldTotal <= 0) return;

    const scale = newTargetMs / oldTotal;
    for (const item of this.queue) {
      const relStart = (item.startMs - this.speechStartTimestamp) * scale;
      const relEnd = (item.endMs - this.speechStartTimestamp) * scale;
      item.startMs = this.speechStartTimestamp + relStart;
      item.endMs = this.speechStartTimestamp + relEnd;
    }
    this.plannedDurationMs = newTargetMs;
  }

  /**
   * Called by Web Speech API boundary events (fallback path).
   */
  onWordBoundary(sentence: string, charIndex: number, charLength?: number, speechRate = 1.0): void {
    this.active = true;
    const now = performance.now();

    let word = '';
    if (charLength && charLength > 0) {
      word = sentence.substring(charIndex, charIndex + charLength);
    } else {
      const sub = sentence.substring(charIndex);
      const match = sub.match(/^[^\s.,!?;:…]+/);
      word = match ? match[0] : '';
    }

    const cleanWord = word.trim();
    if (!cleanWord) return;

    const charDurationMs = Math.max(40, Math.min(100, 65 / Math.max(0.5, speechRate)));
    const wordDurationMs = Math.max(120, cleanWord.length * charDurationMs);
    const stepDuration = wordDurationMs / Math.max(1, cleanWord.length);

    this.queue = this.queue.filter((item) => item.endMs > now);

    let currentStart = now;
    for (let i = 0; i < cleanWord.length; i++) {
      const char = cleanWord[i];
      const viseme = charToViseme(char);
      const end = currentStart + stepDuration;

      this.queue.push({
        viseme,
        startMs: currentStart,
        endMs: end,
      });

      currentStart = end;
    }

    this.queue.push({
      viseme: VISEME_SILENCE,
      startMs: currentStart,
      endMs: currentStart + 40,
    });
  }

  /**
   * Returns the currently active Viseme based on high-resolution clock.
   * Returns null if no utterance is currently scheduled.
   */
  getCurrentViseme(): Viseme | null {
    if (!this.active || this.queue.length === 0) return null;
    const now = performance.now();

    const activeItem = this.queue.find((item) => now >= item.startMs && now <= item.endMs);
    if (activeItem) {
      return activeItem.viseme;
    }

    if (now < this.queue[this.queue.length - 1].endMs) {
      return VISEME_SILENCE;
    }

    return null;
  }
}

export const globalSpeechVisemeTracker = new SpeechVisemeTracker();
