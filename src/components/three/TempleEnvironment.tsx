import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { QualityPreset } from '../../types/temple';
import { getAllMainMats, TOTAL_MAIN_MATS } from '../../systems/SeatManager';
import {
  createKneelingMatTexture,
  createRedCarpetTexture,
  createTempleFloorTexture,
} from './templeResources';

interface TempleEnvironmentProps {
  quality: QualityPreset;
}

const PILLAR_Z_POSITIONS = [-10.5, -6.0, -1.5, 3.0, 7.5, 12.0, 16.5, 21.0];
// Symmetrical side chandeliers flanking the wider sanctuary aisles (|x| = 5.55, y = 13.6 keeps center & raised Buddha 100% unobstructed!)
const CHANDELIER_COORDS: [number, number, number][] = [
  [-5.55, 13.6, -5.2],
  [5.55, 13.6, -5.2],
  [-5.55, 13.6, 3.8],
  [5.55, 13.6, 3.8],
];

export function TempleEnvironment({ quality }: TempleEnvironmentProps) {
  const { gl } = useThree();
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);

  const matBaseInstancedRef = useRef<THREE.InstancedMesh>(null);
  const matPadInstancedRef = useRef<THREE.InstancedMesh>(null);
  const dustPointsRef = useRef<THREE.Points>(null);

  const floorTex = useMemo(() => createTempleFloorTexture(maxAniso), [maxAniso]);
  const carpetTex = useMemo(() => createRedCarpetTexture(maxAniso), [maxAniso]);
  const matTex = useMemo(() => createKneelingMatTexture(maxAniso), [maxAniso]);

  const mainMats = useMemo(() => getAllMainMats(), []);

  useEffect(() => {
    if (!matBaseInstancedRef.current || !matPadInstancedRef.current) return;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < mainMats.length; i++) {
      const seat = mainMats[i];
      dummy.position.set(seat.x, 0.016, seat.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      matBaseInstancedRef.current.setMatrixAt(i, dummy.matrix);

      dummy.position.set(seat.x, 0.032, seat.z);
      dummy.updateMatrix();
      matPadInstancedRef.current.setMatrixAt(i, dummy.matrix);
    }

    matBaseInstancedRef.current.instanceMatrix.needsUpdate = true;
    matBaseInstancedRef.current.computeBoundingSphere();

    matPadInstancedRef.current.instanceMatrix.needsUpdate = true;
    matPadInstancedRef.current.computeBoundingSphere();
  }, [mainMats]);

  const darkPillarMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2b1409',
        roughness: 0.44,
        metalness: 0.15,
      }),
    [],
  );

  const stoneBaseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#463e39',
        roughness: 0.72,
        metalness: 0.08,
      }),
    [],
  );

  const goldAccentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8b53e',
        roughness: 0.24,
        metalness: 0.86,
        emissive: '#593605',
        emissiveIntensity: 0.22,
      }),
    [],
  );

  const lotusOrnamentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f294b0',
        roughness: 0.36,
        metalness: 0.3,
        emissive: '#6e1c36',
        emissiveIntensity: 0.35,
      }),
    [],
  );

  const lanternSilkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d9381e',
        emissive: '#ff7b24',
        emissiveIntensity: 0.88,
        roughness: 0.48,
      }),
    [],
  );

  const dustCount = quality === 'low' ? 35 : quality === 'medium' ? 85 : 150;
  const dustGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = 0.8 + Math.random() * 11.0;
      positions[i * 3 + 2] = -12 + Math.random() * 28;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [dustCount]);

  useFrame((state, delta) => {
    if (!dustPointsRef.current) return;
    const posAttr = dustPointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < dustCount; i++) {
      let y = posAttr.getY(i) + delta * 0.17;
      if (y > 11.6) y = 0.8;
      const x = posAttr.getX(i) + Math.sin(t * 0.6 + i) * delta * 0.06;
      posAttr.setXY(i, x, y);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <group>
      {/* Main Polished Temple Tile Floor (extended for expanded front rows) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4.5]} receiveShadow>
        <planeGeometry args={[30, 52]} />
        <meshStandardMaterial map={floorTex} roughness={0.42} metalness={0.12} />
      </mesh>

      {/* Long Deep-Red Ceremonial Carpet stretching from Expanded Entrance directly to the Stepped Altar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 4.6]} receiveShadow>
        <planeGeometry args={[2.48, 30.8]} />
        <meshStandardMaterial
          map={carpetTex}
          roughness={0.76}
          metalness={0.06}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Spacious Brown-and-Gold Kneeling Mats (Symmetrical Left & Right Wings with Wide Walking Aisles) */}
      <instancedMesh
        ref={matBaseInstancedRef}
        args={[undefined, undefined, TOTAL_MAIN_MATS]}
        receiveShadow
      >
        <boxGeometry args={[0.64, 0.026, 0.58]} />
        <meshStandardMaterial color="#b5832d" roughness={0.55} metalness={0.35} />
      </instancedMesh>

      <instancedMesh
        ref={matPadInstancedRef}
        args={[undefined, undefined, TOTAL_MAIN_MATS]}
        receiveShadow
      >
        <boxGeometry args={[0.56, 0.034, 0.5]} />
        <meshStandardMaterial map={matTex} roughness={0.68} metalness={0.1} />
      </instancedMesh>

      {/* Warm Multi-Tiered Golden Lotus Chandeliers flanking the Sanctuary Aisles (Unobstructed Center!) */}
      {CHANDELIER_COORDS.map(([cx, cy, cz], cIdx) => (
        <group key={`chandelier-${cIdx}`} position={[cx, cy, cz]}>
          {/* Suspension Rod */}
          <mesh position={[0, 1.6, 0]} material={goldAccentMat}>
            <cylinderGeometry args={[0.04, 0.04, 3.2, 8]} />
          </mesh>
          {/* Upper Golden Canopy */}
          <mesh position={[0, 0.35, 0]} material={goldAccentMat}>
            <coneGeometry args={[0.55, 0.28, 12]} />
          </mesh>
          {/* Main Gilded Chandelier Wheel */}
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldAccentMat}>
            <torusGeometry args={[0.78, 0.045, 10, 28]} />
          </mesh>
          <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldAccentMat}>
            <torusGeometry args={[0.46, 0.035, 8, 24]} />
          </mesh>
          {/* 6 Glowing Lotus Candle Cups around Chandelier Ring */}
          {[0, 1, 2, 3, 4, 5].map((lampIdx) => {
            const a = (lampIdx / 6) * Math.PI * 2;
            const lx = Math.cos(a) * 0.78;
            const lz = Math.sin(a) * 0.78;
            return (
              <group key={lampIdx} position={[lx, 0.06, lz]}>
                <mesh material={lotusOrnamentMat}>
                  <cylinderGeometry args={[0.11, 0.05, 0.09, 7]} />
                </mesh>
                <mesh position={[0, 0.08, 0]}>
                  <sphereGeometry args={[0.055, 8, 8]} />
                  <meshBasicMaterial color="#fff1a8" />
                </mesh>
              </group>
            );
          })}
          {/* Lower Golden Finial Drop */}
          <mesh position={[0, -0.45, 0]} material={goldAccentMat}>
            <sphereGeometry args={[0.1, 10, 10]} />
          </mesh>
        </group>
      ))}

      {/* High Vaulted Ironwood Pillars, Carved Lotus Collars & Flanking Lanterns */}
      {PILLAR_Z_POSITIONS.map((pz, idx) => (
        <group key={`colonnade-${idx}`} position={[0, 0, pz]}>
          {[-7.25, 7.25].map((px, sideIdx) => (
            <group key={`pillar-${sideIdx}`} position={[px, 0, 0]}>
              <mesh position={[0, 0.24, 0]} material={stoneBaseMat}>
                <cylinderGeometry args={[0.48, 0.56, 0.48, 16]} />
              </mesh>
              <mesh position={[0, 0.5, 0]} material={goldAccentMat}>
                <torusGeometry args={[0.46, 0.04, 8, 18]} />
              </mesh>
              <mesh position={[0, 8.7, 0]} material={darkPillarMat} castShadow>
                <cylinderGeometry args={[0.35, 0.4, 16.8, 18]} />
              </mesh>
              {/* Carved Golden & Pink Lotus Pillar Medallion */}
              <mesh position={[0, 13.4, 0]} material={goldAccentMat}>
                <torusGeometry args={[0.38, 0.048, 8, 20]} />
              </mesh>
              <mesh position={[0, 13.22, 0]} material={lotusOrnamentMat}>
                <cylinderGeometry args={[0.42, 0.36, 0.14, 10]} />
              </mesh>

              {/* Hanging Traditional Hexagonal Red-and-Gold Lantern */}
              <group position={[sideIdx === 0 ? 1.05 : -1.05, 10.6, 0]}>
                <mesh
                  position={[sideIdx === 0 ? -0.5 : 0.5, 0.55, 0]}
                  rotation={[0, 0, Math.PI / 2]}
                  material={darkPillarMat}
                >
                  <cylinderGeometry args={[0.05, 0.05, 1.1, 8]} />
                </mesh>
                <mesh position={[0, 0.32, 0]} material={goldAccentMat}>
                  <cylinderGeometry args={[0.015, 0.015, 0.45, 6]} />
                </mesh>
                <mesh position={[0, 0.16, 0]} material={goldAccentMat}>
                  <cylinderGeometry args={[0.12, 0.34, 0.12, 6]} />
                </mesh>
                <mesh position={[0, -0.12, 0]} material={lanternSilkMat}>
                  <cylinderGeometry args={[0.28, 0.24, 0.46, 6]} />
                </mesh>
                <mesh position={[0, -0.38, 0]} material={goldAccentMat}>
                  <cylinderGeometry args={[0.22, 0.08, 0.1, 6]} />
                </mesh>
                <mesh position={[0, -0.56, 0]}>
                  <cylinderGeometry args={[0.025, 0.04, 0.28, 6]} />
                  <meshBasicMaterial color="#d62828" />
                </mesh>
              </group>
            </group>
          ))}

          {/* High Vaulted Roof Beam (Vì Kèo Thượng Điện — raised cleanly to y = 17.3 above elevated Buddha halo y = 14.92!) */}
          <mesh position={[0, 17.3, 0]} material={darkPillarMat}>
            <boxGeometry args={[19.2, 0.44, 0.4]} />
          </mesh>
        </group>
      ))}

      {/* High Flanking Ceremonial Gilded Brackets (Cửa Võng Vàng 2 Bên — Open Center Archway at y = 16.7!) */}
      <group position={[0, 16.7, -7.8]}>
        <mesh position={[0, 0.55, 0]} material={goldAccentMat}>
          <boxGeometry args={[15.2, 0.42, 0.18]} />
        </mesh>
        <mesh position={[-6.1, -0.58, 0]} material={goldAccentMat}>
          <boxGeometry args={[2.6, 1.25, 0.14]} />
        </mesh>
        <mesh position={[6.1, -0.58, 0]} material={goldAccentMat}>
          <boxGeometry args={[2.6, 1.25, 0.14]} />
        </mesh>
      </group>

      {/* Side Temple Walls & Vaulted Ceiling (raised to y = 17.7 so nothing intersects elevated Buddha!) */}
      <mesh position={[-10.4, 8.9, 4.5]} material={darkPillarMat}>
        <boxGeometry args={[0.45, 17.8, 52]} />
      </mesh>
      <mesh position={[10.4, 8.9, 4.5]} material={darkPillarMat}>
        <boxGeometry args={[0.45, 17.8, 52]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 17.7, 4.5]} material={darkPillarMat}>
        <planeGeometry args={[22, 52]} />
      </mesh>

      {/* Warm Chandelier & Sanctuary Fill Lights */}
      <pointLight
        position={[-5.55, 11.8, -5.2]}
        color="#ffc266"
        intensity={6.8}
        distance={22}
        decay={1.55}
      />
      <pointLight
        position={[5.55, 11.8, -5.2]}
        color="#ffc266"
        intensity={6.8}
        distance={22}
        decay={1.55}
      />
      <pointLight
        position={[-5.55, 10.6, 5.8]}
        color="#ffb34d"
        intensity={5.4}
        distance={21}
        decay={1.6}
      />
      <pointLight
        position={[5.55, 10.6, 5.8]}
        color="#ffb34d"
        intensity={5.4}
        distance={21}
        decay={1.6}
      />

      {/* Gentle Floating Golden Temple Particles */}
      <points ref={dustPointsRef} geometry={dustGeometry}>
        <pointsMaterial
          color="#ffe48f"
          size={0.095}
          sizeAttenuation
          transparent
          opacity={0.58}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
