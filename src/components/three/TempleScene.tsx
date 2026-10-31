import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ActiveGiftVisualEffect,
  BuddhaModelLoadStatus,
  Participant,
  QualityPreset,
  StreamOverlaySettings,
} from '../../types/temple';
import { configureTempleCamera, getSeatPosition } from '../../systems/SeatManager';
import {
  LabelCandidateInput,
  SolvedOverlayPlacement,
  solveLabelAndBubbleLayout,
} from '../../systems/LabelCollisionManager';
import {
  buildCharacterNameLabelStyle,
  buildCommentBubbleStyle,
} from '../../systems/OverlayTheme';
import { BuddhaAltar } from './BuddhaAltar';
import { TempleEnvironment } from './TempleEnvironment';
import { CharacterManager } from './CharacterManager';
import { GiftEffectManager } from './GiftEffectManager';
import { detectSoftwareGl, liveCharacterPositions } from './templeResources';

interface TempleSceneProps {
  participants: Participant[];
  activeEffects: ActiveGiftVisualEffect[];
  altarGlowUntil: number;
  bellRingUntil: number;
  incenseGlowUntil: number;
  fruitGlowUntil: number;
  lotusGlowUntil: number;
  pagodaGlowUntil: number;
  floatingLanternCount: number;
  overlaySettings: StreamOverlaySettings;
  currentSpeakerUserId?: string | null;
  onBuddhaModelStatus?: (status: BuddhaModelLoadStatus, detail?: string) => void;
}

const MAX_LABEL_DOM_POOL = 60;
const COLLISION_SOLVE_INTERVAL_MS = 48;

interface SmoothedScreenCoord {
  nameX: number;
  nameY: number;
  nameInit: boolean;
  bubbleX: number;
  bubbleY: number;
  bubbleInit: boolean;
}

