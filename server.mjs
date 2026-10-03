import http from 'http';
import { URL } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const PORT = process.env.PORT || 3001;

function getEdgeVoice(lang = 'en-US') {
  const l = (lang || '').toLowerCase();
  if (l.startsWith('ru')) return 'ru-RU-SvetlanaNeural';
  if (l.startsWith('es')) return 'es-ES-XimenaNeural';
  if (l.startsWith('de')) return 'de-DE-KatjaNeural';
  if (l.startsWith('fr')) return 'fr-FR-DeniseNeural';
  if (l.startsWith('zh')) return 'zh-CN-XiaoxiaoNeural';
  if (l.startsWith('ja')) return 'ja-JP-NanamiNeural';
  if (l.startsWith('ka')) return 'ka-GE-EkaNeural';
  if (l.startsWith('en-gb') || l === 'en-uk') return 'en-GB-SoniaNeural';
  return 'en-US-AvaNeural';
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url && req.url.startsWith('/api/tts')) {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      let text = parsedUrl.searchParams.get('text') || '';
      let lang = parsedUrl.searchParams.get('lang') || 'en-US';

      if (req.method === 'POST') {
        const body = await new Promise((resolve) => {
          let acc = '';
          req.on('data', (c) => (acc += c));
          req.on('end', () => resolve(acc));
        });
        try {
          const json = JSON.parse(body);
          if (json.text) text = json.text;
          if (json.lang) lang = json.lang;
        } catch { /* ignore */ }
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
      });

      audioStream.pipe(res);
      audioStream.on('error', (err) => {
        console.error('[Server Edge-TTS] Stream error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('TTS error');
        }
      });
    } catch (err) {
      console.error('[Server Edge-TTS] Error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal server error');
      }
    }
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Edge TTS server running on http://localhost:${PORT}`);
});
