import { useEffect, useState } from 'react';
import {
  Calculator,
  Flame,
  HelpCircle,
  Layers,
  ListOrdered,
  Play,
  Repeat,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  GiftCalculationLogEntry,
  GiftCeremonyQueueItemSnapshot,
  GiftMapping,
  MeritLedgerEntry,
  TikTokNormalizedEvent,
  getRitualDisplayNameVi,
  renderCeremonialSubtitle,
  renderGiftVoiceTemplate,
} from '../../types/temple';
import {
  PRIMARY_DEMO_VIEWER,
  VIETNAMESE_SAMPLE_POOL,
  createUnknownDemoGiftEvent,
  resolveDemoViewerFromUsername,
  scheduleSimulatedGiftBurst,
  scheduleSimulatedGiftStreak,
} from '../../systems/DemoEventManager';
import { voiceManager } from '../../systems/VoiceManager';
import { GiftVisualIcon } from './BuddhistGiftPanel';

interface GiftSimulatorPanelProps {
  gifts: GiftMapping[];
  selectedGiftId?: string;
  leaderboard: MeritLedgerEntry[];
  ceremonyQueueInspector: GiftCeremonyQueueItemSnapshot[];
  recentGiftLogs: GiftCalculationLogEntry[];
  onDispatchDemoEvent: (ev: TikTokNormalizedEvent) => void;
}

