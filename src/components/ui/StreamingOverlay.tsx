import { useMemo } from 'react';
import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import {
  CeremonialAnnouncementItem,
  ConnectionStatus,
  FeedNotification,
  GiftMapping,
  LotusBurstTrigger,
  LotusCeremonyBadge,
  MeritLedgerEntry,
  ServerConnectionSnapshot,
  StreamOverlaySettings,
  XinXamDrawResult,
  XinXamSettings,
  sanitizeCeremonialText,
} from '../../types/temple';
import { VoiceStateSnapshot } from '../../systems/VoiceManager';
import { buildBurgundyPanelStyle } from '../../systems/OverlayTheme';
import { Leaderboard } from './Leaderboard';
import { BuddhistGiftPanel } from './BuddhistGiftPanel';
import { FloatingLotusAvatars } from './FloatingLotusAvatars';
import { LotusFallingEffect } from './LotusFallingEffect';
import { CenterCeremonialPanel } from './CenterCeremonialPanel';
import { XinXamResultPanel } from './XinXamResultPanel';

interface StreamingOverlayProps {
  participantsCount: number;
  waitingCount: number;
  activeAltarCount: number;
  queuedAltarCount: number;
  totalLikesCount: number;
  totalWoodenFishCount: number;
  leaderboard: MeritLedgerEntry[];
  notifications?: FeedNotification[];
  giftMappings: GiftMapping[];
  xinXamSettings?: XinXamSettings;
  giftEventCounts: Record<string, number>;
  activeLotusBadges: LotusCeremonyBadge[];
  activeCenterAnnouncement?: CeremonialAnnouncementItem | null;
  activeXinXamResult?: XinXamDrawResult | null;
  xinXamPanelOpacity?: number;
  xinXamPanelScale?: number;
  xinXamParticleDensity?: number;
  activeLotusBursts?: LotusBurstTrigger[];
  prominentGiftBanner?: {
    id: string;
    username: string;
    giftName: string;
    points: number;
    isDemo: boolean;
    expiresAt: number;
  } | null;
  connectionSnapshot: ServerConnectionSnapshot;
  voiceSnapshot: VoiceStateSnapshot;
  overlaySettings: StreamOverlaySettings;
  onEnableAudio: () => void;
  onToggleObsCleanView: () => void;
  onTriggerDemoGift?: (mapping: GiftMapping) => void;
  onTriggerDemoXinXam?: () => void;
}

