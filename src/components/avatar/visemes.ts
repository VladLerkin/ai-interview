// ── Viseme definitions ──────────────────────────────────────────────
// Each viseme blends multiple VRM mouth shapes for realistic lip sync.
// Values are weights (0–1) for each expression preset.
export interface Viseme {
  aa: number;
  ee: number;
  ih: number;
  oh: number;
  ou: number;
}

export const VISEME_SILENCE: Viseme = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
const VISEME_AH: Viseme = { aa: 0.7, ee: 0, ih: 0, oh: 0.1, ou: 0 }; // "father"
const VISEME_EE: Viseme = { aa: 0, ee: 0.6, ih: 0.3, oh: 0, ou: 0 }; // "see"
const VISEME_IH: Viseme = { aa: 0.1, ee: 0.2, ih: 0.5, oh: 0, ou: 0 }; // "sit"
const VISEME_OH: Viseme = { aa: 0.15, ee: 0, ih: 0, oh: 0.4, ou: 0.1 }; // "go"
const VISEME_OO: Viseme = { aa: 0, ee: 0, ih: 0, oh: 0.08, ou: 0.45 }; // "blue"
const VISEME_CLOSED: Viseme = { aa: 0.03, ee: 0, ih: 0, oh: 0, ou: 0.03 }; // "m", "b", "p"
const VISEME_DENTAL: Viseme = { aa: 0.08, ee: 0.12, ih: 0.08, oh: 0, ou: 0 }; // "s", "f", "th"
const VISEME_WIDE: Viseme = { aa: 0.3, ee: 0.15, ih: 0.1, oh: 0, ou: 0 }; // "a" as in "cat"

// Weighted syllable table: [viseme, probability, minHoldMs, maxHoldMs]
const SYLLABLE_TABLE: [Viseme, number, number, number][] = [
  [VISEME_SILENCE, 0.10, 100, 280],   // brief pause
  [VISEME_CLOSED, 0.12, 40, 100],   // closed consonant
  [VISEME_DENTAL, 0.10, 40, 90],   // dental/fricative
  [VISEME_AH, 0.15, 70, 180],   // open "ah"
  [VISEME_WIDE, 0.10, 60, 150],   // wide "a"
  [VISEME_EE, 0.12, 60, 160],   // "ee"
  [VISEME_IH, 0.10, 50, 130],   // "ih"
  [VISEME_OH, 0.11, 70, 170],   // "oh"
  [VISEME_OO, 0.10, 60, 140],   // "oo"
];

// ── Helper: pick weighted random syllable ───────────────────────────
export function pickSyllable(): { viseme: Viseme; holdMs: number } {
  let r = Math.random();
  for (const [viseme, prob, minMs, maxMs] of SYLLABLE_TABLE) {
    r -= prob;
    if (r <= 0) {
      return { viseme, holdMs: minMs + Math.random() * (maxMs - minMs) };
    }
  }
  // Fallback
  return { viseme: VISEME_AH, holdMs: 100 };
}
