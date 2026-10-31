import { useMemo } from 'react';
import { GiftIconType, GiftMapping } from '../../types/temple';
import {
  buildBurgundyHeaderStyle,
  buildBurgundyPanelStyle,
} from '../../systems/OverlayTheme';

interface BuddhistGiftPanelProps {
  giftMappings: GiftMapping[];
  giftEventCounts: Record<string, number>;
  isDemoMode?: boolean;
  onTriggerDemoGift?: (mapping: GiftMapping) => void;
  panelOpacity?: number;
  panelScale?: number;
}

export function OfferingSvgIcon({
  type,
  className = 'w-3.5 h-3.5 shrink-0',
}: {
  type: GiftIconType;
  className?: string;
}) {
  switch (type) {
    case 'rose':
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#3a0d16" stroke="#e5bd5a" strokeWidth="1.1" />
          <path d="M14 16.5V23.5" stroke="#53b86a" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 20.2C11.5 19.8 10.2 18.4 10.5 17.2C12 17.3 13.3 18.4 14 20.2Z" fill="#5ec975" />
          <path d="M14 19.5C16.4 19.1 17.7 17.8 17.4 16.6C15.9 16.7 14.7 17.8 14 19.5Z" fill="#5ec975" />
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
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#35130b" stroke="#e5bd5a" strokeWidth="1.1" />
          <path d="M11.5 7.2H16.5" stroke="#f8d878" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="7.2" r="1.3" fill="#ffe799" />
          <path
            d="M10.2 10.5C10.4 8.7 11.9 7.8 14 7.8C16.1 7.8 17.6 8.7 17.8 10.5L19.4 18.8H8.6L10.2 10.5Z"
            fill="#eab949"
            stroke="#fff0b8"
            strokeWidth="0.7"
          />
          <path d="M7.8 18.8H20.2" stroke="#ffd970" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="14" cy="20.6" r="1.6" fill="#ffe28a" />
          <path d="M6.7 13.2C5.9 14.3 5.9 15.8 6.7 16.9" stroke="#f8d878" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M21.3 13.2C22.1 14.3 22.1 15.8 21.3 16.9" stroke="#f8d878" strokeWidth="1" fill="none" strokeLinecap="round" />
        </svg>
      );

    case 'fruit':
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#36110d" stroke="#e5bd5a" strokeWidth="1.1" />
          <circle cx="11" cy="13.5" r="2.6" fill="#ff9f1c" />
          <circle cx="17" cy="13.6" r="2.5" fill="#70cb56" />
          <circle cx="14" cy="11.2" r="2.7" fill="#f7c948" />
          <circle cx="13.2" cy="14.7" r="2.1" fill="#e63946" />
          <path d="M14 7.8C14.8 8.3 15.2 9 14.9 9.7" stroke="#6ede8a" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7.2 16.4H20.8L19.1 19.2H8.9L7.2 16.4Z" fill="#b8292f" stroke="#f5ce69" strokeWidth="0.8" />
          <path d="M11.6 19.2H16.4L17.4 21.6H10.6L11.6 19.2Z" fill="#d9a83e" />
        </svg>
      );

    case 'lotus':
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#3b0d1e" stroke="#e5bd5a" strokeWidth="1.1" />
          <circle cx="14" cy="13" r="6.8" fill="#ffd978" fillOpacity="0.18" />
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
          <ellipse cx="14" cy="19.3" rx="5.6" ry="1.6" fill="#eab949" stroke="#fff1b8" strokeWidth="0.6" />
        </svg>
      );

    case 'incense':
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#35120c" stroke="#e5bd5a" strokeWidth="1.1" />
          <path d="M12 8.2V16.8M14 7.4V16.8M16 8.2V16.8" stroke="#c87b3b" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="12" cy="7.8" r="1" fill="#ff7b29" />
          <circle cx="14" cy="7" r="1.1" fill="#ffb703" />
          <circle cx="16" cy="7.8" r="1" fill="#ff7b29" />
          <path d="M9.2 16.8H18.8L17.6 21H10.4L9.2 16.8Z" fill="#d9a13b" stroke="#fff0b8" strokeWidth="0.7" />
        </svg>
      );

    case 'wooden_fish':
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#33150a" stroke="#e5bd5a" strokeWidth="1.1" />
          <ellipse cx="14" cy="14.6" rx="6.2" ry="4.5" fill="#b86b2b" stroke="#ffd884" strokeWidth="0.8" />
          <path d="M9.6 14.8H16.8" stroke="#2a0f06" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="17.5" cy="14.8" r="1.1" fill="#2a0f06" />
          <ellipse cx="14" cy="19.8" rx="6.6" ry="1.3" fill="#9c2228" />
        </svg>
      );

    case 'prayer':
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#380f18" stroke="#e5bd5a" strokeWidth="1.1" />
          <circle cx="14" cy="13.5" r="6.5" fill="#ffd978" fillOpacity="0.18" />
          <path d="M13.6 7.5L10.8 16.5L13.6 19.2V7.5Z" fill="#f3c59e" />
          <path d="M14.4 7.5L17.2 16.5L14.4 19.2V7.5Z" fill="#e6b086" />
        </svg>
      );

    case 'light':
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#3a1906" stroke="#f5cd63" strokeWidth="1.2" />
          <circle cx="14" cy="14" r="5" fill="#ffe27a" />
          <path
            d="M14 5.5V8M14 20V22.5M5.5 14H8M20 14H22.5M8.2 8.2L10 10M18 18L19.8 19.8M19.8 8.2L18 10M10 18L8.2 19.8"
            stroke="#fff3b8"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'pagoda':
    default:
      return (
        <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" fill="#381608" stroke="#f5cd63" strokeWidth="1.2" />
          <path d="M14 4.8V7.8" stroke="#fff0b3" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M10.2 9.6L14 7.6L17.8 9.6H10.2Z" fill="#ffd966" />
          <rect x="11.6" y="9.6" width="4.8" height="2" fill="#d99b26" />
          <path d="M8.8 13.6L14 11.4L19.2 13.6H8.8Z" fill="#ffd966" />
          <rect x="10.6" y="13.6" width="6.8" height="2.3" fill="#c98a1e" />
          <path d="M7.4 18.1L14 15.7L20.6 18.1H7.4Z" fill="#ffe184" />
          <rect x="9.5" y="18.1" width="9" height="2.6" fill="#b87914" />
          <rect x="7.8" y="20.7" width="12.4" height="1.6" rx="0.6" fill="#f5cd63" />
        </svg>
      );
  }
}

