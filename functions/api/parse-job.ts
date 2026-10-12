import { parseJobHtml, type ParsedJob } from '../../src/lib/jobParserCore';

interface PagesContext {
  request: Request;
  env: Record<string, unknown>;
  params: Record<string, string | string[]>;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function fetchPageHtml(targetUrl: string): Promise<string> {
  const urlObj = new URL(targetUrl);
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  // Disallow localhost and private IP addresses
  const host = urlObj.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.16.') ||
    host.endsWith('.local')
  ) {
    throw new Error('Access to local network resources is forbidden.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      throw new Error(`Target server responded with HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json')) {
      throw new Error('Target page does not appear to be an HTML page.');
    }

    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const { request } = context;
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const url = (body.url || '').trim();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'A job posting URL is required.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        },
      );
    }

    const html = await fetchPageHtml(url);
    const parsed: ParsedJob = parseJobHtml(html);

    if (!parsed.description) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Could not extract vacancy description from this webpage. The content might be loaded dynamically or protected.',
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: parsed,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          ...CORS_HEADERS,
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        success: false,
        error: message || 'Failed to fetch job description.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('url') || '';

  return onRequestPost({
    ...context,
    request: new Request(context.request.url, {
      method: 'POST',
      body: JSON.stringify({ url: targetUrl }),
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}
