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
  giftId?: number;
  giftName?: string;
  giftCount?: number;
  diamondCount?: number;
  repeatEnd?: boolean;
  streakKey?: string;
  likeCount?: number;
  cumulativeUserLikes?: number;
  verifiedBackend?: boolean;
  isDemo: boolean;
  timestamp: number;
}

export type RitualActionType =
  | 'altar_flower'
  | 'altar_bell'
  | 'altar_fruit_tray'
  | 'altar_lotus_pedestal'
  | 'altar_pagoda'
  | 'altar_incense'
  | 'altar_lantern'
  | 'altar_grand_ceremony'
  | 'seat_wooden_fish'
  | 'seat_prayer';

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
  type: RitualActionType;
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
  | 'returning_row';

export interface Participant {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  seatIndex: number; // 0..199 main mats, >= 200 waiting/expandable congregation
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
  lastGiftName?: string;
  lastGiftAt?: number;
  lastActivityAt: number;
  robeHueShift: number;
  hasHairBun: boolean;
  isDemo: boolean;
}

export interface LotusCeremonyBadge {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
  ceremonyTitle: string;
  offeringLabel: string;
  side: 'left' | 'right';
  startedAt: number;
  expiresAt: number;
}

export type GiftEffectType =
  | 'lotus_petals'
  | 'golden_particles'
  | 'altar_blessing'
  | 'incense_smoke'
  | 'floating_lantern'
  | 'bell_waves'
  | 'grand_ceremony';

export type GiftAnimType = 'offering' | 'gift_blessing' | 'bowing';

export type GiftIconType = 'rose' | 'bell' | 'fruit' | 'lotus' | 'pagoda';

export interface GiftMapping {
  id: string;
  ceremonyTitle: string; // e.g. "CẦU BÌNH AN"
  vietnameseLabel: string; // Editable reference gift name, e.g. "Hoa Hồng"
  referenceCoins: number; // Editable reference xu display, e.g. 1, 10, 30, 99, 199
  iconType: GiftIconType;
  giftId: number; // Actual TikTok giftId used for backend-verified matching
  giftName: string; // Actual TikTok giftName fallback match
  points: number;
  isLarge: boolean;
  ritualType: RitualActionType;
  badgeCeremonyLabel: string; // e.g. "LỄ PHẬT CẦU AN"
  effect: GiftEffectType;
  animation: GiftAnimType;
  enabled: boolean;
  ttsTemplate: string;
}

export type TTSProviderType = 'vieneu' | 'browser' | 'elevenlabs' | 'openai' | 'gemini';
export type VieNeuMode = 'cloud' | 'local';

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
  welcomeAnnouncementsEnabled: boolean;
  welcomeTemplate: string;
  prayerAnnouncementsEnabled: boolean;
  followAnnouncementsEnabled: boolean;
  backgroundNarrationEnabled: boolean;
  backgroundIntervalSec: number;
  useAiPeacefulMessages: boolean;
  cooldownMs: number;
  customPeacefulMessages: string[];
}

export type QualityPreset = 'low' | 'medium' | 'high';

