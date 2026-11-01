export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  LIVE = 'LIVE',
  RECONNECTING = 'RECONNECTING',
  DEMO = 'DEMO',
  ERROR = 'ERROR',
}

/**
 * Centralized Voice Priority Order (Lower numeric value = Higher priority):
 * 1. Major ceremonies (LARGE_GIFT = 1)
 * 2. Xin Xăm Cầu Nguyện (XIN_XAM = 2)
 * 3. Other ceremonial gift events (NORMAL_GIFT = 3, SPECIAL_RITUAL = 4)
 * 4. Real TikTok comments (PRAYER_COMMENT = 5, ORDINARY_COMMENT = 6)
 * 5. Background narration (BACKGROUND = 7)
 */
export enum AnnouncementPriority {
  LARGE_GIFT = 1,
  XIN_XAM = 2,
  NORMAL_GIFT = 3,
  SPECIAL_RITUAL = 4,
  PRAYER_COMMENT = 5,
  ORDINARY_COMMENT = 6,
  BACKGROUND = 7,
}

export type BuddhaModelLoadStatus = 'builtin' | 'loading' | 'loaded' | 'fallback_error';

export type VoiceApiConnectionState = 'idle' | 'testing' | 'connected' | 'fallback' | 'error';

export type RitualActionType =
  | 'altar_flower'
  | 'altar_incense'
  | 'altar_bell'
  | 'altar_fruit_tray'
  | 'altar_lotus_pedestal'
  | 'altar_pagoda'
  | 'altar_lantern'
  | 'altar_grand_ceremony'
  | 'altar_pray_clasped'
  | 'altar_wooden_fish'
  | 'glowing_lotus'
  | 'golden_light'
  | 'seat_prayer'
  | 'seat_wooden_fish'
  | 'xin_xam'
  | 'no_animation';

export type GiftCharacterAnimType =
  | 'walk_offer_bow'
  | 'walk_ring_bell'
  | 'walk_light_incense'
  | 'walk_kneel_pray'
  | 'walk_prostrate_3'
  | 'walk_wooden_fish'
  | 'walk_xin_xam'
  | 'seated_pray'
  | 'deep_bow_in_place'
  | 'pray_with_glow'
  | 'none';

export type GiftIconType =
  | 'rose'
  | 'bell'
  | 'fruit'
  | 'tray'
  | 'lotus'
  | 'pagoda'
  | 'incense'
  | 'prayer'
  | 'wooden_fish'
  | 'light'
  | 'lamp'
  | 'bamboo_stick'
  | 'custom';

export type GiftEffectType =
  | 'lotus_petals'
  | 'incense_smoke'
  | 'bell_waves'
  | 'bell_ripple'
  | 'golden_particles'
  | 'golden_tray_glow'
  | 'glowing_lotus'
  | 'lotus_bloom'
  | 'golden_light'
  | 'altar_blessing'
  | 'grand_ceremony'
  | 'pagoda_halo'
  | 'floating_lantern'
  | 'golden_aura'
  | 'none';

export type GiftSoundEffectType =
  | 'offering_chime'
  | 'temple_bell'
  | 'grand_ceremony_bell'
  | 'wooden_fish'
  | 'incense_chime'
  | 'lotus_chime'
  | 'lantern_chime'
  | 'none';

export type AltarStationId =
  | 'incense_center'
  | 'incense_left'
  | 'incense_right'
  | 'fruit_left'
  | 'fruit_right'
  | 'flower_left'
  | 'flower_right'
  | 'lotus_left'
  | 'lotus_right'
  | 'lantern_left'
  | 'lantern_right'
  | 'bell_right'
  | 'grand_center'
  | 'xin_xam_station';

export type WoodenFishMilestoneTier = 'like_10' | 'like_100' | 'like_1000';

export type FortuneCategory =
  | 'Đại Cát'
  | 'Trung Cát'
  | 'Tiểu Cát'
  | 'Bình'
  | 'Cần Thận Trọng';

export type FortuneType = FortuneCategory;

export const FORTUNE_CATEGORIES: FortuneCategory[] = [
  'Đại Cát',
  'Trung Cát',
  'Tiểu Cát',
  'Bình',
  'Cần Thận Trọng',
];

export const FORTUNE_CLASSIFICATION_META: Record<
  FortuneCategory,
  {
    upperLabel: string;
    meaningVi: string;
    meaningEn: string;
  }
> = {
  'Đại Cát': {
    upperLabel: 'ĐẠI CÁT',
    meaningVi: 'Cát tường hanh thông',
    meaningEn: 'Very auspicious',
  },
  'Trung Cát': {
    upperLabel: 'TRUNG CÁT',
    meaningVi: 'Thuận hòa tốt lành',
    meaningEn: 'Moderately auspicious',
  },
  'Tiểu Cát': {
    upperLabel: 'TIỂU CÁT',
    meaningVi: 'Phước lành êm dịu',
    meaningEn: 'Small blessing',
  },
  Bình: {
    upperLabel: 'BÌNH',
    meaningVi: 'Cân bằng, an ổn',
    meaningEn: 'Neutral, balanced',
  },
  'Cần Thận Trọng': {
    upperLabel: 'CẦN THẬN TRỌNG',
    meaningVi: 'Lời nhắc hành xử cẩn trọng',
    meaningEn: 'Symbolic reminder to act carefully',
  },
};

export function isValidFortuneCategory(val: unknown): val is FortuneCategory {
  return typeof val === 'string' && (FORTUNE_CATEGORIES as string[]).includes(val.trim());
}

export interface FortuneRecord {
  fortuneId: string;
  /** Numeric fortune index 1..100+ */
  fortuneNumber: number;
  /** Padded display code '01'..'100' */
  fortuneCode: string;
  /** Canonical fortune card title */
  fortuneTitle: string;
  /** Backward-compatible alias synced with fortuneTitle */
  title: string;
  /** Predefined classification linked directly to this fortune card */
  fortuneType: FortuneCategory;
  /** Backward-compatible alias synced with fortuneType */
  category: FortuneCategory;
  /** Traditional 2–4 line Vietnamese verse */
  shortVerse: string;
  /** Backward-compatible alias synced with shortVerse */
  poem: string;
  /** Cultural & symbolic Vietnamese interpretation */
  interpretation: string;
  /** Gentle mindful advice */
  advice: string;
  /** Optional custom spoken interpretation override */
  voiceText: string;
  enabled: boolean;
  updatedAt?: number;
}

