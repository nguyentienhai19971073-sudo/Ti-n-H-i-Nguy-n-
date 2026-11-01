import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ActiveGiftVisualEffect,
  ActiveXinXamVisualState,
  AltarStationId,
  BuddhaModelLoadStatus,
  DEFAULT_SCENE_CALIBRATION,
  Participant,
  QualityPreset,
  SceneCalibrationSettings,
  StreamOverlaySettings,
} from '../../types/temple';
import { configureTempleCamera, getSeatPosition } from '../../systems/SeatManager';
import {
  IMAGE_BG_CAMERA_BASE,
  configureImageBackgroundCamera,
  getImageCalibratedAltarStation,
  getImageCalibratedSeatPosition,
} from '../../systems/SceneCalibration';
import {
  LabelCandidateInput,
  SolvedOverlayPlacement,
  solveLabelAndBubbleLayout,
} from '../../systems/LabelCollisionManager';
import {
  buildCharacterNameLabelStyle,
  buildCommentBubbleStyle,
} from '../../systems/OverlayTheme';
import { TempleEnvironment } from './TempleEnvironment';
import { BuddhaAltar } from './BuddhaAltar';
import { CharacterManager } from './CharacterManager';
import { GiftEffectManager } from './GiftEffectManager';
import { createRadialGlowTexture, liveCharacterPositions } from './templeResources';

interface TempleSceneProps {
  participants: Participant[];
  activeEffects: ActiveGiftVisualEffect[];
  altarGlowUntil: number;
  bellRingUntil: number;
  incenseGlowUntil: number;
  fruitGlowUntil: number;
  lotusGlowUntil: number;
  pagodaGlowUntil: number;
  xinXamGlowUntil?: number;
  activeXinXamVisual?: ActiveXinXamVisualState | null;
  floatingLanternCount: number;
  overlaySettings: StreamOverlaySettings;
  sceneCalibration?: SceneCalibrationSettings;
  currentSpeakerUserId?: string | null;
  onBuddhaModelStatus?: (status: BuddhaModelLoadStatus, detail?: string) => void;
}

const MAX_LABEL_SLOTS = 96;
const COMMENT_BUBBLE_DURATION_MS = 5000;

/**
 * Dynamically configures the camera, scene background, fog, and WebGL clear alpha
 * for either `IMAGE BACKGROUND` mode (calibrated to `/assets/temple-background.png`)
 * or `ORIGINAL 3D TEMPLE` mode.
 */
function SceneModeAndCameraController({
  sceneCalibration,
}: {
  sceneCalibration: SceneCalibrationSettings;
}) {
  const { camera, scene, gl, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (sceneCalibration.sceneMode === 'image_background') {
      scene.background = null;
      scene.fog = null;
      gl.setClearColor(0x000000, 0);
      const aspect = size.width / Math.max(1, size.height);
      configureImageBackgroundCamera(cam, aspect, sceneCalibration);
    } else {
      const darkBg = new THREE.Color('#130704');
      scene.background = darkBg;
      scene.fog = new THREE.FogExp2('#130704', 0.0145);
      gl.setClearColor(darkBg, 1);
      configureTempleCamera(cam, size.width, size.height);
    }
  }, [camera, scene, gl, size.width, size.height, sceneCalibration]);

  return null;
}

/**
 * Warm Buddhist temple studio lighting + transparent shadow-receiving floor catcher
 * + compact standalone 3D Xin Xăm bamboo stand for `IMAGE BACKGROUND` mode.
 *
 * IMPORTANT: Never renders a second Buddha statue, pillars, walls, lanterns, or duplicate main altar!
 */
