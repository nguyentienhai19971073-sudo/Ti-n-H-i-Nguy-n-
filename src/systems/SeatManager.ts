import * as THREE from 'three';
import { AltarStationId, RitualActionType } from '../types/temple';

export interface SeatPosition {
  seatIndex: number;
  row: number;
  col: number; // 0..3 left side (inner to outer), 4..7 right side (inner to outer)
  side: 'left' | 'right';
  x: number;
  z: number;
  aisleZ: number; // Clear row-walking corridor Z behind the mat
  isOverflow: boolean;
}

export interface AltarStationSpec {
  id: AltarStationId;
  x: number;
  z: number;
  faceRotY: number;
}

// Spacious 9:16-calibrated congregation seating expanded toward camera & left/right edges:
// 13 rows × 4 columns per side = 104 primary mats with generous horizontal (1.12m) & vertical (1.54m)
// spacing so characters never overlap and have wide 0.96m walking aisles between rows.
// Participants 105..300+ are stored in lightweight virtual/secondary sanctuary storage and seamlessly
// walk down the central red carpet when performing ceremonies or promote when seats open.
export const MAIN_SEAT_ROWS = 13;
export const MAIN_SEAT_COLS_PER_SIDE = 4;
export const MAIN_SEATS_PER_ROW = MAIN_SEAT_COLS_PER_SIDE * 2; // 8 symmetrical seats per row
export const TOTAL_MAIN_MATS = MAIN_SEAT_ROWS * MAIN_SEATS_PER_ROW; // 104 primary visible mats

export const ENTRANCE_Z = 16.8;
export const ALTAR_CENTER_Z = -12.4;
export const FIRST_ROW_Z = -6.1;
export const ROW_SPACING_Z = 1.54; // Wide 1.54m row pitch -> 0.96m clear walking aisle between 0.58m mats; front row reaches z = +12.38 near bottom of 9:16!
export const INNER_MAT_X = 1.72; // Keeps central red carpet (|x| <= 1.24) completely clear
export const COL_SPACING_X = 1.12; // Wide 1.12m column pitch -> columns at |x| = 1.72, 2.84, 3.96, 5.08 extending cleanly toward left/right edges

// Exact preserved scale of the Golden Buddha Statue & Lotus Throne (NEVER enlarged or stretched!)
export const BUDDHA_STATUE_SCALE = 1.82;
export const BUDDHA_ELEVATION_Y = 3.88; // Raised vertically from 1.48 -> 3.88 atop stepped sanctuary platform

// Canonical world-space bounds of the Raised Golden Buddha Statue (head halo crown to lotus pedestal)
// Vertical span remains 11.04 world units (14.92 - 3.88 === 12.52 - 1.48) — 0% size change!
export const SANCTUARY_BUDDHA_BOUNDS = {
  centerX: 0,
  centerZ: ALTAR_CENTER_Z - 0.82, // -13.22
  pedestalBottomY: BUDDHA_ELEVATION_Y, // 3.88
  haloTopY: BUDDHA_ELEVATION_Y + 11.04, // 14.92
  halfWidthX: 3.35,
  scale: BUDDHA_STATUE_SCALE,
};

