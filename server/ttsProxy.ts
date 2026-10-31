import { GoogleGenAI } from '@google/genai';
import {
  CURATED_VIENEU_VOICES,
  TTSProviderType,
  VieNeuMode,
  VieNeuVoiceOption,
} from '../src/types/temple.ts';

export const DEFAULT_VIENEU_CLOUD_SPEECH_URL = 'https://api.vieneu.io/api/v1/audio/speech';
export const DEFAULT_VIENEU_LOCAL_SPEECH_URL = 'http://127.0.0.1:8000/v1/audio/speech';

const RECOMMENDED_VOICE_IDS = new Set([
  'Ngọc Lan',
  'Nhã Uyên',
  'Bảo Trâm',
  'Minh Ngọc',
  'Mẫn Nghi',
  'Thùy An',
  'Tiểu Hồng',
  'Bạch Tuyết',
  'Ngọc Diễm',
  'Thiền Tâm Đức',
  'Bảo Long',
]);

let sharedGenAI: GoogleGenAI | null = null;
let cachedCloudVoices: { voices: VieNeuVoiceOption[]; fetchedAt: number } | null = null;

export function isLocalhostUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return (
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]'
    );
  } catch {
    return /127\.0\.0\.1|localhost|0\.0\.0\.0/i.test(rawUrl);
  }
}

/**
 * Detects whether the Node.js server is running inside Google AI Studio's cloud container / Cloud Run
 * rather than on the user's personal Mac after exporting to GitHub.
 */
export function isCloudServerEnvironment(): boolean {
  if (process.env.ALLOW_LOCAL_MAC_TTS === 'true') {
    return false;
  }
  if (
    process.env.K_SERVICE ||
    process.env.CLOUD_RUN_JOB ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    (process.env.APP_URL &&
      (process.env.APP_URL.includes('.run.app') || process.env.APP_URL.includes('aistudio'))) ||
    process.cwd().startsWith('/app/applet')
  ) {
    return true;
  }
  return false;
}

export function getVieNeuServerConfig() {
  const rawEnvUrl = (process.env.VIENEU_TTS_URL || '').trim();
  const envWasLocalhost = Boolean(rawEnvUrl && isLocalhostUrl(rawEnvUrl));

  let cloudSpeechUrl = DEFAULT_VIENEU_CLOUD_SPEECH_URL;
  if (rawEnvUrl && !envWasLocalhost && /^https?:\/\//i.test(rawEnvUrl)) {
    const trimmed = rawEnvUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/audio/speech') || trimmed.endsWith('/tts')) {
      cloudSpeechUrl = trimmed;
    } else if (trimmed.endsWith('/api/v1') || trimmed.endsWith('/v1')) {
      cloudSpeechUrl = `${trimmed}/audio/speech`;
    } else {
      cloudSpeechUrl = `${trimmed}/api/v1/audio/speech`;
    }
  }

  const localSpeechUrl = (
    process.env.VIENEU_LOCAL_URL ||
    (envWasLocalhost && rawEnvUrl.includes(':8000') ? rawEnvUrl : '') ||
    DEFAULT_VIENEU_LOCAL_SPEECH_URL
  ).trim();

  const apiKey = (process.env.VIENEU_API_KEY || '').trim();
  const apiKeyConfigured = Boolean(
    apiKey && apiKey !== 'MY_VIENEU_API_KEY' && apiKey !== 'YOUR_VIENEU_API_KEY',
  );

  return {
    apiKey,
    apiKeyConfigured,
    cloudSpeechUrl,
    localSpeechUrl,
    envWasLocalhost,
    isCloudRuntime: isCloudServerEnvironment(),
  };
}

function deriveVoicesUrlFromSpeechUrl(speechUrl: string, isCloud: boolean): string {
  try {
    const parsed = new URL(speechUrl);
    if (isCloud) {
      const basePath = parsed.pathname.replace(/\/audio\/speech\/?$/, '');
      parsed.pathname = `${basePath}/voices`;
      parsed.search = '?engine=v4';
      return parsed.toString();
    }
    const basePath = parsed.pathname.replace(/\/audio\/speech\/?$/, '').replace(/\/tts\/?$/, '/v1');
    parsed.pathname = `${basePath}/voices`;
    parsed.search = '';
    return parsed.toString();
  } catch {
    return isCloud
      ? 'https://api.vieneu.io/api/v1/voices?engine=v4'
      : 'http://127.0.0.1:8000/v1/voices';
  }
}

