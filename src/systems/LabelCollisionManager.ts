import * as THREE from 'three';
import { SANCTUARY_BUDDHA_BOUNDS } from './SeatManager';

export interface ScreenRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LabelCandidateInput {
  userId: string;
  username: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  headY: number;
  lastComment?: string;
  lastCommentAt?: number;
  ritualStatusLabel?: string;
  isSpeaking: boolean;
  isCeremonyActor: boolean;
  isRecentlyActive: boolean;
  seatIndex: number;
}

export interface SolvedOverlayPlacement {
  userId: string;
  username: string;
  anchorX: number;
  anchorY: number;
  // Small character name label (username ONLY — zero avatar!)
  nameVisible: boolean;
  nameOpacity: number;
  nameX: number;
  nameY: number;
  nameRect: ScreenRect | null;
  ritualLabelText: string;
  // 5-second overhead comment bubble (original comment ONLY — zero username, zero avatar!)
  bubbleVisible: boolean;
  bubbleOpacity: number;
  bubbleText: string;
  bubbleX: number;
  bubbleY: number;
  bubbleRect: ScreenRect | null;
}

export interface LabelLayoutOptions {
  viewportWidth: number;
  viewportHeight: number;
  now: number;
  showUsernames: boolean;
  showCommentBubbles: boolean;
  panelScale?: number;
  showLeaderboard?: boolean;
  showGiftPanel?: boolean;
  commentDurationMs?: number;
}

export interface LabelLayoutResult {
  placements: Map<string, SolvedOverlayPlacement>;
  items: SolvedOverlayPlacement[];
  buddhaExclusionRect: ScreenRect;
  altarExclusionRect: ScreenRect;
  visibleNameCount: number;
  visibleBubbleCount: number;
}

const _projVec = new THREE.Vector3();
const _bTop = new THREE.Vector3();
const _bBot = new THREE.Vector3();
const _bSide = new THREE.Vector3();
const _aTop = new THREE.Vector3();
const _aBot = new THREE.Vector3();
const _aSide = new THREE.Vector3();

export function screenRectsOverlap(a: ScreenRect, b: ScreenRect, pad = 0): boolean {
  return !(
    a.right + pad <= b.left ||
    a.left - pad >= b.right ||
    a.bottom + pad <= b.top ||
    a.top - pad >= b.bottom
  );
}

export function isRectInsideViewport(
  rect: ScreenRect,
  viewportWidth: number,
  viewportHeight: number,
  margin = 4,
): boolean {
  return (
    rect.left >= margin - 0.5 &&
    rect.right <= viewportWidth - margin + 0.5 &&
    rect.top >= margin - 0.5 &&
    rect.bottom <= viewportHeight - margin + 0.5
  );
}

function estimateNameWidth(username: string, scale: number): number {
  const charCount = Array.from(username).length;
  return Math.min(64, Math.max(26, Math.min(charCount, 14) * 3.8 + 6)) * scale;
}

function estimateBubbleDims(comment: string, scale: number): { width: number; height: number } {
  const charCount = Array.from(comment).length;
  const width = Math.min(108, Math.max(42, Math.min(charCount, 22) * 4.2 + 12)) * scale;
  const lines = charCount > 22 ? 2 : 1;
  const height = (lines === 2 ? 25 : 16.5) * scale;
  return { width, height };
}

// Offset candidates for comment bubbles (above character's head & name tag)
const BUBBLE_OFFSET_CANDIDATES: [number, number][] = [
  [0, 0],
  [0, -22],
  [0, -44],
  [-26, -8],
  [26, -8],
  [-48, -16],
  [48, -16],
  [-32, +18],
  [32, +18],
  [-56, +12],
  [56, +12],
  [0, -66],
  [0, +28],
  [0, +50],
];

// Staggered micro-offsets for small character name labels (tightly tethered to character's head)
const NAME_OFFSET_CANDIDATES: [number, number][] = [
  [0, 0],
  [0, -12],
  [0, +12],
  [-15, -6],
  [15, -6],
  [-18, +6],
  [18, +6],
  [-26, -13],
  [26, -13],
  [-26, +13],
  [26, +13],
  [0, -24],
  [0, +23],
];

/**
 * Projects 3D character positions to 2D screen coordinates and solves non-overlapping
 * screen-space placement for both 5-second Comment Bubbles and Character Name Labels.
 *
 * Guarantees:
 * - Zero overlap between any two visible name labels or comment bubbles.
 * - Never merges multiple usernames into a single label.
 * - Never places labels or bubbles outside the camera viewport.
 * - Never covers the Golden Buddha Statue or central sanctuary altar.
 * - Prioritizes active speakers, commenters, ceremony performers, and nearby worshippers;
 *   automatically hides lower-priority colliding labels when crowd density is high.
 */
