import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ALTAR_CENTER_Z } from '../../systems/SeatManager';
import { createBannerTexture, createRadialGlowTexture } from './templeResources';

interface BuddhaAltarProps {
  altarGlowUntil: number;
  bellRingUntil: number;
  incenseGlowUntil: number;
  fruitGlowUntil: number;
  lotusGlowUntil: number;
  pagodaGlowUntil: number;
  floatingLanternCount: number;
}

export function BuddhaAltar({
  altarGlowUntil,
  bellRingUntil,
  incenseGlowUntil,
  fruitGlowUntil,
  lotusGlowUntil,
  pagodaGlowUntil,
  floatingLanternCount,
}: BuddhaAltarProps) {
  const haloRef = useRef<THREE.Group>(null);
  const haloInnerRef = useRef<THREE.Group>(null);
  const auraLightRef = useRef<THREE.PointLight>(null);
  const auraDiscRef = useRef<THREE.Mesh>(null);
  const smokeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const candleLeftRef = useRef<THREE.PointLight>(null);
  const candleRightRef = useRef<THREE.PointLight>(null);
  const bellSwingGroupRef = useRef<THREE.Group>(null);
  const bellStrikerRef = useRef<THREE.Group>(null);
  const bellWaveRingRef = useRef<THREE.Mesh>(null);
  const floatingLanternGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const pagodaAltarGroupRef = useRef<THREE.Group>(null);
  const lotusStandLeftRef = useRef<THREE.Group>(null);
  const lotusStandRightRef = useRef<THREE.Group>(null);
  const ceremonySpotLightRef = useRef<THREE.PointLight>(null);

  const goldStatueMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fce068',
        metalness: 0.9,
        roughness: 0.17,
        emissive: '#875408',
        emissiveIntensity: 0.44,
      }),
    [],
  );

  const goldTrimMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8b93c',
        metalness: 0.85,
        roughness: 0.25,
        emissive: '#543205',
        emissiveIntensity: 0.25,
      }),
    [],
  );

  const buddhaFeatureMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8f590a',
        metalness: 0.65,
        roughness: 0.35,
      }),
    [],
  );

  const lotusPetalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f294b0',
        metalness: 0.3,
        roughness: 0.36,
        emissive: '#751f39',
        emissiveIntensity: 0.32,
      }),
    [],
  );

  const darkWoodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#291309',
        metalness: 0.12,
        roughness: 0.54,
      }),
    [],
  );

  const crimsonLacquerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6b0f14',
        metalness: 0.22,
        roughness: 0.36,
      }),
    [],
  );

  const bronzeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c6953f',
        metalness: 0.86,
        roughness: 0.27,
      }),
    [],
  );

  const jadeWaterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#102926',
        metalness: 0.45,
        roughness: 0.14,
        emissive: '#0a211d',
        emissiveIntensity: 0.3,
      }),
    [],
  );

  const leftCoupletTex = useMemo(
    () => createBannerTexture(['NAM', 'MÔ', 'A', 'DI', 'ĐÀ', 'PHẬT']),
    [],
  );
  const rightCoupletTex = useMemo(
    () => createBannerTexture(['PHẬT', 'QUANG', 'PHỔ', 'CHIẾU', 'AN', 'LẠC']),
    [],
  );
  const haloGlowTex = useMemo(
    () => createRadialGlowTexture('rgba(255, 240, 168, 0.98)', 'rgba(235, 168, 38, 0.38)'),
    [],
  );

  const lotusAnglesOuter = useMemo(
    () => Array.from({ length: 20 }, (_, i) => (i / 20) * Math.PI * 2),
    [],
  );
  const lotusAnglesInner = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ((i + 0.5) / 16) * Math.PI * 2),
    [],
  );

  const lanternSeeds = useMemo(
    () =>
      Array.from({ length: 24 }, (_, idx) => {
        const basinSide = idx % 2 === 0 ? -1 : 1;
        const ringIdx = Math.floor(idx / 2);
        const angle = ringIdx * 2.39996;
        const r = ringIdx === 0 ? 0.08 : Math.min(0.62, 0.18 + (ringIdx % 5) * 0.1);
        return {
          basinX: basinSide * 2.62,
          localX: Math.cos(angle) * r,
          localZ: Math.sin(angle) * r,
          phase: idx * 0.85,
        };
      }),
    [],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const now = Date.now();
    const isBlessed = now < altarGlowUntil;
    const isBellRinging = now < bellRingUntil;
    const isIncenseGlowing = now < incenseGlowUntil;
    const isFruitActive = now < fruitGlowUntil;
    const isLotusActive = now < lotusGlowUntil;
    const isPagodaActive = now < pagodaGlowUntil;

    if (haloRef.current) {
      haloRef.current.rotation.z += delta * (isBlessed ? 0.45 : 0.11);
    }
    if (haloInnerRef.current) {
      haloInnerRef.current.rotation.z -= delta * (isBlessed ? 0.34 : 0.08);
    }

    if (auraLightRef.current) {
      const targetIntensity = isPagodaActive
        ? 32
        : isBlessed
          ? 26
          : 15.5 + Math.sin(t * 1.5) * 0.9;
      auraLightRef.current.intensity = THREE.MathUtils.damp(
        auraLightRef.current.intensity,
        targetIntensity,
        4,
        delta,
      );
    }

    if (ceremonySpotLightRef.current) {
      const targetCeremonyGlow =
        isPagodaActive || isLotusActive || isFruitActive ? 8.5 : 2.2;
      ceremonySpotLightRef.current.intensity = THREE.MathUtils.damp(
        ceremonySpotLightRef.current.intensity,
        targetCeremonyGlow,
        4,
        delta,
      );
    }

    if (auraDiscRef.current) {
      const targetScale = isBlessed
        ? 1.32 + Math.sin(t * 4.2) * 0.05
        : 1.04 + Math.sin(t * 1.3) * 0.03;
      const s = THREE.MathUtils.damp(auraDiscRef.current.scale.x, targetScale, 4, delta);
      auraDiscRef.current.scale.set(s, s, 1);
    }

    if (pagodaAltarGroupRef.current) {
      pagodaAltarGroupRef.current.rotation.y = t * (isPagodaActive ? 0.75 : 0.15);
      const pScale = isPagodaActive ? 1.18 + Math.sin(t * 4) * 0.05 : 1.0;
      pagodaAltarGroupRef.current.scale.setScalar(
        THREE.MathUtils.damp(pagodaAltarGroupRef.current.scale.x, pScale, 5, delta),
      );
    }

    if (lotusStandLeftRef.current && lotusStandRightRef.current) {
      const lScale = isLotusActive ? 1.2 + Math.sin(t * 4.5) * 0.06 : 1.0;
      const damped = THREE.MathUtils.damp(lotusStandLeftRef.current.scale.x, lScale, 5, delta);
      lotusStandLeftRef.current.scale.setScalar(damped);
      lotusStandRightRef.current.scale.setScalar(damped);
      lotusStandLeftRef.current.rotation.y = t * 0.35;
      lotusStandRightRef.current.rotation.y = -t * 0.35;
    }

    if (candleLeftRef.current) {
      candleLeftRef.current.intensity = 2.6 + Math.sin(t * 9.3) * 0.25 + Math.cos(t * 14.1) * 0.15;
    }
    if (candleRightRef.current) {
      candleRightRef.current.intensity = 2.6 + Math.cos(t * 8.7) * 0.25 + Math.sin(t * 13.4) * 0.15;
    }

    smokeRefs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      const speed = isIncenseGlowing ? 0.55 : 0.34;
      const cycle = (t * speed + idx * 0.2) % 1;
      mesh.position.y = 1.82 + cycle * (isIncenseGlowing ? 3.1 : 2.2);
      mesh.position.x = Math.sin(t * 1.6 + idx * 1.7) * 0.18 * cycle;
      const scale = (isIncenseGlowing ? 0.32 : 0.22) + cycle * 0.88;
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(cycle * Math.PI) * (isIncenseGlowing ? 0.34 : 0.18);
    });

    if (bellSwingGroupRef.current && bellStrikerRef.current && bellWaveRingRef.current) {
      if (isBellRinging) {
        const remain = (bellRingUntil - now) / 5600;
        const swingAmp = Math.sin(t * 7.5) * 0.15 * Math.max(0.15, remain);
        bellSwingGroupRef.current.rotation.z = swingAmp;
        bellStrikerRef.current.position.x = -0.68 + Math.max(0, Math.sin(t * 7.5)) * 0.24 * remain;

        bellWaveRingRef.current.visible = true;
        const waveCycle = (t * 1.35) % 1;
        const ringScale = 0.7 + waveCycle * 2.9;
        bellWaveRingRef.current.scale.set(ringScale, ringScale, 1);
        (bellWaveRingRef.current.material as THREE.MeshBasicMaterial).opacity =
          (1 - waveCycle) * 0.68;
      } else {
        bellSwingGroupRef.current.rotation.z = THREE.MathUtils.damp(
          bellSwingGroupRef.current.rotation.z,
          0,
          5,
          delta,
        );
        bellStrikerRef.current.position.x = THREE.MathUtils.damp(
          bellStrikerRef.current.position.x,
          -0.68,
          6,
          delta,
        );
        bellWaveRingRef.current.visible = false;
      }
    }

    const visibleLanterns = Math.min(24, Math.max(0, floatingLanternCount));
    for (let i = 0; i < lanternSeeds.length; i++) {
      const grp = floatingLanternGroupRefs.current[i];
      if (!grp) continue;
      grp.visible = i < visibleLanterns;
      if (grp.visible) {
        const seed = lanternSeeds[i];
        grp.position.y = 0.43 + Math.sin(t * 1.9 + seed.phase) * 0.015;
        grp.rotation.y = t * 0.22 + seed.phase;
      }
    }
  });

  return (
    <group position={[0, 0, ALTAR_CENTER_Z]}>
      {/* Grand Sanctuary Carved Rosewood & Crimson Lacquer Backdrop */}
      <group position={[0, 0, -3.1]}>
        <mesh position={[0, 7.2, 0]} material={darkWoodMat}>
          <boxGeometry args={[18.4, 14.4, 0.58]} />
        </mesh>
        <mesh position={[0, 7.0, 0.31]} material={crimsonLacquerMat}>
          <boxGeometry args={[12.8, 13.0, 0.14]} />
        </mesh>
        {/* High Gilded Horizontal Sanctuary Plaque (Hoành Phi Đại Hùng Bảo Điện — above halo!) */}
        <mesh position={[0, 13.15, 0.48]} material={goldTrimMat}>
          <boxGeometry args={[9.2, 1.12, 0.22]} />
        </mesh>
        <mesh position={[0, 13.15, 0.61]} material={crimsonLacquerMat}>
          <boxGeometry args={[8.6, 0.78, 0.06]} />
        </mesh>

        {/* Left & Right Tall Gilded Calligraphy Couplets (Câu Đối) flanking the Buddha */}
        <mesh position={[-7.35, 6.8, 0.4]}>
          <planeGeometry args={[1.32, 8.8]} />
          <meshStandardMaterial map={leftCoupletTex} roughness={0.36} metalness={0.28} />
        </mesh>
        <mesh position={[7.35, 6.8, 0.4]}>
          <planeGeometry args={[1.32, 8.8]} />
          <meshStandardMaterial map={rightCoupletTex} roughness={0.36} metalness={0.28} />
        </mesh>
      </group>

      {/* Stepped Sanctuary Dais Platform (Bệ Thờ Tam Cấp Trang Nghiêm) */}
      <mesh position={[0, 0.28, 0.1]} material={darkWoodMat} receiveShadow>
        <boxGeometry args={[14.2, 0.56, 5.6]} />
      </mesh>
      <mesh position={[0, 0.58, 0.1]} material={goldTrimMat}>
        <boxGeometry args={[14.32, 0.08, 5.7]} />
      </mesh>
      <mesh position={[0, 1.18, -0.65]} material={crimsonLacquerMat} receiveShadow>
        <boxGeometry args={[9.8, 1.18, 4.3]} />
      </mesh>
      <mesh position={[0, 1.8, -0.65]} material={goldTrimMat}>
        <boxGeometry args={[9.96, 0.12, 4.44]} />
      </mesh>

      {/* ====================================================================
          MAGNIFICENT MONUMENTAL GOLDEN BUDDHA STATUE & LOTUS THRONE (1.98x Scale!)
          Significantly larger, radiant 24K gold & completely unobstructed centerpiece
         ==================================================================== */}
      <group position={[0, 1.84, -0.78]} scale={[1.98, 1.98, 1.98]}>
        {/* Pedestal Octagonal Gilded Base */}
        <mesh position={[0, 0.34, 0]} material={goldTrimMat}>
          <cylinderGeometry args={[2.28, 2.62, 0.68, 16]} />
        </mesh>
        <mesh position={[0, 0.84, 0]} material={goldStatueMat}>
          <cylinderGeometry args={[1.88, 1.54, 0.46, 24]} />
        </mesh>

        {/* Outer Ring of Sculpted Rose-Gold & 24K Gold Lotus Petals */}
        {lotusAnglesOuter.map((angle, i) => (
          <group key={`outer-petal-${i}`} rotation={[0, angle, 0]}>
            <mesh
              position={[0, 0.78, 2.04]}
              rotation={[0.48, 0, 0]}
              material={i % 2 === 0 ? goldStatueMat : lotusPetalMat}
            >
              <coneGeometry args={[0.44, 1.0, 5]} />
            </mesh>
          </group>
        ))}

        {/* Inner Ring of Radiant Golden Lotus Petals */}
        {lotusAnglesInner.map((angle, i) => (
          <group key={`inner-petal-${i}`} rotation={[0, angle, 0]}>
            <mesh position={[0, 1.04, 1.74]} rotation={[0.26, 0, 0]} material={goldStatueMat}>
              <coneGeometry args={[0.39, 0.9, 5]} />
            </mesh>
          </group>
        ))}

        {/* SCULPTED SEATED GOLDEN BUDDHA */}
        <group position={[0, 1.16, 0]}>
          {/* 1. Crossed Lotus-Posture Legs */}
          <mesh
            position={[0, 0.34, 0.16]}
            scale={[1.58, 0.54, 1.15]}
            material={goldStatueMat}
            castShadow
          >
            <sphereGeometry args={[1.06, 28, 20]} />
          </mesh>
          <mesh
            position={[-0.98, 0.28, 0.36]}
            rotation={[0, 0, -0.24]}
            scale={[0.88, 0.44, 0.76]}
            material={goldStatueMat}
          >
            <sphereGeometry args={[0.8, 20, 16]} />
          </mesh>
          <mesh
            position={[0.98, 0.28, 0.36]}
            rotation={[0, 0, 0.24]}
            scale={[0.88, 0.44, 0.76]}
            material={goldStatueMat}
          >
            <sphereGeometry args={[0.8, 20, 16]} />
          </mesh>

          {/* 2. Majestic Torso & Draped Monastic Robes (Áo Cà Sa) */}
          <mesh position={[0, 1.4, 0]} material={goldStatueMat} castShadow>
            <cylinderGeometry args={[0.85, 1.12, 1.92, 28]} />
          </mesh>
          <mesh
            position={[0, 2.12, 0.04]}
            scale={[1.44, 0.78, 0.9]}
            material={goldStatueMat}
            castShadow
          >
            <sphereGeometry args={[0.88, 26, 20]} />
          </mesh>
          <mesh
            position={[-0.12, 1.6, 0.44]}
            rotation={[0.15, 0.1, -0.58]}
            scale={[0.36, 1.18, 0.46]}
            material={goldTrimMat}
          >
            <torusGeometry args={[0.84, 0.14, 12, 28]} />
          </mesh>

          {/* 3. Sculpted Arms & Amitabha Dhyana Mudra holding Sacred Lotus Jewel */}
          <mesh
            position={[-1.06, 1.58, 0.12]}
            rotation={[0.25, 0, 0.32]}
            material={goldStatueMat}
          >
            <capsuleGeometry args={[0.27, 0.98, 8, 16]} />
          </mesh>
          <mesh
            position={[1.06, 1.58, 0.12]}
            rotation={[0.25, 0, -0.32]}
            material={goldStatueMat}
          >
            <capsuleGeometry args={[0.27, 0.98, 8, 16]} />
          </mesh>
          <mesh
            position={[-0.56, 0.88, 0.58]}
            rotation={[1.25, 0.35, -0.55]}
            material={goldStatueMat}
          >
            <capsuleGeometry args={[0.22, 0.78, 8, 14]} />
          </mesh>
          <mesh
            position={[0.56, 0.88, 0.58]}
            rotation={[1.25, -0.35, 0.55]}
            material={goldStatueMat}
          >
            <capsuleGeometry args={[0.22, 0.78, 8, 14]} />
          </mesh>
          <mesh position={[0, 0.84, 0.88]} material={goldTrimMat}>
            <cylinderGeometry args={[0.32, 0.22, 0.28, 20]} />
          </mesh>
          <mesh position={[0, 1.02, 0.88]}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshBasicMaterial color="#fff5b8" />
          </mesh>

          {/* 4. Serene Compassionate Buddha Head, Facial Features, Ears & Ushnisha */}
          <mesh position={[0, 2.7, 0.02]} material={goldStatueMat}>
            <cylinderGeometry args={[0.35, 0.42, 0.4, 20]} />
          </mesh>
          <group position={[0, 3.38, 0.06]}>
            <mesh scale={[0.93, 1.08, 0.96]} material={goldStatueMat} castShadow>
              <sphereGeometry args={[0.7, 32, 26]} />
            </mesh>
            <mesh
              position={[-0.22, 0.1, 0.62]}
              rotation={[0, -0.22, -0.1]}
              material={buddhaFeatureMat}
            >
              <torusGeometry args={[0.12, 0.016, 8, 16, Math.PI * 0.85]} />
            </mesh>
            <mesh
              position={[0.22, 0.1, 0.62]}
              rotation={[0, 0.22, 0.1]}
              material={buddhaFeatureMat}
            >
              <torusGeometry args={[0.12, 0.016, 8, 16, Math.PI * 0.85]} />
            </mesh>
            <mesh
              position={[-0.22, 0.01, 0.63]}
              rotation={[Math.PI, -0.2, 0]}
              material={buddhaFeatureMat}
            >
              <torusGeometry args={[0.095, 0.014, 8, 14, Math.PI * 0.8]} />
            </mesh>
            <mesh
              position={[0.22, 0.01, 0.63]}
              rotation={[Math.PI, 0.2, 0]}
              material={buddhaFeatureMat}
            >
              <torusGeometry args={[0.095, 0.014, 8, 14, Math.PI * 0.8]} />
            </mesh>
            <mesh position={[0, -0.06, 0.66]} rotation={[-0.18, 0, 0]} material={goldStatueMat}>
              <coneGeometry args={[0.075, 0.24, 12]} />
            </mesh>
            <mesh
              position={[0, -0.24, 0.61]}
              rotation={[Math.PI * 0.92, 0, 0]}
              material={buddhaFeatureMat}
            >
              <torusGeometry args={[0.11, 0.015, 8, 16, Math.PI * 0.78]} />
            </mesh>

            {/* Elongated Ears of Wisdom */}
            <mesh
              position={[-0.66, -0.08, 0]}
              scale={[0.23, 0.66, 0.28]}
              material={goldStatueMat}
            >
              <sphereGeometry args={[0.56, 16, 14]} />
            </mesh>
            <mesh
              position={[0.66, -0.08, 0]}
              scale={[0.23, 0.66, 0.28]}
              material={goldStatueMat}
            >
              <sphereGeometry args={[0.56, 16, 14]} />
            </mesh>

            {/* Crown & Ushnisha (Nhục Kế) */}
            <mesh position={[0, 0.4, -0.04]} scale={[0.96, 0.7, 0.97]} material={goldTrimMat}>
              <sphereGeometry args={[0.68, 24, 18]} />
            </mesh>
            <mesh position={[0, 0.88, -0.02]} material={goldTrimMat}>
              <sphereGeometry args={[0.3, 20, 16]} />
            </mesh>
            <mesh position={[0, 1.12, 0.02]}>
              <sphereGeometry args={[0.095, 14, 14]} />
              <meshBasicMaterial color="#fff8d4" />
            </mesh>
            {/* Radiant Urna Gem (Bạch Hào) */}
            <mesh position={[0, 0.2, 0.65]}>
              <sphereGeometry args={[0.058, 14, 14]} />
              <meshBasicMaterial color="#fffbe0" />
            </mesh>
          </group>

          {/* 5. Magnificent Multi-Ring Golden Halo Lighting (Hào Quang Cửu Phẩm Liên Hoa) */}
          <group position={[0, 2.98, -0.74]}>
            <mesh ref={auraDiscRef} position={[0, 0, -0.18]}>
              <planeGeometry args={[7.4, 7.4]} />
              <meshBasicMaterial
                map={haloGlowTex}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            <group ref={haloRef}>
              <mesh material={goldStatueMat}>
                <torusGeometry args={[2.28, 0.068, 12, 60]} />
              </mesh>
              <mesh>
                <ringGeometry args={[2.32, 2.52, 52]} />
                <meshBasicMaterial
                  color="#ffe688"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.75}
                />
              </mesh>
              {Array.from({ length: 20 }, (_, idx) => {
                const a = (idx / 20) * Math.PI * 2;
                return (
                  <mesh
                    key={`ray-${idx}`}
                    position={[Math.cos(a) * 2.02, Math.sin(a) * 2.02, 0]}
                    rotation={[0, 0, a - Math.PI / 2]}
                    material={idx % 2 === 0 ? goldStatueMat : lotusPetalMat}
                  >
                    <coneGeometry args={[0.09, 0.62, 4]} />
                  </mesh>
                );
              })}
            </group>

            <group ref={haloInnerRef}>
              <mesh material={goldTrimMat}>
                <torusGeometry args={[1.62, 0.052, 10, 48]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* Dedicated Golden Buddha Key & Halo Sanctuary Light */}
        <pointLight
          ref={auraLightRef}
          position={[0, 3.6, 2.5]}
          color="#ffd782"
          intensity={15.5}
          distance={28}
          decay={1.4}
        />
      </group>

      {/* ====================================================================
          LOW GRACEFUL WOODEN OFFERING ALTAR TABLE (Bàn Thờ Hương Án — y = 1.12)
          Never blocks the Lotus Throne or Buddha; displays offered ceremonies!
         ==================================================================== */}
      <group position={[0, 0, 2.55]}>
        <mesh position={[0, 1.12, 0]} material={darkWoodMat} castShadow receiveShadow>
          <boxGeometry args={[6.2, 0.16, 1.42]} />
        </mesh>
        <mesh position={[0, 0.88, 0.64]} material={goldTrimMat}>
          <boxGeometry args={[5.8, 0.34, 0.07]} />
        </mesh>
        {[
          [-2.85, -0.55],
          [2.85, -0.55],
          [-2.85, 0.55],
          [2.85, 0.55],
        ].map(([lx, lz], idx) => (
          <mesh key={`leg-${idx}`} position={[lx, 0.54, lz]} material={darkWoodMat}>
            <cylinderGeometry args={[0.1, 0.085, 1.08, 12]} />
          </mesh>
        ))}

        {/* Warm Ceremony Offering Spotlight over Altar Table */}
        <pointLight
          ref={ceremonySpotLightRef}
          position={[0, 2.6, 0.4]}
          color="#ffd885"
          intensity={2.2}
          distance={8}
          decay={1.8}
        />

        {/* Central Brass Incense Burner (Lư Hương Đồng) */}
        <group position={[0, 1.2, 0.14]}>
          <mesh position={[0, 0.22, 0]} material={bronzeMat}>
            <cylinderGeometry args={[0.32, 0.24, 0.38, 20]} />
          </mesh>
          <mesh position={[0, 0.42, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.31, 0.036, 10, 24]} />
          </mesh>
          {[-0.08, -0.03, 0.02, 0.07, 0.11].map((ix, i) => (
            <group
              key={`incense-${i}`}
              position={[ix - 0.02, 0.52, 0]}
              rotation={[0, 0, (i - 2) * 0.06]}
            >
              <mesh>
                <cylinderGeometry args={[0.011, 0.011, 0.42, 6]} />
                <meshBasicMaterial color="#9e2a2b" />
              </mesh>
              <mesh position={[0, 0.22, 0]}>
                <sphereGeometry args={[0.024, 8, 8]} />
                <meshBasicMaterial color="#ff7326" />
              </mesh>
            </group>
          ))}
        </group>

        {/* Sacred Golden Reliquary Pagoda (Bảo Tháp Công Đức) behind burner on altar */}
        <group ref={pagodaAltarGroupRef} position={[0, 1.22, -0.36]}>
          <mesh position={[0, 0.08, 0]} material={crimsonLacquerMat}>
            <cylinderGeometry args={[0.22, 0.26, 0.14, 8]} />
          </mesh>
          <mesh position={[0, 0.24, 0]} material={goldStatueMat}>
            <cylinderGeometry args={[0.17, 0.23, 0.16, 8]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} material={goldStatueMat}>
            <cylinderGeometry args={[0.13, 0.18, 0.15, 8]} />
          </mesh>
          <mesh position={[0, 0.55, 0]} material={goldStatueMat}>
            <cylinderGeometry args={[0.095, 0.14, 0.13, 8]} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <coneGeometry args={[0.048, 0.24, 8]} />
            <meshBasicMaterial color="#fff3ad" />
          </mesh>
        </group>

        {/* Rising Sacred Incense Smoke Wisps */}
        {[0, 1, 2, 3, 4].map((idx) => (
          <mesh
            key={`smoke-${idx}`}
            ref={(el) => {
              smokeRefs.current[idx] = el;
            }}
            position={[0, 1.85 + idx * 0.35, 0.14]}
          >
            <sphereGeometry args={[0.2, 10, 10]} />
            <meshBasicMaterial color="#efe6d5" transparent opacity={0.16} depthWrite={false} />
          </mesh>
        ))}

        {/* Twin Brass Candlesticks */}
        {[-1.38, 1.38].map((cx, idx) => (
          <group key={`candle-${idx}`} position={[cx, 1.2, 0.14]}>
            <mesh position={[0, 0.18, 0]} material={bronzeMat}>
              <cylinderGeometry args={[0.075, 0.16, 0.36, 14]} />
            </mesh>
            <mesh position={[0, 0.46, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.28, 12]} />
              <meshStandardMaterial color="#b81d24" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.66, 0]}>
              <coneGeometry args={[0.05, 0.16, 10]} />
              <meshBasicMaterial color="#ffe282" />
            </mesh>
            <pointLight
              ref={idx === 0 ? candleLeftRef : candleRightRef}
              position={[0, 0.75, 0]}
              color="#ffb14d"
              intensity={2.6}
              distance={7.5}
              decay={2}
            />
          </group>
        ))}

        {/* Twin Glowing Đài Sen Offering Stands (Cầu Tài Lộc — x = ±2.06) */}
        {[-2.06, 2.06].map((sx, idx) => (
          <group
            key={`lotus-stand-${idx}`}
            ref={idx === 0 ? lotusStandLeftRef : lotusStandRightRef}
            position={[sx, 1.22, 0.16]}
          >
            <mesh position={[0, 0.08, 0]} material={goldTrimMat}>
              <cylinderGeometry args={[0.14, 0.19, 0.14, 12]} />
            </mesh>
            <mesh position={[0, 0.2, 0]} material={lotusPetalMat}>
              <cylinderGeometry args={[0.25, 0.14, 0.14, 10]} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshBasicMaterial color="#fff3b0" />
            </mesh>
          </group>
        ))}

        {/* Twin Porcelain Flower Vases (Hoa Hồng / Hoa Sen — x = ±2.62) */}
        {[-2.62, 2.62].map((vx, idx) => (
          <group key={`vase-${idx}`} position={[vx, 1.2, -0.06]}>
            <mesh position={[0, 0.26, 0]}>
              <cylinderGeometry args={[0.13, 0.2, 0.52, 16]} />
              <meshStandardMaterial color="#dfd6c3" roughness={0.25} metalness={0.1} />
            </mesh>
            {[
              [0, 0.7, 0],
              [-0.13, 0.64, 0.07],
              [0.13, 0.64, -0.05],
            ].map(([bx, by, bz], bi) => (
              <group key={`bud-${bi}`} position={[bx, by, bz]}>
                <mesh position={[0, -0.14, 0]}>
                  <cylinderGeometry args={[0.016, 0.016, 0.3, 6]} />
                  <meshStandardMaterial color="#3c6e47" roughness={0.6} />
                </mesh>
                <mesh material={bi === 0 ? goldStatueMat : lotusPetalMat}>
                  <coneGeometry args={[0.1, 0.24, 8]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        {/* Decorated Five-Fruit Offering Trays (Mâm Ngũ Quả — x = ±0.78) */}
        {[-0.78, 0.78].map((fx, idx) => (
          <group key={`fruit-${idx}`} position={[fx, 1.2, 0.24]}>
            <mesh position={[0, 0.06, 0]} material={goldTrimMat}>
              <cylinderGeometry args={[0.29, 0.16, 0.12, 16]} />
            </mesh>
            <mesh position={[-0.08, 0.16, 0.04]}>
              <sphereGeometry args={[0.085, 12, 12]} />
              <meshStandardMaterial color="#e07a24" roughness={0.38} />
            </mesh>
            <mesh position={[0.09, 0.16, -0.03]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#7cb518" roughness={0.44} />
            </mesh>
            <mesh position={[0, 0.23, 0]}>
              <sphereGeometry args={[0.085, 12, 12]} />
              <meshStandardMaterial color="#f3c623" roughness={0.34} />
            </mesh>
            <mesh position={[0, 0.16, -0.09]}>
              <sphereGeometry args={[0.075, 10, 10]} />
              <meshStandardMaterial color="#d62839" roughness={0.38} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ====================================================================
          CENTER GOLDEN CEREMONIAL MANDALA CUSHION (Đài Cúng Dường Bảo Tháp)
          World Z = -12.4 + 4.24 = -8.16
         ==================================================================== */}
      <group position={[0, 0.02, 4.24]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={goldTrimMat}>
          <ringGeometry args={[0.58, 0.74, 32]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={crimsonLacquerMat}>
          <cylinderGeometry args={[0.56, 0.62, 0.05, 24]} />
        </mesh>
      </group>

      {/* ====================================================================
          TWIN SACRED LOTUS LANTERN BASINS (Liên Hoa Thủy Trì — x = ±2.62)
         ==================================================================== */}
      {[-2.62, 2.62].map((bx, bIdx) => (
        <group key={`lantern-basin-${bIdx}`} position={[bx, 0, 3.48]}>
          <mesh position={[0, 0.22, 0]} material={darkWoodMat}>
            <cylinderGeometry args={[0.92, 0.84, 0.44, 16]} />
          </mesh>
          <mesh position={[0, 0.44, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.88, 0.05, 10, 24]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} material={jadeWaterMat}>
            <cylinderGeometry args={[0.84, 0.84, 0.04, 24]} />
          </mesh>
        </group>
      ))}

      {/* Floating Glowing 3D Lotus Lanterns */}
      <group position={[0, 0, 3.48]}>
        {lanternSeeds.map((seed, idx) => (
          <group
            key={`float-lantern-${idx}`}
            ref={(el) => {
              floatingLanternGroupRefs.current[idx] = el;
            }}
            position={[seed.basinX + seed.localX, 0.43, seed.localZ]}
          >
            <mesh material={lotusPetalMat}>
              <cylinderGeometry args={[0.1, 0.055, 0.065, 7]} />
            </mesh>
            <mesh position={[0, 0.045, 0]}>
              <sphereGeometry args={[0.042, 8, 8]} />
              <meshBasicMaterial color="#fff2a6" />
            </mesh>
          </group>
        ))}
      </group>

      {/* ====================================================================
          INTERACTIVE BRONZE TEMPLE BELL STAND (Chuông Đồng — x = 4.25)
         ==================================================================== */}
      <group position={[4.25, 0.15, 2.85]}>
        <mesh position={[-0.68, 1.55, 0]} material={darkWoodMat}>
          <cylinderGeometry args={[0.09, 0.11, 3.1, 12]} />
        </mesh>
        <mesh position={[0.68, 1.55, 0]} material={darkWoodMat}>
          <cylinderGeometry args={[0.09, 0.11, 3.1, 12]} />
        </mesh>
        <mesh position={[0, 3.05, 0]} rotation={[0, 0, Math.PI / 2]} material={darkWoodMat}>
          <cylinderGeometry args={[0.11, 0.11, 1.78, 12]} />
        </mesh>
        <mesh position={[0, 3.22, 0]} material={goldTrimMat}>
          <boxGeometry args={[1.85, 0.16, 0.24]} />
        </mesh>

        <group ref={bellSwingGroupRef} position={[0, 2.95, 0]}>
          <mesh position={[0, -0.22, 0]} material={goldTrimMat}>
            <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
          </mesh>
          <mesh position={[0, -0.92, 0]} material={bronzeMat} castShadow>
            <cylinderGeometry args={[0.38, 0.58, 1.26, 24]} />
          </mesh>
          <mesh position={[0, -1.48, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.56, 0.04, 10, 24]} />
          </mesh>
        </group>

        <group ref={bellStrikerRef} position={[-0.68, 1.95, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={crimsonLacquerMat}>
            <cylinderGeometry args={[0.065, 0.065, 0.72, 10]} />
          </mesh>
          <mesh position={[0.36, 0, 0]} material={goldTrimMat}>
            <sphereGeometry args={[0.075, 10, 10]} />
          </mesh>
        </group>

        <mesh
          ref={bellWaveRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.05, 0]}
          visible={false}
        >
          <ringGeometry args={[0.55, 0.72, 32]} />
          <meshBasicMaterial
            color="#ffe07d"
            transparent
            opacity={0.68}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
