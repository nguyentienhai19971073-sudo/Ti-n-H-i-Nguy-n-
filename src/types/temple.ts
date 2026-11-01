export enum ConnectionStatus {
  DEMO = 'DEMO',
  CONNECTING = 'CONNECTING',
  LIVE = 'LIVE',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export type TikTokEventType =
  | 'comment'
  | 'gift'
  | 'like'
  | 'follow'
  | 'share'
  | 'join'
  | 'leave';

export interface TikTokNormalizedEvent {
  eventId: string;
  type: TikTokEventType;
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  comment?: string;
  giftId?: string | number;
  giftName?: string;
  giftPictureUrl?: string;
  giftCount?: number;
  totalStreakCount?: number;
  giftType?: number;
  diamondCount?: number;
  repeatEnd?: boolean;
  streakKey?: string;
  isStreakCompletionOnly?: boolean;
  likeCount?: number;
  cumulativeUserLikes?: number;
  verifiedBackend?: boolean;
  isDemo: boolean;
  timestamp: number;
}

/**
 * Supports all ceremony actions including the 11 dynamic admin-configurable options:
 * - altar_flower: Dâng hoa
 * - altar_incense: Thắp hương
 * - altar_bell: Thỉnh chuông
 * - altar_fruit_tray: Dâng mâm quả
 * - altar_lotus_pedestal: Dâng đài sen
 * - altar_pray_clasped: Chắp tay lễ Phật
 * - altar_wooden_fish: Gõ mõ
 * - altar_grand_ceremony / altar_pagoda: Đại lễ
 * - glowing_lotus: Hoa sen phát sáng
 * - golden_light: Hiệu ứng ánh sáng vàng
 * - no_animation: No animation
 * Plus built-in social/like rituals: altar_lantern, seat_wooden_fish, seat_prayer
 */
export type RitualActionType =
  | 'altar_flower'
  | 'altar_incense'
  | 'altar_bell'
  | 'altar_fruit_tray'
  | 'altar_lotus_pedestal'
  | 'altar_pray_clasped'
  | 'altar_wooden_fish'
  | 'altar_grand_ceremony'
  | 'altar_pagoda'
  | 'glowing_lotus'
  | 'golden_light'
  | 'no_animation'
  | 'altar_lantern'
  | 'seat_wooden_fish'
  | 'seat_prayer';

export type GiftCharacterAnimType =
  | 'walk_offer_bow'
  | 'walk_kneel_pray'
  | 'walk_prostrate_3'
  | 'walk_ring_bell'
  | 'walk_wooden_fish'
  | 'seated_pray'
  | 'none';

export type GiftEffectType =
  | 'lotus_petals'
  | 'glowing_lotus'
  | 'golden_light'
  | 'golden_particles'
  | 'altar_blessing'
  | 'incense_smoke'
  | 'floating_lantern'
  | 'bell_waves'
  | 'grand_ceremony'
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

export type GiftAnimType = 'offering' | 'gift_blessing' | 'bowing';

export type GiftIconType =
  | 'rose'
  | 'bell'
  | 'fruit'
  | 'lotus'
  | 'pagoda'
  | 'incense'
  | 'prayer'
  | 'wooden_fish'
  | 'light';

export type AltarStationId =
  | 'incense_center'
  | 'incense_left'
  | 'incense_right'
  | 'flower_left'
  | 'flower_right'
  | 'fruit_left'
  | 'fruit_right'
  | 'lotus_left'
  | 'lotus_right'
  | 'lantern_left'
  | 'lantern_right'
  | 'bell_right'
  | 'grand_center';

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
  stationId?: AltarStationId;
  targetX: number;
  targetZ: number;
  faceRotY: number;
  outboundLaneX: number;
  returnLaneX: number;
  startedAt: number;
  durationMs: number;
}

export type WoodenFishMilestoneTier = 'like_10' | 'like_100' | 'like_1000';

export interface ActiveWoodenFishAction {
  id: string;
  tier: WoodenFishMilestoneTier;
  strikeCount: number; // 1 strike (10 likes), 3 strikes (100 likes), 6 ceremonial strikes (1000 likes)
  cumulativeLikes: number;
  startedAt: number;
  durationMs: number;
}

export type CharacterAnimState =
  | 'walking_aisle'
  | 'turning_row'
  | 'walking_row'
  | 'turning_altar'
  | 'kneeling'
  | 'bowing'
  | 'sitting'
  | 'praying'
  | 'wooden_fish'
  | 'offering'
  | 'gift_blessing'
  | 'leaving_seat_to_aisle'
  | 'walking_to_altar'
  | 'performing_altar_ritual'
  | 'returning_from_altar'
  | 'returning_row'
  | 'departing_standing'
  | 'departing_row'
  | 'departing_exit'
  | 'departing_fade';

export interface Participant {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  seatIndex: number; // 0..199 main mats inside 9:16 frame, >= 200 optimized virtual/secondary gallery
  laneOffset: number;
  points: number;
  giftCount: number;
  commentCount: number;
  totalLikes: number;
  woodenFishStrikes: number;
  animState: CharacterAnimState;
  animStateStartedAt: number;
  activeRitual?: ActiveCharacterRitual | null;
  activeWoodenFish?: ActiveWoodenFishAction | null;
  ritualStatusLabel?: string;
  ritualStatusUntil?: number;
  lastComment?: string;
  lastCommentAt?: number;
  lastCommentId?: string;
  lastGiftName?: string;
  lastGiftAt?: number;
  lastActivityAt: number;
  lastInteractionAt: number; // Independent 120s inactivity timer anchor per participant
  isDeparting?: boolean;
  departingStartedAt?: number;
  robeHueShift: number;
  hasHairBun: boolean;
  isDemo: boolean;
}

/**
 * Persistent LIVE-session merit & gift history entry.
 * Preserved in "BẢNG CÔNG ĐỨC" even after an inactive user walks out of the 3D temple!
 */
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

