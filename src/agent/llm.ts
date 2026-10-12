import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { getProvider } from '../config/providers';
import type { Provider } from '../types/interview';

/**
 * Creates a chat model for the selected provider.
 * All calls are made directly from the browser with the user's own API key.
 */
export const createChatModel = (provider: Provider, apiKey: string, temperature: number): BaseChatModel => {
  const { model, baseURL } = getProvider(provider);
  // Fail fast instead of silently retrying for minutes (UI would stay on "Preparing interview...").
  const maxRetries = 1;

  switch (provider) {
    case 'openai':
    case 'deepseek':
      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        maxRetries,
        configuration: { baseURL, dangerouslyAllowBrowser: true },
      });
    case 'anthropic':
      return new ChatAnthropic({
        apiKey,
        model,
        temperature,
        maxRetries,
        clientOptions: { dangerouslyAllowBrowser: true },
      });
    case 'gemini':
      return new ChatGoogleGenerativeAI({ apiKey, model, temperature, maxRetries });
  }
};
