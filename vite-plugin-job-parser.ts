import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { parseJobHtml } from './src/lib/jobParserCore.ts';

/**
 * Vite plugin that provides a proxy and HTML extractor at `/api/parse-job` during local development.
 */
export function jobParserPlugin(): Plugin {
  return {
    name: 'vite-plugin-job-parser',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/parse-job')) {
          return next();
        }

        const sendJson = (statusCode: number, data: unknown) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end(JSON.stringify(data));
        };

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          let targetUrl = parsedUrl.searchParams.get('url') || '';

          if (req.method === 'POST') {
            const body = await new Promise<string>((resolve) => {
              let acc = '';
              req.on('data', (chunk) => (acc += chunk));
              req.on('end', () => resolve(acc));
            });
            try {
              const json = JSON.parse(body);
              if (json.url) targetUrl = json.url;
            } catch {
              // Ignore invalid JSON body
            }
          }

          targetUrl = targetUrl.trim();
          if (!targetUrl) {
            sendJson(400, { success: false, error: 'A job posting URL is required.' });
            return;
          }

          let urlObj: URL;
          try {
            urlObj = new URL(targetUrl);
          } catch {
            sendJson(400, { success: false, error: 'Invalid URL format.' });
            return;
          }

          if (!['http:', 'https:'].includes(urlObj.protocol)) {
            sendJson(400, { success: false, error: 'Only HTTP and HTTPS URLs are supported.' });
            return;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          try {
            const fetchResponse = await fetch(targetUrl, {
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

            if (!fetchResponse.ok) {
              sendJson(fetchResponse.status, {
                success: false,
                error: `Target server responded with HTTP ${fetchResponse.status}`,
              });
              return;
            }

            const html = await fetchResponse.text();
            const parsed = parseJobHtml(html, targetUrl);

            if (!parsed.description) {
              sendJson(422, {
                success: false,
                error: 'Could not extract vacancy description from this webpage.',
              });
              return;
            }

            sendJson(200, {
              success: true,
              data: parsed,
            });
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[JobParserPlugin] Error:', message);
          sendJson(500, { success: false, error: message || 'Failed to fetch vacancy URL.' });
        }
      });
    },
  };
}
