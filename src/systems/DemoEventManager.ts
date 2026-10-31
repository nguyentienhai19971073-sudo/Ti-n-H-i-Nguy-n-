import { GiftMapping, TikTokNormalizedEvent, normalizeGiftId } from '../types/temple';

export interface SampleViewer {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string;
}

const AVATAR_BG_PAIRS: [string, string][] = [
  ['#611220', '#d4af37'],
  ['#4a1428', '#f6c86a'],
  ['#243b55', '#e8c267'],
  ['#4e2a14', '#f2cb6f'],
  ['#1f4037', '#ebd07f'],
  ['#5c1b29', '#f7b2cd'],
];

/**
 * Generates a zero-dependency, crisp SVG data-URI portrait medallion for Demo & fallback avatars
 * so Floating Pink Lotus Avatar badges always show a clean portrait without external 404 URLs.
 */
export function buildSacredAvatarDataUri(seedKey: string, displayName: string): string {
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const [bg, accent] = AVATAR_BG_PAIRS[hash % AVATAR_BG_PAIRS.length];
  const clean = displayName.trim().replace(/^@+/, '');
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
      : clean.slice(0, 2).toUpperCase() || 'PT';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <radialGradient id="g" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="96" height="96" rx="48" fill="${bg}"/>
    <rect width="96" height="96" rx="48" fill="url(#g)"/>
    <circle cx="48" cy="48" r="43" fill="none" stroke="${accent}" stroke-width="2" stroke-opacity="0.65"/>
    <path d="M48 16 C43 23 39 29 39 34 C39 39 43 43 48 44 C53 43 57 39 57 34 C57 29 53 23 48 16 Z" fill="${accent}" fill-opacity="0.22"/>
    <text x="48" y="56" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="28" fill="#fff5df" letter-spacing="1">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRIMARY_DEMO_VIEWER: SampleViewer = {
  userId: 'demo-minh-anh-001',
  username: 'phattu.minhanh',
  nickname: 'Minh Anh',
  avatarUrl: buildSacredAvatarDataUri('demo-minh-anh-001', 'Minh Anh'),
};

const RAW_VIETNAMESE_POOL = [
  { userId: 'demo-vn-002', username: 'bichtran.99', nickname: 'Bích Trần' },
  { userId: 'demo-vn-003', username: 'hoanglong.le', nickname: 'Hoàng Long Lê' },
  { userId: 'demo-vn-004', username: 'tramy.binhan', nickname: 'Trà My' },
  { userId: 'demo-vn-005', username: 'thientam.88', nickname: 'Thiện Tâm' },
  { userId: 'demo-vn-006', username: 'ngockhanh.vu', nickname: 'Ngọc Khánh' },
  { userId: 'demo-vn-007', username: 'huongsen.viet', nickname: 'Hương Sen Việt' },
  { userId: 'demo-vn-008', username: 'thanhbinh.dao', nickname: 'Thanh Bình' },
  { userId: 'demo-vn-009', username: 'kimngan.phat', nickname: 'Kim Ngân' },
  { userId: 'demo-vn-010', username: 'minhkhoi.tran', nickname: 'Minh Khôi' },
  { userId: 'demo-vn-011', username: 'dieu.linh.26', nickname: 'Diệu Linh' },
  { userId: 'demo-vn-012', username: 'quocbao.nguyen', nickname: 'Quốc Bảo' },
  { userId: 'demo-vn-013', username: 'thuha.ankieng', nickname: 'Thu Hà' },
  { userId: 'demo-vn-014', username: 'phuc.loc.tho', nickname: 'Phúc Lộc' },
  { userId: 'demo-vn-015', username: 'anh.tuan.95', nickname: 'Anh Tuấn' },
  { userId: 'demo-vn-016', username: 'yen.thu.sen', nickname: 'Yến Thu' },
  { userId: 'demo-vn-017', username: 'hoai.thuong.vn', nickname: 'Hoài Thương' },
  { userId: 'demo-vn-018', username: 'duc.thinh.79', nickname: 'Đức Thịnh' },
  { userId: 'demo-vn-019', username: 'lan.huong.tinh', nickname: 'Lan Hương' },
  { userId: 'demo-vn-020', username: 'quang.huy.tam', nickname: 'Quang Huy' },
];

export const VIETNAMESE_SAMPLE_POOL: SampleViewer[] = RAW_VIETNAMESE_POOL.map((v) => ({
  ...v,
  avatarUrl: buildSacredAvatarDataUri(v.userId, v.nickname),
}));

const SAMPLE_COMMENTS = [
  'Con cầu bình an cho đại gia đình ạ',
  'Cầu sức khỏe dồi dào cho cha mẹ hai bên',
  'Xin cầu tài lộc hanh thông năm mới',
  'Cầu gia đạo thuận hòa êm ấm',
  'Con cầu học hành đỗ đạt suôn sẻ',
  'Cầu tình duyên thiện lành an vui',
  'Chùa thanh tịnh quá, tâm con thấy nhẹ nhàng',
  'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
];

let demoBatchSerial = 100;
let prayerRotateIdx = 0;
let ordinaryRotateIdx = 0;
const activeBatchTimers: number[] = [];

export function clearPendingDemoBatches(): void {
  while (activeBatchTimers.length > 0) {
    const t = activeBatchTimers.pop();
    if (t !== undefined && typeof window !== 'undefined') window.clearTimeout(t);
  }
}

export function resolveDemoViewerFromUsername(rawUsername: string): SampleViewer {
  const cleaned = rawUsername.trim().replace(/^@+/, '') || PRIMARY_DEMO_VIEWER.username;
  if (cleaned.toLowerCase() === PRIMARY_DEMO_VIEWER.username.toLowerCase()) {
    return PRIMARY_DEMO_VIEWER;
  }
  const fromPool = VIETNAMESE_SAMPLE_POOL.find(
    (v) => v.username.toLowerCase() === cleaned.toLowerCase(),
  );
  if (fromPool) return fromPool;
  const userId = `demo-${cleaned.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`;
  return {
    userId,
    username: cleaned,
    nickname: cleaned,
    avatarUrl: buildSacredAvatarDataUri(userId, cleaned),
  };
}

export function createSampleFirstCommentEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-first-comment-${now}`,
    type: 'comment',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    comment: 'Con xin kính lễ Phật, cầu bình an cho gia đình ạ',
    isDemo: true,
    timestamp: now,
  };
}

/**
 * Generates a Demo Like event for 10, 100, or 1000 likes on the seated viewer
 */
export function createSampleLikeMilestoneEvent(
  likeBatch: 10 | 100 | 1000 = 10,
  targetViewer?: { userId: string; username: string; nickname?: string; avatarUrl?: string },
): TikTokNormalizedEvent {
  const now = Date.now();
  const viewer = targetViewer || PRIMARY_DEMO_VIEWER;
  return {
    eventId: `demo-like-${likeBatch}-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'like',
    userId: viewer.userId,
    username: viewer.username,
    nickname: viewer.nickname || viewer.username,
    avatarUrl: viewer.avatarUrl || buildSacredAvatarDataUri(viewer.userId, viewer.username),
    likeCount: likeBatch,
    isDemo: true,
    timestamp: now,
  };
}

