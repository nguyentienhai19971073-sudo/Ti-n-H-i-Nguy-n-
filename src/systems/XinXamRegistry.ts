import {
  DEFAULT_XIN_XAM_SETTINGS,
  DEFAULT_XIN_XAM_VOICE_TEMPLATE,
  FortuneCategory,
  FortuneRecord,
  LEGACY_V1_XIN_XAM_VOICE_TEMPLATE,
  XinXamDrawResult,
  XinXamSettings,
  normalizeFortuneRecord,
  normalizeGiftId,
  renderXinXamVoiceText,
  sanitizeCeremonialText,
} from '../types/temple';
import { DEFAULT_100_FORTUNES } from '../data/fortunes100';
import { giftRegistry } from './GiftRegistry';
import { liveConnectionManager } from './LiveConnectionManager';

export interface XinXamRegistrySnapshot {
  settings: XinXamSettings;
  fortunes: FortuneRecord[];
  recentDraws: XinXamDrawResult[];
  syncedWithServer: boolean;
}

type XinXamSubscriber = (snapshot: XinXamRegistrySnapshot) => void;

const LOCAL_XINXAM_CACHE_KEY = 'chua_online_xinxam_registry_v2';

export class XinXamRegistry {
  private settings: XinXamSettings = { ...DEFAULT_XIN_XAM_SETTINGS };
  private fortunes: FortuneRecord[] = DEFAULT_100_FORTUNES.map((f) => ({ ...f }));
  private recentDraws: XinXamDrawResult[] = [];
  private drawByDedupeKey = new Map<string, XinXamDrawResult>();
  private syncedWithServer = false;
  private initialized = false;
  private subscribers = new Set<XinXamSubscriber>();

  constructor() {
    this.loadLocalCache();
  }