export function solveLabelAndBubbleLayout(
  candidates: LabelCandidateInput[],
  camera: THREE.Camera,
  options: LabelLayoutOptions,
): LabelLayoutResult {
  const {
    viewportWidth,
    viewportHeight,
    now,
    showUsernames,
    showCommentBubbles,
    panelScale = 0.9,
    showLeaderboard = false,
    showGiftPanel = false,
    commentDurationMs = 5000,
  } = options;

  const halfW = viewportWidth * 0.5;
  const halfH = viewportHeight * 0.5;
  const scale = Math.max(0.75, Math.min(1.15, panelScale));
  const edgePad = 5;
  const topSafeY = Math.max(36, 40 * scale);
  const bottomSafeY = Math.min(viewportHeight - 10, viewportHeight - 36 * scale);

  // 1. Project Golden Buddha Statue Exclusion Zone (head halo crown -> lotus pedestal)
  _bTop
    .set(
      SANCTUARY_BUDDHA_BOUNDS.centerX,
      SANCTUARY_BUDDHA_BOUNDS.haloTopY,
      SANCTUARY_BUDDHA_BOUNDS.centerZ,
    )
    .project(camera);
  _bBot
    .set(
      SANCTUARY_BUDDHA_BOUNDS.centerX,
      SANCTUARY_BUDDHA_BOUNDS.pedestalBottomY,
      SANCTUARY_BUDDHA_BOUNDS.centerZ,
    )
    .project(camera);
  _bSide
    .set(
      SANCTUARY_BUDDHA_BOUNDS.halfWidthX,
      (SANCTUARY_BUDDHA_BOUNDS.haloTopY + SANCTUARY_BUDDHA_BOUNDS.pedestalBottomY) * 0.5,
      SANCTUARY_BUDDHA_BOUNDS.centerZ,
    )
    .project(camera);

  const buddhaCenterX = _bTop.x * halfW + halfW;
  const buddhaHalfPxW = Math.abs(_bSide.x * halfW + halfW - buddhaCenterX) + 6;
  const bY1 = -_bTop.y * halfH + halfH;
  const bY2 = -_bBot.y * halfH + halfH;
  const buddhaExclusionRect: ScreenRect = {
    left: buddhaCenterX - buddhaHalfPxW,
    right: buddhaCenterX + buddhaHalfPxW,
    top: Math.min(bY1, bY2) - 4,
    bottom: Math.max(bY1, bY2) + 4,
  };

  // 2. Project Central Elevated Incense Altar Table Exclusion Zone (strictly within central aisle |x| <= 1.32)
  _aTop.set(0, 4.45, -10.8).project(camera);
  _aBot.set(0, 0.45, -10.0).project(camera);
  _aSide.set(1.32, 2.55, -10.4).project(camera);

  const altarCenterX = _aTop.x * halfW + halfW;
  const altarHalfPxW = Math.abs(_aSide.x * halfW + halfW - altarCenterX) + 2;
  const aY1 = -_aTop.y * halfH + halfH;
  const aY2 = -_aBot.y * halfH + halfH;
  const altarExclusionRect: ScreenRect = {
    left: altarCenterX - altarHalfPxW,
    right: altarCenterX + altarHalfPxW,
    top: Math.min(aY1, aY2),
    bottom: Math.max(aY1, aY2),
  };

  // Optional corner HUD panel exclusion zones so labels never collide with edge panels
  const hudExclusionRects: ScreenRect[] = [buddhaExclusionRect, altarExclusionRect];
  if (showLeaderboard) {
    hudExclusionRects.push({
      left: 0,
      right: 106 * scale + 8,
      top: 0,
      bottom: topSafeY + 132 * scale,
    });
  }
  if (showGiftPanel) {
    hudExclusionRects.push({
      left: viewportWidth - (122 * scale + 8),
      right: viewportWidth,
      top: 0,
      bottom: topSafeY + 148 * scale,
    });
  }

  // 3. Project all candidates into screen space
  interface ProjectedItem {
    input: LabelCandidateInput;
    inFrustum: boolean;
    sx: number;
    sy: number;
    hasActiveBubble: boolean;
    bubbleAgeMs: number;
    priorityScore: number;
  }

  const projected: ProjectedItem[] = [];
  const placements = new Map<string, SolvedOverlayPlacement>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    _projVec.set(c.worldX, c.worldY + c.headY + 0.14, c.worldZ).project(camera);

    const inFrustum =
      _projVec.z >= -1 &&
      _projVec.z <= 1 &&
      _projVec.x >= -0.96 &&
      _projVec.x <= 0.96 &&
      _projVec.y >= -0.96 &&
      _projVec.y <= 0.96;

    const sx = _projVec.x * halfW + halfW;
    const sy = -_projVec.y * halfH + halfH;

    const bubbleAgeMs =
      c.lastComment && c.lastCommentAt !== undefined ? now - c.lastCommentAt : Infinity;
    const hasActiveBubble = Boolean(
      showCommentBubbles && c.lastComment && bubbleAgeMs >= 0 && bubbleAgeMs < commentDurationMs,
    );

    const priorityScore =
      (c.isSpeaking ? 10000 : 0) +
      (hasActiveBubble ? 6000 + Math.max(0, 1000 - bubbleAgeMs * 0.2) : 0) +
      (c.isCeremonyActor ? 3500 : 0) +
      (c.isRecentlyActive ? 1200 : 0) +
      (c.worldZ + 20) * 18 -
      c.seatIndex * 0.25;

    projected.push({
      input: c,
      inFrustum,
      sx,
      sy,
      hasActiveBubble,
      bubbleAgeMs,
      priorityScore,
    });

    placements.set(c.userId, {
      userId: c.userId,
      username: c.username,
      anchorX: sx,
      anchorY: sy,
      nameVisible: false,
      nameOpacity: 0,
      nameX: sx,
      nameY: sy,
      nameRect: null,
      ritualLabelText: c.ritualStatusLabel || '',
      bubbleVisible: false,
      bubbleOpacity: 0,
      bubbleText: c.lastComment || '',
      bubbleX: sx,
      bubbleY: sy - 16 * scale,
      bubbleRect: null,
    });
  }

  const placedRects: ScreenRect[] = [];
  let visibleBubbleCount = 0;
  let visibleNameCount = 0;

  // 4. PASS 1: Place active 5-second Comment Bubbles (most recent & speaking first)
  if (showCommentBubbles) {
    const bubbleCandidates = projected
      .filter((p) => p.inFrustum && p.hasActiveBubble)
      .sort((a, b) => {
        if (a.input.isSpeaking !== b.input.isSpeaking) {
          return a.input.isSpeaking ? -1 : 1;
        }
        return (b.input.lastCommentAt || 0) - (a.input.lastCommentAt || 0);
      });

    for (const item of bubbleCandidates) {
      const out = placements.get(item.input.userId)!;
      const commentText = item.input.lastComment || '';
      const { width: bw, height: bh } = estimateBubbleDims(commentText, scale);
      const halfBw = bw * 0.5;

      // Float above the small character name label when usernames are enabled
      const baseBottomY = showUsernames ? item.sy - 16 * scale : item.sy - 2;

      let chosenRect: ScreenRect | null = null;
      let chosenCx = item.sx;
      let chosenBottomY = baseBottomY;

      for (let k = 0; k < BUBBLE_OFFSET_CANDIDATES.length; k++) {
        const [ox, oy] = BUBBLE_OFFSET_CANDIDATES[k];
        const cx = THREE.MathUtils.clamp(
          item.sx + ox * scale,
          edgePad + halfBw,
          viewportWidth - edgePad - halfBw,
        );
        const by = THREE.MathUtils.clamp(
          baseBottomY + oy * scale,
          topSafeY + bh,
          bottomSafeY,
        );

        const rect: ScreenRect = {
          left: cx - halfBw,
          right: cx + halfBw,
          top: by - bh,
          bottom: by,
        };

        if (!isRectInsideViewport(rect, viewportWidth, viewportHeight, edgePad)) {
          continue;
        }
        if (hudExclusionRects.some((ex) => screenRectsOverlap(rect, ex, 2))) {
          continue;
        }
        if (placedRects.some((pr) => screenRectsOverlap(rect, pr, 3))) {
          continue;
        }

        chosenRect = rect;
        chosenCx = cx;
        chosenBottomY = by;
        break;
      }

      // Extra fallback if character is near the central altar/Buddha column:
      // flank cleanly to the left or right of the exclusion box with vertical staggering
      if (!chosenRect) {
        const flankSides = item.sx <= buddhaCenterX ? [-1, 1] : [1, -1];
        const flankYOffsets = [0, -26, 26, -52, 52, 78];
        outerFlank: for (const dir of flankSides) {
          for (const fy of flankYOffsets) {
            const flankEdge =
              dir < 0
                ? Math.min(buddhaExclusionRect.left, altarExclusionRect.left) - halfBw - 5
                : Math.max(buddhaExclusionRect.right, altarExclusionRect.right) + halfBw + 5;
            const cx = THREE.MathUtils.clamp(
              flankEdge,
              edgePad + halfBw,
              viewportWidth - edgePad - halfBw,
            );
            const by = THREE.MathUtils.clamp(
              baseBottomY + fy * scale,
              topSafeY + bh,
              bottomSafeY,
            );
            const rect: ScreenRect = {
              left: cx - halfBw,
              right: cx + halfBw,
              top: by - bh,
              bottom: by,
            };
            if (
              isRectInsideViewport(rect, viewportWidth, viewportHeight, edgePad) &&
              !hudExclusionRects.some((ex) => screenRectsOverlap(rect, ex, 2)) &&
              !placedRects.some((pr) => screenRectsOverlap(rect, pr, 3))
            ) {
              chosenRect = rect;
              chosenCx = cx;
              chosenBottomY = by;
              break outerFlank;
            }
          }
        }
      }

      if (chosenRect) {
        const fadeStartMs = commentDurationMs - 1000;
        const fadeRatio =
          item.bubbleAgeMs <= fadeStartMs
            ? 1
            : Math.max(0, 1 - (item.bubbleAgeMs - fadeStartMs) / 1000);

        out.bubbleVisible = fadeRatio > 0.02;
        out.bubbleOpacity = Number(fadeRatio.toFixed(2));
        out.bubbleText = commentText;
        out.bubbleX = chosenCx;
        out.bubbleY = chosenBottomY;
        out.bubbleRect = chosenRect;
        if (out.bubbleVisible) {
          placedRects.push(chosenRect);
          visibleBubbleCount += 1;
        }
      }
    }
  }

  // 5. PASS 2: Place Smaller Character Name Labels (priority-sorted, strictly non-overlapping)
  if (showUsernames) {
    const nameCandidates = projected
      .filter((p) => p.inFrustum)
      .sort((a, b) => b.priorityScore - a.priorityScore);

    for (const item of nameCandidates) {
      const out = placements.get(item.input.userId)!;
      const nw = estimateNameWidth(item.input.username, scale);
      const hasRitualTag = Boolean(item.input.isCeremonyActor && item.input.ritualStatusLabel);
      const nh = (hasRitualTag ? 21 : 11) * scale;
      const halfNw = nw * 0.5;

      let chosenRect: ScreenRect | null = null;
      let chosenCx = item.sx;
      let chosenBottomY = item.sy;
      let offsetPenalty = 0;

      for (let k = 0; k < NAME_OFFSET_CANDIDATES.length; k++) {
        const [ox, oy] = NAME_OFFSET_CANDIDATES[k];
        const cx = THREE.MathUtils.clamp(
          item.sx + ox * scale,
          edgePad + halfNw,
          viewportWidth - edgePad - halfNw,
        );
        const by = THREE.MathUtils.clamp(
          item.sy + oy * scale,
          topSafeY + nh,
          bottomSafeY,
        );

        // Keep name label reasonably tethered to its character so it never looks detached
        if (Math.hypot(cx - item.sx, by - item.sy) > 38 * scale) {
          continue;
        }

        const rect: ScreenRect = {
          left: cx - halfNw,
          right: cx + halfNw,
          top: by - nh,
          bottom: by,
        };

        if (!isRectInsideViewport(rect, viewportWidth, viewportHeight, edgePad)) {
          continue;
        }
        if (hudExclusionRects.some((ex) => screenRectsOverlap(rect, ex, 1.5))) {
          continue;
        }
        if (placedRects.some((pr) => screenRectsOverlap(rect, pr, 1.5))) {
          continue;
        }

        chosenRect = rect;
        chosenCx = cx;
        chosenBottomY = by;
        offsetPenalty = k > 2 ? 0.1 : 0;
        break;
      }

      if (chosenRect) {
        const baseOpacity =
          item.input.isSpeaking || item.input.isCeremonyActor || item.hasActiveBubble
            ? 1
            : item.input.isRecentlyActive
              ? 0.94
              : 0.86;
        out.nameVisible = true;
        out.nameOpacity = Number(Math.max(0.65, baseOpacity - offsetPenalty).toFixed(2));
        out.nameX = chosenCx;
        out.nameY = chosenBottomY;
        out.nameRect = chosenRect;
        out.ritualLabelText = hasRitualTag ? item.input.ritualStatusLabel || '' : '';
        placedRects.push(chosenRect);
        visibleNameCount += 1;
      }
    }
  }

  return {
    placements,
    items: Array.from(placements.values()),
    buddhaExclusionRect,
    altarExclusionRect,
    visibleNameCount,
    visibleBubbleCount,
  };
}
