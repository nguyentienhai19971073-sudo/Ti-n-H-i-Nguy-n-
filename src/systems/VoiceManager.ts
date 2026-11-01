import {
  AnnouncementPriority,
  DEFAULT_COMMENT_VOICE_FORMULA,
  DEFAULT_PEACEFUL_MESSAGES,
  DEFAULT_VOICE_SETTINGS,
  VieNeuMode,
  VieNeuVoiceOption,
  VoiceApiConnectionState,
  VoiceSettings,
  sanitizeCeremonialText,
} from '../types/temple';
import { soundSynthesizer } from './SoundSynthesizer';
import { TTSConnectionTestOutcome, TTSProviderManager } from './TTSProviderManager';

export type AnnouncementCategory =
  | 'large_gift'
  | 'xin_xam'
  | 'gift'
  | 'special_ritual'
  | 'prayer_comment'
  | 'ordinary_comment'
  | 'background';

export interface QueuedAnnouncement {
  id: string;
  text: string;
  priority: AnnouncementPriority;
  queuePriority?: number;
  category: AnnouncementCategory;
  dedupeKey: string;
  userId?: string;
  username?: string;
  isDemo?: boolean;
  playBellBeforeSpeech?: boolean;
  createdAt: number;
}

export interface VoiceStateSnapshot {
  audioEnabled: boolean;
  isSpeaking: boolean;
  currentSubtitle: string;
  currentSpeakerUserId: string | null;
  currentSpeakerUsername: string | null;
  currentPriority: AnnouncementPriority | null;
  queueLength: number;
  apiStatus: VoiceApiConnectionState;
  lastProviderLabel: string;
  lastLatencyMs: number | null;
  lastWarning: string;
}

export type CommentModerationSkipReason =
  | 'empty'
  | 'too_short'
  | 'exceeds_max_length'
  | 'no_letters'
  | 'unsafe_or_spam';

export interface CommentModerationResult {
  allowed: boolean;
  normalizedComment: string;
  reason?: CommentModerationSkipReason;
}

export interface FormattedCommentSpeechResult {
  allowed: boolean;
  text: string;
  normalizedComment: string;
  spokenUsername: string;
  reason?: CommentModerationSkipReason;
}

type VoiceStateListener = (snapshot: VoiceStateSnapshot) => void;

const SPAM_OR_URL_REGEX = /(https?:\/\/|www\.|\.com\b|\.vn\b|telegram|zalo\s*\d|\d{8,})/i;
const UNSAFE_COMMENT_REGEX =
  /\b(đm|địt|vl|vcl|đéo|lừa\s*đảo|cờ\s*bạc|casino|bet88|kubet|fuck|shit|scam)\b/i;
const REPEATED_CHAR_SPAM_REGEX = /(.)\1{5,}/u;
const HAS_LETTER_REGEX = /\p{L}/u;

/**
 * Normalizes a TikTok username into natural spoken Vietnamese form so VieNeuTTS
 * reads cleanly without spelling out @, underscores, or dots.
 */
export function normalizeSpeechUsername(rawName: string): string {
  const cleaned = String(rawName || '')
    .normalize('NFC')
    .replace(/^@+/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
  return cleaned || 'Phật tử';
}

/**
 * Moderates and normalizes a viewer's real TikTok comment for VieNeuTTS narration.
 * - Normalizes ONLY Unicode NFC and whitespace (never summarizes, paraphrases, or appends invented wishes).
 * - Skips unsafe, spammy, or overly long comments cleanly rather than rewriting or truncating their meaning.
 */
export function moderateAndNormalizeCommentForSpeech(
  rawComment: string,
  options?: {
    maxCommentLength?: number;
    blockSpamLinksAndUnsafe?: boolean;
  },
): CommentModerationResult {
  const maxLen = Math.max(15, Math.min(240, Math.round(options?.maxCommentLength ?? 90)));
  const blockUnsafe = options?.blockSpamLinksAndUnsafe !== false;

  const normalized = String(rawComment || '')
    .normalize('NFC')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return { allowed: false, normalizedComment: '', reason: 'empty' };
  }
  if (normalized.length < 2) {
    return { allowed: false, normalizedComment: '', reason: 'too_short' };
  }
  if (normalized.length > maxLen) {
    return { allowed: false, normalizedComment: '', reason: 'exceeds_max_length' };
  }
  if (!HAS_LETTER_REGEX.test(normalized)) {
    return { allowed: false, normalizedComment: '', reason: 'no_letters' };
  }
  if (blockUnsafe) {
    if (
      SPAM_OR_URL_REGEX.test(normalized) ||
      UNSAFE_COMMENT_REGEX.test(normalized) ||
      REPEATED_CHAR_SPAM_REGEX.test(normalized)
    ) {
      return { allowed: false, normalizedComment: '', reason: 'unsafe_or_spam' };
    }
  }

  return { allowed: true, normalizedComment: normalized };
}