// Dedicated collision-safe ritual stations in front of the elevated Buddha Altar & Xin Xăm Stand
export const ALTAR_STATIONS: Record<AltarStationId, AltarStationSpec> = {
  incense_center: { id: 'incense_center', x: 0.0, z: -8.68, faceRotY: Math.PI },
  incense_left: { id: 'incense_left', x: -0.68, z: -8.68, faceRotY: Math.PI },
  incense_right: { id: 'incense_right', x: 0.68, z: -8.68, faceRotY: Math.PI },
  fruit_left: { id: 'fruit_left', x: -0.82, z: -8.62, faceRotY: Math.PI },
  fruit_right: { id: 'fruit_right', x: 0.82, z: -8.62, faceRotY: Math.PI },
  flower_left: { id: 'flower_left', x: -1.48, z: -8.64, faceRotY: Math.PI },
  flower_right: { id: 'flower_right', x: 1.48, z: -8.64, faceRotY: Math.PI },
  lotus_left: { id: 'lotus_left', x: -2.06, z: -8.54, faceRotY: Math.PI },
  lotus_right: { id: 'lotus_right', x: 2.06, z: -8.54, faceRotY: Math.PI },
  lantern_left: { id: 'lantern_left', x: -2.54, z: -7.94, faceRotY: Math.PI },
  lantern_right: { id: 'lantern_right', x: 2.54, z: -7.94, faceRotY: Math.PI },
  bell_right: { id: 'bell_right', x: 3.16, z: -9.24, faceRotY: Math.PI * 0.64 },
  grand_center: { id: 'grand_center', x: 0.0, z: -8.12, faceRotY: Math.PI },
  // Dedicated separate 3D Xin Xăm ritual station on left side of sanctuary (never walks into Buddha!)
  xin_xam_station: { id: 'xin_xam_station', x: -3.28, z: -8.92, faceRotY: Math.PI * 0.88 },
};

export function areAltarStationsTooClose(a: AltarStationId, b: AltarStationId): boolean {
  if (a === b) return true;
  const sa = ALTAR_STATIONS[a];
  const sb = ALTAR_STATIONS[b];
  return Math.hypot(sa.x - sb.x, sa.z - sb.z) < 0.92;
}

export function getCandidateStationsForRitual(
  type: RitualActionType,
  side: 'left' | 'right',
): AltarStationId[] {
  switch (type) {
    case 'xin_xam':
      return ['xin_xam_station'];
    case 'altar_incense':
    case 'altar_pray_clasped':
      return side === 'left'
        ? ['incense_center', 'incense_left', 'incense_right', 'grand_center']
        : ['incense_center', 'incense_right', 'incense_left', 'grand_center'];
    case 'altar_wooden_fish':
      return side === 'left'
        ? ['incense_left', 'incense_center', 'flower_left']
        : ['incense_right', 'incense_center', 'flower_right'];
    case 'altar_flower':
      return side === 'left'
        ? ['flower_left', 'flower_right', 'incense_left']
        : ['flower_right', 'flower_left', 'incense_right'];
    case 'altar_fruit_tray':
      return side === 'left'
        ? ['fruit_left', 'fruit_right', 'flower_left']
        : ['fruit_right', 'fruit_left', 'flower_right'];
    case 'altar_lotus_pedestal':
    case 'glowing_lotus':
      return side === 'left'
        ? ['lotus_left', 'lotus_right', 'grand_center']
        : ['lotus_right', 'lotus_left', 'grand_center'];
    case 'golden_light':
      return side === 'left'
        ? ['grand_center', 'incense_center', 'flower_left', 'flower_right']
        : ['grand_center', 'incense_center', 'flower_right', 'flower_left'];
    case 'altar_lantern':
      return side === 'left'
        ? ['lantern_left', 'lantern_right']
        : ['lantern_right', 'lantern_left'];
    case 'altar_bell':
      return ['bell_right', 'incense_right'];
    case 'altar_pagoda':
    case 'altar_grand_ceremony':
      return ['grand_center', 'incense_center'];
    default:
      return ['incense_center'];
  }
}

