import {
  DEFAULT_GIFT_ACTION_PRESETS,
  DEFAULT_GIFT_MAPPINGS,
  GiftActionPreset,
  GiftMapping,
  UnknownGiftRecord,
  normalizeGiftId,
} from '../types/temple';
import { liveConnectionManager } from './LiveConnectionManager';

export interface GiftStorageStatus {
  engine: string;
  sqliteFile: string;
  isCloudPreview: boolean;
  durabilityNoteVi: string;
}

export interface GiftRegistrySnapshot {
  gifts: GiftMapping[];
  presets: GiftActionPreset[];
  unknownGifts: UnknownGiftRecord[];
  storage: GiftStorageStatus;
  authRequired: boolean;
  adminTokenConfigured: boolean;
  syncedWithServer: boolean;
}

type RegistrySubscriber = (snapshot: GiftRegistrySnapshot) => void;

const LOCAL_CACHE_KEY = 'chua_online_gift_registry_v1';
const ADMIN_TOKEN_SESSION_KEY = 'chua_online_admin_token_v1';

export class GiftRegistry {
  private gifts: GiftMapping[] = DEFAULT_GIFT_MAPPINGS.map((g) => ({ ...g }));
  private giftById = new Map<string, GiftMapping>();
  private presets: GiftActionPreset[] = DEFAULT_GIFT_ACTION_PRESETS.map((p) => ({ ...p }));
  private unknownGifts: UnknownGiftRecord[] = [];
  private storage: GiftStorageStatus = {
    engine: 'sqlite',
    sqliteFile: 'data/temple_gifts.sqlite',
    isCloudPreview: true,
    durabilityNoteVi:
      'Đang lưu trữ trong cơ sở dữ liệu SQLite máy chủ. Hãy dùng Xuất JSON để sao lưu cấu hình lâu dài.',
  };
  private authRequired = false;
  private adminToken = '';
  private syncedWithServer = false;
  private initialized = false;

  private subscribers = new Set<RegistrySubscriber>();

  constructor() {
    this.loadLocalCache();
    this.rebuildIndex();
  }