/**
 * Builds the exact Vietnamese narration string to send to VieNeuTTS using the administrator's
 * configurable comment formula (`{username}`, `{comment}`) while preserving the viewer's exact words.
 */
export function formatCommentSpeechFormula(
  formula: string | undefined,
  rawUsername: string,
  rawComment: string,
  options?: {
    maxCommentLength?: number;
    blockSpamLinksAndUnsafe?: boolean;
  },
): FormattedCommentSpeechResult {
  const mod = moderateAndNormalizeCommentForSpeech(rawComment, options);
  const spokenUsername = normalizeSpeechUsername(rawUsername);
  if (!mod.allowed) {
    return {
      allowed: false,
      text: '',
      normalizedComment: '',
      spokenUsername,
      reason: mod.reason,
    };
  }

  const effectiveFormula = formula?.trim() || DEFAULT_COMMENT_VOICE_FORMULA;
  const text = effectiveFormula
    .replace(/\{username\}/gi, () => spokenUsername)
    .replace(/\{comment\}/gi, () => mod.normalizedComment)
    .replace(/\s+/g, ' ')
    .trim();

  return {
    allowed: true,
    text,
    normalizedComment: mod.normalizedComment,
    spokenUsername,
  };
}

/**
 * Backwards-compatible helper returning normalized comment text or null if skipped by moderation.
 */
export function normalizeCommentForSpeech(
  rawComment: string,
  maxCommentLength = 90,
): string | null {
  const res = moderateAndNormalizeCommentForSpeech(rawComment, { maxCommentLength });
  return res.allowed ? res.normalizedComment : null;
}

export class SmartVoiceManager {
  private static readonly MAX_QUEUE_LENGTH = 16;

  private queue: QueuedAnnouncement[] = [];
  private settings: VoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
  private providerManager = new TTSProviderManager();

  private audioEnabled = false;
  private isSpeaking = false;
  private currentItem: QueuedAnnouncement | null = null;
  private currentSubtitle = '';
  private apiStatus: VoiceApiConnectionState = 'idle';
  private lastProviderLabel = 'VieNeu Cloud';
  private lastLatencyMs: number | null = null;
  private lastWarning = '';
  private currentAbort: AbortController | null = null;
  private interruptedByGift = false;

  private recentDedupeMap = new Map<string, number>();
  private categoryLastEnqueued = new Map<AnnouncementCategory, number>();
  private userCommentSpokenMap = new Map<string, number>();
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
      currentSpeakerUserId: this.currentItem?.userId ?? null,
      currentSpeakerUsername: this.currentItem?.username ?? null,
      currentPriority: this.currentItem?.priority ?? null,
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

    this.settings = {
      ...next,
      commentTemplates: { ...next.commentTemplates },
    };