export async function fetchVieNeuVoices(
  mode: VieNeuMode,
  customLocalEndpoint?: string,
): Promise<{
  ok: boolean;
  mode: VieNeuMode;
  voices: VieNeuVoiceOption[];
  effectiveEndpoint: string;
  apiKeyConfigured: boolean;
  isCloudRuntime: boolean;
  warning?: string;
}> {
  const cfg = getVieNeuServerConfig();

  if (mode === 'local') {
    const targetSpeechUrl = (customLocalEndpoint || cfg.localSpeechUrl).trim();
    // STRICT GUARD: Never attempt to access Mac localhost from Google AI Studio's cloud server
    if (cfg.isCloudRuntime && isLocalhostUrl(targetSpeechUrl)) {
      return {
        ok: false,
        mode: 'local',
        voices: CURATED_VIENEU_VOICES,
        effectiveEndpoint: targetSpeechUrl,
        apiKeyConfigured: cfg.apiKeyConfigured,
        isCloudRuntime: true,
        warning:
          'Máy chủ hiện chạy trên đám mây Google AI Studio nên không kết nối tới 127.0.0.1:8000 của máy Mac. Chế độ Local sẽ tự hoạt động khi bạn xuất dự án về chạy trên Mac.',
      };
    }

    const voicesUrl = deriveVoicesUrlFromSpeechUrl(targetSpeechUrl, false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(voicesUrl, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: any = await res.json();
      const rawList = Array.isArray(data?.voices)
        ? data.voices
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

      if (rawList.length > 0) {
        const mapped: VieNeuVoiceOption[] = rawList.map((v: any) => {
          if (typeof v === 'string') {
            return {
              id: v,
              name: v,
              description: 'Giọng VieNeu cục bộ',
              gender: 'female',
              recommended: true,
            };
          }
          const id = String(v.id || v.voice_id || v.name || 'Ngọc Lan');
          return {
            id,
            name: String(v.name || id),
            description: String(v.description || 'Giọng VieNeu cục bộ trên Mac'),
            gender: String(v.gender || 'female'),
            region: v.region ? String(v.region) : undefined,
            recommended: true,
          };
        });
        return {
          ok: true,
          mode: 'local',
          voices: mapped,
          effectiveEndpoint: targetSpeechUrl,
          apiKeyConfigured: true,
          isCloudRuntime: cfg.isCloudRuntime,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        mode: 'local',
        voices: CURATED_VIENEU_VOICES,
        effectiveEndpoint: targetSpeechUrl,
        apiKeyConfigured: cfg.apiKeyConfigured,
        isCloudRuntime: cfg.isCloudRuntime,
        warning: `Không đọc được danh sách giọng từ máy chủ Local (${voicesUrl}): ${msg}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // CLOUD MODE: Fetch official VieNeu v4 catalog
  if (cachedCloudVoices && Date.now() - cachedCloudVoices.fetchedAt < 5 * 60 * 1000) {
    return {
      ok: true,
      mode: 'cloud',
      voices: cachedCloudVoices.voices,
      effectiveEndpoint: cfg.cloudSpeechUrl,
      apiKeyConfigured: cfg.apiKeyConfigured,
      isCloudRuntime: cfg.isCloudRuntime,
    };
  }

  const voicesUrl = deriveVoicesUrlFromSpeechUrl(cfg.cloudSpeechUrl, true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (cfg.apiKeyConfigured) {
      headers.Authorization = `Bearer ${cfg.apiKey}`;
    }
    const res = await fetch(voicesUrl, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data: any = await res.json();
    const rawVoices: any[] = Array.isArray(data?.voices) ? data.voices : [];
    if (rawVoices.length === 0) {
      throw new Error('Danh sách giọng từ VieNeu API trống.');
    }

    const mapped: VieNeuVoiceOption[] = rawVoices.map((v) => {
      const id = String(v.id || v.name);
      const desc = String(v.description || '');
      const isCalmMatch =
        RECOMMENDED_VOICE_IDS.has(id) ||
        /phật|thiền|dịu dàng|nhẹ nhàng|ấm áp|chậm rãi|trầm ấm/i.test(`${id} ${desc}`);
      return {
        id,
        name: String(v.name || id),
        description: desc,
        gender: String(v.gender || 'female'),
        region: v.region ? String(v.region) : undefined,
        engine: v.engine ? String(v.engine) : 'v4',
        recommended: isCalmMatch,
      };
    });

    // Sort: Recommended gentle/Buddhist voices first (Ngọc Lan #1), then female voices, then others
    mapped.sort((a, b) => {
      if (a.id === 'Ngọc Lan') return -1;
      if (b.id === 'Ngọc Lan') return 1;
      const aPinned = RECOMMENDED_VOICE_IDS.has(a.id) ? 1 : 0;
      const bPinned = RECOMMENDED_VOICE_IDS.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      const aRec = a.recommended ? 1 : 0;
      const bRec = b.recommended ? 1 : 0;
      if (aRec !== bRec) return bRec - aRec;
      if (a.gender !== b.gender) return a.gender === 'female' ? -1 : 1;
      return a.name.localeCompare(b.name, 'vi');
    });

    const trimmedCatalog = mapped.slice(0, 90);
    cachedCloudVoices = { voices: trimmedCatalog, fetchedAt: Date.now() };

    return {
      ok: true,
      mode: 'cloud',
      voices: trimmedCatalog,
      effectiveEndpoint: cfg.cloudSpeechUrl,
      apiKeyConfigured: cfg.apiKeyConfigured,
      isCloudRuntime: cfg.isCloudRuntime,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      mode: 'cloud',
      voices: CURATED_VIENEU_VOICES,
      effectiveEndpoint: cfg.cloudSpeechUrl,
      apiKeyConfigured: cfg.apiKeyConfigured,
      isCloudRuntime: cfg.isCloudRuntime,
      warning: `Không tải được danh mục giọng trực tuyến VieNeu (${msg}). Đang hiển thị danh sách giọng chuẩn tích hợp.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!sharedGenAI) {
    sharedGenAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return sharedGenAI;
}

export interface ServerTTSRequest {
  provider: TTSProviderType;
  vieneuMode?: VieNeuMode;
  vieneuModel?: string;
  localEndpoint?: string;
  text: string;
  endpoint?: string;
  voiceId?: string;
  gender?: 'female' | 'male';
  speed?: number;
}

export interface ServerTTSResult {
  audioBase64: string;
  mimeType: string;
  providerUsed: TTSProviderType;
  modeUsed?: VieNeuMode;
  endpointUsed?: string;
  latencyMs: number;
}

export async function synthesizeSpeechOnServer(req: ServerTTSRequest): Promise<ServerTTSResult> {
  const cleanText = req.text.trim().slice(0, 360);
  if (!cleanText) {
    throw new Error('Nội dung thuyết minh trống.');
  }

  switch (req.provider) {
    case 'vieneu':
      return req.vieneuMode === 'local'
        ? synthesizeVieNeuLocal(cleanText, req)
        : synthesizeVieNeuCloud(cleanText, req);
    case 'elevenlabs':
      return synthesizeElevenLabs(cleanText, req);
    case 'openai':
      return synthesizeOpenAICompatible(cleanText, req);
    case 'gemini':
      return synthesizeGeminiTTS(cleanText, req);
    default:
      throw new Error('Provider này được xử lý trực tiếp trên trình duyệt.');
  }
}

async function parseErrorBody(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(raw);
    const detail =
      parsed?.error?.message ||
      (typeof parsed?.error === 'string' ? parsed.error : '') ||
      parsed?.detail ||
      parsed?.message;
    if (detail) return String(detail);
  } catch {
    // Plain text error body
  }
  return raw.slice(0, 180);
}

function normalizeAudioMimeType(rawContentType: string | null, fallback = 'audio/mpeg'): string {
  if (!rawContentType) return fallback;
  const lower = rawContentType.split(';')[0].trim().toLowerCase();
  if (lower.startsWith('audio/')) {
    if (lower === 'audio/mp3') return 'audio/mpeg';
    if (lower === 'audio/x-wav') return 'audio/wav';
    return lower;
  }
  return fallback;
}

async function synthesizeVieNeuCloud(
  text: string,
  req: ServerTTSRequest,
): Promise<ServerTTSResult> {
  const startedAt = Date.now();
  const cfg = getVieNeuServerConfig();

  if (!cfg.apiKeyConfigured) {
    throw new Error(
      'Chưa cấu hình VIENEU_API_KEY trong Secrets của máy chủ (khóa vn_sk_... hoặc vn_test_... từ vieneu.io).',
    );
  }

  const voiceId =
    req.voiceId && !req.voiceId.startsWith('vi-VN') ? req.voiceId.trim() : 'Ngọc Lan';
  const model = (req.vieneuModel || 'vieneu-v4').trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(cfg.cloudSpeechUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg, audio/wav, application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice: voiceId,
        speed: Math.min(1.5, Math.max(0.6, req.speed ?? 0.96)),
        response_format: 'mp3',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const reason = await parseErrorBody(response);
      throw new Error(`VieNeu Cloud HTTP ${response.status}: ${reason}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json: any = await response.json();
      const b64 = json?.audio || json?.audio_base64 || json?.data;
      if (!b64) {
        const errMsg = json?.error?.message || json?.message || 'VieNeu Cloud không trả về âm thanh.';
        throw new Error(String(errMsg));
      }
      return {
        audioBase64: String(b64),
        mimeType: normalizeAudioMimeType(json?.mimeType || 'audio/mpeg'),
        providerUsed: 'vieneu',
        modeUsed: 'cloud',
        endpointUsed: cfg.cloudSpeechUrl,
        latencyMs: Date.now() - startedAt,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 64) {
      throw new Error('VieNeu Cloud trả về dữ liệu âm thanh rỗng.');
    }

    return {
      audioBase64: Buffer.from(arrayBuffer).toString('base64'),
      mimeType: normalizeAudioMimeType(contentType, 'audio/mpeg'),
      providerUsed: 'vieneu',
      modeUsed: 'cloud',
      endpointUsed: cfg.cloudSpeechUrl,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('VieNeu Cloud quá thời gian phản hồi (timeout 12s).');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesizeVieNeuLocal(
  text: string,
  req: ServerTTSRequest,
): Promise<ServerTTSResult> {
  const startedAt = Date.now();
  const cfg = getVieNeuServerConfig();
  const targetUrl = (
    req.localEndpoint ||
    (req.endpoint && isLocalhostUrl(req.endpoint) ? req.endpoint : '') ||
    cfg.localSpeechUrl ||
    DEFAULT_VIENEU_LOCAL_SPEECH_URL
  ).trim();

  // STRICT CLOUD SAFETY RULE: Never attempt to connect to user's Mac localhost from AI Studio cloud server!
  if (cfg.isCloudRuntime && isLocalhostUrl(targetUrl)) {
    throw new Error(
      'Không thể gọi 127.0.0.1:8000 từ máy chủ đám mây Google AI Studio. Hãy chọn chế độ VieNeu Cloud (kèm VIENEU_API_KEY) hoặc xuất dự án sang GitHub để chạy cục bộ trên máy Mac.',
    );
  }

  const voiceId =
    req.voiceId && !req.voiceId.startsWith('vi-VN') ? req.voiceId.trim() : 'Ngọc Lan';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/wav, audio/mpeg, application/json',
      },
      body: JSON.stringify({
        model: 'vieneu-tts',
        input: text,
        text, // Included for backward compatibility with older local VieNeu wrappers
        voice: voiceId,
        speed: Math.min(1.5, Math.max(0.6, req.speed ?? 0.96)),
        response_format: 'wav',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const reason = await parseErrorBody(response);
      throw new Error(`VieNeu Local HTTP ${response.status}: ${reason}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json: any = await response.json();
      const b64 = json?.audio || json?.audio_base64 || json?.data;
      if (!b64) {
        throw new Error('VieNeu Local không trả về dữ liệu âm thanh.');
      }
      return {
        audioBase64: String(b64),
        mimeType: normalizeAudioMimeType(json?.mimeType || 'audio/wav', 'audio/wav'),
        providerUsed: 'vieneu',
        modeUsed: 'local',
        endpointUsed: targetUrl,
        latencyMs: Date.now() - startedAt,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 44) {
      throw new Error('VieNeu Local trả về dữ liệu âm thanh rỗng.');
    }

    return {
      audioBase64: Buffer.from(arrayBuffer).toString('base64'),
      mimeType: normalizeAudioMimeType(contentType, 'audio/wav'),
      providerUsed: 'vieneu',
      modeUsed: 'local',
      endpointUsed: targetUrl,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`VieNeu Local (${targetUrl}) quá thời gian phản hồi (10s).`);
    }
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(rawMsg)) {
      throw new Error(
        `Không thể kết nối tới máy chủ VieNeuTTS cục bộ tại ${targetUrl}. Hãy kiểm tra dịch vụ VieNeuTTS trên máy Mac đang chạy ở cổng 8000.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesizeElevenLabs(text: string, req: ServerTTSRequest): Promise<ServerTTSResult> {
  const startedAt = Date.now();
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Chưa cấu hình ELEVENLABS_API_KEY (tùy chọn) trên máy chủ.');
  }

  const voiceId =
    req.voiceId && /^[a-zA-Z0-9]{15,}$/.test(req.voiceId.trim())
      ? req.voiceId.trim()
      : '21m00Tcm4TlvDq8ikWAM';

  const baseEndpoint =
    req.endpoint && req.endpoint.startsWith('https://api.elevenlabs.io')
      ? req.endpoint.replace(/\/+$/, '')
      : 'https://api.elevenlabs.io/v1/text-to-speech';

  const response = await fetch(`${baseEndpoint}/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.72,
        similarity_boost: 0.75,
        speed: Math.min(1.2, Math.max(0.7, req.speed ?? 0.95)),
      },
    }),
  });

  if (!response.ok) {
    const reason = await parseErrorBody(response);
    throw new Error(`ElevenLabs HTTP ${response.status}: ${reason}`);
  }

  const buf = Buffer.from(await response.arrayBuffer());
  return {
    audioBase64: buf.toString('base64'),
    mimeType: 'audio/mpeg',
    providerUsed: 'elevenlabs',
    endpointUsed: baseEndpoint,
    latencyMs: Date.now() - startedAt,
  };
}

async function synthesizeOpenAICompatible(
  text: string,
  req: ServerTTSRequest,
): Promise<ServerTTSResult> {
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const endpoint = (
    req.endpoint?.startsWith('http') && !req.endpoint.includes('vieneu.io')
      ? req.endpoint
      : process.env.OPENAI_TTS_ENDPOINT || 'https://api.openai.com/v1/audio/speech'
  ).trim();

  if (isCloudServerEnvironment() && isLocalhostUrl(endpoint)) {
    throw new Error(
      'Không thể gọi endpoint localhost từ máy chủ đám mây Google AI Studio.',
    );
  }

  if (endpoint.includes('api.openai.com') && !apiKey) {
    throw new Error('Chưa cấu hình OPENAI_API_KEY (tùy chọn) trên máy chủ.');
  }

  const openaiVoices = new Set(['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']);
  const voice =
    req.voiceId && openaiVoices.has(req.voiceId.trim().toLowerCase())
      ? req.voiceId.trim().toLowerCase()
      : req.gender === 'male'
        ? 'onyx'
        : 'nova';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      speed: Math.min(1.5, Math.max(0.65, req.speed ?? 0.95)),
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const reason = await parseErrorBody(response);
    throw new Error(`OpenAI TTS HTTP ${response.status}: ${reason}`);
  }

  const buf = Buffer.from(await response.arrayBuffer());
  return {
    audioBase64: buf.toString('base64'),
    mimeType: 'audio/mpeg',
    providerUsed: 'openai',
    endpointUsed: endpoint,
    latencyMs: Date.now() - startedAt,
  };
}

