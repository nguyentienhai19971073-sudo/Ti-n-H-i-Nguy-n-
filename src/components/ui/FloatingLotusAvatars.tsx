import { useEffect, useState } from 'react';
import { LotusCeremonyBadge } from '../../types/temple';
import { buildSacredAvatarDataUri } from '../../systems/DemoEventManager';

interface FloatingLotusAvatarsProps {
  badges: LotusCeremonyBadge[];
}

function LotusAvatarCard({ badge, now }: { badge: LotusCeremonyBadge; now: number }) {
  const remainingMs = badge.expiresAt - now;
  const ageMs = now - badge.startedAt;
  const isFadingOut = remainingMs < 900;
  const isEntering = ageMs < 350;

  const opacity = isFadingOut
    ? Math.max(0, remainingMs / 900)
    : isEntering
      ? Math.min(1, 0.25 + (ageMs / 350) * 0.75)
      : 1;

  const fallbackUri = buildSacredAvatarDataUri(
    badge.userId,
    badge.nickname || badge.username,
  );

  return (
    <div
      style={{ opacity }}
      className="lotus-badge-float w-[112px] sm:w-[124px] flex flex-col items-center text-center transition-opacity duration-300 select-none"
    >
      {/* Pink Lotus Blossom Frame Holding Real TikTok Profile Avatar */}
      <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
        {/* Multi-petal Pink & Gold Sacred Lotus Frame SVG */}
        <svg
          viewBox="0 0 88 88"
          className="absolute inset-0 w-full h-full drop-shadow-[0_3px_10px_rgba(244,114,182,0.45)]"
          aria-hidden="true"
        >
          {/* Warm golden outer aura ring */}
          <circle
            cx="44"
            cy="44"
            r="39"
            fill="#3a0b19"
            fillOpacity="0.65"
            stroke="#f5cd63"
            strokeWidth="1.2"
            strokeOpacity="0.7"
          />
          {/* 8 symmetrical pink lotus petals around avatar rim */}
          <g fill="#f682b4" stroke="#ffd984" strokeWidth="0.9">
            <path d="M44 3 C39 11 38 17 44 21 C50 17 49 11 44 3 Z" />
            <path d="M44 85 C39 77 38 71 44 67 C50 71 49 77 44 85 Z" />
            <path d="M3 44 C11 39 17 38 21 44 C17 50 11 49 3 44 Z" />
            <path d="M85 44 C77 39 71 38 67 44 C71 50 77 49 85 44 Z" />
            <path d="M15 15 C19 23 24 27 29 25 C27 20 23 19 15 15 Z" fill="#ff9ec7" />
            <path d="M73 15 C65 19 61 20 59 25 C64 27 69 23 73 15 Z" fill="#ff9ec7" />
            <path d="M15 73 C23 69 27 68 29 63 C24 61 19 65 15 73 Z" fill="#f0659e" />
            <path d="M73 73 C69 65 64 61 59 63 C61 68 65 69 73 73 Z" fill="#f0659e" />
          </g>
          {/* Lower cradling lotus base petals */}
          <path
            d="M22 66 C30 75 38 78 44 78 C50 78 58 75 66 66 C57 69 50 71 44 71 C38 71 31 69 22 66 Z"
            fill="#ffadd0"
            stroke="#ffe399"
            strokeWidth="0.9"
          />
          {/* Inner golden bezel around circular portrait */}
          <circle cx="44" cy="44" r="24.5" fill="#23070e" stroke="#ffd978" strokeWidth="2" />
        </svg>

        {/* Circular TikTok User Avatar */}
        <img
          src={badge.avatarUrl || fallbackUri}
          alt={`@${badge.username}`}
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== fallbackUri) {
              target.src = fallbackUri;
            }
          }}
          className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-[#ffe8a3]/80"
        />
      </div>

      {/* Compact Plaque: @username + Ritual Name + Golden Decorative Flourish */}
      <div className="-mt-1 w-full rounded-md bg-gradient-to-b from-[#3d0b16]/94 to-[#1b060a]/95 border border-[#e7c15a]/55 px-1.5 py-1 shadow-md">
        <p className="text-[10px] font-semibold text-[#fff3d9] truncate leading-tight">
          @{badge.username}
        </p>
        <p className="font-display text-[9.5px] font-bold tracking-wide text-[#ffd978] uppercase truncate leading-tight mt-0.5">
          {badge.ceremonyTitle}
        </p>

        {/* Short Golden Decorative Flourish Below */}
        <svg
          viewBox="0 0 96 10"
          className="w-20 h-2 mx-auto mt-0.5 text-[#f3ca62]"
          aria-hidden="true"
        >
          <path
            d="M8 5 H38 M58 5 H88"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeOpacity="0.75"
          />
          <path
            d="M48 1.5 L52 5 L48 8.5 L44 5 Z"
            fill="currentColor"
          />
          <circle cx="39" cy="5" r="1.2" fill="currentColor" />
          <circle cx="57" cy="5" r="1.2" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export function FloatingLotusAvatars({ badges }: FloatingLotusAvatarsProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (badges.length === 0) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [badges.length]);

  if (badges.length === 0) return null;

  // Strictly cap to max 2 on left flank and max 2 on right flank so the Golden Buddha
  // and central altar stay 100% open and unobstructed!
  const leftBadges = badges.filter((b) => b.side === 'left').slice(0, 2);
  const rightBadges = badges.filter((b) => b.side === 'right').slice(0, 2);

  return (
    <div
      aria-label="Phật tử đang hành lễ tại chính điện"
      className="pointer-events-none absolute inset-x-2 top-[47%] z-10 flex items-start justify-between"
    >
      {/* Left Altar Flank */}
      <div className="flex flex-col gap-2 items-start">
        {leftBadges.map((b) => (
          <LotusAvatarCard key={b.id} badge={b} now={now} />
        ))}
      </div>

      {/* Center Sanctuary Corridor Remains 100% Unobstructed */}

      {/* Right Altar Flank */}
      <div className="flex flex-col gap-2 items-end">
        {rightBadges.map((b) => (
          <LotusAvatarCard key={b.id} badge={b} now={now} />
        ))}
      </div>
    </div>
  );
}
