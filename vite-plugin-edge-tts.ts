import type { Plugin } from 'vite';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { IncomingMessage, ServerResponse } from 'http';

function getEdgeVoice(lang: string = 'en-US'): string {
  const l = lang.toLowerCase();
  if (l.startsWith('ru')) return 'ru-RU-SvetlanaNeural';
  if (l.startsWith('es')) return 'es-ES-XimenaNeural';
  if (l.startsWith('de')) return 'de-DE-KatjaNeural';
  if (l.startsWith('fr')) return 'fr-FR-DeniseNeural';
  if (l.startsWith('el') || l.startsWith('gr')) return 'el-GR-AthinaNeural';
  if (l.startsWith('zh')) return 'zh-CN-XiaoxiaoNeural';
  if (l.startsWith('ja')) return 'ja-JP-NanamiNeural';
  if (l.startsWith('ka')) return 'ka-GE-EkaNeural';
  if (l.startsWith('tr')) return 'tr-TR-EmelNeural';
  if (l.startsWith('he')) return 'he-IL-HilaNeural';
  if (l.startsWith('it')) return 'it-IT-ElsaNeural';
  if (l.startsWith('en-gb') || l === 'en-uk') return 'en-GB-SoniaNeural';
  return 'en-US-AvaNeural';
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

async function synthesizeEdgeSpeechWithRetry(text: string, voice: string, maxAttempts = 4): Promise<Buffer> {
  let lastError: unknown = null;
  const escapedText = escapeXml(text);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(escapedText);
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        audioStream.on('data', (c: Buffer) => chunks.push(c));
        audioStream.on('end', () => resolve());
        audioStream.on('error', (err: unknown) => reject(err));
      });
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) {
        throw new Error('Received empty audio stream from Edge TTS');
      }
      return buf;
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Edge-TTS] Attempt ${attempt} failed: ${msg}. Retrying...`);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    } finally {
      try {
        tts.close();
      } catch { /* ignore */ }
    }
  }
  throw lastError || new Error('TTS failed after retries');
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
          const audioBuffer = await synthesizeEdgeSpeechWithRetry(text, voice);

          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(audioBuffer.length),
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          });

          res.end(audioBuffer);
        } catch (err) {
          console.error('[Edge-TTS] Generation error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }));
          }
        }
      });
    },
  };
}
