import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import {
  DEFAULT_XIN_XAM_SETTINGS,
  DEFAULT_XIN_XAM_VOICE_TEMPLATE,
  FORTUNE_CATEGORIES,
  FortuneCategory,
  FortuneRecord,
  LEGACY_V1_XIN_XAM_VOICE_TEMPLATE,
  XinXamDrawResult,
  XinXamSettings,
  formatFortuneCode,
  normalizeFortuneRecord,
  normalizeGiftId,
  renderXinXamVoiceText,
  sanitizeCeremonialText,
} from '../src/types/temple.ts';
import { DEFAULT_100_FORTUNES } from '../src/data/fortunes100.ts';

const requireModule = createRequire(import.meta.url);

export class FortuneValidationError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'FortuneValidationError';
    this.statusCode = statusCode;
  }
}

const VALID_CATEGORIES = new Set<string>(FORTUNE_CATEGORIES);

function cleanField(raw: unknown, maxLen: number, fallback = ''): string {
  if (raw === null || raw === undefined) return fallback;
  const cleaned = String(raw)
    .normalize('NFC')
    .replace(/<\s*\/?\s*script[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/nội\s*dung\s*xăm\s*minh\s*họa\s*mang\s*tính\s*tham\s*khảo\.?/giu, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
  return cleaned || fallback;
}

export function validateAndNormalizeFortune(
  raw: Record<string, unknown>,
  existing?: FortuneRecord,
): FortuneRecord {
  const rawNum = Number(raw.fortuneNumber ?? existing?.fortuneNumber ?? 0);
  if (!Number.isFinite(rawNum) || rawNum < 1 || rawNum > 999) {
    throw new FortuneValidationError('Số quẻ xăm phải là số nguyên từ 1 đến 999.');
  }
  const fortuneNumber = Math.round(rawNum);
  const fortuneCode = formatFortuneCode(fortuneNumber);

  const fortuneId = cleanField(
    raw.fortuneId ?? existing?.fortuneId ?? `xam_${fortuneCode}`,
    48,
    `xam_${fortuneCode}`,
  );

  const rawCat = cleanField(
    raw.fortuneType ?? raw.category ?? existing?.fortuneType ?? existing?.category,
    32,
    'Trung Cát',
  );
  if (!VALID_CATEGORIES.has(rawCat)) {
    throw new FortuneValidationError(
      `Phân loại quẻ không hợp lệ: "${rawCat}". Chọn Đại Cát, Trung Cát, Tiểu Cát, Bình hoặc Cần Thận Trọng.`,
    );
  }
  const category = rawCat as FortuneCategory;

  const title = sanitizeCeremonialText(
    cleanField(raw.fortuneTitle ?? raw.title ?? existing?.fortuneTitle ?? existing?.title, 64, ''),
    'Gia đạo an hòa',
  );
  if (!title) {
    throw new FortuneValidationError('Tiêu đề quẻ xăm là bắt buộc.');
  }

  const poem = cleanField(
    raw.shortVerse ?? raw.poem ?? existing?.shortVerse ?? existing?.poem,
    420,
    'Tâm thành lễ Phật sáng niềm tin,\nPhước lành hội tụ khắp gia đình.',
  );

  const rawInterp = cleanField(raw.interpretation ?? existing?.interpretation, 360, '');
  if (!rawInterp) {
    throw new FortuneValidationError('Lời giải của quẻ xăm là bắt buộc.');
  }
  const interpretation = sanitizeCeremonialText(
    rawInterp,
    'Tâm sáng lòng thành, giữ nếp thiện lành thì mọi việc thuận hòa.',
  );

  const advice = sanitizeCeremonialText(
    cleanField(
      raw.advice ?? existing?.advice,
      260,
      'Hãy giữ lòng từ bi và sống hòa thuận.',
    ),
    'Hãy giữ lòng từ bi và sống hòa thuận.',
  );

  const rawVoiceField =
    raw.voiceText !== undefined ? String(raw.voiceText) : (existing?.voiceText ?? '');
  const cleanedVoice = cleanField(rawVoiceField, 360, '');
  const voiceText =
    cleanedVoice && cleanedVoice !== interpretation
      ? sanitizeCeremonialText(cleanedVoice, '')
      : '';

  const enabled = raw.enabled !== undefined ? Boolean(raw.enabled) : (existing?.enabled ?? true);

  return normalizeFortuneRecord({
    fortuneId,
    fortuneNumber,
    fortuneCode,
    fortuneTitle: title,
    title,
    fortuneType: category,
    category,
    shortVerse: poem,
    poem,
    interpretation,
    advice,
    voiceText,
    enabled,
    updatedAt: Date.now(),
  });
}

export function normalizeXinXamSettings(
  raw: Partial<XinXamSettings> | Record<string, unknown>,
  existing: XinXamSettings = DEFAULT_XIN_XAM_SETTINGS,
): XinXamSettings {
  const giftId = normalizeGiftId(raw.giftId !== undefined ? raw.giftId : existing.giftId);
  if (giftId && !/^[a-zA-Z0-9_.:-]+$/.test(giftId)) {
    throw new FortuneValidationError(
      'TikTok Gift ID cho Xin Xăm chỉ được chứa chữ, số hoặc gạch ngang/gạch dưới.',
    );
  }

  const eventTitle = sanitizeCeremonialText(
    cleanField(raw.eventTitle ?? existing.eventTitle ?? 'XIN XĂM', 48, 'XIN XĂM'),
    'XIN XĂM',
  );
  const eventLabel = sanitizeCeremonialText(
    cleanField(raw.eventLabel ?? existing.eventLabel ?? 'Xin xăm cầu an', 64, 'Xin xăm cầu an'),
    'Xin xăm cầu an',
  );

  const referenceCoins = Math.max(
    0,
    Math.min(1_000_000, Math.round(Number(raw.referenceCoins ?? existing.referenceCoins ?? 20))),
  );
  const meritPoints = Math.max(
    0,
    Math.min(1_000_000, Math.round(Number(raw.meritPoints ?? existing.meritPoints ?? 200))),
  );
  const particleDensity = Math.max(
    0.3,
    Math.min(1.8, Number(raw.particleDensity ?? existing.particleDensity ?? 1.0)),
  );
  const animationDurationSec = Math.max(
    3.5,
    Math.min(18.0, Number(raw.animationDurationSec ?? existing.animationDurationSec ?? 6.2)),
  );
  const incomingSchema = Number(raw.schemaVersion ?? existing.schemaVersion ?? 2);
  const isUpgradingFromV2 = incomingSchema < 3 && raw.displayMode === undefined;

  const rawScale = Number(raw.panelScale ?? existing.panelScale ?? 1.0);
  const migratedScale = isUpgradingFromV2 && Math.abs(rawScale - 0.92) < 0.005 ? 1.0 : rawScale;
  const panelScale = Math.max(0.7, Math.min(1.25, migratedScale));

  const rawOpacity = Number(raw.panelOpacity ?? existing.panelOpacity ?? 0.55);
  const migratedOpacity =
    isUpgradingFromV2 && Math.abs(rawOpacity - 0.45) < 0.005 ? 0.55 : rawOpacity;
  const panelOpacity = Math.max(0.25, Math.min(0.88, migratedOpacity));

  const rawDuration = Number(
    raw.resultDisplayDurationMs ?? existing.resultDisplayDurationMs ?? 8000,
  );
  const migratedDuration =
    isUpgradingFromV2 && Math.abs(rawDuration - 6800) < 50 ? 8000 : rawDuration;
  const resultDisplayDurationMs = Math.max(3000, Math.min(15000, Math.round(migratedDuration)));

  const displayMode =
    (raw.displayMode ?? existing.displayMode) === 'detailed' ? 'detailed' : 'compact';

  const textScale = Math.max(
    0.8,
    Math.min(1.3, Number(raw.textScale ?? existing.textScale ?? 1.0)),
  );

  const rawTpl = cleanField(
    raw.voiceTemplate ?? existing.voiceTemplate,
    380,
    DEFAULT_XIN_XAM_VOICE_TEMPLATE,
  );
  const upgradedTpl =
    rawTpl === LEGACY_V1_XIN_XAM_VOICE_TEMPLATE ? DEFAULT_XIN_XAM_VOICE_TEMPLATE : rawTpl;
  const voiceTemplate = sanitizeCeremonialText(upgradedTpl, DEFAULT_XIN_XAM_VOICE_TEMPLATE);

  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : existing.enabled,
    eventTitle,
    eventLabel,
    giftId,
    referenceCoins,
    meritPoints,
    voiceTemplate,
    particleDensity: Math.round(particleDensity * 100) / 100,
    animationDurationSec: Math.round(animationDurationSec * 10) / 10,
    panelScale: Math.round(panelScale * 100) / 100,
    panelOpacity: Math.round(panelOpacity * 100) / 100,
    resultDisplayDurationMs,
    displayMode,
    textScale: Math.round(textScale * 100) / 100,
    schemaVersion: 3,
  };
}

export class FortuneStore {
  private readonly dataDir: string;
  private readonly sqlitePath: string;
  private readonly jsonBackupPath: string;
  private db: any = null;

  private fortunes: FortuneRecord[] = [];
  private settings: XinXamSettings = { ...DEFAULT_XIN_XAM_SETTINGS };
  private recentDraws: XinXamDrawResult[] = [];
  private drawsByDedupeKey = new Map<string, XinXamDrawResult>();

  constructor(baseDir = process.cwd()) {
    this.dataDir = path.join(baseDir, 'data');
    this.sqlitePath = path.join(this.dataDir, 'temple_gifts.sqlite');
    this.jsonBackupPath = path.join(this.dataDir, 'temple_xinxam_backup.json');
    this.initialize();
  }

  private initialize(): void {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
    } catch {
      // Ignore directory creation errors
    }

    try {
      const nodeSqlite = requireModule('node:sqlite');
      if (nodeSqlite?.DatabaseSync) {
        this.db = new nodeSqlite.DatabaseSync(this.sqlitePath);
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS fortune_sticks (
            fortune_id TEXT PRIMARY KEY,
            fortune_number INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          );
          CREATE TABLE IF NOT EXISTS xinxam_settings (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS xinxam_draws (
            event_dedupe_key TEXT PRIMARY KEY,
            draw_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            fortune_number INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );
        `);
      }
    } catch (err) {
      console.warn('[FortuneStore] Falling back to JSON mirror:', err);
      this.db = null;
    }

    this.loadOrSeed();
  }

  private loadOrSeed(): void {
    if (this.db) {
      const rows = this.db
        .prepare('SELECT payload_json FROM fortune_sticks ORDER BY fortune_number ASC')
        .all() as { payload_json: string }[];

      if (rows.length > 0) {
        const loaded: FortuneRecord[] = [];
        for (const r of rows) {
          try {
            loaded.push(validateAndNormalizeFortune(JSON.parse(r.payload_json)));
          } catch {
            // Skip malformed row
          }
        }
        this.fortunes = loaded.sort((a, b) => a.fortuneNumber - b.fortuneNumber);
      } else {
        this.fortunes = DEFAULT_100_FORTUNES.map((f) => ({ ...f }));
        this.persistAllFortunesToSqlite();
      }

      let loadedSchemaVersion = 2;
      const settingsRow = this.db
        .prepare('SELECT value_json FROM xinxam_settings WHERE key = ?')
        .get('config') as { value_json: string } | undefined;
      if (settingsRow?.value_json) {
        try {
          const rawParsed = JSON.parse(settingsRow.value_json) as Record<string, unknown>;
          loadedSchemaVersion = Number(rawParsed?.schemaVersion || 1);
          if (loadedSchemaVersion < 2) {
            this.settings = normalizeXinXamSettings({
              ...rawParsed,
              eventTitle: rawParsed.eventTitle || 'XIN XĂM',
              eventLabel: rawParsed.eventLabel || 'Xin xăm cầu an',
              panelOpacity: rawParsed.panelOpacity === 0.5 ? 0.45 : rawParsed.panelOpacity,
              voiceTemplate:
                !rawParsed.voiceTemplate ||
                rawParsed.voiceTemplate === LEGACY_V1_XIN_XAM_VOICE_TEMPLATE
                  ? DEFAULT_XIN_XAM_VOICE_TEMPLATE
                  : rawParsed.voiceTemplate,
              schemaVersion: 2,
            });
            this.persistSettingsToSqlite();
          } else {
            this.settings = normalizeXinXamSettings(rawParsed);
          }
        } catch {
          this.settings = { ...DEFAULT_XIN_XAM_SETTINGS };
        }
      } else {
        this.settings = { ...DEFAULT_XIN_XAM_SETTINGS };
        this.persistSettingsToSqlite();
      }

      // Auto-upgrade legacy v1 seed database (which lacked 'Tiểu Cát' and had old Fortune #18)
      const hasTieuCat = this.fortunes.some((f) => f.fortuneType === 'Tiểu Cát');
      if (loadedSchemaVersion < 2 || !hasTieuCat) {
        const defaultByNum = new Map<number, FortuneRecord>(
          DEFAULT_100_FORTUNES.map((d) => [d.fortuneNumber, d]),
        );
        this.fortunes = this.fortunes.map((existingCard) => {
          const v2Seed = defaultByNum.get(existingCard.fortuneNumber);
          if (!v2Seed) return existingCard;
          if (existingCard.fortuneNumber === 18 && existingCard.title === 'Thuận Buồm Xuôi Gió') {
            return { ...v2Seed, enabled: existingCard.enabled, updatedAt: Date.now() };
          }
          if (v2Seed.fortuneType === 'Tiểu Cát' && existingCard.fortuneType !== 'Tiểu Cát') {
            return normalizeFortuneRecord({
              ...existingCard,
              fortuneType: 'Tiểu Cát',
              category: 'Tiểu Cát',
              updatedAt: Date.now(),
            });
          }
          return existingCard;
        });
        this.persistAllFortunesToSqlite();
      }

      const drawRows = this.db
        .prepare('SELECT payload_json FROM xinxam_draws ORDER BY created_at DESC LIMIT 80')
        .all() as { payload_json: string }[];
      this.recentDraws = [];
      this.drawsByDedupeKey.clear();
      for (const dr of drawRows) {
        try {
          const parsed = JSON.parse(dr.payload_json) as XinXamDrawResult;
          if (parsed?.eventDedupeKey) {
            const hydrated: XinXamDrawResult = {
              ...parsed,
              fortuneTitle: parsed.fortuneTitle || parsed.title,
              fortuneType: parsed.fortuneType || parsed.category,
              shortVerse: parsed.shortVerse || parsed.poem,
            };
            this.recentDraws.push(hydrated);
            this.drawsByDedupeKey.set(hydrated.eventDedupeKey, hydrated);
          }
        } catch {
          // Ignore malformed row
        }
      }

      this.writeAtomicJsonBackup();
      return;
    }

    // JSON fallback if node:sqlite unavailable
    if (fs.existsSync(this.jsonBackupPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.jsonBackupPath, 'utf-8'));
        if (Array.isArray(parsed?.fortunes) && parsed.fortunes.length > 0) {
          this.fortunes = parsed.fortunes
            .map((f: Record<string, unknown>) => validateAndNormalizeFortune(f))
            .sort((a: FortuneRecord, b: FortuneRecord) => a.fortuneNumber - b.fortuneNumber);
        }
        if (parsed?.settings) {
          this.settings = normalizeXinXamSettings(parsed.settings);
        }
        if (Array.isArray(parsed?.recentDraws)) {
          this.recentDraws = parsed.recentDraws.slice(0, 60);
          for (const d of this.recentDraws) {
            if (d?.eventDedupeKey) {
              this.drawsByDedupeKey.set(d.eventDedupeKey, d);
            }
          }
        }
      } catch {
        // Ignore corrupt backup
      }
    }

    if (this.fortunes.length === 0) {
      this.fortunes = DEFAULT_100_FORTUNES.map((f) => ({ ...f }));
      this.writeAtomicJsonBackup();
    }
  }

  private persistAllFortunesToSqlite(): void {
    if (!this.db) return;
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      this.db.prepare('DELETE FROM fortune_sticks').run();
      const stmt = this.db.prepare(
        'INSERT INTO fortune_sticks (fortune_id, fortune_number, payload_json, updated_at) VALUES (?, ?, ?, ?)',
      );
      const now = Date.now();
      for (const f of this.fortunes) {
        stmt.run(f.fortuneId, f.fortuneNumber, JSON.stringify(f), f.updatedAt || now);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  private persistSettingsToSqlite(): void {
    if (!this.db) return;
    this.db
      .prepare('INSERT OR REPLACE INTO xinxam_settings (key, value_json) VALUES (?, ?)')
      .run('config', JSON.stringify(this.settings));
  }

  private writeAtomicJsonBackup(): void {
    try {
      const tmp = `${this.jsonBackupPath}.tmp`;
      fs.writeFileSync(
        tmp,
        JSON.stringify(
          {
            version: 1,
            updatedAt: new Date().toISOString(),
            settings: this.settings,
            fortunes: this.fortunes,
            recentDraws: this.recentDraws.slice(0, 50),
          },
          null,
          2,
        ),
        'utf-8',
      );
      fs.renameSync(tmp, this.jsonBackupPath);
    } catch {
      // Ignore write error in read-only runtimes
    }
  }

  public getSnapshot() {
    return {
      settings: { ...this.settings },
      fortunes: this.fortunes.map((f) => ({ ...f })),
      recentDraws: this.recentDraws.slice(0, 40).map((d) => ({ ...d })),
    };
  }

  public getSettings(): XinXamSettings {
    return { ...this.settings };
  }

  public updateSettings(raw: Partial<XinXamSettings>): XinXamSettings {
    this.settings = normalizeXinXamSettings(raw, this.settings);
    this.persistSettingsToSqlite();
    this.writeAtomicJsonBackup();
    return { ...this.settings };
  }

  public getAllFortunes(): FortuneRecord[] {
    return this.fortunes.map((f) => ({ ...f }));
  }

  public createFortune(raw: Record<string, unknown>): FortuneRecord {
    const normalized = validateAndNormalizeFortune(raw);
    if (
      this.fortunes.some(
        (f) =>
          f.fortuneId === normalized.fortuneId ||
          f.fortuneNumber === normalized.fortuneNumber,
      )
    ) {
      throw new FortuneValidationError(
        `Quẻ xăm số ${normalized.fortuneCode} hoặc mã "${normalized.fortuneId}" đã tồn tại.`,
        409,
      );
    }

    this.fortunes.push(normalized);
    this.fortunes.sort((a, b) => a.fortuneNumber - b.fortuneNumber);
    if (this.db) {
      this.db
        .prepare(
          'INSERT INTO fortune_sticks (fortune_id, fortune_number, payload_json, updated_at) VALUES (?, ?, ?, ?)',
        )
        .run(
          normalized.fortuneId,
          normalized.fortuneNumber,
          JSON.stringify(normalized),
          normalized.updatedAt || Date.now(),
        );
    }
    this.writeAtomicJsonBackup();
    return { ...normalized };
  }

  public updateFortune(fortuneId: string, raw: Record<string, unknown>): FortuneRecord {
    const idx = this.fortunes.findIndex((f) => f.fortuneId === fortuneId);
    if (idx === -1) {
      throw new FortuneValidationError(`Không tìm thấy quẻ xăm "${fortuneId}".`, 404);
    }
    const existing = this.fortunes[idx];
    const normalized = validateAndNormalizeFortune(
      { ...raw, fortuneId: existing.fortuneId },
      existing,
    );

    if (
      normalized.fortuneNumber !== existing.fortuneNumber &&
      this.fortunes.some(
        (f, i) => i !== idx && f.fortuneNumber === normalized.fortuneNumber,
      )
    ) {
      throw new FortuneValidationError(
        `Số quẻ ${normalized.fortuneCode} đã được gán cho quẻ khác.`,
        409,
      );
    }

    this.fortunes[idx] = normalized;
    this.fortunes.sort((a, b) => a.fortuneNumber - b.fortuneNumber);

    if (this.db) {
      this.db
        .prepare(
          'INSERT OR REPLACE INTO fortune_sticks (fortune_id, fortune_number, payload_json, updated_at) VALUES (?, ?, ?, ?)',
        )
        .run(
          normalized.fortuneId,
          normalized.fortuneNumber,
          JSON.stringify(normalized),
          normalized.updatedAt || Date.now(),
        );
    }
    this.writeAtomicJsonBackup();
    return { ...normalized };
  }

  public deleteFortune(fortuneId: string): void {
    const idx = this.fortunes.findIndex((f) => f.fortuneId === fortuneId);
    if (idx === -1) {
      throw new FortuneValidationError(`Không tìm thấy quẻ xăm "${fortuneId}".`, 404);
    }
    this.fortunes.splice(idx, 1);
    if (this.db) {
      this.db.prepare('DELETE FROM fortune_sticks WHERE fortune_id = ?').run(fortuneId);
    }
    this.writeAtomicJsonBackup();
  }

  public resetDefaults(): FortuneRecord[] {
    this.fortunes = DEFAULT_100_FORTUNES.map((f) => ({ ...f, updatedAt: Date.now() }));
    this.persistAllFortunesToSqlite();
    this.writeAtomicJsonBackup();
    return this.getAllFortunes();
  }

  public importFortunesBulk(
    rawPayload: unknown,
    mode: 'merge' | 'replace' = 'merge',
  ): { importedCount: number; fortunes: FortuneRecord[] } {
    const arr = Array.isArray(rawPayload)
      ? rawPayload
      : rawPayload &&
          typeof rawPayload === 'object' &&
          Array.isArray((rawPayload as Record<string, unknown>).fortunes)
        ? ((rawPayload as Record<string, unknown>).fortunes as unknown[])
        : null;

    if (!arr || arr.length === 0) {
      throw new FortuneValidationError('Tệp JSON không chứa danh sách "fortunes" hợp lệ.');
    }

    const incoming: FortuneRecord[] = [];
    const seenNums = new Set<number>();
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const norm = validateAndNormalizeFortune(item as Record<string, unknown>);
      if (seenNums.has(norm.fortuneNumber)) {
        throw new FortuneValidationError(
          `Tệp JSON có số quẻ trùng lặp: ${norm.fortuneCode}.`,
        );
      }
      seenNums.add(norm.fortuneNumber);
      incoming.push(norm);
    }

    if (mode === 'replace') {
      this.fortunes = incoming.sort((a, b) => a.fortuneNumber - b.fortuneNumber);
    } else {
      const byNum = new Map<number, FortuneRecord>();
      for (const f of this.fortunes) {
        byNum.set(f.fortuneNumber, f);
      }
      for (const inc of incoming) {
        byNum.set(inc.fortuneNumber, inc);
      }
      this.fortunes = Array.from(byNum.values()).sort(
        (a, b) => a.fortuneNumber - b.fortuneNumber,
      );
    }

    if (
      rawPayload &&
      typeof rawPayload === 'object' &&
      (rawPayload as Record<string, unknown>).settings
    ) {
      this.settings = normalizeXinXamSettings(
        (rawPayload as Record<string, unknown>).settings as Partial<XinXamSettings>,
        this.settings,
      );
      this.persistSettingsToSqlite();
    }

    this.persistAllFortunesToSqlite();
    this.writeAtomicJsonBackup();
    return {
      importedCount: incoming.length,
      fortunes: this.getAllFortunes(),
    };
  }

  /**
   * Uniform random selection across all enabled fortunes with deterministic eventDedupeKey persistence.
   * Re-requesting with the same eventDedupeKey returns the exact stored draw without drawing twice!
   */
  public drawFortuneForEvent(params: {
    eventDedupeKey: string;
    userId: string;
    username: string;
    nickname?: string;
    avatarUrl?: string;
    isDemo?: boolean;
    forcedFortuneNumber?: number;
  }): XinXamDrawResult {
    const dedupeKey = cleanField(
      params.eventDedupeKey,
      140,
      `xinxam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    );

    const existingDraw = this.drawsByDedupeKey.get(dedupeKey);
    if (existingDraw) {
      return { ...existingDraw };
    }

    const enabledPool = this.fortunes.filter((f) => f.enabled);
    if (enabledPool.length === 0) {
      throw new FortuneValidationError('Hiện không có quẻ xăm nào đang bật (enabled).', 400);
    }

    let chosen: FortuneRecord | undefined;
    if (params.forcedFortuneNumber !== undefined) {
      chosen = enabledPool.find((f) => f.fortuneNumber === Number(params.forcedFortuneNumber));
    }
    if (!chosen) {
      // Uniform random across all enabled sticks without category bias
      const randomIndex = Math.floor(Math.random() * enabledPool.length);
      chosen = enabledPool[randomIndex];
    }

    const now = Date.now();
    const displayNick = cleanField(params.nickname || params.username, 60, 'Phật Tử');
    const cleanUser = cleanField(params.username, 60, 'phattu').replace(/^@+/, '');

    const spokenText = renderXinXamVoiceText(this.settings.voiceTemplate, {
      username: displayNick || cleanUser,
      fortuneNumber: chosen.fortuneNumber,
      fortuneTitle: chosen.fortuneTitle || chosen.title,
      fortuneType: chosen.fortuneType || chosen.category,
      category: chosen.fortuneType || chosen.category,
      fortuneInterpretation: chosen.voiceText || chosen.interpretation,
      interpretation: chosen.voiceText || chosen.interpretation,
      fortuneAdvice: chosen.advice,
      advice: chosen.advice,
    });

    const result: XinXamDrawResult = {
      drawId: `draw_${now}_${Math.random().toString(36).slice(2, 7)}`,
      eventDedupeKey: dedupeKey,
      userId: cleanField(params.userId, 80, cleanUser),
      username: cleanUser,
      nickname: displayNick,
      avatarUrl: cleanField(params.avatarUrl, 1024, ''),
      fortuneId: chosen.fortuneId,
      fortuneNumber: chosen.fortuneNumber,
      fortuneCode: chosen.fortuneCode,
      fortuneTitle: chosen.fortuneTitle || chosen.title,
      title: chosen.fortuneTitle || chosen.title,
      fortuneType: chosen.fortuneType || chosen.category,
      category: chosen.fortuneType || chosen.category,
      shortVerse: chosen.shortVerse || chosen.poem,
      poem: chosen.shortVerse || chosen.poem,
      interpretation: chosen.interpretation,
      advice: chosen.advice,
      spokenText,
      meritAwarded: this.settings.meritPoints,
      isDemo: Boolean(params.isDemo),
      createdAt: now,
      expiresAt: now + this.settings.resultDisplayDurationMs,
    };

    this.drawsByDedupeKey.set(dedupeKey, result);
    this.recentDraws.unshift(result);
    if (this.recentDraws.length > 80) {
      this.recentDraws.length = 80;
    }

    if (this.db) {
      this.db
        .prepare(
          'INSERT OR REPLACE INTO xinxam_draws (event_dedupe_key, draw_id, user_id, fortune_number, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          result.eventDedupeKey,
          result.drawId,
          result.userId,
          result.fortuneNumber,
          JSON.stringify(result),
          result.createdAt,
        );
    }
    this.writeAtomicJsonBackup();

    return { ...result };
  }
}

export const fortuneStore = new FortuneStore();
