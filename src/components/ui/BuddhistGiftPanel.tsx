import { GiftIconType, GiftMapping } from '../../types/temple';

interface BuddhistGiftPanelProps {
  giftMappings: GiftMapping[];
  giftEventCounts: Record<string, number>;
  isDemoMode?: boolean;
  onTriggerDemoGift?: (mapping: GiftMapping) => void;
}

function OfferingSvgIcon({ type }: { type: GiftIconType }) {
  switch (type) {
    case 'rose':
      return (
        <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#3a0d16" stroke="#e5bd5a" strokeWidth="1.1" />
          {/* Stem & emerald leaves */}
          <path d="M14 16.5V23.5" stroke="#53b86a" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 20.2C11.5 19.8 10.2 18.4 10.5 17.2C12 17.3 13.3 18.4 14 20.2Z" fill="#5ec975" />
          <path d="M14 19.5C16.4 19.1 17.7 17.8 17.4 16.6C15.9 16.7 14.7 17.8 14 19.5Z" fill="#5ec975" />
          {/* Layered crimson-pink rose blossom */}
          <path
            d="M14 6.2C11.2 6.2 9 8.4 9 11.2C9 14.2 11.2 16.6 14 16.6C16.8 16.6 19 14.2 19 11.2C19 8.4 16.8 6.2 14 6.2Z"
            fill="#ef476f"
          />
          <path
            d="M14 7.6C12.1 7.6 10.7 9 10.7 10.8C10.7 12.6 12.2 14 14 14C15.8 14 17.3 12.6 17.3 10.8C17.3 9 15.9 7.6 14 7.6Z"
            fill="#ff8fab"
          />
          <circle cx="14" cy="10.7" r="1.7" fill="#ffd6e0" />
        </svg>
      );

    case 'bell':
      return (
        <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#35130b" stroke="#e5bd5a" strokeWidth="1.1" />
          {/* Hanging yoke */}
          <path d="M11.5 7.2H16.5" stroke="#f8d878" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="7.2" r="1.3" fill="#ffe799" />
          {/* Bronze temple bell body */}
          <path
            d="M10.2 10.5C10.4 8.7 11.9 7.8 14 7.8C16.1 7.8 17.6 8.7 17.8 10.5L19.4 18.8H8.6L10.2 10.5Z"
            fill="#eab949"
            stroke="#fff0b8"
            strokeWidth="0.7"
          />
          <path d="M7.8 18.8H20.2" stroke="#ffd970" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="14" cy="20.6" r="1.6" fill="#ffe28a" />
          {/* Sound waves */}
          <path d="M6.7 13.2C5.9 14.3 5.9 15.8 6.7 16.9" stroke="#f8d878" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M21.3 13.2C22.1 14.3 22.1 15.8 21.3 16.9" stroke="#f8d878" strokeWidth="1" fill="none" strokeLinecap="round" />
        </svg>
      );

    case 'fruit':
      return (
        <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#36110d" stroke="#e5bd5a" strokeWidth="1.1" />
          {/* Five-fruit arrangement */}
          <circle cx="11" cy="13.5" r="2.6" fill="#ff9f1c" />
          <circle cx="17" cy="13.6" r="2.5" fill="#70cb56" />
          <circle cx="14" cy="11.2" r="2.7" fill="#f7c948" />
          <circle cx="13.2" cy="14.7" r="2.1" fill="#e63946" />
          <path d="M14 7.8C14.8 8.3 15.2 9 14.9 9.7" stroke="#6ede8a" strokeWidth="1.2" strokeLinecap="round" />
          {/* Pedestal tray (Mâm bồng) */}
          <path d="M7.2 16.4H20.8L19.1 19.2H8.9L7.2 16.4Z" fill="#b8292f" stroke="#f5ce69" strokeWidth="0.8" />
          <path d="M11.6 19.2H16.4L17.4 21.6H10.6L11.6 19.2Z" fill="#d9a83e" />
        </svg>
      );

    case 'lotus':
      return (
        <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#3b0d1e" stroke="#e5bd5a" strokeWidth="1.1" />
          {/* Radiant golden halo */}
          <circle cx="14" cy="13" r="6.8" fill="#ffd978" fillOpacity="0.18" />
          {/* Outer & inner pink-gold lotus petals */}
          <path
            d="M14 6.6C12.1 9.6 11.2 11.9 11.2 14.1C11.2 16 12.4 17.4 14 17.9C15.6 17.4 16.8 16 16.8 14.1C16.8 11.9 15.9 9.6 14 6.6Z"
            fill="#ff8db8"
            stroke="#ffe39f"
            strokeWidth="0.6"
          />
          <path
            d="M8.2 11.4C7.9 14.1 9.1 16.5 11.8 17.6C10.6 15.9 10.2 13.8 10.6 12C9.8 11.7 9 11.5 8.2 11.4Z"
            fill="#f7659c"
          />
          <path
            d="M19.8 11.4C19 11.5 18.2 11.7 17.4 12C17.8 13.8 17.4 15.9 16.2 17.6C18.9 16.5 20.1 14.1 19.8 11.4Z"
            fill="#f7659c"
          />
          {/* Golden pedestal base */}
          <ellipse cx="14" cy="19.3" rx="5.6" ry="1.6" fill="#eab949" stroke="#fff1b8" strokeWidth="0.6" />
        </svg>
      );

    case 'pagoda':
    default:
      return (
        <svg viewBox="0 0 28 28" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#381608" stroke="#f5cd63" strokeWidth="1.2" />
          {/* Spire */}
          <path d="M14 4.8V7.8" stroke="#fff0b3" strokeWidth="1.3" strokeLinecap="round" />
          {/* Tier 3 (top) */}
          <path d="M10.2 9.6L14 7.6L17.8 9.6H10.2Z" fill="#ffd966" />
          <rect x="11.6" y="9.6" width="4.8" height="2" fill="#d99b26" />
          {/* Tier 2 (middle) */}
          <path d="M8.8 13.6L14 11.4L19.2 13.6H8.8Z" fill="#ffd966" />
          <rect x="10.6" y="13.6" width="6.8" height="2.3" fill="#c98a1e" />
          {/* Tier 1 (lower) */}
          <path d="M7.4 18.1L14 15.7L20.6 18.1H7.4Z" fill="#ffe184" />
          <rect x="9.5" y="18.1" width="9" height="2.6" fill="#b87914" />
          {/* Base plinth */}
          <rect x="7.8" y="20.7" width="12.4" height="1.6" rx="0.6" fill="#f5cd63" />
        </svg>
      );
  }
}

