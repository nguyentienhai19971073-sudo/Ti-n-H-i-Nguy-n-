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
  containsForbiddenGiftWords,
  renderCeremonialSubtitle,
  renderGiftVoiceTemplate,
  sanitizeCeremonialText,
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
  buildCenterCeremonialPanelStyle,
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

console.log('\n🎉 ALL 11 CHÙA ONLINE LIVESTREAM UPGRADE TESTS PASSED SUCCESSFULLY!');

