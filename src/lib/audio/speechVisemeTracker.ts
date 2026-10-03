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
 * Maps letters / phonetic groups in Russian and English to Visemes.
 */
function charToViseme(char: string): Viseme {
  const c = char.toLowerCase();

  // Russian vowels
  if (['а', 'я'].includes(c)) return VISEME_AH;
  if (['о', 'ё'].includes(c)) return VISEME_OH;
  if (['у', 'ю'].includes(c)) return VISEME_OO;
  if (['е', 'э'].includes(c)) return VISEME_WIDE;
  if (['и'].includes(c)) return VISEME_EE;
  if (['ы'].includes(c)) return VISEME_IH;

  // Russian consonants
  if (['м', 'б', 'п'].includes(c)) return VISEME_CLOSED;
  if (['в', 'ф', 'с', 'з', 'ц', 'ш', 'щ', 'ж'].includes(c)) return VISEME_DENTAL;
  if (['д', 'т', 'н', 'л', 'р', 'к', 'г', 'х', 'ч'].includes(c)) return VISEME_WIDE;

  // English vowels
  if (['a'].includes(c)) return VISEME_AH;
  if (['o'].includes(c)) return VISEME_OH;
  if (['u', 'w'].includes(c)) return VISEME_OO;
  if (['e'].includes(c)) return VISEME_WIDE;
  if (['i', 'y'].includes(c)) return VISEME_EE;

  // English consonants
  if (['m', 'b', 'p'].includes(c)) return VISEME_CLOSED;
  if (['f', 'v', 's', 'z', 'c'].includes(c)) return VISEME_DENTAL;

  return VISEME_AH;
}

/**
 * Tracks SpeechSynthesis boundary events and produces a real-time viseme sequence
 * matching the exact words and syllables being spoken.
 */
export class SpeechVisemeTracker {
  private queue: TimedViseme[] = [];
  private active = false;

  /** Resets queue when speech begins or ends */
  reset(): void {
    this.queue = [];
    this.active = false;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.queue = [];
    }
  }

  /**
   * Called when a SpeechSynthesisUtterance boundary event fires.
   * Extracts the word and breaks it into timed viseme steps.
   */
  onWordBoundary(sentence: string, charIndex: number, charLength?: number, speechRate = 1.0): void {
    this.active = true;
    const now = performance.now();

    // Extract word
    let word = '';
    if (charLength && charLength > 0) {
      word = sentence.substring(charIndex, charIndex + charLength);
    } else {
      // Fallback: extract until next whitespace or punctuation
      const sub = sentence.substring(charIndex);
      const match = sub.match(/^[^\s.,!?;:…]+/);
      word = match ? match[0] : '';
    }

    const cleanWord = word.trim().replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
    if (!cleanWord) return;

    // Estimate word duration: average ~60–80ms per character at rate 1.0
    const charDurationMs = Math.max(35, Math.min(110, (70 / Math.max(0.5, speechRate))));
    const wordDurationMs = Math.max(120, cleanWord.length * charDurationMs);

    // Group characters into syllables / key phonetic transitions
    const stepDuration = wordDurationMs / Math.max(1, cleanWord.length);

    // Clear old expired items from the queue
    this.queue = this.queue.filter((item) => item.endMs > now);

    // Schedule visemes for each character/sound in the word
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

    // Add a brief inter-word transition
    this.queue.push({
      viseme: VISEME_SILENCE,
      startMs: currentStart,
      endMs: currentStart + 40,
    });
  }

  /**
   * Returns the currently active Viseme based on the real-time clock.
   * Returns null if no word is currently active or queue is empty.
   */
  getCurrentViseme(): Viseme | null {
    if (!this.active) return null;
    const now = performance.now();

    const activeItem = this.queue.find((item) => now >= item.startMs && now <= item.endMs);
    if (activeItem) {
      return activeItem.viseme;
    }

    // If we are active but in a pause between words
    if (this.queue.length > 0 && now < this.queue[this.queue.length - 1].endMs) {
      return VISEME_SILENCE;
    }

    return null;
  }
}

export const globalSpeechVisemeTracker = new SpeechVisemeTracker();
