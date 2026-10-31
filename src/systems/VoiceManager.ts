import {
  AnnouncementPriority,
  DEFAULT_PEACEFUL_MESSAGES,
  DEFAULT_VOICE_SETTINGS,
  VieNeuMode,
  VieNeuVoiceOption,
  VoiceApiConnectionState,
  VoiceSettings,
} from '../types/temple';
import { soundSynthesizer } from './SoundSynthesizer';
import { TTSConnectionTestOutcome, TTSProviderManager } from './TTSProviderManager';

export interface QueuedAnnouncement {
  id: string;
  text: string;
  priority: AnnouncementPriority;
  category: 'large_gift' | 'gift' | 'milestone' | 'welcome' | 'comment' | 'follow' | 'background';
  dedupeKey: string;
  playBellBeforeSpeech?: boolean;
  createdAt: number;
}

export interface VoiceStateSnapshot {
  audioEnabled: boolean;
  isSpeaking: boolean;
  currentSubtitle: string;
  queueLength: number;
  apiStatus: VoiceApiConnectionState;
  lastProviderLabel: string;
  lastLatencyMs: number | null;
  lastWarning: string;
}

type VoiceStateListener = (snapshot: VoiceStateSnapshot) => void;

export class SmartVoiceManager {
  private static readonly MAX_QUEUE_LENGTH = 12;
  private queue: QueuedAnnouncement[] = [];
  private settings: VoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
  private providerManager = new TTSProviderManager();

  private audioEnabled = false;
  private isSpeaking = false;
  private currentSubtitle = '';
  private apiStatus: VoiceApiConnectionState = 'untested';
  private lastProviderLabel = 'VieNeu Cloud';
  private lastLatencyMs: number | null = null;
  private lastWarning = '';
  private currentAbort: AbortController | null = null;

  private recentDedupeMap = new Map<string, number>();
  private categoryLastEnqueued = new Map<string, number>();
  private peacefulIndex = 0;
  private backgroundTimer: number | null = null;
  private lastSpokenEndedAt = 0;