export function createSampleLikeEvent(): TikTokNormalizedEvent {
  return createSampleLikeMilestoneEvent(10);
}

export function createSampleFollowIncenseEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-follow-${now}`,
    type: 'follow',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    isDemo: true,
    timestamp: now,
  };
}

export function createSampleShareLanternEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-share-${now}`,
    type: 'share',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    isDemo: true,
    timestamp: now,
  };
}

// === THE FIVE CONFIGURABLE CEREMONIAL GIFTS ("🪷 CÚNG DƯỜNG CẦU AN") ===

/** 1. CẦU BÌNH AN – Hoa Hồng – 1 xu */
export function createSampleRoseGiftSameAccountEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-gift-hoahong-${now}`,
    type: 'gift',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    giftId: '5655',
    giftName: 'Rose',
    giftCount: 1,
    diamondCount: 1,
    isDemo: true,
    timestamp: now,
  };
}

/** 2. CẦU SỨC KHỎE – Chuông Đồng – 10 xu */
export function createSampleBellGiftEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-gift-chuongdong-${now}`,
    type: 'gift',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    giftId: '8910',
    giftName: 'Bronze Bell',
    giftCount: 1,
    diamondCount: 10,
    isDemo: true,
    timestamp: now,
  };
}

/** 3. CẦU GIA ĐẠO – Mâm Quả – 30 xu */
export function createSampleFruitTrayGiftEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-gift-mamqua-${now}`,
    type: 'gift',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    giftId: '6093',
    giftName: 'Fruit Plate',
    giftCount: 1,
    diamondCount: 30,
    isDemo: true,
    timestamp: now,
  };
}

/** 4. CẦU TÀI LỘC – Đài Sen – 99 xu */
export function createSampleLotusPedestalGiftEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-gift-daisen-${now}`,
    type: 'gift',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    giftId: '5827',
    giftName: 'Lotus',
    giftCount: 1,
    diamondCount: 99,
    isDemo: true,
    timestamp: now,
  };
}