    if (providerChanged) {
      this.apiStatus = 'idle';
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

  public async fetchVoices(
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
    if (typeof window === 'undefined') return;
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

  public getQueueSnapshot(): ReadonlyArray<QueuedAnnouncement> {
    return [...this.queue];
  }

  public getCurrentSpeakingItem(): QueuedAnnouncement | null {
    return this.currentItem ? { ...this.currentItem } : null;
  }

  private pruneStaleQueueItems(now: number): void {
    if (this.queue.length === 0) return;
    const staleCommentMs = Math.max(5, this.settings.staleCommentTimeoutSec || 20) * 1000;
    this.queue = this.queue.filter((item) => {
      // Never drop pending gifts or special rituals unless truly ancient (>90s)
      if (item.priority <= AnnouncementPriority.SPECIAL_RITUAL) {
        return now - item.createdAt < 90000;
      }
      // Drop stale queued comments or background narration older than configured timeout
      return now - item.createdAt < staleCommentMs;
    });
  }

  public enqueue(params: {
    text: string;
    priority: AnnouncementPriority;
    queuePriority?: number;
    category: AnnouncementCategory;
    dedupeKey?: string;
    userId?: string;
    username?: string;
    isDemo?: boolean;
    playBellBeforeSpeech?: boolean;
    bypassRateLimit?: boolean;
  }): void {
    if (!this.settings.autoNarrationEnabled && !params.bypassRateLimit) return;

    const rawTrimmed = params.text.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!rawTrimmed) return;

    const isCeremonialCategory =
      params.category === 'large_gift' ||
      params.category === 'xin_xam' ||
      params.category === 'gift' ||
      params.category === 'special_ritual';
    const cleanText = isCeremonialCategory
      ? sanitizeCeremonialText(rawTrimmed, rawTrimmed)
      : rawTrimmed;
    if (!cleanText) return;

    const now = Date.now();
    this.pruneStaleQueueItems(now);

    const dedupeKey = params.dedupeKey || cleanText;
    const isGift = params.priority <= AnnouncementPriority.NORMAL_GIFT;
    const isComment =
      params.priority === AnnouncementPriority.PRAYER_COMMENT ||
      params.priority === AnnouncementPriority.ORDINARY_COMMENT;

    if (!params.bypassRateLimit) {
      // Prevent duplicate playback of identical dedupeKey
      const prevDedupe = this.recentDedupeMap.get(dedupeKey);
      const dedupeWindowMs = isGift ? 4500 : 12000;
      if (prevDedupe && now - prevDedupe < dedupeWindowMs) {
        return;
      }
      if (this.queue.some((q) => q.dedupeKey === dedupeKey)) {
        return;
      }

      // Per-user comment narration rate limit to prevent spam overload
      if (isComment && params.userId) {
        const lastUserSpoken = this.userCommentSpokenMap.get(params.userId) || 0;
        const userCooldownMs = params.isDemo
          ? 1500
          : Math.max(2, this.settings.perUserCommentCooldownSec) * 1000;
        if (now - lastUserSpoken < userCooldownMs) {
          return;
        }
        // Replace any older still-queued comment from the same user so only their newest wish is read
        const existingUserCommentIdx = this.queue.findIndex(
          (q) =>
            q.userId === params.userId &&
            (q.priority === AnnouncementPriority.PRAYER_COMMENT ||
              q.priority === AnnouncementPriority.ORDINARY_COMMENT),
        );
        if (existingUserCommentIdx !== -1) {
          this.queue.splice(existingUserCommentIdx, 1);
        }
      }

      // Global category pacing using admin-configured commentCooldownSec
      const commentCooldownMs = params.isDemo
        ? Math.min(550, Math.max(0, this.settings.commentCooldownSec) * 1000)
        : Math.max(0, this.settings.commentCooldownSec) * 1000;

      const catCooldowns: Record<AnnouncementCategory, number> = {
        large_gift: 0,
        xin_xam: 0,
        gift: 0,
        special_ritual: 1500,
        prayer_comment: commentCooldownMs,
        ordinary_comment: commentCooldownMs,
        background: 20000,
      };
      const prevCat = this.categoryLastEnqueued.get(params.category) || 0;
      if (now - prevCat < catCooldowns[params.category]) {
        return;
      }
    }

    this.recentDedupeMap.set(dedupeKey, now);
    this.categoryLastEnqueued.set(params.category, now);
    if (isComment && params.userId) {
      this.userCommentSpokenMap.set(params.userId, now);
    }

    if (this.recentDedupeMap.size > 160) {
      for (const [k, ts] of this.recentDedupeMap.entries()) {
        if (now - ts > 60000) this.recentDedupeMap.delete(k);
      }
    }
    if (this.userCommentSpokenMap.size > 250) {
      for (const [k, ts] of this.userCommentSpokenMap.entries()) {
        if (now - ts > 120000) this.userCommentSpokenMap.delete(k);
      }
    }

    // If a gift arrives, drop any queued background idle message
    if (isGift) {
      this.queue = this.queue.filter((q) => q.priority !== AnnouncementPriority.BACKGROUND);
    }

    // Cap pending comment announcements so high-volume chat never overloads the voice queue
    if (isComment) {
      const maxPendingComments = Math.max(1, Math.min(12, this.settings.maxCommentQueueSize || 5));
      let pendingComments = this.queue.filter(
        (q) =>
          q.priority === AnnouncementPriority.PRAYER_COMMENT ||
          q.priority === AnnouncementPriority.ORDINARY_COMMENT,
      );
      while (pendingComments.length >= maxPendingComments) {
        const ordinaryIdx = this.queue.findIndex(
          (q) => q.priority === AnnouncementPriority.ORDINARY_COMMENT,
        );
        const dropIdx =
          ordinaryIdx !== -1
            ? ordinaryIdx
            : this.queue.findIndex((q) => q.priority === AnnouncementPriority.PRAYER_COMMENT);
        if (dropIdx !== -1) {
          this.queue.splice(dropIdx, 1);
        } else {
          break;
        }
        pendingComments = this.queue.filter(
          (q) =>
            q.priority === AnnouncementPriority.PRAYER_COMMENT ||
            q.priority === AnnouncementPriority.ORDINARY_COMMENT,
        );
      }
    }

    const defaultQueuePrio =
      params.priority === AnnouncementPriority.LARGE_GIFT
        ? 95
        : params.priority === AnnouncementPriority.XIN_XAM
          ? 80
          : params.priority === AnnouncementPriority.NORMAL_GIFT
            ? 55
            : params.priority === AnnouncementPriority.SPECIAL_RITUAL
              ? 30
              : 10;

    const item: QueuedAnnouncement = {
      id: `tts-${now}-${Math.random().toString(36).slice(2, 6)}`,
      text: cleanText,
      priority: params.priority,
      queuePriority: params.queuePriority ?? defaultQueuePrio,
      category: params.category,
      dedupeKey,
      userId: params.userId,
      username: params.username,
      isDemo: params.isDemo,
      playBellBeforeSpeech: params.playBellBeforeSpeech,
      createdAt: now,
    };

    this.queue.push(item);
    // Strict priority queue order:
    // 1. LARGE_GIFT (1) > 2. XIN_XAM (2) > 3. NORMAL_GIFT (3) > 4. SPECIAL_RITUAL (4) > 5/6. COMMENTS (5/6) > 7. BACKGROUND (7)
    // Within the same tier, higher numeric queuePriority speaks first, then FIFO by createdAt!
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const qpDiff = (b.queuePriority ?? 0) - (a.queuePriority ?? 0);
      if (qpDiff !== 0) return qpDiff;
      return a.createdAt - b.createdAt;
    });