export function StreamingOverlay({
  participantsCount,
  waitingCount,
  activeAltarCount,
  queuedAltarCount,
  totalLikesCount,
  totalWoodenFishCount,
  leaderboard,
  notifications = [],
  giftMappings,
  xinXamSettings,
  giftEventCounts,
  activeLotusBadges,
  activeCenterAnnouncement = null,
  activeXinXamResult = null,
  xinXamPanelOpacity,
  xinXamPanelScale,
  xinXamParticleDensity,
  activeLotusBursts = [],
  connectionSnapshot,
  voiceSnapshot,
  overlaySettings,
  onEnableAudio,
  onToggleObsCleanView,
  onTriggerDemoGift,
  onTriggerDemoXinXam,
}: StreamingOverlayProps) {
  const isLive = connectionSnapshot.status === ConnectionStatus.LIVE;
  const panelOpacity = overlaySettings.panelOpacity ?? 0.45;
  const panelScale = overlaySettings.panelScale ?? 0.86;
  const effectiveLotusDensity =
    activeXinXamResult && xinXamParticleDensity
      ? xinXamParticleDensity
      : (overlaySettings.lotusParticleDensity ?? 1.15);

  const topPlaqueStyle = useMemo(
    () => buildBurgundyPanelStyle(panelOpacity),
    [panelOpacity],
  );
  const subtitleStyle = useMemo(
    () =>
      buildBurgundyPanelStyle(panelOpacity, {
        scale: panelScale,
        transformOrigin: 'bottom center',
      }),
    [panelOpacity, panelScale],
  );
  const eventToastStyle = useMemo(
    () =>
      buildBurgundyPanelStyle(panelOpacity, {
        scale: panelScale,
        transformOrigin: 'bottom left',
      }),
    [panelOpacity, panelScale],
  );
  const controlBtnStyle = useMemo(
    () => buildBurgundyPanelStyle(panelOpacity),
    [panelOpacity],
  );

  const cleanSubtitle = useMemo(
    () =>
      voiceSnapshot.currentSubtitle
        ? sanitizeCeremonialText(voiceSnapshot.currentSubtitle, voiceSnapshot.currentSubtitle)
        : '',
    [voiceSnapshot.currentSubtitle],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-1 sm:p-1.5">
      {/* ==========================================================================
          LAYERED SACRED LOTUS FLOWERS, PETALS & LEAVES SHOWER
          Attenuates over the elevated upper-center Golden Buddha sanctuary so Buddha stays clear
         ========================================================================== */}
      <LotusFallingEffect
        bursts={activeLotusBursts}
        enabled={overlaySettings.effectsEnabled}
        density={effectiveLotusDensity}
        petalCount={overlaySettings.petalCount ?? 44}
        leafCount={overlaySettings.leafCount ?? 16}
      />

      {/* ==========================================================================
          COMPACT LOWER-MIDDLE XIN XĂM RESULT POPUP ("🪷 KẾT QUẢ XIN XĂM")
         ========================================================================== */}
      <XinXamResultPanel
        result={overlaySettings.showXinXamPanel !== false ? activeXinXamResult : null}
        panelOpacity={xinXamPanelOpacity ?? xinXamSettings?.panelOpacity ?? 0.55}
        panelScale={xinXamPanelScale ?? xinXamSettings?.panelScale ?? 1.0}
        displayMode={xinXamSettings?.displayMode ?? 'compact'}
        textScale={xinXamSettings?.textScale ?? 1.0}
        showAvatar={overlaySettings.showAvatarInCenterPanel !== false}
      />

      {/* ==========================================================================
          CENTER CEREMONIAL ANNOUNCEMENT PANEL (Sequential, Non-Overlapping)
         ========================================================================== */}
      <CenterCeremonialPanel
        announcement={activeCenterAnnouncement}
        panelOpacity={panelOpacity}
        panelScale={panelScale}
        showAvatarInCenterPanel={overlaySettings.showAvatarInCenterPanel !== false}
      />

      {/* ==========================================================================
          FLOATING SACRED LOTUS CEREMONY EMBLEMS (Left & Right Outer Edges ONLY)
         ========================================================================== */}
      {overlaySettings.showLotusAvatars && (
        <FloatingLotusAvatars
          badges={activeLotusBadges}
          panelOpacity={panelOpacity}
          panelScale={panelScale}
        />
      )}

      {/* ==========================================================================
          TOP EDGE: COMPACT RGBA HEADER + PARTICIPANT COUNTER + EDGE SIDE PANELS
          Upper-Left: "BẢNG CÔNG ĐỨC" | Center: 100% Open Golden Buddha | Upper-Right: "CÚNG DƯỜNG CẦU AN"
         ========================================================================== */}
      <div className="flex flex-col gap-1 relative z-20">
        <header style={topPlaqueStyle} className="w-full rounded px-1.5 py-[3px]">
          <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5">
            <div className="flex items-center gap-1 min-w-0">
              <svg
                viewBox="0 0 24 24"
                className="w-3 h-3 text-[#ffe082] shrink-0 fill-current"
                aria-hidden="true"
              >
                <path d="M12 2.5C10 6 8.2 8.7 8.2 11.4C8.2 13.6 9.8 15.4 12 16C14.2 15.4 15.8 13.6 15.8 11.4C15.8 8.7 14 6 12 2.5ZM4.8 9.4C4.4 12.3 5.7 15 8.6 16.3C7.4 14.5 7 12.2 7.4 10.1C6.5 9.8 5.7 9.6 4.8 9.4ZM19.2 9.4C18.3 9.6 17.5 9.8 16.6 10.1C17 12.2 16.6 14.5 15.4 16.3C18.3 15 19.6 12.3 19.2 9.4ZM3.6 17C6.4 19 9.2 19.8 12 19.8C14.8 19.8 17.6 19 20.4 17C17.5 17.1 14.7 17.6 12 18.4C9.3 17.6 6.5 17.1 3.6 17Z" />
              </svg>
              <h1 className="font-display text-xs sm:text-[13px] font-bold tracking-wider text-[#ffe699] leading-none whitespace-nowrap">
                CHÙA ONLINE
              </h1>
              <span className="text-[#d4af37]/60 text-[9px]" aria-hidden="true">
                ·
              </span>
              <span className="font-display text-[9px] italic text-[#f7ead4] truncate">
                Nam Mô A Di Đà Phật
              </span>
            </div>

            {/* Compact Participant Counter & Live Status */}
            <div className="flex items-center gap-1 text-[8px] sm:text-[8.5px] text-[#f5e7cf] whitespace-nowrap">
              <span>
                <strong className="font-mono-tabular text-[#ffe699]">{participantsCount}</strong> Phật tử
              </span>
              {waitingCount > 0 && (
                <span className="font-mono-tabular text-[#dfd0b8]">(+{waitingCount})</span>
              )}
              {(activeAltarCount > 0 || queuedAltarCount > 0) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#ffe082]">
                    Lễ <strong className="font-mono-tabular">{activeAltarCount}</strong>
                    {queuedAltarCount > 0 ? `+${queuedAltarCount}` : ''}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              {isLive ? (
                <span className="text-[#9ef0b4] font-semibold">
                  LIVE @{connectionSnapshot.tiktokUsername}
                </span>
              ) : connectionSnapshot.status === ConnectionStatus.CONNECTING ? (
                <span className="text-[#f7d87c]">Kết nối...</span>
              ) : (
                <span className="text-[#e3d2b8]">Demo</span>
              )}
            </div>
          </div>

          {/* COMPACT EVENT INSTRUCTION BAR + LIKE / WOODEN DRUM COUNTERS */}
          {overlaySettings.showEventBar && (
            <div className="mt-[2px] pt-[2px] border-t border-[#d4af37]/25 flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 text-[7.8px] sm:text-[8px] leading-tight text-[#fbf0df]">
              <div className="flex flex-wrap items-center gap-x-1 min-w-0">
                <span className="font-semibold text-[#ffe48f]">❤️ Like: Gõ mõ</span>
                <span className="text-[#d4af37]/55" aria-hidden="true">
                  ·
                </span>
                <span>
                  <strong className="text-[#f9dc84]">Follow:</strong> Hương
                </span>
                <span className="text-[#d4af37]/55" aria-hidden="true">
                  ·
                </span>
                <span>
                  <strong className="text-[#f9dc84]">Share:</strong> Hoa đăng
                </span>
              </div>

              <div className="flex items-center gap-1 text-[7.8px] text-[#fff2dc] whitespace-nowrap shrink-0">
                <span>
                  ❤️{' '}
                  <strong className="font-mono-tabular text-[#ffe082]">
                    {totalLikesCount.toLocaleString('vi-VN')}
                  </strong>
                </span>
                <span className="text-[#d4af37]/45" aria-hidden="true">
                  |
                </span>
                <span>
                  🥁{' '}
                  <strong className="font-mono-tabular text-[#ffe082]">
                    {totalWoodenFishCount.toLocaleString('vi-VN')}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </header>

        {/* COMPACT EDGE SIDE PANELS: Left = BẢNG CÔNG ĐỨC | Right = CÚNG DƯỜNG CẦU AN */}
        {(overlaySettings.showLeaderboard || overlaySettings.showGiftPanel) && (
          <div className="flex items-start justify-between gap-1">
            <div>
              {overlaySettings.showLeaderboard && (
                <Leaderboard
                  leaderboard={leaderboard}
                  panelOpacity={panelOpacity}
                  panelScale={panelScale}
                />
              )}
            </div>

            <div>
              {overlaySettings.showGiftPanel && (
                <BuddhistGiftPanel
                  giftMappings={giftMappings}
                  xinXamSettings={xinXamSettings}
                  giftEventCounts={giftEventCounts}
                  isDemoMode={!isLive}
                  onTriggerDemoGift={onTriggerDemoGift}
                  onTriggerDemoXinXam={onTriggerDemoXinXam}
                  panelOpacity={panelOpacity}
                  panelScale={panelScale}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==========================================================================
          BOTTOM EDGE: Compact Event Notifications, Gift Notification & Voice Subtitles
          (Zero global comment panel; zero profile avatars!)
         ========================================================================== */}
      <div className="flex flex-col gap-1 pb-8 sm:pb-1 relative z-20">
        {/* Optional Compact Edge Event Notification Panel (Text-Only, Zero Avatars) */}
        {overlaySettings.showNotifications && notifications.length > 0 && (
          <div style={eventToastStyle} className="self-start max-w-[185px] rounded px-2 py-0.5">
            {notifications.slice(0, 1).map((n) => (
              <p key={n.id} className="text-[8px] text-[#fff5e2] truncate leading-tight">
                <strong className="text-[#ffe494]">{n.username}</strong>{' '}
                {sanitizeCeremonialText(n.message, 'thành tâm cầu an')}
                {n.pointsDelta ? (
                  <span className="font-mono-tabular text-[#ffd978] ml-1">+{n.pointsDelta}</span>
                ) : null}
              </p>
            ))}
          </div>
        )}

        {/* Compact Voice Subtitle Panel & Edge Controls */}
        <div className="flex items-end justify-between gap-1">
          <div className="flex-1 flex justify-center min-w-0">
            {cleanSubtitle ? (
              <div
                style={subtitleStyle}
                className="max-w-[92%] rounded px-2 py-[3px] text-center"
              >
                <p className="font-display text-[9.5px] sm:text-[10.5px] italic text-[#fff8e6] leading-snug line-clamp-2">
                  “{cleanSubtitle}”
                </p>
              </div>
            ) : !voiceSnapshot.audioEnabled ? (
              <button
                type="button"
                onClick={onEnableAudio}
                className="pointer-events-auto flex items-center gap-1 px-2 py-1 rounded bg-[#d4af37] hover:bg-[#e3be46] text-[#1a0f07] text-[9.5px] font-semibold shadow transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <VolumeX className="w-2.5 h-2.5 shrink-0" />
                <span>Bật Âm Thanh &amp; Giọng Việt</span>
              </button>
            ) : null}
          </div>

          <div className="pointer-events-auto flex items-center gap-1 shrink-0">
            {voiceSnapshot.audioEnabled && (
              <span
                title="Âm thanh & Giọng đọc VieNeu đã bật"
                style={controlBtnStyle}
                className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded text-[9px] text-[#ffe494]"
              >
                <Volume2 className="w-2.5 h-2.5" />
              </span>
            )}
            <button
              type="button"
              onClick={onToggleObsCleanView}
              style={controlBtnStyle}
              title={
                overlaySettings.obsCleanView
                  ? 'Thoát chế độ OBS (Hiện bảng quản trị)'
                  : 'Chế độ toàn màn hình sạch cho OBS'
              }
              className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded hover:brightness-125 text-[9px] font-medium text-[#fff4de] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {overlaySettings.obsCleanView ? (
                <>
                  <Minimize2 className="w-2.5 h-2.5 text-[#ffe494]" />
                  <span>Quản trị</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-2.5 h-2.5 text-[#ffe494]" />
                  <span>OBS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