function computeSeatPosition(seatIndex: number): SeatPosition {
  const isOverflow = seatIndex >= TOTAL_MAIN_MATS;

  if (!isOverflow) {
    const row = Math.floor(seatIndex / MAIN_SEATS_PER_ROW);
    const slotInRow = seatIndex % MAIN_SEATS_PER_ROW;

    // Symmetrical left/right filling outward from the central red carpet
    const side: 'left' | 'right' = slotInRow % 2 === 0 ? 'left' : 'right';
    const depthFromCarpet = Math.floor(slotInRow / 2); // 0..3
    const col = side === 'left' ? depthFromCarpet : MAIN_SEAT_COLS_PER_SIDE + depthFromCarpet;

    const absX = INNER_MAT_X + depthFromCarpet * COL_SPACING_X; // 1.72, 2.84, 3.96, 5.08
    const x = side === 'left' ? -absX : absX;
    const z = FIRST_ROW_Z + row * ROW_SPACING_Z; // -6.10 .. +12.38
    const aisleZ = z + 0.72; // Centered in the wide 0.96m walking corridor between rows

    return {
      seatIndex,
      row,
      col,
      side,
      x,
      z,
      aisleZ,
      isOverflow: false,
    };
  }

  // Secondary virtual/rear sanctuary gallery for overflow participants (105..300+):
  // Stored cleanly in lightweight virtual slots; if an overflow participant sends a gift/follow/share/Xin Xăm,
  // they enter cleanly from the rear sanctuary corridor and perform their full altar ceremony.
  const overflowOffset = seatIndex - TOTAL_MAIN_MATS;
  const overflowRow = Math.floor(overflowOffset / MAIN_SEATS_PER_ROW);
  const slotInRow = overflowOffset % MAIN_SEATS_PER_ROW;
  const side: 'left' | 'right' = slotInRow % 2 === 0 ? 'left' : 'right';
  const depthFromCarpet = Math.floor(slotInRow / 2); // 0..3
  const col = side === 'left' ? depthFromCarpet : MAIN_SEAT_COLS_PER_SIDE + depthFromCarpet;

  const absX = INNER_MAT_X + depthFromCarpet * 0.96; // 1.72 .. 4.60
  const x = side === 'left' ? -absX : absX;
  const z = 14.1 + Math.min(4, overflowRow) * 0.82;
  const aisleZ = z + 0.45;

  return {
    seatIndex,
    row: MAIN_SEAT_ROWS + overflowRow,
    col,
    side,
    x,
    z,
    aisleZ,
    isOverflow: true,
  };
}

// Precompute all 104 main mats + 256 virtual overflow slots (supports 360 cached + unlimited dynamic)
const PRECOMPUTED_SEATS: SeatPosition[] = Array.from({ length: 360 }, (_, i) =>
  computeSeatPosition(i),
);

export function getAllMainMats(): SeatPosition[] {
  return PRECOMPUTED_SEATS.slice(0, TOTAL_MAIN_MATS);
}

export function getSeatPosition(seatIndex: number): SeatPosition {
  if (seatIndex >= 0 && seatIndex < PRECOMPUTED_SEATS.length) {
    return PRECOMPUTED_SEATS[seatIndex];
  }
  return computeSeatPosition(seatIndex);
}

/**
 * Calibrates a PerspectiveCamera for 9:16 portrait or 16:9 landscape so:
 * 1) Every single primary seat (0..103) + character silhouette fits strictly inside the frame,
 *    with front rows extending near the bottom edge and outer columns near left/right edges.
 * 2) The elevated Golden Buddha Statue (crown y=14.92 down to lotus pedestal y=3.88) sits higher
 *    in the upper background at its exact original visual size without distortion.
 */
export function configureTempleCamera(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): void {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const isPortrait = safeH >= safeW;
  const aspect = safeW / safeH;

  camera.aspect = aspect;
  camera.near = 0.2;
  camera.far = 130;

  if (isPortrait) {
    camera.position.set(0, 13.1, 28.2);
    // Horizontal half-tan >= 0.316 ensures outer frontmost seat edges (|x| = 5.08 + 0.32 = 5.40 at z = +12.38)
    // project inside |ndcX| <= 0.935 while keeping the elevated Buddha at its exact natural visual scale.
    const minHalfTanV = Math.max(
      Math.tan(THREE.MathUtils.degToRad(55 * 0.5)),
      0.316 / Math.max(0.45, aspect),
    );
    camera.fov = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(Math.atan(minHalfTanV) * 2),
      54,
      65,
    );
    camera.lookAt(0, 4.75, -3.6);
  } else {
    camera.position.set(0, 12.2, 26.2);
    camera.fov = 49;
    camera.lookAt(0, 4.9, -4.0);
  }

  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
}

