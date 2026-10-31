import {
  ActiveCharacterRitual,
  ActiveGiftVisualEffect,
  ActiveWoodenFishAction,
  AltarStationId,
  AnnouncementPriority,
  DEFAULT_GIFT_MAPPINGS,
  FeedNotification,
  GiftEffectType,
  GiftMapping,
  LotusCeremonyBadge,
  Participant,
  RitualActionType,
  TikTokNormalizedEvent,
  WoodenFishMilestoneTier,
} from '../types/temple';
import {
  ALTAR_STATIONS,
  SeatManager,
  areAltarStationsTooClose,
  getCandidateStationsForRitual,
  getSeatPosition,
} from './SeatManager';
import { buildSacredAvatarDataUri } from './DemoEventManager';
import { soundSynthesizer } from './SoundSynthesizer';
import { voiceManager } from './VoiceManager';

interface PrayerTopicMatch {
  topicLabel: string;
  spokenBlessing: (name: string) => string;
}

const PRAYER_TOPIC_MATCHERS: { regex: RegExp; match: PrayerTopicMatch }[] = [
  {
    regex: /bình\s*an/i,
    match: {
      topicLabel: 'Cầu Bình An',
      spokenBlessing: (name) =>
        `Nam mô A Di Đà Phật. Nguyện cầu cho Phật tử ${name} cùng gia quyến thân tâm thường bình an.`,
    },
  },
  {
    regex: /sức\s*khỏe|mạnh\s*khỏe/i,
    match: {
      topicLabel: 'Cầu Sức Khỏe',
      spokenBlessing: (name) =>
        `Nam mô Dược Sư Lưu Ly Quang Vương Phật. Cầu chúc Phật tử ${name} và gia đình dồi dào sức khỏe.`,
    },
  },
  {
    regex: /tài\s*lộc|may\s*mắn|công\s*việc|lộc/i,
    match: {
      topicLabel: 'Cầu Tài Lộc',
      spokenBlessing: (name) =>
        `Nguyện cầu Phật tử ${name} công việc hanh thông, phước lộc cát tường như ý.`,
    },
  },
  {
    regex: /tình\s*duyên|nhân\s*duyên|hạnh\s*phúc/i,
    match: {
      topicLabel: 'Cầu Tình Duyên',
      spokenBlessing: (name) =>
        `Nguyện cầu Phật tử ${name} nhân duyên thiện lành, trọn vẹn yêu thương và an vui.`,
    },
  },
  {
    regex: /học\s*hành|thi\s*cử|đỗ\s*đạt/i,
    match: {
      topicLabel: 'Cầu Học Hành',
      spokenBlessing: (name) =>
        `Nguyện cầu Phật tử ${name} trí tuệ sáng suốt, học hành tinh tấn, thi cử đỗ đạt.`,
    },
  },
  {
    regex: /gia\s*đạo|gia\s*đình|cha\s*mẹ|ông\s*bà/i,
    match: {
      topicLabel: 'Cầu Gia Đạo',
      spokenBlessing: (name) =>
        `Nguyện cầu gia đạo của Phật tử ${name} luôn thuận hòa, hiếu nghĩa và ngập tràn bình an.`,
    },
  },
  {
    regex: /(nam\s*mô|a\s*di\s*đà\s*phật|lạy\s*phật|mô\s*phật|thích\s*ca|quan\s*âm|cầu\s*nguyện)/i,
    match: {
      topicLabel: 'Thành Tâm Lễ Phật',
      spokenBlessing: (name) =>
        `Nam mô A Di Đà Phật. Chứng giám lòng thành lễ Phật của Phật tử ${name}.`,
    },
  },
];

function detectPrayerTopic(comment: string): PrayerTopicMatch | null {
  for (const item of PRAYER_TOPIC_MATCHERS) {
    if (item.regex.test(comment)) {
      return item.match;
    }
  }
  return null;
}

const CLIENT_PROFANITY_REGEX =
  /\b(đm|địt|vl|vcl|đéo|lừa\s*đảo|cờ\s*bạc|casino|bet88|kubet|fuck|shit|scam)\b/i;

