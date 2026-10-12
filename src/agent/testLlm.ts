import { HumanMessage } from '@langchain/core/messages';
import { getProvider } from '../config/providers';
import type { Provider } from '../types/interview';
import { createChatModel } from './llm';

const TEST_TIMEOUT_MS = 20_000;

export interface LlmTestResult {
  ok: boolean;
  model: string;
  /** Model reply on success, or the error text on failure. */
  message: string;
  latencyMs: number;
}

/** Sends a tiny prompt to the selected provider to verify the model name, API key and connectivity. */
export const testLlmConnection = async (provider: Provider, apiKey: string): Promise<LlmTestResult> => {
  const { model } = getProvider(provider);
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const llm = createChatModel(provider, apiKey, 0);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${TEST_TIMEOUT_MS / 1000}s`)), TEST_TIMEOUT_MS);
    });
    const response = await Promise.race([llm.invoke([new HumanMessage('Reply with the single word: OK')]), timeout]);
    const text = response.text?.trim();
    if (!text) {
      return { ok: false, model, message: 'Empty response from the model.', latencyMs: elapsed() };
    }
    return { ok: true, model, message: text.slice(0, 80), latencyMs: elapsed() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, model, message: message.slice(0, 400), latencyMs: elapsed() };
  } finally {
    clearTimeout(timer);
  }
};