export interface FramingVerificationResult {
  allSeatsInsideFrame: boolean;
  buddhaFullyInsideFrame: boolean;
  minHorizontalSeatGap: number;
  minVerticalRowGap: number;
  centralCarpetClear: boolean;
  symmetricalWings: boolean;
  maxSeatAbsNdcX: number;
  maxSeatAbsNdcY: number;
  buddhaTopNdcY: number;
  buddhaBottomNdcY: number;
}

/**
 * Pure geometric & camera-frustum verification helper for 9:16 portrait framing tests.
 */
export function verifyTempleFraming916(width = 1080, height = 1920): FramingVerificationResult {
  const cam = new THREE.PerspectiveCamera(55, width / height, 0.2, 120);
  configureTempleCamera(cam, width, height);

  const mats = getAllMainMats();
  const v = new THREE.Vector3();

  let allSeatsInsideFrame = true;
  let maxSeatAbsNdcX = 0;
  let maxSeatAbsNdcY = 0;
  let centralCarpetClear = true;

  for (const seat of mats) {
    if (Math.abs(seat.x) - 0.34 < 1.24) {
      centralCarpetClear = false;
    }

    // Check both mat base and seated worshipper head top
    for (const testY of [0.02, 1.28]) {
      const outerX = seat.x + (seat.side === 'left' ? -0.32 : 0.32);
      v.set(outerX, testY, seat.z).project(cam);
      maxSeatAbsNdcX = Math.max(maxSeatAbsNdcX, Math.abs(v.x));
      maxSeatAbsNdcY = Math.max(maxSeatAbsNdcY, Math.abs(v.y));
      if (Math.abs(v.x) > 0.96 || Math.abs(v.y) > 0.96 || v.z < -1 || v.z > 1) {
        allSeatsInsideFrame = false;
      }
    }
  }

  // Check pairwise horizontal & vertical spacing across all main mats
  let minHorizontalSeatGap = Infinity;
  let minVerticalRowGap = Infinity;
  for (let i = 0; i < mats.length; i++) {
    for (let j = i + 1; j < mats.length; j++) {
      const a = mats[i];
      const b = mats[j];
      if (a.row === b.row && a.side === b.side) {
        minHorizontalSeatGap = Math.min(minHorizontalSeatGap, Math.abs(a.x - b.x));
      }
      if (a.col === b.col) {
        minVerticalRowGap = Math.min(minVerticalRowGap, Math.abs(a.z - b.z));
      }
    }
  }

  // Verify symmetry: every left seat has an exact mirrored right seat in the same row
  const leftSet = new Set(
    mats.filter((m) => m.side === 'left').map((m) => `${m.row}:${Math.abs(m.x).toFixed(3)}:${m.z.toFixed(3)}`),
  );
  const rightSet = new Set(
    mats.filter((m) => m.side === 'right').map((m) => `${m.row}:${Math.abs(m.x).toFixed(3)}:${m.z.toFixed(3)}`),
  );
  const symmetricalWings =
    leftSet.size === rightSet.size && Array.from(leftSet).every((k) => rightSet.has(k));

  // Verify Golden Buddha crown, lotus pedestal base, and left/right halo flanks
  const topPt = new THREE.Vector3(
    SANCTUARY_BUDDHA_BOUNDS.centerX,
    SANCTUARY_BUDDHA_BOUNDS.haloTopY,
    SANCTUARY_BUDDHA_BOUNDS.centerZ,
  ).project(cam);
  const botPt = new THREE.Vector3(
    SANCTUARY_BUDDHA_BOUNDS.centerX,
    SANCTUARY_BUDDHA_BOUNDS.pedestalBottomY,
    SANCTUARY_BUDDHA_BOUNDS.centerZ,
  ).project(cam);
  const leftFlank = new THREE.Vector3(
    -SANCTUARY_BUDDHA_BOUNDS.halfWidthX,
    (SANCTUARY_BUDDHA_BOUNDS.haloTopY + SANCTUARY_BUDDHA_BOUNDS.pedestalBottomY) * 0.5,
    SANCTUARY_BUDDHA_BOUNDS.centerZ,
  ).project(cam);
  const rightFlank = new THREE.Vector3(
    SANCTUARY_BUDDHA_BOUNDS.halfWidthX,
    (SANCTUARY_BUDDHA_BOUNDS.haloTopY + SANCTUARY_BUDDHA_BOUNDS.pedestalBottomY) * 0.5,
    SANCTUARY_BUDDHA_BOUNDS.centerZ,
  ).project(cam);

  const buddhaFullyInsideFrame =
    [topPt, botPt, leftFlank, rightFlank].every(
      (p) => Math.abs(p.x) <= 0.94 && Math.abs(p.y) <= 0.94 && p.z >= -1 && p.z <= 1,
    ) && topPt.y - botPt.y >= 0.35; // Ensures Buddha is prominent, never tiny!

  return {
    allSeatsInsideFrame,
    buddhaFullyInsideFrame,
    minHorizontalSeatGap,
    minVerticalRowGap,
    centralCarpetClear,
    symmetricalWings,
    maxSeatAbsNdcX,
    maxSeatAbsNdcY,
    buddhaTopNdcY: topPt.y,
    buddhaBottomNdcY: botPt.y,
  };
}

