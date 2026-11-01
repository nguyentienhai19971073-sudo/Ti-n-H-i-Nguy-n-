import { useEffect, useMemo, useState } from 'react';
import { LotusCeremonyBadge } from '../../types/temple';
import { buildBurgundyPanelStyle } from '../../systems/OverlayTheme';

interface FloatingLotusAvatarsProps {
  badges: LotusCeremonyBadge[];
  panelOpacity?: number;
  panelScale?: number;
}

function LotusCeremonyCard({
  badge,
  now,
  plaqueStyle,
}: {
  badge: LotusCeremonyBadge;
  now: number;
  plaqueStyle: React.CSSProperties;
}) {
  const remainingMs = badge.expiresAt - now;
  const ageMs = now - badge.startedAt;
  const isFadingOut = remainingMs < 900;
  const isEntering = ageMs < 350;

  const animAlpha = isFadingOut
    ? Math.max(0, remainingMs / 900)
    : isEntering
      ? Math.min(1, 0.25 + (ageMs / 350) * 0.75)
      : 1;

  return (
    <div
      style={{ opacity: Number(animAlpha.toFixed(2)) }}
      className="lotus-badge-float w-[60px] sm:w-[66px] flex flex-col items-center text-center transition-opacity duration-300 select-none"
    >
      {/* Sacred Golden-Pink Lotus Blossom Emblem (Zero Profile Avatars!) */}
      <div className="relative w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
        <svg
          viewBox="0 0 88 88"
          className="w-full h-full drop-shadow-[0_2px_6px_rgba(244,114,182,0.38)]"
          aria-hidden="true"
        >
          <circle
            cx="44"
            cy="44"
            r="38"
            fill="rgba(54, 10, 22, 0.58)"
            stroke="#f5cd63"
            strokeWidth="1.3"
            strokeOpacity="0.78"
          />
          <g fill="#f682b4" stroke="#ffd984" strokeWidth="0.9">
            <path d="M44 5 C39 13 38 19 44 24 C50 19 49 13 44 5 Z" />
            <path d="M44 83 C39 75 38 69 44 64 C50 69 49 75 44 83 Z" />
            <path d="M5 44 C13 39 19 38 24 44 C19 50 13 49 5 44 Z" />
            <path d="M83 44 C75 39 69 38 64 44 C69 50 75 49 83 44 Z" />
            <path d="M16 16 C20 24 25 28 30 26 C28 21 24 20 16 16 Z" fill="#ff9ec7" />
            <path d="M72 16 C64 20 60 21 58 26 C63 28 68 24 72 16 Z" fill="#ff9ec7" />
            <path d="M16 72 C24 68 28 67 30 62 C25 60 20 64 16 72 Z" fill="#f0659e" />
            <path d="M72 72 C68 64 63 60 58 62 C60 67 64 68 72 72 Z" fill="#f0659e" />
          </g>
          {/* Inner Sacred Golden Lotus Core */}
          <circle cx="44" cy="44" r="18" fill="rgba(42, 9, 17, 0.72)" stroke="#ffe082" strokeWidth="1.5" />
          <path
            d="M44 30 C40.5 36 38.5 40.5 38.5 44.5 C38.5 48 41 50.8 44 51.8 C47 50.8 49.5 48 49.5 44.5 C49.5 40.5 47.5 36 44 30 Z"
            fill="#ffd978"
          />
          <path
            d="M34 40 C33.5 44.5 35.5 48.5 40 50.5 C38 47.5 37.5 44 38 41 C36.7 40.6 35.3 40.2 34 40 Z"
            fill="#ffb3d1"
          />
          <path
            d="M54 40 C52.7 40.2 51.3 40.6 50 41 C50.5 44 50 47.5 48 50.5 C52.5 48.5 54.5 44.5 54 40 Z"
            fill="#ffb3d1"
          />
        </svg>
      </div>

      {/* Compact Text-Only Plaque: Username + Ritual Title */}
      <div style={plaqueStyle} className="-mt-0.5 w-full rounded px-1 py-[2px]">
        <p className="text-[7.5px] font-semibold text-[#fff6e3] truncate leading-tight">
          {badge.username}
        </p>
        <p className="font-display text-[7px] font-bold tracking-wide text-[#ffe082] uppercase truncate leading-tight">
          {badge.ceremonyTitle}
        </p>
      </div>
    </div>
  );
}

export function FloatingLotusAvatars({
  badges,
  panelOpacity = 0.5,
  panelScale = 0.86,
}: FloatingLotusAvatarsProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (badges.length === 0) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [badges.length]);

  const plaqueStyle = useMemo(
    () => buildBurgundyPanelStyle(panelOpacity),
    [panelOpacity],
  );

  if (badges.length === 0) return null;

  const leftBadges = badges.filter((b) => b.side === 'left').slice(0, 2);
  const rightBadges = badges.filter((b) => b.side === 'right').slice(0, 2);

  return (
    <div
      aria-label="Phật tử đang hành lễ tại chính điện"
      className="pointer-events-none absolute inset-x-1 top-[54%] z-10 flex items-start justify-between"
    >
      <div
        style={{ transform: `scale(${panelScale.toFixed(3)})`, transformOrigin: 'top left' }}
        className="flex flex-col gap-1 items-start"
      >
        {leftBadges.map((b) => (
          <LotusCeremonyCard key={b.id} badge={b} now={now} plaqueStyle={plaqueStyle} />
        ))}
      </div>

      <div
        style={{ transform: `scale(${panelScale.toFixed(3)})`, transformOrigin: 'top right' }}
        className="flex flex-col gap-1 items-end"
      >
        {rightBadges.map((b) => (
          <LotusCeremonyCard key={b.id} badge={b} now={now} plaqueStyle={plaqueStyle} />
        ))}
      </div>
    </div>
  );
}