/** 5. CẦU CÔNG ĐỨC – Bảo Tháp – 199 xu */
export function createSamplePagodaGiftEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  return {
    eventId: `demo-gift-baothap-${now}`,
    type: 'gift',
    userId: PRIMARY_DEMO_VIEWER.userId,
    username: PRIMARY_DEMO_VIEWER.username,
    nickname: PRIMARY_DEMO_VIEWER.nickname,
    avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
    giftId: '29201',
    giftName: 'Pagoda',
    giftCount: 1,
    diamondCount: 199,
    isDemo: true,
    timestamp: now,
  };
}

export function createSampleLargeGiftEvent(): TikTokNormalizedEvent {
  return createSamplePagodaGiftEvent();
}

/**
 * Creates a Demo event for an UNCONFIGURED / UNKNOWN TikTok Gift ID so admins can test
 * automatic logging into "QUÀ CHƯA CẤU HÌNH" and 1-click configuration.
 */
export function createUnknownDemoGiftEvent(params?: {
  giftId?: string;
  giftName?: string;
  diamondCount?: number;
  username?: string;
}): TikTokNormalizedEvent {
  const now = Date.now();
  const gid = normalizeGiftId(params?.giftId) || '998877';
  const viewer = resolveDemoViewerFromUsername(params?.username || PRIMARY_DEMO_VIEWER.username);
  return {
    eventId: `demo-unknown-gift-${gid}-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'gift',
    userId: viewer.userId,
    username: viewer.username,
    nickname: viewer.nickname,
    avatarUrl: viewer.avatarUrl,
    giftId: gid,
    giftName: params?.giftName || `Mystery Lotus #${gid}`,
    giftCount: 1,
    diamondCount: params?.diamondCount ?? 25,
    isDemo: true,
    timestamp: now,
  };
}

/**
 * Simulates a realistic TikTok Gift Streak (`giftType: 1`, `repeatEnd: false` -> `repeatEnd: true`)
 * passing through the exact same GiftRegistry + TikTokEventManager pipeline without double-counting points.
 */
export function scheduleSimulatedGiftStreak(
  params: {
    mapping: GiftMapping;
    username: string;
    totalCount: number;
  },
  dispatch: (ev: TikTokNormalizedEvent) => void,
): void {
  const viewer = resolveDemoViewerFromUsername(params.username);
  const finalCount = Math.max(2, Math.min(999, Math.round(params.totalCount || 3)));
  const streakKey = `${viewer.userId}:${params.mapping.giftId}:demo-streak-${Date.now()}`;

  // Build realistic intermediate cumulative counts ending at finalCount
  const steps: { count: number; repeatEnd: boolean }[] = [];
  if (finalCount <= 3) {
    for (let c = 1; c < finalCount; c++) {
      steps.push({ count: c, repeatEnd: false });
    }
    steps.push({ count: finalCount, repeatEnd: true });
  } else {
    const step1 = 1;
    const step2 = Math.max(2, Math.floor(finalCount * 0.5));
    steps.push({ count: step1, repeatEnd: false });
    if (step2 > step1 && step2 < finalCount) {
      steps.push({ count: step2, repeatEnd: false });
    }
    steps.push({ count: finalCount, repeatEnd: true });
  }

  steps.forEach((step, idx) => {
    const timer = window.setTimeout(() => {
      const ts = Date.now();
      dispatch({
        eventId: `demo-streak-${streakKey}-${idx}-${ts}`,
        type: 'gift',
        userId: viewer.userId,
        username: viewer.username,
        nickname: viewer.nickname,
        avatarUrl: viewer.avatarUrl,
        giftId: params.mapping.giftId,
        giftName: params.mapping.giftName,
        giftPictureUrl: params.mapping.uploadedImageData || params.mapping.iconUrl,
        giftCount: step.count,
        totalStreakCount: step.count,
        giftType: 1,
        repeatEnd: step.repeatEnd,
        streakKey,
        diamondCount: params.mapping.referenceCoins || 1,
        isDemo: true,
        timestamp: ts,
      });
    }, idx * 420);
    activeBatchTimers.push(timer);
  });
}