export function BuddhistGiftPanel({
  giftMappings,
  giftEventCounts,
  isDemoMode = false,
  onTriggerDemoGift,
}: BuddhistGiftPanelProps) {
  const activeOfferings = giftMappings.filter((m) => m.enabled);

  return (
    <aside
      aria-label="Cúng Dường Cầu An"
      className="w-[162px] sm:w-[178px] rounded-lg bg-gradient-to-b from-[#3d0b13]/95 via-[#25080d]/94 to-[#160609]/95 border border-[#d4af37]/60 shadow-[0_6px_22px_rgba(0,0,0,0.65)] overflow-hidden pointer-events-auto"
    >
      {/* Ornate Burgundy & Gold Lotus Header */}
      <div className="px-2 py-1.5 border-b border-[#d4af37]/40 bg-gradient-to-b from-[#5e111d] to-[#2e0910] text-center relative">
        <div className="flex items-center justify-center gap-1">
          <span className="text-[11px] leading-none select-none" aria-hidden="true">
            🪷
          </span>
          <h2 className="font-display text-[12px] sm:text-[12.5px] font-bold tracking-wider text-[#ffe28a] leading-none whitespace-nowrap">
            CÚNG DƯỜNG CẦU AN
          </h2>
        </div>
        {/* Subtle gold filigree divider */}
        <div className="mt-1 mx-auto w-24 h-[1px] bg-gradient-to-r from-transparent via-[#f3cf6d]/75 to-transparent" />
      </div>

      {/* Five Configurable Ceremonial Ritual Rows */}
      <div className="divide-y divide-[#d4af37]/18 px-1.5 py-1">
        {activeOfferings.map((item) => {
          const count = giftEventCounts[item.id] ?? 0;
          const interactive = Boolean(isDemoMode && onTriggerDemoGift);

          return (
            <div
              key={item.id}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              title={
                interactive
                  ? `Nhấn để thử nghi lễ: ${item.ceremonyTitle} – ${item.vietnameseLabel}`
                  : `${item.ceremonyTitle} – ${item.vietnameseLabel} (${item.referenceCoins} xu)`
              }
              onClick={interactive ? () => onTriggerDemoGift?.(item) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onTriggerDemoGift?.(item);
                      }
                    }
                  : undefined
              }
              className={`flex items-center justify-between gap-1.5 py-1 px-1 rounded transition-colors ${
                interactive ? 'hover:bg-[#5c1622]/65 cursor-pointer' : ''
              }`}
            >
              {/* Left: Sacred Offering Emblem */}
              <OfferingSvgIcon type={item.iconType} />

              {/* Center: Ceremony Wish + Editable Gift Name & Reference Coins */}
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-display text-[10.5px] font-bold tracking-wide text-[#ffe494] truncate">
                  {item.ceremonyTitle}
                </p>
                <p className="text-[9.5px] text-[#f3dfd1] truncate">
                  <span className="font-medium">{item.vietnameseLabel}</span>
                  <span className="text-[#d4af37]/75 mx-0.5">·</span>
                  <span className="font-mono-tabular text-[#f7cf68]">{item.referenceCoins} xu</span>
                </p>
              </div>

              {/* Right: Live Event Counter */}
              <div className="shrink-0 min-w-[24px] px-1.5 py-0.5 rounded bg-[#140507]/90 border border-[#d4af37]/35 text-center">
                <span className="font-mono-tabular text-[10px] font-bold text-[#ffe38e] leading-none">
                  {count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
