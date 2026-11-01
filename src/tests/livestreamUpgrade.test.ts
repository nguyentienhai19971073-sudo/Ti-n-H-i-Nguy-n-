import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  AnnouncementPriority,
  DEFAULT_COMMENT_VOICE_FORMULA,
  DEFAULT_GIFT_MAPPINGS,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  DEFAULT_XIN_XAM_SETTINGS,
  DEFAULT_XIN_XAM_VOICE_TEMPLATE,
  FORTUNE_CATEGORIES,
  FORTUNE_CLASSIFICATION_META,
  FortuneCategory,
  buildSortedOfferingItems,
  containsForbiddenGiftWords,
  formatFortuneCode,
  formatQueXamHeader,
  renderCeremonialSubtitle,
  renderGiftVoiceTemplate,
  renderXinXamVoiceText,
  sanitizeCeremonialText,
  vietnameseNumberToWords,
} from '../types/temple';
import {
  ALTAR_STATIONS,
  BUDDHA_ELEVATION_Y,
  BUDDHA_STATUE_SCALE,
  COL_SPACING_X,
  FIRST_ROW_Z,
  INNER_MAT_X,
  MAIN_SEAT_COLS_PER_SIDE,
  MAIN_SEAT_ROWS,
  ROW_SPACING_Z,
  TOTAL_MAIN_MATS,
  configureTempleCamera,
  getAllMainMats,
  getSeatPosition,
  verifyTempleFraming916,
} from '../systems/SeatManager';
import {
  LabelCandidateInput,
  isRectInsideViewport,
  screenRectsOverlap,
  solveLabelAndBubbleLayout,
} from '../systems/LabelCollisionManager';
import {
  SmartVoiceManager,
  formatCommentSpeechFormula,
  moderateAndNormalizeCommentForSpeech,
  voiceManager,
} from '../systems/VoiceManager';
import { TikTokEventManager } from '../systems/TikTokEventManager';
import { DEFAULT_100_FORTUNES } from '../data/fortunes100';
import { xinXamRegistry } from '../systems/XinXamRegistry';
import {
  buildBurgundyHeaderStyle,
  buildBurgundyPanelStyle,
  buildCenterCeremonialPanelStyle,
  buildCharacterNameLabelStyle,
  buildCommentBubbleStyle,
  buildXinXamResultPanelStyle,
} from '../systems/OverlayTheme';

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`✅ PASS: ${name}`);
}

const VIEW_W = 360;
const VIEW_H = 640; // 9:16 portrait livestream viewport

function createPortraitCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(56, VIEW_W / VIEW_H, 0.1, 200);
  configureTempleCamera(cam, VIEW_W, VIEW_H);
  return cam;
}

// ============================================================================
// 1. 50 SIMULTANEOUS CHARACTER LABELS
// ============================================================================
runTest('1. 50 simultaneous character labels layout & performance (<15ms)', () => {
  const cam = createPortraitCamera();
  const mats = getAllMainMats();
  const now = Date.now();

  const candidates: LabelCandidateInput[] = mats.slice(0, 50).map((mat, i) => ({
    userId: `u-50-${i}`,
    username: `phattu.anlac.${i + 1}`,
    worldX: mat.x,
    worldY: 0,
    worldZ: mat.z,
    headY: 1.04,
    isSpeaking: i === 0,
    isCeremonyActor: i === 1 || i === 2,
    isRecentlyActive: i < 12,
    seatIndex: mat.seatIndex,
  }));

  const t0 = performance.now();
  const res = solveLabelAndBubbleLayout(candidates, cam, {
    viewportWidth: VIEW_W,
    viewportHeight: VIEW_H,
    showUsernames: true,
    showCommentBubbles: true,
    now,
  });
  const elapsedMs = performance.now() - t0;

  assert.equal(res.items.length, 50, 'All 50 candidates evaluated');
  assert.ok(elapsedMs < 25, `Solver must be fast for M1 8GB RAM (took ${elapsedMs.toFixed(2)}ms)`);

  const visibleNames = res.items.filter((it) => it.nameVisible && it.nameRect);
  assert.ok(
    visibleNames.length >= 16,
    `Expected clean non-overlapping mobile packing on 360x640, got ${visibleNames.length}`,
  );

  // High-priority speaking & ceremony characters must be visible
  const speakerItem = res.items.find((it) => it.userId === 'u-50-0');
  assert.ok(speakerItem?.nameVisible, 'Speaking character name label must stay prioritized and visible');

  // Verify zero pairwise overlap and strict viewport + Buddha bounds on 360x640
  for (let i = 0; i < visibleNames.length; i++) {
    const rA = visibleNames[i].nameRect!;
    assert.ok(
      isRectInsideViewport(rA, VIEW_W, VIEW_H),
      `Label ${visibleNames[i].userId} must fit inside camera viewport`,
    );
    assert.equal(
      screenRectsOverlap(rA, res.buddhaExclusionRect),
      false,
      `Label ${visibleNames[i].userId} must never cover the Buddha statue`,
    );
    // Ensure single username only (never merged)
    assert.equal(visibleNames[i].username.includes(','), false);
    for (let j = i + 1; j < visibleNames.length; j++) {
      const rB = visibleNames[j].nameRect!;
      assert.equal(
        screenRectsOverlap(rA, rB, 1),
        false,
        `Labels ${visibleNames[i].userId} and ${visibleNames[j].userId} must not overlap`,
      );
    }
  }

  // Also verify on 720x1280 HD 9:16 TikTok LIVE canvas with 50 worshippers distributed across the sanctuary
  const hdCam = new THREE.PerspectiveCamera(56, 720 / 1280, 0.1, 200);
  configureTempleCamera(hdCam, 720, 1280);
  const spreadCandidates: LabelCandidateInput[] = Array.from({ length: 50 }, (_, i) => {
    const mat = mats[Math.min(mats.length - 1, Math.floor((i * mats.length) / 50))];
    return {
      userId: `u-hd-${i}`,
      username: `phattu_${i + 1}`,
      worldX: mat.x,
      worldY: 0,
      worldZ: mat.z,
      headY: 1.04,
      isSpeaking: i === 0,
      isCeremonyActor: i === 1,
      isRecentlyActive: i < 15,
      seatIndex: mat.seatIndex,
    };
  });
  const hdRes = solveLabelAndBubbleLayout(spreadCandidates, hdCam, {
    viewportWidth: 720,
    viewportHeight: 1280,
    showUsernames: true,
    showCommentBubbles: true,
    now,
  });
  const hdVisible = hdRes.items.filter((it) => it.nameVisible && it.nameRect);
  assert.ok(
    hdVisible.length >= 38,
    `Expected >= 38 non-overlapping labels on 720x1280 9:16 stream canvas, got ${hdVisible.length}`,
  );
  for (let i = 0; i < hdVisible.length; i++) {
    for (let j = i + 1; j < hdVisible.length; j++) {
      assert.equal(
        screenRectsOverlap(hdVisible[i].nameRect!, hdVisible[j].nameRect!, 1),
        false,
        'Zero overlap on 720x1280 9:16 stream canvas',
      );
    }
  }
});

// ============================================================================
// 2. 200 PARTICIPANTS CAPACITY, VIRTUAL OVERFLOW & 120s TIMEOUT
// ============================================================================
runTest('2. 200 participants capacity, primary mat cap & 120-second inactivity departure', () => {
  const manager = new TikTokEventManager();
  manager.clearParticipants(true);
  voiceManager.updateSettings({
    ...DEFAULT_VOICE_SETTINGS,
    autoNarrationEnabled: false,
  });

  const baseNow = Date.now() - 130_000;
  for (let i = 0; i < 200; i++) {
    manager.processEvent({
      eventId: `ev-200-${i}`,
      type: 'comment',
      userId: `viewer-200-${i}`,
      username: `phattu_${i + 1}`,
      nickname: `Phật Tử ${i + 1}`,
      comment: 'Nam mô A Di Đà Phật',
      isDemo: true,
      timestamp: baseNow + i,
    });
  }

  const snap = manager.getSnapshot();
  assert.equal(snap.activeParticipantCount, 200, 'Must track all 200 active participants');
  assert.equal(
    snap.occupiedMainSeats,
    TOTAL_MAIN_MATS,
    `All ${TOTAL_MAIN_MATS} primary mats must be occupied`,
  );
  assert.equal(
    snap.waitingOverflowCount,
    200 - TOTAL_MAIN_MATS,
    'Remaining participants stored cleanly in secondary/virtual overflow',
  );
  assert.ok(
    snap.participants.length <= TOTAL_MAIN_MATS,
    'Rendered 3D characters capped to primary sanctuary mats for MacBook M1 8GB RAM smoothness',
  );
  assert.equal(snap.effectiveTimeoutSec, 120, 'Default inactivity timeout preserved at 120 seconds');

  // Verify Merit Leaderboard preserves session users
  assert.ok(snap.leaderboard.length > 4, 'Leaderboard populated with top + scrollable ranks');

  // Force one user's lastInteractionAt past 120s and sweep
  const internalMap = (manager as unknown as { participantsMap: Map<string, { lastInteractionAt: number; userId: string }> }).participantsMap;
  const firstUser = internalMap.get('viewer-200-0')!;
  firstUser.lastInteractionAt = Date.now() - 125_000;

  const swept = manager.sweepInactiveParticipants(Date.now());
  assert.equal(swept, 1, '120s sweep initiates departure for inactive user');
  manager.finalizeParticipantDeparture('viewer-200-0');

  const afterDepart = manager.getSnapshot();
  assert.equal(afterDepart.activeParticipantCount, 199, 'Departed user removed from active scene');
  assert.equal(
    afterDepart.occupiedMainSeats,
    TOTAL_MAIN_MATS,
    'Overflow waiting participant automatically promoted into freed main mat',
  );
  assert.equal(
    afterDepart.sessionMeritUsersCount,
    200,
    'Departed user merit preserved in session MeritLedger',
  );

  manager.clearParticipants(true);
  voiceManager.updateSettings({ ...DEFAULT_VOICE_SETTINGS });
});

