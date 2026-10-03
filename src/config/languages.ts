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
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'zh-CN', label: 'Chinese (中文)' },
  { code: 'ja-JP', label: 'Japanese (日本語)' },
  { code: 'ka-GE', label: 'Georgian (ქართული)' },
];

export const DEFAULT_LANGUAGE: Language = 'en-GB';

export const getLanguageLabel = (code: Language | undefined): string =>
  LANGUAGES.find((l) => l.code === code)?.label ?? LANGUAGES[0].label;