export interface LotusCeremonyBadge {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  ceremonyTitle: string;
  offeringLabel: string;
  side: 'left' | 'right';
  startedAt: number;
  expiresAt: number;
}

/**
 * Strict 6-Tier Centralized Audio Queue Priority (Lower number = Higher priority)
 */
export enum AnnouncementPriority {
  LARGE_GIFT = 1,       // 1. Large TikTok gifts and major ceremonies
  NORMAL_GIFT = 2,      // 2. Normal TikTok gifts
  SPECIAL_RITUAL = 3,   // 3. Special ritual announcements (1000-Like Gõ Mõ, Follow, Share, Welcome)
  PRAYER_COMMENT = 4,   // 4. Prayer comments (Bình an, Sức khỏe, Tài lộc, Tình duyên, Gia đạo, Học hành)
  ORDINARY_COMMENT = 5, // 5. Ordinary approved comments
  BACKGROUND = 6,       // 6. Background Buddhist narration
}

/**
 * Dynamic TikTok Gift Configuration
 * Primary lookup key: normalized `giftId` string.
 * Gift names (`giftName`, `vietnameseLabel`) are display-only and never assumed unique.
 */
export interface GiftMapping {
  id: string; // Stable internal key (synchronized with normalized giftId for new entries)
  giftId: string; // Required unique TikTok Gift ID string (primary runtime lookup key)
  giftName: string; // TikTok Gift Name (admin reference info only)
  vietnameseLabel: string; // Display Name in Vietnamese
  ceremonyTitle: string; // Short prayer intention header, e.g. "CẦU BÌNH AN"
  ritualTitle: string; // Center ceremonial announcement title, e.g. "CẦU BÌNH AN"
  ritualSubtitle: string; // Ceremonial subtitle template, e.g. "Phật tử {username} cầu bình an"
  badgeCeremonyLabel: string; // Floating lotus badge title, e.g. "LỄ PHẬT CẦU AN"
  iconType: GiftIconType; // Built-in vector offering icon fallback
  iconUrl?: string; // Optional external icon/image URL or emoji
  uploadedImageData?: string; // Optional uploaded image data URI (<= 250KB)
  referenceCoins: number; // Coin value (configurable reference information)
  points: number; // Merit points awarded per completed event
  isLarge: boolean; // Major ceremonial event flag
  ritualType: RitualActionType; // Associated ritual action
  characterAnimation: GiftCharacterAnimType; // Associated character animation
  effect: GiftEffectType; // Visual effect
  soundEffect: GiftSoundEffectType; // Sound effect
  ttsTemplate: string; // VieNeuTTS ceremonial narration template (kept synced with voiceTemplate)
  voiceTemplate: string; // Ceremonial voice template (zero gift words, e.g. "Phật tử {username} cầu bình an.")
  voicePriority: AnnouncementPriority; // 1 = Major Ceremony, 2 = Normal Ritual, 3 = Special Ritual
  queuePriority: number; // Numeric sub-priority (1..100, higher = higher priority in center & voice queues)
  animationDurationSec: number; // Ceremony duration in seconds
  cooldownSec: number; // Per-ritual ceremony/voice cooldown in seconds
  enabled: boolean; // Enabled / Disabled status
  showInOverlayPanel?: boolean; // Optional toggle for compact corner reference panel
  animation?: GiftAnimType; // Legacy compatibility field
  updatedAt?: number;
}

/**
 * Reusable Custom Event-Action Preset (Data-only — never arbitrary JS!)
 */
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
  updatedAt: number;
}

/**
 * Unmapped / Unknown Incoming TikTok Gift logged for 1-click admin mapping in "QUÀ CHƯA CẤU HÌNH"
 */
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

/**
 * Live Ceremony Queue Inspection Snapshot for Demo Mode & Admin Diagnostics
 */
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
  status: 'executed' | 'cooldown_throttled' | 'disabled' | 'unknown' | 'streak_update';
  isDemo: boolean;
  timestamp: number;
}

export type TTSProviderType = 'vieneu' | 'browser' | 'elevenlabs' | 'openai' | 'gemini';
export type VieNeuMode = 'cloud' | 'local';
export type GiftInterruptPolicy = 'interrupt_comments' | 'finish_current';

export interface VieNeuVoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'female' | 'male' | string;
  region?: string;
  engine?: string;
  recommended?: boolean;
}

export type VoiceApiConnectionState =
  | 'untested'
  | 'testing'
  | 'connected'
  | 'fallback'
  | 'error';

export interface CommentVoiceTemplates {
  binhAn: string;
  sucKhoe: string;
  taiLoc: string;
  tinhDuyen: string;
  giaDao: string;
  hocHanh: string;
  general: string;
}

export interface VoiceSettings {
  provider: TTSProviderType;
  vieneuMode: VieNeuMode;
  vieneuModel: string;
  localEndpoint: string;
  endpoint: string;
  voiceId: string;
  gender: 'female' | 'male';
  volume: number;
  speed: number;
  browserFallbackEnabled: boolean;
  bgMusicEnabled: boolean;
  bgMusicVolume: number;
  autoNarrationEnabled: boolean;
  giftAnnouncementsEnabled: boolean;
  giftInterruptPolicy: GiftInterruptPolicy;
  welcomeAnnouncementsEnabled: boolean;
  welcomeTemplate: string;
  commentVoiceEnabled: boolean;
  commentVoiceFormula: string;
  commentCooldownSec: number;
  perUserCommentCooldownSec: number;
  maxCommentLength: number;
  maxCommentQueueSize: number;
  staleCommentTimeoutSec: number;
  blockSpamLinksAndUnsafe: boolean;
  prayerAnnouncementsEnabled: boolean;
  commentAnnouncementsEnabled: boolean;
  commentTemplates: CommentVoiceTemplates;
  followAnnouncementsEnabled: boolean;
  backgroundNarrationEnabled: boolean;
  backgroundIntervalSec: number;
  useAiPeacefulMessages: boolean;
  cooldownMs: number;
  customPeacefulMessages: string[];
}

