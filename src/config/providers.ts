import type { Provider } from '../types/interview';

export interface ProviderOption {
  id: Provider;
  label: string;
  model: string;
  /** Custom OpenAI-compatible endpoint, if any. */
  baseURL?: string;
}

export const PROVIDERS: ProviderOption[] = [
  { id: 'gemini', label: 'Google Gemini (Gemini 3.8 Flash)', model: 'gemini-3.8-flash' },
  { id: 'openai', label: 'OpenAI (GPT-4o-Mini)', model: 'gpt-4o-mini' },
  { id: 'anthropic', label: 'Anthropic (Claude 3 Haiku)', model: 'claude-3-haiku-20240307' },
  { id: 'deepseek', label: 'DeepSeek (DeepSeek Chat)', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
];

export const DEFAULT_PROVIDER: Provider = 'gemini';

export const getProvider = (id: Provider): ProviderOption =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
