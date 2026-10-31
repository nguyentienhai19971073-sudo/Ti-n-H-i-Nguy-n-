import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import {
  ConnectionStatus,
  FeedNotification,
  GiftMapping,
  LotusCeremonyBadge,
  Participant,
  ServerConnectionSnapshot,
  StreamOverlaySettings,
} from '../../types/temple';
import { VoiceStateSnapshot } from '../../systems/VoiceManager';
import { Leaderboard } from './Leaderboard';
import { BuddhistGiftPanel } from './BuddhistGiftPanel';
import { FloatingLotusAvatars } from './FloatingLotusAvatars';

interface StreamingOverlayProps {
  participantsCount: number;
  waitingCount: number;
  activeAltarCount: number;
  queuedAltarCount: number;
  totalLikesCount: number;
  totalWoodenFishCount: number;
  leaderboard: Participant[];
  giftMappings: GiftMapping[];
  giftEventCounts: Record<string, number>;
  activeLotusBadges: LotusCeremonyBadge[];
  notifications: FeedNotification[];
  prominentGiftBanner: {
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
}

export function StreamingOverlay({
  participantsCount,
  waitingCount,
  activeAltarCount,
  queuedAltarCount,
  totalLikesCount,
  totalWoodenFishCount,
  leaderboard,
  giftMappings,
  giftEventCounts,
  activeLotusBadges,
  notifications,
  prominentGiftBanner,
  connectionSnapshot,
  voiceSnapshot,
  overlaySettings,
  onEnableAudio,
  onToggleObsCleanView,
  onTriggerDemoGift,
}: StreamingOverlayProps) {
  const isLive = connectionSnapshot.status === ConnectionStatus.LIVE;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-2 sm:p-3">
      {/* ==========================================================================
          FLOATING PINK LOTUS AVATAR BADGES (Left & Right Altar Flanks ONLY)
          Never overlaps the Golden Buddha's face, body, halo, or central altar!
         ========================================================================== */}
      {overlaySettings.showLotusAvatars && (
        <FloatingLotusAvatars badges={activeLotusBadges} />
      )}

      {/* ==========================================================================
          TOP ZONE: SACRED TEMPLE PLAQUE + LIKE = GÕ MÕ GUIDE + SIDE CORNERS
          Upper-Left: "BẢNG CÔNG ĐỨC" | Center: 100% Open Buddha View | Upper-Right: "🪷 CÚNG DƯỜNG CẦU AN"
         ========================================================================== */}
      <div className="flex flex-col gap-1.5 relative z-20">
        {/* Refined Dark-Burgundy & Gold Temple Plaque */}
        <header className="w-full rounded-lg bg-gradient-to-b from-[#330b11]/95 via-[#1f080b]/93 to-[#130607]/92 border border-[#d4af37]/55 px-2.5 py-1.5 shadow-lg">
          {/* Sacred Title & Congregation Status Line */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-[#ffe082] shrink-0 fill-current"
                aria-hidden="true"
              >
                <path d="M12 2.5C10 6 8.2 8.7 8.2 11.4C8.2 13.6 9.8 15.4 12 16C14.2 15.4 15.8 13.6 15.8 11.4C15.8 8.7 14 6 12 2.5ZM4.8 9.4C4.4 12.3 5.7 15 8.6 16.3C7.4 14.5 7 12.2 7.4 10.1C6.5 9.8 5.7 9.6 4.8 9.4ZM19.2 9.4C18.3 9.6 17.5 9.8 16.6 10.1C17 12.2 16.6 14.5 15.4 16.3C18.3 15 19.6 12.3 19.2 9.4ZM3.6 17C6.4 19 9.2 19.8 12 19.8C14.8 19.8 17.6 19 20.4 17C17.5 17.1 14.7 17.6 12 18.4C9.3 17.6 6.5 17.1 3.6 17Z" />
              </svg>
              <h1 className="font-display text-base sm:text-lg font-bold tracking-wider text-[#ffe28a] leading-none whitespace-nowrap">
                CHÙA ONLINE
              </h1>
              <span className="text-[#d4af37]/60 text-xs" aria-hidden="true">
                ·
              </span>
              <span className="font-display text-[11px] sm:text-xs italic text-[#f5e4c6] truncate">
                Nam Mô A Di Đà Phật
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-[#ebd9be] whitespace-nowrap">
              <span>
                <strong className="font-mono-tabular text-[#ffe49e]">{participantsCount}</strong> Phật tử
              </span>
              {waitingCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-[#cbb696]">+{waitingCount} chờ</span>
                </>
              )}
              {(activeAltarCount > 0 || queuedAltarCount > 0) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#ffd978]">
                    Hành lễ: <strong className="font-mono-tabular">{activeAltarCount}</strong>
                    {queuedAltarCount > 0 ? ` (+${queuedAltarCount})` : ''}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              {isLive ? (
                <span className="text-[#98ebb0] font-semibold">
                  LIVE @{connectionSnapshot.tiktokUsername}
                </span>
              ) : connectionSnapshot.status === ConnectionStatus.CONNECTING ? (
                <span className="text-[#f6d375]">Đang kết nối...</span>
              ) : (
                <span className="text-[#d6c2a3]">Mô phỏng</span>
              )}
            </div>
          </div>

          {/* BUDDHIST EVENT GUIDE + LIVE LIKE / WOODEN DRUM COUNTERS */}
          {overlaySettings.showEventBar && (
            <div className="mt-1 pt-1 border-t border-[#d4af37]/30 space-y-1 text-[10px] leading-tight">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[#f7efe2]">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="font-semibold text-[#ffe082] tracking-wide">
                    ❤️ LIKE: GÕ MÕ
                  </span>
                  <span className="text-[#d4af37]/60" aria-hidden="true">
                    ·
                  </span>
                  <span>
                    <strong className="text-[#f8d778]">Follow:</strong> Thắp hương
                  </span>
                  <span className="text-[#d4af37]/60" aria-hidden="true">
                    ·
                  </span>
                  <span>
                    <strong className="text-[#f8d778]">Share:</strong> Hoa đăng
                  </span>
                </div>

                {/* Live Total Likes & Total Wooden Fish Strikes Counters */}
                <div className="flex items-center gap-2 text-[9.5px] sm:text-[10px] text-[#fbead1] whitespace-nowrap">
                  <span>
                    ❤️ Tổng lượt thích:{' '}
                    <strong className="font-mono-tabular text-[#ffd978]">
                      {totalLikesCount.toLocaleString('vi-VN')}
                    </strong>
                  </span>
                  <span className="text-[#d4af37]/50" aria-hidden="true">
                    |
                  </span>
                  <span>
                    🥁 Tổng lượt gõ mõ:{' '}
                    <strong className="font-mono-tabular text-[#ffd978]">
                      {totalWoodenFishCount.toLocaleString('vi-VN')}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="text-center text-[9.5px] text-[#e4d3b5] truncate">
                <strong className="text-[#f6d375] font-semibold">Bình luận cầu nguyện:</strong>{' '}
                bình an · sức khỏe · tài lộc · tình duyên · học hành · gia đạo
              </div>
            </div>
          )}
        </header>

        {/* UPPER SIDE PANELS: Left = BẢNG CÔNG ĐỨC | Center = Open Sanctuary | Right = 🪷 CÚNG DƯỜNG CẦU AN */}
        {(overlaySettings.showLeaderboard || overlaySettings.showGiftPanel) && (
          <div className="flex items-start justify-between gap-2">
            <div>
              {overlaySettings.showLeaderboard && <Leaderboard leaderboard={leaderboard} />}
            </div>

            <div>
              {overlaySettings.showGiftPanel && (
                <BuddhistGiftPanel
                  giftMappings={giftMappings}
                  giftEventCounts={giftEventCounts}
                  isDemoMode={!isLive}
                  onTriggerDemoGift={onTriggerDemoGift}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==========================================================================
          BOTTOM SAFE ZONE: Ceremonial Banner + Activity Feed + VieNeu Subtitles
          (Leaves the Golden Buddha, Halo, Altar, and Congregation unobstructed!)
         ========================================================================== */}
      <div className="flex flex-col gap-1.5 pb-10 sm:pb-3 relative z-20">
        {/* Ceremonial Large Gift / 1000-Like Milestone Banner */}
        {prominentGiftBanner && (
          <div className="mx-auto max-w-[310px] rounded-lg bg-gradient-to-b from-[#54101a]/95 to-[#24080d]/96 border border-[#f5cd63] px-3.5 py-1.5 text-center shadow-xl">
            <p className="font-display text-[11px] tracking-wider uppercase text-[#ffe082] font-bold">
              Công Đức Cúng Dường {prominentGiftBanner.isDemo ? '· Mô Phỏng' : ''}
            </p>
            <p className="font-display text-base font-bold text-[#fff5d6] leading-tight truncate mt-0.5">
              @{prominentGiftBanner.username}
            </p>
            <p className="text-[10.5px] text-[#f0dec2] truncate">
              Thành tâm: <span className="text-[#ffe082] font-semibold">{prominentGiftBanner.giftName}</span>{' '}
              · <span className="font-mono-tabular text-[#ffd966]">+{prominentGiftBanner.points}</span>
            </p>
          </div>
        )}

        {/* Compact Activity Feed (Bottom-Left) */}
        {overlaySettings.showNotifications && notifications.length > 0 && (
          <div className="w-[224px] sm:w-[248px] max-h-[108px] overflow-hidden flex flex-col-reverse gap-1">
            {notifications.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="rounded-md bg-[#18070a]/88 border border-[#d4af37]/35 px-2 py-1 text-[10px] leading-snug shadow-sm"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-[#ffe082] truncate">@{n.username}</span>
                  {n.pointsDelta ? (
                    <span className="font-mono-tabular text-[9.5px] text-[#ffd966] shrink-0">
                      +{n.pointsDelta}
                    </span>
                  ) : null}
                </div>
                <p className="text-[#f4e8d6] line-clamp-1">{n.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Vietnamese VieNeu Narration Subtitles & Audio / OBS Controls */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex-1 flex justify-center">
            {voiceSnapshot.currentSubtitle ? (
              <div className="max-w-[94%] rounded-lg bg-[#1d080c]/93 border border-[#d4af37]/55 px-3 py-1.5 text-center shadow-lg">
                <p className="font-display text-xs sm:text-sm italic text-[#fff4d4] leading-snug">
                  “{voiceSnapshot.currentSubtitle}”
                </p>
              </div>
            ) : !voiceSnapshot.audioEnabled ? (
              <button
                type="button"
                onClick={onEnableAudio}
                className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be46] text-[#1a0f07] text-xs font-semibold shadow-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5 shrink-0" />
                <span>Bật Âm Thanh Chùa &amp; Giọng Đọc Việt</span>
              </button>
            ) : null}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            {voiceSnapshot.audioEnabled && (
              <span
                title="Âm thanh & Giọng đọc VieNeu đã bật"
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#1d080c]/90 border border-[#d4af37]/40 text-[11px] text-[#ffe082]"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </span>
            )}
            <button
              type="button"
              onClick={onToggleObsCleanView}
              title={
                overlaySettings.obsCleanView
                  ? 'Thoát chế độ OBS (Hiện bảng quản trị)'
                  : 'Chế độ toàn màn hình sạch cho OBS'
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1d080c]/90 hover:bg-[#310e15] border border-[#d4af37]/45 text-[11px] font-medium text-[#f5e7ce] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {overlaySettings.obsCleanView ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#ffe082]" />
                  <span>Quản trị</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#ffe082]" />
                  <span>OBS View</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