/**
 * Simulates a burst of several different configured gifts arriving quickly from multiple demo viewers
 * to test Altar Station reservation, Ceremony Queueing, and Priority Voice Narration.
 */
export function scheduleSimulatedGiftBurst(
  gifts: GiftMapping[],
  dispatch: (ev: TikTokNormalizedEvent) => void,
): void {
  const enabled = gifts.filter((g) => g.enabled);
  if (enabled.length === 0) return;

  const burstCount = Math.min(5, Math.max(3, enabled.length));
  for (let i = 0; i < burstCount; i++) {
    const gm = enabled[i % enabled.length];
    const viewer =
      i === 0 ? PRIMARY_DEMO_VIEWER : VIETNAMESE_SAMPLE_POOL[i % VIETNAMESE_SAMPLE_POOL.length];
    const timer = window.setTimeout(() => {
      const ts = Date.now();
      dispatch({
        eventId: `demo-burst-${gm.giftId}-${i}-${ts}`,
        type: 'gift',
        userId: viewer.userId,
        username: viewer.username,
        nickname: viewer.nickname,
        avatarUrl: viewer.avatarUrl,
        giftId: gm.giftId,
        giftName: gm.giftName,
        giftPictureUrl: gm.uploadedImageData || gm.iconUrl,
        giftCount: i === burstCount - 1 ? 2 : 1,
        diamondCount: gm.referenceCoins || 1,
        isDemo: true,
        timestamp: ts,
      });
    }, i * 260);
    activeBatchTimers.push(timer);
  }
}

export type PrayerDemoTopic =
  | 'binh_an'
  | 'suc_khoe'
  | 'tai_loc'
  | 'tinh_duyen'
  | 'hoc_hanh'
  | 'gia_dao';

const TOPIC_COMMENT_MAP: Record<PrayerDemoTopic, string> = {
  binh_an: 'Con xin thành tâm cầu bình an cho cả gia đình ạ',
  suc_khoe: 'Cầu sức khỏe dồi dào cho ông bà cha mẹ hai bên',
  tai_loc: 'Xin cầu tài lộc may mắn và công việc thuận lợi',
  tinh_duyen: 'Con cầu tình duyên thiện lành, êm ấm hạnh phúc',
  hoc_hanh: 'Cầu học hành sáng suốt, thi cử đỗ đạt tốt đẹp',
  gia_dao: 'Cầu gia đạo thuận hòa, sum vầy bình an',
};

export function createSamplePrayerTopicEvent(
  topic: PrayerDemoTopic,
  useSameAccount = false,
): TikTokNormalizedEvent {
  const now = Date.now();
  const viewer = useSameAccount
    ? PRIMARY_DEMO_VIEWER
    : VIETNAMESE_SAMPLE_POOL[prayerRotateIdx % VIETNAMESE_SAMPLE_POOL.length];
  prayerRotateIdx += 1;
  return {
    eventId: `demo-prayer-topic-${topic}-${now}-${prayerRotateIdx}`,
    type: 'comment',
    userId: viewer.userId,
    username: viewer.username,
    nickname: viewer.nickname,
    avatarUrl: viewer.avatarUrl,
    comment: TOPIC_COMMENT_MAP[topic],
    isDemo: true,
    timestamp: now,
  };
}

export function createSamplePrayerCommentEvent(useSameAccount = true): TikTokNormalizedEvent {
  const topics: PrayerDemoTopic[] = [
    'binh_an',
    'suc_khoe',
    'tai_loc',
    'tinh_duyen',
    'hoc_hanh',
    'gia_dao',
  ];
  const topic = topics[prayerRotateIdx % topics.length];
  return createSamplePrayerTopicEvent(topic, useSameAccount);
}