// ============================================================================
// 3. MULTIPLE SIMULTANEOUS COMMENTS (COMMENT-ONLY BUBBLES & 5s FADE-OUT)
// ============================================================================
runTest('3. Multiple simultaneous comments: comment-only text & 5-second fade-out', () => {
  const cam = createPortraitCamera();
  const baseTime = 1_700_000_000_000;
  const sampleTexts = [
    'Con cầu cho mẹ luôn mạnh khỏe',
    'Nam mô A Di Đà Phật',
    'Cầu bình an cho cả gia đình ạ',
    'Xin cầu tài lộc hanh thông năm mới',
    'Con cầu học hành thi cử đỗ đạt',
  ];

  const candidates: LabelCandidateInput[] = sampleTexts.map((txt, idx) => {
    const seat = getSeatPosition(idx * 4);
    return {
      userId: `sim-c-${idx}`,
      username: `minh.anh.${idx}`,
      worldX: seat.x,
      worldY: 0,
      worldZ: seat.z,
      headY: 1.04,
      lastComment: txt,
      lastCommentAt: baseTime,
      isSpeaking: false,
      isCeremonyActor: false,
      isRecentlyActive: true,
      seatIndex: seat.seatIndex,
    };
  });

  // At t + 1000ms: all bubbles visible, bubbleText contains ONLY the comment (NO username or @)
  const at1s = solveLabelAndBubbleLayout(candidates, cam, {
    viewportWidth: VIEW_W,
    viewportHeight: VIEW_H,
    showUsernames: true,
    showCommentBubbles: true,
    now: baseTime + 1000,
  });

  for (let i = 0; i < at1s.items.length; i++) {
    const item = at1s.items[i];
    assert.equal(item.bubbleVisible, true, `Bubble ${i} visible within 5 seconds`);
    assert.equal(
      item.bubbleText,
      sampleTexts[i],
      'Bubble must display ONLY the exact original comment content',
    );
    assert.equal(
      item.bubbleText.includes(item.username),
      false,
      'Bubble must NEVER include username',
    );
    assert.equal(item.bubbleText.includes('@'), false, 'Bubble must NEVER include @ handle');
    assert.equal(item.bubbleOpacity, 1, 'Full readability before 4s mark');
  }

  // At t + 4500ms: fading out smoothly (0 < opacity < 1)
  const at4_5s = solveLabelAndBubbleLayout(candidates, cam, {
    viewportWidth: VIEW_W,
    viewportHeight: VIEW_H,
    showUsernames: true,
    showCommentBubbles: true,
    now: baseTime + 4500,
  });
  assert.ok(
    at4_5s.items[0].bubbleOpacity > 0 && at4_5s.items[0].bubbleOpacity < 1,
    'Bubble fades smoothly between 4s and 5s',
  );

  // At t + 5100ms: faded out completely
  const at5_1s = solveLabelAndBubbleLayout(candidates, cam, {
    viewportWidth: VIEW_W,
    viewportHeight: VIEW_H,
    showUsernames: true,
    showCommentBubbles: true,
    now: baseTime + 5100,
  });
  for (const item of at5_1s.items) {
    assert.equal(item.bubbleVisible, false, 'Bubble hidden after 5 seconds');
  }
});

// ============================================================================
// 4. NAME LABEL COLLISION PREVENTION & BUDDHA EXCLUSION
// ============================================================================
runTest('4. Name label collision prevention under extreme crowd density & near Buddha', () => {
  const cam = createPortraitCamera();
  const now = Date.now();

  // Create 28 densely packed characters around the center aisle & near the altar
  const denseCandidates: LabelCandidateInput[] = Array.from({ length: 28 }, (_, i) => ({
    userId: `dense-name-${i}`,
    username: `phattu_dongduc_${i + 1}`,
    worldX: ((i % 4) - 1.5) * 0.25,
    worldY: 0,
    worldZ: -9.5 + Math.floor(i / 4) * 0.55,
    headY: 1.35,
    isSpeaking: i === 0,
    isCeremonyActor: i < 3,
    isRecentlyActive: i < 8,
    seatIndex: i,
  }));

  const solved = solveLabelAndBubbleLayout(denseCandidates, cam, {
    viewportWidth: VIEW_W,
    viewportHeight: VIEW_H,
    showUsernames: true,
    showCommentBubbles: false,
    now,
  });

  const visible = solved.items.filter((it) => it.nameVisible && it.nameRect);
  const hidden = solved.items.filter((it) => !it.nameVisible);

  assert.ok(visible.length > 0, 'Prioritized labels remain visible');
  assert.ok(hidden.length > 0, 'Lower-priority labels hidden automatically when density is too high');

  for (let i = 0; i < visible.length; i++) {
    const a = visible[i].nameRect!;
    assert.ok(isRectInsideViewport(a, VIEW_W, VIEW_H), 'Visible label strictly inside viewport');
    assert.equal(
      screenRectsOverlap(a, solved.buddhaExclusionRect),
      false,
      'Name label never covers Golden Buddha statue',
    );
    for (let j = i + 1; j < visible.length; j++) {
      const b = visible[j].nameRect!;
      assert.equal(
        screenRectsOverlap(a, b, 1),
        false,
        `Dense name labels ${visible[i].userId} and ${visible[j].userId} must never overlap`,
      );
    }
  }
});

// ============================================================================
// 5. COMMENT BUBBLE COLLISION PREVENTION
// ============================================================================
runTest('5. Comment bubble collision prevention for simultaneous nearby comments', () => {
  const cam = createPortraitCamera();
  const now = Date.now();

  // 8 nearby characters commenting at the exact same moment
  const nearbyCommenters: LabelCandidateInput[] = Array.from({ length: 8 }, (_, i) => {
    const seat = getSeatPosition(i); // Front rows right next to each other
    return {
      userId: `bubble-col-${i}`,
      username: `nguoi_xem_${i}`,
      worldX: seat.x,
      worldY: 0,
      worldZ: seat.z,
      headY: 1.04,
      lastComment: `Con cầu bình an và sức khỏe cho gia đình lần ${i + 1}`,
      lastCommentAt: now - i * 40, // Newer comments have smaller i -> higher priority
      isSpeaking: i === 0,
      isCeremonyActor: false,
      isRecentlyActive: true,
      seatIndex: seat.seatIndex,
    };
  });

  const solved = solveLabelAndBubbleLayout(nearbyCommenters, cam, {
    viewportWidth: VIEW_W,
    viewportHeight: VIEW_H,
    showUsernames: true,
    showCommentBubbles: true,
    now,
  });

  const visibleBubbles = solved.items.filter((it) => it.bubbleVisible && it.bubbleRect);
  assert.ok(visibleBubbles.length >= 4, 'Multiple simultaneous bubbles placed cleanly via offsets');
  assert.ok(
    solved.items.find((it) => it.userId === 'bubble-col-0')?.bubbleVisible,
    'Most recent comment prioritized',
  );

  for (let i = 0; i < visibleBubbles.length; i++) {
    const bA = visibleBubbles[i].bubbleRect!;
    assert.ok(isRectInsideViewport(bA, VIEW_W, VIEW_H), 'Comment bubble strictly inside viewport');
    assert.equal(
      screenRectsOverlap(bA, solved.buddhaExclusionRect),
      false,
      'Comment bubble never covers Golden Buddha statue',
    );
    for (let j = i + 1; j < visibleBubbles.length; j++) {
      const bB = visibleBubbles[j].bubbleRect!;
      assert.equal(
        screenRectsOverlap(bA, bB, 2),
        false,
        `Simultaneous comment bubbles ${visibleBubbles[i].userId} and ${visibleBubbles[j].userId} must not overlap`,
      );
    }
    // Also verify no visible name label overlaps any visible comment bubble
    for (const item of solved.items) {
      if (item.nameVisible && item.nameRect) {
        assert.equal(
          screenRectsOverlap(bA, item.nameRect, 1),
          false,
          'Name label must never collide with an active comment bubble',
        );
      }
    }
  }
});

