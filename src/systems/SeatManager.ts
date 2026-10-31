import { AltarStationId, RitualActionType } from '../types/temple';

export interface SeatPosition {
  seatIndex: number;
  row: number;
  col: number; // 0..4 left side (inner to outer), 5..9 right side (inner to outer)
  side: 'left' | 'right';
  x: number;
  z: number;
  aisleZ: number; // Safe row-walking Z slightly behind the mat
  isOverflow: boolean;
}

export interface AltarStationSpec {
  id: AltarStationId;
  x: number;
  z: number;
  faceRotY: number;
}

export const MAIN_SEAT_ROWS = 20;
export const MAIN_SEAT_COLS_PER_SIDE = 5;
export const TOTAL_MAIN_MATS = MAIN_SEAT_ROWS * MAIN_SEAT_COLS_PER_SIDE * 2; // 200 mats

// Calibrated temple spatial constants so the monumental Golden Buddha, altar stations, and all 200 mats are clearly visible
export const ENTRANCE_Z = 16.6;
export const ALTAR_CENTER_Z = -12.4;
export const FIRST_ROW_Z = -6.5;
export const ROW_SPACING_Z = 1.06;
export const INNER_MAT_X = 2.28;
export const COL_SPACING_X = 1.14;

// Dedicated collision-safe ritual stations in front of the Buddha Altar & Sanctuary (never overlapping altar objects or statue)
export const ALTAR_STATIONS: Record<AltarStationId, AltarStationSpec> = {
  incense_center: { id: 'incense_center', x: 0.0, z: -8.68, faceRotY: Math.PI },
  incense_left: { id: 'incense_left', x: -0.66, z: -8.68, faceRotY: Math.PI },
  incense_right: { id: 'incense_right', x: 0.66, z: -8.68, faceRotY: Math.PI },
  fruit_left: { id: 'fruit_left', x: -0.78, z: -8.66, faceRotY: Math.PI },
  fruit_right: { id: 'fruit_right', x: 0.78, z: -8.66, faceRotY: Math.PI },
  flower_left: { id: 'flower_left', x: -1.46, z: -8.68, faceRotY: Math.PI },
  flower_right: { id: 'flower_right', x: 1.46, z: -8.68, faceRotY: Math.PI },
  lotus_left: { id: 'lotus_left', x: -2.06, z: -8.56, faceRotY: Math.PI },
  lotus_right: { id: 'lotus_right', x: 2.06, z: -8.56, faceRotY: Math.PI },
  lantern_left: { id: 'lantern_left', x: -2.62, z: -7.96, faceRotY: Math.PI },
  lantern_right: { id: 'lantern_right', x: 2.62, z: -7.96, faceRotY: Math.PI },
  bell_right: { id: 'bell_right', x: 3.34, z: -9.26, faceRotY: -Math.PI * 0.62 },
  grand_center: { id: 'grand_center', x: 0.0, z: -8.16, faceRotY: Math.PI },
};

export function areAltarStationsTooClose(a: AltarStationId, b: AltarStationId): boolean {
  if (a === b) return true;
  const sa = ALTAR_STATIONS[a];
  const sb = ALTAR_STATIONS[b];
  return Math.hypot(sa.x - sb.x, sa.z - sb.z) < 0.95;
}

export function getCandidateStationsForRitual(
  type: RitualActionType,
  side: 'left' | 'right',
): AltarStationId[] {
  switch (type) {
    case 'altar_incense':
      return side === 'left'
        ? ['incense_center', 'incense_left', 'incense_right']
        : ['incense_center', 'incense_right', 'incense_left'];
    case 'altar_flower':
      return side === 'left'
        ? ['flower_left', 'flower_right', 'incense_left']
        : ['flower_right', 'flower_left', 'incense_right'];
    case 'altar_fruit_tray':
      return side === 'left'
        ? ['fruit_left', 'fruit_right', 'flower_left']
        : ['fruit_right', 'fruit_left', 'flower_right'];
    case 'altar_lotus_pedestal':
      return side === 'left'
        ? ['lotus_left', 'lotus_right', 'flower_left']
        : ['lotus_right', 'lotus_left', 'flower_right'];
    case 'altar_lantern':
      return side === 'left'
        ? ['lantern_left', 'lantern_right']
        : ['lantern_right', 'lantern_left'];
    case 'altar_bell':
      return ['bell_right'];
    case 'altar_pagoda':
    case 'altar_grand_ceremony':
      return ['grand_center', 'incense_center'];
    default:
      return ['incense_center'];
  }
}

function computeSeatPosition(seatIndex: number): SeatPosition {
  const isOverflow = seatIndex >= TOTAL_MAIN_MATS;
  const row = Math.floor(seatIndex / 10);
  const slotInRow = seatIndex % 10;

  // Alternate left/right inner-to-outer so seats fill symmetrically around the red carpet
  const side: 'left' | 'right' = slotInRow % 2 === 0 ? 'left' : 'right';
  const depthFromCarpet = Math.floor(slotInRow / 2); // 0..4
  const col = side === 'left' ? depthFromCarpet : 5 + depthFromCarpet;

  const absX = INNER_MAT_X + depthFromCarpet * COL_SPACING_X;
  const x = side === 'left' ? -absX : absX;
  const z = FIRST_ROW_Z + row * ROW_SPACING_Z;
  const aisleZ = z + 0.48;

  return {
    seatIndex,
    row,
    col,
    side,
    x,
    z,
    aisleZ,
    isOverflow,
  };
}

// Precompute all 200 main mats + 100 overflow waiting/expandable seats
const PRECOMPUTED_SEATS: SeatPosition[] = Array.from({ length: 300 }, (_, i) =>
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

export class SeatManager {
  // seatIndex -> userId
  private occupiedSeats = new Map<number, string>();
  // userId -> seatIndex
  private userToSeat = new Map<string, number>();
  private laneCounter = 0;

  // Lanes along the red carpet so multiple walking worshippers never overlap
  private static readonly CARPET_LANES = [-0.65, 0.65, -0.32, 0.32, 0, -0.88, 0.88];

  public assignSeatForUser(userId: string): { seatIndex: number; laneOffset: number } {
    const existing = this.userToSeat.get(userId);
    if (existing !== undefined) {
      return { seatIndex: existing, laneOffset: 0 };
    }

    // Find lowest available seatIndex (fills front rows near Buddha & red carpet outward)
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

  public releaseUserSeat(userId: string): void {
    const seat = this.userToSeat.get(userId);
    if (seat !== undefined) {
      this.occupiedSeats.delete(seat);
      this.userToSeat.delete(userId);
    }
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
