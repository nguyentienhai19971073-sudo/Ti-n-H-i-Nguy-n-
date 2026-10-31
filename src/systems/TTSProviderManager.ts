import {
  CURATED_VIENEU_VOICES,
  VieNeuMode,
  VieNeuVoiceOption,
  VoiceSettings,
} from '../types/temple';

interface CachedClip {
  dataUrl: string;
  latencyMs: number;
  createdAt: number;
}

export interface SpeakOutcome {
  ok: boolean;
  usedFallback: boolean;
  providerLabel: string;
  latencyMs?: number;
  errorWarning?: string;
}

export interface TTSConnectionTestOutcome {
  ok: boolean;
  providerUsed?: string;
  modeUsed?: VieNeuMode;
  endpointUsed?: string;
  latencyMs?: number;
  errorMessage?: string;
}

export class TTSProviderManager {
  private audioCache = new Map<string, CachedClip>();
  private static readonly MAX_CACHE = 45;

  private getCacheKey(settings: VoiceSettings, text: string): string {
    return [
      settings.provider,
      settings.vieneuMode,
      settings.vieneuModel,
      settings.localEndpoint,
      settings.voiceId,
      settings.gender,
      settings.speed.toFixed(2),
      text,
    ].join('|');
  }

  public async fetchAvailableVoices(
    mode: VieNeuMode,
    localEndpoint?: string,
  ): Promise<{
    ok: boolean;
    voices: VieNeuVoiceOption[];
    effectiveEndpoint: string;
    apiKeyConfigured: boolean;
    isCloudRuntime: boolean;
    warning?: string;
  }> {
    try {
      const qs = new URLSearchParams({ mode });
      if (localEndpoint) qs.set('localEndpoint', localEndpoint);
      const res = await fetch(`/api/tts/voices?${qs.toString()}`);
      const data = await res.json();
      return {
        ok: Boolean(data?.ok),
        voices:
          Array.isArray(data?.voices) && data.voices.length > 0
            ? data.voices
            : CURATED_VIENEU_VOICES,
        effectiveEndpoint:
          data?.effectiveEndpoint ||
          (mode === 'cloud'
            ? 'https://api.vieneu.io/api/v1/audio/speech'
            : localEndpoint || 'http://127.0.0.1:8000/v1/audio/speech'),
        apiKeyConfigured: Boolean(data?.apiKeyConfigured),
        isCloudRuntime: Boolean(data?.isCloudRuntime),
        warning: data?.warning || data?.error,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        voices: CURATED_VIENEU_VOICES,
        effectiveEndpoint:
          mode === 'cloud'
            ? 'https://api.vieneu.io/api/v1/audio/speech'
            : localEndpoint || 'http://127.0.0.1:8000/v1/audio/speech',
        apiKeyConfigured: false,
        isCloudRuntime: true,
        warning: err instanceof Error ? err.message : 'Không tải được danh sách giọng đọc.',
      };
    }
  }