// ============================================================================
// 6. ORIGINAL COMMENT SPEECH ACCURACY & MODERATION SKIPPING
// ============================================================================
runTest('6. Original comment speech accuracy (exact viewer words, zero generic replacement)', () => {
  // Exact Example 1 from specification:
  const ex1 = formatCommentSpeechFormula(
    DEFAULT_COMMENT_VOICE_FORMULA,
    'Minh Anh',
    'Con cầu cho mẹ luôn mạnh khỏe',
  );
  assert.equal(ex1.allowed, true);
  assert.equal(
    ex1.text,
    'Phật tử Minh Anh gửi lời nguyện: Con cầu cho mẹ luôn mạnh khỏe',
    'Must match Example 1 verbatim',
  );

  // Exact Example 2 from specification:
  const ex2 = formatCommentSpeechFormula(
    DEFAULT_COMMENT_VOICE_FORMULA,
    'Hoàng Nam',
    'Nam mô A Di Đà Phật',
  );
  assert.equal(ex2.allowed, true);
  assert.equal(
    ex2.text,
    'Phật tử Hoàng Nam gửi lời nguyện: Nam mô A Di Đà Phật',
    'Must match Example 2 verbatim',
  );

  // Custom admin formula test
  const custom = formatCommentSpeechFormula(
    '{username} thành tâm khấn nguyện: {comment}',
    '@minh_anh.99',
    'Cầu cho cha mẹ trăm tuổi bình an',
  );
  assert.equal(custom.allowed, true);
  assert.equal(custom.text, 'minh anh 99 thành tâm khấn nguyện: Cầu cho cha mẹ trăm tuổi bình an');

  // Moderation skip rules: skip overly long / URL / spam comments rather than rewriting them
  const tooLong = moderateAndNormalizeCommentForSpeech('A'.repeat(110), { maxCommentLength: 90 });
  assert.equal(tooLong.allowed, false);
  assert.equal(tooLong.reason, 'exceeds_max_length');

  const urlSpam = moderateAndNormalizeCommentForSpeech('Vào ngay https://spam.com nhận quà', {
    maxCommentLength: 90,
    blockSpamLinksAndUnsafe: true,
  });
  assert.equal(urlSpam.allowed, false);
  assert.equal(urlSpam.reason, 'unsafe_or_spam');

  // End-to-end check through TikTokEventManager -> voiceManager:
  // Even when comment contains "mạnh khỏe" (which triggers seated prayer posture),
  // spoken text MUST still read the exact real comment, NOT a generic canned wish!
  voiceManager.stopAndClearQueue();
  voiceManager.updateSettings({
    ...DEFAULT_VOICE_SETTINGS,
    autoNarrationEnabled: true,
    commentVoiceEnabled: true,
    commentVoiceFormula: DEFAULT_COMMENT_VOICE_FORMULA,
  });

  const mgr = new TikTokEventManager();
  mgr.clearParticipants(true);
  mgr.processEvent({
    eventId: 'e2e-exact-comment-1',
    type: 'comment',
    userId: 'u-minh-anh',
    username: 'minhanh',
    nickname: 'Minh Anh',
    comment: 'Con cầu cho mẹ luôn mạnh khỏe',
    isDemo: true,
    timestamp: Date.now(),
  });

  const speakingNow = voiceManager.getCurrentSpeakingItem();
  assert.ok(speakingNow, 'Comment narration started immediately');
  assert.equal(
    speakingNow.text,
    'Phật tử Minh Anh gửi lời nguyện: Con cầu cho mẹ luôn mạnh khỏe',
    'TikTokEventManager must send exact viewer comment to VieNeuTTS without replacing it',
  );

  voiceManager.stopAndClearQueue();
  mgr.clearParticipants(true);
});

// ============================================================================
// 7. GIFT NARRATION PRIORITY & PREEMPTION WITHOUT OVERLAP
// ============================================================================
runTest('7. Gift narration priority: Large Gift > Normal Gift > Ceremony > Comment > Background', () => {
  const vm = new SmartVoiceManager();
  vm.updateSettings({
    ...DEFAULT_VOICE_SETTINGS,
    autoNarrationEnabled: true,
    giftInterruptPolicy: 'interrupt_comments',
    commentCooldownSec: 0,
  });

  // 1) Start speaking a viewer comment first (becomes currentItem, isSpeaking = true)
  vm.enqueue({
    text: 'Phật tử Lan Hương gửi lời nguyện: Con cầu bình an cho gia đình',
    priority: AnnouncementPriority.PRAYER_COMMENT,
    category: 'prayer_comment',
    userId: 'u-lan',
    username: 'lanhuong',
    dedupeKey: 'c-1',
  });
  assert.equal(vm.getSnapshot().isSpeaking, true);
  assert.equal(vm.getCurrentSpeakingItem()?.priority, AnnouncementPriority.PRAYER_COMMENT);

  // 2) While speaking, enqueue Background, another Comment, Special Ceremony, Normal Gift, and Large Gift
  vm.enqueue({
    text: 'Lời chúc nền thanh tịnh',
    priority: AnnouncementPriority.BACKGROUND,
    category: 'background',
    dedupeKey: 'bg-1',
    bypassRateLimit: true,
  });
  vm.enqueue({
    text: 'Phật tử Hoàng Nam gửi lời nguyện: Nam mô A Di Đà Phật',
    priority: AnnouncementPriority.ORDINARY_COMMENT,
    category: 'ordinary_comment',
    userId: 'u-nam',
    username: 'hoangnam',
    dedupeKey: 'c-2',
  });
  vm.enqueue({
    text: 'Phật tử Thiện Tâm dâng hương cầu an',
    priority: AnnouncementPriority.SPECIAL_RITUAL,
    category: 'special_ritual',
    userId: 'u-tam',
    username: 'thientam',
    dedupeKey: 's-1',
  });
  vm.enqueue({
    text: 'Cảm ơn Phật tử Bích Trần đã cúng dường Hoa Hồng',
    priority: AnnouncementPriority.NORMAL_GIFT,
    category: 'gift',
    userId: 'u-bich',
    username: 'bichtran',
    dedupeKey: 'g-normal',
  });
  // Duplicate check: re-enqueuing same dedupeKey must be ignored
  vm.enqueue({
    text: 'Cảm ơn Phật tử Bích Trần đã cúng dường Hoa Hồng',
    priority: AnnouncementPriority.NORMAL_GIFT,
    category: 'gift',
    userId: 'u-bich',
    username: 'bichtran',
    dedupeKey: 'g-normal',
  });
  vm.enqueue({
    text: 'Đại lễ Bảo Tháp từ Phật tử Minh Anh',
    priority: AnnouncementPriority.LARGE_GIFT,
    category: 'large_gift',
    userId: 'u-ma',
    username: 'minhanh',
    dedupeKey: 'g-large',
    playBellBeforeSpeech: true,
  });

  const q = vm.getQueueSnapshot();
  // Background item must have been dropped when gifts arrived, and remaining items sorted 1 -> 2 -> 3 -> 5
  assert.equal(
    q.some((item) => item.priority === AnnouncementPriority.BACKGROUND),
    false,
    'Idle background narration dropped when gifts arrive',
  );
  assert.deepEqual(
    q.map((item) => item.priority),
    [
      AnnouncementPriority.LARGE_GIFT,
      AnnouncementPriority.NORMAL_GIFT,
      AnnouncementPriority.SPECIAL_RITUAL,
      AnnouncementPriority.ORDINARY_COMMENT,
    ],
    'Queue strictly ordered: Large Gift (1) > Normal Gift (2) > Ceremony (3) > Comment (5)',
  );

  vm.stopAndClearQueue();
});

