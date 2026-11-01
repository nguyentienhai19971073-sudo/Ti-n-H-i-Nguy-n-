import {
  ActiveCharacterRitual,
  ActiveGiftVisualEffect,
  ActiveWoodenFishAction,
  ActiveXinXamStage,
  ActiveXinXamVisualState,
  AltarStationId,
  AnnouncementPriority,
  CeremonialAnnouncementItem,
  CommentVoiceTemplates,
  DEFAULT_GIFT_MAPPINGS,
  FeedNotification,
  GiftCalculationLogEntry,
  GiftCeremonyQueueItemSnapshot,
  GiftCharacterAnimType,
  GiftEffectType,
  GiftMapping,
  GiftSoundEffectType,
  LotusBurstTrigger,
  LotusCeremonyBadge,
  MeritLedgerEntry,
  Participant,
  RitualActionType,
  TikTokNormalizedEvent,
  WoodenFishMilestoneTier,
  XinXamDrawResult,
  getRitualDisplayNameVi,
  inferCanonicalCeremonialDefaults,
  normalizeGiftId,
  renderCeremonialSubtitle,
  renderGiftVoiceTemplate,
  renderXinXamVoiceText,
  sanitizeCeremonialText,
} from '../types/temple';
import {
  SeatManager,
  TOTAL_MAIN_MATS,
  areAltarStationsTooClose,
  getActiveAltarStation,
  getActiveCarpetLanes,
  getCandidateStationsForRitual,
  getSeatPosition,
} from './SeatManager';
import { giftRegistry } from './GiftRegistry';
import { xinXamRegistry } from './XinXamRegistry';
import { soundSynthesizer } from './SoundSynthesizer';
import {
  formatCommentSpeechFormula,
  normalizeSpeechUsername,
  voiceManager,
} from './VoiceManager';

type PrayerTemplateKey = keyof Omit<CommentVoiceTemplates, 'general'>;

interface PrayerTopicMatch {
  topicLabel: string;
  templateKey: PrayerTemplateKey;
}

