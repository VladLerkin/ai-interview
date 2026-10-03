import type { Plugin } from 'vite';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { IncomingMessage, ServerResponse } from 'http';

function getEdgeVoice(lang: string = 'en-US'): string {
  const l = lang.toLowerCase();
  if (l.startsWith('ru')) return 'ru-RU-SvetlanaNeural';
  if (l.startsWith('es')) return 'es-ES-ElviraNeural';
  if (l.startsWith('de')) return 'de-DE-KatjaNeural';
  if (l.startsWith('fr')) return 'fr-FR-DeniseNeural';
  if (l.startsWith('zh')) return 'zh-CN-XiaoxiaoNeural';
  if (l.startsWith('ja')) return 'ja-JP-NanamiNeural';
  return 'en-US-JennyNeural';
}

/**
 * Vite plugin that provides a high-quality, free Microsoft Edge TTS audio proxy at `/api/tts`.
 */
export function edgeTtsPlugin(): Plugin {
  return {
    name: 'vite-plugin-edge-tts',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/tts')) {
          return next();
        }

        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          let text = parsedUrl.searchParams.get('text') || '';
          let lang = parsedUrl.searchParams.get('lang') || 'en-US';

          if (req.method === 'POST') {
            const body = await new Promise<string>((resolve) => {
              let acc = '';
              req.on('data', (c) => (acc += c));
              req.on('end', () => resolve(acc));
            });
            try {
              const json = JSON.parse(body);
              if (json.text) text = json.text;
              if (json.lang) lang = json.lang;
            } catch { /* ignore JSON parse error */ }
          }

          if (!text.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Text is required' }));
            return;
          }

          const voice = getEdgeVoice(lang);
          const tts = new MsEdgeTTS();
          await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
          const { audioStream } = tts.toStream(text);

          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          });

          audioStream.pipe(res);
          audioStream.on('error', (err) => {
            console.error('[Edge-TTS] Stream error:', err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end('TTS error');
            }
          });
        } catch (err) {
          console.error('[Edge-TTS] Generation error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Internal server error');
          }
        }
      });
    },
  };
}
