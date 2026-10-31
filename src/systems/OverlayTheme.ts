import type { CSSProperties } from 'react';
import {
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  StreamOverlaySettings,
  VoiceSettings,
} from '../types/temple';

export const OVERLAY_SETTINGS_STORAGE_KEY = 'chua_online_overlay_settings_v2';
export const VOICE_SETTINGS_STORAGE_KEY = 'chua_online_voice_settings_v2';

export function clampPanelOpacity(opacity: number | undefined): number {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) {
    return DEFAULT_OVERLAY_SETTINGS.panelOpacity;
  }
  return Math.max(0.25, Math.min(0.92, Number(opacity.toFixed(2))));
}

export function clampPanelScale(scale: number | undefined): number {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) {
    return DEFAULT_OVERLAY_SETTINGS.panelScale;
  }
  return Math.max(0.75, Math.min(1.15, Number(scale.toFixed(2))));
}

/**
 * Builds an elegant Buddhist dark-burgundy RGBA background + thin gold border style.
 * IMPORTANT:
 * - Applies alpha ONLY via `rgba(...)` backgrounds — NEVER sets CSS `opacity` on the panel container,
 *   keeping Vietnamese typography 100% crisp and legible.
 * - Avoids `backdrop-filter` over WebGL to preserve smooth frame rates on MacBook M1 8GB RAM.
 */
export function buildBurgundyPanelStyle(
  panelOpacity = DEFAULT_OVERLAY_SETTINGS.panelOpacity,
  options?: {
    accentGoldBorder?: boolean;
    scale?: number;
    transformOrigin?: string;
  },
): CSSProperties {
  const alpha = clampPanelOpacity(panelOpacity);
  const topAlpha = Math.min(0.95, Number((alpha + 0.04).toFixed(2)));
  const botAlpha = Math.max(0.2, Number((alpha - 0.04).toFixed(2)));
  const borderAlpha = options?.accentGoldBorder ? 0.68 : 0.48;

  const style: CSSProperties = {
    backgroundImage: `linear-gradient(180deg, rgba(58, 10, 19, ${topAlpha}) 0%, rgba(26, 6, 10, ${botAlpha}) 100%)`,
    backgroundColor: `rgba(38, 8, 14, ${alpha})`,
    borderColor: `rgba(212, 175, 55, ${borderAlpha})`,
  };

  if (options?.scale !== undefined) {
    const s = clampPanelScale(options.scale);
    if (Math.abs(s - 1) > 0.005) {
      style.transform = `scale(${s})`;
      style.transformOrigin = options.transformOrigin || 'top left';
    }
  }

  return style;
}

export function buildBurgundyHeaderStyle(
  panelOpacity = DEFAULT_OVERLAY_SETTINGS.panelOpacity,
): CSSProperties {
  const alpha = clampPanelOpacity(panelOpacity);
  const headerTop = Math.min(0.96, Number((alpha + 0.1).toFixed(2)));
  const headerBot = Math.min(0.92, Number((alpha + 0.02).toFixed(2)));
  return {
    backgroundImage: `linear-gradient(180deg, rgba(88, 15, 28, ${headerTop}) 0%, rgba(44, 9, 15, ${headerBot}) 100%)`,
    borderColor: 'rgba(212, 175, 55, 0.34)',
  };
}

export function buildBurgundyScrollFooterStyle(
  panelOpacity = DEFAULT_OVERLAY_SETTINGS.panelOpacity,
): CSSProperties {
  const alpha = clampPanelOpacity(panelOpacity);
  const subAlpha = Math.max(0.22, Number((alpha - 0.03).toFixed(2)));
  return {
    backgroundColor: `rgba(18, 4, 7, ${subAlpha})`,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  };
}

export function buildCharacterNameLabelStyle(
  panelOpacity = DEFAULT_OVERLAY_SETTINGS.panelOpacity,
  variant: 'idle' | 'default' | 'ceremony' | 'speaking' = 'idle',
): CSSProperties {
  const base = clampPanelOpacity(panelOpacity);
  if (variant === 'speaking') {
    const a = Math.min(0.92, Number((base + 0.16).toFixed(2)));
    return {
      backgroundColor: `rgba(68, 14, 24, ${a})`,
      borderColor: 'rgba(255, 224, 130, 0.88)',
    };
  }
  if (variant === 'ceremony') {
    const a = Math.min(0.88, Number((base + 0.1).toFixed(2)));
    return {
      backgroundColor: `rgba(52, 10, 18, ${a})`,
      borderColor: 'rgba(245, 205, 99, 0.68)',
    };
  }
  return {
    backgroundColor: `rgba(34, 8, 13, ${base})`,
    borderColor: 'rgba(212, 175, 55, 0.38)',
  };
}

export function buildCommentBubbleStyle(
  panelOpacity = DEFAULT_OVERLAY_SETTINGS.panelOpacity,
  isSpeaking = false,
): CSSProperties {
  const base = clampPanelOpacity(panelOpacity);
  // Keep bubble semi-transparent (default ~0.62 when panelOpacity is 0.55) while text stays 100% crisp
  const bubbleAlpha = Math.min(0.9, Math.max(0.45, Number((base + 0.07).toFixed(2))));
  return {
    backgroundImage: `linear-gradient(180deg, rgba(56, 11, 20, ${bubbleAlpha}) 0%, rgba(28, 6, 11, ${bubbleAlpha}) 100%)`,
    backgroundColor: `rgba(40, 8, 14, ${bubbleAlpha})`,
    borderColor: isSpeaking ? 'rgba(255, 226, 138, 0.92)' : 'rgba(229, 189, 90, 0.68)',
  };
}

export function loadPersistedOverlaySettings(obsFromUrl = false): StreamOverlaySettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      ...DEFAULT_OVERLAY_SETTINGS,
      obsCleanView: obsFromUrl,
    };
  }
  try {
    const raw = window.localStorage.getItem(OVERLAY_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_OVERLAY_SETTINGS,
        obsCleanView: obsFromUrl,
      };
    }
    const parsed = JSON.parse(raw) as Partial<StreamOverlaySettings>;
    return {
      ...DEFAULT_OVERLAY_SETTINGS,
      ...parsed,
      panelScale: clampPanelScale(parsed.panelScale),
      panelOpacity: clampPanelOpacity(parsed.panelOpacity),
      obsCleanView: obsFromUrl || Boolean(parsed.obsCleanView && false),
    };
  } catch {
    return {
      ...DEFAULT_OVERLAY_SETTINGS,
      obsCleanView: obsFromUrl,
    };
  }
}

export function savePersistedOverlaySettings(settings: StreamOverlaySettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const toSave: Partial<StreamOverlaySettings> = {
      ...settings,
      obsCleanView: false,
      panelScale: clampPanelScale(settings.panelScale),
      panelOpacity: clampPanelOpacity(settings.panelOpacity),
    };
    window.localStorage.setItem(OVERLAY_SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPersistedVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      ...DEFAULT_VOICE_SETTINGS,
      ...parsed,
      commentTemplates: {
        ...DEFAULT_VOICE_SETTINGS.commentTemplates,
        ...(parsed.commentTemplates || {}),
      },
    };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function savePersistedVoiceSettings(settings: VoiceSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