function ImageBackgroundFloorLayer({
  quality,
  sceneCalibration,
  altarGlowUntil,
  bellRingUntil,
  lotusGlowUntil,
  pagodaGlowUntil,
  xinXamGlowUntil = 0,
  activeXinXamVisual = null,
}: {
  quality: QualityPreset;
  sceneCalibration: SceneCalibrationSettings;
  altarGlowUntil: number;
  bellRingUntil: number;
  lotusGlowUntil: number;
  pagodaGlowUntil: number;
  xinXamGlowUntil?: number;
  activeXinXamVisual?: ActiveXinXamVisualState | null;
}) {
  const xinXamTubeRef = useRef<THREE.Group>(null);
  const xinXamGlowStickRef = useRef<THREE.Group>(null);
  const ceremonyFloorLightRef = useRef<THREE.PointLight>(null);

  const haloGlowTex = useMemo(
    () => createRadialGlowTexture('#ffe89e', 'rgba(255, 196, 68, 0.35)'),
    [],
  );
  const darkWoodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2b1309',
        roughness: 0.55,
        metalness: 0.14,
      }),
    [],
  );
  const crimsonMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8f1b24',
        roughness: 0.42,
        metalness: 0.12,
      }),
    [],
  );
  const goldTrimMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f2c349',
        roughness: 0.25,
        metalness: 0.86,
        emissive: '#6e4105',
        emissiveIntensity: 0.26,
      }),
    [],
  );
  const bambooMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d9b36c',
        roughness: 0.52,
        metalness: 0.08,
      }),
    [],
  );

  const xinXamStation = useMemo(
    () => getImageCalibratedAltarStation('xin_xam_station', sceneCalibration),
    [sceneCalibration],
  );

  useFrame((state) => {
    const now = Date.now();
    const t = state.clock.elapsedTime;

    if (ceremonyFloorLightRef.current) {
      const anyGlow =
        now < altarGlowUntil ||
        now < bellRingUntil ||
        now < lotusGlowUntil ||
        now < pagodaGlowUntil ||
        now < xinXamGlowUntil;
      ceremonyFloorLightRef.current.intensity = anyGlow
        ? 2.2 + Math.sin(t * 5.2) * 0.45
        : 0.85;
    }

    const stage = activeXinXamVisual?.stage;
    if (xinXamTubeRef.current) {
      // Hide resting bamboo cylinder while worshipper is holding & shaking it in hand
      const heldByUser =
        stage === 'pickup_tube' || stage === 'shaking' || stage === 'stick_falling';
      xinXamTubeRef.current.visible = !heldByUser;
    }

    if (xinXamGlowStickRef.current) {
      const showStick = stage === 'stick_falling' || stage === 'revealed' || now < xinXamGlowUntil;
      xinXamGlowStickRef.current.visible = showStick;
      if (showStick) {
        xinXamGlowStickRef.current.position.y = 1.28 + Math.sin(t * 3.8) * 0.05;
        xinXamGlowStickRef.current.rotation.y = Math.sin(t * 1.6) * 0.18;
      }
    }
  });

  const castShadow = quality !== 'low';
  const shadowMapSize = quality === 'high' ? 1536 : 1024;

  return (
    <group>
      {/* Warm Golden Sanctuary Studio Lighting matching `temple-background.png` */}
      <hemisphereLight args={['#ffe6ab', '#4f2412', 1.18]} />
      <ambientLight color="#ffd89a" intensity={0.42} />

      {/* Overhead Chandelier Warm Golden Key Light */}
      <directionalLight
        position={[0, 18.5, 4.5]}
        intensity={1.55}
        color="#ffdf94"
        castShadow={castShadow}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={2}
        shadow-camera-far={42}
        shadow-camera-left={-8.5}
        shadow-camera-right={8.5}
        shadow-camera-top={16}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />

      {/* Soft Front Fill + Warm Altar Rim Backlight separating characters cleanly */}
      <directionalLight position={[3.2, 7.5, 22]} intensity={0.58} color="#fff0d4" />
      <pointLight
        ref={ceremonyFloorLightRef}
        position={[0, 3.2, sceneCalibration.altarStationZ - 0.8]}
        color="#ffc857"
        intensity={0.95}
        distance={18}
        decay={1.6}
      />

      {/* Transparent Shadow-Receiving Floor Plane aligned with y = 0 */}
      {castShadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 2]} receiveShadow>
          <planeGeometry args={[20, 34]} />
          <shadowMaterial transparent opacity={0.32} color="#170703" />
        </mesh>
      )}

      {/* Compact Floor-Level 3D Xin Xăm Bamboo Fortune Stand on the Left Wing (No duplicate Buddha!) */}
      <group position={[xinXamStation.x - 0.36, 0, xinXamStation.z - 0.42]}>
        <mesh position={[0, 0.32, 0]} material={darkWoodMat} castShadow={castShadow}>
          <cylinderGeometry args={[0.28, 0.33, 0.64, 14]} />
        </mesh>
        <mesh position={[0, 0.66, 0]} material={crimsonMat}>
          <cylinderGeometry args={[0.35, 0.3, 0.06, 16]} />
        </mesh>
        <mesh position={[0, 0.69, 0]} material={goldTrimMat}>
          <torusGeometry args={[0.34, 0.022, 8, 20]} />
        </mesh>

        <group ref={xinXamTubeRef} position={[0, 0.71, 0]}>
          <mesh position={[0, 0.13, 0]} material={bambooMat} castShadow={castShadow}>
            <cylinderGeometry args={[0.105, 0.098, 0.26, 16]} />
          </mesh>
          <mesh position={[0, 0.045, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.102, 0.01, 6, 16]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.106, 0.011, 6, 16]} />
          </mesh>
          {Array.from({ length: 10 }, (_, idx) => {
            const ang = (idx / 10) * Math.PI * 2;
            const rad = idx % 2 === 0 ? 0.025 : 0.055;
            return (
              <group
                key={`img-xam-stick-${idx}`}
                position={[Math.cos(ang) * rad, 0.25, Math.sin(ang) * rad]}
                rotation={[Math.sin(ang) * 0.07, ang, Math.cos(ang) * 0.07]}
              >
                <mesh material={bambooMat}>
                  <boxGeometry args={[0.016, 0.18, 0.007]} />
                </mesh>
                <mesh position={[0, 0.082, 0]} material={crimsonMat}>
                  <boxGeometry args={[0.018, 0.028, 0.009]} />
                </mesh>
              </group>
            );
          })}
        </group>

        <group ref={xinXamGlowStickRef} position={[0.08, 1.28, 0.08]} visible={false}>
          <mesh material={goldTrimMat}>
            <boxGeometry args={[0.05, 0.48, 0.016]} />
          </mesh>
          <mesh position={[0, 0.21, 0]} material={crimsonMat}>
            <boxGeometry args={[0.054, 0.08, 0.02]} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.72, 0.72]} />
            <meshBasicMaterial
              map={haloGlowTex}
              transparent
              opacity={0.88}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * Optional Visual Scene Alignment Guides Overlay (`showAlignmentGuides`)
 * Projects 3D red carpet rails, altar floor boundary, entrance point, ritual stations, and seat grid
 * directly onto the 9:16 viewport for live administrator perspective calibration.
 */