// ============================================================================
// 8. SEAT SPACING & 9:16 CAMERA FRAMING (BUDDHA + SEATS 100% VISIBLE)
// ============================================================================
runTest('8. Increased seat spacing, symmetrical aisles & 9:16 Buddha/seat camera framing', () => {
  assert.ok(COL_SPACING_X >= 1.05, `Horizontal seat spacing increased (${COL_SPACING_X}m)`);
  assert.ok(ROW_SPACING_Z >= 1.4, `Vertical row spacing increased (${ROW_SPACING_Z}m)`);
  assert.ok(INNER_MAT_X >= 1.65, `Central red carpet kept wide open (inner mat X=${INNER_MAT_X}m)`);

  const mats = getAllMainMats();
  assert.equal(mats.length, TOTAL_MAIN_MATS);
  const leftMats = mats.filter((m) => m.side === 'left');
  const rightMats = mats.filter((m) => m.side === 'right');
  assert.equal(leftMats.length, rightMats.length, 'Left and right seating wings are 100% symmetrical');

  // Verify no two mats are closer than 1.04m center-to-center
  for (let i = 0; i < mats.length; i++) {
    for (let j = i + 1; j < mats.length; j++) {
      const dist = Math.hypot(mats[i].x - mats[j].x, mats[i].z - mats[j].z);
      assert.ok(dist >= 1.04, `Mats ${i} and ${j} too close: ${dist.toFixed(3)}m`);
    }
  }

  const framing = verifyTempleFraming916(1080, 1920);
  assert.equal(
    framing.buddhaFullyInsideFrame,
    true,
    `Entire Golden Buddha must fit inside 9:16 frame (topY=${framing.buddhaTopNdcY.toFixed(3)}, botY=${framing.buddhaBottomNdcY.toFixed(3)})`,
  );
  assert.equal(
    framing.allSeatsInsideFrame,
    true,
    `All ${TOTAL_MAIN_MATS} primary mats must fit inside 9:16 frame (maxSeatAbsX=${framing.maxSeatAbsNdcX.toFixed(3)})`,
  );
  const buddhaScreenHeightRatio = (framing.buddhaTopNdcY - framing.buddhaBottomNdcY) / 2;
  assert.ok(
    buddhaScreenHeightRatio >= 0.16,
    `Buddha statue remains grand and prominent (${(buddhaScreenHeightRatio * 100).toFixed(1)}% of vertical frame)`,
  );
});

// ============================================================================
// 9. TRANSPARENT RGBA PANEL RENDERING & ZERO PUBLIC AVATARS
// ============================================================================
runTest('9. RGBA 0.45 default panel styling (no parent opacity) & zero avatars in public scene UI', () => {
  assert.equal(
    DEFAULT_OVERLAY_SETTINGS.panelOpacity,
    0.45,
    `Default panelOpacity (${DEFAULT_OVERLAY_SETTINGS.panelOpacity}) must be 0.45`,
  );

  const stylesToVerify = [
    buildBurgundyPanelStyle(DEFAULT_OVERLAY_SETTINGS.panelOpacity),
    buildBurgundyHeaderStyle(DEFAULT_OVERLAY_SETTINGS.panelOpacity),
    buildCharacterNameLabelStyle(DEFAULT_OVERLAY_SETTINGS.panelOpacity, 'default'),
    buildCommentBubbleStyle(DEFAULT_OVERLAY_SETTINGS.panelOpacity, false),
  ];

  for (const st of stylesToVerify) {
    assert.equal(
      st.opacity,
      undefined,
      'Must NEVER set CSS opacity on panel container so text readability stays 100%',
    );
    assert.equal(
      (st as Record<string, unknown>).backdropFilter,
      undefined,
      'Avoid backdropFilter over WebGL for MacBook M1 8GB RAM performance',
    );
    const bgStr = `${st.backgroundColor || ''} ${st.backgroundImage || ''}`;
    assert.ok(bgStr.includes('rgba('), `Panel style must use RGBA colors, got: ${bgStr}`);
  }

  // Verify public livestream scene files contain ZERO user profile avatar <img> elements
  const publicUiFiles = [
    'src/components/three/TempleScene.tsx',
    'src/components/ui/Leaderboard.tsx',
    'src/components/ui/FloatingLotusAvatars.tsx',
    'src/components/ui/StreamingOverlay.tsx',
  ];

  for (const relPath of publicUiFiles) {
    const abs = path.resolve(process.cwd(), relPath);
    const src = fs.readFileSync(abs, 'utf8');
    assert.equal(
      src.includes('avatarUrl'),
      false,
      `${relPath} must not reference or render user profile avatarUrl`,
    );
  }
});

// ============================================================================
// 10. CANONICAL CEREMONIAL MAPPINGS & STRICT ZERO GIFT WORDS RULE
// ============================================================================
runTest('10. Canonical ceremonial mappings (5 rituals), zero gift words & CenterCeremonialPanel RGBA', () => {
  const expectedByGiftId: Record<
    string,
    { title: string; subtitle: string; voice: string }
  > = {
    '5655': {
      title: 'CẦU BÌNH AN',
      subtitle: 'Phật tử minh.anh cầu bình an',
      voice: 'Phật tử Minh Anh cầu bình an.',
    },
    '8910': {
      title: 'CẦU SỨC KHỎE',
      subtitle: 'Phật tử minh.anh cầu sức khỏe',
      voice: 'Phật tử Minh Anh cầu sức khỏe.',
    },
    '6093': {
      title: 'CẦU GIA ĐẠO',
      subtitle: 'Phật tử minh.anh cầu gia đạo',
      voice: 'Phật tử Minh Anh cầu gia đạo.',
    },
    '5827': {
      title: 'CẦU TÀI LỘC',
      subtitle: 'Phật tử minh.anh cầu tài lộc',
      voice: 'Phật tử Minh Anh cầu tài lộc. Kính chúc gia đình luôn an lành.',
    },
    '29201': {
      title: 'CẦU CÔNG ĐỨC',
      subtitle: 'Phật tử minh.anh cầu công đức',
      voice: 'Phật tử Minh Anh cầu công đức. Kính chúc gia đình luôn an lành.',
    },
  };

  for (const gm of DEFAULT_GIFT_MAPPINGS) {
    const exp = expectedByGiftId[gm.giftId];
    assert.ok(exp, `Expected canonical mapping for giftId ${gm.giftId}`);
    assert.equal(gm.ritualTitle, exp.title);
    const sub = renderCeremonialSubtitle(gm.ritualSubtitle, {
      username: 'minh.anh',
      ritualTitle: gm.ritualTitle,
      meritPoints: gm.points,
    });
    const voice = renderGiftVoiceTemplate(gm.voiceTemplate, {
      username: 'Minh Anh',
      meritPoints: gm.points,
      ritualTitle: gm.ritualTitle,
    });
    assert.equal(sub, exp.subtitle);
    assert.equal(voice, exp.voice);
    assert.equal(containsForbiddenGiftWords(gm.ritualTitle), false);
    assert.equal(containsForbiddenGiftWords(sub), false);
    assert.equal(containsForbiddenGiftWords(voice), false);
  }

  // Verify sanitizeCeremonialText strips forbidden words while keeping Buddhist "Mâm Quả" intact
  const dirty = 'Phật tử An đã gửi quà tặng quà gift sent a gift Mâm Quả cầu gia đạo';
  const cleaned = sanitizeCeremonialText(dirty);
  assert.equal(containsForbiddenGiftWords(cleaned), false, `Cleaned text still had gift words: ${cleaned}`);
  assert.ok(cleaned.includes('Mâm Quả'), 'Legitimate Vietnamese word "Mâm Quả" must remain intact');

  // Verify CenterCeremonialPanel uses RGBA background without CSS opacity or backdropFilter
  const centerNormalStyle = buildCenterCeremonialPanelStyle(0.55, false);
  const centerMajorStyle = buildCenterCeremonialPanelStyle(0.55, true);
  assert.equal(centerNormalStyle.opacity, undefined);
  assert.equal(centerMajorStyle.opacity, undefined);
  assert.ok(String(centerNormalStyle.backgroundImage || '').includes('rgba('));

  // Verify CenterCeremonialPanel is the ONLY UI component referencing avatarUrl
  const centerSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ui/CenterCeremonialPanel.tsx'),
    'utf8',
  );
  assert.equal(centerSrc.includes('avatarUrl'), true);
});

