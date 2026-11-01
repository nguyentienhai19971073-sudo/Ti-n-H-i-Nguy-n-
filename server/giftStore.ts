import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import type { Request } from 'express';
import {
  AnnouncementPriority,
  CHARACTER_ANIMATION_OPTIONS,
  DEFAULT_GIFT_ACTION_PRESETS,
  DEFAULT_GIFT_MAPPINGS,
  DEFAULT_GIFT_THANK_YOU_TEMPLATE,
  GiftActionPreset,
  GiftCharacterAnimType,
  GiftEffectType,
  GiftIconType,
  GiftMapping,
  GiftSoundEffectType,
  RITUAL_ACTION_OPTIONS,
  RitualActionType,
  SOUND_EFFECT_OPTIONS,
  UnknownGiftRecord,
  VISUAL_EFFECT_OPTIONS,
  inferCanonicalCeremonialDefaults,
  isLegacyGiftWordTemplate,
  normalizeCeremonialGiftMapping,
  normalizeGiftId,
  sanitizeCeremonialText,
} from '../src/types/temple.ts';

const requireModule = createRequire(import.meta.url);

export class GiftValidationError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'GiftValidationError';
    this.statusCode = statusCode;
  }
}

const VALID_RITUALS = new Set<string>([
  ...RITUAL_ACTION_OPTIONS.map((o) => o.value),
  'altar_pagoda',
  'altar_lantern',
  'seat_wooden_fish',
  'seat_prayer',
]);

const VALID_CHAR_ANIMS = new Set<string>(CHARACTER_ANIMATION_OPTIONS.map((o) => o.value));
const VALID_EFFECTS = new Set<string>(VISUAL_EFFECT_OPTIONS.map((o) => o.value));
const VALID_SOUNDS = new Set<string>(SOUND_EFFECT_OPTIONS.map((o) => o.value));
const VALID_ICONS = new Set<string>([
  'rose',
  'bell',
  'fruit',
  'lotus',
  'pagoda',
  'incense',
  'prayer',
  'wooden_fish',
  'light',
]);

function sanitizeSafeText(raw: unknown, maxLen: number, fallback = ''): string {
  if (raw === null || raw === undefined) return fallback;
  const cleaned = String(raw)
    .normalize('NFC')
    .replace(/<\s*\/?\s*script[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return cleaned || fallback;
}

function validateSafeIconUrl(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 12 && !/[<>'"`]/.test(trimmed)) {
    // Allow short Unicode emoji (e.g., 🪷, 🌹, 🔔)
    return trimmed;
  }
  if (trimmed.length > 2048) {
    throw new GiftValidationError('URL biểu tượng quá dài (tối đa 2048 ký tự).');
  }
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('/') ||
    /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml)[;,]/i.test(trimmed)
  ) {
    return trimmed;
  }
  throw new GiftValidationError(
    'URL biểu tượng phải bắt đầu bằng https://, http://, /, data:image/ hoặc là ký tự emoji.',
  );
}

function validateUploadedImage(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 360_000) {
    throw new GiftValidationError('Ảnh tải lên vượt quá giới hạn 250KB. Vui lòng chọn ảnh nhẹ hơn.');
  }
  if (!/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);(base64|utf8),/i.test(trimmed)) {
    throw new GiftValidationError('Định dạng ảnh tải lên không hợp lệ (chỉ hỗ trợ PNG, JPG, WEBP, GIF, SVG).');
  }
  return trimmed;
}

