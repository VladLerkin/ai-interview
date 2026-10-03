import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

interface Env {}

interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

function getEdgeVoice(lang = 'en-US'): string {
  const l = (lang || '').toLowerCase();
  if (l.startsWith('ru')) return 'ru-RU-SvetlanaNeural';
  if (l.startsWith('es')) return 'es-ES-ElviraNeural';
  if (l.startsWith('de')) return 'de-DE-KatjaNeural';
  if (l.startsWith('fr')) return 'fr-FR-DeniseNeural';
  if (l.startsWith('zh')) return 'zh-CN-XiaoxiaoNeural';
  if (l.startsWith('ja')) return 'ja-JP-NanamiNeural';
  return 'en-US-JennyNeural';
}

/**
 * Cloudflare Pages Function: /api/tts
 * Synthesizes Microsoft Edge Neural TTS audio and streams it to the client.
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const { request } = context;
    const body = (await request.json().catch(() => ({}))) as { text?: string; lang?: string };
    const text = (body.text || '').trim();
    const lang = body.lang || 'en-US';

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const voice = getEdgeVoice(lang);
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);

    // Buffer stream chunks into a single ArrayBuffer for Response
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer | Uint8Array) => chunks.push(new Uint8Array(chunk)));
      audioStream.on('end', () => resolve());
      audioStream.on('error', (err: unknown) => reject(err));
    });

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    return new Response(merged.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Cloudflare Pages TTS] Error:', message);
    return new Response(JSON.stringify({ error: message || 'TTS failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const text = url.searchParams.get('text') || '';
  const lang = url.searchParams.get('lang') || 'en-US';

  return onRequestPost({
    ...context,
    request: new Request(context.request.url, {
      method: 'POST',
      body: JSON.stringify({ text, lang }),
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