export function createSampleOrdinaryCommentEvent(): TikTokNormalizedEvent {
  const now = Date.now();
  const ordinaryTexts = [
    'Không gian chùa trang nghiêm thanh tịnh quá ạ',
    'Tiếng chuông chùa nghe nhẹ lòng thật sự',
    'Chúc mọi người buổi tối an nhiên tự tại',
    'Con kính chào quý Phật tử trong chánh điện ạ',
  ];
  const viewer = VIETNAMESE_SAMPLE_POOL[ordinaryRotateIdx % VIETNAMESE_SAMPLE_POOL.length];
  const text = ordinaryTexts[ordinaryRotateIdx % ordinaryTexts.length];
  ordinaryRotateIdx += 1;
  return {
    eventId: `demo-ordinary-comment-${now}-${ordinaryRotateIdx}`,
    type: 'comment',
    userId: viewer.userId,
    username: viewer.username,
    nickname: viewer.nickname,
    avatarUrl: viewer.avatarUrl,
    comment: text,
    isDemo: true,
    timestamp: now,
  };
}

/**
 * Schedules a Gift-First Voice Priority test:
 * 1) Dispatches 2 different users' prayer comments into the voice queue
 * 2) 550ms later dispatches a Ceremonial Gift (Đài Sen) to verify Gift voice preempts / prioritizes ahead of comments!
 */
export function scheduleGiftPriorityVoiceDemo(
  dispatch: (ev: TikTokNormalizedEvent) => void,
): void {
  const v1 = VIETNAMESE_SAMPLE_POOL[1];
  const v2 = VIETNAMESE_SAMPLE_POOL[2];
  const now = Date.now();

  dispatch({
    eventId: `demo-prio-c1-${now}`,
    type: 'comment',
    userId: v1.userId,
    username: v1.username,
    nickname: v1.nickname,
    avatarUrl: v1.avatarUrl,
    comment: 'Con xin cầu sức khỏe cho ông bà cha mẹ ạ',
    isDemo: true,
    timestamp: now,
  });

  const t1 = window.setTimeout(() => {
    const ts1 = Date.now();
    dispatch({
      eventId: `demo-prio-c2-${ts1}`,
      type: 'comment',
      userId: v2.userId,
      username: v2.username,
      nickname: v2.nickname,
      avatarUrl: v2.avatarUrl,
      comment: 'Cầu học hành sáng suốt và thi cử thuận lợi',
      isDemo: true,
      timestamp: ts1,
    });
  }, 180);
  activeBatchTimers.push(t1);

  const t2 = window.setTimeout(() => {
    const ts2 = Date.now();
    dispatch({
      eventId: `demo-prio-gift-${ts2}`,
      type: 'gift',
      userId: PRIMARY_DEMO_VIEWER.userId,
      username: PRIMARY_DEMO_VIEWER.username,
      nickname: PRIMARY_DEMO_VIEWER.nickname,
      avatarUrl: PRIMARY_DEMO_VIEWER.avatarUrl,
      giftId: '5827',
      giftName: 'Lotus',
      giftCount: 1,
      diamondCount: 99,
      isDemo: true,
      timestamp: ts2,
    });
  }, 620);
  activeBatchTimers.push(t2);
}

/**
 * Populates 8 distinct ranked users in BẢNG CÔNG ĐỨC so Ranks 1–4 fixed + Ranks 5–8 scrollable
 * can be verified with a single click.
 */
export function scheduleLeaderboardRanksDemo(
  dispatch: (ev: TikTokNormalizedEvent) => void,
): void {
  const giftPresets = [
    { giftId: '29201', giftName: 'Pagoda', coins: 199 },
    { giftId: '5827', giftName: 'Lotus', coins: 99 },
    { giftId: '6093', giftName: 'Fruit Plate', coins: 30 },
    { giftId: '8910', giftName: 'Bronze Bell', coins: 10 },
    { giftId: '5655', giftName: 'Rose', coins: 1 },
  ];

  for (let i = 0; i < 8; i++) {
    const viewer = VIETNAMESE_SAMPLE_POOL[i % VIETNAMESE_SAMPLE_POOL.length];
    const t = window.setTimeout(() => {
      const now = Date.now();
      if (i < 5) {
        const gp = giftPresets[i];
        dispatch({
          eventId: `demo-lb-gift-${i}-${now}`,
          type: 'gift',
          userId: viewer.userId,
          username: viewer.username,
          nickname: viewer.nickname,
          avatarUrl: viewer.avatarUrl,
          giftId: gp.giftId,
          giftName: gp.giftName,
          giftCount: 1,
          diamondCount: gp.coins,
          isDemo: true,
          timestamp: now,
        });
      } else {
        dispatch({
          eventId: `demo-lb-chat-${i}-${now}`,
          type: 'comment',
          userId: viewer.userId,
          username: viewer.username,
          nickname: viewer.nickname,
          avatarUrl: viewer.avatarUrl,
          comment: SAMPLE_COMMENTS[i % SAMPLE_COMMENTS.length],
          isDemo: true,
          timestamp: now,
        });
      }
    }, i * 160);
    activeBatchTimers.push(t);
  }
}

