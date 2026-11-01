import { useEffect, useRef } from 'react';
import { LotusBurstTrigger } from '../../types/temple';

interface LotusFallingEffectProps {
  bursts: LotusBurstTrigger[];
  enabled: boolean;
  density: number;
  petalCount: number;
  leafCount: number;
}

type SpriteKind =
  | 'flower_pink'
  | 'flower_gold'
  | 'petal_pink'
  | 'petal_soft_red'
  | 'petal_gold'
  | 'leaf_gilded'
  | 'leaf_jade_gold'
  | 'glow_mote';

interface FallingLotusParticle {
  kind: SpriteKind;
  layer: 0 | 1 | 2; // 0 = far background, 1 = mid, 2 = foreground
  x: number; // normalized 0..1
  y: number; // normalized -0.18..1.12
  vy: number; // normalized vertical speed per second
  vx: number; // base drift per second
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  rotation: number;
  rotSpeed: number;
  flutterFreq: number;
  flutterPhase: number;
  sizePx: number;
  maxAlpha: number;
  ageMs: number;
  lifeMs: number;
}

const MAX_ACTIVE_PARTICLES = 210;

let cachedSprites: Record<SpriteKind, HTMLCanvasElement> | null = null;

function createOffscreenCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function drawLotusFlowerSprite(
  size: number,
  outerStops: [string, string, string],
  glowRgba: string,
): HTMLCanvasElement {
  const c = createOffscreenCanvas(size);
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  // Soft warm sacred aura
  const halo = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, size * 0.5);
  halo.addColorStop(0, glowRgba);
  halo.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Outer 8 lotus petals + inner 6 petals
  const drawRing = (count: number, len: number, wid: number, rotOffset: number) => {
    for (let i = 0; i < count; i++) {
      const angle = rotOffset + (i * Math.PI * 2) / count;
      ctx.save();
      ctx.translate(cx, cy * 1.04);
      ctx.rotate(angle);

      const grad = ctx.createLinearGradient(0, 0, 0, -len);
      grad.addColorStop(0, outerStops[0]);
      grad.addColorStop(0.62, outerStops[1]);
      grad.addColorStop(1, outerStops[2]);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-wid, -len * 0.32, -wid * 0.72, -len * 0.82, 0, -len);
      ctx.bezierCurveTo(wid * 0.72, -len * 0.82, wid, -len * 0.32, 0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 238, 178, 0.55)';
      ctx.lineWidth = Math.max(0.8, size * 0.014);
      ctx.stroke();
      ctx.restore();
    }
  };

  drawRing(8, r * 0.96, r * 0.36, 0);
  drawRing(6, r * 0.72, r * 0.3, Math.PI / 6);

  // Golden lotus seed pod heart
  const heart = ctx.createRadialGradient(cx, cy, 1, cx, cy, r * 0.26);
  heart.addColorStop(0, '#fff9db');
  heart.addColorStop(0.55, '#ffd56b');
  heart.addColorStop(1, '#c99322');
  ctx.fillStyle = heart;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

function drawLotusPetalSprite(
  size: number,
  baseColor: string,
  midColor: string,
  tipColor: string,
  glowRgba: string,
): HTMLCanvasElement {
  const c = createOffscreenCanvas(size);
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const cx = size / 2;
  const cy = size / 2;
  const h = size * 0.74;
  const w = size * 0.36;

  const aura = ctx.createRadialGradient(cx, cy, 1, cx, cy, size * 0.48);
  aura.addColorStop(0, glowRgba);
  aura.addColorStop(1, 'rgba(255, 210, 150, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy + h * 0.42);
  const grad = ctx.createLinearGradient(0, 0, 0, -h);
  grad.addColorStop(0, baseColor);
  grad.addColorStop(0.58, midColor);
  grad.addColorStop(1, tipColor);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w, -h * 0.28, -w * 0.85, -h * 0.78, 0, -h);
  ctx.bezierCurveTo(w * 0.85, -h * 0.78, w, -h * 0.28, 0, 0);
  ctx.closePath();
  ctx.fill();

  // Subtle center petal vein
  ctx.strokeStyle = 'rgba(255, 244, 214, 0.42)';
  ctx.lineWidth = Math.max(0.7, size * 0.016);
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.08);
  ctx.quadraticCurveTo(w * 0.06, -h * 0.5, 0, -h * 0.88);
  ctx.stroke();
  ctx.restore();

  return c;
}

