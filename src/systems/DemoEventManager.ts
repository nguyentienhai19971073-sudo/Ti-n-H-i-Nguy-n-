import { TikTokNormalizedEvent } from '../types/temple';

interface SampleViewer {
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

const VIETNAMESE_SAMPLE_POOL: SampleViewer[] = RAW_VIETNAMESE_POOL.map((v) => ({
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
  'Nam mô A Di Đà Phật, tâm tịnh lòng an',
  'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
];

let demoBatchSerial = 100;
let prayerRotateIdx = 0;
const activeBatchTimers: number[] = [];

export function clearPendingDemoBatches(): void {
  while (activeBatchTimers.length > 0) {
    const t = activeBatchTimers.pop();
    if (t !== undefined) window.clearTimeout(t);
  }
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
    giftId: 5655,
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
    giftId: 8910,
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
    giftId: 6093,
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
    giftId: 5827,
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
    giftId: 29201,
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

export function createSamplePrayerCommentEvent(useSameAccount = true): TikTokNormalizedEvent {
  const now = Date.now();
  const viewer = useSameAccount
    ? PRIMARY_DEMO_VIEWER
    : VIETNAMESE_SAMPLE_POOL[Math.floor(Math.random() * VIETNAMESE_SAMPLE_POOL.length)];
  const prayers = [
    'Con xin cầu bình an cho cả nhà',
    'Cầu sức khỏe cho ông bà cha mẹ',
    'Cầu tài lộc may mắn hanh thông',
    'Cầu tình duyên thiện lành hạnh phúc',
    'Cầu học hành thi cử đỗ đạt',
    'Cầu gia đạo bình an thuận hòa',
  ];
  const text = prayers[prayerRotateIdx % prayers.length];
  prayerRotateIdx += 1;
  return {
    eventId: `demo-prayer-${now}`,
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

  const demoGiftIds = [5655, 8910, 6093, 5827, 29201];
  const demoGiftNames = ['Rose', 'Bronze Bell', 'Fruit Plate', 'Lotus', 'Pagoda'];

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

      // Have every 6th newcomer perform a Buddhist ceremonial gift or like milestone after seating
      if (i % 6 === 2) {
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
      } else if (i % 6 === 4) {
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
    }, i * 240);
    activeBatchTimers.push(timer);
  }
}
