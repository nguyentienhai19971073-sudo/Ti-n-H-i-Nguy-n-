import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { TikTokLiveAdapter } from './server/tiktokAdapter.ts';
import {
  fetchVieNeuVoices,
  generatePeacefulVietnameseGreeting,
  synthesizeSpeechOnServer,
} from './server/ttsProxy.ts';
import {
  DEFAULT_PEACEFUL_MESSAGES,
  TikTokNormalizedEvent,
  VieNeuMode,
} from './src/types/temple.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json({ limit: '1mb' }));

  const tiktokAdapter = new TikTokLiveAdapter(
    (normalizedEvent: TikTokNormalizedEvent) => {
      io.emit('tiktok:event', normalizedEvent);
    },
    (snapshot) => {
      io.emit('tiktok:status', snapshot);
    },
  );

  // Health & Server Capabilities Endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      timestamp: Date.now(),
      connection: tiktokAdapter.getSnapshot(),
    });
  });

  // Connect to real TikTok LIVE stream
  app.post('/api/tiktok/connect', async (req, res) => {
    try {
      const username = String(req.body?.username || '');
      const snapshot = await tiktokAdapter.connect(username);
      res.json(snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối TikTok LIVE';
      res.status(500).json({ error: message, snapshot: tiktokAdapter.getSnapshot() });
    }
  });

  // Disconnect from TikTok LIVE stream
  app.post('/api/tiktok/disconnect', async (req, res) => {
    const switchToDemo = Boolean(req.body?.switchToDemo);
    const snapshot = await tiktokAdapter.disconnect(switchToDemo);
    res.json(snapshot);
  });

  // External TikTok-Live-Connector / Streamer.bot / TikFinity local webhook adapter
  app.post('/api/tiktok/webhook', (req, res) => {
    const event = tiktokAdapter.ingestExternalWebhookEvent(req.body || {});
    if (!event) {
      res.status(400).json({
        ok: false,
        error: 'Sự kiện không hợp lệ hoặc bị bộ lọc nội dung từ chối.',
      });
      return;
    }
    res.json({ ok: true, event });
  });

  // Retrieve available VieNeu voices (Cloud /api/v1/voices or Local Mac /v1/voices)
  app.get('/api/tts/voices', async (req, res) => {
    try {
      const mode: VieNeuMode = req.query.mode === 'local' ? 'local' : 'cloud';
      const localEndpoint = req.query.localEndpoint ? String(req.query.localEndpoint) : undefined;
      const catalog = await fetchVieNeuVoices(mode, localEndpoint);
      res.json(catalog);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không tải được danh sách giọng đọc.';
      res.status(500).json({ ok: false, error: message, voices: [] });
    }
  });

  // Real TTS Connection Test Endpoint (Never fakes responses; returns actual audio or actual API error)
  app.post('/api/tts/test', async (req, res) => {
    try {
      const provider = req.body?.provider || 'vieneu';
      if (provider === 'browser') {
        res.json({
          ok: true,
          providerUsed: 'browser',
          latencyMs: 0,
          message: 'Giọng đọc trình duyệt (SpeechSynthesis) sẵn sàng trên máy khách.',
        });
        return;
      }

      const testPhrase = String(
        req.body?.text || 'Nam mô A Di Đà Phật. Chùa Online kính chúc quý Phật tử thân tâm an lạc.',
      );

      const result = await synthesizeSpeechOnServer({
        provider,
        vieneuMode: req.body?.vieneuMode === 'local' ? 'local' : 'cloud',
        vieneuModel: req.body?.vieneuModel ? String(req.body.vieneuModel) : 'vieneu-v4',
        localEndpoint: req.body?.localEndpoint ? String(req.body.localEndpoint) : undefined,
        endpoint: req.body?.endpoint ? String(req.body.endpoint) : undefined,
        voiceId: req.body?.voiceId ? String(req.body.voiceId) : 'Ngọc Lan',
        gender: req.body?.gender === 'male' ? 'male' : 'female',
        speed: typeof req.body?.speed === 'number' ? req.body.speed : 0.96,
        text: testPhrase,
      });

      res.json({
        ok: true,
        ...result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kiểm tra kết nối TTS.';
      res.status(502).json({
        ok: false,
        error: message,
      });
    }
  });

  // Server-side TTS Proxy (keeps API keys strictly on server)
  app.post('/api/tts', async (req, res) => {
    try {
      const result = await synthesizeSpeechOnServer({
        provider: req.body?.provider || 'vieneu',
        vieneuMode: req.body?.vieneuMode === 'local' ? 'local' : 'cloud',
        vieneuModel: req.body?.vieneuModel ? String(req.body.vieneuModel) : 'vieneu-v4',
        localEndpoint: req.body?.localEndpoint ? String(req.body.localEndpoint) : undefined,
        text: String(req.body?.text || ''),
        endpoint: req.body?.endpoint ? String(req.body.endpoint) : undefined,
        voiceId: req.body?.voiceId ? String(req.body.voiceId) : 'Ngọc Lan',
        gender: req.body?.gender === 'male' ? 'male' : 'female',
        speed: typeof req.body?.speed === 'number' ? req.body.speed : 0.96,
      });
      res.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tạo giọng đọc từ máy chủ.';
      res.status(502).json({ ok: false, error: message });
    }
  });

  // Optional AI peaceful background greeting endpoint (with safe verified fallback)
  app.post('/api/narration/peaceful', async (_req, res) => {
    try {
      const message = await generatePeacefulVietnameseGreeting();
      res.json({ ok: true, message, source: 'gemini' });
    } catch (err: unknown) {
      const fallback =
        DEFAULT_PEACEFUL_MESSAGES[Math.floor(Math.random() * DEFAULT_PEACEFUL_MESSAGES.length)];
      res.json({
        ok: true,
        message: fallback,
        source: 'template',
        warning: err instanceof Error ? err.message : undefined,
      });
    }
  });

  // Socket.IO Real-Time Synchronization
  io.on('connection', (socket) => {
    socket.emit('tiktok:status', tiktokAdapter.getSnapshot());

    socket.on('tiktok:connect', async (payload: { username?: string }) => {
      await tiktokAdapter.connect(String(payload?.username || ''));
    });

    socket.on('tiktok:disconnect', async (payload?: { switchToDemo?: boolean }) => {
      await tiktokAdapter.disconnect(Boolean(payload?.switchToDemo));
    });

    // Broadcast demo or multi-window OBS synced events across connected tabs (e.g., Admin panel -> OBS window)
    socket.on('temple:broadcast_demo_event', (event: Partial<TikTokNormalizedEvent>) => {
      tiktokAdapter.ingestExternalWebhookEvent({
        ...event,
        isDemo: true,
      });
    });

    socket.on('temple:admin_command', (cmd: { action: string; payload?: unknown }) => {
      socket.broadcast.emit('temple:admin_command', cmd);
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[CHÙA ONLINE] Server & Socket.IO listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CHÙA ONLINE server:', err);
  process.exit(1);
});