export class SeatManager {
  // seatIndex -> userId
  private occupiedSeats = new Map<number, string>();
  // userId -> seatIndex
  private userToSeat = new Map<string, number>();
  private laneCounter = 0;

  // Lanes along the red carpet so multiple walking worshippers never overlap
  private static readonly CARPET_LANES = [-0.52, 0.52, -0.26, 0.26, 0, -0.76, 0.76];

  public assignSeatForUser(userId: string): { seatIndex: number; laneOffset: number } {
    const existing = this.userToSeat.get(userId);
    if (existing !== undefined) {
      return { seatIndex: existing, laneOffset: 0 };
    }

    // Find lowest available seatIndex (automatically reclaims freed main seats 0..95 first!)
    let chosenSeat = 0;
    while (this.occupiedSeats.has(chosenSeat)) {
      chosenSeat += 1;
    }

    this.occupiedSeats.set(chosenSeat, userId);
    this.userToSeat.set(userId, chosenSeat);

    const laneOffset =
      SeatManager.CARPET_LANES[this.laneCounter % SeatManager.CARPET_LANES.length];
    this.laneCounter += 1;

    return { seatIndex: chosenSeat, laneOffset };
  }

  public getUserSeat(userId: string): number | undefined {
    return this.userToSeat.get(userId);
  }

  public releaseUserSeat(userId: string): number | undefined {
    const seat = this.userToSeat.get(userId);
    if (seat !== undefined) {
      this.occupiedSeats.delete(seat);
      this.userToSeat.delete(userId);
    }
    return seat;
  }

  public resetAll(): void {
    this.occupiedSeats.clear();
    this.userToSeat.clear();
    this.laneCounter = 0;
  }

  public reassignAllUsers(userIds: string[]): Map<string, number> {
    this.resetAll();
    const result = new Map<string, number>();
    for (const uid of userIds) {
      const { seatIndex } = this.assignSeatForUser(uid);
      result.set(uid, seatIndex);
    }
    return result;
  }

  public getOccupiedMainCount(): number {
    let count = 0;
    for (const seatIdx of this.occupiedSeats.keys()) {
      if (seatIdx < TOTAL_MAIN_MATS) count += 1;
    }
    return count;
  }

  public getOverflowWaitingCount(): number {
    let count = 0;
    for (const seatIdx of this.occupiedSeats.keys()) {
      if (seatIdx >= TOTAL_MAIN_MATS) count += 1;
    }
    return count;
  }
}
