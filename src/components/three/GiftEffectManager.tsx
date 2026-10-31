import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ActiveGiftVisualEffect, QualityPreset } from '../../types/temple';
import { getSeatPosition } from '../../systems/SeatManager';
import { liveCharacterPositions } from './templeResources';

interface GiftEffectManagerProps {
  activeEffects: ActiveGiftVisualEffect[];
  quality: QualityPreset;
}

const PETAL_GEO = new THREE.ConeGeometry(0.08, 0.17, 5);
const SMOKE_GEO = new THREE.SphereGeometry(0.11, 8, 8);
const BEAM_GEO = new THREE.CylinderGeometry(0.16, 0.48, 8.8, 12, 1, true);
const SINGLE_BEAM_GEO = new THREE.CylinderGeometry(0.24, 0.62, 6.6, 14, 1, true);
const LOTUS_AURA_RING_GEO = new THREE.RingGeometry(0.35, 0.95, 28);

const LOTUS_PETAL_MAT = new THREE.MeshBasicMaterial({
  color: '#ffa6c1',
  transparent: true,
  opacity: 0.92,
});
const GLOWING_LOTUS_MAT = new THREE.MeshBasicMaterial({
  color: '#ffc2dc',
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const GOLD_SPARK_MAT = new THREE.MeshBasicMaterial({
  color: '#ffe282',
  transparent: true,
  opacity: 0.94,
});
const INCENSE_AURA_MAT = new THREE.MeshBasicMaterial({
  color: '#f5e6c8',
  transparent: true,
  opacity: 0.48,
  depthWrite: false,
});
const LANTERN_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: '#ffd166',
  transparent: true,
  opacity: 0.88,
});
const GRAND_BEAM_MAT = new THREE.MeshBasicMaterial({
  color: '#ffdf73',
  transparent: true,
  opacity: 0.18,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const LOTUS_RING_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: '#ff8ec6',
  transparent: true,
  opacity: 0.44,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function SingleGiftBurst({
  effect,
  particleCount,
}: {
  effect: ActiveGiftVisualEffect;
  particleCount: number;
}) {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const auraGroupRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seat = useMemo(() => getSeatPosition(effect.seatIndex), [effect.seatIndex]);

  const isWideSanctuary =
    effect.type === 'altar_blessing' || effect.type === 'grand_ceremony';

  const seeds = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => ({
        angle: (i / particleCount) * Math.PI * 2 + Math.random() * 0.5,
        radius: isWideSanctuary
          ? 0.5 + Math.random() * 7.4
          : effect.type === 'bell_waves'
            ? 0.4 + Math.random() * 2.6
            : effect.type === 'glowing_lotus'
              ? 0.25 + Math.random() * 1.35
              : 0.22 + Math.random() * 0.85,
        speedY: isWideSanctuary
          ? -0.95 - Math.random() * 0.95
          : effect.type === 'incense_smoke'
            ? 0.55 + Math.random() * 0.5
            : 0.72 + Math.random() * 0.9,
        startY: isWideSanctuary
          ? 5.2 + Math.random() * 5.2
          : effect.type === 'incense_smoke'
            ? 1.5 + Math.random() * 0.4
            : 0.28 + Math.random() * 0.55,
        spin: (Math.random() - 0.5) * 4,
      })),
    [effect.type, isWideSanctuary, particleCount],
  );

  useFrame((state) => {
    if (!instancedRef.current) return;
    const elapsedSec = (Date.now() - effect.startedAt) / 1000;
    const progress = Math.min(1, (Date.now() - effect.startedAt) / effect.durationMs);
    const fadeScale =
      progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : Math.min(1, progress * 5);

    const livePos = liveCharacterPositions.get(effect.userId);
    const originX =
      effect.originX !== undefined
        ? effect.originX
        : isWideSanctuary
          ? 0
          : livePos
            ? livePos.x
            : seat.x;
    const originZ =
      effect.originZ !== undefined
        ? effect.originZ
        : isWideSanctuary
          ? -6.5
          : livePos
            ? livePos.z
            : seat.z;

    if (auraGroupRef.current) {
      auraGroupRef.current.position.set(originX, 0.05, originZ);
      const pulse = 0.9 + Math.sin(elapsedSec * 4.5) * 0.14;
      auraGroupRef.current.scale.setScalar(Math.max(0.05, fadeScale * pulse));
    }

    const t = state.clock.elapsedTime;
    for (let i = 0; i < particleCount; i++) {
      const s = seeds[i];
      const theta = s.angle + elapsedSec * (effect.type === 'bell_waves' ? 2.4 : 1.35);
      const dynamicRadius =
        effect.type === 'bell_waves' ? s.radius + elapsedSec * 1.1 : s.radius;

      const px = originX + Math.cos(theta) * dynamicRadius;
      const pz = isWideSanctuary
        ? -11.5 + ((i * 1.43) % 22) + Math.sin(theta) * 0.85
        : originZ + Math.sin(theta) * dynamicRadius;

      let py = s.startY + elapsedSec * s.speedY;
      if (isWideSanctuary) {
        py = 9.8 - ((elapsedSec * Math.abs(s.speedY) + i * 0.42) % 9.2);
      }

      dummy.position.set(px, Math.max(0.12, py), pz);
      dummy.rotation.set(t * s.spin, theta, t * 1.4);
      dummy.scale.setScalar(Math.max(0.01, fadeScale));
      dummy.updateMatrix();
      instancedRef.current.setMatrixAt(i, dummy.matrix);
    }
    instancedRef.current.instanceMatrix.needsUpdate = true;
  });

  const geo = effect.type === 'incense_smoke' ? SMOKE_GEO : PETAL_GEO;
  const mat =
    effect.type === 'glowing_lotus'
      ? GLOWING_LOTUS_MAT
      : effect.type === 'lotus_petals'
        ? LOTUS_PETAL_MAT
        : effect.type === 'incense_smoke'
          ? INCENSE_AURA_MAT
          : effect.type === 'floating_lantern'
            ? LANTERN_GLOW_MAT
            : GOLD_SPARK_MAT;

  return (
    <group>
      <instancedMesh
        ref={instancedRef}
        args={[geo, mat, particleCount]}
        frustumCulled={false}
      />

      {/* Glowing Lotus Halo Aura for "Hoa sen phát sáng" */}
      {effect.type === 'glowing_lotus' && (
        <group ref={auraGroupRef}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={LOTUS_AURA_RING_GEO}
            material={LOTUS_RING_GLOW_MAT}
          />
        </group>
      )}

      {/* Focused Golden Light Pillar for "Hiệu ứng ánh sáng vàng" */}
      {effect.type === 'golden_light' && (
        <group ref={auraGroupRef}>
          <mesh position={[0, 3.2, 0]} geometry={SINGLE_BEAM_GEO} material={GRAND_BEAM_MAT} />
        </group>
      )}

      {/* Extra Sacred Golden Light Columns during Grand Ceremony (Đại Lễ) */}
      {effect.type === 'grand_ceremony' && (
        <group position={[0, 4.4, -8.5]}>
          <mesh position={[-2.2, 0, -0.5]} geometry={BEAM_GEO} material={GRAND_BEAM_MAT} />
          <mesh position={[0, 0.4, 0.2]} geometry={BEAM_GEO} material={GRAND_BEAM_MAT} />
          <mesh position={[2.2, 0, -0.5]} geometry={BEAM_GEO} material={GRAND_BEAM_MAT} />
        </group>
      )}
    </group>
  );
}

export function GiftEffectManager({ activeEffects, quality }: GiftEffectManagerProps) {
  const roseCount = quality === 'low' ? 12 : quality === 'medium' ? 22 : 34;
  const largeCount = quality === 'low' ? 28 : quality === 'medium' ? 56 : 88;
  const grandCount = quality === 'low' ? 38 : quality === 'medium' ? 76 : 115;

  const visibleEffects = activeEffects.filter((fx) => fx.type !== 'none').slice(-7);

  return (
    <group>
      {visibleEffects.map((fx) => {
        const count =
          fx.type === 'grand_ceremony'
            ? grandCount
            : fx.type === 'altar_blessing' || fx.type === 'glowing_lotus' || fx.type === 'golden_light'
              ? largeCount
              : roseCount;
        return <SingleGiftBurst key={fx.id} effect={fx} particleCount={count} />;
      })}
    </group>
  );
}