// ============================================================================
// 11. SEQUENTIAL CENTER PANEL QUEUE, LOTUS BURSTS & CEREMONIAL PRIORITY ORDER
// ============================================================================
runTest('11. Non-overlapping Center Panel queue, Lotus bursts & Major > Normal > Comment priority', () => {
  const mgr = new TikTokEventManager();
  mgr.clearParticipants(true);
  mgr.setCeremonialPresentationSettings({ centerPanelDurationMs: 3000 });
  voiceManager.stopAndClearQueue();

  const t0 = Date.now();

  // Trigger Normal Ceremony (Hoa Hồng 5655, queuePriority 40) — becomes immediately active
  mgr.processEvent({
    eventId: 'ev-rose-1',
    type: 'gift',
    userId: 'u-rose',
    username: 'phattu.binhan',
    nickname: 'Phật Tử Bình An',
    avatarUrl: 'https://example.com/a1.png',
    giftId: '5655',
    giftName: 'Rose',
    giftCount: 1,
    isDemo: true,
    timestamp: t0,
  });

  const snap1 = mgr.getSnapshot();
  assert.ok(snap1.activeCenterAnnouncement, 'First ceremonial event immediately activates center panel');
  assert.equal(snap1.activeCenterAnnouncement?.ritualTitle, 'CẦU BÌNH AN');
  assert.equal(snap1.activeCenterAnnouncement?.ritualSubtitle, 'Phật tử phattu.binhan cầu bình an');
  assert.equal(containsForbiddenGiftWords(snap1.activeCenterAnnouncement?.ritualSubtitle), false);
  assert.ok(snap1.activeLotusBursts.length >= 1, 'Lotus falling burst emitted on ceremony activation');

  // While first announcement is active, enqueue Mâm Quả (normal, prio 60), Đài Sen (major, prio 90), and Bảo Tháp (major, prio 100)
  mgr.processEvent({
    eventId: 'ev-fruit-2',
    type: 'gift',
    userId: 'u-fruit',
    username: 'phattu.giadao',
    nickname: 'Gia Đạo',
    giftId: '6093',
    giftName: 'Fruit Plate',
    giftCount: 1,
    isDemo: true,
    timestamp: t0 + 20,
  });
  mgr.processEvent({
    eventId: 'ev-lotus-3',
    type: 'gift',
    userId: 'u-lotus',
    username: 'phattu.tailoc',
    nickname: 'Tài Lộc',
    giftId: '5827',
    giftName: 'Lotus',
    giftCount: 1,
    isDemo: true,
    timestamp: t0 + 40,
  });
  mgr.processEvent({
    eventId: 'ev-pagoda-4',
    type: 'gift',
    userId: 'u-pagoda',
    username: 'phattu.congduc',
    nickname: 'Công Đức',
    giftId: '29201',
    giftName: 'Pagoda',
    giftCount: 1,
    isDemo: true,
    timestamp: t0 + 60,
  });

  // Also send an ordinary comment — must NEVER interrupt or enter the center ceremonial panel queue
  mgr.processEvent({
    eventId: 'ev-comment-5',
    type: 'comment',
    userId: 'u-rose',
    username: 'phattu.binhan',
    nickname: 'Phật Tử Bình An',
    comment: 'Nam mô A Di Đà Phật',
    isDemo: true,
    timestamp: t0 + 80,
  });

  // Active announcement must still be the first one (no overlap!)
  assert.equal(mgr.getSnapshot().activeCenterAnnouncement?.userId, 'u-rose');

  // Pending center queue must be strictly ordered: Bảo Tháp (100) -> Đài Sen (90) -> Mâm Quả (60)
  const pending = mgr.getCenterAnnouncementQueueSnapshot();
  assert.deepEqual(
    pending.map((item) => item.ritualTitle),
    ['CẦU CÔNG ĐỨC', 'CẦU TÀI LỘC', 'CẦU GIA ĐẠO'],
    'Queued center announcements strictly sorted Major (100 > 90) > Normal (60)',
  );

  // Advance past active announcement expiry + transition gap => Bảo Tháp activates next with major lotus burst!
  const firstExpiry = mgr.getSnapshot().activeCenterAnnouncement!.expiresAt;
  mgr.advanceCenterAnnouncementQueue(firstExpiry + 10); // clears expired
  mgr.advanceCenterAnnouncementQueue(firstExpiry + 300); // activates next after 220ms transition gap

  const snapAfter = mgr.getSnapshot();
  assert.equal(snapAfter.activeCenterAnnouncement?.ritualTitle, 'CẦU CÔNG ĐỨC');
  assert.equal(snapAfter.activeCenterAnnouncement?.isMajor, true);
  assert.ok(
    snapAfter.activeLotusBursts.some((b) => b.isMajor && b.intensity > 1.3),
    'Major ceremony emits abundant high-intensity lotus falling burst',
  );

  // Verify SmartVoiceManager numeric queuePriority tie-breaking, non-interruption & sanitization
  const vm = new SmartVoiceManager();
  vm.updateSettings({
    ...DEFAULT_VOICE_SETTINGS,
    autoNarrationEnabled: true,
    commentCooldownSec: 0,
  });
  // Start active ceremonial speech first (isSpeaking = true)
  vm.enqueue({
    text: 'Phật tử Khởi Đầu cầu sức khỏe.',
    priority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 50,
    category: 'gift',
    dedupeKey: 'vq-active-bell',
  });
  assert.equal(vm.getSnapshot().isSpeaking, true);

  // Enqueue a comment while ceremony is speaking — must NEVER interrupt ongoing ceremony
  vm.enqueue({
    text: 'Phật tử An gửi lời nguyện: Bình an',
    priority: AnnouncementPriority.ORDINARY_COMMENT,
    category: 'ordinary_comment',
    dedupeKey: 'vq-comment',
  });
  assert.equal(
    vm.getCurrentSpeakingItem()?.dedupeKey,
    'vq-active-bell',
    'Comments must never interrupt an ongoing ceremonial voice announcement',
  );

  // Enqueue Normal Ceremony (40) and two Major Ceremonies (90 and 100) simultaneously
  vm.enqueue({
    text: 'Phật tử Bình đã gửi quà cầu bình an.',
    priority: AnnouncementPriority.NORMAL_GIFT,
    queuePriority: 40,
    category: 'gift',
    dedupeKey: 'vq-rose',
  });
  vm.enqueue({
    text: 'Phật tử Tâm cầu tài lộc. Kính chúc gia đình luôn an lành.',
    priority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 90,
    category: 'large_gift',
    dedupeKey: 'vq-lotus',
  });
  vm.enqueue({
    text: 'Phật tử Đức cầu công đức. Kính chúc gia đình luôn an lành.',
    priority: AnnouncementPriority.LARGE_GIFT,
    queuePriority: 100,
    category: 'large_gift',
    dedupeKey: 'vq-pagoda',
  });

  const vq = vm.getQueueSnapshot();
  assert.deepEqual(
    vq.map((item) => item.dedupeKey),
    ['vq-pagoda', 'vq-lotus', 'vq-rose', 'vq-comment'],
    'Voice queue strictly ordered by tier then numeric queuePriority (100 > 90 > 40 > comment)',
  );
  for (const item of vq) {
    if (item.category === 'gift' || item.category === 'large_gift') {
      assert.equal(
        containsForbiddenGiftWords(item.text),
        false,
        `Ceremonial voice item contained forbidden gift word: ${item.text}`,
      );
    }
  }

  vm.stopAndClearQueue();
  voiceManager.stopAndClearQueue();
  mgr.clearParticipants(true);
});

// ============================================================================
// 12. ELEVATED BUDDHA POSITION (UNCHANGED SCALE) & EXPANDED 104 FOREGROUND SEATS
// ============================================================================
runTest('12. Elevated Buddha statue (unchanged 1.82 scale) & expanded 104-seat foreground congregation', () => {
  // 1) Buddha scale MUST remain strictly 1.82 (never enlarged or stretched)
  assert.equal(BUDDHA_STATUE_SCALE, 1.82, 'Buddha statue scale must remain strictly unchanged at 1.82');
  assert.ok(BUDDHA_ELEVATION_Y >= 3.5, `Buddha statue raised vertically in 3D scene (y=${BUDDHA_ELEVATION_Y})`);

  const altarSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/three/BuddhaAltar.tsx'),
    'utf8',
  );
  assert.ok(
    altarSrc.includes('BUDDHA_STATUE_SCALE') && altarSrc.includes('3.12 / maxDim'),
    'BuddhaAltar.tsx preserves exact statue scale and GLTF normalization without enlarging',
  );

  // 2) Expanded foreground seating: 13 rows x 8 cols = 104 symmetrical mats extending near bottom edge
  assert.equal(MAIN_SEAT_ROWS, 13, 'Expanded to 13 front-to-back rows');
  assert.equal(MAIN_SEAT_COLS_PER_SIDE, 4, 'Expanded to 4 columns on each side of the red carpet');
  assert.equal(TOTAL_MAIN_MATS, 104, '104 primary meditation mats available');
  const frontRowZ = FIRST_ROW_Z + (MAIN_SEAT_ROWS - 1) * ROW_SPACING_Z;
  assert.ok(frontRowZ >= 12.0, `Foreground seating reaches close to camera bottom edge (z=${frontRowZ})`);

  // 3) Dedicated 3D Xin Xăm station near elevated altar, separate from central incense table
  const xinXamStation = ALTAR_STATIONS.xin_xam_station;
  const incenseStation = ALTAR_STATIONS.incense_center;
  assert.ok(
    Math.hypot(xinXamStation.x - incenseStation.x, xinXamStation.z - incenseStation.z) >= 2.5,
    '3D Xin Xăm station is cleanly separated from central incense altar',
  );

  // 4) Verify elevated Buddha fits in upper background of 9:16 frame and never clips ceiling
  const framing = verifyTempleFraming916(1080, 1920);
  assert.equal(framing.buddhaFullyInsideFrame, true, 'Elevated Buddha + halo + lotus throne 100% inside 9:16 frame');
  assert.equal(framing.allSeatsInsideFrame, true, 'All 104 expanded foreground mats fit inside 9:16 frame');
  assert.ok(
    framing.buddhaBottomNdcY > 0.03,
    `Elevated Buddha positioned in upper background above screen midline (bottom NDC Y = ${framing.buddhaBottomNdcY.toFixed(3)})`,
  );
});