export function scheduleDemoParticipantsBatch(
  count: number,
  dispatch: (ev: TikTokNormalizedEvent) => void,
): void {
  const familyNames = ['nguyen', 'tran', 'le', 'pham', 'hoang', 'phan', 'vu', 'dang', 'bui', 'do'];
  const givenNames = [
    'an',
    'binh',
    'chau',
    'dung',
    'giang',
    'ha',
    'hanh',
    'khanh',
    'linh',
    'minh',
    'nam',
    'ngoc',
    'phuc',
    'quynh',
    'tam',
    'thao',
    'trang',
    'vy',
  ];

  const demoGiftIds = ['5655', '8910', '6093', '5827', '29201'];
  const demoGiftNames = ['Rose', 'Bronze Bell', 'Fruit Plate', 'Lotus', 'Pagoda'];
  const stepDelayMs = count >= 100 ? 45 : 180;

  for (let i = 0; i < count; i++) {
    const timer = window.setTimeout(() => {
      demoBatchSerial += 1;
      const poolItem = VIETNAMESE_SAMPLE_POOL[demoBatchSerial % VIETNAMESE_SAMPLE_POOL.length];
      const f = familyNames[demoBatchSerial % familyNames.length];
      const g = givenNames[(demoBatchSerial * 3) % givenNames.length];
      const uniqueId =
        demoBatchSerial < 120
          ? `${poolItem.userId}-${demoBatchSerial}`
          : `demo-user-${demoBatchSerial}`;
      const username =
        demoBatchSerial < 120
          ? `${poolItem.username}.${demoBatchSerial % 100}`
          : `${f}.${g}.${demoBatchSerial}`;
      const avatarUrl = buildSacredAvatarDataUri(uniqueId, poolItem.nickname);

      const now = Date.now();
      dispatch({
        eventId: `demo-batch-chat-${demoBatchSerial}-${now}`,
        type: 'comment',
        userId: uniqueId,
        username,
        nickname: poolItem.nickname,
        avatarUrl,
        comment: SAMPLE_COMMENTS[demoBatchSerial % SAMPLE_COMMENTS.length],
        isDemo: true,
        timestamp: now,
      });

      // Trigger occasional ceremonies only on smaller batches so 200-seat fill tests stay crisp
      if (count <= 60 && i % 8 === 2) {
        const ritualTimer = window.setTimeout(() => {
          const t2 = Date.now();
          const gIdx = demoBatchSerial % demoGiftIds.length;
          dispatch({
            eventId: `demo-batch-ceremony-${demoBatchSerial}-${t2}`,
            type: 'gift',
            userId: uniqueId,
            username,
            nickname: poolItem.nickname,
            avatarUrl,
            giftId: demoGiftIds[gIdx],
            giftName: demoGiftNames[gIdx],
            giftCount: 1,
            diamondCount: [1, 10, 30, 99, 199][gIdx],
            isDemo: true,
            timestamp: t2,
          });
        }, 6800);
        activeBatchTimers.push(ritualTimer);
      } else if (count <= 60 && i % 8 === 5) {
        const likeTimer = window.setTimeout(() => {
          const t2 = Date.now();
          dispatch({
            eventId: `demo-batch-like-${demoBatchSerial}-${t2}`,
            type: 'like',
            userId: uniqueId,
            username,
            nickname: poolItem.nickname,
            avatarUrl,
            likeCount: 10,
            isDemo: true,
            timestamp: t2,
          });
        }, 6400);
        activeBatchTimers.push(likeTimer);
      }
    }, i * stepDelayMs);
    activeBatchTimers.push(timer);
  }
}