async function synthesizeGeminiTTS(text: string, req: ServerTTSRequest): Promise<ServerTTSResult> {
  const startedAt = Date.now();
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ.');
  }

  const voiceName = req.gender === 'male' ? 'Charon' : 'Kore';
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text,
            speechMetadata: {
              style:
                'Giọng đọc tiếng Việt ấm áp, nhẹ nhàng, từ tốn, trang nghiêm và thanh tịnh nơi cửa chùa',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Gemini TTS không trả về dữ liệu âm thanh.');
  }

  return {
    audioBase64: base64Audio,
    mimeType: 'audio/wav',
    providerUsed: 'gemini',
    latencyMs: Date.now() - startedAt,
  };
}

export async function generatePeacefulVietnameseGreeting(): Promise<string> {
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình.');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents:
      'Hãy viết duy nhất 1 lời chúc bình an ngắn gọn (từ 14 đến 28 từ) bằng tiếng Việt dành cho các Phật tử đang ghé thăm không gian Chùa Online.',
    config: {
      systemInstruction:
        'Bạn là người dẫn lời thanh tịnh tại Chùa Online Việt Nam. Chỉ viết đúng 1 câu tiếng Việt ấm áp, từ bi, hướng thiện, chúc bình an và sức khỏe. TUYỆT ĐỐI KHÔNG bịa đặt kinh điển, không trích dẫn lời dạy chưa kiểm chứng và không mạo danh các bậc tôn túc.',
    },
  });

  const text = (response.text || '').replace(/["«»\n]/g, '').trim();
  if (!text) {
    throw new Error('Không tạo được câu chúc.');
  }
  return text.slice(0, 180);
}