export function GiftVisualIcon({
  gift,
  sizeClass = 'w-3.5 h-3.5',
}: {
  gift: Pick<GiftMapping, 'iconType' | 'iconUrl' | 'uploadedImageData' | 'vietnameseLabel'>;
  sizeClass?: string;
}) {
  const imgSrc = gift.uploadedImageData || gift.iconUrl;
  if (imgSrc) {
    const trimmed = imgSrc.trim();
    const isUrlOrData =
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('data:image/');
    if (isUrlOrData) {
      return (
        <img
          src={trimmed}
          alt={gift.vietnameseLabel}
          className={`${sizeClass} rounded-full object-cover border border-[#e5bd5a]/65 bg-[#290b10] shrink-0`}
        />
      );
    }
    return (
      <span
        className={`${sizeClass} inline-flex items-center justify-center rounded-full bg-[#350d15] border border-[#e5bd5a]/60 text-[9px] leading-none shrink-0 select-none`}
        aria-hidden="true"
      >
        {trimmed.slice(0, 2)}
      </span>
    );
  }
  return <OfferingSvgIcon type={gift.iconType} className={`${sizeClass} shrink-0`} />;
}

export function BuddhistGiftPanel({
  giftMappings,
  giftEventCounts,
  isDemoMode = false,
  onTriggerDemoGift,
  panelOpacity = 0.55,
  panelScale = 0.9,
}: BuddhistGiftPanelProps) {
  const activeOfferings = giftMappings.filter(
    (m) => m.enabled && m.showInOverlayPanel !== false,
  );

  const panelStyle = useMemo(
    () =>
      buildBurgundyPanelStyle(panelOpacity, {
        scale: panelScale,
        transformOrigin: 'top right',
      }),
    [panelOpacity, panelScale],
  );
  const headerStyle = useMemo(() => buildBurgundyHeaderStyle(panelOpacity), [panelOpacity]);

  return (
    <aside
      aria-label="Cúng Dường Cầu An"
      style={panelStyle}
      className="w-[108px] sm:w-[118px] rounded overflow-hidden pointer-events-auto"
    >
      {/* Compact Burgundy & Gold Lotus Header */}
      <div style={headerStyle} className="px-1 py-[2.5px] text-center">
        <div className="flex items-center justify-center gap-0.5">
          <svg
            viewBox="0 0 24 24"
            className="w-2 h-2 text-[#ffa6c9] shrink-0 fill-current"
            aria-hidden="true"
          >
            <path d="M12 3C10.2 6.2 8.5 8.8 8.5 11.4C8.5 13.5 10 15.2 12 15.8C14 15.2 15.5 13.5 15.5 11.4C15.5 8.8 13.8 6.2 12 3ZM5.2 9.5C4.8 12.2 6 14.8 8.8 16.1C7.6 14.3 7.2 12.1 7.6 10.2C6.8 9.9 6 9.7 5.2 9.5ZM18.8 9.5C18 9.7 17.2 9.9 16.4 10.2C16.8 12.1 16.4 14.3 15.2 16.1C18 14.8 19.2 12.2 18.8 9.5ZM4 16.8C6.6 18.8 9.3 19.5 12 19.5C14.7 19.5 17.4 18.8 20 16.8C17.2 16.9 14.6 17.4 12 18.2C9.4 17.4 6.8 16.9 4 16.8Z" />
          </svg>
          <h2 className="font-display text-[9px] font-bold tracking-wider text-[#ffe89e] leading-none whitespace-nowrap">
            CÚNG DƯỜNG CẦU AN
          </h2>
        </div>
      </div>

      {/* Compact Ceremonial Ritual Rows */}
      <div className="divide-y divide-[#d4af37]/15 px-1 py-[2px] max-h-[136px] overflow-y-auto temple-scroll">
        {activeOfferings.map((item) => {
          const count = giftEventCounts[item.giftId] ?? giftEventCounts[item.id] ?? 0;
          const interactive = Boolean(isDemoMode && onTriggerDemoGift);

          return (
            <div
              key={item.giftId || item.id}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              title={
                interactive
                  ? `Nhấn thử nghi lễ: ${item.ceremonyTitle} – ${item.vietnameseLabel}`
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
              className={`flex items-center justify-between gap-1 py-[2px] px-0.5 rounded transition-colors ${
                interactive ? 'hover:bg-[#5c1622]/45 cursor-pointer' : ''
              }`}
            >
              <GiftVisualIcon gift={item} sizeClass="w-3.5 h-3.5" />

              <div className="min-w-0 flex-1 leading-none">
                <p className="font-display text-[8px] font-bold tracking-wide text-[#ffe89e] truncate">
                  {item.ceremonyTitle}
                </p>
                <p className="text-[7.5px] text-[#f7ead8] truncate mt-[1px]">
                  <span className="font-medium">{item.vietnameseLabel}</span>
                  <span className="text-[#d4af37]/75 mx-0.5">·</span>
                  <span className="font-mono-tabular text-[#ffd978]">{item.referenceCoins}x</span>
                </p>
              </div>

              <div
                style={{ backgroundColor: 'rgba(18, 5, 8, 0.55)' }}
                className="shrink-0 min-w-[15px] px-1 py-[0.5px] rounded border border-[#d4af37]/35 text-center"
              >
                <span className="font-mono-tabular text-[8px] font-bold text-[#ffe699] leading-none">
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