  /**
   * Executes a real connection test against the configured TTS backend without masking errors with fallback.
   */
  public async testConnection(
    settings: VoiceSettings,
    playSampleAudio = true,
  ): Promise<TTSConnectionTestOutcome> {
    if (settings.provider === 'browser') {
      if (playSampleAudio) {
        const ctrl = new AbortController();
        await this.speakWithBrowserSynthesis(
          'Nam mô A Di Đà Phật. Giọng đọc trình duyệt đã sẵn sàng.',
          settings,
          ctrl.signal,
        );
      }
      return {
        ok: true,
        providerUsed: 'browser',
        latencyMs: 0,
      };
    }

    try {
      const response = await fetch('/api/tts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          vieneuMode: settings.vieneuMode,
          vieneuModel: settings.vieneuModel,
          localEndpoint: settings.localEndpoint,
          endpoint: settings.endpoint,
          voiceId: settings.voiceId,
          gender: settings.gender,
          speed: settings.speed,
          text: 'Nam mô A Di Đà Phật. Kính chúc quý Phật tử luôn bình an.',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.audioBase64) {
        return {
          ok: false,
          errorMessage: data?.error || `Lỗi kết nối TTS (HTTP ${response.status})`,
        };
      }

      if (playSampleAudio) {
        const dataUrl = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`;
        const ctrl = new AbortController();
        await this.playAudioDataUrl(dataUrl, settings.volume, ctrl.signal);
      }

      return {
        ok: true,
        providerUsed: data.providerUsed || settings.provider,
        modeUsed: data.modeUsed || settings.vieneuMode,
        endpointUsed: data.endpointUsed,
        latencyMs: data.latencyMs,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        errorMessage: err instanceof Error ? err.message : 'Không thể kết nối máy chủ TTS.',
      };
    }
  }

  public async speakText(
    text: string,
    settings: VoiceSettings,
    abortSignal: AbortSignal,
  ): Promise<SpeakOutcome> {
    if (abortSignal.aborted) {
      return { ok: true, usedFallback: false, providerLabel: settings.provider };
    }

    if (settings.provider === 'browser') {
      await this.speakWithBrowserSynthesis(text, settings, abortSignal);
      return { ok: true, usedFallback: false, providerLabel: 'Browser SpeechSynthesis' };
    }

    const cacheKey = this.getCacheKey(settings, text);
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      await this.playAudioDataUrl(cached.dataUrl, settings.volume, abortSignal);
      return {
        ok: true,
        usedFallback: false,
        providerLabel:
          settings.provider === 'vieneu'
            ? `VieNeu (${settings.vieneuMode === 'cloud' ? 'Cloud' : 'Local'})`
            : settings.provider,
        latencyMs: cached.latencyMs,
      };
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          vieneuMode: settings.vieneuMode,
          vieneuModel: settings.vieneuModel,
          localEndpoint: settings.localEndpoint,
          text,
          endpoint: settings.endpoint,
          voiceId: settings.voiceId,
          gender: settings.gender,
          speed: settings.speed,
        }),
        signal: abortSignal,
      });

      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.audioBase64) {
        throw new Error(data?.error || `TTS HTTP ${response.status}`);
      }

      const dataUrl = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`;
      if (this.audioCache.size >= TTSProviderManager.MAX_CACHE) {
        const oldestKey = this.audioCache.keys().next().value;
        if (oldestKey) this.audioCache.delete(oldestKey);
      }
      this.audioCache.set(cacheKey, {
        dataUrl,
        latencyMs: Number(data.latencyMs || 0),
        createdAt: Date.now(),
      });

      await this.playAudioDataUrl(dataUrl, settings.volume, abortSignal);
      return {
        ok: true,
        usedFallback: false,
        providerLabel:
          settings.provider === 'vieneu'
            ? `VieNeu ${settings.vieneuMode === 'cloud' ? 'Cloud' : 'Local'}`
            : settings.provider,
        latencyMs: data.latencyMs,
      };
    } catch (err: unknown) {
      if (abortSignal.aborted) {
        return { ok: true, usedFallback: false, providerLabel: settings.provider };
      }
      const actualError = err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ TTS';

      if (settings.browserFallbackEnabled) {
        await this.speakWithBrowserSynthesis(text, settings, abortSignal);
        return {
          ok: false,
          usedFallback: true,
          providerLabel: 'Browser SpeechSynthesis (Dự phòng)',
          errorWarning: actualError,
        };
      }

      // If browser fallback is disabled, keep subtitle visible briefly and report the real error
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, 2600);
        abortSignal.addEventListener('abort', () => {
          window.clearTimeout(t);
          resolve();
        });
      });

      return {
        ok: false,
        usedFallback: false,
        providerLabel: settings.provider,
        errorWarning: actualError,
      };
    }
  }

  private playAudioDataUrl(
    dataUrl: string,
    volume: number,
    abortSignal: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (abortSignal.aborted) {
        resolve();
        return;
      }
      const audio = new Audio(dataUrl);
      audio.volume = Math.max(0, Math.min(1, volume));

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        abortSignal.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        audio.pause();
        audio.src = '';
        cleanup();
        resolve();
      };

      abortSignal.addEventListener('abort', onAbort);
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        resolve();
      };

      audio.play().catch(() => {
        cleanup();
        resolve();
      });
    });
  }

  public speakWithBrowserSynthesis(
    text: string,
    settings: VoiceSettings,
    abortSignal: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || abortSignal.aborted) {
        const fallbackMs = Math.min(5500, Math.max(1800, text.length * 65));
        const timer = window.setTimeout(resolve, fallbackMs);
        abortSignal.addEventListener('abort', () => {
          window.clearTimeout(timer);
          resolve();
        });
        return;
      }

      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.volume = Math.max(0, Math.min(1, settings.volume));
      utterance.rate = Math.max(0.65, Math.min(1.4, settings.speed));
      utterance.pitch = settings.gender === 'male' ? 0.9 : 1.04;

      const voices = synth.getVoices();
      const viVoices = voices.filter(
        (v) =>
          v.lang.toLowerCase().startsWith('vi') ||
          v.name.toLowerCase().includes('viet') ||
          v.name.toLowerCase().includes('linh') ||
          v.name.toLowerCase().includes('hoai') ||
          v.name.toLowerCase().includes('an'),
      );

      if (viVoices.length > 0) {
        const preferred =
          settings.gender === 'male'
            ? viVoices.find((v) => /nam|male|minh|an/i.test(v.name)) || viVoices[0]
            : viVoices.find((v) => /linh|hoai|nu|female|google/i.test(v.name)) || viVoices[0];
        utterance.voice = preferred;
      }

      const maxDurationMs = Math.min(11000, Math.max(3000, text.length * 110));
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(safetyTimer);
        abortSignal.removeEventListener('abort', onAbort);
        resolve();
      };

      const safetyTimer = window.setTimeout(finish, maxDurationMs);
      const onAbort = () => {
        synth.cancel();
        finish();
      };

      abortSignal.addEventListener('abort', onAbort);
      utterance.onend = finish;
      utterance.onerror = finish;

      synth.speak(utterance);
    });
  }
}