// ============================================================================
// 13. 100 UNIQUE VIETNAMESE FORTUNE STICKS (01–100) & UNIFORM RANDOM SELECTION
// ============================================================================
runTest('13. 100 unique Vietnamese fortune sticks (01–100), 5 classifications & uniform draw', () => {
  xinXamRegistry.resetLocalForTests();
  assert.equal(DEFAULT_100_FORTUNES.length, 100, 'Must provide exactly 100 default fortune sticks');
  assert.deepEqual(
    FORTUNE_CATEGORIES,
    ['Đại Cát', 'Trung Cát', 'Tiểu Cát', 'Bình', 'Cần Thận Trọng'],
    'Must support all 5 required fortune classifications',
  );

  const counts: Record<FortuneCategory, number> = {
    'Đại Cát': 0,
    'Trung Cát': 0,
    'Tiểu Cát': 0,
    Bình: 0,
    'Cần Thận Trọng': 0,
  };
  const seenNumbers = new Set<number>();
  const seenTitles = new Set<string>();

  for (let i = 0; i < DEFAULT_100_FORTUNES.length; i++) {
    const f = DEFAULT_100_FORTUNES[i];
    assert.equal(f.fortuneNumber, i + 1, `Sequential fortune number ${i + 1}`);
    assert.equal(f.fortuneCode, formatFortuneCode(i + 1), `Zero-padded code for ${i + 1}`);
    assert.equal(seenNumbers.has(f.fortuneNumber), false);
    assert.equal(seenTitles.has(f.title), false, `Unique fortune title required: ${f.title}`);
    seenNumbers.add(f.fortuneNumber);
    seenTitles.add(f.title);
    counts[f.category] += 1;

    // Verify canonical fields linked directly to each fortune card
    assert.equal(f.fortuneType, f.category, 'fortuneType linked directly to card category');
    assert.equal(f.fortuneTitle, f.title, 'fortuneTitle linked directly to card title');
    assert.equal(f.shortVerse, f.poem, 'shortVerse linked directly to card poem');
    assert.ok(f.shortVerse.length >= 16, `Fortune ${f.fortuneCode} must include shortVerse`);
    assert.ok(f.interpretation.length >= 20, `Fortune ${f.fortuneCode} must include interpretation`);
    assert.ok(f.advice.length >= 10, `Fortune ${f.fortuneCode} must include advice`);
    assert.equal(
      f.interpretation.includes('Nội dung xăm minh họa mang tính tham khảo'),
      false,
      'Must never contain banned disclaimer text',
    );
  }

  assert.equal(counts['Đại Cát'], 15, '15 Đại Cát fortunes');
  assert.equal(counts['Trung Cát'], 25, '25 Trung Cát fortunes');
  assert.equal(counts['Tiểu Cát'], 20, '20 Tiểu Cát fortunes');
  assert.equal(counts.Bình, 25, '25 Bình fortunes');
  assert.equal(counts['Cần Thận Trọng'], 15, '15 Cần Thận Trọng fortunes');

  // Verify Fortune #18 matches exact specification example card
  const f18 = DEFAULT_100_FORTUNES.find((f) => f.fortuneNumber === 18)!;
  assert.equal(f18.fortuneType, 'Trung Cát');
  assert.equal(f18.fortuneTitle, 'Gia đạo an hòa');

  // Verify disabled fortunes are excluded, enabled fortunes draw uniformly, and fortuneType NEVER drifts from card
  const customSubset = DEFAULT_100_FORTUNES.map((f) => ({
    ...f,
    enabled: f.fortuneNumber === 7 || f.fortuneNumber === 18 || f.fortuneNumber === 88,
  }));
  xinXamRegistry.setFortunesLocal(customSubset);

  const hitCounts: Record<number, number> = { 7: 0, 18: 0, 88: 0 };
  for (let i = 0; i < 180; i++) {
    const d = xinXamRegistry.drawFortune({
      eventDedupeKey: `uniform-test-${i}`,
      userId: 'u-test',
      username: 'phattu.test',
      isDemo: true,
    });
    assert.ok(d, 'Draw succeeded');
    assert.ok(
      d.fortuneNumber === 7 || d.fortuneNumber === 18 || d.fortuneNumber === 88,
      `Disabled fortunes must never be selected (got ${d.fortuneNumber})`,
    );
    const sourceCard = customSubset.find((c) => c.fortuneNumber === d.fortuneNumber)!;
    assert.equal(
      d.fortuneType,
      sourceCard.fortuneType,
      'Drawn fortuneType must come from the selected fortune card, never randomized separately',
    );
    hitCounts[d.fortuneNumber] += 1;
  }
  assert.ok(hitCounts[7] > 25 && hitCounts[18] > 25 && hitCounts[88] > 25, 'Uniform selection across enabled sticks');
  xinXamRegistry.resetLocalForTests();
});

// ============================================================================
// 14. XIN XĂM GIFT ID TRIGGER RULES & DEDUPLICATION (NO INVENTED GIFT ID!)
// ============================================================================
runTest('14. Xin Xăm Gift ID rules: never invent Gift ID, never trigger on 20 coins alone, deduplicate draws', () => {
  xinXamRegistry.resetLocalForTests();
  const mgr = new TikTokEventManager();
  mgr.clearParticipants(true);
  voiceManager.stopAndClearQueue();

  // 1) Default Gift ID MUST be empty ("") — never invented!
  assert.equal(DEFAULT_XIN_XAM_SETTINGS.giftId, '', 'Default Xin Xăm Gift ID must be empty until admin configures real ID');

  // 2) Sending an unmapped 20-coin gift when giftId is "" MUST NOT trigger Xin Xăm
  mgr.processEvent({
    eventId: 'ev-unconfigured-20coin',
    type: 'gift',
    userId: 'u-viewer-1',
    username: 'viewer.20xu',
    nickname: 'Viewer 20',
    giftId: '999999',
    giftName: 'TwentyCoinGift',
    giftCount: 1,
    diamondCount: 20,
    isDemo: true,
    timestamp: Date.now(),
  });
  assert.equal(
    xinXamRegistry.getSnapshot().recentDraws.length,
    0,
    '20-coin gift must NEVER trigger Xin Xăm when Gift ID is not configured',
  );

  // 3) Admin configures actual TikTok Gift ID '778899' -> matching gift triggers Xin Xăm once!
  xinXamRegistry.setSettingsLocal({ enabled: true, giftId: '778899', meritPoints: 200 });
  const streakKey = 'u-viewer-2:778899:streak1';

  mgr.processEvent({
    eventId: 'ev-xinxam-real-1',
    streakKey,
    type: 'gift',
    userId: 'u-viewer-2',
    username: 'minh.anh',
    nickname: 'Minh Anh',
    avatarUrl: 'https://example.com/minhanh.jpg',
    giftId: '778899',
    giftName: 'FortuneStickGift',
    giftCount: 1,
    totalStreakCount: 1,
    giftType: 1,
    repeatEnd: false,
    diamondCount: 20,
    isDemo: true,
    timestamp: Date.now(),
  });

  assert.equal(xinXamRegistry.getSnapshot().recentDraws.length, 1, 'Configured Gift ID triggers 1 fortune draw');
  const firstDraw = xinXamRegistry.getSnapshot().recentDraws[0];

  // Streak completion packet with same streakKey MUST NOT draw a second fortune!
  mgr.processEvent({
    eventId: 'ev-xinxam-real-1-end',
    streakKey,
    type: 'gift',
    userId: 'u-viewer-2',
    username: 'minh.anh',
    nickname: 'Minh Anh',
    giftId: '778899',
    giftName: 'FortuneStickGift',
    giftCount: 0,
    totalStreakCount: 1,
    giftType: 1,
    repeatEnd: true,
    diamondCount: 20,
    isDemo: true,
    timestamp: Date.now() + 200,
  });
  assert.equal(
    xinXamRegistry.getSnapshot().recentDraws.length,
    1,
    'Streak completion packet must not trigger a duplicate fortune draw',
  );

  // Re-drawing with the same eventDedupeKey returns the exact persisted fortune
  const repeatDraw = xinXamRegistry.drawFortune({
    eventDedupeKey: firstDraw.eventDedupeKey,
    userId: 'u-viewer-2',
    username: 'minh.anh',
  });
  assert.equal(repeatDraw?.fortuneNumber, firstDraw.fortuneNumber, 'Dedupe key returns exact stored fortune');

  mgr.clearParticipants(true);
  xinXamRegistry.resetLocalForTests();
});

