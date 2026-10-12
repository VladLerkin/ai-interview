import { type ParsedJob, formatJobText } from './jobParserCore';

export type { ParsedJob };
export { formatJobText };

export interface ParseJobResponse {
  success: boolean;
  data?: ParsedJob;
  error?: string;
}

/**
 * Fetches and parses a job vacancy description from a URL via the backend parser endpoint.
 */
export async function fetchJobFromUrl(url: string): Promise<ParsedJob> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new Error('URL is required');
  }

  // Basic validation
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error('Please enter a valid URL starting with http:// or https://');
  }

  const response = await fetch('/api/parse-job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: trimmedUrl }),
  });

  const result: ParseJobResponse = await response.json().catch(() => ({
    success: false,
    error: `HTTP ${response.status}: Failed to parse response`,
  }));

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error || 'Failed to extract vacancy from the provided URL');
  }

  return result.data;
}
