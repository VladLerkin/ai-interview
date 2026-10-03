import type { Language } from '../types/interview';

export interface LanguageOption {
  code: Language;
  /** Human-readable name, shown in the UI and passed to the LLM as the target language. */
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en-US', label: 'English (American)' },
  { code: 'en-GB', label: 'English (British)' },
  { code: 'ru-RU', label: 'Russian (Русский)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
];

export const DEFAULT_LANGUAGE: Language = 'en-GB';

export const getLanguageLabel = (code: Language | undefined): string =>
  LANGUAGES.find((l) => l.code === code)?.label ?? LANGUAGES[0].label;