function drawLotusLeafSprite(
  size: number,
  innerColor: string,
  outerColor: string,
  veinColor: string,
): HTMLCanvasElement {
  const c = createOffscreenCanvas(size);
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const cx = size / 2;
  const cy = size / 2;
  const rx = size * 0.38;
  const ry = size * 0.3;

  const halo = ctx.createRadialGradient(cx, cy, rx * 0.15, cx, cy, size * 0.48);
  halo.addColorStop(0, 'rgba(245, 208, 115, 0.22)');
  halo.addColorStop(1, 'rgba(245, 208, 115, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, rx);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;

  // Wavy scalloped traditional lotus leaf ("lá sen")
  ctx.beginPath();
  const waves = 12;
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const ripple = 1 + 0.055 * Math.sin(t * waves);
    // Small notch on one side like a real lotus leaf
    const notch = Math.abs(t - Math.PI * 0.5) < 0.22 ? 0.84 : 1;
    const px = Math.cos(t) * rx * ripple * notch;
    const py = Math.sin(t) * ry * ripple * notch;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = veinColor;
  ctx.lineWidth = Math.max(0.8, size * 0.018);
  ctx.stroke();

  // Radiating lotus leaf veins from golden navel
  ctx.lineWidth = Math.max(0.6, size * 0.012);
  for (let v = 0; v < 8; v++) {
    const a = (v * Math.PI * 2) / 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * rx * 0.82, Math.sin(a) * ry * 0.82);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffe599';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, size * 0.035), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return c;
}

function drawGlowMoteSprite(size: number): HTMLCanvasElement {
  const c = createOffscreenCanvas(size);
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const cx = size / 2;
  const g = ctx.createRadialGradient(cx, cx, 0.5, cx, cx, cx);
  g.addColorStop(0, 'rgba(255, 248, 214, 0.95)');
  g.addColorStop(0.4, 'rgba(255, 214, 118, 0.55)');
  g.addColorStop(1, 'rgba(255, 190, 95, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cx, cx, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function getSprites(): Record<SpriteKind, HTMLCanvasElement> {
  if (cachedSprites) return cachedSprites;
  cachedSprites = {
    flower_pink: drawLotusFlowerSprite(
      76,
      ['#fff0f6', '#ff8ab8', '#df3b79'],
      'rgba(255, 176, 208, 0.42)',
    ),
    flower_gold: drawLotusFlowerSprite(
      76,
      ['#fffbe6', '#ffd86b', '#d49a1f'],
      'rgba(255, 218, 120, 0.46)',
    ),
    petal_pink: drawLotusPetalSprite(
      52,
      '#fff1f7',
      '#ff94be',
      '#e24b87',
      'rgba(255, 174, 205, 0.34)',
    ),
    petal_soft_red: drawLotusPetalSprite(
      52,
      '#ffe5e8',
      '#f26d7d',
      '#b8283c',
      'rgba(244, 120, 134, 0.3)',
    ),
    petal_gold: drawLotusPetalSprite(
      52,
      '#fffbe3',
      '#ffdf7d',
      '#cf9624',
      'rgba(255, 220, 126, 0.38)',
    ),
    leaf_gilded: drawLotusLeafSprite(
      60,
      'rgba(222, 182, 86, 0.9)',
      'rgba(128, 92, 32, 0.84)',
      'rgba(255, 232, 162, 0.55)',
    ),
    leaf_jade_gold: drawLotusLeafSprite(
      60,
      'rgba(134, 166, 108, 0.88)',
      'rgba(66, 98, 56, 0.84)',
      'rgba(245, 214, 126, 0.58)',
    ),
    glow_mote: drawGlowMoteSprite(34),
  };
  return cachedSprites;
}

/**
 * Picks horizontal spawn X biased toward lush left & right temple curtains (0..0.36 and 0.64..1.0)
 * with lighter, delicate coverage in the center so the Golden Buddha statue always remains radiant and clear.
 */
function pickSacredSpawnX(isLargeForeground: boolean): number {
  const r = Math.random();
  if (isLargeForeground) {
    if (r < 0.44) return 0.03 + Math.random() * 0.31;
    if (r < 0.88) return 0.66 + Math.random() * 0.31;
    return 0.34 + Math.random() * 0.32;
  }
  if (r < 0.38) return 0.02 + Math.random() * 0.34;
  if (r < 0.76) return 0.64 + Math.random() * 0.34;
  return 0.36 + Math.random() * 0.28;
}

export function LotusFallingEffect({
  bursts,
  enabled,
  density,
  petalCount,
  leafCount,
}: LotusFallingEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<FallingLotusParticle[]>([]);
  const seenBurstIdsRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const startLoopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTime = performance.now();

    const renderFrame = (now: number) => {
      const dtMs = Math.min(48, Math.max(4, now - lastTime));
      lastTime = now;
      const dtSec = dtMs / 1000;

      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : canvas.clientWidth;
      const height = parent ? parent.clientHeight : canvas.clientHeight;
      if (width > 0 && height > 0) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const targetW = Math.round(width * dpr);
        const targetH = Math.round(height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = null;
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const list = particlesRef.current;
      if (list.length === 0) {
        rafRef.current = null;
        return;
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wPx = canvas.width;
      const hPx = canvas.height;
      const sprites = getSprites();

      let writeIdx = 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.ageMs += dtMs;
        if (p.ageMs >= p.lifeMs || p.y > 1.12) {
          continue;
        }

        const progress = Math.max(0, p.ageMs / p.lifeMs);
        p.y += p.vy * dtSec;
        p.x +=
          (p.vx + Math.sin(progress * Math.PI * 2 * p.swayFreq + p.swayPhase) * p.swayAmp) * dtSec;
        p.rotation += p.rotSpeed * dtSec;

        // Gentle parting & alpha softening across the upper-center Elevated Golden Buddha sanctuary
        // (cx = 0.50, cy = 0.17, rx = 0.15, ry = 0.135) so the raised Buddha statue is never blocked!
        const dxB = (p.x - 0.5) / 0.15;
        const dyB = (p.y - 0.17) / 0.135;
        const distSqBuddha = dxB * dxB + dyB * dyB;
        let buddhaAttenuation = 1;
        if (distSqBuddha < 1) {
          const pushDir = p.x < 0.5 ? -1 : 1;
          p.x += pushDir * 0.048 * dtSec * (1 - distSqBuddha);
          buddhaAttenuation = 0.26 + 0.74 * distSqBuddha;
        }

        // Smooth fade-in and sacred fade-out
        let envelope = 1;
        if (p.ageMs < 0) {
          list[writeIdx++] = p;
          continue;
        }
        if (progress < 0.12) {
          envelope = progress / 0.12;
        } else if (progress > 0.74) {
          envelope = Math.max(0, 1 - (progress - 0.74) / 0.26);
        }

        const alpha = p.maxAlpha * envelope * buddhaAttenuation;
        if (alpha > 0.015) {
          const sprite = sprites[p.kind];
          const drawSize = p.sizePx * dpr;
          const flutterScaleX =
            p.kind === 'glow_mote'
              ? 1
              : 0.62 + 0.38 * Math.abs(Math.cos(p.ageMs * 0.0018 * p.flutterFreq + p.flutterPhase));

          ctx.save();
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.translate(p.x * wPx, p.y * hPx);
          ctx.rotate(p.rotation);
          ctx.scale(flutterScaleX, 1);
          ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          ctx.restore();
        }

        list[writeIdx++] = p;
      }

      list.length = writeIdx;
      if (list.length > 0) {
        rafRef.current = window.requestAnimationFrame(renderFrame);
      } else {
        rafRef.current = null;
      }
    };

    startLoopRef.current = () => {
      if (rafRef.current === null) {
        lastTime = performance.now();
        rafRef.current = window.requestAnimationFrame(renderFrame);
      }
    };

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      particlesRef.current = [];
      return;
    }

    let spawnedNew = false;
    const safeDensity = Math.max(0.3, Math.min(2.5, Number.isFinite(density) ? density : 1.15));
    const basePetals = Math.max(8, Math.min(120, Math.round(petalCount || 44)));
    const baseLeaves = Math.max(2, Math.min(60, Math.round(leafCount || 16)));

    for (const burst of bursts) {
      if (seenBurstIdsRef.current.has(burst.id)) continue;
      seenBurstIdsRef.current.add(burst.id);
      if (seenBurstIdsRef.current.size > 80) {
        const oldest = seenBurstIdsRef.current.values().next().value;
        if (oldest) seenBurstIdsRef.current.delete(oldest);
      }

      const majorMul = burst.isMajor ? 1.65 : 1.0;
      const totalPetals = Math.min(115, Math.round(basePetals * safeDensity * majorMul));
      const totalLeaves = Math.min(48, Math.round(baseLeaves * safeDensity * majorMul));
      const totalFlowers = Math.min(
        34,
        Math.max(6, Math.round((burst.isMajor ? 18 : 10) * safeDensity)),
      );
      const totalMotes = Math.min(36, Math.round((burst.isMajor ? 22 : 12) * safeDensity));

      const pushParticle = (p: FallingLotusParticle) => {
        if (particlesRef.current.length >= MAX_ACTIVE_PARTICLES) {
          particlesRef.current.shift();
        }
        particlesRef.current.push(p);
      };

      // 1. Sacred Blooming Lotus Flowers (Gold & Pink Lotus)
      for (let i = 0; i < totalFlowers; i++) {
        const layer: 0 | 1 | 2 = i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
        const kind: SpriteKind =
          burst.isMajor && i % 2 === 0
            ? 'flower_gold'
            : i % 3 === 0
              ? 'flower_gold'
              : 'flower_pink';
        const sizePx =
          layer === 2
            ? 24 + Math.random() * 10
            : layer === 1
              ? 18 + Math.random() * 7
              : 13 + Math.random() * 5;
        pushParticle({
          kind,
          layer,
          x: pickSacredSpawnX(layer === 2),
          y: -0.06 - Math.random() * 0.14,
          vy: 0.13 + layer * 0.035 + Math.random() * 0.05,
          vx: (Math.random() - 0.5) * 0.04,
          swayAmp: 0.035 + Math.random() * 0.045,
          swayFreq: 0.8 + Math.random() * 0.9,
          swayPhase: Math.random() * Math.PI * 2,
          rotation: (Math.random() - 0.5) * 0.5,
          rotSpeed: (Math.random() - 0.5) * 0.65,
          flutterFreq: 0.55 + Math.random() * 0.4,
          flutterPhase: Math.random() * Math.PI * 2,
          sizePx,
          maxAlpha: layer === 0 ? 0.66 : 0.92,
          ageMs: -Math.random() * (burst.isMajor ? 2100 : 1450),
          lifeMs: 4200 + Math.random() * 1700,
        });
      }

      // 2. Abundant Falling Lotus Petals (Pink Lotus, Luminous Gold, Soft Red)
      const petalKinds: SpriteKind[] = ['petal_pink', 'petal_gold', 'petal_soft_red', 'petal_pink'];
      for (let i = 0; i < totalPetals; i++) {
        const layer: 0 | 1 | 2 = (i % 3) as 0 | 1 | 2;
        const kind = petalKinds[i % petalKinds.length];
        const sizePx =
          layer === 2
            ? 16 + Math.random() * 7
            : layer === 1
              ? 12 + Math.random() * 5
              : 9 + Math.random() * 4;
        pushParticle({
          kind,
          layer,
          x: pickSacredSpawnX(false),
          y: -0.04 - Math.random() * 0.16,
          vy: 0.15 + layer * 0.04 + Math.random() * 0.065,
          vx: (Math.random() - 0.5) * 0.06,
          swayAmp: 0.055 + Math.random() * 0.065,
          swayFreq: 1.0 + Math.random() * 1.25,
          swayPhase: Math.random() * Math.PI * 2,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 1.45,
          flutterFreq: 1.1 + Math.random() * 1.1,
          flutterPhase: Math.random() * Math.PI * 2,
          sizePx,
          maxAlpha: layer === 0 ? 0.64 : layer === 1 ? 0.84 : 0.95,
          ageMs: -Math.random() * (burst.isMajor ? 2400 : 1650),
          lifeMs: 3900 + Math.random() * 1800,
        });
      }

      // 3. Sacred Lotus Leaves ("Lá Sen" — Gilded Bronze & Warm Jade-Gold)
      for (let i = 0; i < totalLeaves; i++) {
        const layer: 0 | 1 | 2 = i % 2 === 0 ? 1 : 0;
        const kind: SpriteKind = i % 2 === 0 ? 'leaf_gilded' : 'leaf_jade_gold';
        const sizePx = layer === 1 ? 18 + Math.random() * 7 : 13 + Math.random() * 5;
        pushParticle({
          kind,
          layer,
          x: pickSacredSpawnX(true),
          y: -0.06 - Math.random() * 0.14,
          vy: 0.12 + Math.random() * 0.055,
          vx: (Math.random() - 0.5) * 0.045,
          swayAmp: 0.045 + Math.random() * 0.05,
          swayFreq: 0.75 + Math.random() * 0.85,
          swayPhase: Math.random() * Math.PI * 2,
          rotation: (Math.random() - 0.5) * 0.9,
          rotSpeed: (Math.random() - 0.5) * 0.8,
          flutterFreq: 0.75 + Math.random() * 0.6,
          flutterPhase: Math.random() * Math.PI * 2,
          sizePx,
          maxAlpha: layer === 0 ? 0.62 : 0.82,
          ageMs: -Math.random() * (burst.isMajor ? 2200 : 1500),
          lifeMs: 4300 + Math.random() * 1600,
        });
      }

      // 4. Warm Golden Light Motes for Sacred Depth
      for (let i = 0; i < totalMotes; i++) {
        pushParticle({
          kind: 'glow_mote',
          layer: 0,
          x: Math.random(),
          y: -0.04 - Math.random() * 0.12,
          vy: 0.09 + Math.random() * 0.05,
          vx: (Math.random() - 0.5) * 0.03,
          swayAmp: 0.03 + Math.random() * 0.04,
          swayFreq: 0.7 + Math.random() * 0.8,
          swayPhase: Math.random() * Math.PI * 2,
          rotation: 0,
          rotSpeed: 0,
          flutterFreq: 1,
          flutterPhase: 0,
          sizePx: 8 + Math.random() * 10,
          maxAlpha: 0.72,
          ageMs: -Math.random() * 1800,
          lifeMs: 3600 + Math.random() * 1500,
        });
      }

      spawnedNew = true;
    }

    if (spawnedNew) {
      startLoopRef.current?.();
    }
  }, [bursts, enabled, density, petalCount, leafCount]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 w-full h-full"
    />
  );
}
