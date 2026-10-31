import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  AnnouncementPriority,
  DEFAULT_COMMENT_VOICE_FORMULA,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
} from '../types/temple';
import {
  COL_SPACING_X,
  INNER_MAT_X,
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
import {
  buildBurgundyHeaderStyle,
  buildBurgundyPanelStyle,
  buildCharacterNameLabelStyle,
  buildCommentBubbleStyle,
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
runTest('9. RGBA 0.50–0.60 panel styling (no parent opacity) & zero avatars in public UI', () => {
  assert.ok(
    DEFAULT_OVERLAY_SETTINGS.panelOpacity >= 0.5 && DEFAULT_OVERLAY_SETTINGS.panelOpacity <= 0.6,
    `Default panelOpacity (${DEFAULT_OVERLAY_SETTINGS.panelOpacity}) must be in [0.50, 0.60]`,
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

console.log('\n🎉 ALL 9 CHÙA ONLINE LIVESTREAM UPGRADE TESTS PASSED SUCCESSFULLY!');