export function validateGiftMappingPayload(
  raw: Record<string, any>,
  existingFallback?: GiftMapping,
): GiftMapping {
  if (!raw || typeof raw !== 'object') {
    throw new GiftValidationError('Dữ liệu cấu hình quà tặng không hợp lệ.');
  }

  const giftId = normalizeGiftId(raw.giftId ?? existingFallback?.giftId);
  if (!giftId) {
    throw new GiftValidationError('TikTok Gift ID là bắt buộc (không được để trống).');
  }
  if (giftId.length > 64 || /[\s<>'"`\\]/.test(giftId)) {
    throw new GiftValidationError(
      'TikTok Gift ID chỉ được chứa ký tự chữ/số/gạch nối (tối đa 64 ký tự, không khoảng trắng).',
    );
  }

  const vietnameseLabel = sanitizeSafeText(
    raw.vietnameseLabel ?? raw.displayNameVi ?? existingFallback?.vietnameseLabel,
    60,
    '',
  );
  if (!vietnameseLabel) {
    throw new GiftValidationError('Vui lòng nhập Tên hiển thị Tiếng Việt cho quà tặng.');
  }

  const giftName = sanitizeSafeText(
    raw.giftName ?? raw.tiktokGiftName ?? existingFallback?.giftName,
    60,
    vietnameseLabel,
  );

  const ceremonyTitle = sanitizeCeremonialText(
    sanitizeSafeText(
      raw.ceremonyTitle ?? raw.ritualTitle ?? existingFallback?.ceremonyTitle,
      48,
      'CẦU BÌNH AN',
    ),
    'CẦU BÌNH AN',
  );

  const badgeCeremonyLabel = sanitizeCeremonialText(
    sanitizeSafeText(
      raw.badgeCeremonyLabel ?? existingFallback?.badgeCeremonyLabel,
      56,
      ceremonyTitle,
    ),
    ceremonyTitle,
  );

  const rawCoins = Number(raw.referenceCoins ?? raw.coinValue ?? existingFallback?.referenceCoins ?? 1);
  if (!Number.isFinite(rawCoins) || rawCoins < 0 || rawCoins > 1_000_000) {
    throw new GiftValidationError('Mệnh giá Xu tham chiếu phải nằm trong khoảng 0 đến 1.000.000.');
  }
  const referenceCoins = Math.round(rawCoins);

  const rawPoints = Number(raw.points ?? raw.meritPoints ?? existingFallback?.points ?? 50);
  if (!Number.isFinite(rawPoints) || rawPoints < 0 || rawPoints > 1_000_000) {
    throw new GiftValidationError('Điểm công đức phải nằm trong khoảng 0 đến 1.000.000.');
  }
  const points = Math.round(rawPoints);

  const rawRitual = String(raw.ritualType ?? raw.ritualAction ?? existingFallback?.ritualType ?? 'altar_flower');
  if (!VALID_RITUALS.has(rawRitual)) {
    throw new GiftValidationError(`Hành động nghi lễ không hợp lệ: ${rawRitual}`);
  }
  const ritualType = rawRitual as RitualActionType;

  const defaultCharAnim: GiftCharacterAnimType =
    ritualType === 'no_animation'
      ? 'none'
      : ritualType === 'altar_bell'
        ? 'walk_ring_bell'
        : ritualType === 'altar_wooden_fish'
          ? 'walk_wooden_fish'
          : ritualType === 'altar_grand_ceremony' || ritualType === 'altar_pagoda'
            ? 'walk_prostrate_3'
            : ritualType === 'altar_pray_clasped'
              ? 'walk_kneel_pray'
              : 'walk_offer_bow';

  const rawCharAnim = String(
    raw.characterAnimation ?? existingFallback?.characterAnimation ?? defaultCharAnim,
  );
  if (!VALID_CHAR_ANIMS.has(rawCharAnim)) {
    throw new GiftValidationError(`Chuyển động nhân vật không hợp lệ: ${rawCharAnim}`);
  }
  const characterAnimation =
    ritualType === 'no_animation' ? 'none' : (rawCharAnim as GiftCharacterAnimType);

  const rawEffect = String(raw.effect ?? raw.visualEffect ?? existingFallback?.effect ?? 'lotus_petals');
  if (!VALID_EFFECTS.has(rawEffect)) {
    throw new GiftValidationError(`Hiệu ứng hình ảnh không hợp lệ: ${rawEffect}`);
  }
  const effect = rawEffect as GiftEffectType;

  const rawSound = String(
    raw.soundEffect ?? existingFallback?.soundEffect ?? 'offering_chime',
  );
  if (!VALID_SOUNDS.has(rawSound)) {
    throw new GiftValidationError(`Hiệu ứng âm thanh không hợp lệ: ${rawSound}`);
  }
  const soundEffect = rawSound as GiftSoundEffectType;

  const rawIconType = String(raw.iconType ?? existingFallback?.iconType ?? 'lotus');
  const iconType: GiftIconType = VALID_ICONS.has(rawIconType)
    ? (rawIconType as GiftIconType)
    : 'lotus';

  const iconUrl =
    raw.iconUrl !== undefined
      ? validateSafeIconUrl(raw.iconUrl)
      : existingFallback?.iconUrl;

  const uploadedImageData =
    raw.uploadedImageData !== undefined
      ? validateUploadedImage(raw.uploadedImageData)
      : existingFallback?.uploadedImageData;

  const rawVoicePriority = Number(
    raw.voicePriority ??
      existingFallback?.voicePriority ??
      (points >= 500 ? AnnouncementPriority.LARGE_GIFT : AnnouncementPriority.NORMAL_GIFT),
  );
  const voicePriority: AnnouncementPriority =
    rawVoicePriority === AnnouncementPriority.LARGE_GIFT ||
    rawVoicePriority === AnnouncementPriority.NORMAL_GIFT ||
    rawVoicePriority === AnnouncementPriority.SPECIAL_RITUAL
      ? rawVoicePriority
      : AnnouncementPriority.NORMAL_GIFT;

  const rawDuration = Number(
    raw.animationDurationSec ?? existingFallback?.animationDurationSec ?? 4.5,
  );
  if (!Number.isFinite(rawDuration) || rawDuration < 1 || rawDuration > 25) {
    throw new GiftValidationError('Thời lượng hành lễ phải nằm trong khoảng 1 đến 25 giây.');
  }
  const animationDurationSec = Math.round(rawDuration * 10) / 10;

  const rawCooldown = Number(raw.cooldownSec ?? existingFallback?.cooldownSec ?? 1.2);
  if (!Number.isFinite(rawCooldown) || rawCooldown < 0 || rawCooldown > 300) {
    throw new GiftValidationError('Thời gian hồi (Cooldown) phải nằm trong khoảng 0 đến 300 giây.');
  }
  const cooldownSec = Math.round(rawCooldown * 10) / 10;

  const isLarge =
    raw.isLarge !== undefined
      ? Boolean(raw.isLarge)
      : voicePriority === AnnouncementPriority.LARGE_GIFT ||
        ritualType === 'altar_grand_ceremony' ||
        ritualType === 'altar_pagoda' ||
        points >= 500;

  const ceremonialDefaults = inferCanonicalCeremonialDefaults({
    giftId,
    ritualType,
    ceremonyTitle,
    isLarge,
  });

  const ritualTitle = sanitizeCeremonialText(
    sanitizeSafeText(
      raw.ritualTitle ?? raw.ceremonyTitle ?? existingFallback?.ritualTitle ?? existingFallback?.ceremonyTitle,
      48,
      ceremonialDefaults.ritualTitle,
    ),
    ceremonialDefaults.ritualTitle,
  );

  const rawSubtitleCandidate = sanitizeSafeText(
    raw.ritualSubtitle ?? existingFallback?.ritualSubtitle,
    180,
    '',
  );
  const ritualSubtitle =
    rawSubtitleCandidate && !isLegacyGiftWordTemplate(rawSubtitleCandidate)
      ? sanitizeCeremonialText(rawSubtitleCandidate, ceremonialDefaults.ritualSubtitle)
      : ceremonialDefaults.ritualSubtitle;

  const rawVoiceCandidate = sanitizeSafeText(
    raw.voiceTemplate ?? raw.ttsTemplate ?? existingFallback?.voiceTemplate ?? existingFallback?.ttsTemplate,
    360,
    '',
  );
  const voiceTemplate =
    rawVoiceCandidate && !isLegacyGiftWordTemplate(rawVoiceCandidate)
      ? sanitizeCeremonialText(rawVoiceCandidate, ceremonialDefaults.voiceTemplate)
      : ceremonialDefaults.voiceTemplate;

  const rawQueuePrio = Number(
    raw.queuePriority ?? existingFallback?.queuePriority ?? ceremonialDefaults.queuePriority,
  );
  const queuePriority = Number.isFinite(rawQueuePrio)
    ? Math.max(1, Math.min(100, Math.round(rawQueuePrio)))
    : ceremonialDefaults.queuePriority;

  const enabled =
    raw.enabled !== undefined ? Boolean(raw.enabled) : (existingFallback?.enabled ?? true);

  const showInOverlayPanel =
    raw.showInOverlayPanel !== undefined
      ? Boolean(raw.showInOverlayPanel)
      : (existingFallback?.showInOverlayPanel ?? true);

  const stableId = sanitizeSafeText(
    existingFallback?.id || raw.id || `gift_${giftId}`,
    72,
    `gift_${giftId}`,
  );

  return {
    id: stableId,
    giftId,
    giftName,
    vietnameseLabel,
    ceremonyTitle: ritualTitle,
    ritualTitle,
    ritualSubtitle,
    badgeCeremonyLabel,
    iconType,
    iconUrl,
    uploadedImageData,
    referenceCoins,
    points,
    isLarge,
    ritualType,
    characterAnimation,
    effect,
    soundEffect,
    ttsTemplate: voiceTemplate,
    voiceTemplate,
    voicePriority,
    queuePriority,
    animationDurationSec,
    cooldownSec,
    enabled,
    showInOverlayPanel,
    animation: isLarge ? 'gift_blessing' : 'offering',
    updatedAt: Date.now(),
  };
}

export function validatePresetPayload(raw: Record<string, any>): GiftActionPreset {
  if (!raw || typeof raw !== 'object') {
    throw new GiftValidationError('Dữ liệu bộ mẫu hành động không hợp lệ.');
  }
  const name = sanitizeSafeText(raw.name, 64, '');
  if (!name) {
    throw new GiftValidationError('Vui lòng nhập tên cho bộ mẫu hành động.');
  }
  const description = sanitizeSafeText(raw.description, 160, 'Bộ mẫu hành động tùy chỉnh');

  const rawRitual = String(raw.ritualType ?? 'altar_flower');
  if (!VALID_RITUALS.has(rawRitual)) {
    throw new GiftValidationError(`Hành động nghi lễ không hợp lệ: ${rawRitual}`);
  }
  const rawCharAnim = String(raw.characterAnimation ?? 'walk_offer_bow');
  if (!VALID_CHAR_ANIMS.has(rawCharAnim)) {
    throw new GiftValidationError(`Chuyển động nhân vật không hợp lệ: ${rawCharAnim}`);
  }
  const rawEffect = String(raw.effect ?? 'lotus_petals');
  if (!VALID_EFFECTS.has(rawEffect)) {
    throw new GiftValidationError(`Hiệu ứng hình ảnh không hợp lệ: ${rawEffect}`);
  }
  const rawSound = String(raw.soundEffect ?? 'offering_chime');
  if (!VALID_SOUNDS.has(rawSound)) {
    throw new GiftValidationError(`Hiệu ứng âm thanh không hợp lệ: ${rawSound}`);
  }

  const rawPrio = Number(raw.voicePriority ?? AnnouncementPriority.NORMAL_GIFT);
  const voicePriority: AnnouncementPriority =
    rawPrio === AnnouncementPriority.LARGE_GIFT ||
    rawPrio === AnnouncementPriority.NORMAL_GIFT ||
    rawPrio === AnnouncementPriority.SPECIAL_RITUAL
      ? rawPrio
      : AnnouncementPriority.NORMAL_GIFT;

  const animationDurationSec = Math.max(
    1,
    Math.min(25, Math.round(Number(raw.animationDurationSec || 4.5) * 10) / 10),
  );
  const cooldownSec = Math.max(
    0,
    Math.min(300, Math.round(Number(raw.cooldownSec ?? 1.5) * 10) / 10),
  );
  const ceremonialDefaults = inferCanonicalCeremonialDefaults({
    ritualType: rawRitual as RitualActionType,
    ceremonyTitle: raw.ritualTitle,
    isLarge: voicePriority === AnnouncementPriority.LARGE_GIFT,
  });

  const ritualTitle = sanitizeCeremonialText(
    sanitizeSafeText(raw.ritualTitle, 48, ceremonialDefaults.ritualTitle),
    ceremonialDefaults.ritualTitle,
  );
  const ritualSubtitle = sanitizeCeremonialText(
    sanitizeSafeText(raw.ritualSubtitle, 180, ceremonialDefaults.ritualSubtitle),
    ceremonialDefaults.ritualSubtitle,
  );

  const rawVoiceCandidate = sanitizeSafeText(
    raw.voiceTemplate ?? raw.ttsTemplate,
    360,
    DEFAULT_GIFT_THANK_YOU_TEMPLATE,
  );
  const voiceTemplate = isLegacyGiftWordTemplate(rawVoiceCandidate)
    ? ceremonialDefaults.voiceTemplate
    : sanitizeCeremonialText(rawVoiceCandidate, ceremonialDefaults.voiceTemplate);

  const rawQPrio = Number(raw.queuePriority ?? ceremonialDefaults.queuePriority);
  const queuePriority = Number.isFinite(rawQPrio)
    ? Math.max(1, Math.min(100, Math.round(rawQPrio)))
    : ceremonialDefaults.queuePriority;

  const presetId = sanitizeSafeText(
    raw.presetId,
    64,
    `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  );

  return {
    presetId,
    name,
    description,
    ritualTitle,
    ritualSubtitle,
    ritualType: rawRitual as RitualActionType,
    characterAnimation: rawCharAnim as GiftCharacterAnimType,
    effect: rawEffect as GiftEffectType,
    soundEffect: rawSound as GiftSoundEffectType,
    ttsTemplate: voiceTemplate,
    voiceTemplate,
    voicePriority,
    queuePriority,
    animationDurationSec,
    cooldownSec,
    isBuiltin: Boolean(raw.isBuiltin),
    updatedAt: Date.now(),
  };
}

interface SqliteDatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: any[]): any;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
}

interface BackupSnapshotFile {
  version: number;
  updatedAt: number;
  gifts: GiftMapping[];
  presets: GiftActionPreset[];
  unknownGifts: UnknownGiftRecord[];
}

export class PersistentGiftStore {
  private db: SqliteDatabaseLike | null = null;
  private storageEngine: 'sqlite' | 'atomic_json' = 'sqlite';
  private readonly dataDir: string;
  private readonly sqlitePath: string;
  private readonly jsonMirrorPath: string;

  // Fallback in-memory mirrors (always kept synced with SQLite or JSON)
  private memoryGifts: GiftMapping[] = [];
  private memoryPresets: GiftActionPreset[] = [];
  private memoryUnknowns: UnknownGiftRecord[] = [];

  constructor(customDataDir?: string) {
    this.dataDir = customDataDir || path.join(process.cwd(), 'data');
    this.sqlitePath = path.join(this.dataDir, 'temple_gifts.sqlite');
    this.jsonMirrorPath = path.join(this.dataDir, 'temple_gifts_backup.json');

    fs.mkdirSync(this.dataDir, { recursive: true });
    this.initStorage();
  }

  private initStorage(): void {
    try {
      const sqliteMod = requireModule('node:sqlite') as {
        DatabaseSync: new (filename: string) => SqliteDatabaseLike;
      };
      const db = new sqliteMod.DatabaseSync(this.sqlitePath);
      db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS store_meta (
          meta_key TEXT PRIMARY KEY,
          meta_value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS gift_mappings (
          gift_id TEXT PRIMARY KEY,
          sort_order INTEGER NOT NULL DEFAULT 0,
          enabled INTEGER NOT NULL DEFAULT 1,
          payload_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS gift_presets (
          preset_id TEXT PRIMARY KEY,
          is_builtin INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS unknown_gifts (
          gift_id TEXT PRIMARY KEY,
          gift_name TEXT NOT NULL,
          icon_url TEXT,
          diamond_count INTEGER NOT NULL DEFAULT 1,
          occurrence_count INTEGER NOT NULL DEFAULT 1,
          last_seen_at INTEGER NOT NULL,
          sample_username TEXT NOT NULL,
          is_demo INTEGER NOT NULL DEFAULT 0
        );
      `);
      this.db = db;
      this.storageEngine = 'sqlite';
      this.seedSqliteIfNeeded();
      this.syncMemoryFromSqlite();
      this.writeAtomicJsonMirror();
    } catch {
      this.db = null;
      this.storageEngine = 'atomic_json';
      this.loadFromJsonFallback();
    }
  }

  private seedSqliteIfNeeded(): void {
    if (!this.db) return;

    const seededGifts = this.db
      .prepare('SELECT meta_value FROM store_meta WHERE meta_key = ?')
      .get('seeded_gifts_v1');

    if (!seededGifts) {
      const existingCountRow = this.db
        .prepare('SELECT COUNT(*) as cnt FROM gift_mappings')
        .get() as { cnt?: number } | undefined;

      if (!existingCountRow || !existingCountRow.cnt) {
        const insertGift = this.db.prepare(
          'INSERT OR REPLACE INTO gift_mappings (gift_id, sort_order, enabled, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
        );
        const now = Date.now();
        DEFAULT_GIFT_MAPPINGS.forEach((gm, idx) => {
          const item = { ...gm, updatedAt: now };
          insertGift.run(item.giftId, idx, item.enabled ? 1 : 0, JSON.stringify(item), now);
        });
      }
      this.db
        .prepare('INSERT OR REPLACE INTO store_meta (meta_key, meta_value) VALUES (?, ?)')
        .run('seeded_gifts_v1', '1');
    }

    const seededPresets = this.db
      .prepare('SELECT meta_value FROM store_meta WHERE meta_key = ?')
      .get('seeded_presets_v1');

    if (!seededPresets) {
      const insertPreset = this.db.prepare(
        'INSERT OR REPLACE INTO gift_presets (preset_id, is_builtin, payload_json, updated_at) VALUES (?, ?, ?, ?)',
      );
      const now = Date.now();
      for (const preset of DEFAULT_GIFT_ACTION_PRESETS) {
        insertPreset.run(preset.presetId, preset.isBuiltin ? 1 : 0, JSON.stringify(preset), now);
      }
      this.db
        .prepare('INSERT OR REPLACE INTO store_meta (meta_key, meta_value) VALUES (?, ?)')
        .run('seeded_presets_v1', '1');
    }

    // One-time upgrade migration to pure ceremonial presentation (zero gift words)
    const migratedV2 = this.db
      .prepare('SELECT meta_value FROM store_meta WHERE meta_key = ?')
      .get('migrated_ceremonial_v2');
    if (!migratedV2) {
      const now = Date.now();
      const rows = this.db
        .prepare('SELECT gift_id, sort_order, enabled, payload_json FROM gift_mappings')
        .all();
      const updateStmt = this.db.prepare(
        'INSERT OR REPLACE INTO gift_mappings (gift_id, sort_order, enabled, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
      );
      for (const r of rows) {
        try {
          const parsed = JSON.parse(String(r.payload_json)) as GiftMapping;
          const normalized = normalizeCeremonialGiftMapping(parsed);
          updateStmt.run(
            normalized.giftId,
            Number(r.sort_order ?? 0),
            normalized.enabled ? 1 : 0,
            JSON.stringify(normalized),
            now,
          );
        } catch {
          // Ignore malformed row
        }
      }

      const insertPreset = this.db.prepare(
        'INSERT OR REPLACE INTO gift_presets (preset_id, is_builtin, payload_json, updated_at) VALUES (?, ?, ?, ?)',
      );
      for (const preset of DEFAULT_GIFT_ACTION_PRESETS) {
        insertPreset.run(preset.presetId, preset.isBuiltin ? 1 : 0, JSON.stringify(preset), now);
      }

      this.db
        .prepare('INSERT OR REPLACE INTO store_meta (meta_key, meta_value) VALUES (?, ?)')
        .run('migrated_ceremonial_v2', '1');
    }
  }

  private syncMemoryFromSqlite(): void {
    if (!this.db) return;

    const giftRows = this.db
      .prepare('SELECT payload_json FROM gift_mappings ORDER BY sort_order ASC, updated_at ASC')
      .all();
    this.memoryGifts = giftRows
      .map((r) => {
        try {
          return normalizeCeremonialGiftMapping(JSON.parse(String(r.payload_json)) as GiftMapping);
        } catch {
          return null;
        }
      })
      .filter((x): x is GiftMapping => x !== null);

    const presetRows = this.db
      .prepare('SELECT payload_json FROM gift_presets ORDER BY is_builtin DESC, updated_at ASC')
      .all();
    this.memoryPresets = presetRows
      .map((r) => {
        try {
          return JSON.parse(String(r.payload_json)) as GiftActionPreset;
        } catch {
          return null;
        }
      })
      .filter((x): x is GiftActionPreset => x !== null);

    const unknownRows = this.db
      .prepare('SELECT * FROM unknown_gifts ORDER BY last_seen_at DESC LIMIT 80')
      .all();
    this.memoryUnknowns = unknownRows.map((r) => ({
      giftId: String(r.gift_id),
      giftName: String(r.gift_name),
      iconUrl: r.icon_url ? String(r.icon_url) : undefined,
      diamondCount: Number(r.diamond_count || 1),
      occurrenceCount: Number(r.occurrence_count || 1),
      lastSeenAt: Number(r.last_seen_at || Date.now()),
      sampleUsername: String(r.sample_username || 'phattu'),
      isDemo: Boolean(r.is_demo),
    }));
  }

  private loadFromJsonFallback(): void {
    if (fs.existsSync(this.jsonMirrorPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.jsonMirrorPath, 'utf8')) as Partial<BackupSnapshotFile>;
        this.memoryGifts = Array.isArray(parsed.gifts)
          ? parsed.gifts.map((g) => normalizeCeremonialGiftMapping(g))
          : [...DEFAULT_GIFT_MAPPINGS];
        this.memoryPresets = Array.isArray(parsed.presets)
          ? parsed.presets
          : [...DEFAULT_GIFT_ACTION_PRESETS];
        this.memoryUnknowns = Array.isArray(parsed.unknownGifts) ? parsed.unknownGifts : [];
        return;
      } catch {
        // Fall through to defaults
      }
    }
    this.memoryGifts = DEFAULT_GIFT_MAPPINGS.map((g) => ({ ...g, updatedAt: Date.now() }));
    this.memoryPresets = DEFAULT_GIFT_ACTION_PRESETS.map((p) => ({ ...p }));
    this.memoryUnknowns = [];
    this.writeAtomicJsonMirror();
  }

  private writeAtomicJsonMirror(): void {
    try {
      const payload: BackupSnapshotFile = {
        version: 1,
        updatedAt: Date.now(),
        gifts: this.memoryGifts,
        presets: this.memoryPresets,
        unknownGifts: this.memoryUnknowns,
      };
      const tmpPath = `${this.jsonMirrorPath}.tmp.${process.pid}`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.jsonMirrorPath);
    } catch {
      // Non-fatal mirror write failure
    }
  }

  public getStorageMetadata() {
    const isCloudPreview = Boolean(
      process.env.K_SERVICE ||
        process.env.CLOUD_RUN_JOB ||
        (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'),
    );
    return {
      engine: this.storageEngine,
      sqliteFile: 'data/temple_gifts.sqlite',
      isCloudPreview,
      durabilityNoteVi: isCloudPreview
        ? 'Đang lưu trữ trong cơ sở dữ liệu SQLite máy chủ (bền vững khi tải lại trang & khởi động lại tiến trình). Lưu ý: Môi trường xem trước đám mây có ổ đĩa tạm thời khi dựng lại container — hãy dùng nút Xuất JSON để sao lưu lâu dài.'
        : 'Đang lưu trữ bền vững trong cơ sở dữ liệu SQLite cục bộ (data/temple_gifts.sqlite) kèm bản sao JSON nguyên tử.',
    };
  }

  public listGifts(): GiftMapping[] {
    return this.memoryGifts.map((g) => ({ ...g }));
  }

  public getGiftById(rawGiftId: unknown): GiftMapping | undefined {
    const gid = normalizeGiftId(rawGiftId);
    if (!gid) return undefined;
    return this.memoryGifts.find((g) => g.giftId === gid);
  }

  public listPresets(): GiftActionPreset[] {
    return this.memoryPresets.map((p) => ({ ...p }));
  }

  public listUnknownGifts(): UnknownGiftRecord[] {
    return this.memoryUnknowns.map((u) => ({ ...u }));
  }

  public createGift(rawPayload: Record<string, any>): GiftMapping {
    const validated = validateGiftMappingPayload(rawPayload);
    if (this.memoryGifts.some((g) => g.giftId === validated.giftId)) {
      throw new GiftValidationError(
        `TikTok Gift ID "${validated.giftId}" đã tồn tại. Mỗi quà tặng phải có Gift ID duy nhất.`,
        409,
      );
    }

    const sortOrder = this.memoryGifts.length;
    if (this.db) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db
          .prepare(
            'INSERT INTO gift_mappings (gift_id, sort_order, enabled, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
          )
          .run(
            validated.giftId,
            sortOrder,
            validated.enabled ? 1 : 0,
            JSON.stringify(validated),
            validated.updatedAt || Date.now(),
          );
        // Automatically clear from unknown_gifts if it was previously logged there!
        this.db.prepare('DELETE FROM unknown_gifts WHERE gift_id = ?').run(validated.giftId);
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
      this.syncMemoryFromSqlite();
    } else {
      this.memoryGifts.push(validated);
      this.memoryUnknowns = this.memoryUnknowns.filter((u) => u.giftId !== validated.giftId);
    }

    this.writeAtomicJsonMirror();
    return validated;
  }

  public updateGift(originalGiftIdRaw: string, rawPayload: Record<string, any>): GiftMapping {
    const originalGiftId = normalizeGiftId(originalGiftIdRaw);
    const existingIdx = this.memoryGifts.findIndex((g) => g.giftId === originalGiftId);
    if (existingIdx === -1) {
      throw new GiftValidationError(`Không tìm thấy quà tặng có Gift ID "${originalGiftId}".`, 404);
    }

    const existing = this.memoryGifts[existingIdx];
    const validated = validateGiftMappingPayload(rawPayload, existing);

    if (
      validated.giftId !== originalGiftId &&
      this.memoryGifts.some((g) => g.giftId === validated.giftId)
    ) {
      throw new GiftValidationError(
        `TikTok Gift ID mới "${validated.giftId}" đã trùng với một quà tặng khác.`,
        409,
      );
    }

    if (this.db) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        if (validated.giftId !== originalGiftId) {
          this.db.prepare('DELETE FROM gift_mappings WHERE gift_id = ?').run(originalGiftId);
        }
        this.db
          .prepare(
            'INSERT OR REPLACE INTO gift_mappings (gift_id, sort_order, enabled, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
          )
          .run(
            validated.giftId,
            existingIdx,
            validated.enabled ? 1 : 0,
            JSON.stringify(validated),
            validated.updatedAt || Date.now(),
          );
        this.db.prepare('DELETE FROM unknown_gifts WHERE gift_id = ?').run(validated.giftId);
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
      this.syncMemoryFromSqlite();
    } else {
      this.memoryGifts[existingIdx] = validated;
      this.memoryUnknowns = this.memoryUnknowns.filter((u) => u.giftId !== validated.giftId);
    }

    this.writeAtomicJsonMirror();
    return validated;
  }

  public deleteGift(giftIdRaw: string): boolean {
    const giftId = normalizeGiftId(giftIdRaw);
    const exists = this.memoryGifts.some((g) => g.giftId === giftId);
    if (!exists) return false;

    if (this.db) {
      this.db.prepare('DELETE FROM gift_mappings WHERE gift_id = ?').run(giftId);
      this.syncMemoryFromSqlite();
    } else {
      this.memoryGifts = this.memoryGifts.filter((g) => g.giftId !== giftId);
    }

    this.writeAtomicJsonMirror();
    return true;
  }

  public resetToDefaultGifts(): GiftMapping[] {
    const now = Date.now();
    const defaults = DEFAULT_GIFT_MAPPINGS.map((g) => ({ ...g, updatedAt: now }));

    if (this.db) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.prepare('DELETE FROM gift_mappings').run();
        const ins = this.db.prepare(
          'INSERT INTO gift_mappings (gift_id, sort_order, enabled, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
        );
        defaults.forEach((item, idx) => {
          ins.run(item.giftId, idx, item.enabled ? 1 : 0, JSON.stringify(item), now);
        });
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
      this.syncMemoryFromSqlite();
    } else {
      this.memoryGifts = defaults;
    }

    this.writeAtomicJsonMirror();
    return this.listGifts();
  }

  public importGiftsBulk(
    rawInput: unknown,
    mode: 'merge' | 'replace' = 'merge',
  ): { gifts: GiftMapping[]; presets: GiftActionPreset[]; importedCount: number } {
    let rawGiftsList: any[] = [];
    let rawPresetsList: any[] = [];

    if (Array.isArray(rawInput)) {
      rawGiftsList = rawInput;
    } else if (rawInput && typeof rawInput === 'object') {
      const obj = rawInput as Record<string, any>;
      if (Array.isArray(obj.gifts)) {
        rawGiftsList = obj.gifts;
      } else if (Array.isArray(obj.giftMappings)) {
        rawGiftsList = obj.giftMappings;
      } else {
        throw new GiftValidationError('Tệp JSON phải chứa mảng "gifts" hoặc danh sách cấu hình quà.');
      }
      if (Array.isArray(obj.presets)) {
        rawPresetsList = obj.presets;
      }
    } else {
      throw new GiftValidationError('Nội dung JSON nhập vào không hợp lệ.');
    }

    if (rawGiftsList.length === 0) {
      throw new GiftValidationError('Danh sách quà tặng trong tệp JSON đang trống.');
    }
    if (rawGiftsList.length > 500) {
      throw new GiftValidationError('Tối đa 500 cấu hình quà tặng mỗi lần nhập.');
    }

    const seenIds = new Set<string>();
    const validatedGifts: GiftMapping[] = [];
    for (let i = 0; i < rawGiftsList.length; i++) {
      const v = validateGiftMappingPayload(rawGiftsList[i]);
      if (seenIds.has(v.giftId)) {
        throw new GiftValidationError(
          `Phát hiện Gift ID bị trùng lặp "${v.giftId}" tại dòng thứ ${i + 1} trong tệp JSON.`,
          409,
        );
      }
      seenIds.add(v.giftId);
      validatedGifts.push(v);
    }

    const validatedPresets: GiftActionPreset[] = rawPresetsList.map((p) => validatePresetPayload(p));

    if (this.db) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        if (mode === 'replace') {
          this.db.prepare('DELETE FROM gift_mappings').run();
        }
        const upsertGift = this.db.prepare(
          'INSERT OR REPLACE INTO gift_mappings (gift_id, sort_order, enabled, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
        );
        const baseSort = mode === 'replace' ? 0 : this.memoryGifts.length;
        const now = Date.now();
        validatedGifts.forEach((g, idx) => {
          upsertGift.run(g.giftId, baseSort + idx, g.enabled ? 1 : 0, JSON.stringify(g), now);
          this.db!.prepare('DELETE FROM unknown_gifts WHERE gift_id = ?').run(g.giftId);
        });

        if (validatedPresets.length > 0) {
          const upsertPreset = this.db.prepare(
            'INSERT OR REPLACE INTO gift_presets (preset_id, is_builtin, payload_json, updated_at) VALUES (?, ?, ?, ?)',
          );
          for (const pr of validatedPresets) {
            upsertPreset.run(pr.presetId, pr.isBuiltin ? 1 : 0, JSON.stringify(pr), now);
          }
        }
        this.db.exec('COMMIT');
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
      this.syncMemoryFromSqlite();
    } else {
      if (mode === 'replace') {
        this.memoryGifts = [...validatedGifts];
      } else {
        const byId = new Map(this.memoryGifts.map((g) => [g.giftId, g]));
        for (const g of validatedGifts) {
          byId.set(g.giftId, g);
        }
        this.memoryGifts = Array.from(byId.values());
      }
      if (validatedPresets.length > 0) {
        const pMap = new Map(this.memoryPresets.map((p) => [p.presetId, p]));
        for (const p of validatedPresets) {
          pMap.set(p.presetId, p);
        }
        this.memoryPresets = Array.from(pMap.values());
      }
    }

    this.writeAtomicJsonMirror();
    return {
      gifts: this.listGifts(),
      presets: this.listPresets(),
      importedCount: validatedGifts.length,
    };
  }

  public savePreset(rawPayload: Record<string, any>): GiftActionPreset {
    const validated = validatePresetPayload({ ...rawPayload, isBuiltin: false });
    if (this.db) {
      this.db
        .prepare(
          'INSERT OR REPLACE INTO gift_presets (preset_id, is_builtin, payload_json, updated_at) VALUES (?, 0, ?, ?)',
        )
        .run(validated.presetId, JSON.stringify(validated), validated.updatedAt);
      this.syncMemoryFromSqlite();
    } else {
      const idx = this.memoryPresets.findIndex((p) => p.presetId === validated.presetId);
      if (idx !== -1) this.memoryPresets[idx] = validated;
      else this.memoryPresets.push(validated);
    }
    this.writeAtomicJsonMirror();
    return validated;
  }

  public deletePreset(presetIdRaw: string): boolean {
    const presetId = String(presetIdRaw || '').trim();
    const target = this.memoryPresets.find((p) => p.presetId === presetId);
    if (!target || target.isBuiltin) return false;

    if (this.db) {
      this.db.prepare('DELETE FROM gift_presets WHERE preset_id = ? AND is_builtin = 0').run(presetId);
      this.syncMemoryFromSqlite();
    } else {
      this.memoryPresets = this.memoryPresets.filter((p) => p.presetId !== presetId);
    }
    this.writeAtomicJsonMirror();
    return true;
  }

  public recordUnknownGift(params: {
    giftId: unknown;
    giftName?: string;
    iconUrl?: string;
    diamondCount?: number;
    countDelta?: number;
    username?: string;
    isDemo?: boolean;
  }): UnknownGiftRecord | null {
    const giftId = normalizeGiftId(params.giftId);
    if (!giftId) return null;
    // Never log if already mapped!
    if (this.memoryGifts.some((g) => g.giftId === giftId)) {
      return null;
    }

    const now = Date.now();
    const giftName = sanitizeSafeText(params.giftName, 64, `Gift #${giftId}`);
    const diamondCount = Math.max(0, Math.round(Number(params.diamondCount || 1)));
    const delta = Math.max(1, Math.round(Number(params.countDelta || 1)));
    const sampleUsername = sanitizeSafeText(params.username, 40, 'phattu');
    const isDemo = Boolean(params.isDemo);
    let safeIcon: string | undefined;
    try {
      safeIcon = validateSafeIconUrl(params.iconUrl);
    } catch {
      safeIcon = undefined;
    }

    if (this.db) {
      const existing = this.db
        .prepare('SELECT occurrence_count, icon_url FROM unknown_gifts WHERE gift_id = ?')
        .get(giftId) as { occurrence_count?: number; icon_url?: string } | undefined;

      const nextCount = (existing?.occurrence_count || 0) + delta;
      const mergedIcon = safeIcon || existing?.icon_url || null;

      this.db
        .prepare(
          `INSERT OR REPLACE INTO unknown_gifts
           (gift_id, gift_name, icon_url, diamond_count, occurrence_count, last_seen_at, sample_username, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          giftId,
          giftName,
          mergedIcon,
          diamondCount,
          nextCount,
          now,
          sampleUsername,
          isDemo ? 1 : 0,
        );
      this.syncMemoryFromSqlite();
    } else {
      const idx = this.memoryUnknowns.findIndex((u) => u.giftId === giftId);
      if (idx !== -1) {
        this.memoryUnknowns[idx] = {
          ...this.memoryUnknowns[idx],
          giftName,
          iconUrl: safeIcon || this.memoryUnknowns[idx].iconUrl,
          diamondCount,
          occurrenceCount: this.memoryUnknowns[idx].occurrenceCount + delta,
          lastSeenAt: now,
          sampleUsername,
          isDemo,
        };
      } else {
        this.memoryUnknowns.unshift({
          giftId,
          giftName,
          iconUrl: safeIcon,
          diamondCount,
          occurrenceCount: delta,
          lastSeenAt: now,
          sampleUsername,
          isDemo,
        });
      }
    }

    this.writeAtomicJsonMirror();
    return this.memoryUnknowns.find((u) => u.giftId === giftId) || null;
  }

  public clearUnknownGifts(): void {
    if (this.db) {
      this.db.prepare('DELETE FROM unknown_gifts').run();
      this.syncMemoryFromSqlite();
    } else {
      this.memoryUnknowns = [];
    }
    this.writeAtomicJsonMirror();
  }
}

export function isAdminAuthRequired(): boolean {
  const secret = process.env.ADMIN_ACCESS_TOKEN?.trim();
  return Boolean(secret && secret.length > 0);
}

export function isAdminAuthorizedRequest(req: Request): boolean {
  const secret = process.env.ADMIN_ACCESS_TOKEN?.trim();
  if (!secret) return true; // Open in local/preview dev when ADMIN_ACCESS_TOKEN is unset

  const headerToken = String(req.headers['x-admin-token'] || '').trim();
  if (headerToken && headerToken === secret) return true;

  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer === secret) return true;
  }

  return false;
}

export const giftStore = new PersistentGiftStore();