  private loadLocalCache(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(LOCAL_XINXAM_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.settings) {
        const rawTpl = parsed.settings.voiceTemplate;
        this.settings = {
          ...DEFAULT_XIN_XAM_SETTINGS,
          ...parsed.settings,
          giftId: normalizeGiftId(parsed.settings.giftId),
          voiceTemplate:
            !rawTpl || rawTpl === LEGACY_V1_XIN_XAM_VOICE_TEMPLATE
              ? DEFAULT_XIN_XAM_VOICE_TEMPLATE
              : rawTpl,
        };
      }
      if (Array.isArray(parsed?.fortunes) && parsed.fortunes.length > 0) {
        this.fortunes = parsed.fortunes.map((f: Partial<FortuneRecord> & { fortuneNumber: number }) =>
          normalizeFortuneRecord(f),
        );
      }
      if (Array.isArray(parsed?.recentDraws)) {
        this.recentDraws = parsed.recentDraws.slice(0, 40);
        for (const d of this.recentDraws) {
          if (d?.eventDedupeKey) {
            this.drawByDedupeKey.set(d.eventDedupeKey, d);
          }
        }
      }
    } catch {
      // Ignore corrupt localStorage cache
    }
  }

  private persistLocalCache(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        LOCAL_XINXAM_CACHE_KEY,
        JSON.stringify({
          updatedAt: Date.now(),
          settings: this.settings,
          fortunes: this.fortunes,
          recentDraws: this.recentDraws.slice(0, 30),
        }),
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const sub of this.subscribers) {
      sub(snap);
    }
  }

  private buildHeaders(includeJson = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    const token = giftRegistry.getAdminToken();
    if (token) {
      headers['x-admin-token'] = token;
    }
    return headers;
  }

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    liveConnectionManager.onXinXamUpdated((payload) => {
      if (payload.settings) {
        this.settings = {
          ...DEFAULT_XIN_XAM_SETTINGS,
          ...payload.settings,
          giftId: normalizeGiftId(payload.settings.giftId),
        };
      }
      if (Array.isArray(payload.fortunes)) {
        this.fortunes = payload.fortunes.map((f) => normalizeFortuneRecord(f));
      }
      if (Array.isArray(payload.recentDraws)) {
        this.recentDraws = payload.recentDraws;
        for (const d of payload.recentDraws) {
          if (d?.eventDedupeKey) {
            this.drawByDedupeKey.set(d.eventDedupeKey, d);
          }
        }
      }
      this.syncedWithServer = true;
      this.persistLocalCache();
      this.notify();
    });

    liveConnectionManager.onXinXamDrawRecorded((draw) => {
      if (draw?.eventDedupeKey) {
        this.recordDrawLocally(draw);
      }
    });

    void this.refreshFromServer();
  }

  public subscribe(cb: XinXamSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public getSnapshot(): XinXamRegistrySnapshot {
    return {
      settings: { ...this.settings },
      fortunes: this.fortunes.map((f) => ({ ...f })),
      recentDraws: this.recentDraws.map((d) => ({ ...d })),
      syncedWithServer: this.syncedWithServer,
    };
  }

  public getSettings(): XinXamSettings {
    return { ...this.settings };
  }

  public getAllFortunes(): FortuneRecord[] {
    return this.fortunes;
  }

  public getEnabledFortunes(): FortuneRecord[] {
    return this.fortunes.filter((f) => f.enabled);
  }

  /**
   * Checks whether a normalized TikTok Gift ID should trigger Xin Xăm Cầu Nguyện.
   * CRITICAL: Never triggers based on coin value alone — requires enabled === true AND exact non-empty configured Gift ID!
   */
  public matchesXinXamGiftId(rawGiftId: unknown): boolean {
    if (!this.settings.enabled) return false;
    const configuredId = normalizeGiftId(this.settings.giftId);
    if (!configuredId) return false;
    const incomingId = normalizeGiftId(rawGiftId);
    return Boolean(incomingId) && incomingId === configuredId;
  }

  /**
   * Programmatic setter used by unit tests or instant local sync.
   */
  public setSettingsLocal(patch: Partial<XinXamSettings>): XinXamSettings {
    this.settings = {
      ...this.settings,
      ...patch,
      giftId: normalizeGiftId(patch.giftId !== undefined ? patch.giftId : this.settings.giftId),
      voiceTemplate: sanitizeCeremonialText(
        patch.voiceTemplate ?? this.settings.voiceTemplate,
        DEFAULT_XIN_XAM_VOICE_TEMPLATE,
      ),
    };
    this.persistLocalCache();
    this.notify();
    return { ...this.settings };
  }

  public setFortunesLocal(nextFortunes: FortuneRecord[]): void {
    this.fortunes = nextFortunes.map((f) => normalizeFortuneRecord(f));
    this.persistLocalCache();
    this.notify();
  }

  public resetLocalForTests(): void {
    this.settings = { ...DEFAULT_XIN_XAM_SETTINGS };
    this.fortunes = DEFAULT_100_FORTUNES.map((f) => ({ ...f }));
    this.recentDraws = [];
    this.drawByDedupeKey.clear();
    this.notify();
  }

  private recordDrawLocally(draw: XinXamDrawResult): void {
    this.drawByDedupeKey.set(draw.eventDedupeKey, draw);
    const existingIdx = this.recentDraws.findIndex(
      (d) => d.eventDedupeKey === draw.eventDedupeKey,
    );
    if (existingIdx !== -1) {
      this.recentDraws[existingIdx] = draw;
    } else {
      this.recentDraws.unshift(draw);
      if (this.recentDraws.length > 50) {
        this.recentDraws.length = 50;
      }
    }
    this.persistLocalCache();
    this.notify();
  }

  /**
   * Synchronous deterministic/uniform draw with eventDedupeKey deduplication,
   * plus background persistence to SQLite server when online!
   */
  public drawFortune(params: {
    eventDedupeKey: string;
    userId: string;
    username: string;
    nickname?: string;
    avatarUrl?: string;
    isDemo?: boolean;
    forcedFortuneNumber?: number;
  }): XinXamDrawResult | null {
    const dedupeKey =
      (params.eventDedupeKey || '').trim() ||
      `xinxam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const existing = this.drawByDedupeKey.get(dedupeKey);
    if (existing) {
      return { ...existing };
    }

    const enabledPool = this.getEnabledFortunes();
    if (enabledPool.length === 0) {
      return null;
    }

    let chosen: FortuneRecord | undefined;
    if (params.forcedFortuneNumber !== undefined) {
      chosen = enabledPool.find((f) => f.fortuneNumber === Number(params.forcedFortuneNumber));
    }
    if (!chosen) {
      // Uniform random selection across all enabled fortunes (no category bias)
      const idx = Math.floor(Math.random() * enabledPool.length);
      chosen = enabledPool[idx];
    }

    const now = Date.now();
    const cleanUser = (params.username || 'phattu').replace(/^@+/, '').trim() || 'phattu';
    const displayNick = (params.nickname || cleanUser).trim();

    const resolvedTitle = chosen.fortuneTitle || chosen.title;
    const resolvedType = chosen.fortuneType || chosen.category;
    const resolvedVerse = chosen.shortVerse || chosen.poem;

    const spokenText = renderXinXamVoiceText(this.settings.voiceTemplate, {
      username: displayNick,
      fortuneNumber: chosen.fortuneNumber,
      fortuneTitle: resolvedTitle,
      fortuneType: resolvedType,
      category: resolvedType,
      fortuneInterpretation: chosen.voiceText || chosen.interpretation,
      interpretation: chosen.voiceText || chosen.interpretation,
      fortuneAdvice: chosen.advice,
      advice: chosen.advice,
    });

    const result: XinXamDrawResult = {
      drawId: `draw_${now}_${Math.random().toString(36).slice(2, 7)}`,
      eventDedupeKey: dedupeKey,
      userId: params.userId || cleanUser,
      username: cleanUser,
      nickname: displayNick,
      avatarUrl: params.avatarUrl || '',
      fortuneId: chosen.fortuneId,
      fortuneNumber: chosen.fortuneNumber,
      fortuneCode: chosen.fortuneCode,
      fortuneTitle: resolvedTitle,
      title: resolvedTitle,
      fortuneType: resolvedType,
      category: resolvedType,
      shortVerse: resolvedVerse,
      poem: resolvedVerse,
      interpretation: chosen.interpretation,
      advice: chosen.advice,
      spokenText,
      meritAwarded: this.settings.meritPoints,
      isDemo: Boolean(params.isDemo),
      createdAt: now,
      expiresAt: now + this.settings.resultDisplayDurationMs,
    };

    this.recordDrawLocally(result);

    // Persist idempotently on server so reconnects share the exact same fortune number
    if (typeof fetch !== 'undefined' && typeof window !== 'undefined') {
      void fetch('/api/xinxam/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventDedupeKey: result.eventDedupeKey,
          userId: result.userId,
          username: result.username,
          nickname: result.nickname,
          avatarUrl: result.avatarUrl,
          isDemo: result.isDemo,
          forcedFortuneNumber: result.fortuneNumber,
        }),
      }).catch(() => {});
    }

    return { ...result };
  }

  public getStoredDrawByKey(eventDedupeKey: string): XinXamDrawResult | undefined {
    return this.drawByDedupeKey.get(eventDedupeKey);
  }

  public async refreshFromServer(): Promise<void> {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/xinxam');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok) {
        if (data.settings) {
          this.settings = {
            ...DEFAULT_XIN_XAM_SETTINGS,
            ...data.settings,
            giftId: normalizeGiftId(data.settings.giftId),
          };
        }
        if (Array.isArray(data.fortunes) && data.fortunes.length > 0) {
          this.fortunes = data.fortunes.map((f: FortuneRecord) => normalizeFortuneRecord(f));
        }
        if (Array.isArray(data.recentDraws)) {
          this.recentDraws = data.recentDraws;
          for (const d of data.recentDraws) {
            if (d?.eventDedupeKey) {
              this.drawByDedupeKey.set(d.eventDedupeKey, d);
            }
          }
        }
        this.syncedWithServer = true;
        this.persistLocalCache();
        this.notify();
      }
    } catch {
      // Remain operational offline
    }
  }

  public async saveSettings(patch: Partial<XinXamSettings>): Promise<XinXamSettings> {
    this.setSettingsLocal(patch);
    if (typeof fetch === 'undefined') return this.getSettings();
    const res = await fetch('/api/xinxam/settings', {
      method: 'PUT',
      headers: this.buildHeaders(),
      body: JSON.stringify(this.settings),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể lưu cấu hình Xin Xăm.');
    }
    if (data.settings) {
      this.settings = data.settings;
      this.persistLocalCache();
      this.notify();
    }
    return { ...this.settings };
  }

  public async createFortune(payload: {
    fortuneNumber: number;
    title: string;
    category: FortuneCategory;
    poem: string;
    interpretation: string;
    advice: string;
    voiceText?: string;
    enabled?: boolean;
  }): Promise<FortuneRecord> {
    const res = await fetch('/api/xinxam/fortunes', {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể thêm quẻ xăm mới.');
    }
    if (Array.isArray(data.fortunes)) {
      this.fortunes = data.fortunes;
      this.persistLocalCache();
      this.notify();
    }
    return data.fortune as FortuneRecord;
  }

  public async updateFortune(
    fortuneId: string,
    payload: Partial<FortuneRecord>,
  ): Promise<FortuneRecord> {
    const res = await fetch(`/api/xinxam/fortunes/${encodeURIComponent(fortuneId)}`, {
      method: 'PUT',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể cập nhật quẻ xăm.');
    }
    if (Array.isArray(data.fortunes)) {
      this.fortunes = data.fortunes;
      this.persistLocalCache();
      this.notify();
    }
    return data.fortune as FortuneRecord;
  }

  public async deleteFortune(fortuneId: string): Promise<void> {
    const res = await fetch(`/api/xinxam/fortunes/${encodeURIComponent(fortuneId)}`, {
      method: 'DELETE',
      headers: this.buildHeaders(false),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể xóa quẻ xăm.');
    }
    if (Array.isArray(data.fortunes)) {
      this.fortunes = data.fortunes;
      this.persistLocalCache();
      this.notify();
    }
  }

  public async resetDefaultFortunes(): Promise<void> {
    const res = await fetch('/api/xinxam/reset', {
      method: 'POST',
      headers: this.buildHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể khôi phục 100 quẻ xăm mặc định.');
    }
    if (Array.isArray(data.fortunes)) {
      this.fortunes = data.fortunes;
      this.persistLocalCache();
      this.notify();
    }
  }

  public async importJson(
    parsedJson: unknown,
    mode: 'merge' | 'replace' = 'merge',
  ): Promise<{ importedCount: number }> {
    const res = await fetch('/api/xinxam/import', {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ mode, payload: parsedJson }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Nhập tệp JSON quẻ xăm thất bại.');
    }
    if (Array.isArray(data.fortunes)) {
      this.fortunes = data.fortunes;
    }
    if (data.settings) {
      this.settings = data.settings;
    }
    this.persistLocalCache();
    this.notify();
    return { importedCount: Number(data.importedCount || 0) };
  }

  public buildExportJsonString(): string {
    return JSON.stringify(
      {
        version: 1,
        app: 'CHÙA ONLINE - 100 QUẺ XIN XĂM CẦU NGUYỆN',
        exportedAt: new Date().toISOString(),
        settings: this.settings,
        fortunes: this.fortunes,
      },
      null,
      2,
    );
  }
}

export const xinXamRegistry = new XinXamRegistry();
