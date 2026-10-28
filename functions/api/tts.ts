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
  if (l.startsWith('el') || l.startsWith('gr')) return { voice: 'el-GR-AthinaNeural', locale: 'el-GR' };
  if (l.startsWith('zh')) return { voice: 'zh-CN-XiaoxiaoNeural', locale: 'zh-CN' };
  if (l.startsWith('ja')) return { voice: 'ja-JP-NanamiNeural', locale: 'ja-JP' };
  if (l.startsWith('ka')) return { voice: 'ka-GE-EkaNeural', locale: 'ka-GE' };
  if (l.startsWith('tr')) return { voice: 'tr-TR-EmelNeural', locale: 'tr-TR' };
  if (l.startsWith('he')) return { voice: 'he-IL-HilaNeural', locale: 'he-IL' };
  if (l.startsWith('it')) return { voice: 'it-IT-ElsaNeural', locale: 'it-IT' };
  if (l.startsWith('en-gb') || l === 'en-uk') return { voice: 'en-GB-SoniaNeural', locale: 'en-GB' };
  return { voice: 'en-US-AvaNeural', locale: 'en-US' };
}

const EDGE_COPYRIGHT = 'Copyright (C) Microsoft Corporation. All rights reserved.';
const SWAP_FIRST_WORD = { swappedWord: 0xEF0569FB, swappedSum: 0x76F50F34, swappedProduct: 0xC3EFEA97 };
const SWAP_SECOND_WORD = { swappedWord: 0xC31713DB, swappedSum: 0x1881CE3C, swappedProduct: 0x35BD1EC9 };
const MIX_FIRST_WORD = [0xCF98B111, 0x87085B9F, 0x12CEB96D, 0x257E1D83];
const MIX_SECOND_WORD = [0xA27416F5, 0xD38396FF, 0x7C932B89, 0xBFA49F69];

let clockOffsetMs = 0;

function swapHalves(value: number): number {
  return ((value << 16) | (value >>> 16)) >>> 0;
}

function swapTerm(
  word: number,
  key: number,
  multipliers: { swappedWord: number; swappedSum: number; swappedProduct: number },
): number {
  const sum = Math.imul(word, key) + Math.imul(swapHalves(word), multipliers.swappedWord);
  const product = Math.imul(swapHalves(sum), multipliers.swappedSum) >>> 0;
  return (Math.imul(swapHalves(product), multipliers.swappedProduct) + product) >>> 0;
}

function swapAndMultiply(value: number, multipliers: number[]): number {
  for (const multiplier of multipliers) {
    value = Math.imul(swapHalves(value), multiplier) >>> 0;
  }
  return value;
}

function cs64(message: Uint8Array, digest: Uint8Array): Uint8Array {
  const digestView = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const firstKey = (digestView.getUint32(0, true) | 1) >>> 0;
  const secondKey = (digestView.getUint32(4, true) | 1) >>> 0;
  const padded = new Uint8Array(Math.ceil(message.length / 8) * 8);
  padded.set(message);
  const words = new DataView(padded.buffer);
  let swapSum = 0;
  let lastSwap = 0;
  let mix = 0;
  let mixSum = 0;
  for (let offset = 0; offset < padded.length; offset += 8) {
    const firstWord = words.getUint32(offset, true);
    const secondWord = words.getUint32(offset + 4, true);
    const firstSwap = swapTerm(firstWord, firstKey, SWAP_FIRST_WORD);
    lastSwap = swapTerm(secondWord, secondKey, SWAP_SECOND_WORD);
    swapSum = (swapSum + firstSwap + lastSwap) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + firstWord, firstKey), MIX_FIRST_WORD);
    mixSum = (mixSum + mix) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + secondWord, secondKey), MIX_SECOND_WORD);
    mixSum = (mixSum + mix) >>> 0;
  }
  const checksum = new Uint8Array(8);
  const checksumView = new DataView(checksum.buffer);
  checksumView.setUint32(0, lastSwap ^ mix, true);
  checksumView.setUint32(4, swapSum ^ mixSum, true);
  return checksum;
}

function toUpperHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function generateSecMsGec(): Promise<string> {
  const ticks = Math.floor((Date.now() + clockOffsetMs) / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10000000;
  const message = new TextEncoder().encode(`${EDGE_COPYRIGHT}${windowsTicks}${TRUSTED_CLIENT_TOKEN}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', message));
  return `${toUpperHex(cs64(message, digest))}-${toUpperHex(digest)}`;
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
  const connectionId = crypto.randomUUID();
  const secMsGec = await generateSecMsGec();
  const synthUrl = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=2-143.0.3650.96&ConnectionId=${connectionId}`;

  const resp = await fetch(synthUrl, {
    headers: {
      Upgrade: 'websocket',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    },
  });

  const ws = (resp as any).webSocket;
  if (!ws) {
    const serverDate = resp.headers?.get?.('date');
    if (resp.status === 403 && serverDate) {
      const serverTime = Date.parse(serverDate);
      if (Number.isFinite(serverTime)) {
        clockOffsetMs = serverTime - Date.now();
      }
    }
    throw new Error(`Failed to upgrade to Edge TTS WebSocket (status: ${resp.status})`);
  }
  ws.accept();

  return new Promise<Uint8Array>((resolve, reject) => {
    const audioChunks: Uint8Array[] = [];
    let turnEnded = false;
    const timeout = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('Edge TTS request timed out'));
    }, 20000);

    const cleanup = () => {
      clearTimeout(timeout);
      try { ws.close(); } catch { /* ignore */ }
    };

    const mergeChunks = (): Uint8Array => {
      const totalLen = audioChunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of audioChunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      return merged;
    };

    ws.addEventListener('error', (err: any) => {
      cleanup();
      reject(new Error(`Edge TTS WebSocket error: ${err.message || 'unknown'}`));
    });

    ws.addEventListener('close', () => {
      cleanup();
      if (!turnEnded || audioChunks.length === 0) {
        reject(new Error('WebSocket closed before synthesis completed'));
      } else {
        resolve(mergeChunks());
      }
    });

    ws.addEventListener('message', (event: any) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          turnEnded = true;
          cleanup();
          if (audioChunks.length === 0) {
            reject(new Error('Received turn.end with no audio data'));
          } else {
            resolve(mergeChunks());
          }
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

async function synthesizeEdgeSpeechWithRetry(text: string, lang: string, maxAttempts = 4): Promise<Uint8Array> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await synthesizeEdgeSpeech(text, lang);
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Cloudflare TTS] Attempt ${attempt} failed: ${msg}. Retrying...`);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
  throw lastError || new Error('Edge TTS failed after retries');
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

    const audioBytes = await synthesizeEdgeSpeechWithRetry(text, lang);

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