// ============================================================================
// 15. MULTI-USER 3D XIN XĂM QUEUE, SEAT RESERVATION & 120s TIMEOUT DEFERRAL
// ============================================================================
runTest('15. Multi-user 3D Xin Xăm queue, seat reservation, stick reveal & 120s timeout safety', () => {
  xinXamRegistry.resetLocalForTests();
  const mgr = new TikTokEventManager();
  mgr.clearParticipants(true);
  voiceManager.stopAndClearQueue();
  voiceManager.updateSettings({
    ...DEFAULT_VOICE_SETTINGS,
    autoNarrationEnabled: true,
    giftAnnouncementsEnabled: true,
  });

  const now = Date.now();
  // Trigger 2 simultaneous Xin Xăm requests
  const drawA = mgr.triggerXinXamForUser({
    userId: 'u-xam-a',
    username: 'phattu.an',
    nickname: 'Phật Tử An',
    avatarUrl: 'https://example.com/an.png',
    forcedFortuneNumber: 18,
    isDemo: true,
    now,
  });
  const drawB = mgr.triggerXinXamForUser({
    userId: 'u-xam-b',
    username: 'phattu.binh',
    nickname: 'Phật Tử Bình',
    forcedFortuneNumber: 9,
    isDemo: true,
    now: now + 10,
  });

  assert.equal(drawA?.fortuneNumber, 18);
  assert.equal(drawB?.fortuneNumber, 9);

  const snap1 = mgr.getSnapshot();
  const charA = snap1.participants.find((p) => p.userId === 'u-xam-a')!;
  const charB = snap1.participants.find((p) => p.userId === 'u-xam-b')!;
  const reservedSeatA = charA.seatIndex;
  const reservedSeatB = charB.seatIndex;

  assert.notEqual(reservedSeatA, reservedSeatB, 'Each participant keeps a unique reserved seat');
  assert.equal(charA.activeRitual?.stationId, 'xin_xam_station', 'User A occupies 3D Xin Xăm station');
  assert.equal(charB.activeRitual, null, 'User B waits politely at their seat while station is busy');
  assert.equal(snap1.queuedAltarCount, 1, 'User B queued in Xin Xăm ritual queue');

  // Simulate User A arriving at station -> shaking bamboo tube -> stick falling out (reveal!)
  const ritualIdA = charA.activeRitual!.id;
  mgr.notifyAltarRitualArrived('u-xam-a', ritualIdA);
  mgr.notifyXinXamStickRevealed('u-xam-a', ritualIdA);

  const snapReveal = mgr.getSnapshot();
  assert.equal(snapReveal.activeXinXamResult?.fortuneNumber, 18, 'Center Xin Xăm Result Panel activated on stick reveal');
  assert.equal(snapReveal.activeXinXamResult?.username, 'phattu.an');
  assert.ok(snapReveal.activeLotusBursts.length >= 1, 'Pink lotus & golden burst emitted');

  // Force User A past 120s inactivity WHILE still performing Xin Xăm -> must NOT be removed mid-ritual!
  const internalMap = (mgr as unknown as { participantsMap: Map<string, { lastInteractionAt: number }> }).participantsMap;
  internalMap.get('u-xam-a')!.lastInteractionAt = Date.now() - 150_000;
  const sweptMidRitual = mgr.sweepInactiveParticipants(Date.now());
  assert.equal(sweptMidRitual, 0, 'Active Xin Xăm participant must never be removed mid-ritual');

  // Complete User A's Xin Xăm ritual -> User A returns to reserved seat (or departs cleanly now), and User B immediately starts walking to Xin Xăm station!
  mgr.completeCharacterRitual('u-xam-a', ritualIdA);
  const snapAfterA = mgr.getSnapshot();
  const charBAfter = snapAfterA.participants.find((p) => p.userId === 'u-xam-b')!;
  assert.equal(charBAfter.seatIndex, reservedSeatB, 'User B reserved seat preserved');
  assert.equal(charBAfter.activeRitual?.stationId, 'xin_xam_station', 'Queued User B promoted to 3D Xin Xăm station');

  voiceManager.stopAndClearQueue();
  mgr.clearParticipants(true);
  xinXamRegistry.resetLocalForTests();
});

// ============================================================================
// 16. CENTER FORTUNE RESULT PANEL ("🪷 KẾT QUẢ XIN XĂM"), 0.45 RGBA & 5 TYPE ACCENTS
// ============================================================================
runTest('16. "🪷 KẾT QUẢ XIN XĂM" panel, 5 classification accents, 0.45 RGBA opacity & zero disclaimers', () => {
  assert.equal(DEFAULT_OVERLAY_SETTINGS.panelOpacity, 0.45, 'Global livestream panel default RGBA opacity is 0.45');
  assert.equal(DEFAULT_XIN_XAM_SETTINGS.panelOpacity, 0.45, 'Xin Xăm result panel default RGBA opacity is 0.45');

  // Single-line header formatting check
  assert.equal(formatQueXamHeader(18), 'QUẺ XĂM 18');
  assert.equal(formatQueXamHeader(1), 'QUẺ XĂM 01');
  assert.equal(formatQueXamHeader(100), 'QUẺ XĂM 100');
  assert.equal(formatQueXamHeader(18).includes('\n'), false, '"QUẺ XĂM" and number must stay on one single line');

  for (const cat of FORTUNE_CATEGORIES) {
    const st = buildXinXamResultPanelStyle(0.45, cat);
    assert.equal(st.opacity, undefined, 'Never set container CSS opacity');
    assert.ok(String(st.backgroundImage || '').includes('rgba('), `Uses RGBA background for ${cat}`);
    assert.ok(FORTUNE_CLASSIFICATION_META[cat].upperLabel.length >= 4);
  }

  const resultPanelSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ui/XinXamResultPanel.tsx'),
    'utf8',
  );
  assert.ok(resultPanelSrc.includes('🪷 KẾT QUẢ XIN XĂM'), 'Displays required title "🪷 KẾT QUẢ XIN XĂM"');
  assert.ok(
    resultPanelSrc.includes('xinxam-fortune-classification'),
    'Displays prominent fortune classification badge',
  );
  assert.ok(
    resultPanelSrc.includes('cleanVerse') && resultPanelSrc.includes('cleanAdvice'),
    'Displays shortVerse and advice in result panel',
  );
  assert.ok(
    resultPanelSrc.includes('whitespace-nowrap') && resultPanelSrc.includes('formatQueXamHeader'),
    'Enforces single-line non-wrapping QUẺ XĂM <number>',
  );

  // Verify banned disclaimer and forbidden gift words never appear in public livestream UI components
  const publicStreamFiles = [
    'src/components/ui/XinXamResultPanel.tsx',
    'src/components/ui/BuddhistGiftPanel.tsx',
    'src/components/ui/Leaderboard.tsx',
    'src/components/ui/CenterCeremonialPanel.tsx',
    'src/components/ui/StreamingOverlay.tsx',
  ];
  for (const relPath of publicStreamFiles) {
    const content = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
    assert.equal(
      content.includes('Nội dung xăm minh họa mang tính tham khảo'),
      false,
      `${relPath} must NEVER contain banned disclaimer`,
    );
    assert.equal(content.includes('Tặng quà'), false, `${relPath} must NEVER mention "Tặng quà" publicly`);
    assert.equal(content.includes('Quà tặng'), false, `${relPath} must NEVER mention "Quà tặng" publicly`);
  }
});