const PRAYER_TOPIC_MATCHERS: { regex: RegExp; match: PrayerTopicMatch }[] = [
  {
    regex: /bình\s*an/i,
    match: {
      topicLabel: 'Cầu Bình An',
      templateKey: 'binhAn',
    },
  },
  {
    regex: /sức\s*khỏe|mạnh\s*khỏe/i,
    match: {
      topicLabel: 'Cầu Sức Khỏe',
      templateKey: 'sucKhoe',
    },
  },
  {
    regex: /tài\s*lộc|may\s*mắn|công\s*việc|thuận\s*lợi/i,
    match: {
      topicLabel: 'Cầu Tài Lộc',
      templateKey: 'taiLoc',
    },
  },
  {
    regex: /tình\s*duyên|nhân\s*duyên|hạnh\s*phúc/i,
    match: {
      topicLabel: 'Cầu Tình Duyên',
      templateKey: 'tinhDuyen',
    },
  },
  {
    regex: /học\s*hành|thi\s*cử|đỗ\s*đạt/i,
    match: {
      topicLabel: 'Cầu Học Hành',
      templateKey: 'hocHanh',
    },
  },
  {
    regex: /gia\s*đạo|gia\s*đình|cha\s*mẹ|ông\s*bà/i,
    match: {
      topicLabel: 'Cầu Gia Đạo',
      templateKey: 'giaDao',
    },
  },
  {
    regex: /(nam\s*mô|a\s*di\s*đà\s*phật|lạy\s*phật|mô\s*phật|thích\s*ca|quan\s*âm|cầu\s*nguyện)/i,
    match: {
      topicLabel: 'Thành Tâm Lễ Phật',
      templateKey: 'binhAn',
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
  offeringLabel: string;
  spokenText?: string;
  playBellBeforeSpeech?: boolean;
  isLargeCeremony?: boolean;
  isGiftCeremony?: boolean;
  xinXamDraw?: XinXamDrawResult;
  priority: number; // lower = higher priority
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
  xin_xam: 1,
  altar_lotus_pedestal: 2,
  glowing_lotus: 2,
  golden_light: 2,
  altar_fruit_tray: 2,
  altar_bell: 2,
  altar_flower: 3,
  altar_pray_clasped: 3,
  altar_wooden_fish: 3,
  altar_lantern: 3,
  altar_incense: 4,
  seat_prayer: 5,
  seat_wooden_fish: 6,
  no_animation: 6,
};

const MILESTONE_RANK: Record<WoodenFishMilestoneTier, number> = {
  like_10: 1,
  like_100: 2,
  like_1000: 3,
};

export interface TempleCongregationState {
  participants: Participant[]; // Active 3D characters rendered in the temple scene
  activeParticipantCount: number; // Total active participants currently in the temple
  departingCount: number;
  sessionMeritUsersCount: number; // Total session users stored in MeritLedger (including departed)
  departedUsersCount: number;
  leaderboard: MeritLedgerEntry[]; // Session-persistent merit leaderboard (preserved after 120s leave!)
  notifications: FeedNotification[];
  activeEffects: ActiveGiftVisualEffect[];
  activeLotusBadges: LotusCeremonyBadge[];
  giftEventCounts: Record<string, number>;
  ceremonyQueueInspector: GiftCeremonyQueueItemSnapshot[];
  recentGiftLogs: GiftCalculationLogEntry[];
  prominentGiftBanner: {
    id: string;
    username: string;
    giftName: string;
    points: number;
    isDemo: boolean;
    expiresAt: number;
  } | null;
  activeCenterAnnouncement: CeremonialAnnouncementItem | null;
  queuedCenterAnnouncementCount: number;
  activeXinXamResult: XinXamDrawResult | null;
  activeXinXamVisual: ActiveXinXamVisualState | null;
  activeLotusBursts: LotusBurstTrigger[];
  altarGlowUntil: number;
  bellRingUntil: number;
  incenseGlowUntil: number;
  fruitGlowUntil: number;
  lotusGlowUntil: number;
  pagodaGlowUntil: number;
  xinXamGlowUntil: number;
  floatingLanternCount: number;
  totalLikesCount: number;
  totalWoodenFishCount: number;
  activeAltarCount: number;
  queuedAltarCount: number;
  occupiedMainSeats: number;
  waitingOverflowCount: number;
  effectiveTimeoutSec: number;
  inactivityTimeoutEnabled: boolean;
  totalEventsProcessed: number;
}

type CongregationSubscriber = (state: TempleCongregationState) => void;

export class TikTokEventManager {
  private static readonly MAX_LOTUS_BADGES = 4;
  private static readonly DEMO_ACCELERATED_TIMEOUT_SEC = 12;
  private static readonly CENTER_PANEL_TRANSITION_GAP_MS = 120;

  // Active 3D participants currently inside the temple hall
  private participantsMap = new Map<string, Participant>();
  // Session-persistent merit & gift history ledger (NOT deleted when inactive users depart!)
  private meritLedger = new Map<string, MeritLedgerEntry>();

  private seatManager = new SeatManager();
  private giftMappings: GiftMapping[] = [...DEFAULT_GIFT_MAPPINGS];
  private giftEventCounts: Record<string, number> = {};
  private recentGiftLogs: GiftCalculationLogEntry[] = [];
  private notifications: FeedNotification[] = [];
  private activeEffects: ActiveGiftVisualEffect[] = [];
  private activeLotusBadges: LotusCeremonyBadge[] = [];
  private prominentGiftBanner: TempleCongregationState['prominentGiftBanner'] = null;

  // Priority-queued non-overlapping Center Ceremonial Announcement, Xin Xăm Result & Falling Lotus Shower state
  private centerAnnouncementQueue: CeremonialAnnouncementItem[] = [];
  private activeCenterAnnouncement: CeremonialAnnouncementItem | null = null;
  private xinXamResultQueue: XinXamDrawResult[] = [];
  private activeXinXamResult: XinXamDrawResult | null = null;
  private activeXinXamVisual: ActiveXinXamVisualState | null = null;
  private pendingXinXamDrawsByRitualId = new Map<string, XinXamDrawResult>();
  private revealedXinXamRitualIds = new Set<string>();
  private xinXamRevealTimers = new Map<string, number>();
  private lastCenterAnnouncementEndedAt = 0;
  private centerPanelDurationMs = 3200;
  private activeLotusBursts: LotusBurstTrigger[] = [];

  private altarGlowUntil = 0;
  private bellRingUntil = 0;
  private incenseGlowUntil = 0;
  private fruitGlowUntil = 0;
  private lotusGlowUntil = 0;
  private pagodaGlowUntil = 0;
  private xinXamGlowUntil = 0;
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

  // Automatic 120-Second Inactivity Timeout State
  private inactivityTimeoutEnabled = true;
  private inactivityTimeoutSec = 120; // Production default: 120 seconds
  private demoAcceleratedTimeout = false;
  private departureSafetyTimers = new Map<string, number>(); // userId -> timeoutId
  private totalDepartedCount = 0;

  private totalEventsProcessed = 0;
  private maxParticipants = 200;
  private effectsEnabled = true;

  private processedEventIds = new Set<string>();
  private clientStreakCounts = new Map<string, number>();
  private completedClientStreaks = new Map<string, { finalCount: number; expiresAt: number }>();
  private lastGiftExecutionByKey = new Map<string, number>();
  private userCommentRateMap = new Map<string, number>();
  private userFollowRateMap = new Map<string, number>();
  private userShareRateMap = new Map<string, number>();

  private subscribers = new Set<CongregationSubscriber>();
  private batchNotifyScheduled = false;

  constructor() {
    this.giftMappings = giftRegistry.getAllGifts();
    this.initGiftCounters();

    giftRegistry.subscribe((snap) => {
      this.giftMappings = snap.gifts;
      this.initGiftCounters();
      this.scheduleNotify();
    });

    xinXamRegistry.subscribe(() => {
      this.initGiftCounters();
      this.scheduleNotify();
    });

    if (typeof window !== 'undefined') {
      window.handleTikTokEvent = (rawEvent: Partial<TikTokNormalizedEvent>) => {
        this.processEvent(rawEvent);
      };

      // Fast visual cleanup & ceremony queue dispatcher (400ms)
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

        if (this.notifications.some((n) => now - n.timestamp > 4500)) {
          this.notifications = this.notifications.filter((n) => now - n.timestamp <= 4500);
          changed = true;
        }

        for (const p of this.participantsMap.values()) {
          if (p.isDeparting) continue;

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

      // Smooth non-overlapping Center Ceremonial Announcement & Falling Lotus Burst ticker (140ms)
      window.setInterval(() => {
        if (this.advanceCenterAnnouncementQueue(Date.now())) {
          this.scheduleNotify();
        }
      }, 140);

      // Centralized Periodic Inactivity Sweep (every 1.5 seconds — zero per-user timers!)
      window.setInterval(() => {
        if (!this.inactivityTimeoutEnabled) return;
        const initiated = this.sweepInactiveParticipants(Date.now());
        if (initiated > 0) {
          this.scheduleNotify();
        }
      }, 1500);
    }
  }

  public getEffectiveTimeoutMs(): number {
    const sec = this.demoAcceleratedTimeout
      ? TikTokEventManager.DEMO_ACCELERATED_TIMEOUT_SEC
      : Math.max(15, this.inactivityTimeoutSec);
    return sec * 1000;
  }

  public setInactivitySettings(params: {
    enabled: boolean;
    timeoutSec: number;
    demoAccelerated: boolean;
  }): void {
    this.inactivityTimeoutEnabled = params.enabled;
    this.inactivityTimeoutSec = Math.max(15, Math.min(3600, Math.round(params.timeoutSec || 120)));
    this.demoAcceleratedTimeout = Boolean(params.demoAccelerated);

    if (this.inactivityTimeoutEnabled) {
      this.sweepInactiveParticipants(Date.now());
    }
    this.scheduleNotify();
  }

  /**
   * Centralized inactivity sweep:
   * - Checks independent lastInteractionAt timestamps.
   * - Defers departure safely if user is currently performing or queued for an altar ritual / Gõ Mõ milestone.
   */
  public sweepInactiveParticipants(now = Date.now(), customThresholdMs?: number): number {
    const thresholdMs = customThresholdMs ?? this.getEffectiveTimeoutMs();
    let count = 0;

    for (const p of this.participantsMap.values()) {
      if (p.isDeparting) continue;
      if (now - p.lastInteractionAt < thresholdMs) continue;

      // Defer departure safely if performing an altar ritual, queued for an altar ritual, or finishing Gõ Mõ
      const hasQueuedRitual = this.ritualQueue.some((q) => q.userId === p.userId);
      if (p.activeRitual || p.activeWoodenFish || hasQueuedRitual) {
        continue;
      }

      this.initiateParticipantDeparture(p, now);
      count += 1;
    }

    return count;
  }

  /**
   * Manual Admin Action: Remove inactive participants immediately.
   * First sweeps anyone past effective timeout; if none are past full timeout yet,
   * gracefully departs idle seated participants who haven't interacted in >= 5s (excluding active ceremony actors).
   */
  public removeInactiveParticipantsManual(): number {
    const now = Date.now();
    let departed = this.sweepInactiveParticipants(now);
    if (departed === 0) {
      departed = this.sweepInactiveParticipants(now, 5000);
    }
    if (departed === 0) {
      departed = this.sweepInactiveParticipants(now, 0);
    }
    if (departed > 0) {
      this.scheduleNotify();
    }
    return departed;
  }

  private initiateParticipantDeparture(p: Participant, now: number): void {
    if (p.isDeparting) return;

    // Clear any stale pending wooden-fish milestone
    this.pendingWoodenFishMap.delete(p.userId);

    p.isDeparting = true;
    p.departingStartedAt = now;
    p.animState = 'departing_standing';
    p.animStateStartedAt = now;
    p.ritualStatusLabel = 'Cáo lễ rời chánh điện';
    p.ritualStatusUntil = now + 7500;
    p.lastComment = undefined;
    p.lastCommentAt = undefined;

    // Safety fallback timer so off-screen/overflow characters or throttled tabs always complete removal
    if (typeof window !== 'undefined') {
      const prevTimer = this.departureSafetyTimers.get(p.userId);
      if (prevTimer !== undefined) window.clearTimeout(prevTimer);

      const isOverflowNotRendered = p.seatIndex >= TOTAL_MAIN_MATS;
      const fallbackMs = isOverflowNotRendered ? 600 : 9000;
      const timerId = window.setTimeout(() => {
        this.finalizeParticipantDeparture(p.userId);
      }, fallbackMs);
      this.departureSafetyTimers.set(p.userId, timerId);
    }
  }

  private cancelParticipantDeparture(p: Participant, now: number): void {
    if (!p.isDeparting) return;
    p.isDeparting = false;
    p.departingStartedAt = undefined;
    p.ritualStatusLabel = undefined;
    p.ritualStatusUntil = undefined;
    p.lastInteractionAt = now;
    p.lastActivityAt = now;

    const timerId = this.departureSafetyTimers.get(p.userId);
    if (timerId !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(timerId);
    }
    this.departureSafetyTimers.delete(p.userId);

    // Walk back cleanly to their still-reserved seat!
    if (!p.activeRitual) {
      p.animState = 'returning_from_altar';
      p.animStateStartedAt = now;
    }

    const ledger = this.meritLedger.get(p.userId);
    if (ledger) {
      ledger.isActiveInScene = true;
      ledger.lastInteractionAt = now;
    }
  }

  /**
   * Called by WorshipperCharacter when the departing character reaches the temple exit
   * and finishes their short farewell bow (or by the safety fallback timer).
   * Removes character ONLY from the active 3D scene & releases their seat while preserving MeritLedger!
   */
  public finalizeParticipantDeparture(userId: string): void {
    const timerId = this.departureSafetyTimers.get(userId);
    if (timerId !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(timerId);
    }
    this.departureSafetyTimers.delete(userId);

    const p = this.participantsMap.get(userId);
    if (!p || !p.isDeparting) return;

    // Release any occupied altar station just in case
    for (const [stId, ownerId] of this.occupiedStations.entries()) {
      if (ownerId === userId) {
        this.occupiedStations.delete(stId);
      }
    }

    // Remove from active 3D registry & release seat for future worshippers
    this.participantsMap.delete(userId);
    this.seatManager.releaseUserSeat(userId);
    this.pendingWoodenFishMap.delete(userId);
    this.ritualQueue = this.ritualQueue.filter((q) => q.userId !== userId);
    this.totalDepartedCount += 1;

    // Preserve accumulated merit points & gift history in MeritLedger!
    const ledger = this.meritLedger.get(userId);
    if (ledger) {
      ledger.isActiveInScene = false;
      ledger.points = Math.max(ledger.points, p.points);
      ledger.giftCount = Math.max(ledger.giftCount, p.giftCount);
      ledger.commentCount = Math.max(ledger.commentCount, p.commentCount);
      ledger.totalLikes = Math.max(ledger.totalLikes, p.totalLikes);
      ledger.woodenFishStrikes = Math.max(ledger.woodenFishStrikes, p.woodenFishStrikes);
    }

    // Promote an overflow waiting worshipper (>= 200) into the newly freed main seat if available!
    this.promoteWaitingParticipantIfMainSeatFree();

    this.scheduleNotify();
  }

  private promoteWaitingParticipantIfMainSeatFree(): void {
    if (this.seatManager.getOccupiedMainCount() >= TOTAL_MAIN_MATS) return;
    for (const p of this.participantsMap.values()) {
      if (
        p.seatIndex >= TOTAL_MAIN_MATS &&
        !p.isDeparting &&
        !p.activeRitual &&
        !p.activeWoodenFish
      ) {
        this.seatManager.releaseUserSeat(p.userId);
        const { seatIndex, laneOffset } = this.seatManager.assignSeatForUser(p.userId);
        p.seatIndex = seatIndex;
        p.laneOffset = laneOffset;
        p.animState = 'walking_aisle';
        p.animStateStartedAt = Date.now();
        break;
      }
    }
  }

  private syncParticipantToLedger(p: Participant): void {
    const existing = this.meritLedger.get(p.userId);
    if (existing) {
      existing.username = p.username;
      existing.nickname = p.nickname;
      if (p.avatarUrl) existing.avatarUrl = p.avatarUrl;
      existing.points = p.points;
      existing.giftCount = p.giftCount;
      existing.commentCount = p.commentCount;
      existing.totalLikes = p.totalLikes;
      existing.woodenFishStrikes = p.woodenFishStrikes;
      existing.lastGiftName = p.lastGiftName;
      existing.lastGiftAt = p.lastGiftAt;
      existing.lastInteractionAt = p.lastInteractionAt;
      existing.isActiveInScene = !p.isDeparting;
      existing.isDemo = p.isDemo;
    } else {
      this.meritLedger.set(p.userId, {
        userId: p.userId,
        username: p.username,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
        points: p.points,
        giftCount: p.giftCount,
        commentCount: p.commentCount,
        totalLikes: p.totalLikes,
        woodenFishStrikes: p.woodenFishStrikes,
        lastGiftName: p.lastGiftName,
        lastGiftAt: p.lastGiftAt,
        firstSeenAt: p.lastInteractionAt,
        lastInteractionAt: p.lastInteractionAt,
        isActiveInScene: true,
        isDemo: p.isDemo,
      });
    }
  }

  private initGiftCounters(): void {
    const next: Record<string, number> = { ...this.giftEventCounts };
    for (const m of this.giftMappings) {
      const gid = normalizeGiftId(m.giftId);
      if (gid && next[gid] === undefined) {
        next[gid] = next[m.id] ?? 0;
      }
      if (m.id && next[m.id] === undefined) {
        next[m.id] = gid ? next[gid] ?? 0 : 0;
      }
    }
    const xinXamGiftId = normalizeGiftId(xinXamRegistry.getSettings().giftId);
    if (xinXamGiftId && next[xinXamGiftId] === undefined) {
      next[xinXamGiftId] = 0;
    }
    if (next['xin_xam'] === undefined) {
      next['xin_xam'] = 0;
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
    giftRegistry.setGiftsLocal(mappings);
    this.initGiftCounters();
    this.scheduleNotify();
  }

  public getGiftMappings(): GiftMapping[] {
    return giftRegistry.getAllGifts();
  }

  public setMaxParticipants(max: number): void {
    this.maxParticipants = Math.max(10, Math.min(240, max));
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
      this.activeLotusBursts = [];
      this.altarGlowUntil = 0;
      this.xinXamGlowUntil = 0;
      this.scheduleNotify();
    }
  }

  public setCeremonialPresentationSettings(params: { centerPanelDurationMs: number }): void {
    if (Number.isFinite(params.centerPanelDurationMs)) {
      this.centerPanelDurationMs = Math.max(
        1200,
        Math.min(10000, Math.round(params.centerPanelDurationMs)),
      );
    }
  }

  public getCenterAnnouncementQueueSnapshot(): ReadonlyArray<CeremonialAnnouncementItem> {
    return [...this.centerAnnouncementQueue];
  }

  private triggerLotusFallingBurst(params: {
    id: string;
    isMajor: boolean;
    intensityOverride?: number;
    now: number;
  }): void {
    if (!this.effectsEnabled) return;
    this.activeLotusBursts = this.activeLotusBursts.filter(
      (b) => params.now - b.startedAt <= b.durationMs,
    );
    const densityMult = Math.max(
      0.3,
      Math.min(1.8, Number(xinXamRegistry.getSettings().particleDensity || 1.0)),
    );
    const baseIntensity = params.intensityOverride ?? (params.isMajor ? 1.65 : 1.0);
    const burst: LotusBurstTrigger = {
      id: params.id,
      isMajor: params.isMajor,
      intensity: Number((baseIntensity * densityMult).toFixed(2)),
      startedAt: params.now,
      durationMs: params.isMajor ? 6200 : 4800,
    };
    this.activeLotusBursts = [...this.activeLotusBursts, burst].slice(-6);
  }

  private enqueueCenterCeremonialAnnouncement(params: {
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
    isDemo: boolean;
    now: number;
  }): void {
    const cleanTitle = sanitizeCeremonialText(params.ritualTitle, 'CẦU BÌNH AN');
    const cleanSub = params.ritualSubtitle
      ? sanitizeCeremonialText(params.ritualSubtitle, `Phật tử ${params.username} cầu bình an`)
      : '';
    const baseDuration = this.centerPanelDurationMs;
    const durationMs = params.isMajor ? Math.min(10000, Math.round(baseDuration * 1.15)) : baseDuration;

    const item: CeremonialAnnouncementItem = {
      id: params.id,
      userId: params.userId,
      username: params.username,
      nickname: params.nickname,
      avatarUrl: params.avatarUrl,
      ritualTitle: cleanTitle,
      ritualSubtitle: cleanSub,
      isMajor: params.isMajor,
      tier: params.tier,
      queuePriority: params.queuePriority,
      durationMs,
      startedAt: 0,
      expiresAt: 0,
      createdAt: params.now,
      isDemo: params.isDemo,
    };

    this.centerAnnouncementQueue.push(item);
    // Strict priority ordering:
    // 1. Major Ceremonial Events (LARGE_GIFT = 1) > Normal Rituals (NORMAL_GIFT = 2) > Special Rituals (3)
    // 2. Higher numeric queuePriority first (e.g. Bảo Tháp 100 > Đài Sen 90 > Mâm Quả 60 > Chuông Đồng 50 > Hoa Hồng 40)
    // 3. FIFO by createdAt
    this.centerAnnouncementQueue.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (b.queuePriority !== a.queuePriority) return b.queuePriority - a.queuePriority;
      return a.createdAt - b.createdAt;
    });

    if (this.centerAnnouncementQueue.length > 20) {
      this.centerAnnouncementQueue.length = 20;
    }

    this.advanceCenterAnnouncementQueue(params.now);
  }

  /**
   * Advances the sequential, non-overlapping Center Ceremonial Announcement & Xin Xăm Result queue.
   * Guarantees only ONE center panel (either XinXamResultPanel OR CenterCeremonialPanel) is ever displayed at a time!
   */
  public advanceCenterAnnouncementQueue(now = Date.now()): boolean {
    let changed = false;

    if (this.activeLotusBursts.some((b) => now - b.startedAt > b.durationMs)) {
      this.activeLotusBursts = this.activeLotusBursts.filter(
        (b) => now - b.startedAt <= b.durationMs,
      );
      changed = true;
    }

    if (this.activeXinXamResult) {
      if (now < this.activeXinXamResult.expiresAt) {
        return changed;
      }
      this.activeXinXamResult = null;
      this.lastCenterAnnouncementEndedAt = now;
      changed = true;
    }

    if (this.activeCenterAnnouncement) {
      if (now < this.activeCenterAnnouncement.expiresAt) {
        return changed;
      }
      this.activeCenterAnnouncement = null;
      this.lastCenterAnnouncementEndedAt = now;
      changed = true;
    }

    if (
      !this.activeXinXamResult &&
      !this.activeCenterAnnouncement &&
      (this.xinXamResultQueue.length > 0 || this.centerAnnouncementQueue.length > 0)
    ) {
      if (
        this.lastCenterAnnouncementEndedAt > 0 &&
        now - this.lastCenterAnnouncementEndedAt < TikTokEventManager.CENTER_PANEL_TRANSITION_GAP_MS
      ) {
        return changed;
      }

      const topCeremony = this.centerAnnouncementQueue[0];
      const preferMajorCeremonyFirst =
        Boolean(topCeremony && topCeremony.tier === AnnouncementPriority.LARGE_GIFT) &&
        this.xinXamResultQueue.length > 0;

      if (this.xinXamResultQueue.length > 0 && !preferMajorCeremonyFirst) {
        const nextXinXam = this.xinXamResultQueue.shift();
        if (nextXinXam) {
          const dispMs = Math.max(
            3000,
            Math.min(15000, xinXamRegistry.getSettings().resultDisplayDurationMs || 8000),
          );
          this.activeXinXamResult = {
            ...nextXinXam,
            expiresAt: now + dispMs,
          };
          changed = true;
        }
      } else if (this.centerAnnouncementQueue.length > 0) {
        const next = this.centerAnnouncementQueue.shift();
        if (next) {
          next.startedAt = now;
          next.expiresAt = now + next.durationMs;
          this.activeCenterAnnouncement = next;
          this.triggerLotusFallingBurst({
            id: `lotus-burst-${next.id}`,
            isMajor: next.isMajor,
            now,
          });
          changed = true;
        }
      }
    }

    return changed;
  }

  /**
   * Full session reset (used by "Xóa toàn bộ" / "Đặt lại Demo")
   */
  public clearParticipants(clearMeritHistory = true): void {
    for (const timer of this.ritualSafetyTimers.values()) {
      if (typeof window !== 'undefined') window.clearTimeout(timer);
    }
    for (const timer of this.xinXamRevealTimers.values()) {
      if (typeof window !== 'undefined') window.clearTimeout(timer);
    }
    for (const timer of this.woodenFishSafetyTimers.values()) {
      if (typeof window !== 'undefined') window.clearTimeout(timer);
    }
    for (const timer of this.departureSafetyTimers.values()) {
      if (typeof window !== 'undefined') window.clearTimeout(timer);
    }
    this.ritualSafetyTimers.clear();
    this.xinXamRevealTimers.clear();
    this.woodenFishSafetyTimers.clear();
    this.departureSafetyTimers.clear();
    this.arrivedRitualIds.clear();
    this.revealedXinXamRitualIds.clear();
    this.pendingXinXamDrawsByRitualId.clear();
    this.ritualQueue = [];
    this.occupiedStations.clear();
    this.pendingWoodenFishMap.clear();
    this.participantsMap.clear();
    this.seatManager.resetAll();
    this.notifications = [];
    this.activeEffects = [];
    this.activeLotusBadges = [];
    this.prominentGiftBanner = null;
    this.centerAnnouncementQueue = [];
    this.activeCenterAnnouncement = null;
    this.xinXamResultQueue = [];
    this.activeXinXamResult = null;
    this.activeXinXamVisual = null;
    this.lastCenterAnnouncementEndedAt = 0;
    this.activeLotusBursts = [];
    this.altarGlowUntil = 0;
    this.bellRingUntil = 0;
    this.incenseGlowUntil = 0;
    this.fruitGlowUntil = 0;
    this.lotusGlowUntil = 0;
    this.pagodaGlowUntil = 0;
    this.xinXamGlowUntil = 0;
    this.floatingLanternCount = 6;

    if (clearMeritHistory) {
      this.meritLedger.clear();
      this.userCumulativeLikes.clear();
      this.userLastLike10Cooldown.clear();
      this.clientStreakCounts.clear();
      this.completedClientStreaks.clear();
      this.lastGiftExecutionByKey.clear();
      this.recentGiftLogs = [];
      this.totalLikesCount = 0;
      this.totalWoodenFishCount = 0;
      this.totalDepartedCount = 0;
      for (const k of Object.keys(this.giftEventCounts)) {
        this.giftEventCounts[k] = 0;
      }
    } else {
      for (const entry of this.meritLedger.values()) {
        entry.isActiveInScene = false;
      }
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

    const activeUsers = Array.from(this.participantsMap.values()).filter((p) => !p.isDeparting);
    const orderedIds = activeUsers.sort((a, b) => b.points - a.points).map((p) => p.userId);

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
    const allActive = Array.from(this.participantsMap.values());
    const mainCap = Math.min(TOTAL_MAIN_MATS, this.maxParticipants);

    // Keep 3D scene strictly within optimized visible seat cap on M1 8GB,
    // while ALWAYS including any overflow participant who is currently performing an altar ceremony!
    const renderedParticipants: Participant[] = [];
    let mainCount = 0;
    let departingCount = 0;

    for (let i = 0; i < allActive.length; i++) {
      const p = allActive[i];
      if (p.isDeparting) departingCount += 1;

      if (p.seatIndex < TOTAL_MAIN_MATS) {
        if (mainCount < mainCap || p.activeRitual || p.isDeparting) {
          renderedParticipants.push(p);
          mainCount += 1;
        }
      } else if (p.activeRitual) {
        renderedParticipants.push(p);
      }
    }

    // Leaderboard comes from session-persistent MeritLedger so departed users retain their rank & merit!
    const leaderboard = Array.from(this.meritLedger.values())
      .filter((entry) => entry.points > 0)
      .sort((a, b) =>
        b.points !== a.points ? b.points - a.points : a.firstSeenAt - b.firstSeenAt,
      )
      .slice(0, 30);

    const effectiveTimeoutSec = Math.round(this.getEffectiveTimeoutMs() / 1000);

    // Build live ceremony queue inspector snapshot (active altar stations + pending queue)
    const ceremonyQueueInspector: GiftCeremonyQueueItemSnapshot[] = [];
    for (const p of allActive) {
      if (p.activeRitual) {
        ceremonyQueueInspector.push({
          id: p.activeRitual.id,
          userId: p.userId,
          username: p.username,
          giftId: p.activeRitual.giftId,
          giftName: p.activeRitual.giftName || p.activeRitual.label,
          ritualType: p.activeRitual.type,
          ritualLabel: p.activeRitual.label,
          stationId: p.activeRitual.stationId,
          status: 'active_at_altar',
          priority: RITUAL_PRIORITY[p.activeRitual.type] ?? 2,
          durationMs: p.activeRitual.durationMs,
          isDemo: Boolean(p.activeRitual.isDemo ?? p.isDemo),
          timestamp: p.activeRitual.startedAt,
        });
      }
    }
    for (const q of this.ritualQueue) {
      const qp = this.participantsMap.get(q.userId);
      ceremonyQueueInspector.push({
        id: q.id,
        userId: q.userId,
        username: qp?.username || q.userId,
        giftId: q.giftId,
        giftName: q.giftName || q.offeringLabel,
        ritualType: q.type,
        ritualLabel: q.label,
        status: 'queued',
        priority: q.priority,
        durationMs: q.durationMs,
        isDemo: Boolean(q.isDemo ?? qp?.isDemo),
        timestamp: q.createdAt,
      });
    }

    return {
      participants: renderedParticipants,
      activeParticipantCount: allActive.length,
      departingCount,
      sessionMeritUsersCount: this.meritLedger.size,
      departedUsersCount: this.totalDepartedCount,
      leaderboard,
      notifications: this.notifications,
      activeEffects: this.activeEffects,
      activeLotusBadges: this.activeLotusBadges,
      giftEventCounts: { ...this.giftEventCounts },
      ceremonyQueueInspector,
      recentGiftLogs: [...this.recentGiftLogs],
      prominentGiftBanner: this.prominentGiftBanner,
      activeCenterAnnouncement: this.activeCenterAnnouncement
        ? { ...this.activeCenterAnnouncement }
        : null,
      queuedCenterAnnouncementCount:
        this.centerAnnouncementQueue.length + this.xinXamResultQueue.length,
      activeXinXamResult: this.activeXinXamResult ? { ...this.activeXinXamResult } : null,
      activeXinXamVisual: this.activeXinXamVisual ? { ...this.activeXinXamVisual } : null,
      activeLotusBursts: [...this.activeLotusBursts],
      altarGlowUntil: this.altarGlowUntil,
      bellRingUntil: this.bellRingUntil,
      incenseGlowUntil: this.incenseGlowUntil,
      fruitGlowUntil: this.fruitGlowUntil,
      lotusGlowUntil: this.lotusGlowUntil,
      pagodaGlowUntil: this.pagodaGlowUntil,
      xinXamGlowUntil: this.xinXamGlowUntil,
      floatingLanternCount: this.floatingLanternCount,
      totalLikesCount: this.totalLikesCount,
      totalWoodenFishCount: this.totalWoodenFishCount,
      activeAltarCount: this.occupiedStations.size,
      queuedAltarCount: this.ritualQueue.length,
      occupiedMainSeats: this.seatManager.getOccupiedMainCount(),
      waitingOverflowCount: this.seatManager.getOverflowWaitingCount(),
      effectiveTimeoutSec,
      inactivityTimeoutEnabled: this.inactivityTimeoutEnabled,
      totalEventsProcessed: this.totalEventsProcessed,
    };
  }

  private pushEventNotification(params: {
    kind: FeedNotification['kind'];
    username: string;
    message: string;
    pointsDelta?: number;
    isDemo: boolean;
    now: number;
  }): void {
    const entry: FeedNotification = {
      id: `notif-${params.kind}-${params.now}-${Math.random().toString(36).slice(2, 5)}`,
      kind: params.kind,
      username: params.username,
      message: params.message,
      pointsDelta: params.pointsDelta,
      isDemo: params.isDemo,
      timestamp: params.now,
    };
    this.notifications = [entry, ...this.notifications].slice(0, 2);
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

    const existingIdx = this.activeLotusBadges.findIndex((b) => b.userId === params.userId);
    if (existingIdx !== -1) {
      this.activeLotusBadges[existingIdx] = {
        ...this.activeLotusBadges[existingIdx],
        username: params.username,
        nickname: params.nickname,
        ceremonyTitle: params.ceremonyTitle,
        offeringLabel: params.offeringLabel,
        expiresAt: now + params.durationMs,
      };
      return;
    }

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
      ceremonyTitle: params.ceremonyTitle,
      offeringLabel: params.offeringLabel,
      side,
      startedAt: now,
      expiresAt: now + params.durationMs,
    };

    const next = [...this.activeLotusBadges, badge];
    this.activeLotusBadges = next.slice(-TikTokEventManager.MAX_LOTUS_BADGES);
  }

  public recordWoodenFishStrike(
    userId: string,
    tier: WoodenFishMilestoneTier,
    strikeIndex: number,
  ): void {
    this.totalWoodenFishCount += 1;
    const p = this.participantsMap.get(userId);
    if (p) {
      p.woodenFishStrikes += 1;
      this.syncParticipantToLedger(p);
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

  public completeWoodenFishAction(userId: string, actionId: string): void {
    const safety = this.woodenFishSafetyTimers.get(actionId);
    if (safety !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(safety);
    }
    this.woodenFishSafetyTimers.delete(actionId);

    const now = Date.now();
    const p = this.participantsMap.get(userId);
    if (p && p.activeWoodenFish && p.activeWoodenFish.id === actionId) {
      p.activeWoodenFish = null;
      if (!p.activeRitual && !p.isDeparting) {
        p.animState = 'sitting';
        p.animStateStartedAt = now;
      }
    }

    if (!this.tryStartQueuedWoodenFish(userId) && p && this.inactivityTimeoutEnabled) {
      if (now - p.lastInteractionAt >= this.getEffectiveTimeoutMs() && !p.activeRitual) {
        this.initiateParticipantDeparture(p, now);
      }
    }

    this.scheduleNotify();
  }

  private isParticipantReadyAtSeat(p: Participant, now: number): boolean {
    if (p.isDeparting || p.activeRitual || p.activeWoodenFish) return false;
    const isEntering =
      (p.animState === 'walking_aisle' ||
        p.animState === 'turning_row' ||
        p.animState === 'walking_row' ||
        p.animState === 'turning_altar') &&
      now - p.animStateStartedAt < 5800;
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
    if (!p || p.isDeparting) {
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
        this.enqueueCenterCeremonialAnnouncement({
          id: `center-like1000-${activeAction.id}`,
          userId: p.userId,
          username: p.username,
          nickname: p.nickname,
          avatarUrl: p.avatarUrl,
          ritualTitle: 'ĐẠI LỄ GÕ MÕ CẦU AN',
          ritualSubtitle: `Phật tử ${p.username} cầu bình an`,
          isMajor: false,
          tier: AnnouncementPriority.SPECIAL_RITUAL,
          queuePriority: 35,
          isDemo: p.isDemo,
          now,
        });
        this.prominentGiftBanner = null;
      }
    }

    if (pending.tier === 'like_1000') {
      const spokenName = normalizeSpeechUsername(p.nickname || p.username);
      voiceManager.enqueue({
        text: `Xin cảm ơn Phật tử ${spokenName} đã thành tâm gõ mõ cầu an với một nghìn lượt thích. Kính chúc bạn và gia đình luôn an lành.`,
        priority: AnnouncementPriority.SPECIAL_RITUAL,
        category: 'special_ritual',
        userId: p.userId,
        username: p.username,
        isDemo: p.isDemo,
        dedupeKey: `like-1000:${p.userId}:${Math.floor(pending.cumulativeLikes / 1000)}`,
        playBellBeforeSpeech: false,
      });
    }

    const isRendered = p.seatIndex < Math.min(TOTAL_MAIN_MATS, this.maxParticipants);
    if (!isRendered) {
      for (let s = 0; s < pending.strikeCount; s++) {
        setTimeout(() => {
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

  public notifyAltarRitualArrived(userId: string, ritualId: string): void {
    if (this.arrivedRitualIds.has(ritualId)) return;
    this.arrivedRitualIds.add(ritualId);

    const p = this.participantsMap.get(userId);
    if (!p || !p.activeRitual || p.activeRitual.id !== ritualId) return;

    const now = Date.now();
    const r = p.activeRitual;

    // 1. Illuminate sanctuary altar glows based on ritual type
    switch (r.type) {
      case 'altar_incense':
        this.incenseGlowUntil = Math.max(this.incenseGlowUntil, now + 6500);
        break;
      case 'altar_fruit_tray':
        this.fruitGlowUntil = Math.max(this.fruitGlowUntil, now + 8000);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 5000);
        break;
      case 'altar_lotus_pedestal':
      case 'glowing_lotus':
        this.lotusGlowUntil = Math.max(this.lotusGlowUntil, now + 8500);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 6500);
        break;
      case 'altar_lantern':
        this.floatingLanternCount = Math.min(24, this.floatingLanternCount + 1);
        break;
      case 'altar_bell':
        this.bellRingUntil = Math.max(this.bellRingUntil, now + 5600);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 4800);
        break;
      case 'altar_pagoda':
      case 'altar_grand_ceremony':
        this.pagodaGlowUntil = Math.max(this.pagodaGlowUntil, now + 10000);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 9000);
        this.bellRingUntil = Math.max(this.bellRingUntil, now + 5600);
        this.incenseGlowUntil = Math.max(this.incenseGlowUntil, now + 7500);
        break;
      case 'xin_xam':
        this.xinXamGlowUntil = Math.max(this.xinXamGlowUntil, now + 7500);
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 5200);
        this.updateXinXamStage(userId, ritualId, 'kneeling', 0.05);
        break;
      default:
        this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 5000);
        break;
    }

    // 2. If this ritual came from a configured GiftMapping with customSound / customEffect, play exact configured settings!
    if (r.customSound !== undefined || r.customEffect !== undefined) {
      if (this.effectsEnabled) {
        if (r.customSound && r.customSound !== 'none') {
          soundSynthesizer.playConfiguredGiftSound(r.customSound, 0.85);
        }
        if (r.customEffect && r.customEffect !== 'none') {
          const originX =
            r.type === 'altar_incense'
              ? 0
              : r.type === 'altar_bell'
                ? 4.15
                : r.type === 'altar_grand_ceremony' || r.type === 'altar_pagoda'
                  ? 0
                  : r.targetX;
          const originZ =
            r.type === 'altar_incense'
              ? -9.85
              : r.type === 'altar_bell'
                ? -9.55
                : r.type === 'altar_grand_ceremony' || r.type === 'altar_pagoda'
                  ? -9.1
                  : r.targetZ - 0.35;
          this.spawnEffect({
            id: `arr-gift-${ritualId}`,
            type: r.customEffect,
            userId: p.userId,
            username: p.username,
            giftName: r.giftName || r.label,
            points: r.awardedPoints || 50,
            seatIndex: p.seatIndex,
            originX,
            originZ,
            startedAt: now,
            durationMs: Math.max(4500, r.durationMs + 800),
          });
        }
      }
      this.scheduleNotify();
      return;
    }

    // 3. Built-in default social ceremonies (Follow = Thắp hương, Share = Hoa đăng)
    switch (r.type) {
      case 'altar_incense': {
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

      case 'altar_lantern': {
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

      default: {
        if (this.effectsEnabled) {
          soundSynthesizer.playOfferingChime(0.7);
          this.spawnEffect({
            id: `arr-default-${ritualId}`,
            type: 'lotus_petals',
            userId: p.userId,
            username: p.username,
            giftName: r.label,
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
    }

    this.scheduleNotify();
  }

  public updateXinXamStage(
    userId: string,
    ritualId: string,
    stage: ActiveXinXamStage,
    progress: number,
  ): void {
    if (this.activeXinXamVisual && this.activeXinXamVisual.ritualId === ritualId) {
      this.activeXinXamVisual = {
        ...this.activeXinXamVisual,
        stage,
        progress,
      };
      this.scheduleNotify();
      return;
    }
    const draw = this.pendingXinXamDrawsByRitualId.get(ritualId);
    const p = this.participantsMap.get(userId);
    if (draw && p) {
      this.activeXinXamVisual = {
        ritualId,
        userId,
        username: p.username,
        stage,
        progress,
        fortuneNumber: draw.fortuneNumber,
        fortuneCode: draw.fortuneCode,
        category: draw.category,
        startedAt: Date.now(),
      };
      this.scheduleNotify();
    }
  }

  /**
   * Synchronized reveal callback invoked at the exact moment the numbered bamboo stick falls out
   * (or via fallback timer when tab is backgrounded / running in headless tests).
   * Reveals the compact center Xin Xăm Result Panel, rings the temple bell, illuminates golden particles,
   * and enqueues VieNeuTTS reading the exact drawn fortune number in natural Vietnamese words!
   */
  public notifyXinXamStickRevealed(userId: string, ritualId: string): void {
    if (this.revealedXinXamRitualIds.has(ritualId)) return;
    this.revealedXinXamRitualIds.add(ritualId);

    const revealTimer = this.xinXamRevealTimers.get(ritualId);
    if (revealTimer !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(revealTimer);
    }
    this.xinXamRevealTimers.delete(ritualId);

    const p = this.participantsMap.get(userId);
    const draw =
      p?.activeRitual?.xinXamDraw || this.pendingXinXamDrawsByRitualId.get(ritualId) || null;
    if (!draw) return;

    const now = Date.now();
    this.xinXamGlowUntil = Math.max(this.xinXamGlowUntil, now + 6200);
    this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 5200);

    if (this.activeXinXamVisual && this.activeXinXamVisual.ritualId === ritualId) {
      this.activeXinXamVisual = {
        ...this.activeXinXamVisual,
        stage: 'revealed',
        progress: 0.66,
      };
    }

    if (p && p.activeRitual && p.activeRitual.id === ritualId) {
      p.activeRitual.xinXamRevealed = true;
      p.ritualStatusLabel = `Quẻ Xăm ${draw.fortuneNumber} · ${draw.fortuneType || draw.category}`;
      p.ritualStatusUntil = now + 5200;
    }

    if (this.effectsEnabled) {
      soundSynthesizer.playXinXamRevealBell(0.78);
      this.spawnEffect({
        id: `fx-xinxam-reveal-${ritualId}`,
        type: 'golden_particles',
        userId: draw.userId,
        username: draw.username,
        giftName: `Quẻ Xăm ${draw.fortuneNumber}`,
        points: draw.meritAwarded,
        seatIndex: p?.seatIndex ?? 0,
        originX: -3.55,
        originZ: -9.05,
        startedAt: now,
        durationMs: 4800,
      });
      this.triggerLotusFallingBurst({
        id: `lotus-xinxam-reveal-${ritualId}`,
        isMajor: draw.category === 'Đại Cát',
        intensityOverride: draw.category === 'Đại Cát' ? 1.55 : 1.2,
        now,
      });
    }

    this.pushEventNotification({
      kind: 'xin_xam',
      username: draw.username,
      message: `xin được Quẻ Xăm ${draw.fortuneNumber} (${draw.category})`,
      pointsDelta: draw.meritAwarded,
      isDemo: draw.isDemo,
      now,
    });

    // Queue Center Xin Xăm Result Panel (non-overlapping)
    if (!this.xinXamResultQueue.some((q) => q.eventDedupeKey === draw.eventDedupeKey)) {
      this.xinXamResultQueue.push({
        ...draw,
        expiresAt:
          now +
          Math.max(
            3000,
            Math.min(15000, xinXamRegistry.getSettings().resultDisplayDurationMs || 8000),
          ),
      });
      this.advanceCenterAnnouncementQueue(now);
    }

    // Enqueue Synchronized VieNeuTTS Voice at Priority 2 (XIN_XAM: below LARGE_GIFT, above NORMAL_GIFT & Comments!)
    const voiceSettings = voiceManager.getSettings();
    if (draw.spokenText && voiceSettings.autoNarrationEnabled) {
      voiceManager.enqueue({
        text: draw.spokenText,
        priority: AnnouncementPriority.XIN_XAM,
        queuePriority: 82,
        category: 'xin_xam',
        userId: draw.userId,
        username: draw.username,
        isDemo: draw.isDemo,
        dedupeKey: `xinxam:${draw.eventDedupeKey}`,
        playBellBeforeSpeech: false,
      });
    }

    this.scheduleNotify();
  }

  public completeCharacterRitual(userId: string, ritualId: string): void {
    const timer = this.ritualSafetyTimers.get(ritualId);
    if (timer !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(timer);
    }
    this.ritualSafetyTimers.delete(ritualId);

    const revealTimer = this.xinXamRevealTimers.get(ritualId);
    if (revealTimer !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(revealTimer);
    }
    this.xinXamRevealTimers.delete(ritualId);

    // Ensure reveal ran if character completed Xin Xăm cleanly before reveal callback fired
    if (this.pendingXinXamDrawsByRitualId.has(ritualId) && !this.revealedXinXamRitualIds.has(ritualId)) {
      this.notifyXinXamStickRevealed(userId, ritualId);
    }
    this.pendingXinXamDrawsByRitualId.delete(ritualId);
    this.arrivedRitualIds.delete(ritualId);

    if (this.activeXinXamVisual && this.activeXinXamVisual.ritualId === ritualId) {
      this.activeXinXamVisual = null;
    }

    for (const [stId, ownerId] of this.occupiedStations.entries()) {
      if (ownerId === userId) {
        this.occupiedStations.delete(stId);
      }
    }

    const now = Date.now();
    const badge = this.activeLotusBadges.find((b) => b.userId === userId);
    if (badge && badge.expiresAt > now + 1200) {
      badge.expiresAt = now + 1200;
    }

    const p = this.participantsMap.get(userId);
    if (p && p.activeRitual && p.activeRitual.id === ritualId) {
      p.activeRitual = null;
      p.ritualStatusLabel = undefined;
      p.ritualStatusUntil = undefined;
      p.animState = 'sitting';
      p.animStateStartedAt = now;
    }

    // Play any queued wooden-fish milestone, OR if their 120s inactivity timer expired during the ceremony
    // (without any new interaction resetting lastInteractionAt), safely initiate their departure now!
    const startedWoodenFish = this.tryStartQueuedWoodenFish(userId);
    const hasMoreQueuedRituals = this.ritualQueue.some((q) => q.userId === userId);

    if (
      !startedWoodenFish &&
      !hasMoreQueuedRituals &&
      p &&
      this.inactivityTimeoutEnabled &&
      now - p.lastInteractionAt >= this.getEffectiveTimeoutMs()
    ) {
      this.initiateParticipantDeparture(p, now);
    }

    this.tryDispatchQueuedRituals();
    this.scheduleNotify();
  }

  private enqueueAltarRitual(params: {
    userId: string;
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
    offeringLabel: string;
    spokenText?: string;
    playBellBeforeSpeech?: boolean;
    isLargeCeremony?: boolean;
    isGiftCeremony?: boolean;
    xinXamDraw?: XinXamDrawResult;
    priorityOverride?: number;
    durationMs?: number;
  }): void {
    const p = this.participantsMap.get(params.userId);
    if (!p) return;

    const priority = params.priorityOverride ?? RITUAL_PRIORITY[params.type] ?? 3;
    const durationMs = params.durationMs ?? 4400;

    if (params.type === 'xin_xam' && params.xinXamDraw) {
      // Prevent duplicate queue entry for the exact same eventDedupeKey, while allowing queued Xin Xăm across users!
      const dupDraw = this.ritualQueue.some(
        (q) => q.xinXamDraw?.eventDedupeKey === params.xinXamDraw?.eventDedupeKey,
      );
      if (dupDraw) return;
    } else {
      const existingIdx = this.ritualQueue.findIndex(
        (q) => q.userId === params.userId && q.type !== 'xin_xam',
      );
      if (existingIdx !== -1) {
        if (priority <= this.ritualQueue[existingIdx].priority) {
          this.ritualQueue[existingIdx] = {
            ...this.ritualQueue[existingIdx],
            giftId: params.giftId ?? this.ritualQueue[existingIdx].giftId,
            giftName: params.giftName ?? this.ritualQueue[existingIdx].giftName,
            type: params.type,
            characterAnimation: params.characterAnimation,
            customEffect: params.customEffect,
            customSound: params.customSound,
            awardedPoints: params.awardedPoints,
            isDemo: params.isDemo,
            label: params.label,
            ceremonyBadgeTitle: params.ceremonyBadgeTitle,
            offeringLabel: params.offeringLabel,
            spokenText: params.spokenText ?? this.ritualQueue[existingIdx].spokenText,
            playBellBeforeSpeech: params.playBellBeforeSpeech,
            isLargeCeremony: params.isLargeCeremony,
            isGiftCeremony: params.isGiftCeremony,
            priority,
            durationMs,
          };
        }
        this.tryDispatchQueuedRituals();
        return;
      }
    }

    this.ritualQueue.push({
      id: `ritual-${params.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: params.userId,
      giftId: params.giftId,
      giftName: params.giftName,
      type: params.type,
      characterAnimation: params.characterAnimation,
      customEffect: params.customEffect,
      customSound: params.customSound,
      awardedPoints: params.awardedPoints,
      isDemo: params.isDemo,
      label: params.label,
      ceremonyBadgeTitle: params.ceremonyBadgeTitle,
      offeringLabel: params.offeringLabel,
      spokenText: params.spokenText,
      playBellBeforeSpeech: params.playBellBeforeSpeech,
      isLargeCeremony: params.isLargeCeremony,
      isGiftCeremony: params.isGiftCeremony,
      xinXamDraw: params.xinXamDraw,
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
      if (!p || p.isDeparting) {
        this.ritualQueue.splice(i, 1);
        i--;
        continue;
      }

      if (p.activeRitual) continue;

      // For main-hall newly arrived characters, let them claim their seat first (except Xin Xăm & overflow gallery actors who walk straight in and return to their reserved seat!)
      const isMainHallStillEntering =
        item.type !== 'xin_xam' &&
        p.seatIndex < TOTAL_MAIN_MATS &&
        (p.animState === 'walking_aisle' ||
          p.animState === 'turning_row' ||
          p.animState === 'walking_row' ||
          p.animState === 'turning_altar') &&
        now - p.animStateStartedAt < 4200;
      if (isMainHallStillEntering) continue;

      const seat = getSeatPosition(p.seatIndex);
      const stationLookupType: RitualActionType =
        item.type === 'xin_xam' || item.characterAnimation === 'walk_xin_xam'
          ? 'xin_xam'
          : item.characterAnimation === 'walk_ring_bell'
            ? 'altar_bell'
            : item.characterAnimation === 'walk_prostrate_3'
              ? 'altar_grand_ceremony'
              : item.type;
      const candidates = getCandidateStationsForRitual(stationLookupType, seat.side);
      const chosenStationId = candidates.find((st) => this.isStationAvailable(st));
      if (!chosenStationId) continue;

      const station = getActiveAltarStation(chosenStationId);
      this.occupiedStations.set(chosenStationId, p.userId);
      this.ritualQueue.splice(i, 1);
      i--;

      if (p.activeWoodenFish) {
        const prevActId = p.activeWoodenFish.id;
        p.activeWoodenFish = null;
        const tId = this.woodenFishSafetyTimers.get(prevActId);
        if (tId !== undefined && typeof window !== 'undefined') window.clearTimeout(tId);
        this.woodenFishSafetyTimers.delete(prevActId);
      }

      // Dedicated separate outbound and inbound return carpet lanes prevent aisle collisions
      const lanes = getActiveCarpetLanes(seat.side, stationLookupType === 'xin_xam');
      const outboundLaneX = lanes.outboundLaneX;
      const returnLaneX = lanes.returnLaneX;

      const activeRitual: ActiveCharacterRitual = {
        id: item.id,
        giftId: item.giftId,
        giftName: item.giftName,
        type: stationLookupType === 'xin_xam' ? 'xin_xam' : item.type,
        characterAnimation: item.characterAnimation,
        customEffect: item.customEffect,
        customSound: item.customSound,
        awardedPoints: item.awardedPoints,
        isDemo: item.isDemo,
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
        xinXamDraw: item.xinXamDraw,
      };

      p.activeRitual = activeRitual;
      p.ritualStatusLabel = item.label;
      p.ritualStatusUntil = now + 18000;
      p.animState = 'leaving_seat_to_aisle';
      p.animStateStartedAt = now;
      p.lastActivityAt = now;

      if (activeRitual.type === 'xin_xam' && item.xinXamDraw) {
        this.pendingXinXamDrawsByRitualId.set(activeRitual.id, item.xinXamDraw);
        this.activeXinXamVisual = {
          ritualId: activeRitual.id,
          userId: p.userId,
          username: p.username,
          stage: 'walking',
          progress: 0,
          fortuneNumber: item.xinXamDraw.fortuneNumber,
          fortuneCode: item.xinXamDraw.fortuneCode,
          category: item.xinXamDraw.category,
          startedAt: now,
        };
        if (typeof window !== 'undefined') {
          const fallbackRevealMs = Math.round(item.durationMs * 0.68) + 2600;
          const revId = window.setTimeout(() => {
            this.notifyXinXamStickRevealed(p.userId, activeRitual.id);
          }, fallbackRevealMs);
          this.xinXamRevealTimers.set(activeRitual.id, revId);
        }
      }

      this.addOrRefreshLotusBadge({
        userId: p.userId,
        username: p.username,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
        ceremonyTitle: item.ceremonyBadgeTitle,
        offeringLabel: item.offeringLabel,
        preferredSide: activeRitual.type === 'xin_xam' ? 'left' : seat.side,
        durationMs: item.durationMs + 8000,
      });

      // Announce non-gift ceremonies (Follow/Share) when dispatched;
      // Xin Xăm voice is synchronized with notifyXinXamStickRevealed when the bamboo stick falls!
      const voiceSettings = voiceManager.getSettings();
      if (
        item.spokenText &&
        !item.isGiftCeremony &&
        activeRitual.type !== 'xin_xam' &&
        voiceSettings.followAnnouncementsEnabled
      ) {
        voiceManager.enqueue({
          text: item.spokenText,
          priority: AnnouncementPriority.SPECIAL_RITUAL,
          category: 'special_ritual',
          userId: p.userId,
          username: p.username,
          isDemo: p.isDemo,
          dedupeKey: `ceremony:${p.userId}:${item.type}:${Math.floor(now / 5000)}`,
          playBellBeforeSpeech: false,
        });
      }

      if (typeof window !== 'undefined') {
        const safetyId = window.setTimeout(() => {
          this.completeCharacterRitual(p.userId, activeRitual.id);
        }, 22000);
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

    // Explicitly ignore TikTok join/leave room presence packets for activity/timeout proof!
    if (raw.type === 'join' || raw.type === 'leave') {
      return;
    }

    this.totalEventsProcessed += 1;

    // Any genuine interaction (comment, gift, like, follow, share) immediately refreshes
    // an active participant's 120s timer and cancels pending departure, even if UI rate-limited.
    const activeExisting = this.participantsMap.get(userId);
    if (activeExisting) {
      if (activeExisting.isDeparting) {
        this.cancelParticipantDeparture(activeExisting, now);
      }
      activeExisting.lastActivityAt = now;
      activeExisting.lastInteractionAt = now;
      this.syncParticipantToLedger(activeExisting);
    }

    // 1. FOLLOW => Resets 120s timer; if seated, walks to altar and THẮP HƯƠNG
    if (raw.type === 'follow') {
      const prevFollow = this.userFollowRateMap.get(userId) || 0;
      if (now - prevFollow < 4000) return;
      this.userFollowRateMap.set(userId, now);

      const existing = this.participantsMap.get(userId);
      if (existing) {
        if (existing.isDeparting) {
          this.cancelParticipantDeparture(existing, now);
        }
        if (raw.avatarUrl) existing.avatarUrl = raw.avatarUrl;
        existing.points += 30;
        existing.lastActivityAt = now;
        existing.lastInteractionAt = now;
        this.syncParticipantToLedger(existing);

        const spokenName = normalizeSpeechUsername(nickname || username);
        this.pushEventNotification({
          kind: 'follow',
          username,
          message: 'dâng hương cầu an',
          pointsDelta: 30,
          isDemo,
          now,
        });
        this.enqueueCenterCeremonialAnnouncement({
          id: `center-follow-${eventId}`,
          userId,
          username,
          nickname,
          avatarUrl: existing.avatarUrl,
          ritualTitle: 'DÂNG HƯƠNG CẦU AN',
          ritualSubtitle: `Phật tử ${username} cầu bình an`,
          isMajor: false,
          tier: AnnouncementPriority.SPECIAL_RITUAL,
          queuePriority: 25,
          isDemo,
          now,
        });
        this.enqueueAltarRitual({
          userId,
          type: 'altar_incense',
          label: 'Thắp hương cầu an',
          ceremonyBadgeTitle: 'DÂNG HƯƠNG CẦU AN',
          offeringLabel: 'Tâm Hương',
          spokenText: voiceManager.getSettings().followAnnouncementsEnabled
            ? `Phật tử ${spokenName} thành tâm dâng nén tâm hương cầu bình an.`
            : undefined,
          durationMs: 4200,
        });
      }
      this.scheduleNotify();
      return;
    }

    // 2. SHARE => Resets 120s timer; if seated, walks to Lotus Basin and THẢ HOA ĐĂNG
    if (raw.type === 'share') {
      const prevShare = this.userShareRateMap.get(userId) || 0;
      if (now - prevShare < 3500) return;
      this.userShareRateMap.set(userId, now);

      const existing = this.participantsMap.get(userId);
      if (existing) {
        if (existing.isDeparting) {
          this.cancelParticipantDeparture(existing, now);
        }
        if (raw.avatarUrl) existing.avatarUrl = raw.avatarUrl;
        existing.points += 40;
        existing.lastActivityAt = now;
        existing.lastInteractionAt = now;
        this.syncParticipantToLedger(existing);

        const spokenName = normalizeSpeechUsername(nickname || username);
        this.pushEventNotification({
          kind: 'share',
          username,
          message: 'thả hoa đăng cầu an',
          pointsDelta: 40,
          isDemo,
          now,
        });
        this.enqueueCenterCeremonialAnnouncement({
          id: `center-share-${eventId}`,
          userId,
          username,
          nickname,
          avatarUrl: existing.avatarUrl,
          ritualTitle: 'THẢ HOA ĐĂNG CẦU AN',
          ritualSubtitle: `Phật tử ${username} cầu bình an`,
          isMajor: false,
          tier: AnnouncementPriority.SPECIAL_RITUAL,
          queuePriority: 30,
          isDemo,
          now,
        });
        this.enqueueAltarRitual({
          userId,
          type: 'altar_lantern',
          label: 'Thả hoa đăng',
          ceremonyBadgeTitle: 'THẢ HOA ĐĂNG CẦU AN',
          offeringLabel: 'Hoa Đăng',
          spokenText: `Phật tử ${spokenName} thả hoa đăng cầu nguyện ánh sáng từ bi và an lành.`,
          durationMs: 4400,
        });
        this.scheduleNotify();
      }
      return;
    }

    // 3. INTERACTIVE LIKE = GÕ MÕ SYSTEM
    // - Resets existing user's 120s inactivity timer (canceling pending departure if needed).
    // - Never creates characters from likes alone.
    // - Aggregates repeated likes and awards 1 merit point per new like.
    if (raw.type === 'like') {
      const prevLikes = this.userCumulativeLikes.get(userId) || 0;
      let deltaLikes = 0;

      if (raw.cumulativeUserLikes !== undefined && Number.isFinite(raw.cumulativeUserLikes)) {
        const incomingTotal = Math.max(0, Math.floor(Number(raw.cumulativeUserLikes)));
        if (incomingTotal <= prevLikes) {
          return;
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
        // Also update MeritLedger if a previously departed user sends likes
        const ledger = this.meritLedger.get(userId);
        if (ledger) {
          ledger.totalLikes = nextLikes;
          ledger.points += deltaLikes;
          ledger.lastInteractionAt = now;
        }
        this.scheduleNotify();
        return;
      }

      if (existing.isDeparting) {
        this.cancelParticipantDeparture(existing, now);
      }

      if (raw.avatarUrl) existing.avatarUrl = raw.avatarUrl;
      existing.totalLikes = nextLikes;
      existing.points += deltaLikes;
      existing.lastActivityAt = now;
      existing.lastInteractionAt = now;
      this.syncParticipantToLedger(existing);

      const crossed1000 = Math.floor(nextLikes / 1000) > Math.floor(prevLikes / 1000);
      const crossed100 = Math.floor(nextLikes / 100) > Math.floor(prevLikes / 100);
      const crossed10 = Math.floor(nextLikes / 10) > Math.floor(prevLikes / 10);

      if (crossed1000) {
        this.enqueueOrTriggerWoodenFishMilestone(existing, 'like_1000', now);
      } else if (crossed100) {
        this.enqueueOrTriggerWoodenFishMilestone(existing, 'like_100', now);
      } else if (crossed10) {
        const last10At = this.userLastLike10Cooldown.get(userId) || 0;
        if (now - last10At >= 1800) {
          this.userLastLike10Cooldown.set(userId, now);
          this.enqueueOrTriggerWoodenFishMilestone(existing, 'like_10', now);
        }
      }

      this.scheduleNotify();
      return;
    }

    // 4. COMMENT => Spawns/returns character, displays 5s bubble ONLY over their head, resets 120s timer, and queues VieNeu comment voice!
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

    // 5. GIFT => Dynamic GiftRegistry lookup by normalized giftId string, streak-safe delta calculation,
    //    custom VieNeuTTS template variables, and dynamic 3D ceremony execution!
    if (raw.type === 'gift') {
      const normalizedGiftId = normalizeGiftId(raw.giftId);
      if (!normalizedGiftId) return;

      const rawGiftName = String(raw.giftName || `Gift #${normalizedGiftId}`).trim();
      const rawCount = Math.max(
        raw.isStreakCompletionOnly ? 0 : 1,
        Math.round(Number(raw.giftCount ?? 1)),
      );
      let deltaCount = rawCount;
      let totalStreakCount = Math.max(rawCount, Math.round(Number(raw.totalStreakCount || rawCount)));
      let isStreakCompletionOnly = Boolean(raw.isStreakCompletionOnly);
      let prevStreakWasZero = true;

      const isStreakable = Number(raw.giftType ?? 0) === 1 && Boolean(raw.streakKey);

      if (isStreakable && raw.streakKey && !raw.verifiedBackend) {
        const completedEntry = this.completedClientStreaks.get(raw.streakKey);
        if (completedEntry && completedEntry.expiresAt > now && rawCount <= completedEntry.finalCount) {
          return;
        }

        const prevStreak = this.clientStreakCounts.get(raw.streakKey) || 0;
        prevStreakWasZero = prevStreak === 0;
        totalStreakCount = Math.max(prevStreak, rawCount);

        if (rawCount <= prevStreak) {
          if (raw.repeatEnd) {
            this.clientStreakCounts.delete(raw.streakKey);
            this.completedClientStreaks.set(raw.streakKey, {
              finalCount: totalStreakCount,
              expiresAt: now + 60000,
            });
            deltaCount = 0;
            isStreakCompletionOnly = true;
          } else {
            return;
          }
        } else {
          deltaCount = rawCount - prevStreak;
          if (raw.repeatEnd) {
            this.clientStreakCounts.delete(raw.streakKey);
            this.completedClientStreaks.set(raw.streakKey, {
              finalCount: totalStreakCount,
              expiresAt: now + 60000,
            });
          } else {
            this.clientStreakCounts.set(raw.streakKey, rawCount);
          }
        }
      } else if (isStreakable && raw.verifiedBackend) {
        prevStreakWasZero = totalStreakCount <= deltaCount && !isStreakCompletionOnly;
      }

      this.handleGiftEvent({
        eventId,
        streakKey: raw.streakKey ? String(raw.streakKey) : undefined,
        userId,
        username,
        nickname,
        avatarUrl: raw.avatarUrl,
        giftId: normalizedGiftId,
        giftName: rawGiftName,
        giftPictureUrl: raw.giftPictureUrl,
        deltaCount,
        totalStreakCount,
        isStreakable,
        repeatEnd: raw.repeatEnd !== undefined ? Boolean(raw.repeatEnd) : true,
        isStreakCompletionOnly,
        prevStreakWasZero,
        diamondCount: Math.max(0, Math.round(Number(raw.diamondCount ?? 1))),
        isDemo,
        now,
      });
    }
  }

  /**
   * Ensures a unique character & seat for userId.
   * - If already active (even if mid-departure!), cancels departure and refreshes their 120s timer.
   * - If returning after a previous 120s departure, restores their session merit & gift history from MeritLedger,
   *   assigns an available seat, and starts a new 120s timer!
   */
  private ensureParticipant(params: {
    userId: string;
    username: string;
    nickname: string;
    avatarUrl?: string;
    isDemo: boolean;
    now: number;
  }): { participant: Participant; isNew: boolean; isReturning: boolean } {
    const existing = this.participantsMap.get(params.userId);
    if (existing) {
      if (existing.isDeparting) {
        this.cancelParticipantDeparture(existing, params.now);
      }
      existing.username = params.username;
      existing.nickname = params.nickname || existing.nickname;
      if (params.avatarUrl) existing.avatarUrl = params.avatarUrl;
      existing.lastActivityAt = params.now;
      existing.lastInteractionAt = params.now;
      this.syncParticipantToLedger(existing);
      return { participant: existing, isNew: false, isReturning: false };
    }

    const { seatIndex, laneOffset } = this.seatManager.assignSeatForUser(params.userId);
    const seed = hashStringToFloat(params.userId);
    const priorLedger = this.meritLedger.get(params.userId);
    const priorLikes = this.userCumulativeLikes.get(params.userId) || priorLedger?.totalLikes || 0;

    const created: Participant = {
      userId: params.userId,
      username: params.username,
      nickname: params.nickname,
      avatarUrl: params.avatarUrl || priorLedger?.avatarUrl,
      seatIndex,
      laneOffset,
      points: priorLedger ? priorLedger.points : 10 + priorLikes,
      giftCount: priorLedger?.giftCount ?? 0,
      commentCount: priorLedger?.commentCount ?? 0,
      totalLikes: priorLikes,
      woodenFishStrikes: priorLedger?.woodenFishStrikes ?? 0,
      lastGiftName: priorLedger?.lastGiftName,
      lastGiftAt: priorLedger?.lastGiftAt,
      animState: 'walking_aisle',
      animStateStartedAt: params.now,
      activeRitual: null,
      activeWoodenFish: null,
      lastActivityAt: params.now,
      lastInteractionAt: params.now,
      isDeparting: false,
      robeHueShift: (seed - 0.5) * 0.08,
      hasHairBun: seed > 0.45,
      isDemo: params.isDemo,
    };

    this.participantsMap.set(params.userId, created);
    this.syncParticipantToLedger(created);
    return {
      participant: created,
      isNew: !priorLedger,
      isReturning: Boolean(priorLedger),
    };
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
    // Normalize ONLY Unicode NFC & whitespace while preserving the viewer's full exact comment
    const rawNormalized = params.comment.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!rawNormalized || CLIENT_PROFANITY_REGEX.test(rawNormalized)) return;

    const prevCommentAt = this.userCommentRateMap.get(params.userId) || 0;
    if (params.now - prevCommentAt < 750) return;
    this.userCommentRateMap.set(params.userId, params.now);

    const { participant, isNew } = this.ensureParticipant(params);
    participant.commentCount += 1;
    // Attached strictly to THIS character's userId for the 5-second overhead bubble (comment text ONLY, no username!)
    const displayComment = rawNormalized.slice(0, 140);
    participant.lastComment = displayComment;
    participant.lastCommentAt = params.now;
    participant.lastCommentId = params.eventId;

    const prayerMatch = detectPrayerTopic(rawNormalized);
    const isPrayer = Boolean(prayerMatch);
    const pointsDelta = isPrayer ? 20 : 8;
    participant.points += pointsDelta;
    this.syncParticipantToLedger(participant);

    if (isPrayer && prayerMatch) {
      participant.ritualStatusLabel = prayerMatch.topicLabel;
      participant.ritualStatusUntil = params.now + 4600;

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
          soundSynthesizer.playIncenseChime(0.4);
        }
      }
    }

    // VIENEU TTS READS EXACT REAL COMMENTS VIA CONFIGURABLE FORMULA ("CÔNG THỨC ĐỌC BÌNH LUẬN")
    // Never replaces viewer comments with generic predefined sentences or invented wishes!
    const voiceSettings = voiceManager.getSettings();
    const commentVoiceAllowed =
      voiceSettings.autoNarrationEnabled &&
      voiceSettings.commentVoiceEnabled !== false &&
      (isPrayer
        ? voiceSettings.prayerAnnouncementsEnabled !== false
        : voiceSettings.commentAnnouncementsEnabled !== false);

    if (commentVoiceAllowed) {
      const formatted = formatCommentSpeechFormula(
        voiceSettings.commentVoiceFormula,
        params.nickname || params.username,
        rawNormalized,
        {
          maxCommentLength: voiceSettings.maxCommentLength,
          blockSpamLinksAndUnsafe: voiceSettings.blockSpamLinksAndUnsafe,
        },
      );

      if (formatted.allowed && formatted.text) {
        voiceManager.enqueue({
          text: formatted.text,
          priority: isPrayer
            ? AnnouncementPriority.PRAYER_COMMENT
            : AnnouncementPriority.ORDINARY_COMMENT,
          category: isPrayer ? 'prayer_comment' : 'ordinary_comment',
          userId: params.userId,
          username: params.username,
          isDemo: params.isDemo,
          dedupeKey: `comment:${params.userId}:${formatted.normalizedComment}`,
        });
      }
    } else if (isNew && voiceSettings.welcomeAnnouncementsEnabled) {
      const spokenName = normalizeSpeechUsername(params.nickname || params.username);
      const tpl =
        voiceSettings.welcomeTemplate?.trim() ||
        'Chào mừng Phật tử {username} đã đến với Chùa Online. Kính chúc bạn luôn bình an.';
      voiceManager.enqueue({
        text: tpl.replace(/\{username\}/gi, () => spokenName),
        priority: AnnouncementPriority.SPECIAL_RITUAL,
        category: 'special_ritual',
        userId: params.userId,
        username: params.username,
        isDemo: params.isDemo,
        dedupeKey: `welcome:${params.userId}`,
      });
    }

    this.scheduleNotify();
  }

  private recordGiftCalculationLog(entry: GiftCalculationLogEntry): void {
    this.recentGiftLogs.unshift(entry);
    if (this.recentGiftLogs.length > 24) {
      this.recentGiftLogs.length = 24;
    }
  }

  /**
   * Triggers a complete 3D Xin Xăm Cầu Nguyện ceremony (or queued ceremony when station is busy)
   * using the exact same event pipeline for both real TikTok LIVE and Admin Demo Mode.
   */
  public triggerXinXamForUser(params: {
    userId: string;
    username: string;
    nickname?: string;
    avatarUrl?: string;
    giftId?: string;
    eventDedupeKey?: string;
    forcedFortuneNumber?: number;
    deltaCount?: number;
    isDemo?: boolean;
    immediateReveal?: boolean;
    now?: number;
  }): XinXamDrawResult | null {
    const xinXamSettings = xinXamRegistry.getSettings();
    if (!xinXamSettings.enabled && !params.isDemo) {
      return null;
    }

    const now = params.now ?? Date.now();
    const cleanUsername = params.username.trim().replace(/^@+/, '') || 'phattu';
    const nickname = (params.nickname || cleanUsername).trim();
    const isDemo = Boolean(params.isDemo);
    const dedupeKey =
      (params.eventDedupeKey || '').trim() ||
      `xinxam_${params.userId}_${now}_${Math.random().toString(36).slice(2, 6)}`;

    // 1. Ensure 3D character & reserved seat (resets 120s inactivity timeout!)
    const { participant } = this.ensureParticipant({
      userId: params.userId,
      username: cleanUsername,
      nickname,
      avatarUrl: params.avatarUrl,
      isDemo,
      now,
    });

    // 2. Draw or retrieve persisted fortune stick for this dedupeKey (prevents duplicate draws!)
    const alreadyDrawn = xinXamRegistry
      .getSnapshot()
      .recentDraws.some((d) => d.eventDedupeKey === dedupeKey);

    const draw = xinXamRegistry.drawFortune({
      eventDedupeKey: dedupeKey,
      userId: participant.userId,
      username: participant.username,
      nickname: participant.nickname,
      avatarUrl: participant.avatarUrl,
      isDemo,
      forcedFortuneNumber: params.forcedFortuneNumber,
    });

    if (!draw) return null;

    // 3. Award merit points once per unique draw
    const countUnits = Math.max(1, params.deltaCount ?? 1);
    const unitPoints = Math.max(0, xinXamSettings.meritPoints || 200);
    const awardedPoints = alreadyDrawn ? 0 : unitPoints * countUnits;

    if (!alreadyDrawn) {
      this.giftEventCounts['xin_xam'] = (this.giftEventCounts['xin_xam'] || 0) + 1;
      const cfgGiftId = normalizeGiftId(params.giftId || xinXamSettings.giftId);
      if (cfgGiftId) {
        this.giftEventCounts[cfgGiftId] = (this.giftEventCounts[cfgGiftId] || 0) + 1;
      }
      participant.points += awardedPoints;
      participant.giftCount += 1;
      participant.lastGiftName = 'Xin Xăm Cầu Nguyện';
      participant.lastGiftAt = now;
    }
    participant.lastInteractionAt = now;
    this.syncParticipantToLedger(participant);

    this.recordGiftCalculationLog({
      id: `glog-${dedupeKey}`,
      userId: participant.userId,
      username: participant.username,
      giftId: normalizeGiftId(params.giftId || xinXamSettings.giftId) || 'xin_xam',
      giftName: `Xin Xăm · Quẻ ${draw.fortuneNumber}`,
      giftCount: 1,
      unitPoints,
      awardedPoints,
      totalUserPoints: participant.points,
      ritualName: 'Xin Xăm Cầu Nguyện',
      status: 'executed',
      isDemo,
      timestamp: now,
    });

    // 4. Begin sacred falling pink lotus petals & warm golden illumination at ceremony start
    if (this.effectsEnabled && !alreadyDrawn) {
      this.xinXamGlowUntil = Math.max(this.xinXamGlowUntil, now + 6500);
      this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 4800);
      this.triggerLotusFallingBurst({
        id: `lotus-xinxam-start-${dedupeKey}`,
        isMajor: false,
        intensityOverride: 1.15,
        now,
      });
    }

    const animDurationMs = Math.max(
      3200,
      Math.min(14000, Math.round((xinXamSettings.animationDurationSec || 6.2) * 1000)),
    );

    const eventTitle = (xinXamSettings.eventTitle || 'XIN XĂM').trim() || 'XIN XĂM';
    const eventLabel = (xinXamSettings.eventLabel || 'Xin xăm cầu an').trim() || 'Xin xăm cầu an';

    // 5. Enqueue full 3D Xin Xăm Ceremony at the dedicated Xin Xăm station (supports multi-user queue!)
    if (!alreadyDrawn) {
      this.enqueueAltarRitual({
        userId: participant.userId,
        giftId: params.giftId || xinXamSettings.giftId || 'xin_xam',
        giftName: eventLabel,
        type: 'xin_xam',
        characterAnimation: 'walk_xin_xam',
        awardedPoints,
        isDemo,
        label: eventLabel,
        ceremonyBadgeTitle: eventTitle,
        offeringLabel: eventLabel,
        isGiftCeremony: true,
        xinXamDraw: draw,
        priorityOverride: RITUAL_PRIORITY.xin_xam,
        durationMs: animDurationMs,
      });

      if (params.immediateReveal) {
        const activeOrQueuedId =
          participant.activeRitual?.id ||
          this.ritualQueue.find((q) => q.xinXamDraw?.eventDedupeKey === dedupeKey)?.id;
        if (activeOrQueuedId) {
          this.pendingXinXamDrawsByRitualId.set(activeOrQueuedId, draw);
          this.notifyXinXamStickRevealed(participant.userId, activeOrQueuedId);
        }
      }
    }

    this.scheduleNotify();
    return draw;
  }

  /**
   * Admin Action ("XEM TRƯỚC KẾT QUẢ"): Immediately displays any selected or random fortune card
   * on the Center Fortune Result Panel ("🪷 KẾT QUẢ XIN XĂM") so administrators can inspect layout,
   * classification badge, verse, interpretation, and advice.
   */
  public previewFortuneResultOnly(params?: {
    userId?: string;
    username?: string;
    nickname?: string;
    avatarUrl?: string;
    forcedFortuneNumber?: number;
  }): XinXamDrawResult | null {
    const now = Date.now();
    const userId = params?.userId || 'demo-minh-anh-001';
    const username = (params?.username || 'phattu.minhanh').replace(/^@+/, '');
    const nickname = params?.nickname || 'Minh Anh';
    const dedupeKey = `xinxam_preview_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const draw = xinXamRegistry.drawFortune({
      eventDedupeKey: dedupeKey,
      userId,
      username,
      nickname,
      avatarUrl: params?.avatarUrl || '',
      isDemo: true,
      forcedFortuneNumber: params?.forcedFortuneNumber,
    });
    if (!draw) return null;

    const dispMs = Math.max(
      3000,
      Math.min(15000, xinXamRegistry.getSettings().resultDisplayDurationMs || 8000),
    );
    this.activeCenterAnnouncement = null;
    this.activeXinXamResult = {
      ...draw,
      expiresAt: now + dispMs,
    };
    this.scheduleNotify();
    return draw;
  }

  /**
   * Demo Action ("RÚT QUẺ NGẪU NHIÊN"): Draws a uniform random enabled fortune stick immediately,
   * displays the Center Xin Xăm Result Panel, rings the temple bell, and narrates via VieNeuTTS.
   */
  public drawRandomFortuneOnly(params?: {
    userId?: string;
    username?: string;
    nickname?: string;
    avatarUrl?: string;
    forcedFortuneNumber?: number;
  }): XinXamDrawResult | null {
    const now = Date.now();
    const userId = params?.userId || 'demo-minh-anh-001';
    const username = (params?.username || 'phattu.minhanh').replace(/^@+/, '');
    const nickname = params?.nickname || 'Minh Anh';
    const dedupeKey = `xinxam_quick_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const draw = xinXamRegistry.drawFortune({
      eventDedupeKey: dedupeKey,
      userId,
      username,
      nickname,
      avatarUrl: params?.avatarUrl || '',
      isDemo: true,
      forcedFortuneNumber: params?.forcedFortuneNumber,
    });
    if (!draw) return null;

    const syntheticRitualId = `quick-reveal-${dedupeKey}`;
    this.pendingXinXamDrawsByRitualId.set(syntheticRitualId, draw);
    this.notifyXinXamStickRevealed(userId, syntheticRitualId);
    this.pendingXinXamDrawsByRitualId.delete(syntheticRitualId);
    return draw;
  }

  /**
   * Demo Action ("THỬ HIỆU ỨNG"): Triggers falling pink lotus petals, lotus leaves,
   * golden particles around the Xin Xăm stand, glowing bamboo fortune stick, and temple bell.
   */
  public triggerXinXamEffectsPreview(): void {
    const now = Date.now();
    this.xinXamGlowUntil = now + 5600;
    this.altarGlowUntil = Math.max(this.altarGlowUntil, now + 5200);
    if (this.effectsEnabled) {
      soundSynthesizer.playXinXamRevealBell(0.78);
      this.spawnEffect({
        id: `fx-xinxam-demo-${now}`,
        type: 'golden_particles',
        userId: 'demo-fx',
        username: 'phattu.minhanh',
        giftName: 'Xin Xăm Cầu Nguyện',
        points: 200,
        seatIndex: 0,
        originX: -3.55,
        originZ: -9.05,
        startedAt: now,
        durationMs: 4800,
      });
      this.triggerLotusFallingBurst({
        id: `lotus-xinxam-demo-${now}`,
        isMajor: true,
        intensityOverride: 1.5,
        now,
      });
    }
    this.scheduleNotify();
  }

  private handleGiftEvent(params: {
    eventId: string;
    streakKey?: string;
    userId: string;
    username: string;
    nickname: string;
    avatarUrl?: string;
    giftId: string;
    giftName: string;
    giftPictureUrl?: string;
    deltaCount: number;
    totalStreakCount: number;
    isStreakable: boolean;
    repeatEnd: boolean;
    isStreakCompletionOnly: boolean;
    prevStreakWasZero: boolean;
    diamondCount: number;
    isDemo: boolean;
    now: number;
  }): void {
    // 0. Check dedicated Xin Xăm Gift ID FIRST (requires enabled === true AND exact non-empty configured Gift ID — NEVER matches by coin price alone!)
    const xinXamSettings = xinXamRegistry.getSettings();
    const configuredXinXamGiftId = normalizeGiftId(xinXamSettings.giftId);
    const matchesDedicatedXinXamId =
      Boolean(configuredXinXamGiftId) && params.giftId === configuredXinXamGiftId;

    const mapping = giftRegistry.getByGiftId(params.giftId);
    const isMappedAsXinXam = Boolean(
      mapping &&
        (mapping.ritualType === 'xin_xam' || mapping.characterAnimation === 'walk_xin_xam'),
    );

    if (matchesDedicatedXinXamId || isMappedAsXinXam) {
      const xinXamAllowed = matchesDedicatedXinXamId
        ? xinXamSettings.enabled
        : Boolean(mapping?.enabled && xinXamSettings.enabled);

      if (!xinXamAllowed) {
        const existingLedger = this.meritLedger.get(params.userId);
        this.recordGiftCalculationLog({
          id: `glog-${params.eventId}`,
          userId: params.userId,
          username: params.username,
          giftId: params.giftId,
          giftName: 'Xin Xăm Cầu Nguyện',
          giftCount: Math.max(1, params.deltaCount),
          unitPoints: xinXamSettings.meritPoints,
          awardedPoints: 0,
          totalUserPoints: existingLedger?.points ?? 0,
          ritualName: 'Xin Xăm Cầu Nguyện',
          status: 'disabled',
          isDemo: params.isDemo,
          timestamp: params.now,
        });
        this.scheduleNotify();
        return;
      }

      // Deduplicate streak packets so one gift streak produces at most ONE Xin Xăm fortune draw!
      if (params.isStreakable && !params.prevStreakWasZero) {
        if (params.deltaCount > 0) {
          const { participant } = this.ensureParticipant(params);
          participant.points += xinXamSettings.meritPoints * params.deltaCount;
          participant.giftCount += params.deltaCount;
          participant.lastInteractionAt = params.now;
          this.syncParticipantToLedger(participant);
          this.scheduleNotify();
        }
        return;
      }

      const dedupeKey =
        params.isStreakable && params.streakKey
          ? `xinxam_streak_${params.streakKey}`
          : `xinxam_evt_${params.eventId}`;

      this.triggerXinXamForUser({
        userId: params.userId,
        username: params.username,
        nickname: params.nickname,
        avatarUrl: params.avatarUrl,
        giftId: params.giftId,
        eventDedupeKey: dedupeKey,
        deltaCount: Math.max(1, params.deltaCount),
        isDemo: params.isDemo,
        now: params.now,
      });
      return;
    }

    // 2. UNKNOWN GIFT HANDLING ("QUÀ CHƯA CẤU HÌNH")
    if (!mapping) {
      if (params.deltaCount > 0) {
        giftRegistry.reportUnknownGift({
          giftId: params.giftId,
          giftName: params.giftName,
          iconUrl: params.giftPictureUrl,
          diamondCount: params.diamondCount,
          countDelta: params.deltaCount,
          username: params.username,
          isDemo: params.isDemo,
        });
      }
      const existingLedger = this.meritLedger.get(params.userId);
      this.recordGiftCalculationLog({
        id: `glog-${params.eventId}`,
        userId: params.userId,
        username: params.username,
        giftId: params.giftId,
        giftName: params.giftName,
        giftCount: Math.max(1, params.deltaCount),
        unitPoints: 0,
        awardedPoints: 0,
        totalUserPoints: existingLedger?.points ?? 0,
        ritualName: 'Chưa cấu hình',
        status: 'unknown',
        isDemo: params.isDemo,
        timestamp: params.now,
      });
      this.scheduleNotify();
      return;
    }

    // 3. DISABLED GIFT HANDLING
    if (!mapping.enabled) {
      const existingLedger = this.meritLedger.get(params.userId);
      this.recordGiftCalculationLog({
        id: `glog-${params.eventId}`,
        userId: params.userId,
        username: params.username,
        giftId: mapping.giftId,
        giftName: mapping.vietnameseLabel || mapping.giftName,
        giftCount: Math.max(1, params.deltaCount),
        unitPoints: mapping.points,
        awardedPoints: 0,
        totalUserPoints: existingLedger?.points ?? 0,
        ritualName: getRitualDisplayNameVi(mapping.ritualType),
        status: 'disabled',
        isDemo: params.isDemo,
        timestamp: params.now,
      });
      this.scheduleNotify();
      return;
    }

    // 4. Find or create unique 3D participant for this TikTok userId & refresh 120s inactivity timer
    const { participant } = this.ensureParticipant(params);

    // 5. Award exact merit points for the new delta count (never double-counted across streaks!)
    const awardedPoints = mapping.points * params.deltaCount;
    if (params.deltaCount > 0) {
      this.giftEventCounts[mapping.giftId] =
        (this.giftEventCounts[mapping.giftId] || 0) + params.deltaCount;
      if (mapping.id && mapping.id !== mapping.giftId) {
        this.giftEventCounts[mapping.id] = this.giftEventCounts[mapping.giftId];
      }
      participant.points += awardedPoints;
      participant.giftCount += params.deltaCount;
      participant.lastGiftName = mapping.vietnameseLabel || mapping.giftName;
      participant.lastGiftAt = params.now;
    }
    participant.lastInteractionAt = params.now;
    this.syncParticipantToLedger(participant);

    const ritualDisplayVi = getRitualDisplayNameVi(mapping.ritualType);
    const isLarge =
      mapping.isLarge ||
      mapping.voicePriority === AnnouncementPriority.LARGE_GIFT ||
      mapping.ritualType === 'altar_pagoda' ||
      mapping.ritualType === 'altar_grand_ceremony';

    // Intermediate streak packet (`repeatEnd === false`):
    // Start ceremony on the first tap of the streak, defer voice announcement until `repeatEnd === true` so full streak count is spoken cleanly without duplicate speech!
    if (params.isStreakable && !params.repeatEnd) {
      this.recordGiftCalculationLog({
        id: `glog-${params.eventId}`,
        userId: participant.userId,
        username: participant.username,
        giftId: mapping.giftId,
        giftName: mapping.vietnameseLabel || mapping.giftName,
        giftCount: params.deltaCount,
        unitPoints: mapping.points,
        awardedPoints,
        totalUserPoints: participant.points,
        ritualName: ritualDisplayVi,
        status: 'streak_update',
        isDemo: params.isDemo,
        timestamp: params.now,
      });

      if (params.prevStreakWasZero) {
        this.executeGiftCeremonyAndEffects({
          participant,
          mapping,
          ritualDisplayVi,
          isLarge,
          awardedPoints: mapping.points * params.totalStreakCount,
          eventId: params.eventId,
          isDemo: params.isDemo,
          now: params.now,
        });
      }
      this.scheduleNotify();
      return;
    }

    // 6. Per-gift cooldown enforcement (merit points already credited above; throttles duplicate spam ceremonies/voices)
    const cooldownKey = `${participant.userId}:${mapping.giftId}`;
    const cooldownMs = Math.max(0, Number(mapping.cooldownSec ?? 1.2)) * 1000;
    const prevExecAt = this.lastGiftExecutionByKey.get(cooldownKey) || 0;
    if (
      !params.isStreakCompletionOnly &&
      !params.isStreakable &&
      cooldownMs > 0 &&
      params.now - prevExecAt < cooldownMs
    ) {
      this.recordGiftCalculationLog({
        id: `glog-${params.eventId}`,
        userId: participant.userId,
        username: participant.username,
        giftId: mapping.giftId,
        giftName: mapping.vietnameseLabel || mapping.giftName,
        giftCount: params.deltaCount,
        unitPoints: mapping.points,
        awardedPoints,
        totalUserPoints: participant.points,
        ritualName: ritualDisplayVi,
        status: 'cooldown_throttled',
        isDemo: params.isDemo,
        timestamp: params.now,
      });
      this.scheduleNotify();
      return;
    }
    this.lastGiftExecutionByKey.set(cooldownKey, params.now);

    const effectiveGiftCountForSpeech = params.isStreakable
      ? Math.max(1, params.totalStreakCount)
      : Math.max(1, params.deltaCount);
    const effectiveMeritForSpeech = mapping.points * effectiveGiftCountForSpeech;

    this.recordGiftCalculationLog({
      id: `glog-${params.eventId}`,
      userId: participant.userId,
      username: participant.username,
      giftId: mapping.giftId,
      giftName: mapping.vietnameseLabel || mapping.giftName,
      giftCount: effectiveGiftCountForSpeech,
      unitPoints: mapping.points,
      awardedPoints: params.isStreakable ? effectiveMeritForSpeech : awardedPoints,
      totalUserPoints: participant.points,
      ritualName: ritualDisplayVi,
      status: 'executed',
      isDemo: params.isDemo,
      timestamp: params.now,
    });

    const canonicalDefaults = inferCanonicalCeremonialDefaults({
      giftId: mapping.giftId,
      ritualType: mapping.ritualType,
      ceremonyTitle: mapping.ritualTitle || mapping.ceremonyTitle,
      isLarge,
    });
    const ritualTitle = sanitizeCeremonialText(
      mapping.ritualTitle || mapping.ceremonyTitle || canonicalDefaults.ritualTitle,
      canonicalDefaults.ritualTitle,
    );
    const subtitleTemplate = mapping.ritualSubtitle || canonicalDefaults.ritualSubtitle;
    const renderedSubtitle = renderCeremonialSubtitle(subtitleTemplate, {
      username: participant.username,
      ritualTitle,
      meritPoints: effectiveMeritForSpeech,
    });
    const voicePriority =
      mapping.voicePriority === AnnouncementPriority.LARGE_GIFT ||
      mapping.voicePriority === AnnouncementPriority.NORMAL_GIFT ||
      mapping.voicePriority === AnnouncementPriority.SPECIAL_RITUAL
        ? mapping.voicePriority
        : isLarge
          ? AnnouncementPriority.LARGE_GIFT
          : AnnouncementPriority.NORMAL_GIFT;
    const queuePriority = Number.isFinite(mapping.queuePriority)
      ? Math.max(1, Math.min(100, Math.round(Number(mapping.queuePriority))))
      : canonicalDefaults.queuePriority;

    this.pushEventNotification({
      kind: 'ritual',
      username: participant.username,
      message: sanitizeCeremonialText(ritualTitle.toLowerCase(), 'cầu bình an'),
      pointsDelta: params.isStreakable ? effectiveMeritForSpeech : awardedPoints,
      isDemo: params.isDemo,
      now: params.now,
    });

    // 7. Queue Non-Overlapping Center Ceremonial Announcement + Abundant Lotus Falling Shower
    this.enqueueCenterCeremonialAnnouncement({
      id: `ceremony-${params.eventId}`,
      userId: participant.userId,
      username: participant.username,
      nickname: participant.nickname,
      avatarUrl: participant.avatarUrl,
      ritualTitle,
      ritualSubtitle: renderedSubtitle,
      isMajor: isLarge || voicePriority === AnnouncementPriority.LARGE_GIFT,
      tier: voicePriority,
      queuePriority,
      isDemo: params.isDemo,
      now: params.now,
    });

    // 8. Ceremonial VieNeuTTS Voice Narration (ZERO gift words — pure prayer intention!)
    const spokenName = normalizeSpeechUsername(params.nickname || params.username);
    const activeVoiceTemplate =
      mapping.voiceTemplate || mapping.ttsTemplate || canonicalDefaults.voiceTemplate;
    const spokenText = renderGiftVoiceTemplate(activeVoiceTemplate, {
      username: spokenName,
      giftName: ritualDisplayVi,
      giftCount: effectiveGiftCountForSpeech,
      meritPoints: effectiveMeritForSpeech,
      ritualName: ritualDisplayVi,
      ritualTitle,
    });

    const playBellBeforeSpeech =
      mapping.soundEffect === 'temple_bell' ||
      mapping.soundEffect === 'grand_ceremony_bell' ||
      isLarge;

    const voiceSettings = voiceManager.getSettings();
    if (spokenText && voiceSettings.giftAnnouncementsEnabled) {
      voiceManager.enqueue({
        text: spokenText,
        priority: voicePriority,
        queuePriority,
        category: voicePriority === AnnouncementPriority.LARGE_GIFT ? 'large_gift' : 'gift',
        userId: participant.userId,
        username: participant.username,
        isDemo: params.isDemo,
        dedupeKey: `ceremony:${participant.userId}:${mapping.giftId}:${Math.floor(params.now / 1500)}:${effectiveGiftCountForSpeech}`,
        playBellBeforeSpeech,
        bypassRateLimit: isLarge,
      });
    }

    // 9. Trigger 3D Ceremony & Effects (unless already launched on first packet of this streak)
    if (!params.isStreakable || params.prevStreakWasZero) {
      this.executeGiftCeremonyAndEffects({
        participant,
        mapping,
        ritualDisplayVi,
        isLarge,
        awardedPoints: effectiveMeritForSpeech,
        spokenText,
        playBellBeforeSpeech,
        eventId: params.eventId,
        isDemo: params.isDemo,
        now: params.now,
      });
    }

    this.scheduleNotify();
  }

  private executeGiftCeremonyAndEffects(params: {
    participant: Participant;
    mapping: GiftMapping;
    ritualDisplayVi: string;
    isLarge: boolean;
    awardedPoints: number;
    spokenText?: string;
    playBellBeforeSpeech?: boolean;
    eventId: string;
    isDemo: boolean;
    now: number;
  }): void {
    const { participant, mapping, ritualDisplayVi, isLarge, awardedPoints } = params;
    const durationMs = Math.max(
      1500,
      Math.min(15000, Math.round((mapping.animationDurationSec || 4.5) * 1000)),
    );
    const seat = getSeatPosition(participant.seatIndex);
    const ceremonialTitle = sanitizeCeremonialText(
      mapping.ritualTitle || mapping.ceremonyTitle || 'CẦU BÌNH AN',
      'CẦU BÌNH AN',
    );
    const badgeLabel = sanitizeCeremonialText(
      mapping.badgeCeremonyLabel || ceremonialTitle,
      ceremonialTitle,
    );

    // Case A: "No animation" — keep character seated without changing pose, play configured sound/visual effect immediately
    if (mapping.ritualType === 'no_animation' || mapping.characterAnimation === 'none') {
      participant.ritualStatusLabel = ceremonialTitle;
      participant.ritualStatusUntil = params.now + durationMs;

      if (this.effectsEnabled) {
        if (mapping.soundEffect && mapping.soundEffect !== 'none') {
          soundSynthesizer.playConfiguredGiftSound(mapping.soundEffect, 0.8);
        }
        if (mapping.effect && mapping.effect !== 'none') {
          this.spawnEffect({
            id: `fx-noanim-${params.eventId}`,
            type: mapping.effect,
            userId: participant.userId,
            username: participant.username,
            giftName: ceremonialTitle,
            points: awardedPoints,
            seatIndex: participant.seatIndex,
            originX: seat.x,
            originZ: seat.z,
            startedAt: params.now,
            durationMs,
          });
        }
      }
    }
    // Case B: Seated prayer at mat (`seated_pray` or `seat_prayer`) without walking to altar
    else if (mapping.characterAnimation === 'seated_pray' || mapping.ritualType === 'seat_prayer') {
      if (!participant.activeRitual) {
        participant.animState = 'praying';
        participant.animStateStartedAt = params.now;
      }
      participant.ritualStatusLabel = `${ritualDisplayVi} · ${ceremonialTitle}`;
      participant.ritualStatusUntil = params.now + durationMs;

      this.addOrRefreshLotusBadge({
        userId: participant.userId,
        username: participant.username,
        nickname: participant.nickname,
        avatarUrl: participant.avatarUrl,
        ceremonyTitle: badgeLabel,
        offeringLabel: ritualDisplayVi,
        preferredSide: seat.side,
        durationMs: durationMs + 2500,
      });

      if (this.effectsEnabled) {
        if (mapping.soundEffect && mapping.soundEffect !== 'none') {
          soundSynthesizer.playConfiguredGiftSound(mapping.soundEffect, 0.82);
        }
        if (mapping.effect && mapping.effect !== 'none') {
          this.spawnEffect({
            id: `fx-seatpray-${params.eventId}`,
            type: mapping.effect,
            userId: participant.userId,
            username: participant.username,
            giftName: ceremonialTitle,
            points: awardedPoints,
            seatIndex: participant.seatIndex,
            originX: seat.x,
            originZ: seat.z,
            startedAt: params.now,
            durationMs,
          });
        }
      }
    }
    // Case C: Full Altar Ceremony — stand up from seat, walk center aisle to reserved altar station, perform ritual, return to seat
    else {
      this.enqueueAltarRitual({
        userId: participant.userId,
        giftId: mapping.giftId,
        giftName: ceremonialTitle,
        type: mapping.ritualType,
        characterAnimation: mapping.characterAnimation,
        customEffect: mapping.effect,
        customSound: mapping.soundEffect,
        awardedPoints,
        isDemo: params.isDemo,
        label: `${ritualDisplayVi} · ${ceremonialTitle}`,
        ceremonyBadgeTitle: badgeLabel,
        offeringLabel: ritualDisplayVi,
        spokenText: params.spokenText,
        playBellBeforeSpeech: params.playBellBeforeSpeech,
        isLargeCeremony: isLarge,
        isGiftCeremony: true,
        priorityOverride: mapping.voicePriority,
        durationMs,
      });
    }

    this.prominentGiftBanner = null;
  }
}

export const tiktokEventManager = new TikTokEventManager();