export function normalizeFortuneRecord(
  raw: Partial<FortuneRecord> & { fortuneNumber: number },
): FortuneRecord {
  const num = Math.max(1, Math.min(999, Math.round(Number(raw.fortuneNumber) || 1)));
  const code = formatFortuneCode(num);
  const resolvedTitle = String(raw.fortuneTitle ?? raw.title ?? `Quẻ Xăm Số ${code}`).trim();
  const rawCat = String(raw.fortuneType ?? raw.category ?? 'Trung Cát').trim();
  const resolvedType: FortuneCategory = isValidFortuneCategory(rawCat) ? rawCat : 'Trung Cát';
  const resolvedVerse = String(raw.shortVerse ?? raw.poem ?? '').trim();
  const resolvedInterpretation = String(raw.interpretation ?? '').trim();
  const resolvedAdvice = String(raw.advice ?? '').trim();
  const resolvedVoiceText = String(raw.voiceText ?? '').trim();

  return {
    fortuneId: String(raw.fortuneId || `xam_${code}`).trim(),
    fortuneNumber: num,
    fortuneCode: code,
    fortuneTitle: resolvedTitle,
    title: resolvedTitle,
    fortuneType: resolvedType,
    category: resolvedType,
    shortVerse: resolvedVerse,
    poem: resolvedVerse,
    interpretation: resolvedInterpretation,
    advice: resolvedAdvice,
    voiceText: resolvedVoiceText,
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

export const DEFAULT_XIN_XAM_VOICE_TEMPLATE =
  'Phật tử {username} xin được xăm số {fortuneNumber}, {fortuneType}. {fortuneTitle}. {fortuneInterpretation}. {fortuneAdvice}.';

export const LEGACY_V1_XIN_XAM_VOICE_TEMPLATE =
  'Phật tử {username} xin được quẻ xăm số {fortuneNumber}, {fortuneTitle}. {interpretation}';

export type XinXamPopupDisplayMode = 'compact' | 'detailed';

/**
 * Normalizes single-line or prose Vietnamese fortune text by collapsing accidental
 * internal newlines/tabs into spaces (never forcing arbitrary line breaks in titles or interpretations).
 */
export function normalizeSingleFlowVietnameseText(raw: string): string {
  return String(raw || '')
    .normalize('NFC')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Preserves ONLY intentional line breaks in traditional 2–4 line Vietnamese fortune verses,
 * trimming each verse line cleanly without collapsing poetic couplets.
 */
export function formatTraditionalVerseLines(rawVerse: string, maxLines = 4): string {
  const lines = String(rawVerse || '')
    .normalize('NFC')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
  return lines.slice(0, Math.max(1, maxLines)).join('\n');
}

/**
 * Extracts a concise single-sentence excerpt (at clean Vietnamese word boundaries, never mid-word)
 * for the compact livestream fortune popup while keeping the complete text in state & VieNeuTTS.
 */
export function extractConciseVietnameseSentence(rawText: string, maxChars = 115): string {
  const normalized = normalizeSingleFlowVietnameseText(rawText);
  if (!normalized) return '';
  const sentenceMatch = normalized.match(/^[^.!?…]+[.!?…]?/u);
  const candidate = sentenceMatch ? sentenceMatch[0].trim() : normalized;
  if (candidate.length <= maxChars) {
    return /[.!?…]$/u.test(candidate) ? candidate : `${candidate}.`;
  }
  const sliced = candidate.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  const wordSafe = (lastSpace > 24 ? sliced.slice(0, lastSpace) : sliced).replace(/[,;:\s]+$/u, '');
  return `${wordSafe}…`;
}

export interface XinXamSettings {
  enabled: boolean;
  /** Editable event title shown in "CÚNG DƯỜNG CẦU AN" (default: "XIN XĂM") */
  eventTitle: string;
  /** Editable Vietnamese ritual description shown in "CÚNG DƯỜNG CẦU AN" (default: "Xin xăm cầu an") */
  eventLabel: string;
  /**
   * Actual TikTok Gift ID configured by the administrator.
   * Empty string by default — NEVER invent or hardcode a fake TikTok Gift ID!
   */
  giftId: string;
  /** Configurable reference coin value used for display & ascending sort order (default: 20) */
  referenceCoins: number;
  meritPoints: number;
  voiceTemplate: string;
  /** Particle density multiplier 0.3..1.6 (M1 8GB optimized) */
  particleDensity: number;
  /** Total 3D ceremony duration at the Xin Xăm station in seconds (default 6.2s) */
  animationDurationSec: number;
  /** Fortune popup size multiplier 0.72..1.25 (default 1.0) */
  panelScale: number;
  /** Fortune popup semi-transparent burgundy RGBA opacity 0.25..0.85 (default 0.55) */
  panelOpacity: number;
  /** How long the fortune result popup remains visible after reveal in ms (default 8000ms = 8s) */
  resultDisplayDurationMs: number;
  /** Compact (short excerpt + 1 concise advice) vs Detailed (full 4-line verse + interpretation) */
  displayMode: XinXamPopupDisplayMode;
  /** Responsive fortune text scale multiplier 0.80..1.30 (default 1.0) */
  textScale: number;
  /** Internal settings schema version for smooth SQLite/localStorage upgrades */
  schemaVersion?: number;
}

export const DEFAULT_XIN_XAM_SETTINGS: XinXamSettings = {
  enabled: true,
  eventTitle: 'XIN XĂM',
  eventLabel: 'Xin xăm cầu an',
  giftId: '',
  referenceCoins: 20,
  meritPoints: 200,
  voiceTemplate: DEFAULT_XIN_XAM_VOICE_TEMPLATE,
  particleDensity: 1.0,
  animationDurationSec: 6.2,
  panelScale: 1.0,
  panelOpacity: 0.55,
  resultDisplayDurationMs: 8000,
  displayMode: 'compact',
  textScale: 1.0,
  schemaVersion: 3,
};

export interface XinXamDrawResult {
  drawId: string;
  eventDedupeKey: string;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  fortuneId: string;
  fortuneNumber: number;
  fortuneCode: string;
  fortuneTitle: string;
  title: string;
  fortuneType: FortuneCategory;
  category: FortuneCategory;
  shortVerse: string;
  poem: string;
  interpretation: string;
  advice: string;
  spokenText: string;
  meritAwarded: number;
  isDemo: boolean;
  createdAt: number;
  expiresAt: number;
}

export type ActiveXinXamStage =
  | 'walking'
  | 'kneeling'
  | 'pickup_tube'
  | 'shaking'
  | 'stick_falling'
  | 'revealed'
  | 'bowing'
  | 'returning';

export interface ActiveXinXamVisualState {
  ritualId: string;
  userId: string;
  username: string;
  stage: ActiveXinXamStage;
  progress: number;
  fortuneNumber: number;
  fortuneCode: string;
  category: FortuneCategory;
  startedAt: number;
}

export interface GiftMapping {
  id: string;
  giftId: string;
  giftName: string;
  vietnameseLabel: string;
  ceremonyTitle: string;
  ritualTitle: string;
  ritualSubtitle: string;
  badgeCeremonyLabel: string;
  iconType: GiftIconType;
  iconUrl?: string;
  uploadedImageData?: string;
  referenceCoins: number;
  points: number;
  isLarge: boolean;
  ritualType: RitualActionType;
  characterAnimation: GiftCharacterAnimType;
  animation?: 'offering' | 'gift_blessing' | GiftCharacterAnimType;
  effect: GiftEffectType;
  soundEffect: GiftSoundEffectType;
  ttsTemplate: string;
  voiceTemplate: string;
  voicePriority: AnnouncementPriority;
  queuePriority: number;
  animationDurationSec: number;
  cooldownSec: number;
  enabled: boolean;
  showInOverlayPanel: boolean;
  updatedAt?: number;
}

export interface GiftActionPreset {
  presetId: string;
  name: string;
  description: string;
  ritualTitle?: string;
  ritualSubtitle?: string;
  ritualType: RitualActionType;
  characterAnimation: GiftCharacterAnimType;
  effect: GiftEffectType;
  soundEffect: GiftSoundEffectType;
  ttsTemplate: string;
  voiceTemplate?: string;
  voicePriority: AnnouncementPriority;
  queuePriority?: number;
  animationDurationSec: number;
  cooldownSec: number;
  isBuiltin?: boolean;
  updatedAt?: number;
}

export interface UnknownGiftRecord {
  giftId: string;
  giftName: string;
  iconUrl?: string;
  diamondCount: number;
  occurrenceCount: number;
  lastSeenAt: number;
  sampleUsername: string;
  isDemo: boolean;
}

export interface CeremonialAnnouncementItem {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  ritualTitle: string;
  ritualSubtitle: string;
  isMajor: boolean;
  tier: AnnouncementPriority;
  queuePriority: number;
  durationMs: number;
  startedAt: number;
  expiresAt: number;
  createdAt: number;
  isDemo: boolean;
}

export interface LotusBurstTrigger {
  id: string;
  isMajor: boolean;
  intensity: number;
  startedAt: number;
  durationMs: number;
}

export interface LotusCeremonyBadge {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  ceremonyTitle: string;
  offeringLabel: string;
  side: 'left' | 'right';
  startedAt: number;
  expiresAt: number;
}

export type CharacterAnimState =
  | 'walking_aisle'
  | 'turning_row'
  | 'walking_row'
  | 'turning_altar'
  | 'leaving_seat_to_aisle'
  | 'walking_to_altar'
  | 'performing_altar_ritual'
  | 'returning_from_altar'
  | 'returning_row'
  | 'departing_standing'
  | 'departing_row'
  | 'departing_exit'
  | 'departing_fade'
  | 'kneeling'
  | 'bowing'
  | 'sitting'
  | 'praying'
  | 'wooden_fish'
  | 'offering'
  | 'gift_blessing';

export interface ActiveCharacterRitual {
  id: string;
  giftId?: string;
  giftName?: string;
  type: RitualActionType;
  characterAnimation?: GiftCharacterAnimType;
  customEffect?: GiftEffectType;
  customSound?: GiftSoundEffectType;
  awardedPoints?: number;
  isDemo?: boolean;
  label: string;
  ceremonyBadgeTitle: string;
  stationId: AltarStationId;
  targetX: number;
  targetZ: number;
  faceRotY: number;
  outboundLaneX: number;
  returnLaneX: number;
  startedAt: number;
  durationMs: number;
  /** Attached when ritual.type === 'xin_xam' so reveal panel + TTS match exact pre-drawn stick */
  xinXamDraw?: XinXamDrawResult;
  xinXamRevealed?: boolean;
}

export interface ActiveWoodenFishAction {
  id: string;
  tier: WoodenFishMilestoneTier;
  strikeCount: number;
  cumulativeLikes: number;
  startedAt: number;
  durationMs: number;
}

export interface Participant {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  seatIndex: number;
  laneOffset: number;
  points: number;
  giftCount: number;
  commentCount: number;
  totalLikes: number;
  woodenFishStrikes: number;
  lastGiftName?: string;
  lastGiftAt?: number;
  lastComment?: string;
  lastCommentAt?: number;
  lastCommentId?: string;
  ritualStatusLabel?: string;
  ritualStatusUntil?: number;
  animState: CharacterAnimState;
  animStateStartedAt: number;
  activeRitual: ActiveCharacterRitual | null;
  activeWoodenFish: ActiveWoodenFishAction | null;
  lastActivityAt: number;
  lastInteractionAt: number;
  isDeparting: boolean;
  departingStartedAt?: number;
  robeHueShift: number;
  hasHairBun: boolean;
  isDemo: boolean;
}

export interface MeritLedgerEntry {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  points: number;
  giftCount: number;
  commentCount: number;
  totalLikes: number;
  woodenFishStrikes: number;
  lastGiftName?: string;
  lastGiftAt?: number;
  firstSeenAt: number;
  lastInteractionAt: number;
  isActiveInScene: boolean;
  isDemo: boolean;
}

export interface ActiveGiftVisualEffect {
  id: string;
  type: GiftEffectType;
  userId: string;
  username: string;
  giftName: string;
  points: number;
  seatIndex: number;
  originX?: number;
  originZ?: number;
  startedAt: number;
  durationMs: number;
}

export interface FeedNotification {
  id: string;
  kind: 'join' | 'comment' | 'prayer' | 'gift' | 'ritual' | 'follow' | 'share' | 'like' | 'xin_xam';
  username: string;
  message: string;
  pointsDelta?: number;
  isDemo: boolean;
  timestamp: number;
}

export interface GiftCalculationLogEntry {
  id: string;
  userId: string;
  username: string;
  giftId: string;
  giftName: string;
  giftCount: number;
  unitPoints: number;
  awardedPoints: number;
  totalUserPoints: number;
  ritualName: string;
  status: 'executed' | 'streak_update' | 'cooldown_throttled' | 'disabled' | 'unknown' | 'xin_xam';
  isDemo: boolean;
  timestamp: number;
}

export interface GiftCeremonyQueueItemSnapshot {
  id: string;
  userId: string;
  username: string;
  giftId?: string;
  giftName: string;
  ritualType: RitualActionType;
  ritualLabel: string;
  stationId?: AltarStationId;
  status: 'active_at_altar' | 'queued';
  priority: number;
  durationMs: number;
  isDemo: boolean;
  timestamp: number;
}

export interface TikTokNormalizedEvent {
  eventId: string;
  eventDedupeKey?: string;
  type: 'join' | 'leave' | 'member_join' | 'like' | 'comment' | 'chat' | 'gift' | 'follow' | 'share';
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  timestamp?: number;
  isDemo?: boolean;
  likeCount?: number;
  totalLikeCount?: number;
  cumulativeUserLikes?: number;
  comment?: string;
  giftId?: string | number;
  giftName?: string;
  giftPictureUrl?: string;
  giftIconUrl?: string;
  giftCount?: number;
  totalStreakCount?: number;
  giftType?: number;
  streakKey?: string;
  repeatEnd?: boolean;
  isStreakCompletionOnly?: boolean;
  verifiedBackend?: boolean;
  diamondCount?: number;
}

export type TTSProviderType = 'vieneu' | 'gemini' | 'elevenlabs' | 'openai' | 'browser';
export type VieNeuConnectionMode = 'cloud' | 'local';
export type VieNeuMode = VieNeuConnectionMode;
export type GiftInterruptPolicy = 'interrupt_comments' | 'finish_current';

export interface VieNeuVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male';
  region?: string;
  engine?: string;
  description?: string;
  recommended?: boolean;
}

export const CURATED_VIENEU_VOICES: VieNeuVoiceOption[] = [
  {
    id: 'Ngọc Lan',
    name: 'Ngọc Lan (Miền Bắc · Trang nghiêm)',
    gender: 'female',
    region: 'north',
    description: 'Giọng nữ miền Bắc truyền cảm, ấm áp chốn thiền môn',
    recommended: true,
  },
  {
    id: 'Nhã Uyên',
    name: 'Nhã Uyên (Miền Nam · Dịu hiền)',
    gender: 'female',
    region: 'south',
    description: 'Giọng nữ miền Nam nhẹ nhàng, từ hòa',
    recommended: true,
  },
  {
    id: 'Bảo Trâm',
    name: 'Bảo Trâm (Miền Trung · Thanh thoát)',
    gender: 'female',
    region: 'central',
    description: 'Giọng nữ thanh tịnh, rõ chữ',
    recommended: true,
  },
  {
    id: 'Thiền Tâm Đức',
    name: 'Thiền Tâm Đức (Giọng Nam Trầm Ấm)',
    gender: 'male',
    region: 'north',
    description: 'Giọng nam trầm tĩnh, trang nghiêm',
    recommended: true,
  },
  {
    id: 'Bảo Long',
    name: 'Bảo Long (Giọng Nam Miền Nam)',
    gender: 'male',
    region: 'south',
    description: 'Giọng nam ấm áp, rõ ràng',
  },
];

export interface CommentVoiceTemplates {
  binhAn: string;
  sucKhoe: string;
  taiLoc: string;
  tinhDuyen: string;
  hocHanh: string;
  giaDao: string;
  general: string;
}

export const DEFAULT_COMMENT_TEMPLATES: CommentVoiceTemplates = {
  binhAn: 'Phật tử {username} gửi lời nguyện: {comment}',
  sucKhoe: 'Phật tử {username} gửi lời nguyện: {comment}',
  taiLoc: 'Phật tử {username} gửi lời nguyện: {comment}',
  tinhDuyen: 'Phật tử {username} gửi lời nguyện: {comment}',
  hocHanh: 'Phật tử {username} gửi lời nguyện: {comment}',
  giaDao: 'Phật tử {username} gửi lời nguyện: {comment}',
  general: 'Phật tử {username} gửi lời nguyện: {comment}',
};

export const DEFAULT_COMMENT_VOICE_FORMULA = 'Phật tử {username} gửi lời nguyện: {comment}';

export const DEFAULT_GIFT_THANK_YOU_TEMPLATE =
  'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã phát tâm {ritualTitle}. Nguyện cầu bình an, phước lành và cát tường.';

export const FORBIDDEN_GIFT_WORDS_PATTERN =
  /(tặng\s*quà|quà\s*tặng|\bgifts?\b|cúng\s*dường\s*quà|tặng\s*lễ\s*vật|gửi\s*tặng|đã\s*tặng|đã\s*gửi\s*quà|sent\s+a\s+gift|\b\d+\s*xu\b|đồng\s*xu|nội\s*dung\s*xăm\s*minh\s*họa\s*mang\s*tính\s*tham\s*khảo)/iu;

export function containsForbiddenGiftWords(text: string): boolean {
  if (!text) return false;
  return FORBIDDEN_GIFT_WORDS_PATTERN.test(text);
}

export function isLegacyGiftWordTemplate(text: string): boolean {
  if (!text) return false;
  return containsForbiddenGiftWords(text) || /\{giftName\}|\{giftCount\}/iu.test(text);
}

/**
 * Sanitizes ceremonial text so "Tặng quà", "Quà tặng", "Gift", "20 xu", or banned disclaimers
 * never appear in public announcements or VieNeuTTS ceremonial speech.
 */
export function sanitizeCeremonialText(rawText?: string, fallback = ''): string {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return fallback;
  if (!containsForbiddenGiftWords(trimmed)) return trimmed;

  const cleaned = trimmed
    .replace(/nội\s*dung\s*xăm\s*minh\s*họa\s*mang\s*tính\s*tham\s*khảo\.?/giu, '')
    .replace(/\(\s*\d+\s*xu\s*\)/giu, '')
    .replace(/[-–—·•]\s*\d+\s*xu\b/giu, '')
    .replace(/\b\d+\s*xu\b/giu, '')
    .replace(/đồng\s*xu/giu, 'công đức')
    .replace(/đã\s+gửi\s+tặng\s+\{giftCount\}\s+\{giftName\}/giu, 'đã thành tâm hành lễ')
    .replace(/đã\s+tặng\s+\{giftCount\}\s+\{giftName\}/giu, 'đã thành tâm hành lễ')
    .replace(/đã\s+cúng\s+dường\s+\{giftCount\}\s+\{giftName\}/giu, 'đã thành tâm hành lễ')
    .replace(/đã\s*gửi\s*quà/giu, 'đã thành tâm cầu an')
    .replace(/sent\s+a\s+gift/giu, 'cầu bình an')
    .replace(/tặng\s*quà/giu, 'hành lễ')
    .replace(/quà\s*tặng/giu, 'nghi lễ')
    .replace(/cúng\s*dường\s*quà/giu, 'phát tâm cầu an')
    .replace(/tặng\s*lễ\s*vật/giu, 'dâng lễ cầu nguyện')
    .replace(/gửi\s*tặng/giu, 'thành tâm dâng lễ')
    .replace(/đã\s*tặng/giu, 'đã phát tâm')
    .replace(/\bgifts?\b/giu, 'nghi lễ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned || containsForbiddenGiftWords(cleaned)) {
    return fallback;
  }
  return cleaned;
}

/**
 * Formats fortune stick code as 2+ digits ('01'..'99', '100')
 */
export function formatFortuneCode(num: number | string): string {
  const n = Math.max(1, Math.min(999, Math.round(Number(num) || 1)));
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Formats the single-line Xin Xăm fortune header, e.g. 18 -> "QUẺ XĂM 18", 1 -> "QUẺ XĂM 01".
 */
export function formatQueXamHeader(fortuneNumber: number | string): string {
  return `QUẺ XĂM ${formatFortuneCode(fortuneNumber)}`;
}

/**
 * Converts a number (0..999) into natural spoken Vietnamese words for VieNeuTTS.
 * Examples:
 * - 1 / "01" -> "một"
 * - 10 -> "mười"
 * - 15 -> "mười lăm"
 * - 18 -> "mười tám"
 * - 21 -> "hai mươi mốt"
 * - 24 -> "hai mươi tư"
 * - 25 -> "hai mươi lăm"
 * - 100 -> "một trăm"
 */
export function vietnameseNumberToWords(raw: number | string): string {
  const num = Math.max(0, Math.min(999, Math.round(Number(raw) || 0)));
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  if (num < 10) {
    return digits[num];
  }

  const readTwoDigits = (n: number): string => {
    if (n === 10) return 'mười';
    if (n < 20) {
      const unit = n % 10;
      if (unit === 5) return 'mười lăm';
      return `mười ${digits[unit]}`;
    }
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    const tensPart = `${digits[tens]} mươi`;
    if (unit === 0) return tensPart;
    if (unit === 1) return `${tensPart} mốt`;
    if (unit === 4) return `${tensPart} tư`;
    if (unit === 5) return `${tensPart} lăm`;
    return `${tensPart} ${digits[unit]}`;
  };

  if (num < 100) {
    return readTwoDigits(num);
  }

  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  const hundredPart = `${digits[hundreds]} trăm`;
  if (remainder === 0) return hundredPart;
  if (remainder < 10) {
    return `${hundredPart} lẻ ${digits[remainder]}`;
  }
  return `${hundredPart} ${readTwoDigits(remainder)}`;
}

function stripTrailingPunctuation(s: string): string {
  return s.replace(/[\s.!?。]+$/gu, '').trim();
}

/**
 * Renders the Xin Xăm VieNeuTTS narration with natural Vietnamese number pronunciation
 * and mandatory reading of the card's saved fortune classification (`fortuneType`).
 *
 * Default formula:
 * "Phật tử {username} xin được xăm số {fortuneNumber}, {fortuneType}. {fortuneTitle}. {fortuneInterpretation}. {fortuneAdvice}."
 *
 * Example output:
 * "Phật tử Minh Anh xin được xăm số mười tám, thuộc loại Trung Cát. Gia đạo an hòa. Gia đình có thể đón nhận những điều thuận lợi khi mọi người biết quan tâm và chia sẻ. Hãy giữ lòng từ bi và sống hòa thuận."
 */
export function renderXinXamVoiceText(
  template: string | undefined,
  vars: {
    username: string;
    fortuneNumber: number;
    fortuneTitle: string;
    fortuneType?: FortuneCategory;
    category?: FortuneCategory;
    fortuneInterpretation?: string;
    interpretation?: string;
    fortuneAdvice?: string;
    advice?: string;
  },
): string {
  const rawTpl = (template || '').trim();
  const baseTpl =
    !rawTpl || rawTpl === LEGACY_V1_XIN_XAM_VOICE_TEMPLATE
      ? DEFAULT_XIN_XAM_VOICE_TEMPLATE
      : rawTpl;

  const cleanName = (vars.username || 'Phật tử').replace(/^@+/, '').trim() || 'Phật tử';
  const spokenNumber = vietnameseNumberToWords(vars.fortuneNumber);
  const resolvedType: FortuneCategory = vars.fortuneType || vars.category || 'Trung Cát';
  const cleanTitle = stripTrailingPunctuation(
    sanitizeCeremonialText(vars.fortuneTitle || 'Gia đạo an hòa', 'Gia đạo an hòa'),
  );
  const cleanInterp = stripTrailingPunctuation(
    sanitizeCeremonialText(
      vars.fortuneInterpretation ||
        vars.interpretation ||
        'Tâm sáng lòng thành, giữ nếp thiện lành thì mọi việc thuận hòa',
      'Tâm sáng lòng thành, giữ nếp thiện lành thì mọi việc thuận hòa',
    ),
  );
  const cleanAdvice = stripTrailingPunctuation(
    sanitizeCeremonialText(
      vars.fortuneAdvice ?? vars.advice ?? 'Hãy giữ lòng từ bi và sống hòa thuận',
      'Hãy giữ lòng từ bi và sống hòa thuận',
    ),
  );

  // Ensure the template NEVER skips reading the fortune classification!
  const hasTypePlaceholder = /\{fortuneType\}|\{fortuneTypeRaw\}|\{category\}/u.test(baseTpl);
  let effectiveTpl = baseTpl;
  if (!hasTypePlaceholder) {
    if (effectiveTpl.includes('{fortuneNumber}')) {
      effectiveTpl = effectiveTpl.replace('{fortuneNumber}', '{fortuneNumber}, {fortuneType}');
    } else {
      effectiveTpl = `${effectiveTpl} Thuộc loại {fortuneTypeRaw}.`;
    }
  }

  const spokenTypePhrase = `thuộc loại ${resolvedType}`;

  const rendered = effectiveTpl
    .replace(/thuộc\s+loại\s+\{fortuneType\}/giu, spokenTypePhrase)
    .replace(/\{fortuneType\}/g, spokenTypePhrase)
    .replace(/\{fortuneTypeRaw\}/g, resolvedType)
    .replace(/\{category\}/g, resolvedType)
    .replace(/\{username\}/g, cleanName)
    .replace(/\{fortuneNumber\}/g, spokenNumber)
    .replace(/\{fortuneCode\}/g, formatFortuneCode(vars.fortuneNumber))
    .replace(/\{fortuneTitle\}/g, cleanTitle)
    .replace(/\{fortuneInterpretation\}/g, cleanInterp)
    .replace(/\{interpretation\}/g, cleanInterp)
    .replace(/\{fortuneAdvice\}/g, cleanAdvice)
    .replace(/\{advice\}/g, cleanAdvice)
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  const ensuredPeriod = /[.!?]$/u.test(rendered) ? rendered : `${rendered}.`;

  return sanitizeCeremonialText(
    ensuredPeriod,
    `Phật tử ${cleanName} xin được xăm số ${spokenNumber}, ${spokenTypePhrase}. ${cleanTitle}. ${cleanInterp}${
      cleanAdvice ? `. ${cleanAdvice}.` : '.'
    }`,
  );
}

export interface UnifiedOfferingItem {
  kind: 'gift' | 'xin_xam';
  id: string;
  giftId: string;
  ceremonyTitle: string;
  vietnameseLabel: string;
  referenceCoins: number;
  iconType: GiftIconType;
  iconUrl?: string;
  uploadedImageData?: string;
  isMajor: boolean;
  sortTieBreaker: number;
  giftMapping?: GiftMapping;
}

/**
 * Builds the unified list of ceremonial event rows inside "CÚNG DƯỜNG CẦU AN",
 * merging configured TikTok gift items AND the Xin Xăm fortune ceremony,
 * sorted strictly by ascending configured coin value (`referenceCoins`).
 *
 * Default display order:
 * 1. CẦU BÌNH AN – Hoa Hồng – 1 xu
 * 2. CẦU SỨC KHỎE – Chuông Đồng – 10 xu
 * 3. XIN XĂM – Xin xăm cầu an – 20 xu
 * 4. CẦU GIA ĐẠO – Mâm Quả – 30 xu
 * 5. CẦU TÀI LỘC – Đài Sen – 99 xu
 * 6. CẦU CÔNG ĐỨC – Bảo Tháp – 199 xu
 */
export function buildSortedOfferingItems(
  giftMappings: ReadonlyArray<GiftMapping>,
  xinXamSettings?: Partial<XinXamSettings> | null,
): UnifiedOfferingItem[] {
  const effectiveXinXam: XinXamSettings = {
    ...DEFAULT_XIN_XAM_SETTINGS,
    ...(xinXamSettings || {}),
  };
  const dedicatedXinXamGiftId = normalizeGiftId(effectiveXinXam.giftId);

  const items: UnifiedOfferingItem[] = [];

  giftMappings.forEach((gm, idx) => {
    if (!gm.enabled || gm.showInOverlayPanel === false) return;
    const normalizedId = normalizeGiftId(gm.giftId);
    if (
      effectiveXinXam.enabled &&
      (gm.ritualType === 'xin_xam' ||
        (dedicatedXinXamGiftId && normalizedId === dedicatedXinXamGiftId))
    ) {
      return;
    }

    const title = (gm.ceremonyTitle || gm.ritualTitle || 'CẦU BÌNH AN').trim();
    const label = (gm.vietnameseLabel || gm.giftName || 'Lễ Phật').trim();
    const coins = Math.max(0, Math.round(Number(gm.referenceCoins ?? 0)));
    const isMajor = Boolean(
      gm.isLarge ||
        gm.ritualType === 'altar_pagoda' ||
        gm.ritualType === 'altar_grand_ceremony' ||
        gm.ritualType === 'altar_lotus_pedestal',
    );

    items.push({
      kind: 'gift',
      id: gm.giftId || gm.id || `gift_${idx}`,
      giftId: normalizedId,
      ceremonyTitle: title,
      vietnameseLabel: label,
      referenceCoins: coins,
      iconType: gm.iconType || 'lotus',
      iconUrl: gm.iconUrl,
      uploadedImageData: gm.uploadedImageData,
      isMajor,
      sortTieBreaker: idx * 2,
      giftMapping: gm,
    });
  });

  if (effectiveXinXam.enabled) {
    const xinXamCoins = Math.max(0, Math.round(Number(effectiveXinXam.referenceCoins ?? 20)));
    items.push({
      kind: 'xin_xam',
      id: 'xin_xam',
      giftId: dedicatedXinXamGiftId,
      ceremonyTitle: (effectiveXinXam.eventTitle || 'XIN XĂM').trim() || 'XIN XĂM',
      vietnameseLabel:
        (effectiveXinXam.eventLabel || 'Xin xăm cầu an').trim() || 'Xin xăm cầu an',
      referenceCoins: xinXamCoins,
      iconType: 'bamboo_stick',
      isMajor: false,
      sortTieBreaker: 1,
    });
  }

  items.sort((a, b) => {
    if (a.referenceCoins !== b.referenceCoins) {
      return a.referenceCoins - b.referenceCoins;
    }
    return a.sortTieBreaker - b.sortTieBreaker;
  });

  return items;
}

export interface VoiceSettings {
  autoNarrationEnabled: boolean;
  provider: TTSProviderType;
  vieneuMode: VieNeuConnectionMode;
  vieneuModel?: string;
  localEndpoint: string;
  endpoint?: string;
  voiceId: string;
  gender: 'female' | 'male';
  speed: number;
  volume: number;
  browserFallbackEnabled: boolean;
  giftAnnouncementsEnabled: boolean;
  xinXamAnnouncementsEnabled?: boolean;
  followAnnouncementsEnabled?: boolean;
  commentVoiceEnabled: boolean;
  commentVoiceFormula: string;
  commentTemplates: CommentVoiceTemplates;
  welcomeTemplate?: string;
  commentCooldownSec: number;
  cooldownMs: number;
  perUserCommentCooldownSec: number;
  maxCommentLength: number;
  maxCommentQueueSize: number;
  staleCommentTimeoutSec: number;
  blockSpamLinksAndUnsafe: boolean;
  giftInterruptPolicy: GiftInterruptPolicy;
  prayerAnnouncementsEnabled: boolean;
  commentAnnouncementsEnabled: boolean;
  welcomeAnnouncementsEnabled: boolean;
  backgroundNarrationEnabled: boolean;
  backgroundIntervalSec: number;
  useAiPeacefulMessages: boolean;
  bgMusicEnabled: boolean;
  bgMusicVolume: number;
  customPeacefulMessages: string[];
}

export type QualityPreset = 'low' | 'medium' | 'high';

export type TempleSceneMode = 'image_background' | 'original_3d';

export interface SceneCalibrationSettings {
  /** Active visual temple mode: 'image_background' (default) or 'original_3d' */
  sceneMode: TempleSceneMode;
  /** Permanent local background image path */
  backgroundUrl: string;
  /** Background scale multiplier (0.85 .. 1.35, default 1.0) */
  bgScale: number;
  /** Background horizontal offset in % (-20 .. +20, default 0) */
  bgOffsetX: number;
  /** Background vertical offset in % (-20 .. +20, default 0) */
  bgOffsetY: number;
  /** Camera zoom multiplier (0.75 .. 1.35, default 1.0) */
  cameraZoom: number;
  /** Seat wing horizontal width multiplier (0.70 .. 1.35, default 1.0) */
  seatWidthScale: number;
  /** Seat row depth span multiplier (0.70 .. 1.30, default 1.0) */
  seatDepthScale: number;
  /** Seat block Z shift (-2.5 .. +2.5, default 0) */
  seatOffsetZ: number;
  /** Character scale near the bottom foreground (0.60 .. 1.55, default 1.05) */
  nearCharacterScale: number;
  /** Character scale near the distant altar (0.45 .. 1.35, default 0.86) */
  farCharacterScale: number;
  /** Entrance / departure Z coordinate at the bottom of the red carpet (11.5 .. 17.5, default 14.9) */
  entranceZ: number;
  /** Altar ritual station base Z coordinate right in front of the wooden altar (-9.0 .. -6.8, default -8.15) */
  altarStationZ: number;
  /** Altar ritual station horizontal spread multiplier (0.65 .. 1.35, default 1.0) */
  altarStationSpreadX: number;
  /** Toggle visual perspective & floor alignment guide overlay for administrators */
  showAlignmentGuides: boolean;
}

export const DEFAULT_SCENE_CALIBRATION: SceneCalibrationSettings = {
  sceneMode: 'image_background',
  backgroundUrl: '/assets/temple-background.png',
  bgScale: 1.0,
  bgOffsetX: 0,
  bgOffsetY: 0,
  cameraZoom: 1.0,
  seatWidthScale: 1.0,
  seatDepthScale: 1.0,
  seatOffsetZ: 0,
  nearCharacterScale: 1.05,
  farCharacterScale: 0.86,
  entranceZ: 14.9,
  altarStationZ: -8.15,
  altarStationSpreadX: 1.0,
  showAlignmentGuides: false,
};

export interface StreamOverlaySettings {
  vertical916: boolean;
  obsCleanView: boolean;
  effectsEnabled: boolean;
  showLeaderboard: boolean;
  showGiftPanel: boolean;
  showXinXamPanel: boolean;
  showLotusAvatars: boolean;
  showCenterCeremonyPanel?: boolean;
  showLotusFallingEffect?: boolean;
  showAvatarInCenterPanel: boolean;
  showEventBar: boolean;
  showNotifications: boolean;
  showUsernames: boolean;
  showCommentBubbles: boolean;
  /** Global UI panel scale multiplier (0.70 – 1.15, default 0.86) */
  panelScale: number;
  /** Global semi-transparent RGBA background opacity (0.25 – 0.85, default 0.45) */
  panelOpacity: number;
  lotusParticleDensity: number;
  petalCount: number;
  leafCount: number;
  centerPanelDuration: number;
  maxParticipants: number;
  maxConcurrentCeremonies: number;
  quality: QualityPreset;
  buddhaModelUrl: string;
  buddhaGoldOverride: boolean;
  inactivityTimeoutEnabled: boolean;
  inactivityTimeoutSec: number;
  demoAcceleratedTimeout: boolean;
}

export interface ServerConnectionSnapshot {
  status: ConnectionStatus;
  tiktokUsername: string;
  roomId?: string;
  viewerCount?: number;
  connectedAt?: number;
  lastError?: string;
  incomingEventCount: number;
  receiverActive: boolean;
  isCloudRuntime: boolean;
  availableServerTts: {
    vieneuCloudKeyConfigured: boolean;
    vieneuCloudEndpoint: string;
    vieneuLocalEndpoint: string;
    vieneuEnvUrlWasLocalhost?: boolean;
    gemini: boolean;
    elevenlabs: boolean;
    openai: boolean;
  };
}

export function normalizeGiftId(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

export function inferCanonicalCeremonialDefaults(item: {
  giftId?: string;
  ritualType?: RitualActionType;
  ceremonyTitle?: string;
  isLarge?: boolean;
}): {
  ritualTitle: string;
  ritualSubtitle: string;
  voiceTemplate: string;
  queuePriority: number;
} {
  const gid = normalizeGiftId(item.giftId);
  const rType = item.ritualType || 'altar_flower';

  if (rType === 'xin_xam') {
    return {
      ritualTitle: 'XIN XĂM CẦU NGUYỆN',
      ritualSubtitle: 'Phật tử {username} thành tâm xin quẻ cầu nguyện',
      voiceTemplate: DEFAULT_XIN_XAM_VOICE_TEMPLATE,
      queuePriority: 85,
    };
  }
  if (gid === '29201' || gid === '8913' || rType === 'altar_pagoda' || rType === 'altar_grand_ceremony') {
    return {
      ritualTitle: 'CẦU CÔNG ĐỨC',
      ritualSubtitle: 'Phật tử {username} cầu công đức',
      voiceTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
      queuePriority: 100,
    };
  }
  if (gid === '5827' || gid === '5659' || rType === 'altar_lotus_pedestal' || rType === 'glowing_lotus') {
    return {
      ritualTitle: 'CẦU TÀI LỘC',
      ritualSubtitle: 'Phật tử {username} cầu tài lộc',
      voiceTemplate: 'Phật tử {username} cầu tài lộc. Kính chúc gia đình luôn an lành.',
      queuePriority: 90,
    };
  }
  if (gid === '6093' || rType === 'altar_fruit_tray') {
    return {
      ritualTitle: 'CẦU GIA ĐẠO',
      ritualSubtitle: 'Phật tử {username} cầu gia đạo',
      voiceTemplate: 'Phật tử {username} cầu gia đạo.',
      queuePriority: 60,
    };
  }
  if (gid === '8910' || gid === '6064' || rType === 'altar_bell') {
    return {
      ritualTitle: 'CẦU SỨC KHỎE',
      ritualSubtitle: 'Phật tử {username} cầu sức khỏe',
      voiceTemplate: 'Phật tử {username} cầu sức khỏe.',
      queuePriority: 50,
    };
  }

  const baseTitle = sanitizeCeremonialText(
    item.ceremonyTitle || 'CẦU BÌNH AN',
    'CẦU BÌNH AN',
  ).toUpperCase();

  return {
    ritualTitle: baseTitle,
    ritualSubtitle: `Phật tử {username} ${baseTitle.toLowerCase()}`,
    voiceTemplate: `Phật tử {username} ${baseTitle.toLowerCase()}.`,
    queuePriority: item.isLarge ? 90 : 40,
  };
}

export function normalizeCeremonialGiftMapping(raw: GiftMapping): GiftMapping {
  const defaults = inferCanonicalCeremonialDefaults(raw);
  const ritualTitle = sanitizeCeremonialText(
    raw.ritualTitle || raw.ceremonyTitle || defaults.ritualTitle,
    defaults.ritualTitle,
  );
  const ceremonyTitle = sanitizeCeremonialText(raw.ceremonyTitle || ritualTitle, ritualTitle);
  const ritualSubtitle = sanitizeCeremonialText(
    raw.ritualSubtitle || defaults.ritualSubtitle,
    defaults.ritualSubtitle,
  );
  const candidateVoice = raw.voiceTemplate || raw.ttsTemplate || defaults.voiceTemplate;
  const voiceTemplate = sanitizeCeremonialText(candidateVoice, defaults.voiceTemplate);

  let voicePriority = raw.voicePriority;
  if (raw.isLarge || voicePriority === AnnouncementPriority.LARGE_GIFT) {
    voicePriority = AnnouncementPriority.LARGE_GIFT;
  } else if (raw.ritualType === 'xin_xam') {
    voicePriority = AnnouncementPriority.XIN_XAM;
  } else if (!voicePriority || (voicePriority as number) <= 2) {
    voicePriority = AnnouncementPriority.NORMAL_GIFT;
  }

  return {
    ...raw,
    ceremonyTitle,
    ritualTitle,
    ritualSubtitle,
    ttsTemplate: voiceTemplate,
    voiceTemplate,
    voicePriority,
    queuePriority:
      typeof raw.queuePriority === 'number' && Number.isFinite(raw.queuePriority)
        ? raw.queuePriority
        : defaults.queuePriority,
  };
}

export function renderGiftVoiceTemplate(
  template: string | undefined,
  vars: {
    username: string;
    giftName?: string;
    giftCount?: number;
    meritPoints: number;
    ritualName?: string;
    ritualTitle?: string;
  },
): string {
  const baseTpl = sanitizeCeremonialText(
    (template || '').trim() || DEFAULT_GIFT_THANK_YOU_TEMPLATE,
    DEFAULT_GIFT_THANK_YOU_TEMPLATE,
  );
  const cleanName = (vars.username || 'Phật tử').replace(/^@+/, '').trim() || 'Phật tử';
  const cleanRitualTitle = sanitizeCeremonialText(
    (vars.ritualTitle || vars.ritualName || 'cầu bình an').trim(),
    'cầu bình an',
  ).toLowerCase();
  const cleanRitualName = sanitizeCeremonialText(
    (vars.ritualName || 'Lễ Phật cầu an').trim(),
    'Lễ Phật cầu an',
  );

  const rendered = baseTpl
    .replace(/\{username\}/g, cleanName)
    .replace(/\{ritualTitle\}/g, cleanRitualTitle)
    .replace(/\{ritualName\}/g, cleanRitualName)
    .replace(/\{meritPoints\}/g, String(Math.max(0, Math.round(vars.meritPoints || 0))))
    .replace(/\{giftCount\}\s*\{giftName\}/g, cleanRitualName)
    .replace(/\{giftName\}/g, cleanRitualName)
    .replace(/\{giftCount\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitizeCeremonialText(
    rendered,
    `Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử ${cleanName} đã phát tâm ${cleanRitualTitle}. Nguyện cầu bình an, phước lành và cát tường.`,
  );
}

export function renderCeremonialSubtitle(
  subtitleTemplate: string | undefined,
  vars: {
    username: string;
    ritualTitle: string;
    meritPoints?: number;
  },
): string {
  const cleanName = (vars.username || 'Phật tử').replace(/^@+/, '').trim() || 'Phật tử';
  const cleanTitle = sanitizeCeremonialText(vars.ritualTitle || 'CẦU BÌNH AN', 'CẦU BÌNH AN');
  const fallback = `Phật tử ${cleanName} thành tâm ${cleanTitle.toLowerCase()}`;
  const raw = (subtitleTemplate || '').trim() || fallback;
  const replaced = raw
    .replace(/\{username\}/g, cleanName)
    .replace(/\{ritualTitle\}/g, cleanTitle.toLowerCase())
    .replace(/\{meritPoints\}/g, String(Math.max(0, Math.round(vars.meritPoints || 0))))
    .replace(/\s+/g, ' ')
    .trim();
  return sanitizeCeremonialText(replaced, fallback);
}

export const RITUAL_ACTION_OPTIONS: { value: RitualActionType; labelVi: string }[] = [
  { value: 'altar_flower', labelVi: 'Dâng Hoa Trước Chánh Điện' },
  { value: 'altar_incense', labelVi: 'Dâng Hương Trầm Lư Đồng' },
  { value: 'altar_bell', labelVi: 'Thỉnh Chuông Đồng Ngân Vang' },
  { value: 'altar_fruit_tray', labelVi: 'Dâng Mâm Lễ Cầu Gia Đạo' },
  { value: 'altar_lotus_pedestal', labelVi: 'Thắp Đài Sen Cầu Tài Lộc' },
  { value: 'altar_pagoda', labelVi: 'Chiêm Bái Bảo Tháp Hào Quang' },
  { value: 'altar_grand_ceremony', labelVi: 'Đại Lễ Tam Bái Trang Nghiêm' },
  { value: 'altar_lantern', labelVi: 'Thả Hoa Đăng Hồ Sen' },
  { value: 'altar_pray_clasped', labelVi: 'Quỳ Chắp Tay Cầu Nguyện' },
  { value: 'altar_wooden_fish', labelVi: 'Tụng Nhịp Mõ Trước Tam Bảo' },
  { value: 'glowing_lotus', labelVi: 'Hoa Sen Phát Sáng Cát Tường' },
  { value: 'golden_light', labelVi: 'Cột Ánh Sáng Vàng Hào Quang' },
  { value: 'xin_xam', labelVi: 'Xin Xăm Cầu Nguyện Đầu Năm' },
  { value: 'seat_prayer', labelVi: 'Đảnh Lễ Chí Thành Tại Đệm' },
  { value: 'no_animation', labelVi: 'Chỉ Cộng Công Đức & Đọc Lời Chúc' },
];

export const CHARACTER_ANIMATION_OPTIONS: { value: GiftCharacterAnimType; labelVi: string }[] = [
  { value: 'walk_offer_bow', labelVi: 'Bước Lên Chánh Điện · Dâng Lễ & Vái Lạy' },
  { value: 'walk_light_incense', labelVi: 'Bước Lên Lư Đồng · Thắp Nén Tâm Hương' },
  { value: 'walk_ring_bell', labelVi: 'Bước Tới Giá Chuông · Thỉnh Chuông Chùa' },
  { value: 'walk_kneel_pray', labelVi: 'Bước Lên Bàn Thờ · Quỳ Chắp Tay Cầu Nguyện' },
  { value: 'walk_prostrate_3', labelVi: 'Bước Lên Chánh Điện · Tam Bái Chí Thành' },
  { value: 'walk_wooden_fish', labelVi: 'Bước Lên Chánh Điện · Gõ Mõ Cầu An' },
  { value: 'walk_xin_xam', labelVi: 'Bước Tới Bàn Xăm · Lắc Ống Tre Xin Quẻ' },
  { value: 'seated_pray', labelVi: 'Chắp Tay Cầu Nguyện Tại Đệm Ngồi' },
  { value: 'none', labelVi: 'Giữ Nguyên Tư Thế Thiền Hiện Tại' },
];

export const VISUAL_EFFECT_OPTIONS: { value: GiftEffectType; labelVi: string }[] = [
  { value: 'lotus_petals', labelVi: 'Mưa Cánh Hoa Sen Hồng Rơi Nhẹ' },
  { value: 'incense_smoke', labelVi: 'Khói Trầm Hương Thanh Tịnh Lan Tỏa' },
  { value: 'bell_waves', labelVi: 'Sóng Âm Chuông Vàng Lan Tỏa' },
  { value: 'golden_particles', labelVi: 'Hạt Ánh Vàng Ấm Quanh Mâm Lễ' },
  { value: 'glowing_lotus', labelVi: 'Đài Sen Phát Sáng Tỏa Hào Quang' },
  { value: 'golden_light', labelVi: 'Cột Hào Quang Ánh Vàng Tâm Linh' },
  { value: 'altar_blessing', labelVi: 'Phước Lành Chánh Điện Rực Sáng' },
  { value: 'grand_ceremony', labelVi: 'Đại Hào Quang Bảo Tháp & Mưa Sen Vàng' },
  { value: 'floating_lantern', labelVi: 'Hoa Đăng Tỏa Sáng Lung Linh' },
  { value: 'none', labelVi: 'Không Hiển Thị Hiệu Ứng Hạt' },
];

export const SOUND_EFFECT_OPTIONS: { value: GiftSoundEffectType; labelVi: string }[] = [
  { value: 'offering_chime', labelVi: 'Tiếng Chuông Khánh Thanh Nhẹ' },
  { value: 'temple_bell', labelVi: 'Tiếng Đại Hồng Chung Ngân Sâu' },
  { value: 'grand_ceremony_bell', labelVi: 'Hồi Chuông Đại Lễ Trang Nghiêm' },
  { value: 'wooden_fish', labelVi: 'Tiếng Mõ Tụng Kinh Thanh Tịnh' },
  { value: 'incense_chime', labelVi: 'Tiếng Khánh Trầm Hương' },
  { value: 'lotus_chime', labelVi: 'Tiếng Chuông Đài Sen' },
  { value: 'lantern_chime', labelVi: 'Tiếng Chuông Hoa Đăng' },
  { value: 'none', labelVi: 'Không Phát Âm Hiệu Nghi Lễ' },
];

export const VOICE_PRIORITY_OPTIONS: { value: AnnouncementPriority; labelVi: string }[] = [
  { value: AnnouncementPriority.LARGE_GIFT, labelVi: 'Ưu Tiên #1 — Đại Lễ Công Đức Cao Nhất' },
  { value: AnnouncementPriority.XIN_XAM, labelVi: 'Ưu Tiên #2 — Xin Xăm Cầu Nguyện' },
  { value: AnnouncementPriority.NORMAL_GIFT, labelVi: 'Ưu Tiên #3 — Nghi Lễ Cầu An Chuẩn' },
  { value: AnnouncementPriority.SPECIAL_RITUAL, labelVi: 'Ưu Tiên #4 — Nghi Lễ Thông Thường' },
];

export function getRitualDisplayNameVi(ritualType: RitualActionType): string {
  const found = RITUAL_ACTION_OPTIONS.find((o) => o.value === ritualType);
  return found ? found.labelVi : 'Lễ Phật cầu an';
}

export const DEFAULT_GIFT_ACTION_PRESETS: GiftActionPreset[] = [
  {
    presetId: 'preset_cau_binh_an',
    name: 'Nghi Lễ Cầu Bình An',
    description: 'Bước lên bàn thờ dâng hoa tươi, vái lạy trang nghiêm và mưa cánh hoa sen.',
    ritualTitle: 'CẦU BÌNH AN',
    ritualSubtitle: 'Phật tử {username} thành tâm cầu bình an',
    ritualType: 'altar_flower',
    characterAnimation: 'walk_offer_bow',
    effect: 'lotus_petals',
    soundEffect: 'offering_chime',
    ttsTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã phát tâm cầu bình an. Nguyện cầu bình an, phước lành và cát tường.',
    voiceTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã phát tâm cầu bình an. Nguyện cầu bình an, phước lành và cát tường.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 40,
    animationDurationSec: 4.5,
    cooldownSec: 1.5,
    isBuiltin: true,
  },
  {
    presetId: 'preset_thinh_chuong',
    name: 'Nghi Lễ Thỉnh Chuông Cầu Sức Khỏe',
    description: 'Bước sang giá chuông đồng bên phải chánh điện và thỉnh chuông ngân vang.',
    ritualTitle: 'CẦU SỨC KHỎE',
    ritualSubtitle: 'Phật tử {username} thỉnh chuông cầu sức khỏe an khang',
    ritualType: 'altar_bell',
    characterAnimation: 'walk_ring_bell',
    effect: 'bell_waves',
    soundEffect: 'temple_bell',
    ttsTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã thỉnh chuông cầu sức khỏe. Nguyện cầu thân tâm an lạc, tật bệnh tiêu trừ.',
    voiceTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã thỉnh chuông cầu sức khỏe. Nguyện cầu thân tâm an lạc, tật bệnh tiêu trừ.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 50,
    animationDurationSec: 5.0,
    cooldownSec: 2.0,
    isBuiltin: true,
  },
  {
    presetId: 'preset_cau_gia_dao',
    name: 'Nghi Lễ Cầu Gia Đạo',
    description: 'Bước lên bàn lễ dâng mâm lễ cầu gia đình ấm êm, phúc lộc sum vầy.',
    ritualTitle: 'CẦU GIA ĐẠO',
    ritualSubtitle: 'Phật tử {username} thành tâm cầu gia đạo bình an',
    ritualType: 'altar_fruit_tray',
    characterAnimation: 'walk_offer_bow',
    effect: 'golden_particles',
    soundEffect: 'offering_chime',
    ttsTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã phát tâm cầu gia đạo. Nguyện cầu gia đình hòa thuận, phúc lộc sum vầy.',
    voiceTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã phát tâm cầu gia đạo. Nguyện cầu gia đình hòa thuận, phúc lộc sum vầy.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 60,
    animationDurationSec: 5.2,
    cooldownSec: 2.0,
    isBuiltin: true,
  },
  {
    presetId: 'preset_dai_sen_tai_loc',
    name: 'Nghi Lễ Đài Sen Cầu Tài Lộc',
    description: 'Thắp sáng đài sen vàng trước Tam Bảo với hiệu ứng hoa sen nở rộ.',
    ritualTitle: 'CẦU TÀI LỘC',
    ritualSubtitle: 'Phật tử {username} dâng đăng sen cầu tài lộc hanh thông',
    ritualType: 'altar_lotus_pedestal',
    characterAnimation: 'walk_offer_bow',
    effect: 'glowing_lotus',
    soundEffect: 'temple_bell',
    ttsTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã phát tâm cầu tài lộc. Nguyện cầu trí tuệ sáng soi, sở cầu như ý.',
    voiceTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm cảm tạ công đức của Phật tử {username} đã phát tâm cầu tài lộc. Nguyện cầu trí tuệ sáng soi, sở cầu như ý.',
    voicePriority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 85,
    animationDurationSec: 5.8,
    cooldownSec: 1.5,
    isBuiltin: true,
  },
  {
    presetId: 'preset_dai_le_bao_thap',
    name: 'Đại Lễ Bảo Tháp Công Đức',
    description: 'Đại lễ trang nghiêm nhất: thỉnh hồi chuông đại hồng chung, hào quang tượng Phật & mưa sen vàng.',
    ritualTitle: 'CẦU CÔNG ĐỨC',
    ritualSubtitle: 'Phật tử {username} phát tâm đại lễ cầu công đức viên mãn',
    ritualType: 'altar_pagoda',
    characterAnimation: 'walk_prostrate_3',
    effect: 'grand_ceremony',
    soundEffect: 'grand_ceremony_bell',
    ttsTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm tán thán đại công đức của Phật tử {username} trong nghi lễ cầu công đức. Nguyện cầu gia đạo hưng long, vạn sự cát tường như ý.',
    voiceTemplate:
      'Nam Mô A Di Đà Phật. Xin thành tâm tán thán đại công đức của Phật tử {username} trong nghi lễ cầu công đức. Nguyện cầu gia đạo hưng long, vạn sự cát tường như ý.',
    voicePriority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 100,
    animationDurationSec: 6.5,
    cooldownSec: 1.0,
    isBuiltin: true,
  },
];

export const DEFAULT_GIFT_MAPPINGS: GiftMapping[] = [
  {
    id: '5655',
    giftId: '5655',
    giftName: 'Rose',
    vietnameseLabel: 'Hoa Hồng',
    ceremonyTitle: 'CẦU BÌNH AN',
    ritualTitle: 'CẦU BÌNH AN',
    ritualSubtitle: 'Phật tử {username} cầu bình an',
    badgeCeremonyLabel: 'DÂNG HOA CẦU BÌNH AN',
    iconType: 'rose',
    referenceCoins: 1,
    points: 20,
    isLarge: false,
    ritualType: 'altar_flower',
    characterAnimation: 'walk_offer_bow',
    effect: 'lotus_petals',
    soundEffect: 'offering_chime',
    ttsTemplate: 'Phật tử {username} cầu bình an.',
    voiceTemplate: 'Phật tử {username} cầu bình an.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 40,
    animationDurationSec: 4.4,
    cooldownSec: 1.5,
    enabled: true,
    showInOverlayPanel: true,
  },
  {
    id: '8910',
    giftId: '8910',
    giftName: 'Bronze Bell',
    vietnameseLabel: 'Chuông Đồng',
    ceremonyTitle: 'CẦU SỨC KHỎE',
    ritualTitle: 'CẦU SỨC KHỎE',
    ritualSubtitle: 'Phật tử {username} cầu sức khỏe',
    badgeCeremonyLabel: 'THỈNH CHUÔNG CẦU SỨC KHỎE',
    iconType: 'bell',
    referenceCoins: 10,
    points: 120,
    isLarge: false,
    ritualType: 'altar_bell',
    characterAnimation: 'walk_ring_bell',
    effect: 'bell_waves',
    soundEffect: 'temple_bell',
    ttsTemplate: 'Phật tử {username} cầu sức khỏe.',
    voiceTemplate: 'Phật tử {username} cầu sức khỏe.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 50,
    animationDurationSec: 4.9,
    cooldownSec: 1.5,
    enabled: true,
    showInOverlayPanel: true,
  },
  {
    id: '6093',
    giftId: '6093',
    giftName: 'Fruit Tray',
    vietnameseLabel: 'Mâm Quả',
    ceremonyTitle: 'CẦU GIA ĐẠO',
    ritualTitle: 'CẦU GIA ĐẠO',
    ritualSubtitle: 'Phật tử {username} cầu gia đạo',
    badgeCeremonyLabel: 'DÂNG LỄ CẦU GIA ĐẠO',
    iconType: 'fruit',
    referenceCoins: 30,
    points: 350,
    isLarge: false,
    ritualType: 'altar_fruit_tray',
    characterAnimation: 'walk_offer_bow',
    effect: 'golden_particles',
    soundEffect: 'offering_chime',
    ttsTemplate: 'Phật tử {username} cầu gia đạo.',
    voiceTemplate: 'Phật tử {username} cầu gia đạo.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 60,
    animationDurationSec: 5.1,
    cooldownSec: 1.5,
    enabled: true,
    showInOverlayPanel: true,
  },
  {
    id: '5827',
    giftId: '5827',
    giftName: 'Lotus Lamp',
    vietnameseLabel: 'Đài Sen',
    ceremonyTitle: 'CẦU TÀI LỘC',
    ritualTitle: 'CẦU TÀI LỘC',
    ritualSubtitle: 'Phật tử {username} cầu tài lộc',
    badgeCeremonyLabel: 'DÂNG ĐÀI SEN CẦU TÀI LỘC',
    iconType: 'lotus',
    referenceCoins: 99,
    points: 1000,
    isLarge: true,
    ritualType: 'altar_lotus_pedestal',
    characterAnimation: 'walk_offer_bow',
    effect: 'glowing_lotus',
    soundEffect: 'temple_bell',
    ttsTemplate: 'Phật tử {username} cầu tài lộc. Kính chúc gia đình luôn an lành.',
    voiceTemplate: 'Phật tử {username} cầu tài lộc. Kính chúc gia đình luôn an lành.',
    voicePriority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 90,
    animationDurationSec: 5.6,
    cooldownSec: 1.2,
    enabled: true,
    showInOverlayPanel: true,
  },
  {
    id: '29201',
    giftId: '29201',
    giftName: 'Sacred Pagoda',
    vietnameseLabel: 'Bảo Tháp',
    ceremonyTitle: 'CẦU CÔNG ĐỨC',
    ritualTitle: 'CẦU CÔNG ĐỨC',
    ritualSubtitle: 'Phật tử {username} cầu công đức',
    badgeCeremonyLabel: 'CHIÊM BÁI BẢO THÁP CÔNG ĐỨC',
    iconType: 'pagoda',
    referenceCoins: 199,
    points: 2500,
    isLarge: true,
    ritualType: 'altar_pagoda',
    characterAnimation: 'walk_prostrate_3',
    effect: 'grand_ceremony',
    soundEffect: 'grand_ceremony_bell',
    ttsTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
    voiceTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
    voicePriority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 100,
    animationDurationSec: 6.2,
    cooldownSec: 1.0,
    enabled: true,
    showInOverlayPanel: true,
  },
];

export const DEFAULT_PEACEFUL_MESSAGES: string[] = [
  'Nguyện đem công đức này, hướng về khắp tất cả, đệ tử và chúng sinh, đều trọn thành Phật đạo.',
  'Tâm bình thế giới bình, lòng an vạn sự lành. Kính chúc đại chúng một buổi tối thanh tịnh.',
  'Mỗi nhịp mõ ngân vang là một niệm thiện lành gửi đến gia đình và người thân yêu.',
  'Giữa dòng đời vạn biến, giữ tâm bất biến, nụ cười từ bi mở rộng muôn phương.',
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  autoNarrationEnabled: true,
  provider: 'vieneu',
  vieneuMode: 'cloud',
  vieneuModel: 'vieneu-v4',
  localEndpoint: 'http://127.0.0.1:8000/v1/audio/speech',
  voiceId: 'Ngọc Lan',
  gender: 'female',
  speed: 0.94,
  volume: 0.9,
  browserFallbackEnabled: true,
  giftAnnouncementsEnabled: true,
  xinXamAnnouncementsEnabled: true,
  followAnnouncementsEnabled: true,
  commentVoiceEnabled: true,
  commentVoiceFormula: DEFAULT_COMMENT_VOICE_FORMULA,
  commentTemplates: DEFAULT_COMMENT_TEMPLATES,
  welcomeTemplate: 'Chào mừng Phật tử {username} đã đến với Chùa Online. Kính chúc bạn luôn bình an.',
  commentCooldownSec: 5,
  cooldownMs: 3500,
  perUserCommentCooldownSec: 16,
  maxCommentLength: 90,
  maxCommentQueueSize: 5,
  staleCommentTimeoutSec: 20,
  blockSpamLinksAndUnsafe: true,
  giftInterruptPolicy: 'interrupt_comments',
  prayerAnnouncementsEnabled: true,
  commentAnnouncementsEnabled: true,
  welcomeAnnouncementsEnabled: false,
  backgroundNarrationEnabled: true,
  backgroundIntervalSec: 45,
  useAiPeacefulMessages: true,
  bgMusicEnabled: true,
  bgMusicVolume: 0.22,
  customPeacefulMessages: DEFAULT_PEACEFUL_MESSAGES,
};

export const DEFAULT_OVERLAY_SETTINGS: StreamOverlaySettings = {
  vertical916: true,
  obsCleanView: false,
  effectsEnabled: true,
  showLeaderboard: true,
  showGiftPanel: true,
  showXinXamPanel: true,
  showLotusAvatars: true,
  showCenterCeremonyPanel: true,
  showLotusFallingEffect: true,
  showAvatarInCenterPanel: true,
  showEventBar: true,
  showNotifications: true,
  showUsernames: true,
  showCommentBubbles: true,
  panelScale: 0.86,
  panelOpacity: 0.45,
  lotusParticleDensity: 1.0,
  petalCount: 38,
  leafCount: 14,
  centerPanelDuration: 3400,
  maxParticipants: 104,
  maxConcurrentCeremonies: 4,
  quality: 'medium',
  buddhaModelUrl: '',
  buddhaGoldOverride: true,
  inactivityTimeoutEnabled: true,
  inactivityTimeoutSec: 120,
  demoAcceleratedTimeout: false,
};

declare global {
  interface Window {
    handleTikTokEvent?: (event: Partial<TikTokNormalizedEvent>) => void;
    isSoftwareGl?: boolean;
  }
}