function hashStringToFloat(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

interface QueuedAltarRitual {
  id: string;
  userId: string;
  type: RitualActionType;
  label: string;
  ceremonyBadgeTitle: string;
  offeringLabel: string;
  spokenText?: string;
  playBellBeforeSpeech?: boolean;
  isLargeCeremony?: boolean;
  priority: number; // lower = higher priority (1 = pagoda/grand, 2 = lotus/fruit/bell/flower/lantern, 3 = incense)
  durationMs: number;
  createdAt: number;
}

interface PendingWoodenFishMilestone {
  id: string;
  tier: WoodenFishMilestoneTier;
  strikeCount: number;
  cumulativeLikes: number;
  durationMs: number;
}

const RITUAL_PRIORITY: Record<RitualActionType, number> = {
  altar_pagoda: 1,
  altar_grand_ceremony: 1,
  altar_lotus_pedestal: 2,
  altar_fruit_tray: 2,
  altar_bell: 2,
  altar_flower: 3,
  altar_lantern: 3,
  altar_incense: 4,
  seat_prayer: 5,
  seat_wooden_fish: 6,
};

const MILESTONE_RANK: Record<WoodenFishMilestoneTier, number> = {
  like_10: 1,
  like_100: 2,
  like_1000: 3,
};

export interface TempleCongregationState {
  participants: Participant[];
  leaderboard: Participant[];
  notifications: FeedNotification[];
  activeEffects: ActiveGiftVisualEffect[];
  activeLotusBadges: LotusCeremonyBadge[];
  giftEventCounts: Record<string, number>;
  prominentGiftBanner: {
    id: string;
    username: string;
    giftName: string;
    points: number;
    isDemo: boolean;
    expiresAt: number;
  } | null;
  altarGlowUntil: number;
  bellRingUntil: number;
  incenseGlowUntil: number;
  fruitGlowUntil: number;
  lotusGlowUntil: number;
  pagodaGlowUntil: number;
  floatingLanternCount: number;
  totalLikesCount: number;
  totalWoodenFishCount: number;
  activeAltarCount: number;
  queuedAltarCount: number;
  occupiedMainSeats: number;
  waitingOverflowCount: number;
  totalEventsProcessed: number;
}

type CongregationSubscriber = (state: TempleCongregationState) => void;

export class TikTokEventManager {
  private static readonly MAX_LOTUS_BADGES = 4;

  private participantsMap = new Map<string, Participant>();
  private seatManager = new SeatManager();
  private giftMappings: GiftMapping[] = [...DEFAULT_GIFT_MAPPINGS];
  private giftEventCounts: Record<string, number> = {};
  private notifications: FeedNotification[] = [];
  private activeEffects: ActiveGiftVisualEffect[] = [];
  private activeLotusBadges: LotusCeremonyBadge[] = [];
  private prominentGiftBanner: TempleCongregationState['prominentGiftBanner'] = null;

  private altarGlowUntil = 0;
  private bellRingUntil = 0;
  private incenseGlowUntil = 0;
  private fruitGlowUntil = 0;
  private lotusGlowUntil = 0;
  private pagodaGlowUntil = 0;
  private floatingLanternCount = 6;

  // Interactive LIKE = GÕ MÕ counters & per-user tracking
  private totalLikesCount = 0;
  private totalWoodenFishCount = 0;
  private userCumulativeLikes = new Map<string, number>();
  private userLastLike10Cooldown = new Map<string, number>();
  private pendingWoodenFishMap = new Map<string, PendingWoodenFishMilestone>();
  private woodenFishSafetyTimers = new Map<string, number>();

  // Priority-aware Altar Ceremony Queue & Non-Overlapping Station Reservations
  private maxConcurrentCeremonies = 3;
  private ritualQueue: QueuedAltarRitual[] = [];
  private occupiedStations = new Map<AltarStationId, string>(); // stationId -> userId
  private ritualSafetyTimers = new Map<string, number>(); // ritualId -> timeoutId
  private arrivedRitualIds = new Set<string>();
  private lotusBadgeSideFlip = 0;

  private totalEventsProcessed = 0;
  private maxParticipants = 200;
  private effectsEnabled = true;

  private processedEventIds = new Set<string>();
  private clientStreakCounts = new Map<string, number>();
  private userCommentRateMap = new Map<string, number>();
  private userFollowRateMap = new Map<string, number>();
  private userShareRateMap = new Map<string, number>();

  private subscribers = new Set<CongregationSubscriber>();
  private batchNotifyScheduled = false;

  constructor() {
    this.initGiftCounters();

    if (typeof window !== 'undefined') {
      window.handleTikTokEvent = (rawEvent: Partial<TikTokNormalizedEvent>) => {
        this.processEvent(rawEvent);
      };

      // Periodic cleanup of expired effects, lotus avatar badges, and queued ceremonies/milestones
      window.setInterval(() => {
        const now = Date.now();
        let changed = false;

        if (this.activeEffects.some((e) => now - e.startedAt > e.durationMs)) {
          this.activeEffects = this.activeEffects.filter((e) => now - e.startedAt <= e.durationMs);
          changed = true;
        }

        if (this.activeLotusBadges.some((b) => now > b.expiresAt)) {
          this.activeLotusBadges = this.activeLotusBadges.filter((b) => now <= b.expiresAt);
          changed = true;
        }

        if (this.prominentGiftBanner && now > this.prominentGiftBanner.expiresAt) {
          this.prominentGiftBanner = null;
          changed = true;
        }

        for (const p of this.participantsMap.values()) {
          if (
            p.ritualStatusUntil &&
            now > p.ritualStatusUntil &&
            !p.activeRitual &&
            !p.activeWoodenFish
          ) {
            p.ritualStatusLabel = undefined;
            p.ritualStatusUntil = undefined;
            changed = true;
          }
          // Dispatch any waiting wooden-fish milestone once user is seated and free
          if (!p.activeRitual && !p.activeWoodenFish && this.pendingWoodenFishMap.has(p.userId)) {
            if (this.tryStartQueuedWoodenFish(p.userId)) {
              changed = true;
            }
          }
        }

        if (this.ritualQueue.length > 0) {
          const dispatched = this.tryDispatchQueuedRituals();
          if (dispatched) changed = true;
        }

        if (changed) {
          this.scheduleNotify();
        }
      }, 400);
    }
  }

  private initGiftCounters(): void {
    const next: Record<string, number> = {};
    for (const m of this.giftMappings) {
      next[m.id] = this.giftEventCounts[m.id] ?? 0;
    }
    this.giftEventCounts = next;
  }

  public subscribe(cb: CongregationSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.getSnapshot());
    return () => this.subscribers.delete(cb);
  }

  public setGiftMappings(mappings: GiftMapping[]): void {
    this.giftMappings = mappings;
    this.initGiftCounters();
    this.scheduleNotify();
  }

  public getGiftMappings(): GiftMapping[] {
    return this.giftMappings;
  }

  public setMaxParticipants(max: number): void {
    this.maxParticipants = Math.max(10, Math.min(300, max));
    this.scheduleNotify();
  }

  public setMaxConcurrentCeremonies(max: number): void {
    this.maxConcurrentCeremonies = Math.max(1, Math.min(5, Math.round(max)));
    this.tryDispatchQueuedRituals();
    this.scheduleNotify();
  }

  public setEffectsEnabled(enabled: boolean): void {
    this.effectsEnabled = enabled;
    if (!enabled) {
      this.activeEffects = [];
      this.altarGlowUntil = 0;
      this.scheduleNotify();
    }
  }

  public clearParticipants(): void {
    for (const timer of this.ritualSafetyTimers.values()) {
      if (typeof window !== 'undefined') window.clearTimeout(timer);
    }
    for (const timer of this.woodenFishSafetyTimers.values()) {
      if (typeof window !== 'undefined') window.clearTimeout(timer);
    }
    this.ritualSafetyTimers.clear();
    this.woodenFishSafetyTimers.clear();
    this.arrivedRitualIds.clear();
    this.ritualQueue = [];
    this.occupiedStations.clear();
    this.pendingWoodenFishMap.clear();
    this.userCumulativeLikes.clear();
    this.userLastLike10Cooldown.clear();
    this.clientStreakCounts.clear();
    this.participantsMap.clear();
    this.seatManager.resetAll();
    this.notifications = [];
    this.activeEffects = [];
    this.activeLotusBadges = [];
    this.prominentGiftBanner = null;
    this.totalLikesCount = 0;
    this.totalWoodenFishCount = 0;
    this.altarGlowUntil = 0;
    this.bellRingUntil = 0;
    this.incenseGlowUntil = 0;
    this.fruitGlowUntil = 0;
    this.lotusGlowUntil = 0;
    this.pagodaGlowUntil = 0;
    this.floatingLanternCount = 6;
    for (const k of Object.keys(this.giftEventCounts)) {
      this.giftEventCounts[k] = 0;
    }
    this.scheduleNotify();
  }

  public resetSeating(): void {
    for (const timer of this.ritualSafetyTimers.values()) {
      if (typeof window !== 'undefined') window.clearTimeout(timer);
    }
    this.ritualSafetyTimers.clear();
    this.arrivedRitualIds.clear();
    this.ritualQueue = [];
    this.occupiedStations.clear();

    const orderedIds = Array.from(this.participantsMap.values())
      .sort((a, b) => b.points - a.points)
      .map((p) => p.userId);

    const newSeats = this.seatManager.reassignAllUsers(orderedIds);
    const now = Date.now();
    for (const [uid, seatIdx] of newSeats.entries()) {
      const p = this.participantsMap.get(uid);
      if (p) {
        p.seatIndex = seatIdx;
        p.activeRitual = null;
        p.activeWoodenFish = null;
        p.ritualStatusLabel = undefined;
        p.animState = 'bowing';
        p.animStateStartedAt = now;
      }
    }
    this.scheduleNotify();
  }

  private scheduleNotify(): void {
    if (this.batchNotifyScheduled) return;
    this.batchNotifyScheduled = true;
    const trigger = () => {
      this.batchNotifyScheduled = false;
      const snap = this.getSnapshot();
      for (const sub of this.subscribers) {
        sub(snap);
      }
    };
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(trigger);
    } else {
      setTimeout(trigger, 16);
    }
  }

  public getSnapshot(): TempleCongregationState {
    const all = Array.from(this.participantsMap.values());
    const visibleParticipants = all.slice(0, this.maxParticipants);
    const leaderboard = [...all]
      .sort((a, b) =>
        b.points !== a.points ? b.points - a.points : a.lastActivityAt - b.lastActivityAt,
      )
      .slice(0, 20);

    return {
      participants: visibleParticipants,
      leaderboard,
      notifications: this.notifications,
      activeEffects: this.activeEffects,
      activeLotusBadges: this.activeLotusBadges,
      giftEventCounts: { ...this.giftEventCounts },
      prominentGiftBanner: this.prominentGiftBanner,
      altarGlowUntil: this.altarGlowUntil,
      bellRingUntil: this.bellRingUntil,
      incenseGlowUntil: this.incenseGlowUntil,
      fruitGlowUntil: this.fruitGlowUntil,
      lotusGlowUntil: this.lotusGlowUntil,
      pagodaGlowUntil: this.pagodaGlowUntil,
      floatingLanternCount: this.floatingLanternCount,
      totalLikesCount: this.totalLikesCount,
      totalWoodenFishCount: this.totalWoodenFishCount,
      activeAltarCount: this.occupiedStations.size,
      queuedAltarCount: this.ritualQueue.length,
      occupiedMainSeats: this.seatManager.getOccupiedMainCount(),
      waitingOverflowCount: this.seatManager.getOverflowWaitingCount(),
      totalEventsProcessed: this.totalEventsProcessed,
    };
  }

  private addOrRefreshLotusBadge(params: {
    userId: string;
    username: string;
    nickname: string;
    avatarUrl?: string;
    ceremonyTitle: string;
    offeringLabel: string;
    preferredSide?: 'left' | 'right';
    durationMs: number;
  }): void {
    const now = Date.now();
    const avatar =
      params.avatarUrl || buildSacredAvatarDataUri(params.userId, params.nickname || params.username);

    const existingIdx = this.activeLotusBadges.findIndex((b) => b.userId === params.userId);
    if (existingIdx !== -1) {
      this.activeLotusBadges[existingIdx] = {
        ...this.activeLotusBadges[existingIdx],
        username: params.username,
        nickname: params.nickname,
        avatarUrl: avatar,
        ceremonyTitle: params.ceremonyTitle,
        offeringLabel: params.offeringLabel,
        expiresAt: now + params.durationMs,
      };
      return;
    }

    // Balance badges neatly between left and right flanks so they stack max 2 per side
    const leftCount = this.activeLotusBadges.filter((b) => b.side === 'left').length;
    const rightCount = this.activeLotusBadges.filter((b) => b.side === 'right').length;
    let side: 'left' | 'right' =
      params.preferredSide || (this.lotusBadgeSideFlip++ % 2 === 0 ? 'left' : 'right');
    if (leftCount > rightCount) side = 'right';
    else if (rightCount > leftCount) side = 'left';

    const badge: LotusCeremonyBadge = {
      id: `lotus-badge-${params.userId}-${now}`,
      userId: params.userId,
      username: params.username,
      nickname: params.nickname,
      avatarUrl: avatar,
      ceremonyTitle: params.ceremonyTitle,
      offeringLabel: params.offeringLabel,
      side,
      startedAt: now,
      expiresAt: now + params.durationMs,
    };

    const next = [...this.activeLotusBadges, badge];
    this.activeLotusBadges = next.slice(-TikTokEventManager.MAX_LOTUS_BADGES);
  }

  /**
   * Called by WorshipperCharacter on each synchronized downstroke of the wooden drum mallet (gõ mõ)!
   */
  public recordWoodenFishStrike(
    userId: string,
    tier: WoodenFishMilestoneTier,
    strikeIndex: number,
  ): void {
    this.totalWoodenFishCount += 1;
    const p = this.participantsMap.get(userId);
    if (p) {
      p.woodenFishStrikes += 1;
    }

    if (this.effectsEnabled) {
      const vol = tier === 'like_1000' ? 0.82 : tier === 'like_100' ? 0.72 : 0.65;
      soundSynthesizer.playWoodenFish(vol, strikeIndex);
      if (tier === 'like_1000' && strikeIndex === 5) {
        soundSynthesizer.playIncenseChime(0.58);
      }
    }
    this.scheduleNotify();
  }

  /**
   * Called by WorshipperCharacter when a seated wooden-fish milestone animation finishes
   */
  public completeWoodenFishAction(userId: string, actionId: string): void {
    const safety = this.woodenFishSafetyTimers.get(actionId);
    if (safety !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(safety);
    }
    this.woodenFishSafetyTimers.delete(actionId);

    const p = this.participantsMap.get(userId);
    if (p && p.activeWoodenFish && p.activeWoodenFish.id === actionId) {
      p.activeWoodenFish = null;
      if (!p.activeRitual) {
        p.animState = 'sitting';
        p.animStateStartedAt = Date.now();
      }
    }

    // Check if another milestone was queued while striking
    this.tryStartQueuedWoodenFish(userId);
    this.scheduleNotify();
  }

  private isParticipantReadyAtSeat(p: Participant, now: number): boolean {
    if (p.activeRitual || p.activeWoodenFish) return false;
    const isEntering =
      (p.animState === 'walking_aisle' ||
        p.animState === 'turning_row' ||
        p.animState === 'walking_row' ||
        p.animState === 'turning_altar') &&
      now - p.animStateStartedAt < 6200;
    return !isEntering;
  }

  private enqueueOrTriggerWoodenFishMilestone(
    p: Participant,
    tier: WoodenFishMilestoneTier,
    now: number,
  ): void {
    const strikeCount = tier === 'like_1000' ? 6 : tier === 'like_100' ? 3 : 1;
    const durationMs = tier === 'like_1000' ? 4600 : tier === 'like_100' ? 2550 : 1250;

    const existingPending = this.pendingWoodenFishMap.get(p.userId);
    if (existingPending && MILESTONE_RANK[existingPending.tier] > MILESTONE_RANK[tier]) {
      // Keep higher-tier pending milestone
      existingPending.cumulativeLikes = p.totalLikes;
    } else {
      this.pendingWoodenFishMap.set(p.userId, {
        id: `mofish-${p.userId}-${now}-${Math.random().toString(36).slice(2, 6)}`,
        tier,
        strikeCount,
        cumulativeLikes: p.totalLikes,
        durationMs,
      });
    }

    this.tryStartQueuedWoodenFish(p.userId);
  }

  private tryStartQueuedWoodenFish(userId: string): boolean {
    const pending = this.pendingWoodenFishMap.get(userId);
    if (!pending) return false;

    const p = this.participantsMap.get(userId);
    if (!p) {
      this.pendingWoodenFishMap.delete(userId);
      return false;
    }

    const now = Date.now();
    if (!this.isParticipantReadyAtSeat(p, now)) {
      return false;
    }

    this.pendingWoodenFishMap.delete(userId);
    const activeAction: ActiveWoodenFishAction = {
      ...pending,
      startedAt: now,
    };

    p.activeWoodenFish = activeAction;
    p.animState = 'wooden_fish';
    p.animStateStartedAt = now;
    p.ritualStatusLabel =
      pending.tier === 'like_1000'
        ? `Đại lễ Gõ Mõ · ${pending.cumulativeLikes} ❤️`
        : pending.tier === 'like_100'
          ? `Gõ 3 tiếng mõ · ${pending.cumulativeLikes} ❤️`
          : `Gõ mõ cầu an · ${pending.cumulativeLikes} ❤️`;
    p.ritualStatusUntil = now + pending.durationMs + 1400;

    // Spawn synchronized visual particle effects for 100 and 1000 like milestones
    if (this.effectsEnabled) {
      if (pending.tier === 'like_100') {
        this.spawnEffect({
          id: `fx-like100-${activeAction.id}`,
          type: 'golden_particles',
          userId: p.userId,
          username: p.username,
          giftName: '100 Tim · Tam Thanh Mõ',
          points: 100,
          seatIndex: p.seatIndex,
          startedAt: now,
          durationMs: 3200,
        });
      } else if (pending.tier === 'like_1000') {
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 5500);
        this.spawnEffect({
          id: `fx-like1000-${activeAction.id}`,
          type: 'lotus_petals',
          userId: p.userId,
          username: p.username,
          giftName: '1000 Tim · Đại Lễ Gõ Mõ',
          points: 1000,
          seatIndex: p.seatIndex,
          startedAt: now,
          durationMs: 5200,
        });
        this.addOrRefreshLotusBadge({
          userId: p.userId,
          username: p.username,
          nickname: p.nickname,
          avatarUrl: p.avatarUrl,
          ceremonyTitle: 'ĐẠI LỄ GÕ MÕ CẦU AN',
          offeringLabel: `${pending.cumulativeLikes} Lượt Thích`,
          preferredSide: getSeatPosition(p.seatIndex).side,
          durationMs: 6500,
        });
        this.prominentGiftBanner = {
          id: `banner-like1000-${activeAction.id}`,
          username: p.username,
          giftName: `Đại Lễ Gõ Mõ (${pending.cumulativeLikes} ❤️)`,
          points: 1000,
          isDemo: p.isDemo,
          expiresAt: now + 5400,
        };
      }
    }

    // Use VieNeuTTS ONLY for important milestones (1000 likes), never for every like!
    if (pending.tier === 'like_1000') {
      voiceManager.enqueue({
        text: `Xin cảm ơn Phật tử ${p.nickname || p.username} đã thành tâm gõ mõ cầu an với một nghìn lượt thích. Kính chúc bạn và gia đình luôn an lành.`,
        priority: AnnouncementPriority.MILESTONE,
        category: 'milestone',
        dedupeKey: `like-1000:${p.userId}:${Math.floor(pending.cumulativeLikes / 1000)}`,
        playBellBeforeSpeech: false,
      });
    }

    // Fallback safety timer in case character is outside maxParticipants render cap
    const isRendered =
      Array.from(this.participantsMap.keys()).indexOf(p.userId) < this.maxParticipants;
    if (!isRendered) {
      for (let s = 0; s < pending.strikeCount; s++) {
        window.setTimeout(() => {
          this.recordWoodenFishStrike(p.userId, pending.tier, s);
        }, s * 420 + 180);
      }
    }

    if (typeof window !== 'undefined') {
      const safetyId = window.setTimeout(() => {
        this.completeWoodenFishAction(p.userId, activeAction.id);
      }, pending.durationMs + 1200);
      this.woodenFishSafetyTimers.set(activeAction.id, safetyId);
    }

    return true;
  }

  /**
   * Called by WorshipperCharacter when a character physically arrives at their Altar Ritual Station
   */
  public notifyAltarRitualArrived(userId: string, ritualId: string): void {
    if (this.arrivedRitualIds.has(ritualId)) return;
    this.arrivedRitualIds.add(ritualId);

    const p = this.participantsMap.get(userId);
    if (!p || !p.activeRitual || p.activeRitual.id !== ritualId) return;

    const now = Date.now();
    const r = p.activeRitual;

    switch (r.type) {
      case 'altar_incense': {
        this.incenseGlowUntil = Math.max(this.incenseGlowUntil, now + 6500);
        if (this.effectsEnabled) {
          soundSynthesizer.playIncenseChime(0.65);
          this.spawnEffect({
            id: `arr-incense-${ritualId}`,
            type: 'incense_smoke',
            userId: p.userId,
            username: p.username,
            giftName: 'Thắp Hương',
            points: 30,
            seatIndex: p.seatIndex,
            originX: 0,
            originZ: -9.85,
            startedAt: now,
            durationMs: 4500,
          });
        }
        break;
      }

      case 'altar_flower': {
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 4500);
        if (this.effectsEnabled) {
          soundSynthesizer.playOfferingChime(0.72);
          this.spawnEffect({
            id: `arr-flower-${ritualId}`,
            type: 'lotus_petals',
            userId: p.userId,
            username: p.username,
            giftName: 'Hoa Hồng Cầu An',
            points: 50,
            seatIndex: p.seatIndex,
            originX: r.targetX,
            originZ: r.targetZ - 0.35,
            startedAt: now,
            durationMs: 4500,
          });
        }
        break;
      }

      case 'altar_fruit_tray': {
        this.fruitGlowUntil = Math.max(this.fruitGlowUntil, now + 8000);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 5000);
        if (this.effectsEnabled) {
          soundSynthesizer.playOfferingChime(0.75);
          this.spawnEffect({
            id: `arr-fruit-${ritualId}`,
            type: 'golden_particles',
            userId: p.userId,
            username: p.username,
            giftName: 'Mâm Quả Cầu Gia Đạo',
            points: 350,
            seatIndex: p.seatIndex,
            originX: r.targetX,
            originZ: r.targetZ - 0.45,
            startedAt: now,
            durationMs: 4800,
          });
        }
        break;
      }

      case 'altar_lotus_pedestal': {
        this.lotusGlowUntil = Math.max(this.lotusGlowUntil, now + 8500);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 6500);
        if (this.effectsEnabled) {
          soundSynthesizer.playLotusPedestalChime(0.78);
          this.spawnEffect({
            id: `arr-lotusped-${ritualId}`,
            type: 'lotus_petals',
            userId: p.userId,
            username: p.username,
            giftName: 'Đài Sen Cầu Tài Lộc',
            points: 990,
            seatIndex: p.seatIndex,
            originX: r.targetX,
            originZ: r.targetZ - 0.35,
            startedAt: now,
            durationMs: 5600,
          });
        }
        break;
      }

      case 'altar_lantern': {
        this.floatingLanternCount = Math.min(24, this.floatingLanternCount + 1);
        if (this.effectsEnabled) {
          soundSynthesizer.playWaterLanternChime(0.72);
          this.spawnEffect({
            id: `arr-lantern-${ritualId}`,
            type: 'floating_lantern',
            userId: p.userId,
            username: p.username,
            giftName: 'Thả Hoa Đăng',
            points: 40,
            seatIndex: p.seatIndex,
            originX: r.targetX,
            originZ: -8.95,
            startedAt: now,
            durationMs: 4800,
          });
        }
        break;
      }

      case 'altar_bell': {
        this.bellRingUntil = Math.max(this.bellRingUntil, now + 5600);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 4800);
        if (this.effectsEnabled) {
          soundSynthesizer.playTempleBell(0.92);
          this.spawnEffect({
            id: `arr-bell-${ritualId}`,
            type: 'bell_waves',
            userId: p.userId,
            username: p.username,
            giftName: 'Chuông Đồng Cầu Sức Khỏe',
            points: 150,
            seatIndex: p.seatIndex,
            originX: 4.25,
            originZ: -9.55,
            startedAt: now,
            durationMs: 5000,
          });
        }
        break;
      }

      case 'altar_pagoda':
      case 'altar_grand_ceremony': {
        this.pagodaGlowUntil = Math.max(this.pagodaGlowUntil, now + 10000);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 9000);
        this.bellRingUntil = Math.max(this.bellRingUntil, now + 5600);
        this.incenseGlowUntil = Math.max(this.incenseGlowUntil, now + 7500);
        if (this.effectsEnabled) {
          soundSynthesizer.playGrandCeremonyBell(0.95);
          this.spawnEffect({
            id: `arr-pagoda-${ritualId}`,
            type: 'grand_ceremony',
            userId: p.userId,
            username: p.username,
            giftName: 'Bảo Tháp Công Đức',
            points: 1990,
            seatIndex: p.seatIndex,
            originX: 0,
            originZ: -9.1,
            startedAt: now,
            durationMs: 7800,
          });
        }
        break;
      }

      default:
        break;
    }

    this.scheduleNotify();
  }

  /**
   * Called by WorshipperCharacter once the character has walked all the way back
   * to their original reserved seat and resumed sitting.
   */
  public completeCharacterRitual(userId: string, ritualId: string): void {
    const timer = this.ritualSafetyTimers.get(ritualId);
    if (timer !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(timer);
    }
    this.ritualSafetyTimers.delete(ritualId);
    this.arrivedRitualIds.delete(ritualId);

    for (const [stId, ownerId] of this.occupiedStations.entries()) {
      if (ownerId === userId) {
        this.occupiedStations.delete(stId);
      }
    }

    const now = Date.now();
    // Fade the user's Floating Lotus Avatar badge gracefully 1.4s after ceremony completes
    const badge = this.activeLotusBadges.find((b) => b.userId === userId);
    if (badge && badge.expiresAt > now + 1400) {
      badge.expiresAt = now + 1400;
    }

    const p = this.participantsMap.get(userId);
    if (p && p.activeRitual && p.activeRitual.id === ritualId) {
      p.activeRitual = null;
      p.ritualStatusLabel = undefined;
      p.ritualStatusUntil = undefined;
      p.animState = 'sitting';
      p.animStateStartedAt = now;
    }

    // If user accumulated a 10/100/1000 Like Gõ Mõ milestone while away at the altar, play it now!
    this.tryStartQueuedWoodenFish(userId);
    this.tryDispatchQueuedRituals();
    this.scheduleNotify();
  }

  private enqueueAltarRitual(params: {
    userId: string;
    type: RitualActionType;
    label: string;
    ceremonyBadgeTitle: string;
    offeringLabel: string;
    spokenText?: string;
    playBellBeforeSpeech?: boolean;
    isLargeCeremony?: boolean;
    durationMs?: number;
  }): void {
    const p = this.participantsMap.get(params.userId);
    if (!p) return;

    const priority = RITUAL_PRIORITY[params.type] ?? 3;
    const durationMs = params.durationMs ?? 4400;
    const existingIdx = this.ritualQueue.findIndex((q) => q.userId === params.userId);

    // If user already has a queued ritual, upgrade if higher/equal priority so no duplicate trips spam
    if (existingIdx !== -1) {
      if (priority <= this.ritualQueue[existingIdx].priority) {
        this.ritualQueue[existingIdx] = {
          ...this.ritualQueue[existingIdx],
          type: params.type,
          label: params.label,
          ceremonyBadgeTitle: params.ceremonyBadgeTitle,
          offeringLabel: params.offeringLabel,
          spokenText: params.spokenText ?? this.ritualQueue[existingIdx].spokenText,
          playBellBeforeSpeech: params.playBellBeforeSpeech,
          isLargeCeremony: params.isLargeCeremony,
          priority,
          durationMs,
        };
      }
      this.tryDispatchQueuedRituals();
      return;
    }

    this.ritualQueue.push({
      id: `ritual-${params.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: params.userId,
      type: params.type,
      label: params.label,
      ceremonyBadgeTitle: params.ceremonyBadgeTitle,
      offeringLabel: params.offeringLabel,
      spokenText: params.spokenText,
      playBellBeforeSpeech: params.playBellBeforeSpeech,
      isLargeCeremony: params.isLargeCeremony,
      priority,
      durationMs,
      createdAt: Date.now(),
    });

    this.ritualQueue.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.createdAt - b.createdAt,
    );

    if (this.ritualQueue.length > 40) {
      this.ritualQueue.length = 40;
    }

    this.tryDispatchQueuedRituals();
  }

  private isStationAvailable(stationId: AltarStationId): boolean {
    for (const occupiedId of this.occupiedStations.keys()) {
      if (areAltarStationsTooClose(stationId, occupiedId)) {
        return false;
      }
    }
    return true;
  }

  private tryDispatchQueuedRituals(): boolean {
    if (
      this.ritualQueue.length === 0 ||
      this.occupiedStations.size >= this.maxConcurrentCeremonies
    ) {
      return false;
    }

    const now = Date.now();
    let dispatchedAny = false;

    for (let i = 0; i < this.ritualQueue.length; i++) {
      if (this.occupiedStations.size >= this.maxConcurrentCeremonies) {
        break;
      }

      const item = this.ritualQueue[i];
      const p = this.participantsMap.get(item.userId);
      if (!p) {
        this.ritualQueue.splice(i, 1);
        i--;
        continue;
      }

      // Wait if character is already on an active altar trip OR still walking in from temple entrance to claim their seat
      if (p.activeRitual) continue;
      const isStillEntering =
        (p.animState === 'walking_aisle' ||
          p.animState === 'turning_row' ||
          p.animState === 'walking_row' ||
          p.animState === 'turning_altar') &&
        now - p.animStateStartedAt < 4800;
      if (isStillEntering) continue;

      const seat = getSeatPosition(p.seatIndex);
      const candidates = getCandidateStationsForRitual(item.type, seat.side);
      const chosenStationId = candidates.find((st) => this.isStationAvailable(st));
      if (!chosenStationId) continue;

      const station = ALTAR_STATIONS[chosenStationId];
      this.occupiedStations.set(chosenStationId, p.userId);
      this.ritualQueue.splice(i, 1);
      i--;

      // Clear any active seated wooden-fish pose cleanly before standing up
      if (p.activeWoodenFish) {
        const prevActId = p.activeWoodenFish.id;
        p.activeWoodenFish = null;
        const tId = this.woodenFishSafetyTimers.get(prevActId);
        if (tId !== undefined && typeof window !== 'undefined') window.clearTimeout(tId);
        this.woodenFishSafetyTimers.delete(prevActId);
      }

      // Dedicated separate outbound (±0.44) and inbound return (±1.04) carpet lanes prevent aisle collisions
      const outboundLaneX = seat.side === 'left' ? -0.44 : 0.44;
      const returnLaneX = seat.side === 'left' ? -1.04 : 1.04;

      const activeRitual: ActiveCharacterRitual = {
        id: item.id,
        type: item.type,
        label: item.label,
        ceremonyBadgeTitle: item.ceremonyBadgeTitle,
        stationId: chosenStationId,
        targetX: station.x,
        targetZ: station.z,
        faceRotY: station.faceRotY,
        outboundLaneX,
        returnLaneX,
        startedAt: now,
        durationMs: item.durationMs,
      };

      p.activeRitual = activeRitual;
      p.ritualStatusLabel = item.label;
      p.ritualStatusUntil = now + 18000;
      p.animState = 'leaving_seat_to_aisle';
      p.animStateStartedAt = now;
      p.lastActivityAt = now;

      // 3. FLOATING LOTUS AVATAR EFFECT: Display pink lotus badge linked to this real 3D character!
      this.addOrRefreshLotusBadge({
        userId: p.userId,
        username: p.username,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
        ceremonyTitle: item.ceremonyBadgeTitle,
        offeringLabel: item.offeringLabel,
        preferredSide: seat.side,
        durationMs: item.durationMs + 8500,
      });

      // 5. AUTOMATIC VIENEU VOICE: Announce when the ritual begins!
      const voiceSettings = voiceManager.getSettings();
      if (item.spokenText && voiceSettings.giftAnnouncementsEnabled) {
        voiceManager.enqueue({
          text: item.spokenText,
          priority: item.isLargeCeremony
            ? AnnouncementPriority.LARGE_GIFT
            : AnnouncementPriority.NORMAL_GIFT,
          category: item.isLargeCeremony ? 'large_gift' : 'gift',
          dedupeKey: `ceremony:${p.userId}:${item.type}:${Math.floor(now / 5000)}`,
          playBellBeforeSpeech: Boolean(item.playBellBeforeSpeech),
          bypassRateLimit: Boolean(item.isLargeCeremony),
        });
      }

      if (typeof window !== 'undefined') {
        const safetyId = window.setTimeout(() => {
          this.completeCharacterRitual(p.userId, activeRitual.id);
        }, 23000);
        this.ritualSafetyTimers.set(activeRitual.id, safetyId);
      }

      dispatchedAny = true;
    }

    return dispatchedAny;
  }

  private spawnEffect(fx: ActiveGiftVisualEffect): void {
    this.activeEffects.push(fx);
    if (this.activeEffects.length > 14) {
      this.activeEffects = this.activeEffects.slice(-10);
    }
  }

  public processEvent(raw: Partial<TikTokNormalizedEvent>): void {
    if (!raw || !raw.type || !raw.userId || !raw.username) return;

    const now = Date.now();
    const eventId = String(raw.eventId || `${raw.type}-${raw.userId}-${now}-${Math.random()}`);
    if (this.processedEventIds.has(eventId)) return;
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > 3000) {
      const first = this.processedEventIds.values().next().value;
      if (first) this.processedEventIds.delete(first);
    }

    const userId = String(raw.userId).trim();
    const username = String(raw.username).trim().replace(/^@+/, '');
    const nickname = raw.nickname ? String(raw.nickname).trim() : username;
    const isDemo = Boolean(raw.isDemo);

    this.totalEventsProcessed += 1;

    // 1. FOLLOW => If user is already seated, walk to altar and THẮP HƯƠNG!
    if (raw.type === 'follow') {
      const prevFollow = this.userFollowRateMap.get(userId) || 0;
      if (now - prevFollow < 4000) return;
      this.userFollowRateMap.set(userId, now);

      const existing = this.participantsMap.get(userId);
      if (existing) {
        if (raw.avatarUrl) existing.avatarUrl = raw.avatarUrl;
        existing.points += 30;
        existing.lastActivityAt = now;
        this.enqueueAltarRitual({
          userId,
          type: 'altar_incense',
          label: 'Thắp hương cầu an',
          ceremonyBadgeTitle: 'DÂNG HƯƠNG CẦU AN',
          offeringLabel: 'Tâm Hương',
          spokenText: voiceManager.getSettings().followAnnouncementsEnabled
            ? `Phật tử ${nickname} thành tâm dâng nén tâm hương cầu bình an.`
            : undefined,
          durationMs: 4200,
        });
        this.pushNotification({
          id: `notif-${eventId}`,
          kind: 'follow',
          username,
          avatarUrl: existing.avatarUrl,
          message: 'theo dõi & lên bàn thờ thắp hương',
          pointsDelta: 30,
          isDemo,
          timestamp: now,
        });
      } else {
        this.pushNotification({
          id: `notif-${eventId}`,
          kind: 'follow',
          username,
          avatarUrl: raw.avatarUrl,
          message: 'đã theo dõi Chùa Online',
          isDemo,
          timestamp: now,
        });
      }
      this.scheduleNotify();
      return;
    }

    // 2. SHARE => If user is already seated, walk to Lotus Basin and THẢ HOA ĐĂNG!
    if (raw.type === 'share') {
      const prevShare = this.userShareRateMap.get(userId) || 0;
      if (now - prevShare < 3500) return;
      this.userShareRateMap.set(userId, now);

      const existing = this.participantsMap.get(userId);
      if (existing) {
        if (raw.avatarUrl) existing.avatarUrl = raw.avatarUrl;
        existing.points += 40;
        existing.lastActivityAt = now;
        this.enqueueAltarRitual({
          userId,
          type: 'altar_lantern',
          label: 'Thả hoa đăng',
          ceremonyBadgeTitle: 'THẢ HOA ĐĂNG CẦU AN',
          offeringLabel: 'Hoa Đăng',
          spokenText: `Phật tử ${nickname} thả hoa đăng cầu nguyện ánh sáng từ bi và an lành.`,
          durationMs: 4400,
        });
        this.pushNotification({
          id: `notif-${eventId}`,
          kind: 'share',
          username,
          avatarUrl: existing.avatarUrl,
          message: 'chia sẻ phiên LIVE & thả hoa đăng cầu an',
          pointsDelta: 40,
          isDemo,
          timestamp: now,
        });
        this.scheduleNotify();
      }
      return;
    }

    // 3. INTERACTIVE LIKE = GÕ MÕ SYSTEM
    // - Identify using TikTok userId, award 1 merit point per new like, track cumulative likes per user.
    // - Never create duplicate characters & never spawn new characters from likes alone.
    // - Aggregate incoming likes, handle cumulativeUserLikes safely, and trigger 10 / 100 / 1000 milestones!
    if (raw.type === 'like') {
      const prevLikes = this.userCumulativeLikes.get(userId) || 0;
      let deltaLikes = 0;

      if (raw.cumulativeUserLikes !== undefined && Number.isFinite(raw.cumulativeUserLikes)) {
        const incomingTotal = Math.max(0, Math.floor(Number(raw.cumulativeUserLikes)));
        if (incomingTotal <= prevLikes) {
          return; // Prevent duplicate cumulative packet rewards
        }
        deltaLikes = incomingTotal - prevLikes;
      } else {
        deltaLikes = Math.max(1, Math.min(2000, Math.round(Number(raw.likeCount || 1))));
      }

      const nextLikes = prevLikes + deltaLikes;
      this.userCumulativeLikes.set(userId, nextLikes);
      this.totalLikesCount += deltaLikes;

      const existing = this.participantsMap.get(userId);
      if (!existing) {
        // Do NOT spawn new characters from likes alone; still update global ❤️ Tổng lượt thích!
        this.scheduleNotify();
        return;
      }

      if (raw.avatarUrl) existing.avatarUrl = raw.avatarUrl;
      existing.totalLikes = nextLikes;
      existing.points += deltaLikes; // 1 merit point per new like
      existing.lastActivityAt = now;

      // Determine highest crossed milestone between prevLikes -> nextLikes
      const crossed1000 = Math.floor(nextLikes / 1000) > Math.floor(prevLikes / 1000);
      const crossed100 = Math.floor(nextLikes / 100) > Math.floor(prevLikes / 100);
      const crossed10 = Math.floor(nextLikes / 10) > Math.floor(prevLikes / 10);

      if (crossed1000) {
        this.enqueueOrTriggerWoodenFishMilestone(existing, 'like_1000', now);
        this.pushNotification({
          id: `notif-${eventId}`,
          kind: 'like',
          username,
          avatarUrl: existing.avatarUrl,
          message: `đạt cột mốc ${nextLikes} ❤️ · Đại lễ Gõ Mõ Kim Liên!`,
          pointsDelta: deltaLikes,
          isDemo,
          timestamp: now,
        });
      } else if (crossed100) {
        this.enqueueOrTriggerWoodenFishMilestone(existing, 'like_100', now);
        this.pushNotification({
          id: `notif-${eventId}`,
          kind: 'like',
          username,
          avatarUrl: existing.avatarUrl,
          message: `đạt ${nextLikes} ❤️ · Gõ 3 tiếng mõ hào quang`,
          pointsDelta: deltaLikes,
          isDemo,
          timestamp: now,
        });
      } else if (crossed10) {
        const last10At = this.userLastLike10Cooldown.get(userId) || 0;
        if (now - last10At >= 1800) {
          this.userLastLike10Cooldown.set(userId, now);
          this.enqueueOrTriggerWoodenFishMilestone(existing, 'like_10', now);
          this.pushNotification({
            id: `notif-${eventId}`,
            kind: 'like',
            username,
            avatarUrl: existing.avatarUrl,
            message: `thả tim (${nextLikes} ❤️) · Gõ mõ cầu an`,
            pointsDelta: deltaLikes,
            isDemo,
            timestamp: now,
          });
        }
      }

      this.scheduleNotify();
      return;
    }

    if (raw.type === 'join' || raw.type === 'leave') {
      return;
    }

    // 4. COMMENT => First comment spawns & seats character; Prayer comments trigger respectful prayer!
    if (raw.type === 'comment') {
      this.handleCommentEvent({
        eventId,
        userId,
        username,
        nickname,
        avatarUrl: raw.avatarUrl,
        comment: String(raw.comment || ''),
        isDemo,
        now,
      });
      return;
    }

    // 5. GIFT => Finds existing character (or creates & assigns permanent seat) and queues the mapped ritual!
    if (raw.type === 'gift') {
      // Client-side streak safety deduplication if external webhook sends streakKey
      let giftCount = Math.max(1, Math.round(Number(raw.giftCount || 1)));
      if (raw.streakKey && !raw.verifiedBackend) {
        const prevStreak = this.clientStreakCounts.get(raw.streakKey) || 0;
        if (giftCount <= prevStreak) {
          if (raw.repeatEnd) this.clientStreakCounts.delete(raw.streakKey);
          return;
        }
        const delta = giftCount - prevStreak;
        if (raw.repeatEnd) {
          this.clientStreakCounts.delete(raw.streakKey);
        } else {
          this.clientStreakCounts.set(raw.streakKey, giftCount);
        }
        giftCount = delta;
      }

      this.handleGiftEvent({
        eventId,
        userId,
        username,
        nickname,
        avatarUrl: raw.avatarUrl,
        giftId: Number(raw.giftId || 5655),
        giftName: String(raw.giftName || 'Rose'),
        giftCount,
        diamondCount: Number(raw.diamondCount || 1),
        isDemo,
        now,
      });
    }
  }

  private ensureParticipant(params: {
    userId: string;
    username: string;
    nickname: string;
    avatarUrl?: string;
    isDemo: boolean;
    now: number;
  }): { participant: Participant; isNew: boolean } {
    const existing = this.participantsMap.get(params.userId);
    if (existing) {
      existing.username = params.username;
      existing.nickname = params.nickname || existing.nickname;
      if (params.avatarUrl) existing.avatarUrl = params.avatarUrl;
      existing.lastActivityAt = params.now;
      return { participant: existing, isNew: false };
    }

    const { seatIndex, laneOffset } = this.seatManager.assignSeatForUser(params.userId);
    const seed = hashStringToFloat(params.userId);
    const priorLikes = this.userCumulativeLikes.get(params.userId) || 0;

    const created: Participant = {
      userId: params.userId,
      username: params.username,
      nickname: params.nickname,
      avatarUrl:
        params.avatarUrl || buildSacredAvatarDataUri(params.userId, params.nickname || params.username),
      seatIndex,
      laneOffset,
      points: 10 + priorLikes,
      giftCount: 0,
      commentCount: 0,
      totalLikes: priorLikes,
      woodenFishStrikes: 0,
      animState: 'walking_aisle',
      animStateStartedAt: params.now,
      activeRitual: null,
      activeWoodenFish: null,
      lastActivityAt: params.now,
      robeHueShift: (seed - 0.5) * 0.08,
      hasHairBun: seed > 0.45,
      isDemo: params.isDemo,
    };

    this.participantsMap.set(params.userId, created);
    return { participant: created, isNew: true };
  }

  private handleCommentEvent(params: {
    eventId: string;
    userId: string;
    username: string;
    nickname: string;
    avatarUrl?: string;
    comment: string;
    isDemo: boolean;
    now: number;
  }): void {
    const cleanComment = params.comment.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!cleanComment || CLIENT_PROFANITY_REGEX.test(cleanComment)) return;

    const prevCommentAt = this.userCommentRateMap.get(params.userId) || 0;
    if (params.now - prevCommentAt < 950) return;
    this.userCommentRateMap.set(params.userId, params.now);

    const { participant, isNew } = this.ensureParticipant(params);
    participant.commentCount += 1;
    participant.lastComment = cleanComment;
    participant.lastCommentAt = params.now;

    const prayerMatch = detectPrayerTopic(cleanComment);
    const isPrayer = Boolean(prayerMatch);
    const pointsDelta = isPrayer ? 20 : 8;
    participant.points += pointsDelta;

    if (isPrayer && prayerMatch) {
      participant.ritualStatusLabel = prayerMatch.topicLabel;
      participant.ritualStatusUntil = params.now + 4800;

      if (
        !isNew &&
        !participant.activeRitual &&
        !participant.activeWoodenFish &&
        (participant.animState === 'sitting' ||
          participant.animState === 'praying' ||
          participant.animState === 'wooden_fish')
      ) {
        participant.animState = 'praying';
        participant.animStateStartedAt = params.now;
        if (this.effectsEnabled) {
          soundSynthesizer.playIncenseChime(0.42);
        }
      }
    }

    this.pushNotification({
      id: `notif-${params.eventId}`,
      kind: isNew ? 'welcome' : isPrayer ? 'prayer' : 'comment',
      username: params.username,
      avatarUrl: participant.avatarUrl,
      message: cleanComment,
      pointsDelta,
      isDemo: params.isDemo,
      timestamp: params.now,
    });

    const voiceSettings = voiceManager.getSettings();
    if (isNew && voiceSettings.welcomeAnnouncementsEnabled) {
      const tpl =
        voiceSettings.welcomeTemplate?.trim() ||
        'Chào mừng Phật tử {username} đã đến với Chùa Online. Kính chúc bạn luôn bình an.';
      const welcomeSpeech = tpl.replace(/\{username\}/g, params.nickname || params.username);
      voiceManager.enqueue({
        text: welcomeSpeech,
        priority: AnnouncementPriority.WELCOME,
        category: 'welcome',
        dedupeKey: `welcome:${params.userId}`,
      });
    } else if (isPrayer && prayerMatch && voiceSettings.prayerAnnouncementsEnabled) {
      voiceManager.enqueue({
        text: prayerMatch.spokenBlessing(params.nickname || params.username),
        priority: AnnouncementPriority.COMMENT,
        category: 'comment',
        dedupeKey: `prayer:${prayerMatch.topicLabel}:${Math.floor(params.now / 8000)}`,
      });
    }

    this.scheduleNotify();
  }

  private resolveCeremonialMapping(giftId: number, giftName: string, diamondCount: number): GiftMapping {
    const lower = giftName.trim().toLowerCase();
    const exactId = this.giftMappings.find((m) => m.enabled && m.giftId === giftId);
    if (exactId) return exactId;

    const exactName = this.giftMappings.find(
      (m) =>
        m.enabled &&
        (m.giftName.toLowerCase() === lower || m.vietnameseLabel.toLowerCase() === lower),
    );
    if (exactName) return exactName;

    // Keyword / diamond tier fallback onto the 5 configured Buddhist ceremony offerings
    if (/bell|chuông|chung/i.test(lower)) {
      return this.giftMappings.find((m) => m.ritualType === 'altar_bell') || DEFAULT_GIFT_MAPPINGS[1];
    }
    if (/fruit|quả|mâm/i.test(lower)) {
      return (
        this.giftMappings.find((m) => m.ritualType === 'altar_fruit_tray') || DEFAULT_GIFT_MAPPINGS[2]
      );
    }
    if (/lotus|sen|đài/i.test(lower)) {
      return (
        this.giftMappings.find((m) => m.ritualType === 'altar_lotus_pedestal') ||
        DEFAULT_GIFT_MAPPINGS[3]
      );
    }
    if (diamondCount >= 180 || /pagoda|tháp|lion|universe/i.test(lower)) {
      return (
        this.giftMappings.find(
          (m) => m.ritualType === 'altar_pagoda' || m.ritualType === 'altar_grand_ceremony',
        ) || DEFAULT_GIFT_MAPPINGS[4]
      );
    }
    if (diamondCount >= 80) {
      return (
        this.giftMappings.find((m) => m.ritualType === 'altar_lotus_pedestal') ||
        DEFAULT_GIFT_MAPPINGS[3]
      );
    }
    if (diamondCount >= 25) {
      return (
        this.giftMappings.find((m) => m.ritualType === 'altar_fruit_tray') || DEFAULT_GIFT_MAPPINGS[2]
      );
    }
    if (diamondCount >= 8) {
      return this.giftMappings.find((m) => m.ritualType === 'altar_bell') || DEFAULT_GIFT_MAPPINGS[1];
    }

    return this.giftMappings[0] || DEFAULT_GIFT_MAPPINGS[0];
  }

  private getRitualLabelAndDuration(mapping: GiftMapping): {
    ritualLabel: string;
    durationMs: number;
    playBellBeforeSpeech: boolean;
  } {
    switch (mapping.ritualType) {
      case 'altar_bell':
        return {
          ritualLabel: `Thỉnh ${mapping.vietnameseLabel}`,
          durationMs: 4600,
          playBellBeforeSpeech: true,
        };
      case 'altar_fruit_tray':
        return {
          ritualLabel: `Dâng ${mapping.vietnameseLabel}`,
          durationMs: 4600,
          playBellBeforeSpeech: false,
        };
      case 'altar_lotus_pedestal':
        return {
          ritualLabel: `Dâng ${mapping.vietnameseLabel}`,
          durationMs: 5000,
          playBellBeforeSpeech: false,
        };
      case 'altar_pagoda':
      case 'altar_grand_ceremony':
        return {
          ritualLabel: `Nghi lễ ${mapping.vietnameseLabel}`,
          durationMs: 5800,
          playBellBeforeSpeech: true,
        };
      case 'altar_lantern':
        return {
          ritualLabel: `Thả ${mapping.vietnameseLabel}`,
          durationMs: 4400,
          playBellBeforeSpeech: false,
        };
      case 'altar_incense':
        return {
          ritualLabel: 'Thắp hương cầu an',
          durationMs: 4200,
          playBellBeforeSpeech: false,
        };
      case 'altar_flower':
      default:
        return {
          ritualLabel: `Dâng ${mapping.vietnameseLabel}`,
          durationMs: 4300,
          playBellBeforeSpeech: false,
        };
    }
  }

  private handleGiftEvent(params: {
    eventId: string;
    userId: string;
    username: string;
    nickname: string;
    avatarUrl?: string;
    giftId: number;
    giftName: string;
    giftCount: number;
    diamondCount: number;
    isDemo: boolean;
    now: number;
  }): void {
    const { participant } = this.ensureParticipant(params);
    const mapping = this.resolveCeremonialMapping(
      params.giftId,
      params.giftName,
      params.diamondCount,
    );

    if (!mapping.enabled) {
      this.scheduleNotify();
      return;
    }

    // Increment live event counter on "🪷 CÚNG DƯỜNG CẦU AN"
    this.giftEventCounts[mapping.id] = (this.giftEventCounts[mapping.id] || 0) + params.giftCount;

    const awardedPoints = mapping.points * params.giftCount;
    const isLarge =
      mapping.isLarge ||
      mapping.ritualType === 'altar_pagoda' ||
      mapping.ritualType === 'altar_grand_ceremony';

    participant.points += awardedPoints;
    participant.giftCount += params.giftCount;
    participant.lastGiftName = mapping.vietnameseLabel;
    participant.lastGiftAt = params.now;

    const { ritualLabel, durationMs, playBellBeforeSpeech } =
      this.getRitualLabelAndDuration(mapping);

    const template =
      mapping.ttsTemplate ||
      'Xin cảm ơn Phật tử {username} đã tham gia nghi lễ cúng dường.';
    const spokenText = template.replace(
      /\{username\}/g,
      params.nickname || params.username,
    );

    // Queue the ritual for BOTH existing seated characters AND newly created characters!
    // (If newly created, tryDispatchQueuedRituals waits until they claim their permanent seat, then sends them to the altar!)
    this.enqueueAltarRitual({
      userId: participant.userId,
      type: mapping.ritualType,
      label: `${ritualLabel} · ${mapping.ceremonyTitle}`,
      ceremonyBadgeTitle: mapping.badgeCeremonyLabel || mapping.ceremonyTitle || 'LỄ PHẬT CẦU AN',
      offeringLabel: mapping.vietnameseLabel,
      spokenText,
      playBellBeforeSpeech,
      isLargeCeremony: isLarge,
      durationMs,
    });

    if (this.effectsEnabled && isLarge) {
      this.prominentGiftBanner = {
        id: `banner-${params.eventId}`,
        username: participant.username,
        giftName: `${mapping.vietnameseLabel} (${mapping.ceremonyTitle})`,
        points: awardedPoints,
        isDemo: params.isDemo,
        expiresAt: params.now + 5600,
      };
    }

    this.pushNotification({
      id: `notif-${params.eventId}`,
      kind: isLarge ? 'large_gift' : 'gift',
      username: params.username,
      avatarUrl: participant.avatarUrl,
      message: `${ritualLabel} · ${mapping.ceremonyTitle} (${params.giftCount}x ${mapping.vietnameseLabel})`,
      pointsDelta: awardedPoints,
      isDemo: params.isDemo,
      timestamp: params.now,
    });

    this.scheduleNotify();
  }

  private pushNotification(item: FeedNotification): void {
    this.notifications = [item, ...this.notifications].slice(0, 28);
  }
}

export const tiktokEventManager = new TikTokEventManager();