  private listeners = new Set<VoiceStateListener>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    this.setupBackgroundNarrationTimer();
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): VoiceStateSnapshot {
    return {
      audioEnabled: this.audioEnabled,
      isSpeaking: this.isSpeaking,
      currentSubtitle: this.currentSubtitle,
      queueLength: this.queue.length,
      apiStatus: this.apiStatus,
      lastProviderLabel: this.lastProviderLabel,
      lastLatencyMs: this.lastLatencyMs,
      lastWarning: this.lastWarning,
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const l of this.listeners) {
      l(snap);
    }
  }

  public enableAudio(): void {
    const ok = soundSynthesizer.unlockAudio();
    this.audioEnabled = ok || true;
    soundSynthesizer.setBackgroundMusic(
      this.settings.bgMusicEnabled,
      this.settings.bgMusicVolume,
    );
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const warm = new SpeechSynthesisUtterance('');
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    }
    this.setupBackgroundNarrationTimer();
    this.notify();
    void this.processNextInQueue();
  }

  public updateSettings(next: VoiceSettings): void {
    const prevInterval = this.settings.backgroundIntervalSec;
    const prevBgEnabled = this.settings.backgroundNarrationEnabled;
    const providerChanged =
      this.settings.provider !== next.provider ||
      this.settings.vieneuMode !== next.vieneuMode ||
      this.settings.localEndpoint !== next.localEndpoint;

    this.settings = { ...next };

    if (providerChanged) {
      this.apiStatus = 'untested';
      this.lastWarning = '';
      this.lastLatencyMs = null;
    }

    soundSynthesizer.setBackgroundMusic(next.bgMusicEnabled, next.bgMusicVolume);

    if (
      prevInterval !== next.backgroundIntervalSec ||
      prevBgEnabled !== next.backgroundNarrationEnabled
    ) {
      this.setupBackgroundNarrationTimer();
    }
    this.notify();
  }

  public getSettings(): VoiceSettings {
    return this.settings;
  }

  public async fetchVoices(mode: VieNeuMode, localEndpoint?: string): Promise<{
    ok: boolean;
    voices: VieNeuVoiceOption[];
    effectiveEndpoint: string;
    apiKeyConfigured: boolean;
    isCloudRuntime: boolean;
    warning?: string;
  }> {
    return this.providerManager.fetchAvailableVoices(mode, localEndpoint);
  }

  public async testTTSConnection(): Promise<TTSConnectionTestOutcome> {
    if (!this.audioEnabled) {
      this.enableAudio();
    }
    this.apiStatus = 'testing';
    this.lastWarning = '';
    this.notify();

    soundSynthesizer.setDucking(true);
    try {
      const result = await this.providerManager.testConnection(this.settings, true);
      if (result.ok) {
        this.apiStatus = 'connected';
        this.lastProviderLabel =
          this.settings.provider === 'vieneu'
            ? `VieNeu (${this.settings.vieneuMode === 'cloud' ? 'Cloud' : 'Local'})`
            : this.settings.provider;
        this.lastLatencyMs = result.latencyMs ?? 0;
        this.lastWarning = '';
      } else {
        this.apiStatus = 'error';
        this.lastWarning = result.errorMessage || 'Kết nối TTS thất bại.';
      }
      this.notify();
      return result;
    } finally {
      soundSynthesizer.setDucking(false);
    }
  }

  private setupBackgroundNarrationTimer(): void {
    if (this.backgroundTimer !== null) {
      window.clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }
    if (!this.settings.backgroundNarrationEnabled) return;

    const intervalMs = Math.max(25, this.settings.backgroundIntervalSec) * 1000;
    this.backgroundTimer = window.setInterval(() => {
      void this.triggerPeacefulBackgroundMessage();
    }, intervalMs);
  }

  private async triggerPeacefulBackgroundMessage(): Promise<void> {
    if (
      !this.settings.autoNarrationEnabled ||
      !this.settings.backgroundNarrationEnabled ||
      this.isSpeaking ||
      this.queue.length > 0
    ) {
      return;
    }

    let message = '';
    if (this.settings.useAiPeacefulMessages) {
      try {
        const res = await fetch('/api/narration/peaceful', { method: 'POST' });
        const data = await res.json();
        if (data?.ok && data?.message) {
          message = String(data.message);
        }
      } catch {
        // Fallback to prepared peaceful templates below
      }
    }

    if (!message) {
      const pool =
        this.settings.customPeacefulMessages.length > 0
          ? this.settings.customPeacefulMessages
          : DEFAULT_PEACEFUL_MESSAGES;
      message = pool[this.peacefulIndex % pool.length];
      this.peacefulIndex += 1;
    }

    this.enqueue({
      text: message,
      priority: AnnouncementPriority.BACKGROUND,
      category: 'background',
      dedupeKey: `bg:${message}`,
      bypassRateLimit: true,
    });
  }

  public enqueue(params: {
    text: string;
    priority: AnnouncementPriority;
    category: QueuedAnnouncement['category'];
    dedupeKey?: string;
    playBellBeforeSpeech?: boolean;
    bypassRateLimit?: boolean;
  }): void {
    if (!this.settings.autoNarrationEnabled && !params.bypassRateLimit) return;

    const cleanText = params.text.replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    const now = Date.now();
    const dedupeKey = params.dedupeKey || cleanText;

    // Anti-spam & duplicate message suppression
    if (!params.bypassRateLimit) {
      const prevDedupe = this.recentDedupeMap.get(dedupeKey);
      if (prevDedupe && now - prevDedupe < 12000) {
        return;
      }

      const catCooldowns: Record<QueuedAnnouncement['category'], number> = {
        large_gift: 250,
        gift: 350,
        milestone: 2500,
        welcome: 5500,
        comment: 8500,
        follow: 9000,
        background: 20000,
      };
      const prevCat = this.categoryLastEnqueued.get(params.category) || 0;
      if (now - prevCat < catCooldowns[params.category]) {
        return;
      }

      if (this.queue.length >= 5 && params.priority >= AnnouncementPriority.WELCOME) {
        return;
      }
    }

    this.recentDedupeMap.set(dedupeKey, now);
    this.categoryLastEnqueued.set(params.category, now);

    if (this.recentDedupeMap.size > 120) {
      for (const [k, ts] of this.recentDedupeMap.entries()) {
        if (now - ts > 60000) this.recentDedupeMap.delete(k);
      }
    }

    const item: QueuedAnnouncement = {
      id: `tts-${now}-${Math.random().toString(36).slice(2, 6)}`,
      text: cleanText,
      priority: params.priority,
      category: params.category,
      dedupeKey,
      playBellBeforeSpeech: params.playBellBeforeSpeech,
      createdAt: now,
    };

    this.queue.push(item);
    this.queue.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.createdAt - b.createdAt,
    );

    if (this.queue.length > SmartVoiceManager.MAX_QUEUE_LENGTH) {
      this.queue.length = SmartVoiceManager.MAX_QUEUE_LENGTH;
    }

    this.notify();
    void this.processNextInQueue();
  }

  public testVoice(sampleText?: string): void {
    if (!this.audioEnabled) {
      this.enableAudio();
    }
    const text =
      sampleText ||
      'Nam mô A Di Đà Phật. Chào mừng quý Phật tử đã đến với Chùa Online. Kính chúc bạn và gia đình bình an.';
    this.enqueue({
      text,
      priority: AnnouncementPriority.LARGE_GIFT,
      category: 'milestone',
      dedupeKey: `test-${Date.now()}`,
      bypassRateLimit: true,
    });
  }

  public stopAndClearQueue(): void {
    this.queue = [];
    if (this.currentAbort) {
      this.currentAbort.abort();
      this.currentAbort = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentSubtitle = '';
    soundSynthesizer.setDucking(false);
    this.notify();
  }

  private async processNextInQueue(): Promise<void> {
    if (this.isSpeaking || this.queue.length === 0) return;

    const now = Date.now();
    const elapsedSinceLast = now - this.lastSpokenEndedAt;
    const waitMs = Math.max(0, this.settings.cooldownMs * 0.35 - elapsedSinceLast);
    if (waitMs > 60) {
      window.setTimeout(() => void this.processNextInQueue(), waitMs);
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    this.isSpeaking = true;
    this.currentSubtitle = next.text;
    const abortController = new AbortController();
    this.currentAbort = abortController;
    soundSynthesizer.setDucking(true);
    this.notify();

    try {
      if (this.audioEnabled) {
        // For Large Gifts: play a gentle temple bell BEFORE the thank-you speech begins!
        if (next.playBellBeforeSpeech) {
          soundSynthesizer.playTempleBell(0.85);
          await new Promise<void>((resolve) => {
            const bellWait = window.setTimeout(resolve, 900);
            abortController.signal.addEventListener('abort', () => {
              window.clearTimeout(bellWait);
              resolve();
            });
          });
        }

        if (!abortController.signal.aborted) {
          const res = await this.providerManager.speakText(
            next.text,
            this.settings,
            abortController.signal,
          );
          this.lastProviderLabel = res.providerLabel;
          if (res.latencyMs !== undefined) {
            this.lastLatencyMs = res.latencyMs;
          }
          if (res.ok) {
            this.apiStatus = 'connected';
            this.lastWarning = '';
          } else {
            this.apiStatus = res.usedFallback ? 'fallback' : 'error';
            this.lastWarning = res.errorWarning || 'Không thể kết nối dịch vụ TTS.';
          }
        }
      } else {
        await new Promise<void>((resolve) => {
          const t = window.setTimeout(resolve, 3200);
          abortController.signal.addEventListener('abort', () => {
            window.clearTimeout(t);
            resolve();
          });
        });
      }
    } finally {
      this.isSpeaking = false;
      this.currentSubtitle = '';
      this.currentAbort = null;
      this.lastSpokenEndedAt = Date.now();
      soundSynthesizer.setDucking(false);
      this.notify();

      if (this.queue.length > 0) {
        window.setTimeout(
          () => void this.processNextInQueue(),
          Math.max(250, this.settings.cooldownMs * 0.4),
        );
      }
    }
  }
}

export const voiceManager = new SmartVoiceManager();
