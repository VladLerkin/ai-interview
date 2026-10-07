const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

interface PagesContext {
  request: Request;
  env: Record<string, unknown>;
  params: Record<string, string | string[]>;
}

function getEdgeVoice(lang = 'en-US'): { voice: string; locale: string } {
  const l = (lang || '').toLowerCase();
  if (l.startsWith('ru')) return { voice: 'ru-RU-SvetlanaNeural', locale: 'ru-RU' };
  if (l.startsWith('es')) return { voice: 'es-ES-XimenaNeural', locale: 'es-ES' };
  if (l.startsWith('de')) return { voice: 'de-DE-KatjaNeural', locale: 'de-DE' };
  if (l.startsWith('fr')) return { voice: 'fr-FR-DeniseNeural', locale: 'fr-FR' };
  if (l.startsWith('zh')) return { voice: 'zh-CN-XiaoxiaoNeural', locale: 'zh-CN' };
  if (l.startsWith('ja')) return { voice: 'ja-JP-NanamiNeural', locale: 'ja-JP' };
  if (l.startsWith('ka')) return { voice: 'ka-GE-EkaNeural', locale: 'ka-GE' };
  if (l.startsWith('tr')) return { voice: 'tr-TR-EmelNeural', locale: 'tr-TR' };
  if (l.startsWith('it')) return { voice: 'it-IT-ElsaNeural', locale: 'it-IT' };
  if (l.startsWith('en-gb') || l === 'en-uk') return { voice: 'en-GB-SoniaNeural', locale: 'en-GB' };
  return { voice: 'en-US-AvaNeural', locale: 'en-US' };
}

async function generateSecMsGec(): Promise<string> {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10000000;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${windowsTicks}${TRUSTED_CLIENT_TOKEN}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
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

async function synthesizeEdgeSpeech(text: string, lang: string): Promise<Uint8Array> {
  const { voice, locale } = getEdgeVoice(lang);
  const connectionId = crypto.randomUUID().replace(/-/g, '');
  const secMsGec = await generateSecMsGec();
  const synthUrl = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-143.0.3650.96&ConnectionId=${connectionId}`;

  const resp = await fetch(synthUrl, {
    headers: {
      Upgrade: 'websocket',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    },
  });

  const ws = (resp as any).webSocket;
  if (!ws) {
    throw new Error(`Failed to upgrade to Edge TTS WebSocket (status: ${resp.status})`);
  }
  ws.accept();

  return new Promise<Uint8Array>((resolve, reject) => {
    const audioChunks: Uint8Array[] = [];
    const timeout = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('Edge TTS request timed out'));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeout);
      try { ws.close(); } catch { /* ignore */ }
    };

    ws.addEventListener('error', (err: any) => {
      cleanup();
      reject(new Error(`Edge TTS WebSocket error: ${err.message || 'unknown'}`));
    });

    ws.addEventListener('close', () => {
      cleanup();
      if (audioChunks.length === 0) {
        reject(new Error('WebSocket closed before receiving audio'));
      } else {
        const totalLen = audioChunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of audioChunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        resolve(merged);
      }
    });

    ws.addEventListener('message', (event: any) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          cleanup();
          const totalLen = audioChunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of audioChunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          resolve(merged);
        }
      } else if (event.data instanceof ArrayBuffer) {
        const buf = new Uint8Array(event.data);
        if (buf.length >= 2) {
          const headerLen = (buf[0] << 8) | buf[1];
          if (buf.length > 2 + headerLen) {
            const audioData = buf.subarray(2 + headerLen);
            audioChunks.push(audioData);
          }
        }
      }
    });

    // Send speech.config
    const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
    ws.send(configMsg);

    // Send ssml
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">
  <voice name="${voice}">
    <prosody pitch="+0Hz" rate="+0%" volume="+0%">
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;
    const requestId = crypto.randomUUID().replace(/-/g, '');
    const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
    ws.send(ssmlMsg);
  });
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

    const audioBytes = await synthesizeEdgeSpeech(text, lang);

    return new Response(audioBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
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
