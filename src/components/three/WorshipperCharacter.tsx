import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CharacterAnimState, Participant } from '../../types/temple';
import { ENTRANCE_Z, getSeatPosition } from '../../systems/SeatManager';
import { tiktokEventManager } from '../../systems/TikTokEventManager';
import { liveCharacterPositions } from './templeResources';

// Shared Geometries at Module Scope (Zero per-character geometry allocation!)
const SHARED_GEOS = {
  head: new THREE.SphereGeometry(0.165, 14, 12),
  hairCap: new THREE.SphereGeometry(0.172, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
  hairBun: new THREE.SphereGeometry(0.068, 10, 8),
  torso: new THREE.CylinderGeometry(0.16, 0.22, 0.56, 12),
  collarSash: new THREE.BoxGeometry(0.24, 0.34, 0.04),
  upperArm: new THREE.CapsuleGeometry(0.052, 0.26, 4, 8),
  hand: new THREE.SphereGeometry(0.046, 8, 8),
  leg: new THREE.CapsuleGeometry(0.068, 0.28, 4, 8),
  kneelingBase: new THREE.CylinderGeometry(0.22, 0.26, 0.22, 12),

  // Prop 1: Hoa Hồng / Hoa Sen Bouquet
  lotusStem: new THREE.CylinderGeometry(0.011, 0.011, 0.24, 6),
  roseBloomCenter: new THREE.SphereGeometry(0.068, 10, 8),
  rosePetalCone: new THREE.ConeGeometry(0.088, 0.14, 7),

  // Prop 2: Thắp Hương (3 Incense Sticks)
  incenseStick: new THREE.CylinderGeometry(0.008, 0.008, 0.34, 5),
  incenseTip: new THREE.SphereGeometry(0.018, 6, 6),

  // Prop 3: Hoa Đăng & Đài Sen (Glowing Lotus Pedestal)
  lanternBase: new THREE.CylinderGeometry(0.12, 0.08, 0.09, 8),
  lanternCore: new THREE.SphereGeometry(0.068, 10, 8),
  lotusPedestalFoot: new THREE.CylinderGeometry(0.09, 0.13, 0.08, 12),
  lotusPedestalRing: new THREE.CylinderGeometry(0.18, 0.1, 0.1, 10),
  lotusPedestalPetal: new THREE.ConeGeometry(0.055, 0.13, 5),

  // Prop 4: Mâm Quả (Decorated Vietnamese Five-Fruit Offering Tray)
  fruitTrayFoot: new THREE.CylinderGeometry(0.06, 0.11, 0.08, 12),
  fruitTrayPlate: new THREE.CylinderGeometry(0.21, 0.15, 0.045, 16),
  fruitLarge: new THREE.SphereGeometry(0.068, 10, 8),
  fruitSmall: new THREE.SphereGeometry(0.05, 8, 8),

  // Prop 5: Bảo Tháp (5-Tiered Golden Buddhist Stupa Pagoda)
  pagodaBase: new THREE.CylinderGeometry(0.13, 0.16, 0.07, 8),
  pagodaTier1: new THREE.CylinderGeometry(0.1, 0.14, 0.08, 8),
  pagodaTier2: new THREE.CylinderGeometry(0.082, 0.115, 0.075, 8),
  pagodaTier3: new THREE.CylinderGeometry(0.064, 0.092, 0.07, 8),
  pagodaSpire: new THREE.ConeGeometry(0.032, 0.15, 8),

  // Prop 6: Mõ Gỗ (Carved Temple Wooden Fish Drum + Mallet)
  woodenFishCushion: new THREE.BoxGeometry(0.23, 0.038, 0.21),
  woodenFishBody: new THREE.SphereGeometry(0.098, 12, 10),
  woodenFishRidge: new THREE.TorusGeometry(0.072, 0.014, 6, 14, Math.PI),
  woodenFishMallet: new THREE.CylinderGeometry(0.01, 0.01, 0.23, 6),
  woodenFishMalletTip: new THREE.SphereGeometry(0.024, 8, 8),

  ringInner: new THREE.RingGeometry(0.38, 0.54, 24),
  ringOuter: new THREE.RingGeometry(0.62, 0.78, 28),
};

// Shared Materials at Module Scope
const SKIN_MAT = new THREE.MeshStandardMaterial({
  color: '#ebbfa0',
  roughness: 0.62,
  metalness: 0.04,
});

const HAIR_MAT = new THREE.MeshStandardMaterial({
  color: '#1b1412',
  roughness: 0.72,
  metalness: 0.08,
});

const TROUSER_MAT = new THREE.MeshStandardMaterial({
  color: '#4f6279',
  roughness: 0.75,
  metalness: 0.05,
});

const COLLAR_MAT = new THREE.MeshStandardMaterial({
  color: '#889db8',
  roughness: 0.65,
  metalness: 0.08,
});

const ROSE_CRIMSON_MAT = new THREE.MeshStandardMaterial({
  color: '#e63956',
  emissive: '#7a1224',
  emissiveIntensity: 0.45,
  roughness: 0.36,
});

const LOTUS_OFFERING_MAT = new THREE.MeshStandardMaterial({
  color: '#ff94b8',
  emissive: '#b83265',
  emissiveIntensity: 0.58,
  roughness: 0.3,
});

const GOLD_PROP_MAT = new THREE.MeshStandardMaterial({
  color: '#fad155',
  metalness: 0.86,
  roughness: 0.22,
  emissive: '#784a06',
  emissiveIntensity: 0.4,
});

const LACQUER_TRAY_MAT = new THREE.MeshStandardMaterial({
  color: '#7a1118',
  metalness: 0.28,
  roughness: 0.32,
});

const FRUIT_POMELO_MAT = new THREE.MeshStandardMaterial({ color: '#8ac926', roughness: 0.44 });
const FRUIT_PERSIMMON_MAT = new THREE.MeshStandardMaterial({ color: '#f3722c', roughness: 0.36 });
const FRUIT_MANGO_MAT = new THREE.MeshStandardMaterial({ color: '#f9c74f', roughness: 0.34 });

const STEM_MAT = new THREE.MeshStandardMaterial({
  color: '#3b7a4a',
  roughness: 0.6,
});

const INCENSE_STICK_MAT = new THREE.MeshBasicMaterial({ color: '#a32929' });
const INCENSE_EMBER_MAT = new THREE.MeshBasicMaterial({ color: '#ff7b29' });

const LANTERN_PETAL_MAT = new THREE.MeshStandardMaterial({
  color: '#ff9ebb',
  emissive: '#d9534f',
  emissiveIntensity: 0.55,
  roughness: 0.35,
});
const LANTERN_FLAME_MAT = new THREE.MeshBasicMaterial({ color: '#fff3b0' });

const WOODEN_FISH_MAT = new THREE.MeshStandardMaterial({
  color: '#6e3214',
  roughness: 0.35,
  metalness: 0.14,
});
const CUSHION_RED_MAT = new THREE.MeshStandardMaterial({
  color: '#8c161b',
  roughness: 0.65,
});

const GOLD_BLESS_RING_MAT = new THREE.MeshBasicMaterial({
  color: '#ffd966',
  transparent: true,
  opacity: 0.78,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const GRAND_RING_MAT = new THREE.MeshBasicMaterial({
  color: '#ffea94',
  transparent: true,
  opacity: 0.68,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const ROBE_MATERIAL_POOL = [
  '#6a809c',
  '#748ba7',
  '#5f748f',
  '#7b91ad',
  '#647b96',
].map(
  (hex) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.7,
      metalness: 0.06,
    }),
);

interface WorshipperCharacterProps {
  participant: Participant;
  castShadows: boolean;
}

export function WorshipperCharacter({ participant, castShadows }: WorshipperCharacterProps) {
  const rootRef = useRef<THREE.Group>(null);
  const upperBodyRef = useRef<THREE.Group>(null);
  const leftArmPivotRef = useRef<THREE.Group>(null);
  const rightArmPivotRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const kneelingSkirtRef = useRef<THREE.Mesh>(null);

  const flowerPropRef = useRef<THREE.Group>(null);
  const incensePropRef = useRef<THREE.Group>(null);
  const lanternPropRef = useRef<THREE.Group>(null);
  const fruitTrayPropRef = useRef<THREE.Group>(null);
  const lotusPedestalPropRef = useRef<THREE.Group>(null);
  const pagodaPropRef = useRef<THREE.Group>(null);

  const woodenFishGroupRef = useRef<THREE.Group>(null);
  const woodenFishBodyMeshRef = useRef<THREE.Mesh>(null);
  const malletPropRef = useRef<THREE.Group>(null);
  const blessRingRef = useRef<THREE.Mesh>(null);
  const grandOuterRingRef = useRef<THREE.Mesh>(null);

  const seat = useMemo(() => getSeatPosition(participant.seatIndex), [participant.seatIndex]);
  const robeMat = useMemo(() => {
    const idx =
      Math.abs(Math.round((participant.robeHueShift + 0.5) * 20)) % ROBE_MATERIAL_POOL.length;
    return ROBE_MATERIAL_POOL[idx];
  }, [participant.robeHueShift]);

  const kin = useRef({
    x: participant.laneOffset,
    y: 0,
    z: ENTRANCE_Z,
    rotY: Math.PI, // Local +Z is character's front, so rotY = Math.PI faces -Z (toward Buddha!)
    stage: 'walking_aisle' as CharacterAnimState,
    stageTimer: 0,
    walkCycle: Math.random() * Math.PI * 2,
    lastExternalAnimAt: participant.animStateStartedAt,
    initializedSeatIdx: participant.seatIndex,
    activeRitualId: null as string | null,
    notifiedArrival: false,
    activeWoodenFishId: null as string | null,
    strikesPlayedCount: 0,
  });

  // React to seat reassignments, dispatched Altar Ceremonies, or queued Wooden Fish milestones
  useEffect(() => {
    if (kin.current.initializedSeatIdx !== participant.seatIndex) {
      kin.current.initializedSeatIdx = participant.seatIndex;
      kin.current.x = seat.x;
      kin.current.z = seat.z;
      kin.current.rotY = Math.PI;
      kin.current.activeRitualId = null;
      kin.current.activeWoodenFishId = null;
      kin.current.strikesPlayedCount = 0;
      kin.current.notifiedArrival = false;
      kin.current.stage = 'bowing';
      kin.current.stageTimer = 0;
      return;
    }

    // Dispatched Altar Ceremony: stand up -> walk to altar -> perform ceremony -> return to exact seat
    if (
      participant.activeRitual &&
      participant.activeRitual.id !== kin.current.activeRitualId
    ) {
      kin.current.activeRitualId = participant.activeRitual.id;
      kin.current.notifiedArrival = false;
      kin.current.stage = 'leaving_seat_to_aisle';
      kin.current.stageTimer = 0;
      return;
    }

    // Dispatched Seated Wooden Fish Milestone (10 / 100 / 1000 Likes)
    if (
      !participant.activeRitual &&
      participant.activeWoodenFish &&
      participant.activeWoodenFish.id !== kin.current.activeWoodenFishId
    ) {
      kin.current.activeWoodenFishId = participant.activeWoodenFish.id;
      kin.current.strikesPlayedCount = 0;
      kin.current.stage = 'wooden_fish';
      kin.current.stageTimer = 0;
      return;
    }

    // Seated prayer comments
    if (
      !participant.activeRitual &&
      !participant.activeWoodenFish &&
      participant.animStateStartedAt !== kin.current.lastExternalAnimAt
    ) {
      kin.current.lastExternalAnimAt = participant.animStateStartedAt;
      const isSeatedStage =
        kin.current.stage === 'sitting' ||
        kin.current.stage === 'bowing' ||
        kin.current.stage === 'kneeling' ||
        kin.current.stage === 'praying' ||
        kin.current.stage === 'wooden_fish' ||
        kin.current.stage === 'offering' ||
        kin.current.stage === 'gift_blessing';

      if (
        isSeatedStage &&
        (participant.animState === 'praying' ||
          participant.animState === 'offering' ||
          participant.animState === 'gift_blessing' ||
          participant.animState === 'bowing')
      ) {
        kin.current.stage = participant.animState;
        kin.current.stageTimer = 0;
      }
    }
  }, [
    participant.activeRitual,
    participant.activeWoodenFish,
    participant.animState,
    participant.animStateStartedAt,
    participant.seatIndex,
    seat.x,
    seat.z,
  ]);

  useEffect(() => {
    const uid = participant.userId;
    liveCharacterPositions.set(uid, {
      x: kin.current.x,
      y: 0,
      z: kin.current.z,
      headY: 1.38,
    });
    return () => {
      liveCharacterPositions.delete(uid);
    };
  }, [participant.userId]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.08);
    const k = kin.current;
    const t = state.clock.elapsedTime;
    const ritual = participant.activeRitual;
    const woodenFishAct = participant.activeWoodenFish;
    k.stageTimer += delta;

    const walkSpeed = 4.2;
    let isWalking = false;
    let isKneelingPosture = false;
    let targetTorsoPitch = 0;
    let handsJoined = false;

    let showFlower = false;
    let showIncense = false;
    let showLantern = false;
    let showFruitTray = false;
    let showLotusPedestal = false;
    let showPagoda = false;
    let showWoodenFish = false;
    let showBlessRing = false;
    let showGrandRing = false;

    let woodenFishRecoil = 1.0;
    let customRightArmPitch: number | null = null;
    let customLeftArmPitch: number | null = null;
    let targetRotY = k.rotY;

    // Helper for carrying props while walking outbound to the altar
    const applyCarriedPropFlags = () => {
      if (!ritual) return;
      switch (ritual.type) {
        case 'altar_flower':
          handsJoined = true;
          showFlower = true;
          break;
        case 'altar_incense':
          handsJoined = true;
          showIncense = true;
          break;
        case 'altar_lantern':
          handsJoined = true;
          showLantern = true;
          break;
        case 'altar_fruit_tray':
          handsJoined = true;
          showFruitTray = true;
          break;
        case 'altar_lotus_pedestal':
          handsJoined = true;
          showLotusPedestal = true;
          break;
        case 'altar_pagoda':
          handsJoined = true;
          showPagoda = true;
          break;
        default:
          break;
      }
    };

    switch (k.stage) {
      // === INITIAL ARRIVAL WALK FROM ENTRANCE TO ASSIGNED PERMANENT SEAT ===
      case 'walking_aisle': {
        isWalking = true;
        targetRotY = Math.PI;
        const dz = seat.aisleZ - k.z;
        if (Math.abs(dz) <= walkSpeed * delta * 1.15 || k.z <= seat.aisleZ) {
          k.z = seat.aisleZ;
          k.stage = 'turning_row';
          k.stageTimer = 0;
        } else {
          k.z -= walkSpeed * delta;
        }
        break;
      }

      case 'turning_row': {
        targetRotY = seat.side === 'left' ? -Math.PI / 2 : Math.PI / 2;
        if (k.stageTimer > 0.18) {
          k.stage = 'walking_row';
          k.stageTimer = 0;
        }
        break;
      }

      case 'walking_row': {
        isWalking = true;
        targetRotY = seat.side === 'left' ? -Math.PI / 2 : Math.PI / 2;
        const dx = seat.x - k.x;
        const step = walkSpeed * 0.94 * delta;
        if (Math.abs(dx) <= step * 1.2) {
          k.x = seat.x;
          k.stage = 'turning_altar';
          k.stageTimer = 0;
        } else {
          k.x += Math.sign(dx) * step;
        }
        break;
      }

      case 'turning_altar': {
        isWalking = true;
        targetRotY = Math.PI;
        k.z = THREE.MathUtils.damp(k.z, seat.z, 9, delta);
        if (Math.abs(k.z - seat.z) < 0.04 && k.stageTimer > 0.25) {
          k.z = seat.z;
          if (k.activeRitualId) {
            const finishedId = k.activeRitualId;
            k.activeRitualId = null;
            k.notifiedArrival = false;
            tiktokEventManager.completeCharacterRitual(participant.userId, finishedId);
          }
          k.stage = 'kneeling';
          k.stageTimer = 0;
        }
        break;
      }

      // === OUTBOUND JOURNEY FROM SEAT TO BUDDHA ALTAR ===
      case 'leaving_seat_to_aisle': {
        if (!ritual) {
          k.stage = 'turning_altar';
          k.stageTimer = 0;
          break;
        }
        isWalking = true;
        applyCarriedPropFlags();

        k.z = THREE.MathUtils.damp(k.z, seat.aisleZ, 10, delta);
        const dx = ritual.outboundLaneX - k.x;
        targetRotY = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        const step = walkSpeed * 0.96 * delta;
        if (Math.abs(dx) <= step * 1.25) {
          k.x = ritual.outboundLaneX;
          k.z = seat.aisleZ;
          k.stage = 'walking_to_altar';
          k.stageTimer = 0;
        } else {
          k.x += Math.sign(dx) * step;
        }
        break;
      }

      case 'walking_to_altar': {
        if (!ritual) {
          k.stage = 'returning_from_altar';
          k.stageTimer = 0;
          break;
        }
        isWalking = true;
        applyCarriedPropFlags();

        const targetXNow = k.z > -6.9 ? ritual.outboundLaneX : ritual.targetX;
        const dx = targetXNow - k.x;
        const dz = ritual.targetZ - k.z;
        const dist = Math.hypot(dx, dz);
        const step = walkSpeed * 1.08 * delta;

        if (dist <= step * 1.25) {
          k.x = ritual.targetX;
          k.z = ritual.targetZ;
          k.stage = 'performing_altar_ritual';
          k.stageTimer = 0;
          if (!k.notifiedArrival) {
            k.notifiedArrival = true;
            tiktokEventManager.notifyAltarRitualArrived(participant.userId, ritual.id);
          }
        } else {
          const vx = (dx / dist) * step;
          const vz = (dz / dist) * step;
          k.x += vx;
          k.z += vz;
          targetRotY = Math.atan2(vx, vz);
        }
        break;
      }

      case 'performing_altar_ritual': {
        if (!ritual) {
          k.stage = 'returning_from_altar';
          k.stageTimer = 0;
          break;
        }
        targetRotY = ritual.faceRotY;
        const rDurSec = Math.max(2.8, ritual.durationMs / 1000);
        const progress = Math.min(1, k.stageTimer / rDurSec);

        switch (ritual.type) {
          case 'altar_incense': {
            isKneelingPosture = false;
            handsJoined = true;
            showIncense = progress < 0.85;
            showBlessRing = true;
            const bowWave = Math.sin(progress * Math.PI * 3);
            targetTorsoPitch = Math.max(0, bowWave) * 0.56;
            break;
          }

          case 'altar_flower': {
            // Hoa Hồng – Cầu Bình An: Carry flowers, offer them forward, and bow respectfully
            isKneelingPosture = progress >= 0.32;
            handsJoined = true;
            showFlower = progress < 0.72;
            showBlessRing = true;
            const bowWave = Math.sin(progress * Math.PI * 2);
            targetTorsoPitch = 0.2 + Math.max(0, bowWave) * 0.52;
            break;
          }

          case 'altar_fruit_tray': {
            // Mâm Quả – Cầu Gia Đạo: Place decorated 5-fruit tray at offering station & bow respectfully
            isKneelingPosture = progress >= 0.42;
            handsJoined = true;
            showFruitTray = progress < 0.56; // Placed onto the illuminated altar table at 56%!
            showBlessRing = true;
            targetTorsoPitch =
              progress < 0.56
                ? Math.sin((progress / 0.56) * Math.PI) * 0.46
                : Math.sin(((progress - 0.56) / 0.44) * Math.PI * 2) * 0.62;
            break;
          }

          case 'altar_lotus_pedestal': {
            // Đài Sen – Cầu Tài Lộc: Present glowing lotus pedestal with swirling lotus-petal aura & bow
            isKneelingPosture = true;
            handsJoined = true;
            showLotusPedestal = progress < 0.78;
            showBlessRing = true;
            showGrandRing = true;
            const bowWave = Math.sin(progress * Math.PI * 2);
            targetTorsoPitch = 0.18 + Math.max(0, bowWave) * 0.54;
            break;
          }

          case 'altar_lantern': {
            isKneelingPosture = true;
            handsJoined = true;
            showLantern = progress < 0.58;
            showBlessRing = true;
            targetTorsoPitch =
              progress < 0.58
                ? Math.sin((progress / 0.58) * Math.PI) * 0.62
                : Math.sin(((progress - 0.58) / 0.42) * Math.PI) * 0.45;
            break;
          }

          case 'altar_bell': {
            // Chuông Đồng – Cầu Sức Khỏe: Walk to bell station, bow, and strike the bronze bell
            isKneelingPosture = false;
            handsJoined = true;
            showBlessRing = true;
            const strikePulse = Math.sin(progress * Math.PI * 2.5);
            targetTorsoPitch = 0.18 + Math.max(0, strikePulse) * 0.36;
            customLeftArmPitch = -1.15 - Math.max(0, strikePulse) * 0.48;
            customRightArmPitch = -1.15 - Math.max(0, strikePulse) * 0.48;
            break;
          }

          case 'altar_pagoda':
          case 'altar_grand_ceremony':
          default: {
            // Bảo Tháp – Cầu Công Đức: Present 5-tiered Golden Pagoda + 3 deep ceremonial prostrations (Tam Bái)
            isKneelingPosture = true;
            handsJoined = true;
            showPagoda = progress < 0.42; // Presented then enshrined on sanctuary altar!
            showBlessRing = true;
            showGrandRing = true;
            const prostrationWave = Math.sin(progress * Math.PI * 3);
            targetTorsoPitch = Math.max(0, prostrationWave) * 0.84;
            break;
          }
        }

        if (k.stageTimer >= rDurSec) {
          k.stage = 'returning_from_altar';
          k.stageTimer = 0;
        }
        break;
      }

      // === RETURN JOURNEY FROM ALTAR BACK TO EXACT ORIGINAL RESERVED SEAT ===
      case 'returning_from_altar': {
        isWalking = true;
        const returnLaneX = ritual ? ritual.returnLaneX : seat.side === 'left' ? -1.04 : 1.04;
        const dx = returnLaneX - k.x;
        const dz = seat.aisleZ - k.z;
        const dist = Math.hypot(dx, dz);
        const step = walkSpeed * 1.06 * delta;

        if (k.z >= seat.aisleZ - 0.08 || dist <= step * 1.2) {
          k.x = returnLaneX;
          k.z = seat.aisleZ;
          k.stage = 'returning_row';
          k.stageTimer = 0;
        } else {
          const targetStepX =
            Math.abs(dx) > 0.08 ? Math.sign(dx) * Math.min(Math.abs(dx), step * 0.85) : 0;
          const targetStepZ = step;
          k.x += targetStepX;
          k.z += targetStepZ;
          targetRotY = Math.atan2(targetStepX, targetStepZ);
        }
        break;
      }

      case 'returning_row': {
        isWalking = true;
        const dx = seat.x - k.x;
        targetRotY = dx >= 0 ? Math.PI / 2 : -Math.PI / 2;
        const step = walkSpeed * 0.96 * delta;
        if (Math.abs(dx) <= step * 1.25) {
          k.x = seat.x;
          k.stage = 'turning_altar';
          k.stageTimer = 0;
        } else {
          k.x += Math.sign(dx) * step;
        }
        break;
      }

      // === SEATED DEVOTIONAL STATES AT RESERVED MAT ===
      case 'kneeling': {
        targetRotY = Math.PI;
        isKneelingPosture = true;
        handsJoined = true;
        if (k.stageTimer > 0.5) {
          k.stage = 'bowing';
          k.stageTimer = 0;
        }
        break;
      }

      case 'bowing': {
        targetRotY = Math.PI;
        isKneelingPosture = true;
        handsJoined = true;
        const bowWave = Math.sin(Math.min(1, k.stageTimer / 2.4) * Math.PI * 2);
        targetTorsoPitch = Math.max(0, bowWave) * 0.68;
        if (k.stageTimer >= 2.45) {
          k.stage = 'sitting';
          k.stageTimer = 0;
        }
        break;
      }

      case 'praying': {
        targetRotY = Math.PI;
        isKneelingPosture = true;
        handsJoined = true;
        showBlessRing = true;
        const prayWave = Math.sin(Math.min(1, k.stageTimer / 3.6) * Math.PI * 2);
        targetTorsoPitch = Math.max(0, prayWave) * 0.78;
        if (k.stageTimer >= 3.65) {
          k.stage = 'sitting';
          k.stageTimer = 0;
        }
        break;
      }

      case 'wooden_fish': {
        // SYNCHRONIZED LIKE = GÕ MÕ MILESTONE SYSTEM (1 strike / 3 strikes / 6-strike ceremony)
        targetRotY = Math.PI;
        isKneelingPosture = true;
        handsJoined = false;
        showWoodenFish = true;

        const totalStrikes = woodenFishAct ? woodenFishAct.strikeCount : 1;
        const tier = woodenFishAct ? woodenFishAct.tier : 'like_10';
        const totalDurSec = woodenFishAct ? woodenFishAct.durationMs / 1000 : 1.25;
        const singleStrikeDur = totalDurSec / totalStrikes;

        showBlessRing = tier === 'like_100' || tier === 'like_1000';
        showGrandRing = tier === 'like_1000';

        const currentStrikeFloat = k.stageTimer / singleStrikeDur;
        const currentStrikeIdx = Math.min(totalStrikes - 1, Math.floor(currentStrikeFloat));
        const withinStrikePhase = currentStrikeFloat - Math.floor(currentStrikeFloat); // 0..1

        // Trigger authentic wooden drum audio at the exact mallet impact frame (phase >= 0.42)!
        if (
          k.strikesPlayedCount <= currentStrikeIdx &&
          k.strikesPlayedCount < totalStrikes &&
          withinStrikePhase >= 0.42
        ) {
          const strikeIdxToPlay = k.strikesPlayedCount;
          k.strikesPlayedCount += 1;
          tiktokEventManager.recordWoodenFishStrike(participant.userId, tier, strikeIdxToPlay);
        }

        // Smooth raise (0..0.42) -> crisp downstroke impact (0.42..0.55) -> rebound (0.55..1.0)
        const downStrokeCurve = Math.sin(Math.min(1, withinStrikePhase) * Math.PI);
        const isImpactWindow = withinStrikePhase >= 0.4 && withinStrikePhase <= 0.6;
        woodenFishRecoil = isImpactWindow ? 1.12 : 1.0;

        targetTorsoPitch = 0.08 + downStrokeCurve * (tier === 'like_1000' ? 0.16 : 0.08);
        customLeftArmPitch = -1.04; // Left hand held respectfully in half-lotus mudra (chắp tay đơn)
        // Right arm raises (-1.35) then snaps down onto the carved Mõ Gỗ (-0.68) at phase 0.45!
        customRightArmPitch =
          withinStrikePhase < 0.44
            ? THREE.MathUtils.lerp(-0.92, -1.36, withinStrikePhase / 0.44)
            : THREE.MathUtils.lerp(-0.66, -0.95, Math.min(1, (withinStrikePhase - 0.44) / 0.56));

        if (k.stageTimer >= totalDurSec) {
          if (woodenFishAct) {
            const doneId = woodenFishAct.id;
            k.activeWoodenFishId = null;
            k.strikesPlayedCount = 0;
            tiktokEventManager.completeWoodenFishAction(participant.userId, doneId);
          }
          k.stage = 'sitting';
          k.stageTimer = 0;
        }
        break;
      }

      case 'offering': {
        targetRotY = Math.PI;
        isKneelingPosture = true;
        handsJoined = true;
        showFlower = true;
        showBlessRing = true;
        targetTorsoPitch = 0.26 + Math.sin(k.stageTimer * 2.6) * 0.16;
        if (k.stageTimer >= 4.2) {
          k.stage = 'sitting';
          k.stageTimer = 0;
        }
        break;
      }

      case 'gift_blessing': {
        targetRotY = Math.PI;
        isKneelingPosture = true;
        handsJoined = true;
        showFlower = true;
        showBlessRing = true;
        showGrandRing = true;
        const blessWave = Math.sin(Math.min(1, k.stageTimer / 5.0) * Math.PI * 3);
        targetTorsoPitch = Math.max(0, blessWave) * 0.75;
        if (k.stageTimer >= 5.1) {
          k.stage = 'sitting';
          k.stageTimer = 0;
        }
        break;
      }

      case 'sitting':
      default: {
        targetRotY = Math.PI;
        isKneelingPosture = true;
        handsJoined = true;
        targetTorsoPitch = 0.04 + Math.sin(t * 1.5 + participant.seatIndex) * 0.025;
        break;
      }
    }

    // Shortest-arc rotation interpolation
    let angleDiff = targetRotY - k.rotY;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    k.rotY += angleDiff * Math.min(1, delta * 11);

    // Height & walk bobbing
    let targetBaseY = isKneelingPosture ? 0.05 : 0;
    if (isWalking) {
      k.walkCycle += delta * 11.0;
      targetBaseY += Math.abs(Math.sin(k.walkCycle)) * 0.045;
    }
    k.y = THREE.MathUtils.damp(k.y, targetBaseY, 12, delta);

    if (rootRef.current) {
      rootRef.current.position.set(k.x, k.y, k.z);
      rootRef.current.rotation.y = k.rotY;
    }

    if (upperBodyRef.current) {
      const targetUpperY = isKneelingPosture ? 0.24 : 0.44;
      upperBodyRef.current.position.y = THREE.MathUtils.damp(
        upperBodyRef.current.position.y,
        targetUpperY,
        10,
        delta,
      );
      upperBodyRef.current.rotation.x = THREE.MathUtils.damp(
        upperBodyRef.current.rotation.x,
        targetTorsoPitch,
        9,
        delta,
      );
    }

    if (leftLegRef.current && rightLegRef.current && kneelingSkirtRef.current) {
      leftLegRef.current.visible = !isKneelingPosture;
      rightLegRef.current.visible = !isKneelingPosture;
      kneelingSkirtRef.current.visible = isKneelingPosture;

      if (isWalking) {
        const swing = Math.sin(k.walkCycle) * 0.52;
        leftLegRef.current.rotation.x = swing;
        rightLegRef.current.rotation.x = -swing;
      } else {
        leftLegRef.current.rotation.x = 0;
        rightLegRef.current.rotation.x = 0;
      }
    }

    const carryingHeavyTray = showFruitTray || showLotusPedestal || showPagoda;

    if (leftArmPivotRef.current && rightArmPivotRef.current) {
      if (customLeftArmPitch !== null && customRightArmPitch !== null) {
        leftArmPivotRef.current.rotation.x = THREE.MathUtils.damp(
          leftArmPivotRef.current.rotation.x,
          customLeftArmPitch,
          12,
          delta,
        );
        leftArmPivotRef.current.rotation.z = THREE.MathUtils.damp(
          leftArmPivotRef.current.rotation.z,
          -0.34,
          10,
          delta,
        );
        rightArmPivotRef.current.rotation.x = THREE.MathUtils.damp(
          rightArmPivotRef.current.rotation.x,
          customRightArmPitch,
          20,
          delta,
        );
        rightArmPivotRef.current.rotation.z = THREE.MathUtils.damp(
          rightArmPivotRef.current.rotation.z,
          0.14,
          10,
          delta,
        );
      } else if (handsJoined) {
        const raiseExtra = showIncense
          ? -0.34
          : carryingHeavyTray
            ? -0.26
            : showFlower || showLantern
              ? -0.22
              : 0;
        const armSpreadZ = carryingHeavyTray ? 0.28 : 0.46;

        leftArmPivotRef.current.rotation.x = THREE.MathUtils.damp(
          leftArmPivotRef.current.rotation.x,
          -1.08 + raiseExtra,
          10,
          delta,
        );
        leftArmPivotRef.current.rotation.z = THREE.MathUtils.damp(
          leftArmPivotRef.current.rotation.z,
          -armSpreadZ,
          10,
          delta,
        );
        rightArmPivotRef.current.rotation.x = THREE.MathUtils.damp(
          rightArmPivotRef.current.rotation.x,
          -1.08 + raiseExtra,
          10,
          delta,
        );
        rightArmPivotRef.current.rotation.z = THREE.MathUtils.damp(
          rightArmPivotRef.current.rotation.z,
          armSpreadZ,
          10,
          delta,
        );
      } else {
        const armSwing = isWalking ? Math.sin(k.walkCycle) * 0.42 : 0;
        leftArmPivotRef.current.rotation.x = -armSwing;
        leftArmPivotRef.current.rotation.z = 0.08;
        rightArmPivotRef.current.rotation.x = armSwing;
        rightArmPivotRef.current.rotation.z = -0.08;
      }
    }

    if (flowerPropRef.current) flowerPropRef.current.visible = showFlower;
    if (incensePropRef.current) incensePropRef.current.visible = showIncense;
    if (lanternPropRef.current) lanternPropRef.current.visible = showLantern;
    if (fruitTrayPropRef.current) fruitTrayPropRef.current.visible = showFruitTray;
    if (lotusPedestalPropRef.current) lotusPedestalPropRef.current.visible = showLotusPedestal;
    if (pagodaPropRef.current) pagodaPropRef.current.visible = showPagoda;

    if (woodenFishGroupRef.current) woodenFishGroupRef.current.visible = showWoodenFish;
    if (malletPropRef.current) malletPropRef.current.visible = showWoodenFish;
    if (woodenFishBodyMeshRef.current && showWoodenFish) {
      const s = THREE.MathUtils.damp(
        woodenFishBodyMeshRef.current.scale.y,
        0.84 * woodenFishRecoil,
        22,
        delta,
      );
      woodenFishBodyMeshRef.current.scale.set(1.18 * woodenFishRecoil, s, 1.05 * woodenFishRecoil);
    }

    if (blessRingRef.current) {
      blessRingRef.current.visible = showBlessRing;
      if (showBlessRing) {
        const pulse = 1 + Math.sin(t * 5) * 0.1;
        blessRingRef.current.scale.set(pulse, pulse, 1);
      }
    }

    if (grandOuterRingRef.current) {
      grandOuterRingRef.current.visible = showGrandRing;
      if (showGrandRing) {
        const pulse2 = 1.08 + Math.cos(t * 4.2) * 0.16;
        grandOuterRingRef.current.scale.set(pulse2, pulse2, 1);
        grandOuterRingRef.current.rotation.z = t * 0.8;
      }
    }

    const liveEntry = liveCharacterPositions.get(participant.userId);
    if (liveEntry) {
      liveEntry.x = k.x;
      liveEntry.y = k.y;
      liveEntry.z = k.z;
      liveEntry.headY = isKneelingPosture ? 1.12 : 1.38;
    }
  });

  return (
    <group
      ref={rootRef}
      position={[participant.laneOffset, 0, ENTRANCE_Z]}
      rotation={[0, Math.PI, 0]}
    >
      {/* Golden Blessing Ring beneath character */}
      <mesh
        ref={blessRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        visible={false}
        geometry={SHARED_GEOS.ringInner}
        material={GOLD_BLESS_RING_MAT}
      />

      {/* Ceremonial Outer Mandala Ring */}
      <mesh
        ref={grandOuterRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 0]}
        visible={false}
        geometry={SHARED_GEOS.ringOuter}
        material={GRAND_RING_MAT}
      />

      {/* Carved Rosewood Wooden Fish Drum (Mõ Chùa Việt Nam) placed on cushion in front of mat */}
      <group ref={woodenFishGroupRef} position={[0.15, 0.02, 0.44]} visible={false}>
        <mesh
          position={[0, 0.019, 0]}
          geometry={SHARED_GEOS.woodenFishCushion}
          material={CUSHION_RED_MAT}
        />
        <mesh
          ref={woodenFishBodyMeshRef}
          position={[0, 0.098, 0]}
          scale={[1.18, 0.84, 1.05]}
          geometry={SHARED_GEOS.woodenFishBody}
          material={WOODEN_FISH_MAT}
        />
        <mesh
          position={[0, 0.13, 0]}
          rotation={[0, Math.PI / 2, 0]}
          geometry={SHARED_GEOS.woodenFishRidge}
          material={GOLD_PROP_MAT}
        />
      </group>

      {/* Standing/Walking Legs */}
      <mesh
        ref={leftLegRef}
        position={[-0.085, 0.22, 0]}
        geometry={SHARED_GEOS.leg}
        material={TROUSER_MAT}
        castShadow={castShadows}
      />
      <mesh
        ref={rightLegRef}
        position={[0.085, 0.22, 0]}
        geometry={SHARED_GEOS.leg}
        material={TROUSER_MAT}
        castShadow={castShadows}
      />

      {/* Seated/Kneeling Tucked Robe Base */}
      <mesh
        ref={kneelingSkirtRef}
        position={[0, 0.11, -0.02]}
        scale={[1.05, 1, 1.15]}
        geometry={SHARED_GEOS.kneelingBase}
        material={robeMat}
        visible={false}
        castShadow={castShadows}
      />

      {/* Upper Articulated Body (Torso + Head + Arms + Ceremonial Props) */}
      <group ref={upperBodyRef} position={[0, 0.44, 0]}>
        <mesh
          position={[0, 0.26, 0]}
          geometry={SHARED_GEOS.torso}
          material={robeMat}
          castShadow={castShadows}
        />
        <mesh
          position={[0.02, 0.34, 0.175]}
          rotation={[0, 0, -0.36]}
          geometry={SHARED_GEOS.collarSash}
          material={COLLAR_MAT}
        />

        {/* Head & Hair */}
        <group position={[0, 0.72, 0]}>
          <mesh geometry={SHARED_GEOS.head} material={SKIN_MAT} castShadow={castShadows} />
          <mesh
            position={[0, 0.02, -0.015]}
            rotation={[-0.18, 0, 0]}
            geometry={SHARED_GEOS.hairCap}
            material={HAIR_MAT}
          />
          {participant.hasHairBun && (
            <mesh
              position={[0, 0.15, -0.12]}
              geometry={SHARED_GEOS.hairBun}
              material={HAIR_MAT}
            />
          )}
        </group>

        {/* Left Articulated Arm + Hand */}
        <group ref={leftArmPivotRef} position={[-0.2, 0.48, 0]}>
          <mesh position={[0, -0.15, 0]} geometry={SHARED_GEOS.upperArm} material={robeMat} />
          <mesh position={[0, -0.32, 0]} geometry={SHARED_GEOS.hand} material={SKIN_MAT} />
        </group>

        {/* Right Articulated Arm + Hand + Wooden Drum Mallet (Dùi Gõ Mõ) */}
        <group ref={rightArmPivotRef} position={[0.2, 0.48, 0]}>
          <mesh position={[0, -0.15, 0]} geometry={SHARED_GEOS.upperArm} material={robeMat} />
          <mesh position={[0, -0.32, 0]} geometry={SHARED_GEOS.hand} material={SKIN_MAT} />
          <group
            ref={malletPropRef}
            position={[0, -0.35, 0.1]}
            rotation={[Math.PI / 2.15, 0, 0]}
            visible={false}
          >
            <mesh geometry={SHARED_GEOS.woodenFishMallet} material={WOODEN_FISH_MAT} />
            <mesh
              position={[0, 0.12, 0]}
              geometry={SHARED_GEOS.woodenFishMalletTip}
              material={LACQUER_TRAY_MAT}
            />
          </group>
        </group>

        {/* PROP 1: Hoa Hồng – Cầu Bình An (Blooming Rose & Lotus Bouquet) */}
        <group
          ref={flowerPropRef}
          position={[0, 0.46, 0.33]}
          rotation={[0.32, 0, 0]}
          visible={false}
        >
          <mesh position={[0, -0.09, 0]} geometry={SHARED_GEOS.lotusStem} material={STEM_MAT} />
          <mesh
            position={[0, 0.04, 0]}
            geometry={SHARED_GEOS.rosePetalCone}
            material={LOTUS_OFFERING_MAT}
          />
          <mesh
            position={[0, 0.07, 0]}
            geometry={SHARED_GEOS.roseBloomCenter}
            material={ROSE_CRIMSON_MAT}
          />
          <mesh
            position={[-0.07, 0.03, 0.02]}
            rotation={[0, 0, 0.35]}
            geometry={SHARED_GEOS.roseBloomCenter}
            material={ROSE_CRIMSON_MAT}
          />
          <mesh
            position={[0.07, 0.03, 0.02]}
            rotation={[0, 0, -0.35]}
            geometry={SHARED_GEOS.roseBloomCenter}
            material={LOTUS_OFFERING_MAT}
          />
        </group>

        {/* PROP 2: Thắp Hương (3 Glowing Incense Sticks) */}
        <group
          ref={incensePropRef}
          position={[0, 0.56, 0.34]}
          rotation={[0.22, 0, 0]}
          visible={false}
        >
          {[-0.025, 0, 0.025].map((ix, idx) => (
            <group key={idx} position={[ix, 0, 0]} rotation={[0, 0, (idx - 1) * 0.06]}>
              <mesh geometry={SHARED_GEOS.incenseStick} material={INCENSE_STICK_MAT} />
              <mesh
                position={[0, 0.18, 0]}
                geometry={SHARED_GEOS.incenseTip}
                material={INCENSE_EMBER_MAT}
              />
            </group>
          ))}
        </group>

        {/* PROP 3: Hoa Đăng (Floating Water Lantern) */}
        <group ref={lanternPropRef} position={[0, 0.42, 0.34]} visible={false}>
          <mesh geometry={SHARED_GEOS.lanternBase} material={LANTERN_PETAL_MAT} />
          <mesh
            position={[0, 0.05, 0]}
            geometry={SHARED_GEOS.lanternCore}
            material={LANTERN_FLAME_MAT}
          />
        </group>

        {/* PROP 4: Mâm Quả – Cầu Gia Đạo (Decorated Vietnamese Five-Fruit Lacquer Tray) */}
        <group ref={fruitTrayPropRef} position={[0, 0.43, 0.38]} visible={false}>
          <mesh
            position={[0, -0.04, 0]}
            geometry={SHARED_GEOS.fruitTrayFoot}
            material={GOLD_PROP_MAT}
          />
          <mesh
            position={[0, 0.015, 0]}
            geometry={SHARED_GEOS.fruitTrayPlate}
            material={LACQUER_TRAY_MAT}
          />
          <mesh
            position={[0, 0.075, 0]}
            geometry={SHARED_GEOS.fruitLarge}
            material={FRUIT_POMELO_MAT}
          />
          <mesh
            position={[-0.085, 0.06, 0.045]}
            geometry={SHARED_GEOS.fruitSmall}
            material={FRUIT_PERSIMMON_MAT}
          />
          <mesh
            position={[0.085, 0.06, 0.045]}
            geometry={SHARED_GEOS.fruitSmall}
            material={FRUIT_MANGO_MAT}
          />
          <mesh
            position={[0, 0.06, -0.08]}
            geometry={SHARED_GEOS.fruitSmall}
            material={ROSE_CRIMSON_MAT}
          />
        </group>

        {/* PROP 5: Đài Sen – Cầu Tài Lộc (Radiant Glowing Lotus Offering Pedestal) */}
        <group ref={lotusPedestalPropRef} position={[0, 0.45, 0.38]} visible={false}>
          <mesh
            position={[0, -0.05, 0]}
            geometry={SHARED_GEOS.lotusPedestalFoot}
            material={GOLD_PROP_MAT}
          />
          <mesh
            position={[0, 0.02, 0]}
            geometry={SHARED_GEOS.lotusPedestalRing}
            material={LOTUS_OFFERING_MAT}
          />
          {[0, 1, 2, 3, 4, 5].map((pi) => {
            const ang = (pi / 6) * Math.PI * 2;
            return (
              <mesh
                key={pi}
                position={[Math.cos(ang) * 0.12, 0.05, Math.sin(ang) * 0.12]}
                rotation={[Math.sin(ang) * 0.45, 0, -Math.cos(ang) * 0.45]}
                geometry={SHARED_GEOS.lotusPedestalPetal}
                material={LOTUS_OFFERING_MAT}
              />
            );
          })}
          <mesh
            position={[0, 0.08, 0]}
            geometry={SHARED_GEOS.lanternCore}
            material={LANTERN_FLAME_MAT}
          />
        </group>

        {/* PROP 6: Bảo Tháp – Cầu Công Đức (5-Tiered Golden Buddhist Reliquary Pagoda) */}
        <group ref={pagodaPropRef} position={[0, 0.44, 0.38]} visible={false}>
          <mesh
            position={[0, -0.05, 0]}
            geometry={SHARED_GEOS.pagodaBase}
            material={LACQUER_TRAY_MAT}
          />
          <mesh
            position={[0, 0.02, 0]}
            geometry={SHARED_GEOS.pagodaTier1}
            material={GOLD_PROP_MAT}
          />
          <mesh
            position={[0, 0.095, 0]}
            geometry={SHARED_GEOS.pagodaTier2}
            material={GOLD_PROP_MAT}
          />
          <mesh
            position={[0, 0.165, 0]}
            geometry={SHARED_GEOS.pagodaTier3}
            material={GOLD_PROP_MAT}
          />
          <mesh
            position={[0, 0.26, 0]}
            geometry={SHARED_GEOS.pagodaSpire}
            material={LANTERN_FLAME_MAT}
          />
        </group>
      </group>
    </group>
  );
}
