import {
  VISEME_AH,
  VISEME_CLOSED,
  VISEME_DENTAL,
  VISEME_EE,
  VISEME_IH,
  VISEME_SILENCE,
  VISEME_WIDE,
  type Viseme,
} from '../../lib/audio';

// Softer rounded vowels than the phonetic tracker's: random syllables have no real
// phonetics behind them, so strong pucker shapes would look odd.
const SOFT_VISEME_OH: Viseme = { aa: 0.15, ee: 0, ih: 0, oh: 0.4, ou: 0.1 }; // "go"
const SOFT_VISEME_OO: Viseme = { aa: 0, ee: 0, ih: 0, oh: 0.08, ou: 0.45 }; // "blue"

// Weighted syllable table: [viseme, probability, minHoldMs, maxHoldMs]
const SYLLABLE_TABLE: [Viseme, number, number, number][] = [
  [VISEME_SILENCE, 0.10, 100, 280], // brief pause
  [VISEME_CLOSED, 0.12, 40, 100],   // closed consonant
  [VISEME_DENTAL, 0.10, 40, 90],    // dental/fricative
  [VISEME_AH, 0.15, 70, 180],       // open "ah"
  [VISEME_WIDE, 0.10, 60, 150],     // wide "a"
  [VISEME_EE, 0.12, 60, 160],       // "ee"
  [VISEME_IH, 0.10, 50, 130],       // "ih"
  [SOFT_VISEME_OH, 0.11, 70, 170],  // "oh"
  [SOFT_VISEME_OO, 0.10, 60, 140],  // "oo"
];

/**
 * Picks a weighted random syllable. Used as a fallback mouth movement when
 * there is no phonetic timeline for the current speech.
 */
export function pickSyllable(): { viseme: Viseme; holdMs: number } {
  let r = Math.random();
  for (const [viseme, prob, minMs, maxMs] of SYLLABLE_TABLE) {
    r -= prob;
    if (r <= 0) {
      return { viseme, holdMs: minMs + Math.random() * (maxMs - minMs) };
    }
  }
  return { viseme: VISEME_AH, holdMs: 100 };
}

export const scaleViseme = (v: Viseme, k: number): Viseme => ({
  aa: v.aa * k,
  ee: v.ee * k,
  ih: v.ih * k,
  oh: v.oh * k,
  ou: v.ou * k,
});
