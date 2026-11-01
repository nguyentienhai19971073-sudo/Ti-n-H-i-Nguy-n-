import { useEffect, useMemo, useState } from 'react';
import {
  CeremonialAnnouncementItem,
  sanitizeCeremonialText,
} from '../../types/temple';
import { buildSacredAvatarDataUri } from '../../systems/DemoEventManager';
import { buildCenterCeremonialPanelStyle, clampPanelScale } from '../../systems/OverlayTheme';

interface CenterCeremonialPanelProps {
  announcement: CeremonialAnnouncementItem | null;
  panelOpacity: number;
  panelScale: number;
  showAvatarInCenterPanel: boolean;
}

/**
 * Center Ceremonial Announcement Panel
 * - Temporarily appears at the center of the screen (cleanly below the Golden Buddha statue's upper sanctuary).
 * - Uses semi-transparent dark burgundy RGBA styling with gold border and subtle lotus ornament so text stays 100% crisp.
 * - ONLY place in the entire livestream UI permitted to display the user's circular TikTok avatar (when showAvatarInCenterPanel is enabled).
 * - Never displays gift words ("tặng quà", "quà", "gift", "đã gửi quà", "sent a gift").
 */
export function CenterCeremonialPanel({
  announcement,
  panelOpacity,
  panelScale,
  showAvatarInCenterPanel,
}: CenterCeremonialPanelProps) {
  const [phase, setPhase] = useState<'enter' | 'steady' | 'exit'>('enter');
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!announcement) return;
    setImgFailed(false);
    setPhase('enter');

    const now = Date.now();
    const remainingMs = Math.max(400, announcement.expiresAt - now);
    const enterTimer = window.setTimeout(() => {
      setPhase('steady');
    }, 35);
    const exitLeadMs = Math.max(180, remainingMs - 380);
    const exitTimer = window.setTimeout(() => {
      setPhase('exit');
    }, exitLeadMs);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [announcement?.id, announcement?.expiresAt]);

  const cardStyle = useMemo(
    () => buildCenterCeremonialPanelStyle(panelOpacity, Boolean(announcement?.isMajor)),
    [panelOpacity, announcement?.isMajor],
  );

  if (!announcement) return null;

  const scale = clampPanelScale(panelScale);
  const cleanTitle = sanitizeCeremonialText(announcement.ritualTitle, 'CẦU BÌNH AN');
  const cleanSubtitle = announcement.ritualSubtitle
    ? sanitizeCeremonialText(
        announcement.ritualSubtitle,
        `Phật tử ${announcement.username} cầu bình an`,
      )
    : '';

  const fallbackAvatarUri = buildSacredAvatarDataUri(
    announcement.userId,
    announcement.nickname || announcement.username,
  );
  const resolvedAvatarSrc =
    !imgFailed && announcement.avatarUrl ? announcement.avatarUrl : fallbackAvatarUri;

  const animClasses =
    phase === 'enter'
      ? 'translate-y-2 scale-95 opacity-0'
      : phase === 'exit'
        ? '-translate-y-1.5 scale-95 opacity-0'
        : 'translate-y-0 scale-100';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 z-30 w-[82%] max-w-[252px] flex justify-center"
    >
      <div
        style={{
          ...cardStyle,
          transform: Math.abs(scale - 1) > 0.005 ? `scale(${scale})` : undefined,
          transformOrigin: 'center center',
        }}
        className={`relative w-full rounded-lg border px-2.5 py-1.5 transition-all duration-300 ease-out ${animClasses}`}
      >
        {/* Top Sacred Lotus Gold Filigree Accent */}
        <div
          aria-hidden="true"
          style={{ backgroundColor: 'rgba(38, 7, 13, 0.72)' }}
          className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 rounded border border-[#e5bd5a]/65 flex items-center gap-1 shadow-sm"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-2.5 h-2.5 text-[#ffe494] fill-current"
          >
            <path d="M12 2.5C10 6 8.2 8.7 8.2 11.4C8.2 13.6 9.8 15.4 12 16C14.2 15.4 15.8 13.6 15.8 11.4C15.8 8.7 14 6 12 2.5ZM4.8 9.4C4.4 12.3 5.7 15 8.6 16.3C7.4 14.5 7 12.2 7.4 10.1C6.5 9.8 5.7 9.6 4.8 9.4ZM19.2 9.4C18.3 9.6 17.5 9.8 16.6 10.1C17 12.2 16.6 14.5 15.4 16.3C18.3 15 19.6 12.3 19.2 9.4ZM3.6 17C6.4 19 9.2 19.8 12 19.8C14.8 19.8 17.6 19 20.4 17C17.5 17.1 14.7 17.6 12 18.4C9.3 17.6 6.5 17.1 3.6 17Z" />
          </svg>
          <span className="font-display text-[7px] tracking-[0.14em] uppercase text-[#ffe494] font-semibold leading-none py-[1px]">
            {announcement.isMajor ? 'Đại Lễ Cầu Nguyện' : 'Tâm Thành Lễ Phật'}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          {/* Circular TikTok Avatar — rendered ONLY inside Center Panels when enabled */}
          {showAvatarInCenterPanel && (
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-b from-[#ffe89e] via-[#d4af37] to-[#8f6814] shadow-[0_0_10px_rgba(245,205,99,0.35)]">
                <img
                  src={resolvedAvatarSrc}
                  alt={announcement.username}
                  onError={() => setImgFailed(true)}
                  className="w-full h-full rounded-full object-cover bg-[#24080e]"
                />
              </div>
            </div>
          )}

          {/* Ceremonial Text Hierarchy: Clear Username -> Prominent Larger ritualTitle -> Smaller ritualSubtitle */}
          <div
            className={`min-w-0 flex-1 ${
              showAvatarInCenterPanel ? 'text-left' : 'text-center'
            }`}
          >
            <p className="text-[9px] font-semibold text-[#f8e6c4] truncate leading-tight">
              @{announcement.username}
            </p>
            <p
              className={`font-display font-bold tracking-wide leading-tight truncate mt-0.5 ${
                announcement.isMajor
                  ? 'text-[13px] sm:text-[14px] text-[#ffe999]'
                  : 'text-[12px] sm:text-[13px] text-[#ffe28a]'
              }`}
            >
              {cleanTitle}
            </p>
            {cleanSubtitle && (
              <p className="text-[9px] text-[#fff6e5] leading-snug line-clamp-2 mt-0.5">
                {cleanSubtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