export function GiftSimulatorPanel({
  gifts,
  selectedGiftId,
  leaderboard,
  ceremonyQueueInspector,
  recentGiftLogs,
  onDispatchDemoEvent,
}: GiftSimulatorPanelProps) {
  const [chosenGiftId, setChosenGiftId] = useState<string>(
    () => selectedGiftId || gifts[0]?.giftId || '5655',
  );
  const [demoUsername, setDemoUsername] = useState<string>(PRIMARY_DEMO_VIEWER.username);
  const [quantity, setQuantity] = useState<number>(1);
  const [unknownTestId, setUnknownTestId] = useState<string>('998877');

  useEffect(() => {
    if (selectedGiftId && gifts.some((g) => g.giftId === selectedGiftId)) {
      setChosenGiftId(selectedGiftId);
    } else if (!gifts.some((g) => g.giftId === chosenGiftId) && gifts[0]) {
      setChosenGiftId(gifts[0].giftId);
    }
  }, [selectedGiftId, gifts, chosenGiftId]);

  const activeGift = gifts.find((g) => g.giftId === chosenGiftId) || gifts[0];
  const resolvedViewer = resolveDemoViewerFromUsername(demoUsername);
  const currentLedgerEntry = leaderboard.find((e) => e.userId === resolvedViewer.userId);

  const safeQty = Math.max(1, Math.min(999, Math.round(quantity || 1)));
  const expectedAwardedPoints = activeGift ? activeGift.points * safeQty : 0;

  const previewSubtitle = activeGift
    ? renderCeremonialSubtitle(activeGift.ritualSubtitle, {
        username: resolvedViewer.username,
        ritualTitle: activeGift.ritualTitle || activeGift.ceremonyTitle,
        meritPoints: expectedAwardedPoints,
      })
    : '';

  const previewSpeech = activeGift
    ? renderGiftVoiceTemplate(activeGift.voiceTemplate || activeGift.ttsTemplate, {
        username: resolvedViewer.nickname || resolvedViewer.username,
        giftName: activeGift.vietnameseLabel || activeGift.giftName,
        giftCount: safeQty,
        meritPoints: expectedAwardedPoints,
        ritualName: getRitualDisplayNameVi(activeGift.ritualType),
        ritualTitle: activeGift.ritualTitle || activeGift.ceremonyTitle,
      })
    : '';

  const handleSimulateSingleOrMultiGift = () => {
    if (!activeGift) return;
    const now = Date.now();
    onDispatchDemoEvent({
      eventId: `sim-single-${activeGift.giftId}-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'gift',
      userId: resolvedViewer.userId,
      username: resolvedViewer.username,
      nickname: resolvedViewer.nickname,
      avatarUrl: resolvedViewer.avatarUrl,
      giftId: activeGift.giftId,
      giftName: activeGift.giftName,
      giftPictureUrl: activeGift.uploadedImageData || activeGift.iconUrl,
      giftCount: safeQty,
      diamondCount: activeGift.referenceCoins || 1,
      isDemo: true,
      timestamp: now,
    });
  };

  const handleSimulateStreak = () => {
    if (!activeGift) return;
    const streakTotal = Math.max(2, safeQty === 1 ? 3 : safeQty);
    scheduleSimulatedGiftStreak(
      {
        mapping: activeGift,
        username: resolvedViewer.username,
        totalCount: streakTotal,
      },
      onDispatchDemoEvent,
    );
  };

  const handlePreviewVoiceOnly = () => {
    if (!activeGift || !previewSpeech) return;
    const playBell =
      activeGift.soundEffect === 'temple_bell' ||
      activeGift.soundEffect === 'grand_ceremony_bell' ||
      activeGift.isLarge;
    voiceManager.previewGiftVoice(previewSpeech, playBell);
  };

  return (
    <div className="rounded-xl bg-gradient-to-b from-[#2c0b12] to-[#16070a] border border-[#d4af37]/45 p-3.5 space-y-3 text-xs shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-[#d4af37]/25 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Flame className="w-4 h-4 text-[#ffe082] shrink-0" />
          <h3 className="font-display text-sm font-bold tracking-wide text-[#ffe28a] truncate">
            GIẢ LẬP QUÀ TẶNG
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded bg-amber-900/70 border border-amber-400/50 font-mono-tabular text-[10px] font-bold text-amber-200 shrink-0">
          [DEMO PIPELINE]
        </span>
      </div>

      <p className="text-[11px] text-[#cbb696] leading-relaxed">
        Mọi sự kiện giả lập đều đi qua chính xác bộ xử lý <code className="text-[#ffe28a]">GiftRegistry</code> &amp;{' '}
        <code className="text-[#ffe28a]">TikTokEventManager</code> giống hệt TikTok LIVE thật.
      </p>

      {/* Gift Selector, Demo Username & Quantity */}
      <div className="space-y-2">
        <div>
          <label className="block text-[10.5px] text-[#cbb696] mb-1">
            Chọn quà tặng đã lưu trong hệ thống
          </label>
          <select
            value={chosenGiftId}
            onChange={(e) => setChosenGiftId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c0506] border border-[#d4af37]/40 text-xs text-[#fff4dc] focus:outline-none focus:border-[#d4af37]"
          >
            {gifts.map((g) => (
              <option key={g.giftId} value={g.giftId}>
                [{g.enabled ? 'BẬT' : 'TẮT'}] ID {g.giftId} — {g.vietnameseLabel} ({g.giftName}) · +
                {g.points} công đức · {getRitualDisplayNameVi(g.ritualType)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-8">
            <label className="block text-[10.5px] text-[#cbb696] mb-1">
              Tài khoản Phật tử Demo
            </label>
            <input
              type="text"
              list="demo-viewer-presets"
              value={demoUsername}
              onChange={(e) => setDemoUsername(e.target.value)}
              placeholder="phattu.minhanh"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
            />
            <datalist id="demo-viewer-presets">
              <option value={PRIMARY_DEMO_VIEWER.username} />
              {VIETNAMESE_SAMPLE_POOL.slice(0, 8).map((v) => (
                <option key={v.userId} value={v.username} />
              ))}
            </datalist>
          </div>

          <div className="col-span-4">
            <label className="block text-[10.5px] text-[#cbb696] mb-1">Số lượng quà</label>
            <input
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c0506] border border-[#d4af37]/35 font-mono-tabular text-xs text-[#ffe28a]"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-[#b8a285] mr-1">Chọn nhanh SL:</span>
          {[1, 3, 5, 10, 99].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuantity(q)}
              className={`px-2 py-0.5 rounded font-mono-tabular text-[10.5px] border cursor-pointer ${
                safeQty === q
                  ? 'bg-[#d4af37] text-[#1a0c05] border-[#d4af37] font-bold'
                  : 'bg-[#1a090c] text-[#e6d5b8] border-white/15 hover:bg-white/10'
              }`}
            >
              ×{q}
            </button>
          ))}
        </div>
      </div>

      {/* Live Merit Point Calculation & Ceremonial Preview Card */}
      {activeGift && (
        <div className="rounded-lg bg-[#140508] border border-[#d4af37]/30 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GiftVisualIcon gift={activeGift} sizeClass="w-5 h-5" />
              <div className="min-w-0">
                <p className="font-semibold text-[#ffe394] truncate">
                  {activeGift.ritualTitle || activeGift.ceremonyTitle} · {activeGift.vietnameseLabel}{' '}
                  <span className="font-mono-tabular text-[10.5px] text-[#cbb696]">
                    (ID: {activeGift.giftId} · Ưu tiên #{activeGift.queuePriority ?? 40})
                  </span>
                </p>
                <p className="text-[10px] text-[#b8a285] truncate">
                  Nghi lễ: {getRitualDisplayNameVi(activeGift.ritualType)} ·{' '}
                  {activeGift.animationDurationSec}s · {activeGift.isLarge ? 'Đại lễ mưa sen lớn' : 'Lễ thường'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePreviewVoiceOnly}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#2e1017] hover:bg-[#421721] border border-[#d4af37]/45 text-[10.5px] font-semibold text-[#ffe28a] shrink-0 cursor-pointer"
            >
              <Volume2 className="w-3 h-3" />
              <span>Nghe thử</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[11px]">
            <span className="flex items-center gap-1 text-[#cbb696]">
              <Calculator className="w-3.5 h-3.5 text-[#ffd978]" />
              <span>
                Dự tính:{' '}
                <strong className="font-mono-tabular text-[#9ef0b4]">
                  {activeGift.points} × {safeQty} = +{expectedAwardedPoints}
                </strong>
              </span>
            </span>
            <span className="font-mono-tabular text-[10.5px] text-[#ffe082]">
              Hiện có: {currentLedgerEntry?.points ?? 0} điểm
            </span>
          </div>

          <p className="text-[10px] text-[#ffe8b3] truncate" title={previewSubtitle}>
            Bảng trung tâm: <strong>{activeGift.ritualTitle || activeGift.ceremonyTitle}</strong> —{' '}
            {previewSubtitle}
          </p>
          <p className="text-[10px] text-[#cbb696] italic truncate" title={previewSpeech}>
            Giọng đọc: &ldquo;{previewSpeech}&rdquo;
          </p>
        </div>
      )}

      {/* Simulation Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSimulateSingleOrMultiGift}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e5c24f] text-[#190c05] text-xs font-bold shadow cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current shrink-0" />
          <span className="truncate">Kích Hoạt Lễ (×{safeQty}) [DEMO]</span>
        </button>

        <button
          type="button"
          onClick={handleSimulateStreak}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#381018] hover:bg-[#4c1621] border border-[#f5cd63]/55 text-xs font-semibold text-[#ffe49c] cursor-pointer"
        >
          <Repeat className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            Combo Nghi Lễ (×{Math.max(2, safeQty === 1 ? 3 : safeQty)})
          </span>
        </button>

        <button
          type="button"
          onClick={() => scheduleSimulatedGiftBurst(gifts, onDispatchDemoEvent)}
          className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#260e13] hover:bg-[#38141c] border border-[#d4af37]/35 text-[11px] font-medium text-[#fff4dc] cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-[#ffd978] shrink-0" />
          <span className="truncate">Mưa Nghi Lễ Liên Tiếp</span>
        </button>

        <div className="flex items-center gap-1">
          <input
            type="text"
            value={unknownTestId}
            onChange={(e) => setUnknownTestId(e.target.value)}
            aria-label="Mã Gift ID lạ để test"
            className="w-16 px-1.5 py-2 rounded-lg bg-[#0b0405] border border-white/15 font-mono-tabular text-[10.5px] text-[#ffe28a] text-center"
          />
          <button
            type="button"
            onClick={() =>
              onDispatchDemoEvent(
                createUnknownDemoGiftEvent({
                  giftId: unknownTestId,
                  username: resolvedViewer.username,
                }),
              )
            }
            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-[#24130d] hover:bg-[#361d14] border border-white/15 text-[10.5px] font-medium text-[#e6d5b8] cursor-pointer truncate"
          >
            <HelpCircle className="w-3 h-3 text-amber-300 shrink-0" />
            <span className="truncate">Test Quà Lạ</span>
          </button>
        </div>
      </div>

      {/* Live Gift Event Queue & Calculation Log Inspector */}
      <div className="pt-2 border-t border-[#d4af37]/20 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[#ffe082] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Hàng Đợi Nghi Lễ Bàn Thờ ({ceremonyQueueInspector.length})</span>
          </span>
        </div>

        {ceremonyQueueInspector.length === 0 ? (
          <p className="text-[10.5px] text-[#9e8a72] bg-[#100507] rounded px-2.5 py-1.5 border border-white/5">
            Bàn thờ đang thanh tịnh, chưa có hàng đợi chờ.
          </p>
        ) : (
          <div className="space-y-1 max-h-[96px] overflow-y-auto temple-scroll">
            {ceremonyQueueInspector.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-2 rounded bg-[#120507] border border-[#d4af37]/25 px-2 py-1 text-[10.5px]"
              >
                <span className="truncate text-[#fff4dc]">
                  <strong className="text-[#ffe28a]">@{q.username}</strong> · {q.ritualLabel}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9.5px] font-semibold shrink-0 ${
                    q.status === 'active_at_altar'
                      ? 'bg-emerald-900/70 text-emerald-200'
                      : 'bg-amber-900/70 text-amber-200'
                  }`}
                >
                  {q.status === 'active_at_altar' ? 'Đang hành lễ' : 'Đang xếp hàng'}
                </span>
              </div>
            ))}
          </div>
        )}

        {recentGiftLogs.length > 0 && (
          <div className="space-y-1 pt-1">
            <span className="text-[10.5px] font-semibold text-[#cbb696] flex items-center gap-1">
              <ListOrdered className="w-3 h-3 text-[#d4af37]" />
              <span>Nhật ký tính điểm &amp; xử lý quà gần nhất</span>
            </span>
            <div className="space-y-1 max-h-[108px] overflow-y-auto temple-scroll">
              {recentGiftLogs.slice(0, 6).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-1.5 rounded bg-[#0f0406] border border-white/10 px-2 py-1 text-[10px]"
                >
                  <span className="truncate text-[#e6d5b8]">
                    {log.isDemo && <strong className="text-amber-300 mr-1">[DEMO]</strong>}
                    <strong>@{log.username}</strong> · ID {log.giftId} ({log.giftName} ×
                    {log.giftCount})
                  </span>
                  <span className="font-mono-tabular shrink-0 text-[#9ef0b4]">
                    {log.status === 'unknown'
                      ? 'Chưa cấu hình'
                      : log.status === 'disabled'
                        ? 'Đã tắt (0đ)'
                        : `+${log.awardedPoints}đ (Tổng: ${log.totalUserPoints})`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