  private loadLocalCache(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const savedToken = window.sessionStorage?.getItem(ADMIN_TOKEN_SESSION_KEY);
      if (savedToken) {
        this.adminToken = savedToken;
      }

      const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.gifts) && parsed.gifts.length > 0) {
        this.gifts = parsed.gifts.map((g: GiftMapping) => ({
          ...g,
          giftId: normalizeGiftId(g.giftId),
        }));
      }
      if (Array.isArray(parsed?.presets) && parsed.presets.length > 0) {
        this.presets = parsed.presets;
      }
      if (Array.isArray(parsed?.unknownGifts)) {
        this.unknownGifts = parsed.unknownGifts;
      }
    } catch {
      // Ignore corrupt localStorage cache
    }
  }

  private persistLocalCache(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        LOCAL_CACHE_KEY,
        JSON.stringify({
          updatedAt: Date.now(),
          gifts: this.gifts,
          presets: this.presets,
          unknownGifts: this.unknownGifts,
        }),
      );
    } catch {
      // Ignore quota errors
    }
  }

  private rebuildIndex(): void {
    this.giftById.clear();
    for (const g of this.gifts) {
      const gid = normalizeGiftId(g.giftId);
      if (gid) {
        this.giftById.set(gid, g);
      }
    }
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const sub of this.subscribers) {
      sub(snap);
    }
  }

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    liveConnectionManager.onGiftsUpdated(({ gifts, presets }) => {
      if (Array.isArray(gifts)) {
        this.gifts = gifts.map((g) => ({ ...g, giftId: normalizeGiftId(g.giftId) }));
        this.rebuildIndex();
      }
      if (Array.isArray(presets)) {
        this.presets = presets;
      }
      this.syncedWithServer = true;
      this.persistLocalCache();
      this.notify();
    });

    liveConnectionManager.onUnknownGiftsUpdated(({ unknownGifts }) => {
      if (Array.isArray(unknownGifts)) {
        this.unknownGifts = unknownGifts;
        this.persistLocalCache();
        this.notify();
      }
    });

    void this.refreshFromServer();
  }

  public subscribe(cb: RegistrySubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public getSnapshot(): GiftRegistrySnapshot {
    return {
      gifts: this.gifts.map((g) => ({ ...g })),
      presets: this.presets.map((p) => ({ ...p })),
      unknownGifts: this.unknownGifts.map((u) => ({ ...u })),
      storage: { ...this.storage },
      authRequired: this.authRequired,
      adminTokenConfigured: Boolean(this.adminToken.trim()),
      syncedWithServer: this.syncedWithServer,
    };
  }

  public setAdminToken(token: string): void {
    this.adminToken = token.trim();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (this.adminToken) {
        window.sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, this.adminToken);
      } else {
        window.sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
      }
    }
    this.notify();
  }

  public getAdminToken(): string {
    return this.adminToken;
  }

  private buildHeaders(includeJsonContentType = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.adminToken) {
      headers['x-admin-token'] = this.adminToken;
    }
    return headers;
  }

  /**
   * Primary Lookup by Normalized TikTok Gift ID String ONLY.
   * Never guesses or matches solely by gift display name!
   */
  public getByGiftId(rawGiftId: unknown): GiftMapping | undefined {
    const gid = normalizeGiftId(rawGiftId);
    if (!gid) return undefined;
    return this.giftById.get(gid);
  }

  public getAllGifts(): GiftMapping[] {
    return this.gifts;
  }

  /**
   * Direct programmatic replacement (used for unit tests or immediate local sync)
   */
  public setGiftsLocal(nextGifts: GiftMapping[]): void {
    this.gifts = nextGifts.map((g) => ({ ...g, giftId: normalizeGiftId(g.giftId) }));
    this.rebuildIndex();
    this.persistLocalCache();
    this.notify();
  }

  public async refreshFromServer(): Promise<void> {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/gifts');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok) {
        if (Array.isArray(data.gifts)) {
          this.gifts = data.gifts.map((g: GiftMapping) => ({
            ...g,
            giftId: normalizeGiftId(g.giftId),
          }));
          this.rebuildIndex();
        }
        if (Array.isArray(data.presets)) {
          this.presets = data.presets;
        }
        if (Array.isArray(data.unknownGifts)) {
          this.unknownGifts = data.unknownGifts;
        }
        if (data.storage) {
          this.storage = data.storage;
        }
        this.authRequired = Boolean(data.authRequired);
        this.syncedWithServer = true;
        this.persistLocalCache();
        this.notify();
      }
    } catch {
      // Remain operational using local cache if offline
    }
  }

  public async createGift(payload: Partial<GiftMapping>): Promise<GiftMapping> {
    const gid = normalizeGiftId(payload.giftId);
    if (!gid) {
      throw new Error('TikTok Gift ID là bắt buộc.');
    }
    if (this.giftById.has(gid)) {
      throw new Error(`TikTok Gift ID "${gid}" đã tồn tại. Vui lòng nhập Gift ID duy nhất.`);
    }

    const res = await fetch('/api/gifts', {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể thêm quà tặng mới.');
    }

    if (Array.isArray(data.gifts)) {
      this.gifts = data.gifts;
      this.rebuildIndex();
    }
    if (Array.isArray(data.unknownGifts)) {
      this.unknownGifts = data.unknownGifts;
    }
    this.persistLocalCache();
    this.notify();
    return data.gift as GiftMapping;
  }

  public async updateGift(
    originalGiftId: string,
    payload: Partial<GiftMapping>,
  ): Promise<GiftMapping> {
    const cleanOrig = normalizeGiftId(originalGiftId);
    const res = await fetch(`/api/gifts/${encodeURIComponent(cleanOrig)}`, {
      method: 'PUT',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể lưu chỉnh sửa quà tặng.');
    }

    if (Array.isArray(data.gifts)) {
      this.gifts = data.gifts;
      this.rebuildIndex();
    }
    if (Array.isArray(data.unknownGifts)) {
      this.unknownGifts = data.unknownGifts;
    }
    this.persistLocalCache();
    this.notify();
    return data.gift as GiftMapping;
  }

  public async deleteGift(giftId: string): Promise<void> {
    const cleanId = normalizeGiftId(giftId);
    const res = await fetch(`/api/gifts/${encodeURIComponent(cleanId)}`, {
      method: 'DELETE',
      headers: this.buildHeaders(false),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể xóa quà tặng.');
    }
    if (Array.isArray(data.gifts)) {
      this.gifts = data.gifts;
      this.rebuildIndex();
      this.persistLocalCache();
      this.notify();
    }
  }

  public async resetDefaults(): Promise<void> {
    const res = await fetch('/api/gifts/reset', {
      method: 'POST',
      headers: this.buildHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể khôi phục mặc định.');
    }
    if (Array.isArray(data.gifts)) {
      this.gifts = data.gifts;
      this.rebuildIndex();
      this.persistLocalCache();
      this.notify();
    }
  }

  public async importJson(
    parsedJson: unknown,
    mode: 'merge' | 'replace' = 'merge',
  ): Promise<{ importedCount: number }> {
    const res = await fetch('/api/gifts/import', {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ mode, payload: parsedJson }),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Nhập cấu hình JSON thất bại.');
    }
    if (Array.isArray(data.gifts)) {
      this.gifts = data.gifts;
      this.rebuildIndex();
    }
    if (Array.isArray(data.presets)) {
      this.presets = data.presets;
    }
    if (Array.isArray(data.unknownGifts)) {
      this.unknownGifts = data.unknownGifts;
    }
    this.persistLocalCache();
    this.notify();
    return { importedCount: Number(data.importedCount || 0) };
  }

  public buildExportJsonString(): string {
    return JSON.stringify(
      {
        version: 1,
        app: 'CHÙA ONLINE',
        exportedAt: new Date().toISOString(),
        gifts: this.gifts,
        presets: this.presets.filter((p) => !p.isBuiltin),
      },
      null,
      2,
    );
  }

  public async savePreset(payload: Partial<GiftActionPreset>): Promise<GiftActionPreset> {
    const res = await fetch('/api/gifts/presets', {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể lưu bộ mẫu hành động.');
    }
    if (Array.isArray(data.presets)) {
      this.presets = data.presets;
      this.persistLocalCache();
      this.notify();
    }
    return data.preset as GiftActionPreset;
  }

  public async deletePreset(presetId: string): Promise<void> {
    const res = await fetch(`/api/gifts/presets/${encodeURIComponent(presetId)}`, {
      method: 'DELETE',
      headers: this.buildHeaders(false),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Không thể xóa bộ mẫu.');
    }
    if (Array.isArray(data.presets)) {
      this.presets = data.presets;
      this.persistLocalCache();
      this.notify();
    }
  }

  /**
   * Logs an unmapped Gift ID into "QUÀ CHƯA CẤU HÌNH" both locally and on the SQLite server.
   */
  public reportUnknownGift(params: {
    giftId: unknown;
    giftName?: string;
    iconUrl?: string;
    diamondCount?: number;
    countDelta?: number;
    username?: string;
    isDemo?: boolean;
  }): void {
    const gid = normalizeGiftId(params.giftId);
    if (!gid || this.giftById.has(gid)) return;

    const now = Date.now();
    const delta = Math.max(1, Math.round(Number(params.countDelta || 1)));
    const idx = this.unknownGifts.findIndex((u) => u.giftId === gid);
    if (idx !== -1) {
      this.unknownGifts[idx] = {
        ...this.unknownGifts[idx],
        giftName: params.giftName || this.unknownGifts[idx].giftName,
        iconUrl: params.iconUrl || this.unknownGifts[idx].iconUrl,
        diamondCount: params.diamondCount ?? this.unknownGifts[idx].diamondCount,
        occurrenceCount: this.unknownGifts[idx].occurrenceCount + delta,
        lastSeenAt: now,
        sampleUsername: params.username || this.unknownGifts[idx].sampleUsername,
        isDemo: Boolean(params.isDemo),
      };
    } else {
      this.unknownGifts.unshift({
        giftId: gid,
        giftName: params.giftName || `Gift #${gid}`,
        iconUrl: params.iconUrl,
        diamondCount: Math.max(0, Math.round(Number(params.diamondCount || 1))),
        occurrenceCount: delta,
        lastSeenAt: now,
        sampleUsername: params.username || 'phattu',
        isDemo: Boolean(params.isDemo),
      });
    }
    this.persistLocalCache();
    this.notify();

    // Sync to server if called from direct client/demo event
    if (typeof fetch !== 'undefined' && typeof window !== 'undefined') {
      void fetch('/api/gifts/unknown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).catch(() => {});
    }
  }

  public async clearUnknownGifts(): Promise<void> {
    this.unknownGifts = [];
    this.persistLocalCache();
    this.notify();

    if (typeof fetch !== 'undefined') {
      const res = await fetch('/api/gifts/unknown', {
        method: 'DELETE',
        headers: this.buildHeaders(false),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Không thể xóa danh sách quà chưa cấu hình.');
      }
    }
  }
}

export const giftRegistry = new GiftRegistry();