export interface StreamOverlaySettings {
  vertical916: boolean;
  obsCleanView: boolean;
  showLeaderboard: boolean;
  showGiftPanel: boolean;
  showLotusAvatars: boolean;
  showEventBar: boolean;
  showCommentBubbles: boolean;
  showNotifications: boolean;
  showUsernames: boolean;
  maxParticipants: number;
  maxConcurrentCeremonies: number;
  quality: QualityPreset;
  effectsEnabled: boolean;
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

export enum AnnouncementPriority {
  LARGE_GIFT = 1,
  NORMAL_GIFT = 2,
  MILESTONE = 3,
  WELCOME = 4,
  COMMENT = 5,
  BACKGROUND = 6,
}

export const DEFAULT_GIFT_THANK_YOU_TEMPLATE =
  'Xin cảm ơn Phật tử {username} đã dâng lễ cầu an. Kính chúc bạn và gia đình luôn an lành.';

export const DEFAULT_WELCOME_TEMPLATE =
  'Chào mừng Phật tử {username} đã đến với Chùa Online. Kính chúc bạn luôn bình an.';

// Editable reference configuration for "🪷 CÚNG DƯỜNG CẦU AN" + actual TikTok giftId mapping
export const DEFAULT_GIFT_MAPPINGS: GiftMapping[] = [
  {
    id: 'hoa_hong',
    ceremonyTitle: 'CẦU BÌNH AN',
    vietnameseLabel: 'Hoa Hồng',
    referenceCoins: 1,
    iconType: 'rose',
    giftId: 5655,
    giftName: 'Rose',
    points: 50,
    isLarge: false,
    ritualType: 'altar_flower',
    badgeCeremonyLabel: 'LỄ PHẬT CẦU AN',
    effect: 'lotus_petals',
    animation: 'offering',
    enabled: true,
    ttsTemplate:
      'Xin cảm ơn Phật tử {username} đã dâng hoa cầu bình an. Kính chúc bạn và gia đình luôn an lành.',
  },
  {
    id: 'chuong_dong',
    ceremonyTitle: 'CẦU SỨC KHỎE',
    vietnameseLabel: 'Chuông Đồng',
    referenceCoins: 10,
    iconType: 'bell',
    giftId: 8910,
    giftName: 'Bronze Bell',
    points: 150,
    isLarge: false,
    ritualType: 'altar_bell',
    badgeCeremonyLabel: 'THỈNH CHUÔNG CẦU SỨC KHỎE',
    effect: 'bell_waves',
    animation: 'gift_blessing',
    enabled: true,
    ttsTemplate: 'Xin cảm ơn Phật tử {username} đã thỉnh chuông cầu sức khỏe.',
  },
  {
    id: 'mam_qua',
    ceremonyTitle: 'CẦU GIA ĐẠO',
    vietnameseLabel: 'Mâm Quả',
    referenceCoins: 30,
    iconType: 'fruit',
    giftId: 6093,
    giftName: 'Fruit Plate',
    points: 350,
    isLarge: false,
    ritualType: 'altar_fruit_tray',
    badgeCeremonyLabel: 'DÂNG QUẢ CẦU GIA ĐẠO',
    effect: 'golden_particles',
    animation: 'offering',
    enabled: true,
    ttsTemplate: 'Xin cảm ơn Phật tử {username} đã dâng mâm quả cầu gia đạo bình an.',
  },
  {
    id: 'dai_sen',
    ceremonyTitle: 'CẦU TÀI LỘC',
    vietnameseLabel: 'Đài Sen',
    referenceCoins: 99,
    iconType: 'lotus',
    giftId: 5827,
    giftName: 'Lotus',
    points: 990,
    isLarge: true,
    ritualType: 'altar_lotus_pedestal',
    badgeCeremonyLabel: 'DÂNG ĐÀI SEN CẦU TÀI LỘC',
    effect: 'lotus_petals',
    animation: 'offering',
    enabled: true,
    ttsTemplate: 'Xin cảm ơn Phật tử {username} đã dâng đài sen cầu tài lộc.',
  },
  {
    id: 'bao_thap',
    ceremonyTitle: 'CẦU CÔNG ĐỨC',
    vietnameseLabel: 'Bảo Tháp',
    referenceCoins: 199,
    iconType: 'pagoda',
    giftId: 29201,
    giftName: 'Pagoda',
    points: 1990,
    isLarge: true,
    ritualType: 'altar_pagoda',
    badgeCeremonyLabel: 'NGHI LỄ BẢO THÁP CÔNG ĐỨC',
    effect: 'grand_ceremony',
    animation: 'gift_blessing',
    enabled: true,
    ttsTemplate: 'Xin cảm ơn Phật tử {username} đã tham gia nghi lễ cúng dường.',
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
  bgMusicVolume: 0.22,
  autoNarrationEnabled: true,
  giftAnnouncementsEnabled: true,
  welcomeAnnouncementsEnabled: true,
  welcomeTemplate: DEFAULT_WELCOME_TEMPLATE,
  prayerAnnouncementsEnabled: true,
  followAnnouncementsEnabled: true,
  backgroundNarrationEnabled: true,
  backgroundIntervalSec: 120,
  useAiPeacefulMessages: false,
  cooldownMs: 2200,
  customPeacefulMessages: [...DEFAULT_PEACEFUL_MESSAGES],
};

export const DEFAULT_OVERLAY_SETTINGS: StreamOverlaySettings = {
  vertical916: true,
  obsCleanView: false,
  showLeaderboard: true,
  showGiftPanel: true,
  showLotusAvatars: true,
  showEventBar: true,
  showCommentBubbles: true,
  showNotifications: true,
  showUsernames: true,
  maxParticipants: 200,
  maxConcurrentCeremonies: 3,
  quality: 'medium',
  effectsEnabled: true,
};

declare global {
  interface Window {
    handleTikTokEvent?: (event: Partial<TikTokNormalizedEvent>) => void;
    isSoftwareGl?: boolean;
  }
}
