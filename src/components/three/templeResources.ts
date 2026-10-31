import * as THREE from 'three';

let cachedIsSoftwareGl: boolean | null = null;

export function detectSoftwareGl(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    window.isSoftwareGl = cachedIsSoftwareGl;
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = false;
    return false;
  }
}

export function createKneelingMatTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Outer golden-brown brocade border
  ctx.fillStyle = '#5c3314';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#d8a63a';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 236, 236);

  ctx.strokeStyle = '#8b4e1e';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, 212, 212);

  // Warm woven amber-brown center cushion
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 115);
  grad.addColorStop(0, '#b57b3c');
  grad.addColorStop(0.7, '#945d27');
  grad.addColorStop(1, '#704218');
  ctx.fillStyle = grad;
  ctx.fillRect(26, 26, 204, 204);

  // Subtle woven tatami horizontal lines
  ctx.fillStyle = 'rgba(255, 222, 160, 0.08)';
  for (let y = 30; y < 226; y += 6) {
    ctx.fillRect(28, y, 200, 2);
  }

  // Subtle lotus corner motifs in gold
  ctx.strokeStyle = 'rgba(238, 194, 88, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(128, 128, 44, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createRedCarpetTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep crimson ceremonial carpet
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#6e0d12');
  grad.addColorStop(0.12, '#8e141b');
  grad.addColorStop(0.5, '#a11921');
  grad.addColorStop(0.88, '#8e141b');
  grad.addColorStop(1, '#6e0d12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Gold brocade borders along left and right edges
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(8, 0, 10, 512);
  ctx.fillRect(238, 0, 10, 512);

  ctx.fillStyle = '#f3d26b';
  ctx.fillRect(24, 0, 3, 512);
  ctx.fillRect(229, 0, 3, 512);

  // Subtle traditional geometric medallions repeating vertically
  ctx.strokeStyle = 'rgba(226, 182, 74, 0.16)';
  ctx.lineWidth = 2;
  for (let y = 32; y < 512; y += 64) {
    ctx.beginPath();
    ctx.arc(128, y, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 10);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTempleFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#24150e';
  ctx.fillRect(0, 0, 256, 256);

  // Warm dark terracotta-wood tile grid
  ctx.strokeStyle = '#160c07';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 124);
  ctx.strokeRect(130, 2, 124, 124);
  ctx.strokeRect(2, 130, 124, 124);
  ctx.strokeRect(130, 130, 124, 124);

  ctx.fillStyle = 'rgba(255, 195, 110, 0.03)';
  ctx.fillRect(8, 8, 112, 112);
  ctx.fillRect(136, 136, 112, 112);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 22);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createBannerTexture(lines: string[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#680d11';
  ctx.fillRect(0, 0, 128, 512);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 116, 500);

  ctx.fillStyle = '#f8dc81';
  ctx.font = 'bold 28px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const step = 440 / Math.max(1, lines.length);
  lines.forEach((word, idx) => {
    ctx.fillText(word, 64, 48 + idx * step);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createRadialGlowTexture(innerHex: string, outerRgba: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, innerHex);
  grad.addColorStop(0.45, outerRgba);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Shared live world position registry so UI speech bubbles & gift effects follow walking characters
export interface LiveCharacterTransform {
  x: number;
  y: number;
  z: number;
  headY: number;
}

export const liveCharacterPositions = new Map<string, LiveCharacterTransform>();