export type QualityPreset = 'low' | 'medium' | 'high';

export type BuddhaModelLoadStatus = 'builtin' | 'loading' | 'loaded' | 'fallback_error';

export interface StreamOverlaySettings {
  vertical916: boolean;
  obsCleanView: boolean;
  panelScale: number; // Global compact UI scale factor (0.75..1.15, default 0.90)
  panelOpacity: number; // Global RGBA background alpha (0.25..0.92, default 0.55 in 0.50-0.60 range)
  showLeaderboard: boolean;
  showGiftPanel: boolean;
  showLotusAvatars: boolean;
  showEventBar: boolean;
  showCommentBubbles: boolean;
  showNotifications: boolean;
  showUsernames: boolean;
  maxParticipants: number;
  maxConcurrentCeremonies: number;
  inactivityTimeoutEnabled: boolean;
  inactivityTimeoutSec: number; // Production default: 120 seconds
  demoAcceleratedTimeout: boolean; // Demo-only accelerated test option (e.g. 12s) without altering 120s default
  buddhaModelUrl: string; // Optional external/local GLB or GLTF Buddha statue path
  buddhaGoldOverride: boolean;
  quality: QualityPreset;
  effectsEnabled: boolean;
  // Ceremonial Lotus Shower & Center Announcement Panel Settings
  lotusParticleDensity: number; // Multiplier 0.3..2.5 (default 1.15)
  petalCount: number; // Falling lotus petals per ceremony (8..120, default 44)
  leafCount: number; // Falling lotus leaves per ceremony (2..60, default 16)
  centerPanelDuration: number; // Center announcement duration in ms (1200..10000, default 3400)
  showAvatarInCenterPanel: boolean; // Show circular TikTok avatar ONLY inside CenterCeremonialPanel
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

export interface FeedNotification {
  id: string;
  kind:
    | 'welcome'
    | 'comment'
    | 'prayer'
    | 'gift'
    | 'large_gift'
    | 'follow'
    | 'share'
    | 'like'
    | 'ritual'
    | 'system';
  username: string;
  avatarUrl?: string;
  message: string;
  pointsDelta?: number;
  isDemo: boolean;
  timestamp: number;
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

export interface ServerConnectionSnapshot {
  status: ConnectionStatus;
  tiktokUsername: string;
  roomId?: string;
  viewerCount?: number;
  incomingEventCount: number;
  lastError?: string;
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

/**
 * Normalizes any incoming TikTok Gift ID into a canonical trimmed string.
 */
export function normalizeGiftId(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

export const RITUAL_ACTION_OPTIONS: {
  value: RitualActionType;
  labelVi: string;
  shortVi: string;
}[] = [
  { value: 'altar_flower', labelVi: 'Dâng hoa', shortVi: 'Dâng hoa' },
  { value: 'altar_incense', labelVi: 'Thắp hương', shortVi: 'Thắp hương' },
  { value: 'altar_bell', labelVi: 'Thỉnh chuông', shortVi: 'Thỉnh chuông' },
  { value: 'altar_fruit_tray', labelVi: 'Dâng mâm quả', shortVi: 'Dâng mâm quả' },
  { value: 'altar_lotus_pedestal', labelVi: 'Dâng đài sen', shortVi: 'Dâng đài sen' },
  { value: 'altar_pray_clasped', labelVi: 'Chắp tay lễ Phật', shortVi: 'Chắp tay lễ Phật' },
  { value: 'altar_wooden_fish', labelVi: 'Gõ mõ', shortVi: 'Gõ mõ' },
  { value: 'altar_grand_ceremony', labelVi: 'Đại lễ', shortVi: 'Đại lễ' },
  { value: 'glowing_lotus', labelVi: 'Hoa sen phát sáng', shortVi: 'Hoa sen phát sáng' },
  { value: 'golden_light', labelVi: 'Hiệu ứng ánh sáng vàng', shortVi: 'Ánh sáng vàng' },
  { value: 'no_animation', labelVi: 'No animation (Không chuyển động)', shortVi: 'No animation' },
];

export const CHARACTER_ANIMATION_OPTIONS: {
  value: GiftCharacterAnimType;
  labelVi: string;
}[] = [
  { value: 'walk_offer_bow', labelVi: 'Đi lên bàn thờ dâng lễ & cúi lạy' },
  { value: 'walk_kneel_pray', labelVi: 'Đi lên quỳ chắp tay lễ Phật' },
  { value: 'walk_prostrate_3', labelVi: 'Đại lễ Tam Bái (3 lạy trang nghiêm)' },
  { value: 'walk_ring_bell', labelVi: 'Đi lên thỉnh chuông đồng' },
  { value: 'walk_wooden_fish', labelVi: 'Quỳ gõ mõ tụng kinh trước Phật đài' },
  { value: 'seated_pray', labelVi: 'Chắp tay cầu nguyện tại đệm ngồi' },
  { value: 'none', labelVi: 'Không chuyển động (Giữ nguyên vị trí)' },
];

export const VISUAL_EFFECT_OPTIONS: {
  value: GiftEffectType;
  labelVi: string;
}[] = [
  { value: 'lotus_petals', labelVi: 'Cánh hoa sen hồng bay' },
  { value: 'glowing_lotus', labelVi: 'Hoa sen phát sáng rực rỡ' },
  { value: 'golden_light', labelVi: 'Hiệu ứng ánh sáng vàng chiếu rọi' },
  { value: 'golden_particles', labelVi: 'Hạt kim sa vàng lấp lánh' },
  { value: 'incense_smoke', labelVi: 'Khói trầm hương linh thiêng' },
  { value: 'bell_waves', labelVi: 'Sóng âm chuông đồng ngân vang' },
  { value: 'floating_lantern', labelVi: 'Hoa đăng tỏa sáng' },
  { value: 'grand_ceremony', labelVi: 'Đại lễ hào quang Tam Bảo' },
  { value: 'none', labelVi: 'Không hiệu ứng hình ảnh' },
];

export const SOUND_EFFECT_OPTIONS: {
  value: GiftSoundEffectType;
  labelVi: string;
}[] = [
  { value: 'offering_chime', labelVi: 'Chuông tịnh tâm nhẹ nhàng' },
  { value: 'temple_bell', labelVi: 'Đại hồng chung ngân vang' },
  { value: 'grand_ceremony_bell', labelVi: 'Đại hồng chung & Khánh đồng đại lễ' },
  { value: 'wooden_fish', labelVi: 'Tiếng gõ mõ chùa cổ truyền' },
  { value: 'incense_chime', labelVi: 'Chuông gia trì thắp hương' },
  { value: 'lotus_chime', labelVi: 'Chuông pha lê đài sen' },
  { value: 'lantern_chime', labelVi: 'Chuông nước hoa đăng' },
  { value: 'none', labelVi: 'Không âm thanh hiệu ứng' },
];

export const VOICE_PRIORITY_OPTIONS: {
  value: AnnouncementPriority;
  labelVi: string;
}[] = [
  { value: AnnouncementPriority.LARGE_GIFT, labelVi: 'Ưu tiên 1 — Đại lễ trang nghiêm (Cao nhất)' },
  { value: AnnouncementPriority.NORMAL_GIFT, labelVi: 'Ưu tiên 2 — Nghi lễ cầu an thường' },
  { value: AnnouncementPriority.SPECIAL_RITUAL, labelVi: 'Ưu tiên 3 — Nghi lễ tâm thành' },
];

export function getRitualDisplayNameVi(ritualType: RitualActionType): string {
  if (ritualType === 'altar_pagoda') return 'Đại lễ';
  if (ritualType === 'altar_lantern') return 'Thả hoa đăng';
  if (ritualType === 'seat_wooden_fish') return 'Gõ mõ';
  if (ritualType === 'seat_prayer') return 'Chắp tay lễ Phật';
  const found = RITUAL_ACTION_OPTIONS.find((o) => o.value === ritualType);
  return found ? found.shortVi : 'Lễ Phật';
}

const FORBIDDEN_GIFT_WORDS_PATTERN =
  /(?:^|[^\p{L}\p{N}])(tặng\s+quà|đã\s+gửi\s+quà|gửi\s+quà|quà\s+tặng|quà|sent\s+a\s+gift|gifts?)(?=$|[^\p{L}\p{N}])/iu;

const LEGACY_GIFT_TEMPLATE_PATTERN =
  /(đã\s+gửi\s+\{giftName\}|đã\s+dâng\s+\{giftName\}|cúng\s+dường\s+\{giftName\})/iu;

/**
 * Checks whether a string contains any forbidden gift words ("tặng quà", "quà", "gift", "đã gửi quà", "sent a gift")
 * using Unicode syllable boundaries so legitimate Buddhist words like "Mâm Quả" or "nhân quả" remain untouched.
 */
export function containsForbiddenGiftWords(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return FORBIDDEN_GIFT_WORDS_PATTERN.test(String(raw).normalize('NFC'));
}

export function isLegacyGiftWordTemplate(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const nfc = String(raw).normalize('NFC');
  return FORBIDDEN_GIFT_WORDS_PATTERN.test(nfc) || LEGACY_GIFT_TEMPLATE_PATTERN.test(nfc);
}

/**
 * Strips any forbidden gift wording from ceremonial announcements, subtitles, and voice narration
 * so CHÙA ONLINE strictly speaks and displays sacred prayer intentions.
 */
export function sanitizeCeremonialText(
  raw: string | undefined | null,
  fallback = 'Cầu bình an',
): string {
  if (!raw) return fallback;
  const cleaned = String(raw)
    .normalize('NFC')
    .replace(
      /(^|[^\p{L}\p{N}])(đã\s+gửi\s+quà\s+tặng|đã\s+gửi\s+quà|gửi\s+quà\s+tặng|gửi\s+quà|tặng\s+quà|quà\s+tặng|sent\s+a\s+gift|gifts?|quà)(?=$|[^\p{L}\p{N}])/giu,
      '$1thành tâm hành lễ',
    )
    .replace(/(thành tâm hành lễ\s*){2,}/giu, 'thành tâm hành lễ ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export interface CanonicalCeremonialDefaults {
  ritualTitle: string;
  ritualSubtitle: string;
  voiceTemplate: string;
  queuePriority: number;
}

/**
 * Resolves exact canonical Buddhist ceremonial title, subtitle, voice template & queuePriority
 * for any mapped TikTok ritual event without ever mentioning gifts.
 */
export function inferCanonicalCeremonialDefaults(params: {
  giftId?: string;
  ritualType?: RitualActionType;
  ceremonyTitle?: string;
  isLarge?: boolean;
}): CanonicalCeremonialDefaults {
  const gid = normalizeGiftId(params.giftId);
  const titleUpper = (params.ceremonyTitle || '').normalize('NFC').toUpperCase();

  if (gid === '5655' || titleUpper.includes('BÌNH AN') || params.ritualType === 'altar_flower') {
    return {
      ritualTitle: 'CẦU BÌNH AN',
      ritualSubtitle: 'Phật tử {username} cầu bình an',
      voiceTemplate: 'Phật tử {username} cầu bình an.',
      queuePriority: 40,
    };
  }
  if (gid === '8910' || titleUpper.includes('SỨC KHỎE') || params.ritualType === 'altar_bell') {
    return {
      ritualTitle: 'CẦU SỨC KHỎE',
      ritualSubtitle: 'Phật tử {username} cầu sức khỏe',
      voiceTemplate: 'Phật tử {username} cầu sức khỏe.',
      queuePriority: 50,
    };
  }
  if (gid === '6093' || titleUpper.includes('GIA ĐẠO') || params.ritualType === 'altar_fruit_tray') {
    return {
      ritualTitle: 'CẦU GIA ĐẠO',
      ritualSubtitle: 'Phật tử {username} cầu gia đạo',
      voiceTemplate: 'Phật tử {username} cầu gia đạo.',
      queuePriority: 60,
    };
  }
  if (
    gid === '5827' ||
    titleUpper.includes('TÀI LỘC') ||
    params.ritualType === 'altar_lotus_pedestal'
  ) {
    return {
      ritualTitle: 'CẦU TÀI LỘC',
      ritualSubtitle: 'Phật tử {username} cầu tài lộc',
      voiceTemplate: 'Phật tử {username} cầu tài lộc. Kính chúc gia đình luôn an lành.',
      queuePriority: 90,
    };
  }
  if (
    gid === '29201' ||
    titleUpper.includes('CÔNG ĐỨC') ||
    params.ritualType === 'altar_grand_ceremony' ||
    params.ritualType === 'altar_pagoda'
  ) {
    return {
      ritualTitle: 'CẦU CÔNG ĐỨC',
      ritualSubtitle: 'Phật tử {username} cầu công đức',
      voiceTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
      queuePriority: 100,
    };
  }

  const cleanHeader = sanitizeCeremonialText(
    params.ceremonyTitle?.trim() || 'CẦU BÌNH AN',
    'CẦU BÌNH AN',
  ).toUpperCase();
  const lowerIntention = cleanHeader.startsWith('CẦU ')
    ? cleanHeader.toLowerCase()
    : `cầu ${cleanHeader.toLowerCase()}`;

  return {
    ritualTitle: cleanHeader,
    ritualSubtitle: `Phật tử {username} ${lowerIntention}`,
    voiceTemplate: params.isLarge
      ? `Phật tử {username} ${lowerIntention}. Kính chúc gia đình luôn an lành.`
      : `Phật tử {username} ${lowerIntention}.`,
    queuePriority: params.isLarge ? 85 : 45,
  };
}

/**
 * Ensures any persisted or imported GiftMapping carries clean ceremonial `ritualTitle`,
 * `ritualSubtitle`, `voiceTemplate`, `ttsTemplate`, and `queuePriority` with zero gift words.
 */
export function normalizeCeremonialGiftMapping(raw: GiftMapping): GiftMapping {
  const defaults = inferCanonicalCeremonialDefaults({
    giftId: raw.giftId,
    ritualType: raw.ritualType,
    ceremonyTitle: raw.ceremonyTitle || raw.ritualTitle,
    isLarge: raw.isLarge,
  });

  const ritualTitle = sanitizeCeremonialText(
    raw.ritualTitle?.trim() || raw.ceremonyTitle?.trim() || defaults.ritualTitle,
    defaults.ritualTitle,
  );
  const ceremonyTitle = sanitizeCeremonialText(
    raw.ceremonyTitle?.trim() || ritualTitle,
    ritualTitle,
  );
  const rawSub = raw.ritualSubtitle?.trim();
  const ritualSubtitle =
    rawSub && !isLegacyGiftWordTemplate(rawSub)
      ? sanitizeCeremonialText(rawSub, defaults.ritualSubtitle)
      : defaults.ritualSubtitle;

  const candidateVoice = raw.voiceTemplate?.trim() || raw.ttsTemplate?.trim() || '';
  const voiceTemplate =
    candidateVoice && !isLegacyGiftWordTemplate(candidateVoice)
      ? sanitizeCeremonialText(candidateVoice, defaults.voiceTemplate)
      : defaults.voiceTemplate;

  const rawQPrio = Number(raw.queuePriority);
  const queuePriority = Number.isFinite(rawQPrio)
    ? Math.max(1, Math.min(100, Math.round(rawQPrio)))
    : defaults.queuePriority;

  return {
    ...raw,
    giftId: normalizeGiftId(raw.giftId),
    ceremonyTitle,
    ritualTitle,
    ritualSubtitle,
    voiceTemplate,
    ttsTemplate: voiceTemplate,
    queuePriority,
  };
}

export function renderCeremonialSubtitle(
  template: string | undefined,
  vars: {
    username: string;
    ritualTitle?: string;
    meritPoints?: number;
  },
): string {
  const raw = template?.trim() || 'Phật tử {username} cầu bình an';
  const interpolated = raw
    .replace(/\{username\}/gi, () => vars.username)
    .replace(/\{ritualTitle\}/gi, () => vars.ritualTitle || 'CẦU BÌNH AN')
    .replace(/\{meritPoints\}/gi, () => String(vars.meritPoints ?? 0))
    .replace(/\s+/g, ' ')
    .trim();
  return sanitizeCeremonialText(interpolated, `Phật tử ${vars.username} cầu bình an`);
}

/**
 * Interpolates all supported VieNeuTTS ceremonial template variables safely
 * and strips any forbidden gift words so voice narration is 100% devotional.
 */
export function renderGiftVoiceTemplate(
  template: string,
  vars: {
    username: string;
    giftName?: string;
    giftCount?: number;
    meritPoints?: number;
    ritualName?: string;
    ritualTitle?: string;
  },
): string {
  const raw =
    template && !isLegacyGiftWordTemplate(template)
      ? template.trim()
      : 'Phật tử {username} cầu bình an.';
  const rendered = raw
    .replace(/\{username\}/gi, () => vars.username)
    .replace(/\{ritualTitle\}/gi, () => vars.ritualTitle || 'cầu bình an')
    .replace(/\{ritualName\}/gi, () => vars.ritualName || 'lễ Phật cầu an')
    .replace(/\{giftName\}/gi, () => vars.ritualName || vars.giftName || 'lễ Phật')
    .replace(/\{giftCount\}/gi, () => String(vars.giftCount ?? 1))
    .replace(/\{meritPoints\}/gi, () => String(vars.meritPoints ?? 0))
    .replace(/\s+/g, ' ')
    .trim();
  return sanitizeCeremonialText(rendered, `Phật tử ${vars.username} cầu bình an.`);
}

export const DEFAULT_GIFT_THANK_YOU_TEMPLATE = 'Phật tử {username} cầu bình an.';

export const DEFAULT_WELCOME_TEMPLATE =
  'Chào mừng Phật tử {username} đã đến với Chùa Online. Kính chúc bạn luôn bình an.';

export const DEFAULT_COMMENT_VOICE_FORMULA =
  'Phật tử {username} gửi lời nguyện: {comment}';

export const DEFAULT_COMMENT_VOICE_TEMPLATES: CommentVoiceTemplates = {
  binhAn: DEFAULT_COMMENT_VOICE_FORMULA,
  sucKhoe: DEFAULT_COMMENT_VOICE_FORMULA,
  taiLoc: DEFAULT_COMMENT_VOICE_FORMULA,
  tinhDuyen: DEFAULT_COMMENT_VOICE_FORMULA,
  giaDao: DEFAULT_COMMENT_VOICE_FORMULA,
  hocHanh: DEFAULT_COMMENT_VOICE_FORMULA,
  general: DEFAULT_COMMENT_VOICE_FORMULA,
};

// Editable reference configuration for "🪷 CÚNG DƯỜNG CẦU AN" + normalized TikTok giftId string mapping
// Strictly uses devotional prayer intentions (ZERO gift words!)
export const DEFAULT_GIFT_MAPPINGS: GiftMapping[] = [
  {
    id: 'hoa_hong',
    giftId: '5655',
    giftName: 'Rose',
    vietnameseLabel: 'Hoa Hồng',
    ceremonyTitle: 'CẦU BÌNH AN',
    ritualTitle: 'CẦU BÌNH AN',
    ritualSubtitle: 'Phật tử {username} cầu bình an',
    badgeCeremonyLabel: 'LỄ PHẬT CẦU AN',
    iconType: 'rose',
    referenceCoins: 1,
    points: 50,
    isLarge: false,
    ritualType: 'altar_flower',
    characterAnimation: 'walk_offer_bow',
    effect: 'lotus_petals',
    soundEffect: 'offering_chime',
    ttsTemplate: 'Phật tử {username} cầu bình an.',
    voiceTemplate: 'Phật tử {username} cầu bình an.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 40,
    animationDurationSec: 4.3,
    cooldownSec: 1.2,
    enabled: true,
    showInOverlayPanel: true,
    animation: 'offering',
  },
  {
    id: 'chuong_dong',
    giftId: '8910',
    giftName: 'Bronze Bell',
    vietnameseLabel: 'Chuông Đồng',
    ceremonyTitle: 'CẦU SỨC KHỎE',
    ritualTitle: 'CẦU SỨC KHỎE',
    ritualSubtitle: 'Phật tử {username} cầu sức khỏe',
    badgeCeremonyLabel: 'THỈNH CHUÔNG CẦU SỨC KHỎE',
    iconType: 'bell',
    referenceCoins: 10,
    points: 150,
    isLarge: false,
    ritualType: 'altar_bell',
    characterAnimation: 'walk_ring_bell',
    effect: 'bell_waves',
    soundEffect: 'temple_bell',
    ttsTemplate: 'Phật tử {username} cầu sức khỏe.',
    voiceTemplate: 'Phật tử {username} cầu sức khỏe.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 50,
    animationDurationSec: 4.6,
    cooldownSec: 1.5,
    enabled: true,
    showInOverlayPanel: true,
    animation: 'gift_blessing',
  },
  {
    id: 'mam_qua',
    giftId: '6093',
    giftName: 'Fruit Plate',
    vietnameseLabel: 'Mâm Quả',
    ceremonyTitle: 'CẦU GIA ĐẠO',
    ritualTitle: 'CẦU GIA ĐẠO',
    ritualSubtitle: 'Phật tử {username} cầu gia đạo',
    badgeCeremonyLabel: 'DÂNG QUẢ CẦU GIA ĐẠO',
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
    animationDurationSec: 4.6,
    cooldownSec: 1.5,
    enabled: true,
    showInOverlayPanel: true,
    animation: 'offering',
  },
  {
    id: 'dai_sen',
    giftId: '5827',
    giftName: 'Lotus',
    vietnameseLabel: 'Đài Sen',
    ceremonyTitle: 'CẦU TÀI LỘC',
    ritualTitle: 'CẦU TÀI LỘC',
    ritualSubtitle: 'Phật tử {username} cầu tài lộc',
    badgeCeremonyLabel: 'DÂNG ĐÀI SEN CẦU TÀI LỘC',
    iconType: 'lotus',
    referenceCoins: 99,
    points: 990,
    isLarge: true,
    ritualType: 'altar_lotus_pedestal',
    characterAnimation: 'walk_offer_bow',
    effect: 'glowing_lotus',
    soundEffect: 'lotus_chime',
    ttsTemplate: 'Phật tử {username} cầu tài lộc. Kính chúc gia đình luôn an lành.',
    voiceTemplate: 'Phật tử {username} cầu tài lộc. Kính chúc gia đình luôn an lành.',
    voicePriority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 90,
    animationDurationSec: 5.0,
    cooldownSec: 1.5,
    enabled: true,
    showInOverlayPanel: true,
    animation: 'offering',
  },
  {
    id: 'bao_thap',
    giftId: '29201',
    giftName: 'Pagoda',
    vietnameseLabel: 'Bảo Tháp',
    ceremonyTitle: 'CẦU CÔNG ĐỨC',
    ritualTitle: 'CẦU CÔNG ĐỨC',
    ritualSubtitle: 'Phật tử {username} cầu công đức',
    badgeCeremonyLabel: 'NGHI LỄ BẢO THÁP CÔNG ĐỨC',
    iconType: 'pagoda',
    referenceCoins: 199,
    points: 1990,
    isLarge: true,
    ritualType: 'altar_grand_ceremony',
    characterAnimation: 'walk_prostrate_3',
    effect: 'grand_ceremony',
    soundEffect: 'grand_ceremony_bell',
    ttsTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
    voiceTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
    voicePriority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 100,
    animationDurationSec: 5.8,
    cooldownSec: 2.0,
    enabled: true,
    showInOverlayPanel: true,
    animation: 'gift_blessing',
  },
];

export const DEFAULT_GIFT_ACTION_PRESETS: GiftActionPreset[] = [
  {
    presetId: 'preset_flower_peace',
    name: 'Dâng Hoa Cầu Bình An',
    description: 'Đi lên bàn thờ dâng hoa, hoa sen rơi trang nghiêm & chuông tịnh tâm',
    ritualTitle: 'CẦU BÌNH AN',
    ritualSubtitle: 'Phật tử {username} cầu bình an',
    ritualType: 'altar_flower',
    characterAnimation: 'walk_offer_bow',
    effect: 'lotus_petals',
    soundEffect: 'offering_chime',
    ttsTemplate: 'Phật tử {username} cầu bình an.',
    voiceTemplate: 'Phật tử {username} cầu bình an.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 40,
    animationDurationSec: 4.3,
    cooldownSec: 1.2,
    isBuiltin: true,
    updatedAt: 1730000000000,
  },
  {
    presetId: 'preset_incense_devotion',
    name: 'Thắp Hương Tâm Thành',
    description: 'Đi lên dâng 3 nén tâm hương, khói trầm linh thiêng & chuông gia trì',
    ritualTitle: 'CẦU BÌNH AN',
    ritualSubtitle: 'Phật tử {username} cầu bình an',
    ritualType: 'altar_incense',
    characterAnimation: 'walk_offer_bow',
    effect: 'incense_smoke',
    soundEffect: 'incense_chime',
    ttsTemplate: 'Phật tử {username} cầu bình an.',
    voiceTemplate: 'Phật tử {username} cầu bình an.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 45,
    animationDurationSec: 4.2,
    cooldownSec: 1.5,
    isBuiltin: true,
    updatedAt: 1730000000000,
  },
  {
    presetId: 'preset_bell_health',
    name: 'Thỉnh Đại Hồng Chung',
    description: 'Đi lên tháp chuông thỉnh chuông đồng ngân vang cầu sức khỏe',
    ritualTitle: 'CẦU SỨC KHỎE',
    ritualSubtitle: 'Phật tử {username} cầu sức khỏe',
    ritualType: 'altar_bell',
    characterAnimation: 'walk_ring_bell',
    effect: 'bell_waves',
    soundEffect: 'temple_bell',
    ttsTemplate: 'Phật tử {username} cầu sức khỏe.',
    voiceTemplate: 'Phật tử {username} cầu sức khỏe.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 50,
    animationDurationSec: 4.6,
    cooldownSec: 1.5,
    isBuiltin: true,
    updatedAt: 1730000000000,
  },
  {
    presetId: 'preset_wooden_fish',
    name: 'Gõ Mõ Tụng Kinh',
    description: 'Đi lên trước Phật đài quỳ gõ mõ cổ truyền & kim sa vàng',
    ritualTitle: 'CẦU BÌNH AN',
    ritualSubtitle: 'Phật tử {username} cầu bình an',
    ritualType: 'altar_wooden_fish',
    characterAnimation: 'walk_wooden_fish',
    effect: 'golden_particles',
    soundEffect: 'wooden_fish',
    ttsTemplate: 'Phật tử {username} cầu bình an.',
    voiceTemplate: 'Phật tử {username} cầu bình an.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 55,
    animationDurationSec: 4.4,
    cooldownSec: 1.5,
    isBuiltin: true,
    updatedAt: 1730000000000,
  },
  {
    presetId: 'preset_grand_ceremony',
    name: 'Đại Lễ Hoàng Kim Tam Bảo',
    description: 'Đại lễ Tam Bái 3 lạy, mưa hoa sen rực rỡ & đại hồng chung ưu tiên #1',
    ritualTitle: 'CẦU CÔNG ĐỨC',
    ritualSubtitle: 'Phật tử {username} cầu công đức',
    ritualType: 'altar_grand_ceremony',
    characterAnimation: 'walk_prostrate_3',
    effect: 'grand_ceremony',
    soundEffect: 'grand_ceremony_bell',
    ttsTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
    voiceTemplate: 'Phật tử {username} cầu công đức. Kính chúc gia đình luôn an lành.',
    voicePriority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 100,
    animationDurationSec: 5.8,
    cooldownSec: 2.0,
    isBuiltin: true,
    updatedAt: 1730000000000,
  },
  {
    presetId: 'preset_seated_light',
    name: 'Ánh Sáng Vàng Tại Đệm Ngồi',
    description: 'Chắp tay tại đệm ngồi cùng cột ánh sáng vàng chiếu rọi (không rời chỗ)',
    ritualTitle: 'CẦU BÌNH AN',
    ritualSubtitle: 'Phật tử {username} cầu bình an',
    ritualType: 'golden_light',
    characterAnimation: 'seated_pray',
    effect: 'golden_light',
    soundEffect: 'lotus_chime',
    ttsTemplate: 'Phật tử {username} cầu bình an.',
    voiceTemplate: 'Phật tử {username} cầu bình an.',
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 42,
    animationDurationSec: 3.6,
    cooldownSec: 1.0,
    isBuiltin: true,
    updatedAt: 1730000000000,
  },
];

export const DEFAULT_PEACEFUL_MESSAGES: string[] = [
  'Nam mô A Di Đà Phật. Kính chúc quý Phật tử thân tâm an lạc.',
  'Mong mọi người luôn giữ lòng từ bi, biết yêu thương và giúp đỡ nhau.',
  'Mỗi ngày hãy dành một chút thời gian để sống chậm lại và nuôi dưỡng sự bình an.',
  'Chúc quý Phật tử cùng gia quyến một buổi tối thanh tịnh, nhẹ nhàng và nhiều niềm vui.',
  'Tâm bình thế giới bình. Chúc mọi người luôn giữ được nụ cười hiền hòa trong cuộc sống.',
];

// Curated fallback list of official VieNeu v4 voices in case catalog network fetch is offline
export const CURATED_VIENEU_VOICES: VieNeuVoiceOption[] = [
  {
    id: 'Ngọc Lan',
    name: 'Ngọc Lan',
    description: 'Giọng nữ, giọng trầm dịu dàng (Khuyên dùng)',
    gender: 'female',
    region: 'south',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Nhã Uyên',
    name: 'Nhã Uyên',
    description: 'Giọng nữ miền Bắc ấm áp, điềm đạm',
    gender: 'female',
    region: 'north',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Bảo Trâm',
    name: 'Bảo Trâm',
    description: 'Giọng nữ chậm rãi, nhẹ nhàng',
    gender: 'female',
    region: 'south',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Minh Ngọc',
    name: 'Minh Ngọc',
    description: 'Giọng nữ ngọt ngào, nhẹ nhàng và thiện cảm',
    gender: 'female',
    region: 'south',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Mẫn Nghi',
    name: 'Mẫn Nghi',
    description: 'Giọng nữ dịu dàng, dễ nghe',
    gender: 'female',
    region: 'south',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Thùy An',
    name: 'Thùy An',
    description: 'Giọng nữ rõ ràng, chậm rãi',
    gender: 'female',
    region: 'south',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Tiểu Hồng',
    name: 'Tiểu Hồng',
    description: 'Giọng nữ miền Bắc nhẹ nhàng',
    gender: 'female',
    region: 'north',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Bạch Tuyết',
    name: 'Bạch Tuyết',
    description: 'Giọng nữ chậm rãi, truyền cảm',
    gender: 'female',
    region: 'south',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Thiền Tâm Đức',
    name: 'Thiền Tâm Đức',
    description: 'Giọng nam trầm, Phật pháp, đọc chậm trang nghiêm',
    gender: 'male',
    region: 'south',
    engine: 'v4',
    recommended: true,
  },
  {
    id: 'Bảo Long',
    name: 'Bảo Long',
    description: 'Giọng nam trầm ấm, rõ ràng',
    gender: 'male',
    region: 'north',
    engine: 'v4',
    recommended: true,
  },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  provider: 'vieneu',
  vieneuMode: 'cloud',
  vieneuModel: 'vieneu-v4',
  localEndpoint: 'http://127.0.0.1:8000/v1/audio/speech',
  endpoint: 'https://api.vieneu.io/api/v1/audio/speech',
  voiceId: 'Ngọc Lan',
  gender: 'female',
  volume: 0.92,
  speed: 0.96,
  browserFallbackEnabled: true,
  bgMusicEnabled: true,
  bgMusicVolume: 0.2,
  autoNarrationEnabled: true,
  giftAnnouncementsEnabled: true,
  giftInterruptPolicy: 'interrupt_comments',
  welcomeAnnouncementsEnabled: false,
  welcomeTemplate: DEFAULT_WELCOME_TEMPLATE,
  commentVoiceEnabled: true,
  commentVoiceFormula: DEFAULT_COMMENT_VOICE_FORMULA,
  commentCooldownSec: 3,
  perUserCommentCooldownSec: 10,
  maxCommentLength: 90,
  maxCommentQueueSize: 5,
  staleCommentTimeoutSec: 20,
  blockSpamLinksAndUnsafe: true,
  prayerAnnouncementsEnabled: true,
  commentAnnouncementsEnabled: true,
  commentTemplates: { ...DEFAULT_COMMENT_VOICE_TEMPLATES },
  followAnnouncementsEnabled: true,
  backgroundNarrationEnabled: true,
  backgroundIntervalSec: 120,
  useAiPeacefulMessages: false,
  cooldownMs: 1800,
  customPeacefulMessages: [...DEFAULT_PEACEFUL_MESSAGES],
};

const envBuddhaModelUrl =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  typeof import.meta.env.VITE_BUDDHA_MODEL_URL === 'string'
    ? import.meta.env.VITE_BUDDHA_MODEL_URL.trim()
    : '';

export const DEFAULT_OVERLAY_SETTINGS: StreamOverlaySettings = {
  vertical916: true,
  obsCleanView: false,
  panelScale: 0.9,
  panelOpacity: 0.55,
  showLeaderboard: true,
  showGiftPanel: true,
  showLotusAvatars: true,
  showEventBar: true,
  showCommentBubbles: true,
  showNotifications: false,
  showUsernames: true,
  maxParticipants: 96,
  maxConcurrentCeremonies: 3,
  inactivityTimeoutEnabled: true,
  inactivityTimeoutSec: 120,
  demoAcceleratedTimeout: false,
  buddhaModelUrl: envBuddhaModelUrl,
  buddhaGoldOverride: true,
  quality: 'medium',
  effectsEnabled: true,
  lotusParticleDensity: 1.15,
  petalCount: 44,
  leafCount: 16,
  centerPanelDuration: 3400,
  showAvatarInCenterPanel: true,
};

declare global {
  interface Window {
    handleTikTokEvent?: (event: Partial<TikTokNormalizedEvent>) => void;
    isSoftwareGl?: boolean;
  }
}