function SceneAlignmentGuidesOverlay({
  sceneCalibration,
}: {
  sceneCalibration: SceneCalibrationSettings;
}) {
  const guides = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(42, 9 / 16, 0.25, 110);
    configureImageBackgroundCamera(cam, 9 / 16, sceneCalibration);

    const toPct = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(cam);
      return {
        x: (v.x * 0.5 + 0.5) * 100,
        y: (-v.y * 0.5 + 0.5) * 100,
      };
    };

    const zTop = IMAGE_BG_CAMERA_BASE.altarFloorEdgeZ;
    const zBot = Math.max(14.5, sceneCalibration.entranceZ);
    const wCarpet = IMAGE_BG_CAMERA_BASE.carpetHalfWidth;

    const carpetTopL = toPct(-wCarpet, 0, zTop);
    const carpetTopR = toPct(wCarpet, 0, zTop);
    const carpetBotL = toPct(-wCarpet, 0, zBot);
    const carpetBotR = toPct(wCarpet, 0, zBot);
    const altarLeft = toPct(-6.2, 0, zTop);
    const altarRight = toPct(6.2, 0, zTop);
    const entrancePt = toPct(0, 0, sceneCalibration.entranceZ);

    const seats = Array.from({ length: 104 }, (_, idx) => {
      const s = getImageCalibratedSeatPosition(idx, sceneCalibration);
      return { ...toPct(s.x, 0, s.z), side: s.side };
    });

    const stationIds: AltarStationId[] = [
      'incense_center',
      'flower_left',
      'flower_right',
      'fruit_left',
      'fruit_right',
      'lotus_left',
      'lotus_right',
      'bell_right',
      'xin_xam_station',
    ];
    const stations = stationIds.map((id) => {
      const st = getImageCalibratedAltarStation(id, sceneCalibration);
      return { id, ...toPct(st.x, 0, st.z) };
    });

    return {
      carpetTopL,
      carpetTopR,
      carpetBotL,
      carpetBotR,
      altarLeft,
      altarRight,
      entrancePt,
      seats,
      stations,
    };
  }, [sceneCalibration]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-[6] overflow-hidden select-none"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        {/* Altar Floor Boundary Line */}
        <line
          x1={guides.altarLeft.x}
          y1={guides.altarLeft.y}
          x2={guides.altarRight.x}
          y2={guides.altarRight.y}
          stroke="rgba(255, 110, 110, 0.85)"
          strokeWidth="0.32"
          strokeDasharray="1.2 0.8"
        />

        {/* Calibrated Red Carpet Perspective Rails */}
        <polygon
          points={`${guides.carpetTopL.x},${guides.carpetTopL.y} ${guides.carpetTopR.x},${guides.carpetTopR.y} ${guides.carpetBotR.x},${guides.carpetBotR.y} ${guides.carpetBotL.x},${guides.carpetBotL.y}`}
          fill="rgba(255, 215, 90, 0.08)"
          stroke="rgba(255, 220, 100, 0.82)"
          strokeWidth="0.28"
        />

        {/* Center Axis Line */}
        <line
          x1={50}
          y1={guides.carpetTopL.y}
          x2={50}
          y2={100}
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="0.2"
          strokeDasharray="0.9 0.9"
        />

        {/* 104 Symmetrical Seat Anchors */}
        {guides.seats.map((pt, idx) => (
          <circle
            key={`guide-seat-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r="0.55"
            fill={pt.side === 'left' ? 'rgba(120, 240, 180, 0.85)' : 'rgba(130, 210, 255, 0.85)'}
          />
        ))}

        {/* Altar Ritual Stations */}
        {guides.stations.map((st) => (
          <circle
            key={`guide-st-${st.id}`}
            cx={st.x}
            cy={st.y}
            r="0.88"
            fill="rgba(255, 196, 64, 0.95)"
            stroke="rgba(45, 10, 16, 0.9)"
            strokeWidth="0.22"
          />
        ))}

        {/* Entrance Marker */}
        <circle
          cx={guides.entrancePt.x}
          cy={Math.min(99, guides.entrancePt.y)}
          r="1.15"
          fill="rgba(255, 118, 178, 0.95)"
          stroke="#ffffff"
          strokeWidth="0.25"
        />
      </svg>

      <div className="absolute left-2 bottom-12 px-2 py-1 rounded bg-black/70 border border-[#ffd875]/55 text-[9.5px] text-[#ffe9a8] leading-tight space-y-0.5">
        <div className="font-semibold">LƯỚI CĂN CHỈNH PHỐI CẢNH 3D</div>
        <div>Đứt đỏ: Chân bàn thờ · Vàng: Thảm đỏ · Xanh: 104 chỗ ngồi · Cam: Trạm lễ</div>
      </div>
    </div>
  );
}

/**
 * Collision-Aware 2D Screen-Space Name Labels & 5-Second Comment Bubbles Projector
 */
function CollisionAwareCharacterLabelsSync({
  participants,
  showUsernames,
  showCommentBubbles,
  panelScale,
  showLeaderboard,
  showGiftPanel,
  sceneMode,
  currentSpeakerUserId,
  nameSlotRefs,
  bubbleSlotRefs,
}: {
  participants: Participant[];
  showUsernames: boolean;
  showCommentBubbles: boolean;
  panelScale: number;
  showLeaderboard: boolean;
  showGiftPanel: boolean;
  sceneMode: 'image_background' | 'original_3d';
  currentSpeakerUserId?: string;
  nameSlotRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  bubbleSlotRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  const { camera, size } = useThree();
  const candidatesBuffer = useMemo<LabelCandidateInput[]>(() => [], []);

  useFrame(() => {
    const now = Date.now();
    const sliceLen = Math.min(participants.length, MAX_LABEL_SLOTS);

    if (!showUsernames && !showCommentBubbles) {
      for (let i = 0; i < MAX_LABEL_SLOTS; i++) {
        const nEl = nameSlotRefs.current[i];
        if (nEl && nEl.style.display !== 'none') nEl.style.display = 'none';
        const bEl = bubbleSlotRefs.current[i];
        if (bEl && bEl.style.display !== 'none') bEl.style.display = 'none';
      }
      return;
    }

    candidatesBuffer.length = 0;
    for (let i = 0; i < sliceLen; i++) {
      const p = participants[i];
      const live = liveCharacterPositions.get(p.userId);
      let wx = 0;
      let wy = 0;
      let wz = 0;
      let headY = 1.2;

      if (live) {
        wx = live.x;
        wy = live.y;
        wz = live.z;
        headY = live.headY;
      } else {
        const seat = getSeatPosition(p.seatIndex);
        wx = seat.x;
        wy = 0;
        wz = seat.z;
      }

      const hasRitualStatus = Boolean(
        p.ritualStatusLabel && p.ritualStatusUntil && p.ritualStatusUntil > now,
      );
      const isCeremonyActor = Boolean(
        p.activeRitual ||
          p.activeWoodenFish ||
          hasRitualStatus ||
          p.animState === 'offering' ||
          p.animState === 'gift_blessing' ||
          p.animState === 'praying' ||
          p.animState === 'wooden_fish',
      );
      const isSpeaking = Boolean(currentSpeakerUserId && currentSpeakerUserId === p.userId);
      const isRecentlyActive = now - p.lastInteractionAt < 18000;

      candidatesBuffer.push({
        userId: p.userId,
        username: p.username,
        worldX: wx,
        worldY: wy,
        worldZ: wz,
        headY,
        lastComment: p.lastComment,
        lastCommentAt: p.lastCommentAt,
        ritualStatusLabel: hasRitualStatus ? p.ritualStatusLabel : undefined,
        isSpeaking,
        isCeremonyActor,
        isRecentlyActive,
        seatIndex: p.seatIndex,
      });
    }

    const layout = solveLabelAndBubbleLayout(candidatesBuffer, camera, {
      viewportWidth: size.width,
      viewportHeight: size.height,
      now,
      showUsernames,
      showCommentBubbles,
      panelScale,
      showLeaderboard,
      showGiftPanel,
      commentDurationMs: COMMENT_BUBBLE_DURATION_MS,
      sceneMode,
    });

    for (let i = 0; i < MAX_LABEL_SLOTS; i++) {
      const nEl = nameSlotRefs.current[i];
      const bEl = bubbleSlotRefs.current[i];

      if (i >= sliceLen) {
        if (nEl && nEl.style.display !== 'none') nEl.style.display = 'none';
        if (bEl && bEl.style.display !== 'none') bEl.style.display = 'none';
        continue;
      }

      const p = participants[i];
      const solved: SolvedOverlayPlacement | undefined = layout.placements.get(p.userId);

      if (nEl) {
        if (!solved || !solved.nameVisible) {
          if (nEl.style.display !== 'none') nEl.style.display = 'none';
        } else {
          if (nEl.style.display !== 'block') nEl.style.display = 'block';
          nEl.style.transform = `translate3d(${solved.nameX.toFixed(1)}px, ${solved.nameY.toFixed(
            1,
          )}px, 0) translate(-50%, -100%)`;
        }
      }

      if (bEl) {
        if (!solved || !solved.bubbleVisible) {
          if (bEl.style.display !== 'none') bEl.style.display = 'none';
        } else {
          if (bEl.style.display !== 'block') bEl.style.display = 'block';
          bEl.style.transform = `translate3d(${solved.bubbleX.toFixed(
            1,
          )}px, ${solved.bubbleY.toFixed(1)}px, 0) translate(-50%, -100%)`;
        }
      }
    }
  });

  return null;
}

export function TempleScene({
  participants,
  activeEffects,
  altarGlowUntil,
  bellRingUntil,
  incenseGlowUntil,
  fruitGlowUntil,
  lotusGlowUntil,
  pagodaGlowUntil,
  xinXamGlowUntil = 0,
  activeXinXamVisual = null,
  floatingLanternCount,
  overlaySettings,
  sceneCalibration = DEFAULT_SCENE_CALIBRATION,
  currentSpeakerUserId,
  onBuddhaModelStatus,
}: TempleSceneProps) {
  const [webglError, setWebglError] = useState(false);
  const nameSlotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bubbleSlotRefs = useRef<(HTMLDivElement | null)[]>([]);

  const isImageBackgroundMode = sceneCalibration.sceneMode === 'image_background';

  const effectiveQuality: QualityPreset = useMemo(() => {
    if (typeof window !== 'undefined' && window.isSoftwareGl) {
      return 'low';
    }
    return overlaySettings.quality;
  }, [overlaySettings.quality]);

  const dpr: [number, number] =
    effectiveQuality === 'low' ? [1, 1] : effectiveQuality === 'medium' ? [1, 1.5] : [1, 2];

  const labelSlice = participants.slice(0, MAX_LABEL_SLOTS);
  const nowRender = Date.now();
  const labelScale = Math.max(0.75, Math.min(1.1, overlaySettings.panelScale));

  const bgTransformStyle = useMemo(() => {
    const sx = sceneCalibration.bgScale || 1;
    const ox = sceneCalibration.bgOffsetX || 0;
    const oy = sceneCalibration.bgOffsetY || 0;
    if (Math.abs(sx - 1) < 0.001 && Math.abs(ox) < 0.01 && Math.abs(oy) < 0.01) {
      return undefined;
    }
    return {
      transform: `translate3d(${ox}%, ${oy}%, 0) scale(${sx})`,
      transformOrigin: 'center center',
    };
  }, [sceneCalibration.bgScale, sceneCalibration.bgOffsetX, sceneCalibration.bgOffsetY]);

  if (webglError) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#2b1208] via-[#1a0a05] to-[#0d0503] text-[#f5e6c8] p-6 text-center overflow-hidden">
        {isImageBackgroundMode && (
          <img
            src={sceneCalibration.backgroundUrl || '/assets/temple-background.png'}
            alt="Chùa Online"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          />
        )}
        <div className="relative z-10 max-w-sm rounded-2xl border border-[#d4af37]/40 bg-black/75 p-5 shadow-2xl">
          <p className="font-display text-lg font-bold text-[#ffd875] mb-2">
            Chánh Điện Chùa Online
          </p>
          <p className="text-xs text-[#dfd1b8] leading-relaxed">
            Trình duyệt hiện chưa bật tăng tốc phần cứng WebGL. Hệ thống vẫn giữ nguyên kết nối
            TikTok LIVE, bảng công đức và giọng đọc AI bình an.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#170904]">
      {/* LAYER 0: PERMANENT LOCAL 9:16 BUDDHIST TEMPLE IMAGE BACKGROUND (Exact uploaded asset, zero distortion!) */}
      {isImageBackgroundMode && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none bg-[#170904]"
        >
          <img
            src={sceneCalibration.backgroundUrl || '/assets/temple-background.png'}
            alt=""
            draggable={false}
            style={bgTransformStyle}
            className={
              overlaySettings.vertical916
                ? 'w-full h-full object-cover object-center select-none pointer-events-none'
                : 'h-full w-auto max-w-none object-contain object-center select-none pointer-events-none'
            }
          />
        </div>
      )}

      {/* LAYER 1: TRANSPARENT 3D WORSHIPPERS, RITUAL PROPS & REAL-TIME CEREMONIAL EFFECTS */}
      <div className="relative z-[2] w-full h-full">
        <Canvas
          shadows={effectiveQuality !== 'low'}
          dpr={dpr}
          camera={{ position: [0, 4.84, 26.2], fov: 42, near: 0.25, far: 120 }}
          gl={{
            alpha: true,
            antialias: effectiveQuality !== 'low',
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = isImageBackgroundMode ? 1.08 : 1.16;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            if (isImageBackgroundMode) {
              scene.background = null;
              scene.fog = null;
              gl.setClearColor(0x000000, 0);
            }
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setWebglError(true);
            });
            canvas.addEventListener('webglcontextrestored', () => {
              setWebglError(false);
            });
          }}
        >
          <SceneModeAndCameraController sceneCalibration={sceneCalibration} />

          {isImageBackgroundMode ? (
            /* IMAGE BACKGROUND MODE: Hide procedural 3D Buddha, pillars, walls, lanterns & floor textures so ONLY ONE Buddha is ever shown! */
            <ImageBackgroundFloorLayer
              quality={effectiveQuality}
              sceneCalibration={sceneCalibration}
              altarGlowUntil={altarGlowUntil}
              bellRingUntil={bellRingUntil}
              lotusGlowUntil={lotusGlowUntil}
              pagodaGlowUntil={pagodaGlowUntil}
              xinXamGlowUntil={xinXamGlowUntil}
              activeXinXamVisual={activeXinXamVisual}
            />
          ) : (
            /* ORIGINAL 3D TEMPLE MODE: Full preserved procedural 3D sanctuary & elevated Golden Buddha */
            <>
              <TempleEnvironment quality={effectiveQuality} />
              <BuddhaAltar
                altarGlowUntil={altarGlowUntil}
                bellRingUntil={bellRingUntil}
                incenseGlowUntil={incenseGlowUntil}
                fruitGlowUntil={fruitGlowUntil}
                lotusGlowUntil={lotusGlowUntil}
                pagodaGlowUntil={pagodaGlowUntil}
                xinXamGlowUntil={xinXamGlowUntil}
                activeXinXamVisual={activeXinXamVisual}
                floatingLanternCount={floatingLanternCount}
                buddhaModelUrl={overlaySettings.buddhaModelUrl}
                buddhaGoldOverride={overlaySettings.buddhaGoldOverride}
                onBuddhaModelStatus={onBuddhaModelStatus}
              />
            </>
          )}

          <CharacterManager participants={participants} quality={effectiveQuality} />

          {overlaySettings.effectsEnabled && (
            <GiftEffectManager activeEffects={activeEffects} quality={effectiveQuality} />
          )}

          <CollisionAwareCharacterLabelsSync
            participants={participants}
            showUsernames={overlaySettings.showUsernames}
            showCommentBubbles={overlaySettings.showCommentBubbles}
            panelScale={overlaySettings.panelScale}
            showLeaderboard={overlaySettings.showLeaderboard}
            showGiftPanel={overlaySettings.showGiftPanel}
            sceneMode={sceneCalibration.sceneMode}
            currentSpeakerUserId={currentSpeakerUserId ?? undefined}
            nameSlotRefs={nameSlotRefs}
            bubbleSlotRefs={bubbleSlotRefs}
          />
        </Canvas>
      </div>

      {/* LAYER 2: OPTIONAL VISUAL SCENE ALIGNMENT GUIDES FOR ADMINISTRATOR CALIBRATION */}
      {isImageBackgroundMode &&
        sceneCalibration.showAlignmentGuides &&
        !overlaySettings.obsCleanView && (
          <SceneAlignmentGuidesOverlay sceneCalibration={sceneCalibration} />
        )}

      {/* LAYER 3: COLLISION-SOLVED SMALL CHARACTER NAME LABELS & 5S COMMENT BUBBLES */}
      {(overlaySettings.showUsernames || overlaySettings.showCommentBubbles) && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[8] pointer-events-none overflow-hidden"
        >
          {/* 1. Small Character Name Labels (Username ONLY — zero avatars on regular characters!) */}
          {Array.from({ length: MAX_LABEL_SLOTS }, (_, idx) => {
            const p = labelSlice[idx];
            const isSpeaking = Boolean(
              p && currentSpeakerUserId && currentSpeakerUserId === p.userId,
            );
            const hasRitualStatus = Boolean(
              p && p.ritualStatusLabel && p.ritualStatusUntil && p.ritualStatusUntil > nowRender,
            );
            const isCeremony = Boolean(p && (p.activeRitual || p.activeWoodenFish));
            const variant = isSpeaking
              ? 'speaking'
              : isCeremony || hasRitualStatus
                ? 'ceremony'
                : 'idle';

            return (
              <div
                key={`char-name-slot-${idx}`}
                ref={(el) => {
                  nameSlotRefs.current[idx] = el;
                }}
                style={{ display: 'none', left: 0, top: 0 }}
                className="absolute will-change-transform pointer-events-none"
              >
                {p && (
                  <div
                    style={{
                      ...buildCharacterNameLabelStyle(overlaySettings.panelOpacity, variant),
                      fontSize: `${Math.max(6.2, Math.round(7.4 * labelScale * 10) / 10)}px`,
                    }}
                    className={`px-1 py-[0.5px] rounded-[2px] border text-center whitespace-nowrap leading-[1.15] shadow-sm ${
                      isSpeaking
                        ? 'text-[#fff7df] font-semibold ring-1 ring-[#ffe082]/60'
                        : isCeremony || hasRitualStatus
                          ? 'text-[#ffefc2] font-medium'
                          : 'text-[#f3e6ce]'
                    }`}
                  >
                    <span className="inline-block max-w-[68px] truncate align-bottom">
                      {p.username}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* 2. 5-Second Overhead Comment Bubbles (Original Comment Text ONLY — no username, no avatar!) */}
          {Array.from({ length: MAX_LABEL_SLOTS }, (_, idx) => {
            const p = labelSlice[idx];
            const hasActiveComment = Boolean(
              p &&
                p.lastComment &&
                p.lastCommentAt &&
                nowRender - p.lastCommentAt <= COMMENT_BUBBLE_DURATION_MS,
            );
            const isSpeaking = Boolean(
              p && currentSpeakerUserId && currentSpeakerUserId === p.userId,
            );

            return (
              <div
                key={`char-bubble-slot-${idx}`}
                ref={(el) => {
                  bubbleSlotRefs.current[idx] = el;
                }}
                style={{ display: 'none', left: 0, top: 0 }}
                className="absolute will-change-transform pointer-events-none z-10"
              >
                {p && hasActiveComment && p.lastComment && (
                  <div
                    style={{
                      ...buildCommentBubbleStyle(overlaySettings.panelOpacity, isSpeaking),
                      fontSize: `${Math.max(7.2, Math.round(8.2 * labelScale * 10) / 10)}px`,
                    }}
                    className="relative max-w-[108px] px-1.5 py-[2.5px] rounded-[3px] border text-[#fff7e6] font-medium leading-[1.2] text-center shadow-[0_2px_8px_rgba(0,0,0,0.48)]"
                  >
                    <span className="line-clamp-2 break-words">{p.lastComment}</span>
                    <span
                      aria-hidden="true"
                      className="block mx-auto mt-[1px] w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[3px] border-t-[#e5bd5a]/85"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