function SceneSetupAndProjector({
  participants,
  overlaySettings,
  currentSpeakerUserId,
  nameNodeMapRef,
  bubbleNodeMapRef,
}: {
  participants: Participant[];
  overlaySettings: StreamOverlaySettings;
  currentSpeakerUserId?: string | null;
  nameNodeMapRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
  bubbleNodeMapRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const { gl, scene, camera, size } = useThree();
  const candidateBufferRef = useRef<LabelCandidateInput[]>([]);
  const solvedMapRef = useRef<Map<string, SolvedOverlayPlacement>>(new Map());
  const smoothedMapRef = useRef<Map<string, SmoothedScreenCoord>>(new Map());
  const lastSolveAtRef = useRef<number>(0);
  const lastSolveKeyRef = useRef<string>('');

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.background = new THREE.Color('#130804');
    scene.fog = new THREE.FogExp2('#130804', 0.0118);
    pmrem.dispose();

    return () => {
      envTex.dispose();
    };
  }, [gl, scene]);

  // Calibrated 9:16 Portrait & Landscape Camera:
  // Keeps all spacious primary seats AND the entire Golden Buddha (Halo crown to Lotus Pedestal) 100% visible!
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    configureTempleCamera(persp, size.width, size.height);
  }, [camera, size.width, size.height]);

  useFrame((_, delta) => {
    const showUsernames = overlaySettings.showUsernames;
    const showCommentBubbles = overlaySettings.showCommentBubbles;

    if (!showUsernames && !showCommentBubbles) {
      for (const el of nameNodeMapRef.current.values()) {
        el.style.opacity = '0';
      }
      for (const el of bubbleNodeMapRef.current.values()) {
        el.style.opacity = '0';
      }
      return;
    }

    const now = Date.now();
    const solveKey = `${size.width}x${size.height}:${participants.length}:${currentSpeakerUserId || ''}:${showUsernames ? 1 : 0}:${showCommentBubbles ? 1 : 0}`;
    const shouldSolve =
      now - lastSolveAtRef.current >= COLLISION_SOLVE_INTERVAL_MS ||
      solveKey !== lastSolveKeyRef.current;

    if (shouldSolve) {
      lastSolveAtRef.current = now;
      lastSolveKeyRef.current = solveKey;

      const candidates = candidateBufferRef.current;
      candidates.length = 0;

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        const livePos = liveCharacterPositions.get(p.userId);
        let worldX: number;
        let worldY: number;
        let worldZ: number;
        let headOffsetY: number;

        if (livePos) {
          worldX = livePos.x;
          worldY = livePos.y;
          worldZ = livePos.z;
          headOffsetY = livePos.headY;
        } else {
          const seat = getSeatPosition(p.seatIndex);
          worldX = seat.x;
          worldY = 0;
          worldZ = seat.z;
          headOffsetY = 1.04;
        }

        candidates.push({
          userId: p.userId,
          username: p.username,
          worldX,
          worldY,
          worldZ,
          headY: headOffsetY,
          lastComment: p.lastComment,
          lastCommentAt: p.lastCommentAt,
          isSpeaking: currentSpeakerUserId === p.userId,
          isCeremonyActor: Boolean(p.activeRitual || p.activeWoodenFish || p.isDeparting),
          isRecentlyActive: now - p.lastActivityAt < 14000,
          seatIndex: p.seatIndex,
        });
      }

      const solved = solveLabelAndBubbleLayout(candidates, camera, {
        viewportWidth: size.width,
        viewportHeight: size.height,
        now,
        showUsernames,
        showCommentBubbles,
        panelScale: overlaySettings.panelScale,
        showLeaderboard: overlaySettings.showLeaderboard,
        showGiftPanel: overlaySettings.showGiftPanel,
      });

      const nextSolvedMap = solvedMapRef.current;
      nextSolvedMap.clear();
      for (const [uid, placement] of solved.placements.entries()) {
        nextSolvedMap.set(uid, placement);
      }

      // Prune smoothed entries for departed participants
      for (const uid of smoothedMapRef.current.keys()) {
        if (!nextSolvedMap.has(uid)) {
          smoothedMapRef.current.delete(uid);
        }
      }
    }

    const dt = Math.min(0.05, Math.max(0.001, delta));
    const solvedMap = solvedMapRef.current;
    const smoothedMap = smoothedMapRef.current;

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const item = solvedMap.get(p.userId);
      const nameEl = nameNodeMapRef.current.get(p.userId);
      const bubbleEl = bubbleNodeMapRef.current.get(p.userId);

      if (!item) {
        if (nameEl) nameEl.style.opacity = '0';
        if (bubbleEl) bubbleEl.style.opacity = '0';
        continue;
      }

      let smooth = smoothedMap.get(p.userId);
      if (!smooth) {
        smooth = {
          nameX: item.nameX,
          nameY: item.nameY,
          nameInit: false,
          bubbleX: item.bubbleX,
          bubbleY: item.bubbleY,
          bubbleInit: false,
        };
        smoothedMap.set(p.userId, smooth);
      }

      // Smoothly position Character Name Label
      if (nameEl) {
        if (!item.nameVisible) {
          nameEl.style.opacity = '0';
          smooth.nameInit = false;
        } else {
          if (!smooth.nameInit) {
            smooth.nameX = item.nameX;
            smooth.nameY = item.nameY;
            smooth.nameInit = true;
          } else {
            smooth.nameX = THREE.MathUtils.damp(smooth.nameX, item.nameX, 22, dt);
            smooth.nameY = THREE.MathUtils.damp(smooth.nameY, item.nameY, 22, dt);
          }
          nameEl.style.opacity = '1';
          nameEl.style.transform = `translate3d(${smooth.nameX.toFixed(1)}px, ${smooth.nameY.toFixed(1)}px, 0) translate(-50%, -100%)`;
        }
      }

      // Smoothly position 5-Second Comment Bubble (strictly above name label, collision-resolved)
      if (bubbleEl) {
        if (!item.bubbleVisible) {
          bubbleEl.style.opacity = '0';
          smooth.bubbleInit = false;
        } else {
          if (!smooth.bubbleInit) {
            smooth.bubbleX = item.bubbleX;
            smooth.bubbleY = item.bubbleY;
            smooth.bubbleInit = true;
          } else {
            smooth.bubbleX = THREE.MathUtils.damp(smooth.bubbleX, item.bubbleX, 22, dt);
            smooth.bubbleY = THREE.MathUtils.damp(smooth.bubbleY, item.bubbleY, 22, dt);
          }
          bubbleEl.style.opacity = item.bubbleOpacity.toFixed(2);
          bubbleEl.style.transform = `translate3d(${smooth.bubbleX.toFixed(1)}px, ${smooth.bubbleY.toFixed(1)}px, 0) translate(-50%, -100%)`;
        }
      }
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffe3ad', '#2b150b', 1.0]} />
      <directionalLight
        position={[6.0, 19.0, 14.5]}
        intensity={1.76}
        color="#ffeac2"
        castShadow={!detectSoftwareGl()}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={52}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={20}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-6.5, 12.5, -5]} intensity={0.62} color="#ffbf78" />
    </>
  );
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
  floatingLanternCount,
  overlaySettings,
  currentSpeakerUserId,
  onBuddhaModelStatus,
}: TempleSceneProps) {
  const isSoftwareGl = useMemo(() => detectSoftwareGl(), []);
  const [contextLost, setContextLost] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const nameNodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const bubbleNodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  const dpr: [number, number] = useMemo(() => {
    if (isSoftwareGl || overlaySettings.quality === 'low') return [1, 1];
    if (overlaySettings.quality === 'medium') return [1, 1.5];
    return [1, 2];
  }, [isSoftwareGl, overlaySettings.quality]);

  // Select up to 60 prioritized candidates for screen-space collision layout
  // (Supports 50+ simultaneous labels smoothly on M1 8GB RAM while collision solver hides any overlapping overflow)
  const labeledParticipants = useMemo(() => {
    if (!overlaySettings.showUsernames && !overlaySettings.showCommentBubbles) return [];

    const scored = participants.map((p) => {
      const hasBubble = Boolean(
        overlaySettings.showCommentBubbles &&
          p.lastComment &&
          p.lastCommentAt &&
          nowTick - p.lastCommentAt < 5000,
      );
      const isSpeaking = currentSpeakerUserId === p.userId;
      const isCeremony = Boolean(p.activeRitual || p.activeWoodenFish || p.isDeparting);
      const isRecent = nowTick - p.lastActivityAt < 14000;
      const seat = getSeatPosition(p.seatIndex);

      let score = seat.z * 3; // Closer to camera = higher base score
      if (isSpeaking) score += 10000;
      if (hasBubble) score += 7000 + Math.max(0, 5000 - (nowTick - (p.lastCommentAt || 0))) * 0.2;
      if (isCeremony) score += 4500;
      if (isRecent) score += 1200;

      return { p, score, hasBubble };
    });

    scored.sort((a, b) => b.score - a.score);

    const result: Participant[] = [];
    for (let i = 0; i < scored.length && result.length < MAX_LABEL_DOM_POOL; i++) {
      if (scored[i].hasBubble || overlaySettings.showUsernames) {
        result.push(scored[i].p);
      }
    }
    return result;
  }, [
    participants,
    overlaySettings.showUsernames,
    overlaySettings.showCommentBubbles,
    currentSpeakerUserId,
    nowTick,
  ]);

  const nameSpeakingStyle = useMemo(
    () => buildCharacterNameLabelStyle(overlaySettings.panelOpacity, 'speaking'),
    [overlaySettings.panelOpacity],
  );
  const nameCeremonyStyle = useMemo(
    () => buildCharacterNameLabelStyle(overlaySettings.panelOpacity, 'ceremony'),
    [overlaySettings.panelOpacity],
  );
  const nameDefaultStyle = useMemo(
    () => buildCharacterNameLabelStyle(overlaySettings.panelOpacity, 'default'),
    [overlaySettings.panelOpacity],
  );
  const bubbleSpeakingStyle = useMemo(
    () => buildCommentBubbleStyle(overlaySettings.panelOpacity, true),
    [overlaySettings.panelOpacity],
  );
  const bubbleDefaultStyle = useMemo(
    () => buildCommentBubbleStyle(overlaySettings.panelOpacity, false),
    [overlaySettings.panelOpacity],
  );

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#130804]">
      {contextLost ? (
        <div className="flex flex-col items-center justify-center w-full h-full text-center p-6 bg-[#130804] text-[#f5e7ce]">
          <p className="font-display text-2xl text-[#f3c969] mb-2">
            Đang khôi phục không gian 3D Chánh Điện...
          </p>
          <p className="text-xs text-[#cbb89d]">
            Trình duyệt tạm ngắt ngữ cảnh đồ họa WebGL. Sẽ tự động hiển thị lại ngay.
          </p>
        </div>
      ) : (
        <Canvas
          shadows={!isSoftwareGl && overlaySettings.quality !== 'low'}
          dpr={dpr}
          gl={{
            antialias: !isSoftwareGl && overlaySettings.quality !== 'low',
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.16,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;
            canvas.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setContextLost(true);
            });
            canvas.addEventListener('webglcontextrestored', () => {
              setContextLost(false);
            });
          }}
        >
          <SceneSetupAndProjector
            participants={labeledParticipants}
            overlaySettings={overlaySettings}
            currentSpeakerUserId={currentSpeakerUserId}
            nameNodeMapRef={nameNodeMapRef}
            bubbleNodeMapRef={bubbleNodeMapRef}
          />
          <TempleEnvironment quality={overlaySettings.quality as QualityPreset} />
          <BuddhaAltar
            altarGlowUntil={altarGlowUntil}
            bellRingUntil={bellRingUntil}
            incenseGlowUntil={incenseGlowUntil}
            fruitGlowUntil={fruitGlowUntil}
            lotusGlowUntil={lotusGlowUntil}
            pagodaGlowUntil={pagodaGlowUntil}
            floatingLanternCount={floatingLanternCount}
            buddhaModelUrl={overlaySettings.buddhaModelUrl}
            buddhaGoldOverride={overlaySettings.buddhaGoldOverride}
            onBuddhaModelStatus={onBuddhaModelStatus}
          />
          <CharacterManager
            participants={participants}
            quality={overlaySettings.quality as QualityPreset}
          />
          {overlaySettings.effectsEnabled && (
            <GiftEffectManager
              activeEffects={activeEffects}
              quality={overlaySettings.quality as QualityPreset}
            />
          )}
        </Canvas>
      )}

      {/* ==========================================================================
          SCREEN-SPACE COLLISION-MANAGED CHARACTER LABELS & 5s COMMENT BUBBLES
          - Zero profile avatars anywhere
          - Name Label: ONLY TikTok username (small, RGBA background, thin gold border)
          - Comment Bubble: ONLY the original comment text (NO username, NO avatar)
         ========================================================================== */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {labeledParticipants.map((p) => {
          const bubbleAge = p.lastCommentAt ? nowTick - p.lastCommentAt : 999999;
          const hasBubble =
            overlaySettings.showCommentBubbles &&
            Boolean(p.lastComment && p.lastCommentAt && bubbleAge < 5000);

          const isCeremonyActor = Boolean(p.activeRitual || p.activeWoodenFish || p.isDeparting);
          const isSpeaking = currentSpeakerUserId === p.userId;
          const nameStyle = isSpeaking
            ? nameSpeakingStyle
            : isCeremonyActor
              ? nameCeremonyStyle
              : nameDefaultStyle;

          return (
            <div key={p.userId}>
              {/* 1. Compact 5-Second Comment Bubble — Displays ONLY the original comment content */}
              {hasBubble && (
                <div
                  ref={(el) => {
                    if (el) {
                      bubbleNodeMapRef.current.set(p.userId, el);
                    } else {
                      bubbleNodeMapRef.current.delete(p.userId);
                    }
                  }}
                  style={{
                    ...(isSpeaking ? bubbleSpeakingStyle : bubbleDefaultStyle),
                    opacity: 0,
                  }}
                  className="absolute top-0 left-0 z-20 max-w-[108px] px-1.5 py-0.5 rounded-md border text-center will-change-transform"
                >
                  <p className="text-[8.5px] font-medium text-[#fff7e6] leading-tight line-clamp-2 break-words">
                    {p.lastComment}
                  </p>
                </div>
              )}

              {/* 2. Small Floating Character Name Label — Displays ONLY TikTok username */}
              {overlaySettings.showUsernames && (
                <div
                  ref={(el) => {
                    if (el) {
                      nameNodeMapRef.current.set(p.userId, el);
                    } else {
                      nameNodeMapRef.current.delete(p.userId);
                    }
                  }}
                  style={{
                    ...nameStyle,
                    opacity: 0,
                  }}
                  className="absolute top-0 left-0 z-10 px-1 py-[1.5px] rounded-[3px] border will-change-transform"
                >
                  <span
                    className={`block text-[8px] leading-none whitespace-nowrap max-w-[64px] truncate ${
                      isSpeaking || isCeremonyActor
                        ? 'font-semibold text-[#ffe89e]'
                        : 'font-medium text-[#f5ead4]'
                    }`}
                  >
                    {p.username}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
