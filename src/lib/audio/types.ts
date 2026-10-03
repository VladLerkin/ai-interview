// ── Viseme definitions and audio types ──────────────────────────────
export interface Viseme {
  aa: number;
  ee: number;
  ih: number;
  oh: number;
  ou: number;
}

export const VISEME_SILENCE: Viseme = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
export const VISEME_AH: Viseme = { aa: 0.7, ee: 0, ih: 0, oh: 0.1, ou: 0 }; // "father", "а"
export const VISEME_EE: Viseme = { aa: 0, ee: 0.6, ih: 0.3, oh: 0, ou: 0 }; // "see", "и"
export const VISEME_IH: Viseme = { aa: 0.1, ee: 0.2, ih: 0.5, oh: 0, ou: 0 }; // "sit", "ы"
export const VISEME_OH: Viseme = { aa: 0.22, ee: 0, ih: 0, oh: 0.75, ou: 0.2 }; // "go", "о"
export const VISEME_OO: Viseme = { aa: 0.06, ee: 0, ih: 0, oh: 0.2, ou: 0.8 }; // "blue", "у"
export const VISEME_CLOSED: Viseme = { aa: 0.03, ee: 0, ih: 0, oh: 0, ou: 0.03 }; // "m", "b", "p", "м", "б", "п"
export const VISEME_DENTAL: Viseme = { aa: 0.08, ee: 0.12, ih: 0.08, oh: 0, ou: 0 }; // "s", "f", "th", "с", "з", "ф"
export const VISEME_WIDE: Viseme = { aa: 0.3, ee: 0.15, ih: 0.1, oh: 0, ou: 0 }; // "cat", "э", "е"