    if (this.queue.length > SmartVoiceManager.MAX_QUEUE_LENGTH) {
      this.queue.length = SmartVoiceManager.MAX_QUEUE_LENGTH;
    }

    // VOICE PRIORITY: CEREMONIAL EVENTS FIRST — COMMENTS NEVER INTERRUPT CEREMONIES!
    // Only ceremonial items (isGift) can preempt an ongoing comment/background narration.
    if (
      isGift &&
      this.isSpeaking &&
      this.currentItem &&
      this.currentItem.priority >= AnnouncementPriority.PRAYER_COMMENT &&
      this.settings.giftInterruptPolicy === 'interrupt_comments'
    ) {
      this.interruptedByGift = true;
      if (this.currentAbort) {
        this.currentAbort.abort();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.notify();
      return;
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
      category: 'special_ritual',
      dedupeKey: `test-${Date.now()}`,
      bypassRateLimit: true,
    });
  }

  public previewGiftVoice(text: string, playBellBeforeSpeech = false): void {
    if (!this.audioEnabled) {
      this.enableAudio();
    }
    this.enqueue({
      text,
      priority: AnnouncementPriority.LARGE_GIFT,
      category: playBellBeforeSpeech ? 'large_gift' : 'gift',
      dedupeKey: `gift-preview-${Date.now()}`,
      playBellBeforeSpeech,
      bypassRateLimit: true,
    });
  }

  public previewXinXamVoice(text: string): void {
    if (!this.audioEnabled) {
      this.enableAudio();
    }
    this.enqueue({
      text,
      priority: AnnouncementPriority.XIN_XAM,
      category: 'xin_xam',
      dedupeKey: `xinxam-preview-${Date.now()}`,
      playBellBeforeSpeech: false,
      bypassRateLimit: true,
    });
  }

  public stopAndClearQueue(): void {
    this.queue = [];
    this.interruptedByGift = false;
    this.recentDedupeMap.clear();
    this.categoryLastEnqueued.clear();
    this.userCommentSpokenMap.clear();
    if (this.currentAbort) {
      this.currentAbort.abort();
      this.currentAbort = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentItem = null;
    this.currentSubtitle = '';
    soundSynthesizer.setDucking(false);
    this.notify();
  }

  private async processNextInQueue(): Promise<void> {
    if (this.isSpeaking) return;

    const now = Date.now();
    this.pruneStaleQueueItems(now);
    if (this.queue.length === 0) return;

    const nextCandidate = this.queue[0];
    const isHighPriorityGift =
      nextCandidate.priority <= AnnouncementPriority.NORMAL_GIFT;

    if (!this.interruptedByGift && !isHighPriorityGift) {
      const elapsedSinceLast = now - this.lastSpokenEndedAt;
      const waitMs = Math.max(0, this.settings.cooldownMs * 0.32 - elapsedSinceLast);
      if (waitMs > 50) {
        setTimeout(() => void this.processNextInQueue(), waitMs);
        return;
      }
    }

    const next = this.queue.shift();
    if (!next) return;

    this.interruptedByGift = false;
    this.isSpeaking = true;
    this.currentItem = next;
    this.currentSubtitle = next.text;
    const abortController = new AbortController();
    this.currentAbort = abortController;
    soundSynthesizer.setDucking(true);
    this.notify();

    try {
      if (this.audioEnabled) {
        // For Large Gifts / Bronze Bell: play a gentle temple bell BEFORE the thank-you speech begins
        if (next.playBellBeforeSpeech && !abortController.signal.aborted) {
          soundSynthesizer.playTempleBell(0.84);
          await new Promise<void>((resolve) => {
            const bellWait = setTimeout(resolve, 820);
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(bellWait);
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
          if (!abortController.signal.aborted) {
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
        }
      } else {
        // Subtitle display duration when browser audio has not yet been unlocked
        const estMs = Math.min(4500, Math.max(2200, next.text.length * 42));
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, estMs);
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve();
          });
        });
      }
    } finally {
      const wasPreempted = this.interruptedByGift;
      this.isSpeaking = false;
      this.currentItem = null;
      this.currentSubtitle = '';
      this.currentAbort = null;
      this.lastSpokenEndedAt = Date.now();
      soundSynthesizer.setDucking(false);
      this.notify();

      if (this.queue.length > 0) {
        const nextDelay = wasPreempted
          ? 90
          : this.queue[0]?.priority <= AnnouncementPriority.NORMAL_GIFT
            ? 140
            : Math.max(220, this.settings.cooldownMs * 0.35);
        setTimeout(() => void this.processNextInQueue(), nextDelay);
      }
    }
  }
}

export const voiceManager = new SmartVoiceManager();
