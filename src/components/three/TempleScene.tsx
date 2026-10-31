import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ActiveGiftVisualEffect,
  Participant,
  QualityPreset,
  StreamOverlaySettings,
} from '../../types/temple';
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
}

function SceneSetupAndProjector({
  participants,
  showUsernames,
  showCommentBubbles,
  labelNodeMapRef,
}: {
  participants: Participant[];
  showUsernames: boolean;
  showCommentBubbles: boolean;
  labelNodeMapRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const { gl, scene, camera, size } = useThree();
  const projVec = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.background = new THREE.Color('#130804');
    scene.fog = new THREE.FogExp2('#130804', 0.0128);
    pmrem.dispose();

    return () => {
      envTex.dispose();
    };
  }, [gl, scene]);

  // Symmetrical spectator camera calibrated so the enlarged 1.98x Golden Buddha & Halo
  // sit majestically unobstructed in the upper-middle sanctuary zone!
  useEffect(() => {
    const isPortrait = size.height >= size.width;
    const persp = camera as THREE.PerspectiveCamera;
    if (isPortrait) {
      persp.position.set(0, 13.4, 29.0);
      persp.fov = 51;
      persp.lookAt(0, 4.65, -4.6);
    } else {
      persp.position.set(0, 11.6, 25.0);
      persp.fov = 45;
      persp.lookAt(0, 4.5, -5.4);
    }
    persp.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(() => {
    if (!showUsernames && !showCommentBubbles) return;
    const halfW = size.width * 0.5;
    const halfH = size.height * 0.5;

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const domEl = labelNodeMapRef.current.get(p.userId);
      if (!domEl) continue;

      const livePos = liveCharacterPositions.get(p.userId);
      if (!livePos) {
        domEl.style.opacity = '0';
        continue;
      }

      projVec.set(livePos.x, livePos.y + livePos.headY + 0.16, livePos.z);
      projVec.project(camera);

      if (
        projVec.z > 1 ||
        projVec.x < -1.05 ||
        projVec.x > 1.05 ||
        projVec.y < -1.05 ||
        projVec.y > 1.05
      ) {
        domEl.style.opacity = '0';
        continue;
      }

      const sx = projVec.x * halfW + halfW;
      const sy = -projVec.y * halfH + halfH;
      domEl.style.opacity = '1';
      domEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  });

  return (
    <>
      <hemisphereLight args={['#ffe0a8', '#2b150b', 0.96]} />
      <directionalLight
        position={[6.5, 19.0, 14.5]}
        intensity={1.72}
        color="#ffe8bd"
        castShadow={!detectSoftwareGl()}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={54}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={22}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-7, 12, -5]} intensity={0.56} color="#ffbc75" />
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
}: TempleSceneProps) {
  const isSoftwareGl = useMemo(() => detectSoftwareGl(), []);
  const [contextLost, setContextLost] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const labelNodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const dpr: [number, number] = useMemo(() => {
    if (isSoftwareGl || overlaySettings.quality === 'low') return [1, 1];
    if (overlaySettings.quality === 'medium') return [1, 1.5];
    return [1, 2];
  }, [isSoftwareGl, overlaySettings.quality]);

  const labeledParticipants = useMemo(() => {
    if (!overlaySettings.showUsernames && !overlaySettings.showCommentBubbles) return [];
    return participants.filter((p, idx) => {
      const hasActiveRitual = Boolean(
        p.activeRitual ||
          p.activeWoodenFish ||
          (p.ritualStatusUntil && nowTick < p.ritualStatusUntil),
      );
      const hasActiveBubble = Boolean(
        p.lastComment && p.lastCommentAt && nowTick - p.lastCommentAt < 5000,
      );
      const isRecentActor = nowTick - p.lastActivityAt < 14000;
      return hasActiveRitual || hasActiveBubble || isRecentActor || idx < 42;
    });
  }, [
    participants,
    overlaySettings.showUsernames,
    overlaySettings.showCommentBubbles,
    nowTick,
  ]);

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
            toneMappingExposure: 1.15,
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
            showUsernames={overlaySettings.showUsernames}
            showCommentBubbles={overlaySettings.showCommentBubbles}
            labelNodeMapRef={labelNodeMapRef}
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

      {/* Projected 2D Character Usernames, Profile Avatars, Ritual Action Labels & 5-Second Speech Bubbles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {labeledParticipants.map((p) => {
          const hasBubble =
            overlaySettings.showCommentBubbles &&
            Boolean(p.lastComment && p.lastCommentAt && nowTick - p.lastCommentAt < 5000);
          const bubbleAge = p.lastCommentAt ? nowTick - p.lastCommentAt : 0;
          const isFading = bubbleAge > 3800;

          const activeRitualLabel =
            p.activeRitual?.label ||
            (p.ritualStatusUntil && nowTick < p.ritualStatusUntil ? p.ritualStatusLabel : '');
          const isCeremonyActor = Boolean(p.activeRitual || p.activeWoodenFish);

          return (
            <div
              key={p.userId}
              ref={(el) => {
                if (el) {
                  labelNodeMapRef.current.set(p.userId, el);
                } else {
                  labelNodeMapRef.current.delete(p.userId);
                }
              }}
              className="absolute top-0 left-0 flex flex-col items-center will-change-transform transition-opacity duration-200"
              style={{ opacity: 0 }}
            >
              {/* 5-Second Floating Speech Bubble */}
              {hasBubble && (
                <div
                  className={`mb-1 max-w-[172px] px-2.5 py-1 rounded-md bg-[#fffdf7] text-[#1c120c] border border-[#d4af37] shadow-md text-[11px] font-medium leading-snug text-center transition-opacity duration-500 ${
                    isFading ? 'opacity-25' : 'opacity-95'
                  }`}
                >
                  <span className="line-clamp-2 break-words">{p.lastComment}</span>
                </div>
              )}

              {/* Active Ritual Action Label */}
              {activeRitualLabel && (
                <div className="mb-0.5 px-2 py-0.5 rounded bg-[#4a0e13]/92 border border-[#f5cd63]/70 text-[9.5px] font-semibold text-[#ffe89e] whitespace-nowrap shadow">
                  {activeRitualLabel}
                </div>
              )}

              {/* Real TikTok Username & Profile Avatar */}
              {overlaySettings.showUsernames && (
                <div
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded shadow-sm ${
                    isCeremonyActor
                      ? 'bg-[#26090d]/95 border border-[#f5cd63]/80'
                      : 'bg-[#140b07]/86 border border-[#d4af37]/35'
                  }`}
                >
                  {p.avatarUrl && (
                    <img
                      src={p.avatarUrl}
                      alt={p.username}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                      className="w-3.5 h-3.5 rounded-full object-cover border border-[#f5cd63]/50 shrink-0"
                    />
                  )}
                  <span
                    className={`text-[10px] whitespace-nowrap max-w-[104px] truncate ${
                      isCeremonyActor ? 'font-bold text-[#ffe699]' : 'font-medium text-[#f8ecd4]'
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