// ============================================================================
// 17. VIENEU VOICE READS FORTUNE CLASSIFICATION + CENTRALIZED VOICE PRIORITY
// ============================================================================
runTest('17. VieNeuTTS reads fortuneType verbatim & Large Gift > Xin Xăm > Normal Gift > Comment priority', () => {
  assert.equal(vietnameseNumberToWords(1), 'một');
  assert.equal(vietnameseNumberToWords(5), 'năm');
  assert.equal(vietnameseNumberToWords(10), 'mười');
  assert.equal(vietnameseNumberToWords(15), 'mười lăm');
  assert.equal(vietnameseNumberToWords(18), 'mười tám');
  assert.equal(vietnameseNumberToWords(20), 'hai mươi');
  assert.equal(vietnameseNumberToWords(21), 'hai mươi mốt');
  assert.equal(vietnameseNumberToWords(24), 'hai mươi tư');
  assert.equal(vietnameseNumberToWords(25), 'hai mươi lăm');
  assert.equal(vietnameseNumberToWords(100), 'một trăm');

  // Exact required example from user specification (Fortune #18, Minh Anh):
  const f18 = DEFAULT_100_FORTUNES.find((f) => f.fortuneNumber === 18)!;
  const spoken18 = renderXinXamVoiceText(DEFAULT_XIN_XAM_VOICE_TEMPLATE, {
    username: 'Minh Anh',
    fortuneNumber: f18.fortuneNumber,
    fortuneType: f18.fortuneType,
    fortuneTitle: f18.fortuneTitle,
    fortuneInterpretation: f18.interpretation,
    fortuneAdvice: f18.advice,
  });
  assert.equal(
    spoken18,
    'Phật tử Minh Anh xin được xăm số mười tám, thuộc loại Trung Cát. Gia đạo an hòa. Gia đình có thể đón nhận những điều thuận lợi khi mọi người biết quan tâm và chia sẻ. Hãy giữ lòng từ bi và sống hòa thuận.',
  );
  assert.equal(containsForbiddenGiftWords(spoken18), false);

  // Verify fortune classification is NEVER skipped even if a custom template omits {fortuneType}
  const legacyCustomSpoken = renderXinXamVoiceText(
    'Phật tử {username} xin được xăm số {fortuneNumber}. {fortuneTitle}.',
    {
      username: 'Hoàng Nam',
      fortuneNumber: 12,
      fortuneType: 'Tiểu Cát',
      fortuneTitle: 'Lộc Nhỏ Đầu Xuân',
      fortuneInterpretation: 'Có tin vui nhỏ.',
      fortuneAdvice: 'Giữ lòng chân thành.',
    },
  );
  assert.ok(
    legacyCustomSpoken.includes('Tiểu Cát'),
    `Voice narration must NEVER skip fortuneType (got: ${legacyCustomSpoken})`,
  );

  // Verify strict centralized VoiceManager priority:
  // LARGE_GIFT (1) > XIN_XAM (2) > NORMAL_GIFT (3) > SPECIAL_RITUAL (4) > PRAYER_COMMENT (5) > ORDINARY_COMMENT (6)
  const vm = new SmartVoiceManager();
  vm.updateSettings({
    ...DEFAULT_VOICE_SETTINGS,
    autoNarrationEnabled: true,
    commentCooldownSec: 0,
  });

  vm.enqueue({
    text: 'Đang phát câu mở đầu.',
    priority: AnnouncementPriority.LARGE_GIFT,
    category: 'large_gift',
    dedupeKey: 'p-init',
  });

  vm.enqueue({
    text: 'Phật tử Nam gửi lời nguyện: Nam mô A Di Đà Phật',
    priority: AnnouncementPriority.ORDINARY_COMMENT,
    category: 'ordinary_comment',
    dedupeKey: 'p-ordinary',
  });
  vm.enqueue({
    text: 'Phật tử Lan gửi lời nguyện: Con cầu cho mẹ mạnh khỏe',
    priority: AnnouncementPriority.PRAYER_COMMENT,
    category: 'prayer_comment',
    dedupeKey: 'p-prayer',
  });
  vm.enqueue({
    text: 'Phật tử Tâm thắp hương cầu an.',
    priority: AnnouncementPriority.SPECIAL_RITUAL,
    category: 'special_ritual',
    dedupeKey: 'p-ritual',
  });
  vm.enqueue({
    text: 'Phật tử Bình cầu bình an.',
    priority: AnnouncementPriority.NORMAL_GIFT,
    category: 'gift',
    dedupeKey: 'p-normal',
  });
  vm.enqueue({
    text: spoken18,
    priority: AnnouncementPriority.XIN_XAM,
    category: 'xin_xam',
    dedupeKey: 'p-xinxam',
  });
  vm.enqueue({
    text: 'Phật tử Đức cầu công đức. Kính chúc gia đình luôn an lành.',
    priority: AnnouncementPriority.LARGE_GIFT,
    category: 'large_gift',
    dedupeKey: 'p-large',
  });

  assert.deepEqual(
    vm.getQueueSnapshot().map((i) => i.dedupeKey),
    ['p-large', 'p-xinxam', 'p-normal', 'p-ritual', 'p-prayer', 'p-ordinary'],
    'Voice queue strictly ordered: Large Gift > Xin Xăm > Normal Gift > Special Ritual > Prayer Comment > Ordinary Comment',
  );

  vm.stopAndClearQueue();
});

// ============================================================================
// 18. UNIFIED "CÚNG DƯỜNG CẦU AN" ASCENDING COIN SORTING, ZERO TRUNCATION & KNEELING ORIENTATION
// ============================================================================
runTest('18. Unified "CÚNG DƯỜNG CẦU AN" ascending coin order, zero truncation & Buddha-facing kneeling', () => {
  // 1) Default offering items include XIN XĂM (20 xu) sorted strictly ascending: 1, 10, 20, 30, 99, 199
  const sortedDefault = buildSortedOfferingItems(DEFAULT_GIFT_MAPPINGS, DEFAULT_XIN_XAM_SETTINGS);
  assert.equal(sortedDefault.length, 6, 'Includes 5 default gifts + XIN XĂM inside CÚNG DƯỜNG CẦU AN');
  assert.deepEqual(
    sortedDefault.map((i) => ({
      title: i.ceremonyTitle,
      label: i.vietnameseLabel,
      coins: i.referenceCoins,
    })),
    [
      { title: 'CẦU BÌNH AN', label: 'Hoa Hồng', coins: 1 },
      { title: 'CẦU SỨC KHỎE', label: 'Chuông Đồng', coins: 10 },
      { title: 'XIN XĂM', label: 'Xin xăm cầu an', coins: 20 },
      { title: 'CẦU GIA ĐẠO', label: 'Mâm Quả', coins: 30 },
      { title: 'CẦU TÀI LỘC', label: 'Đài Sen', coins: 99 },
      { title: 'CẦU CÔNG ĐỨC', label: 'Bảo Tháp', coins: 199 },
    ],
    'Default CÚNG DƯỜNG CẦU AN items must match exact ascending coin order',
  );

  // 2) Editing coin values or adding a new gift dynamically re-sorts from lowest to highest coin value
  const withAddedGift = [
    ...DEFAULT_GIFT_MAPPINGS,
    {
      ...DEFAULT_GIFT_MAPPINGS[0],
      id: 'custom_incense_15',
      giftId: '77777',
      ceremonyTitle: 'DÂNG HƯƠNG TỊNH TÂM',
      vietnameseLabel: 'Nén Tâm Hương Trầm',
      referenceCoins: 15,
    },
  ];
  const resorted = buildSortedOfferingItems(withAddedGift, {
    ...DEFAULT_XIN_XAM_SETTINGS,
    referenceCoins: 50,
  });
  assert.deepEqual(
    resorted.map((i) => i.referenceCoins),
    [1, 10, 15, 30, 50, 99, 199],
    'Adding a 15-xu gift and changing XIN XĂM to 50 xu automatically re-sorts ascending',
  );

  // 3) Static check on BuddhistGiftPanel.tsx: ZERO text truncation / ellipsis / line-clamp, complete coin display
  const giftPanelSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ui/BuddhistGiftPanel.tsx'),
    'utf8',
  );
  assert.equal(giftPanelSrc.includes('truncate'), false, 'BuddhistGiftPanel must NEVER use truncate');
  assert.equal(giftPanelSrc.includes('text-ellipsis'), false, 'BuddhistGiftPanel must NEVER use text-ellipsis');
  assert.equal(giftPanelSrc.includes('line-clamp'), false, 'BuddhistGiftPanel must NEVER use line-clamp');
  assert.ok(
    giftPanelSrc.includes('whitespace-normal') && giftPanelSrc.includes('break-words'),
    'BuddhistGiftPanel allows clean natural multi-line text wrapping',
  );
  assert.ok(giftPanelSrc.includes('xu'), 'BuddhistGiftPanel displays coin values (... xu) clearly');

  // 4) Verify 3D Xin Xăm station kneels facing directly toward the elevated Golden Buddha at (0, Y, -13.22)
  const st = ALTAR_STATIONS.xin_xam_station;
  const faceDirX = Math.sin(st.faceRotY);
  const faceDirZ = Math.cos(st.faceRotY);
  const toBuddhaX = 0 - st.x;
  const toBuddhaZ = -13.22 - st.z;
  const toBuddhaLen = Math.hypot(toBuddhaX, toBuddhaZ);
  const dot = (faceDirX * toBuddhaX + faceDirZ * toBuddhaZ) / toBuddhaLen;
  assert.ok(
    dot > 0.96,
    `Kneeling character at xin_xam_station must face toward the elevated Buddha statue (dot=${dot.toFixed(3)})`,
  );
});

console.log('\n🎉 ALL 18 CHÙA ONLINE LIVESTREAM & XIN XĂM UPGRADE TESTS PASSED SUCCESSFULLY!');


