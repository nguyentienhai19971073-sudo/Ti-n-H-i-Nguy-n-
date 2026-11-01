import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ActiveXinXamVisualState, BuddhaModelLoadStatus } from '../../types/temple';
import {
  ALTAR_CENTER_Z,
  BUDDHA_ELEVATION_Y,
  BUDDHA_STATUE_SCALE,
  SANCTUARY_BUDDHA_BOUNDS,
} from '../../systems/SeatManager';
import { createBannerTexture, createRadialGlowTexture } from './templeResources';

interface BuddhaAltarProps {
  altarGlowUntil: number;
  bellRingUntil: number;
  incenseGlowUntil: number;
  fruitGlowUntil: number;
  lotusGlowUntil: number;
  pagodaGlowUntil: number;
  xinXamGlowUntil?: number;
  activeXinXamVisual?: ActiveXinXamVisualState | null;
  floatingLanternCount: number;
  buddhaModelUrl?: string;
  buddhaGoldOverride?: boolean;
  onBuddhaModelStatus?: (status: BuddhaModelLoadStatus, detail?: string) => void;
}

// Exported Sanctuary Buddha world-space bounding constants for camera framing & UI exclusion checks
export const BUDDHA_WORLD_BOUNDS = {
  ...SANCTUARY_BUDDHA_BOUNDS,
};

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        for (const val of Object.values(m)) {
          if (val && typeof val === 'object' && 'isTexture' in val) {
            (val as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

export function BuddhaAltar({
  altarGlowUntil,
  bellRingUntil,
  incenseGlowUntil,
  fruitGlowUntil,
  lotusGlowUntil,
  pagodaGlowUntil,
  xinXamGlowUntil = 0,
  activeXinXamVisual = null,
  floatingLanternCount,
  buddhaModelUrl = '',
  buddhaGoldOverride = true,
  onBuddhaModelStatus,
}: BuddhaAltarProps) {
  const haloRef = useRef<THREE.Group>(null);
  const haloInnerRef = useRef<THREE.Group>(null);
  const auraLightRef = useRef<THREE.PointLight>(null);
  const rimLightRef = useRef<THREE.PointLight>(null);
  const auraDiscRef = useRef<THREE.Mesh>(null);
  const crownGlowRef = useRef<THREE.Mesh>(null);
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
  const xinXamTubeGroupRef = useRef<THREE.Group>(null);
  const xinXamGlowingStickRef = useRef<THREE.Group>(null);
  const xinXamSpotLightRef = useRef<THREE.PointLight>(null);

  const [externalBuddhaScene, setExternalBuddhaScene] = useState<THREE.Group | null>(null);

  // ============================================================================
  // REALISTIC 24K GILDED GOLD PBR MATERIALS (MeshPhysicalMaterial + Clearcoat)
  // ============================================================================
  const goldStatueMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffdf6b',
        metalness: 0.92,
        roughness: 0.16,
        clearcoat: 0.56,
        clearcoatRoughness: 0.15,
        reflectivity: 1.0,
        envMapIntensity: 1.48,
        emissive: '#784805',
        emissiveIntensity: 0.34,
      }),
    [],
  );

  const goldRobeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#f5c748',
        metalness: 0.88,
        roughness: 0.27,
        clearcoat: 0.38,
        clearcoatRoughness: 0.26,
        envMapIntensity: 1.28,
        emissive: '#663a04',
        emissiveIntensity: 0.27,
      }),
    [],
  );

  const goldTrimMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#e6b238',
        metalness: 0.87,
        roughness: 0.24,
        clearcoat: 0.32,
        clearcoatRoughness: 0.24,
        emissive: '#523004',
        emissiveIntensity: 0.22,
      }),
    [],
  );

  const buddhaHairMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#d49a24',
        metalness: 0.84,
        roughness: 0.34,
        clearcoat: 0.22,
        emissive: '#472803',
        emissiveIntensity: 0.2,
      }),
    [],
  );

  const buddhaFeatureMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#734406',
        metalness: 0.62,
        roughness: 0.36,
      }),
    [],
  );

  const lotusPetalMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#f59ab7',
        metalness: 0.26,
        roughness: 0.26,
        clearcoat: 0.62,
        clearcoatRoughness: 0.18,
        emissive: '#731e39',
        emissiveIntensity: 0.28,
      }),
    [],
  );

  const darkWoodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#291309',
        metalness: 0.12,
        roughness: 0.52,
      }),
    [],
  );

  const crimsonLacquerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6b0f14',
        metalness: 0.24,
        roughness: 0.34,
      }),
    [],
  );

  const bronzeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c8963e',
        metalness: 0.87,
        roughness: 0.26,
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

  const bambooTubeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b88339',
        roughness: 0.38,
        metalness: 0.18,
        emissive: '#3d2206',
        emissiveIntensity: 0.2,
      }),
    [],
  );

  const bambooStickMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ecd08b',
        roughness: 0.34,
        metalness: 0.14,
        emissive: '#63430c',
        emissiveIntensity: 0.25,
      }),
    [],
  );

  // ============================================================================
  // SCULPTED 3D PROCEDURAL GEOMETRIES (Lathe + Extrude + Tube Robe Drapery)
  // ============================================================================
  const sculptedGeos = useMemo(() => {
    // 1. Turned Waisted Sumeru Pedestal (Bệ Tu Di Tam Cấp)
    const pedestalPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(2.48, 0.0),
      new THREE.Vector2(2.52, 0.14),
      new THREE.Vector2(2.26, 0.24),
      new THREE.Vector2(2.14, 0.38),
      new THREE.Vector2(1.62, 0.56), // Waisted Sumeru drum
      new THREE.Vector2(1.56, 0.72),
      new THREE.Vector2(1.88, 0.92), // Lotus receptacle rim
      new THREE.Vector2(1.98, 1.12),
      new THREE.Vector2(1.76, 1.18), // Flat lotus seed pod (Gương Sen)
      new THREE.Vector2(0.0, 1.18),
    ];
    const sumeruPedestal = new THREE.LatheGeometry(pedestalPts, 40);

    // 2. Genuine Curved 3D Sculpted Lotus Petal (ExtrudeGeometry with smooth bevel)
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(0.28, 0.08, 0.39, 0.42, 0.24, 0.76);
    petalShape.quadraticCurveTo(0.08, 0.96, 0, 1.06);
    petalShape.quadraticCurveTo(-0.08, 0.96, -0.24, 0.76);
    petalShape.bezierCurveTo(-0.39, 0.42, -0.28, 0.08, 0, 0);

    const lotusPetal = new THREE.ExtrudeGeometry(petalShape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.042,
      bevelThickness: 0.045,
      curveSegments: 16,
    });
    lotusPetal.center();

    // 3. Natural Sculpted Contoured Buddha Torso (LatheGeometry from waist to calm broad shoulders)
    const torsoPts = [
      new THREE.Vector2(0.0, 0.36),
      new THREE.Vector2(1.16, 0.38), // Draped lower robe hem
      new THREE.Vector2(1.02, 0.72),
      new THREE.Vector2(0.84, 1.08), // Graceful meditative waist
      new THREE.Vector2(0.92, 1.48), // Serene open chest
      new THREE.Vector2(1.06, 1.92), // Broad compassionate shoulders
      new THREE.Vector2(0.92, 2.22),
      new THREE.Vector2(0.46, 2.42), // Collar & neck base
      new THREE.Vector2(0.0, 2.44),
    ];
    const sculptedTorso = new THREE.LatheGeometry(torsoPts, 36);
    sculptedTorso.scale(1.08, 1.0, 0.76);

    // 4. Turned Sacred Alms Bowl / Lotus Reliquary (Bát Bửu Thiền Định)
    const bowlPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.18, 0.0),
      new THREE.Vector2(0.32, 0.09),
      new THREE.Vector2(0.36, 0.21),
      new THREE.Vector2(0.31, 0.31),
      new THREE.Vector2(0.26, 0.31),
      new THREE.Vector2(0.24, 0.16),
      new THREE.Vector2(0.0, 0.14),
    ];
    const almsBowl = new THREE.LatheGeometry(bowlPts, 28);

    // 5. Flowing 3D Monastic Robe Folds (Áo Cà Sa TubeGeometries)
    const leftSashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.78, 2.22, 0.36),
      new THREE.Vector3(-0.56, 1.82, 0.64),
      new THREE.Vector3(-0.18, 1.35, 0.68),
      new THREE.Vector3(0.28, 0.94, 0.62),
      new THREE.Vector3(0.56, 0.62, 0.56),
    ]);
    const robeFoldPrimary = new THREE.TubeGeometry(leftSashCurve, 28, 0.068, 12, false);

    const innerFoldCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.62, 2.26, 0.42),
      new THREE.Vector3(-0.34, 1.76, 0.69),
      new THREE.Vector3(0.04, 1.32, 0.7),
      new THREE.Vector3(0.38, 0.98, 0.64),
    ]);
    const robeFoldSecondary = new THREE.TubeGeometry(innerFoldCurve, 24, 0.052, 10, false);

    const rightCollarCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.76, 2.2, 0.36),
      new THREE.Vector3(0.54, 1.78, 0.64),
      new THREE.Vector3(0.18, 1.38, 0.69),
      new THREE.Vector3(-0.14, 1.04, 0.66),
    ]);
    const robeFoldRight = new THREE.TubeGeometry(rightCollarCurve, 24, 0.058, 10, false);

    const lapApronCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.56, 0.42, 0.88),
      new THREE.Vector3(-0.28, 0.18, 1.06),
      new THREE.Vector3(0.0, 0.08, 1.12),
      new THREE.Vector3(0.28, 0.18, 1.06),
      new THREE.Vector3(0.56, 0.42, 0.88),
    ]);
    const lapDraperyFold = new THREE.TubeGeometry(lapApronCurve, 24, 0.062, 10, false);

    // 6. Ornate Pointed Bodhi-Leaf Mandorla Frame (Thân Quang Lá Bồ Đề)
    const bodhiOuter = new THREE.Shape();
    bodhiOuter.moveTo(0, -1.75);
    bodhiOuter.bezierCurveTo(1.75, -1.65, 2.32, -0.35, 1.96, 0.92);
    bodhiOuter.bezierCurveTo(1.62, 1.72, 0.62, 2.15, 0, 2.42);
    bodhiOuter.bezierCurveTo(-0.62, 2.15, -1.62, 1.72, -1.96, 0.92);
    bodhiOuter.bezierCurveTo(-2.32, -0.35, -1.75, -1.65, 0, -1.75);

    const bodhiHole = new THREE.Path();
    bodhiHole.moveTo(0, -1.52);
    bodhiHole.bezierCurveTo(1.48, -1.42, 1.98, -0.28, 1.68, 0.82);
    bodhiHole.bezierCurveTo(1.38, 1.48, 0.52, 1.86, 0, 2.1);
    bodhiHole.bezierCurveTo(-0.52, 1.86, -1.38, 1.48, -1.68, 0.82);
    bodhiHole.bezierCurveTo(-1.98, -0.28, -1.48, -1.42, 0, -1.52);
    bodhiOuter.holes.push(bodhiHole);

    const bodhiMandorlaRim = new THREE.ExtrudeGeometry(bodhiOuter, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      curveSegments: 28,
    });

    return {
      sumeruPedestal,
      lotusPetal,
      sculptedTorso,
      almsBowl,
      robeFoldPrimary,
      robeFoldSecondary,
      robeFoldRight,
      lapDraperyFold,
      bodhiMandorlaRim,
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(sculptedGeos).forEach((g) => g.dispose());
    };
  }, [sculptedGeos]);

  // 3D Spiral Hair Curls (Tóc Bụt Xoắn Ốc) covering cranial dome & Ushnisha
  const hairCurlPositions = useMemo(() => {
    const curls: [number, number, number][] = [];
    const domeRings = [
      { y: 0.24, r: 0.65, count: 18, zMin: -0.68, zMax: 0.34 },
      { y: 0.4, r: 0.58, count: 16, zMin: -0.6, zMax: 0.44 },
      { y: 0.55, r: 0.46, count: 14, zMin: -0.48, zMax: 0.48 },
      { y: 0.67, r: 0.31, count: 10, zMin: -0.34, zMax: 0.34 },
      // Ushnisha (Nhục Kế) crown curls
      { y: 0.82, r: 0.27, count: 10, zMin: -0.3, zMax: 0.3 },
      { y: 0.96, r: 0.19, count: 8, zMin: -0.22, zMax: 0.22 },
    ];
    for (const ring of domeRings) {
      for (let i = 0; i < ring.count; i++) {
        const a = (i / ring.count) * Math.PI * 2;
        const cx = Math.sin(a) * ring.r * 0.94;
        const cz = Math.cos(a) * ring.r * 0.96 - 0.02;
        if (cz <= ring.zMax && cz >= ring.zMin) {
          curls.push([cx, ring.y, cz]);
        }
      }
    }
    return curls;
  }, []);

  // ============================================================================
  // CONFIGURABLE EXTERNAL / LOCAL GLB OR GLTF BUDDHA MODEL LOADER
  // Automatically normalizes scale onto the Lotus Pedestal & falls back safely
  // ============================================================================
  useEffect(() => {
    const cleanUrl = buddhaModelUrl.trim();
    if (!cleanUrl) {
      setExternalBuddhaScene((prev) => {
        if (prev) disposeObject3D(prev);
        return null;
      });
      onBuddhaModelStatus?.('builtin', 'Đang sử dụng tôn tượng Đức Phật Vàng điêu khắc 3D tích hợp');
      return;
    }

    let cancelled = false;
    onBuddhaModelStatus?.('loading', `Đang tải mô hình GLB/GLTF: ${cleanUrl}`);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(
      cleanUrl,
      (gltf) => {
        if (cancelled) {
          disposeObject3D(gltf.scene);
          dracoLoader.dispose();
          return;
        }

        const wrapper = new THREE.Group();
        const modelRoot = gltf.scene;

        // Compute bounding box & normalize to fit cleanly atop the Lotus Pedestal (target local height = 3.12)
        const box = new THREE.Box3().setFromObject(modelRoot);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.y, size.x, size.z, 0.001);
        const normScale = 3.12 / maxDim;
        modelRoot.scale.setScalar(normScale);

        const scaledBox = new THREE.Box3().setFromObject(modelRoot);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);

        modelRoot.position.set(
          -scaledCenter.x,
          -scaledBox.min.y,
          -scaledCenter.z,
        );

        modelRoot.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (buddhaGoldOverride) {
              mesh.material = goldStatueMat.clone();
            }
          }
        });

        wrapper.add(modelRoot);

        setExternalBuddhaScene((prev) => {
          if (prev) disposeObject3D(prev);
          return wrapper;
        });
        onBuddhaModelStatus?.('loaded', `Đã tải mô hình 3D tùy chỉnh: ${cleanUrl}`);
        dracoLoader.dispose();
      },
      undefined,
      (err) => {
        if (cancelled) {
          dracoLoader.dispose();
          return;
        }
        console.warn('[BuddhaAltar] Không tải được GLB/GLTF, tự động dùng tôn tượng tích hợp:', err);
        setExternalBuddhaScene((prev) => {
          if (prev) disposeObject3D(prev);
          return null;
        });
        onBuddhaModelStatus?.(
          'fallback_error',
          'Không tải được tệp GLB/GLTF — đã tự động chuyển về tôn tượng vàng tích hợp.',
        );
        dracoLoader.dispose();
      },
    );

    return () => {
      cancelled = true;
      dracoLoader.dispose();
    };
  }, [buddhaModelUrl, buddhaGoldOverride, goldStatueMat, onBuddhaModelStatus]);

  const leftCoupletTex = useMemo(
    () => createBannerTexture(['NAM', 'MÔ', 'A', 'DI', 'ĐÀ', 'PHẬT']),
    [],
  );
  const rightCoupletTex = useMemo(
    () => createBannerTexture(['PHẬT', 'QUANG', 'PHỔ', 'CHIẾU', 'AN', 'LẠC']),
    [],
  );
  const haloGlowTex = useMemo(
    () => createRadialGlowTexture('rgba(255, 244, 184, 0.96)', 'rgba(238, 174, 42, 0.36)'),
    [],
  );

  const lotusAnglesLower = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ((i + 0.5) / 18) * Math.PI * 2),
    [],
  );
  const lotusAnglesOuter = useMemo(
    () => Array.from({ length: 20 }, (_, i) => (i / 20) * Math.PI * 2),
    [],
  );
  const lotusAnglesInner = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ((i + 0.5) / 18) * Math.PI * 2),
    [],
  );
  const lotusStamenAngles = useMemo(
    () => Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2),
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
          basinX: basinSide * 2.52,
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
      haloRef.current.rotation.z += delta * (isBlessed ? 0.42 : 0.09);
    }
    if (haloInnerRef.current) {
      haloInnerRef.current.rotation.z -= delta * (isBlessed ? 0.32 : 0.07);
    }

    if (auraLightRef.current) {
      const targetIntensity = isPagodaActive
        ? 30
        : isBlessed
          ? 24
          : 15.8 + Math.sin(t * 1.4) * 0.85;
      auraLightRef.current.intensity = THREE.MathUtils.damp(
        auraLightRef.current.intensity,
        targetIntensity,
        4,
        delta,
      );
    }

    if (rimLightRef.current) {
      const targetRim = isPagodaActive || isBlessed ? 14.5 : 8.8 + Math.cos(t * 1.2) * 0.5;
      rimLightRef.current.intensity = THREE.MathUtils.damp(
        rimLightRef.current.intensity,
        targetRim,
        4,
        delta,
      );
    }

    if (ceremonySpotLightRef.current) {
      const targetCeremonyGlow =
        isPagodaActive || isLotusActive || isFruitActive ? 8.5 : 2.4;
      ceremonySpotLightRef.current.intensity = THREE.MathUtils.damp(
        ceremonySpotLightRef.current.intensity,
        targetCeremonyGlow,
        4,
        delta,
      );
    }

    if (auraDiscRef.current) {
      const targetScale = isBlessed
        ? 1.26 + Math.sin(t * 4.0) * 0.04
        : 1.02 + Math.sin(t * 1.3) * 0.025;
      const s = THREE.MathUtils.damp(auraDiscRef.current.scale.x, targetScale, 4, delta);
      auraDiscRef.current.scale.set(s, s, 1);
    }

    if (crownGlowRef.current) {
      const cs = 1.0 + Math.sin(t * 2.2) * 0.06;
      crownGlowRef.current.scale.set(cs, cs, 1);
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
      const speed = isIncenseGlowing ? 0.52 : 0.32;
      const cycle = (t * speed + idx * 0.2) % 1;
      mesh.position.y = 1.72 + cycle * (isIncenseGlowing ? 2.6 : 1.85);
      mesh.position.x = Math.sin(t * 1.6 + idx * 1.7) * 0.16 * cycle;
      const scale = (isIncenseGlowing ? 0.28 : 0.2) + cycle * 0.75;
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(cycle * Math.PI) * (isIncenseGlowing ? 0.3 : 0.15);
    });

    if (bellSwingGroupRef.current && bellStrikerRef.current && bellWaveRingRef.current) {
      if (isBellRinging) {
        const remain = (bellRingUntil - now) / 5600;
        const swingAmp = Math.sin(t * 7.5) * 0.15 * Math.max(0.15, remain);
        bellSwingGroupRef.current.rotation.z = swingAmp;
        bellStrikerRef.current.position.x = -0.64 + Math.max(0, Math.sin(t * 7.5)) * 0.22 * remain;

        bellWaveRingRef.current.visible = true;
        const waveCycle = (t * 1.35) % 1;
        const ringScale = 0.7 + waveCycle * 2.8;
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
          -0.64,
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

    // Animate 3D Xin Xăm Stand: bamboo container idle/active state + rising glowing bamboo fortune stick
    const isXinXamGlowing = now < xinXamGlowUntil || Boolean(activeXinXamVisual);
    if (xinXamSpotLightRef.current) {
      const targetIntensity = isXinXamGlowing ? 7.8 : 1.8;
      xinXamSpotLightRef.current.intensity = THREE.MathUtils.damp(
        xinXamSpotLightRef.current.intensity,
        targetIntensity,
        5,
        delta,
      );
    }

    if (xinXamTubeGroupRef.current) {
      const heldByWorshipper =
        activeXinXamVisual &&
        (activeXinXamVisual.stage === 'pickup_tube' ||
          activeXinXamVisual.stage === 'shaking' ||
          activeXinXamVisual.stage === 'stick_falling');
      xinXamTubeGroupRef.current.visible = !heldByWorshipper;
    }

    if (xinXamGlowingStickRef.current) {
      const showRadiantStick =
        Boolean(
          activeXinXamVisual &&
            (activeXinXamVisual.stage === 'stick_falling' ||
              activeXinXamVisual.stage === 'revealed' ||
              activeXinXamVisual.stage === 'bowing'),
        ) || now < xinXamGlowUntil;

      xinXamGlowingStickRef.current.visible = showRadiantStick;
      if (showRadiantStick) {
        xinXamGlowingStickRef.current.position.y = THREE.MathUtils.damp(
          xinXamGlowingStickRef.current.position.y,
          1.78 + Math.sin(t * 3.1) * 0.08,
          5,
          delta,
        );
        xinXamGlowingStickRef.current.rotation.y = t * 1.15;
      } else {
        xinXamGlowingStickRef.current.position.y = 1.05;
      }
    }
  });

  return (
    <group position={[0, 0, ALTAR_CENTER_Z]}>
      {/* Grand Sanctuary Carved Rosewood & Crimson Lacquer Backdrop (raised cleanly for elevated Buddha!) */}
      <group position={[0, 0, -3.2]}>
        <mesh position={[0, 8.6, 0]} material={darkWoodMat}>
          <boxGeometry args={[17.2, 17.2, 0.58]} />
        </mesh>
        <mesh position={[0, 8.4, 0.31]} material={crimsonLacquerMat}>
          <boxGeometry args={[11.8, 15.6, 0.14]} />
        </mesh>
        {/* High Gilded Horizontal Sanctuary Plaque (Hoành Phi Đại Hùng Bảo Điện — raised to y = 16.25 cleanly above halo y = 14.92!) */}
        <mesh position={[0, 16.25, 0.48]} material={goldTrimMat}>
          <boxGeometry args={[8.4, 0.96, 0.22]} />
        </mesh>
        <mesh position={[0, 16.25, 0.61]} material={crimsonLacquerMat}>
          <boxGeometry args={[7.8, 0.66, 0.06]} />
        </mesh>

        {/* Left & Right Tall Gilded Calligraphy Couplets (Câu Đối) flanking the elevated Buddha */}
        <mesh position={[-6.05, 8.8, 0.4]}>
          <planeGeometry args={[1.18, 9.6]} />
          <meshStandardMaterial map={leftCoupletTex} roughness={0.36} metalness={0.28} />
        </mesh>
        <mesh position={[6.05, 8.8, 0.4]}>
          <planeGeometry args={[1.18, 9.6]} />
          <meshStandardMaterial map={rightCoupletTex} roughness={0.36} metalness={0.28} />
        </mesh>
      </group>

      {/* ====================================================================
          NATURALLY ELEVATED 5-TIER STEPPED SANCTUARY PLATFORM WITH TRADITIONAL STEPS
          (Bệ Thờ Thượng Điện Ngũ Cấp — y = 0 .. 3.88 supporting the raised Buddha)
         ==================================================================== */}
      <group>
        {/* Tier 1 Foundation Terrace (y = 0 .. 0.62) */}
        <mesh position={[0, 0.31, 0.4]} material={darkWoodMat} receiveShadow>
          <boxGeometry args={[13.2, 0.62, 6.4]} />
        </mesh>
        <mesh position={[0, 0.64, 0.4]} material={goldTrimMat}>
          <boxGeometry args={[13.34, 0.07, 6.52]} />
        </mesh>

        {/* Tier 2 Sanctuary Terrace (y = 0.64 .. 1.56, supports the Offering Altar Table at y = 1.58) */}
        <mesh position={[0, 1.1, -0.05]} material={crimsonLacquerMat} receiveShadow>
          <boxGeometry args={[11.2, 0.92, 5.4]} />
        </mesh>
        <mesh position={[0, 1.58, -0.05]} material={goldTrimMat}>
          <boxGeometry args={[11.34, 0.08, 5.52]} />
        </mesh>

        {/* Tier 3 Upper Sanctuary Dais (y = 1.58 .. 2.52) */}
        <mesh position={[0, 2.05, -0.68]} material={darkWoodMat} receiveShadow>
          <boxGeometry args={[9.4, 0.94, 4.25]} />
        </mesh>
        <mesh position={[0, 2.54, -0.68]} material={goldTrimMat}>
          <boxGeometry args={[9.54, 0.08, 4.36]} />
        </mesh>

        {/* Tier 4 Sculpted Sumeru Upper Throne Base (y = 2.54 .. 3.88) */}
        <mesh position={[0, 3.2, -0.82]} material={crimsonLacquerMat} receiveShadow>
          <boxGeometry args={[7.8, 1.32, 3.85]} />
        </mesh>
        <mesh position={[0, 3.86, -0.82]} material={goldTrimMat}>
          <boxGeometry args={[7.98, 0.09, 3.98]} />
        </mesh>

        {/* Traditional Carved Central Temple Steps leading onto the Sanctuary Platform */}
        {[0, 1, 2, 3].map((stepIdx) => {
          const stepH = 0.36;
          const sy = stepIdx * 0.38 + stepH * 0.5;
          const sz = 3.55 - stepIdx * 0.38;
          return (
            <group key={`altar-step-${stepIdx}`} position={[0, sy, sz]}>
              <mesh material={darkWoodMat} receiveShadow>
                <boxGeometry args={[3.4 - stepIdx * 0.14, stepH, 0.44]} />
              </mesh>
              <mesh position={[0, stepH * 0.5 + 0.015, 0.02]} material={goldTrimMat}>
                <boxGeometry args={[3.46 - stepIdx * 0.14, 0.035, 0.46]} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ====================================================================
          SACRED 24K GOLDEN BUDDHA STATUE & SCULPTED THREE-TIER LOTUS THRONE
          - Raised vertically to y = BUDDHA_ELEVATION_Y (3.88)
          - Scale preserved at EXACT BUDDHA_STATUE_SCALE (1.82) — ZERO enlargement!
         ==================================================================== */}
      <group
        position={[0, BUDDHA_ELEVATION_Y, -0.82]}
        scale={[BUDDHA_STATUE_SCALE, BUDDHA_STATUE_SCALE, BUDDHA_STATUE_SCALE]}
      >
        {/* 1. Turned Sumeru Throne & Flat Golden Lotus Seed Pod (Bệ Tu Di & Gương Sen) */}
        <mesh geometry={sculptedGeos.sumeruPedestal} material={goldTrimMat} castShadow receiveShadow />

        {/* Lower Tier: 18 Downward-Sweeping Sculpted 3D Lotus Skirt Petals */}
        {lotusAnglesLower.map((angle, i) => (
          <group key={`lower-petal-${i}`} rotation={[0, angle, 0]}>
            <mesh
              position={[0, 0.34, 2.08]}
              rotation={[2.38, 0, 0]}
              scale={[0.88, 0.62, 0.9]}
              geometry={sculptedGeos.lotusPetal}
              material={goldTrimMat}
            />
          </group>
        ))}

        {/* Middle Outer Tier: 20 Blooming Rose-Enamel & 24K Gold Sculpted Petals */}
        {lotusAnglesOuter.map((angle, i) => (
          <group key={`outer-petal-${i}`} rotation={[0, angle, 0]}>
            <mesh
              position={[0, 0.72, 1.98]}
              rotation={[-0.52, 0, 0]}
              scale={[1.05, 0.88, 1.0]}
              geometry={sculptedGeos.lotusPetal}
              material={i % 2 === 0 ? goldStatueMat : lotusPetalMat}
              castShadow
            />
          </group>
        ))}

        {/* Upper Inner Tier: 18 Cupping 24K Polished Gold Lotus Petals */}
        {lotusAnglesInner.map((angle, i) => (
          <group key={`inner-petal-${i}`} rotation={[0, angle, 0]}>
            <mesh
              position={[0, 0.92, 1.76]}
              rotation={[-0.28, 0, 0]}
              scale={[0.96, 0.84, 0.95]}
              geometry={sculptedGeos.lotusPetal}
              material={goldStatueMat}
              castShadow
            />
          </group>
        ))}

        {/* Golden Lotus Stamen Beads (Nhụy Sen Vàng) encircling the seed pod rim */}
        {lotusStamenAngles.map((angle, i) => (
          <mesh
            key={`stamen-${i}`}
            position={[Math.sin(angle) * 1.66, 1.2, Math.cos(angle) * 1.66]}
            material={goldStatueMat}
          >
            <sphereGeometry args={[0.068, 10, 10]} />
          </mesh>
        ))}

        {/* 2. GOLDEN BUDDHA BODY (External GLB/GLTF if loaded, else High-Detail Sculpted Statue) */}
        <group position={[0, 1.18, 0]}>
          {externalBuddhaScene ? (
            <primitive object={externalBuddhaScene} />
          ) : (
            <group>
              {/* A. Full-Lotus Seated Posture (Kiết Già / Padmasana) & Draped Robe Hem */}
              <mesh
                position={[0, 0.28, 0.14]}
                scale={[1.64, 0.46, 1.16]}
                material={goldRobeMat}
                castShadow
              >
                <sphereGeometry args={[1.04, 32, 24]} />
              </mesh>
              {/* Left & Right Sculpted Knees & Thighs */}
              <mesh
                position={[-0.96, 0.25, 0.34]}
                rotation={[0.08, 0.18, -0.2]}
                scale={[0.94, 0.42, 0.78]}
                material={goldRobeMat}
                castShadow
              >
                <sphereGeometry args={[0.82, 24, 18]} />
              </mesh>
              <mesh
                position={[0.96, 0.25, 0.34]}
                rotation={[0.08, -0.18, 0.2]}
                scale={[0.94, 0.42, 0.78]}
                material={goldRobeMat}
                castShadow
              >
                <sphereGeometry args={[0.82, 24, 18]} />
              </mesh>
              {/* Crossed Ankles & Upturned Peaceful Soles */}
              <mesh
                position={[-0.32, 0.46, 0.68]}
                rotation={[0.18, 0.35, 0.24]}
                scale={[0.42, 0.18, 0.26]}
                material={goldStatueMat}
              >
                <sphereGeometry args={[0.62, 16, 14]} />
              </mesh>
              <mesh
                position={[0.32, 0.46, 0.68]}
                rotation={[0.18, -0.35, -0.24]}
                scale={[0.42, 0.18, 0.26]}
                material={goldStatueMat}
              >
                <sphereGeometry args={[0.62, 16, 14]} />
              </mesh>
              {/* Draped Central Robe Apron cascading onto the Lotus Throne */}
              <mesh geometry={sculptedGeos.lapDraperyFold} material={goldTrimMat} />

              {/* B. Sculpted Contoured Torso, Broad Shoulders & Flowing Monastic Robes (Áo Cà Sa) */}
              <mesh geometry={sculptedGeos.sculptedTorso} material={goldRobeMat} castShadow />
              {/* Polished Gold Inner Chest Exposure */}
              <mesh
                position={[0, 1.88, 0.36]}
                scale={[0.64, 0.62, 0.44]}
                material={goldStatueMat}
              >
                <sphereGeometry args={[0.76, 24, 20]} />
              </mesh>
              {/* Subtle Golden Lotus Dharma Medallion on Chest */}
              <mesh position={[0, 1.84, 0.69]} rotation={[0.08, 0, Math.PI / 4]} material={goldTrimMat}>
                <boxGeometry args={[0.15, 0.15, 0.035]} />
              </mesh>

              {/* 3D Sculpted Catenary Robe Folds */}
              <mesh geometry={sculptedGeos.robeFoldPrimary} material={goldStatueMat} castShadow />
              <mesh geometry={sculptedGeos.robeFoldSecondary} material={goldTrimMat} />
              <mesh geometry={sculptedGeos.robeFoldRight} material={goldStatueMat} castShadow />

              {/* C. Graceful Shoulders, Arms, Dhyana Mudra Hands & Sacred Lotus Alms Bowl */}
              <mesh position={[-1.02, 2.02, 0.04]} scale={[0.92, 0.88, 0.88]} material={goldRobeMat}>
                <sphereGeometry args={[0.36, 20, 16]} />
              </mesh>
              <mesh position={[1.02, 2.02, 0.04]} scale={[0.92, 0.88, 0.88]} material={goldRobeMat}>
                <sphereGeometry args={[0.36, 20, 16]} />
              </mesh>
              {/* Upper Arms */}
              <mesh
                position={[-1.08, 1.48, 0.12]}
                rotation={[0.24, 0, 0.24]}
                material={goldRobeMat}
                castShadow
              >
                <capsuleGeometry args={[0.26, 0.88, 10, 18]} />
              </mesh>
              <mesh
                position={[1.08, 1.48, 0.12]}
                rotation={[0.24, 0, -0.24]}
                material={goldRobeMat}
                castShadow
              >
                <capsuleGeometry args={[0.26, 0.88, 10, 18]} />
              </mesh>
              {/* Forearms curving gently inward */}
              <mesh
                position={[-0.62, 0.84, 0.54]}
                rotation={[1.28, 0.34, -0.58]}
                material={goldStatueMat}
                castShadow
              >
                <capsuleGeometry args={[0.21, 0.72, 10, 16]} />
              </mesh>
              <mesh
                position={[0.62, 0.84, 0.54]}
                rotation={[1.28, -0.34, 0.58]}
                material={goldStatueMat}
                castShadow
              >
                <capsuleGeometry args={[0.21, 0.72, 10, 16]} />
              </mesh>
              {/* Meditative Palms Joined in Lap (Ấn Thiền Định) */}
              <mesh
                position={[-0.14, 0.64, 0.82]}
                rotation={[0.08, 0.22, 0.06]}
                scale={[1.25, 0.32, 0.72]}
                material={goldStatueMat}
              >
                <sphereGeometry args={[0.22, 16, 12]} />
              </mesh>
              <mesh
                position={[0.14, 0.68, 0.82]}
                rotation={[0.08, -0.22, -0.06]}
                scale={[1.25, 0.32, 0.72]}
                material={goldStatueMat}
              >
                <sphereGeometry args={[0.22, 16, 12]} />
              </mesh>
              {/* Turned Golden Alms Bowl & Radiant Mani Lotus Jewel */}
              <group position={[0, 0.71, 0.84]}>
                <mesh geometry={sculptedGeos.almsBowl} material={goldTrimMat} castShadow />
                <mesh position={[0, 0.32, 0]}>
                  <sphereGeometry args={[0.15, 20, 20]} />
                  <meshBasicMaterial color="#fff7c4" />
                </mesh>
              </group>

              {/* D. Auspicious Three-Fold Neck (Tam Đạo Cổ), Serene Face & Spiral Hair Curls */}
              <group position={[0, 2.52, 0.04]}>
                <mesh material={goldStatueMat}>
                  <cylinderGeometry args={[0.34, 0.41, 0.38, 24]} />
                </mesh>
                {[-0.07, 0.01, 0.09].map((ny, nIdx) => (
                  <mesh
                    key={`neck-fold-${nIdx}`}
                    position={[0, ny, 0.03]}
                    rotation={[Math.PI / 2, 0, 0]}
                    material={goldTrimMat}
                  >
                    <torusGeometry args={[0.36 - nIdx * 0.012, 0.014, 8, 24, Math.PI]} />
                  </mesh>
                ))}
              </group>

              {/* Sculpted Compassionate Head */}
              <group position={[0, 3.18, 0.08]}>
                {/* Smooth High-Segment Oval Cranium & Face */}
                <mesh scale={[0.91, 1.07, 0.95]} material={goldStatueMat} castShadow>
                  <sphereGeometry args={[0.68, 40, 32]} />
                </mesh>
                {/* Soft Compassionate Cheek & Chin Fullness */}
                <mesh position={[0, -0.2, 0.24]} scale={[0.78, 0.62, 0.72]} material={goldStatueMat}>
                  <sphereGeometry args={[0.52, 24, 20]} />
                </mesh>

                {/* Gracefully Arched Willow-Leaf Eyebrows */}
                <mesh
                  position={[-0.21, 0.11, 0.59]}
                  rotation={[0.08, -0.24, -0.12]}
                  material={buddhaFeatureMat}
                >
                  <torusGeometry args={[0.13, 0.014, 10, 20, Math.PI * 0.82]} />
                </mesh>
                <mesh
                  position={[0.21, 0.11, 0.59]}
                  rotation={[0.08, 0.24, 0.12]}
                  material={buddhaFeatureMat}
                >
                  <torusGeometry args={[0.13, 0.014, 10, 20, Math.PI * 0.82]} />
                </mesh>

                {/* Serene Half-Closed Meditative Upper Eyelids */}
                <mesh
                  position={[-0.21, 0.015, 0.61]}
                  scale={[1.15, 0.55, 0.5]}
                  rotation={[0.22, -0.18, 0]}
                  material={goldTrimMat}
                >
                  <sphereGeometry args={[0.085, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                </mesh>
                <mesh
                  position={[0.21, 0.015, 0.61]}
                  scale={[1.15, 0.55, 0.5]}
                  rotation={[0.22, 0.18, 0]}
                  material={goldTrimMat}
                >
                  <sphereGeometry args={[0.085, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                </mesh>
                {/* Gentle Downward-Gazing Eye Line */}
                <mesh
                  position={[-0.21, -0.005, 0.635]}
                  rotation={[Math.PI * 0.96, -0.2, 0.04]}
                  material={buddhaFeatureMat}
                >
                  <torusGeometry args={[0.088, 0.011, 8, 16, Math.PI * 0.78]} />
                </mesh>
                <mesh
                  position={[0.21, -0.005, 0.635]}
                  rotation={[Math.PI * 0.96, 0.2, -0.04]}
                  material={buddhaFeatureMat}
                >
                  <torusGeometry args={[0.088, 0.011, 8, 16, Math.PI * 0.78]} />
                </mesh>

                {/* Refined Straight Nose Bridge & Soft Tip */}
                <mesh
                  position={[0, -0.05, 0.64]}
                  rotation={[-0.2, 0, 0]}
                  scale={[0.72, 1.0, 0.85]}
                  material={goldStatueMat}
                >
                  <coneGeometry args={[0.078, 0.25, 16]} />
                </mesh>
                <mesh position={[0, -0.15, 0.66]} scale={[1.05, 0.75, 0.85]} material={goldStatueMat}>
                  <sphereGeometry args={[0.052, 14, 12]} />
                </mesh>

                {/* Serene Compassionate Smile & Sculpted Lips */}
                <mesh
                  position={[0, -0.255, 0.6]}
                  rotation={[Math.PI * 0.9, 0, 0]}
                  material={buddhaFeatureMat}
                >
                  <torusGeometry args={[0.105, 0.013, 10, 18, Math.PI * 0.76]} />
                </mesh>
                <mesh
                  position={[0, -0.28, 0.61]}
                  scale={[1.4, 0.48, 0.6]}
                  material={goldTrimMat}
                >
                  <sphereGeometry args={[0.068, 14, 10]} />
                </mesh>

                {/* Elongated Pendulous Earlobes of Wisdom (Tai Dài Phúc Tướng) */}
                {[-1, 1].map((side) => (
                  <group key={`ear-${side}`} position={[side * 0.64, -0.06, -0.02]}>
                    <mesh scale={[0.22, 0.56, 0.28]} material={goldStatueMat}>
                      <sphereGeometry args={[0.56, 18, 14]} />
                    </mesh>
                    <mesh position={[0, -0.34, 0.02]} scale={[0.24, 0.36, 0.24]} material={goldStatueMat}>
                      <sphereGeometry args={[0.38, 14, 12]} />
                    </mesh>
                  </group>
                ))}

                {/* Cranial Hair Base, Ushnisha (Nhục Kế) & 3D Spiral Hair Curls (Tóc Xoắn Ốc) */}
                <mesh position={[0, 0.36, -0.03]} scale={[0.95, 0.72, 0.96]} material={buddhaHairMat}>
                  <sphereGeometry args={[0.67, 28, 20]} />
                </mesh>
                <mesh position={[0, 0.82, -0.02]} scale={[1.0, 0.88, 1.0]} material={buddhaHairMat}>
                  <sphereGeometry args={[0.29, 22, 18]} />
                </mesh>
                {hairCurlPositions.map(([hx, hy, hz], cIdx) => (
                  <mesh key={`curl-${cIdx}`} position={[hx, hy, hz]} material={goldTrimMat}>
                    <sphereGeometry args={[0.056, 8, 8]} />
                  </mesh>
                ))}

                {/* Ushnisha Flame Pearl (Châu Nhục Kế) & Forehead Urna (Bạch Hào Quang) */}
                <mesh position={[0, 0.66, 0.22]}>
                  <sphereGeometry args={[0.072, 16, 16]} />
                  <meshBasicMaterial color="#fff7cc" />
                </mesh>
                <mesh position={[0, 1.05, 0.0]}>
                  <sphereGeometry args={[0.088, 16, 16]} />
                  <meshBasicMaterial color="#fff9d9" />
                </mesh>
                <mesh position={[0, 0.21, 0.635]}>
                  <sphereGeometry args={[0.05, 16, 16]} />
                  <meshBasicMaterial color="#fffce6" />
                </mesh>
              </group>
            </group>
          )}

          {/* 3. Ornate Bodhi-Leaf Mandorla & Concentric Golden Filigree Halo (Hào Quang Bồ Đề)
                 Calibrated so Halo apex = world Y 12.49 (100% inside 9:16 frame, never cropped!) */}
          <group position={[0, 2.52, -0.78]}>
            {/* Soft Golden Sanctuary Bloom Sprite */}
            <mesh ref={auraDiscRef} position={[0, 0.18, -0.22]}>
              <planeGeometry args={[6.4, 6.4]} />
              <meshBasicMaterial
                map={haloGlowTex}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            {/* Focused Head Crown Glow */}
            <mesh ref={crownGlowRef} position={[0, 0.68, -0.14]}>
              <planeGeometry args={[3.6, 3.6]} />
              <meshBasicMaterial
                map={haloGlowTex}
                transparent
                opacity={0.85}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            {/* Sculpted Bodhi-Leaf Full-Body Mandorla (Thân Quang Lá Bồ Đề) */}
            <mesh
              position={[0, -0.14, -0.1]}
              geometry={sculptedGeos.bodhiMandorlaRim}
              material={goldTrimMat}
            />

            {/* Outer Rotating Filigree Head Halo */}
            <group ref={haloRef} position={[0, 0.56, 0]}>
              <mesh material={goldStatueMat}>
                <torusGeometry args={[1.68, 0.056, 14, 64]} />
              </mesh>
              <mesh>
                <ringGeometry args={[1.72, 1.86, 56]} />
                <meshBasicMaterial
                  color="#ffe88f"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.78}
                />
              </mesh>
              {Array.from({ length: 24 }, (_, idx) => {
                const a = (idx / 24) * Math.PI * 2;
                return (
                  <mesh
                    key={`ray-${idx}`}
                    position={[Math.cos(a) * 1.48, Math.sin(a) * 1.48, 0]}
                    rotation={[0, 0, a - Math.PI / 2]}
                    material={idx % 2 === 0 ? goldStatueMat : lotusPetalMat}
                  >
                    <coneGeometry args={[0.072, 0.44, 5]} />
                  </mesh>
                );
              })}
            </group>

            {/* Inner Counter-Rotating Lotus Halo */}
            <group ref={haloInnerRef} position={[0, 0.56, 0.04]}>
              <mesh material={goldTrimMat}>
                <torusGeometry args={[1.18, 0.042, 12, 48]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* Dedicated Warm Golden Key, Rim & Lotus Pedestal Uplights */}
        <pointLight
          ref={auraLightRef}
          position={[0, 3.55, 2.75]}
          color="#ffe08c"
          intensity={15.8}
          distance={28}
          decay={1.4}
        />
        <pointLight
          ref={rimLightRef}
          position={[0, 3.85, -1.35]}
          color="#ffc65c"
          intensity={8.8}
          distance={18}
          decay={1.6}
        />
        <pointLight
          position={[0, 0.72, 2.3]}
          color="#ffcf70"
          intensity={5.4}
          distance={12}
          decay={1.7}
        />
      </group>

      {/* ====================================================================
          ELEVATED GRACEFUL WOODEN OFFERING ALTAR TABLE (Bàn Thờ Hương Án — base y = 1.58, top y = 2.62)
          Positioned atop Tier 2 terrace strictly below the Lotus Pedestal (y = 3.88)!
         ==================================================================== */}
      <group position={[0, 1.58, 1.95]}>
        <mesh position={[0, 1.04, 0]} material={darkWoodMat} castShadow receiveShadow>
          <boxGeometry args={[5.9, 0.15, 1.36]} />
        </mesh>
        <mesh position={[0, 0.82, 0.62]} material={goldTrimMat}>
          <boxGeometry args={[5.5, 0.3, 0.07]} />
        </mesh>
        {[
          [-2.7, -0.52],
          [2.7, -0.52],
          [-2.7, 0.52],
          [2.7, 0.52],
        ].map(([lx, lz], idx) => (
          <mesh key={`leg-${idx}`} position={[lx, 0.5, lz]} material={darkWoodMat}>
            <cylinderGeometry args={[0.095, 0.08, 1.0, 12]} />
          </mesh>
        ))}

        {/* Warm Ceremony Offering Spotlight over Altar Table */}
        <pointLight
          ref={ceremonySpotLightRef}
          position={[0, 2.45, 0.4]}
          color="#ffd885"
          intensity={2.4}
          distance={8}
          decay={1.8}
        />

        {/* Central Brass Incense Burner (Lư Hương Đồng) */}
        <group position={[0, 1.12, 0.14]}>
          <mesh position={[0, 0.2, 0]} material={bronzeMat}>
            <cylinderGeometry args={[0.3, 0.22, 0.35, 20]} />
          </mesh>
          <mesh position={[0, 0.38, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.29, 0.034, 10, 24]} />
          </mesh>
          {[-0.08, -0.03, 0.02, 0.07, 0.11].map((ix, i) => (
            <group
              key={`incense-${i}`}
              position={[ix - 0.02, 0.48, 0]}
              rotation={[0, 0, (i - 2) * 0.06]}
            >
              <mesh>
                <cylinderGeometry args={[0.011, 0.011, 0.38, 6]} />
                <meshBasicMaterial color="#9e2a2b" />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <sphereGeometry args={[0.022, 8, 8]} />
                <meshBasicMaterial color="#ff7326" />
              </mesh>
            </group>
          ))}
        </group>

        {/* Sacred Golden Reliquary Pagoda (Bảo Tháp Công Đức) on altar */}
        <group ref={pagodaAltarGroupRef} position={[0, 1.14, -0.34]}>
          <mesh position={[0, 0.07, 0]} material={crimsonLacquerMat}>
            <cylinderGeometry args={[0.2, 0.24, 0.13, 8]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} material={goldStatueMat}>
            <cylinderGeometry args={[0.16, 0.21, 0.15, 8]} />
          </mesh>
          <mesh position={[0, 0.36, 0]} material={goldStatueMat}>
            <cylinderGeometry args={[0.12, 0.17, 0.14, 8]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} material={goldStatueMat}>
            <cylinderGeometry args={[0.09, 0.13, 0.12, 8]} />
          </mesh>
          <mesh position={[0, 0.65, 0]}>
            <coneGeometry args={[0.044, 0.22, 8]} />
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
            position={[0, 1.72 + idx * 0.3, 0.14]}
          >
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshBasicMaterial color="#efe6d5" transparent opacity={0.14} depthWrite={false} />
          </mesh>
        ))}

        {/* Twin Brass Candlesticks */}
        {[-1.32, 1.32].map((cx, idx) => (
          <group key={`candle-${idx}`} position={[cx, 1.12, 0.14]}>
            <mesh position={[0, 0.16, 0]} material={bronzeMat}>
              <cylinderGeometry args={[0.07, 0.15, 0.32, 14]} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <cylinderGeometry args={[0.048, 0.048, 0.25, 12]} />
              <meshStandardMaterial color="#b81d24" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.6, 0]}>
              <coneGeometry args={[0.046, 0.15, 10]} />
              <meshBasicMaterial color="#ffe282" />
            </mesh>
            <pointLight
              ref={idx === 0 ? candleLeftRef : candleRightRef}
              position={[0, 0.68, 0]}
              color="#ffb14d"
              intensity={2.6}
              distance={7.5}
              decay={2}
            />
          </group>
        ))}

        {/* Twin Glowing Đài Sen Offering Stands (Cầu Tài Lộc — x = ±1.96) */}
        {[-1.96, 1.96].map((sx, idx) => (
          <group
            key={`lotus-stand-${idx}`}
            ref={idx === 0 ? lotusStandLeftRef : lotusStandRightRef}
            position={[sx, 1.14, 0.16]}
          >
            <mesh position={[0, 0.07, 0]} material={goldTrimMat}>
              <cylinderGeometry args={[0.13, 0.18, 0.13, 12]} />
            </mesh>
            <mesh position={[0, 0.18, 0]} material={lotusPetalMat}>
              <cylinderGeometry args={[0.23, 0.13, 0.13, 10]} />
            </mesh>
            <mesh position={[0, 0.28, 0]}>
              <sphereGeometry args={[0.085, 12, 12]} />
              <meshBasicMaterial color="#fff3b0" />
            </mesh>
          </group>
        ))}

        {/* Twin Porcelain Flower Vases (Hoa Hồng / Hoa Sen — x = ±2.48) */}
        {[-2.48, 2.48].map((vx, idx) => (
          <group key={`vase-${idx}`} position={[vx, 1.12, -0.06]}>
            <mesh position={[0, 0.24, 0]}>
              <cylinderGeometry args={[0.12, 0.18, 0.48, 16]} />
              <meshStandardMaterial color="#dfd6c3" roughness={0.25} metalness={0.1} />
            </mesh>
            {[
              [0, 0.64, 0],
              [-0.12, 0.58, 0.06],
              [0.12, 0.58, -0.05],
            ].map(([bx, by, bz], bi) => (
              <group key={`bud-${bi}`} position={[bx, by, bz]}>
                <mesh position={[0, -0.12, 0]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.26, 6]} />
                  <meshStandardMaterial color="#3c6e47" roughness={0.6} />
                </mesh>
                <mesh material={bi === 0 ? goldStatueMat : lotusPetalMat}>
                  <coneGeometry args={[0.092, 0.22, 8]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}

        {/* Decorated Five-Fruit Offering Trays (Mâm Ngũ Quả — x = ±0.74) */}
        {[-0.74, 0.74].map((fx, idx) => (
          <group key={`fruit-${idx}`} position={[fx, 1.12, 0.22]}>
            <mesh position={[0, 0.055, 0]} material={goldTrimMat}>
              <cylinderGeometry args={[0.27, 0.15, 0.11, 16]} />
            </mesh>
            <mesh position={[-0.075, 0.15, 0.04]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#e07a24" roughness={0.38} />
            </mesh>
            <mesh position={[0.085, 0.15, -0.03]}>
              <sphereGeometry args={[0.075, 12, 12]} />
              <meshStandardMaterial color="#7cb518" roughness={0.44} />
            </mesh>
            <mesh position={[0, 0.21, 0]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#f3c623" roughness={0.34} />
            </mesh>
            <mesh position={[0, 0.15, -0.085]}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshStandardMaterial color="#d62839" roughness={0.38} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ====================================================================
          CENTER GOLDEN CEREMONIAL MANDALA CUSHION (Đài Cúng Dường Bảo Tháp)
         ==================================================================== */}
      <group position={[0, 0.02, 4.24]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={goldTrimMat}>
          <ringGeometry args={[0.54, 0.7, 32]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={crimsonLacquerMat}>
          <cylinderGeometry args={[0.52, 0.58, 0.05, 24]} />
        </mesh>
      </group>

      {/* ====================================================================
          TWIN SACRED LOTUS LANTERN BASINS (Liên Hoa Thủy Trì — x = ±2.52)
         ==================================================================== */}
      {[-2.52, 2.52].map((bx, bIdx) => (
        <group key={`lantern-basin-${bIdx}`} position={[bx, 0, 3.48]}>
          <mesh position={[0, 0.22, 0]} material={darkWoodMat}>
            <cylinderGeometry args={[0.88, 0.8, 0.44, 16]} />
          </mesh>
          <mesh position={[0, 0.44, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.84, 0.048, 10, 24]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} material={jadeWaterMat}>
            <cylinderGeometry args={[0.8, 0.8, 0.04, 24]} />
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
          INTERACTIVE BRONZE TEMPLE BELL STAND (Chuông Đồng — x = 3.82, inside 9:16 frame!)
         ==================================================================== */}
      <group position={[3.82, 0.15, 2.85]}>
        <mesh position={[-0.64, 1.48, 0]} material={darkWoodMat}>
          <cylinderGeometry args={[0.085, 0.105, 2.96, 12]} />
        </mesh>
        <mesh position={[0.64, 1.48, 0]} material={darkWoodMat}>
          <cylinderGeometry args={[0.085, 0.105, 2.96, 12]} />
        </mesh>
        <mesh position={[0, 2.92, 0]} rotation={[0, 0, Math.PI / 2]} material={darkWoodMat}>
          <cylinderGeometry args={[0.105, 0.105, 1.68, 12]} />
        </mesh>
        <mesh position={[0, 3.08, 0]} material={goldTrimMat}>
          <boxGeometry args={[1.74, 0.15, 0.22]} />
        </mesh>

        <group ref={bellSwingGroupRef} position={[0, 2.82, 0]}>
          <mesh position={[0, -0.2, 0]} material={goldTrimMat}>
            <cylinderGeometry args={[0.055, 0.055, 0.38, 8]} />
          </mesh>
          <mesh position={[0, -0.88, 0]} material={bronzeMat} castShadow>
            <cylinderGeometry args={[0.36, 0.55, 1.2, 24]} />
          </mesh>
          <mesh position={[0, -1.42, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.53, 0.038, 10, 24]} />
          </mesh>
        </group>

        <group ref={bellStrikerRef} position={[-0.64, 1.88, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={crimsonLacquerMat}>
            <cylinderGeometry args={[0.06, 0.06, 0.68, 10]} />
          </mesh>
          <mesh position={[0.34, 0, 0]} material={goldTrimMat}>
            <sphereGeometry args={[0.07, 10, 10]} />
          </mesh>
        </group>

        <mesh
          ref={bellWaveRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.05, 0]}
          visible={false}
        >
          <ringGeometry args={[0.52, 0.68, 32]} />
          <meshBasicMaterial
            color="#ffe07d"
            transparent
            opacity={0.68}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ====================================================================
          SEPARATE 3D XIN XĂM RITUAL STATION (Bàn Xin Xăm Cầu Nguyện — Left Sanctuary x = -3.82)
          Symmetrical counterpart to the Bronze Bell Stand; characters kneel at (-3.28, -8.92)
          without ever walking into the elevated Buddha statue!
         ==================================================================== */}
      <group position={[-3.82, 0, 3.12]}>
        {/* Crimson & Gold Kneeling Cushion for Xin Xăm Worshipper (at world x = -3.28, z = -8.92) */}
        <group position={[0.54, 0.02, 0.36]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={goldTrimMat}>
            <ringGeometry args={[0.36, 0.46, 24]} />
          </mesh>
          <mesh position={[0, 0.022, 0]} material={crimsonLacquerMat} receiveShadow>
            <cylinderGeometry args={[0.35, 0.39, 0.045, 20]} />
          </mesh>
        </group>

        {/* Carved Rosewood & Gold Fortune Stand (Án Đặt Ống Xăm Tre) */}
        <mesh position={[0, 0.44, 0]} material={darkWoodMat} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.48, 0.88, 16]} />
        </mesh>
        <mesh position={[0, 0.9, 0]} material={crimsonLacquerMat} receiveShadow>
          <cylinderGeometry args={[0.52, 0.44, 0.08, 20]} />
        </mesh>
        <mesh position={[0, 0.94, 0]} material={goldTrimMat}>
          <torusGeometry args={[0.5, 0.032, 10, 24]} />
        </mesh>

        {/* Resting Traditional Bamboo Fortune-Stick Container (Ống Xăm Tre Truyền Thống) */}
        <group ref={xinXamTubeGroupRef} position={[0, 0.96, 0]}>
          <mesh position={[0, 0.18, 0]} material={bambooTubeMat} castShadow>
            <cylinderGeometry args={[0.145, 0.135, 0.36, 18]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.142, 0.014, 8, 20]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={goldTrimMat}>
            <torusGeometry args={[0.148, 0.015, 8, 20]} />
          </mesh>
          {/* Bundle of Carved Bamboo Fortune Sticks inside the Tube */}
          {Array.from({ length: 14 }, (_, sIdx) => {
            const ang = (sIdx / 14) * Math.PI * 2;
            const rad = sIdx % 3 === 0 ? 0.03 : 0.075;
            return (
              <group
                key={`altar-stick-${sIdx}`}
                position={[Math.cos(ang) * rad, 0.34, Math.sin(ang) * rad]}
                rotation={[Math.sin(ang) * 0.08, ang, Math.cos(ang) * 0.08]}
              >
                <mesh material={bambooStickMat}>
                  <boxGeometry args={[0.022, 0.24, 0.009]} />
                </mesh>
                <mesh position={[0, 0.11, 0]} material={crimsonLacquerMat}>
                  <boxGeometry args={[0.024, 0.038, 0.011]} />
                </mesh>
              </group>
            );
          })}
        </group>

        {/* Rising Radiant Golden Bamboo Fortune Stick (Thẻ Xăm Vàng Phát Sáng Khi Khai Quẻ) */}
        <group ref={xinXamGlowingStickRef} position={[0.16, 1.65, 0.12]} visible={false}>
          <mesh material={goldStatueMat}>
            <boxGeometry args={[0.065, 0.62, 0.02]} />
          </mesh>
          <mesh position={[0, 0.27, 0]} material={crimsonLacquerMat}>
            <boxGeometry args={[0.07, 0.1, 0.024]} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[0.92, 0.92]} />
            <meshBasicMaterial
              map={haloGlowTex}
              transparent
              opacity={0.92}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>

        {/* Warm Golden Illumination over the Xin Xăm Ritual Station */}
        <pointLight
          ref={xinXamSpotLightRef}
          position={[0.25, 2.25, 0.35]}
          color="#ffe184"
          intensity={1.8}
          distance={9.5}
          decay={1.7}
        />
      </group>
    </group>
  );
}
