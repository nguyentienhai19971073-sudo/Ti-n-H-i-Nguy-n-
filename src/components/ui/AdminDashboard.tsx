import { useEffect, useState } from 'react';
import {
  Play,
  Radio,
  Users,
  Gift,
  Mic,
  Monitor,
  Flower2,
  Sparkles,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
  Send,
  PlugZap,
  Unplug,
  Cloud,
  Laptop,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Flame,
  Heart,
  Share2,
  Bell,
} from 'lucide-react';
import {
  CURATED_VIENEU_VOICES,
  ConnectionStatus,
  DEFAULT_GIFT_MAPPINGS,
  GiftIconType,
  GiftMapping,
  QualityPreset,
  RitualActionType,
  ServerConnectionSnapshot,
  StreamOverlaySettings,
  TTSProviderType,
  TikTokNormalizedEvent,
  VieNeuMode,
  VieNeuVoiceOption,
  VoiceSettings,
} from '../../types/temple';
import { VoiceStateSnapshot, voiceManager } from '../../systems/VoiceManager';
import { PRIMARY_DEMO_VIEWER, buildSacredAvatarDataUri } from '../../systems/DemoEventManager';
import { TOTAL_MAIN_MATS } from '../../systems/SeatManager';

type AdminTab = 'demo' | 'tiktok' | 'characters' | 'gifts' | 'voice' | 'streaming';

interface AdminDashboardProps {
  connectionSnapshot: ServerConnectionSnapshot;
  participantsCount: number;
  occupiedMainSeats: number;
  waitingOverflowCount: number;
  totalEventsProcessed: number;
  totalLikesCount: number;
  totalWoodenFishCount: number;
  giftMappings: GiftMapping[];
  giftEventCounts: Record<string, number>;
  voiceSettings: VoiceSettings;
  voiceSnapshot: VoiceStateSnapshot;
  overlaySettings: StreamOverlaySettings;
  onConnectTikTok: (username: string) => Promise<void>;
  onDisconnectTikTok: () => Promise<void>;
  onSimulateFirstComment: () => void;
  onSimulateLikeMilestone: (likes: 10 | 100 | 1000) => void;
  onSimulateGiftMapping: (mapping: GiftMapping) => void;
  onSimulateFollowIncense: () => void;
  onSimulateShareLantern: () => void;
  onSimulatePrayerComment: () => void;
  onAddParticipantsBatch: (count: number) => void;
  onCustomSimulatedEvent: (ev: TikTokNormalizedEvent) => void;
  onResetDemo: () => void;
  onClearParticipants: () => void;
  onResetSeating: () => void;
  onUpdateGiftMappings: (mappings: GiftMapping[]) => void;
  onUpdateVoiceSettings: (settings: VoiceSettings) => void;
  onTestVoice: () => void;
  onClearVoiceQueue: () => void;
  onEnableAudio: () => void;
  onUpdateOverlaySettings: (settings: StreamOverlaySettings) => void;
}

export function AdminDashboard({
  connectionSnapshot,
  participantsCount,
  occupiedMainSeats,
  waitingOverflowCount,
  totalEventsProcessed,
  totalLikesCount,
  totalWoodenFishCount,
  giftMappings,
  giftEventCounts,
  voiceSettings,
  voiceSnapshot,
  overlaySettings,
  onConnectTikTok,
  onDisconnectTikTok,
  onSimulateFirstComment,
  onSimulateLikeMilestone,
  onSimulateGiftMapping,
  onSimulateFollowIncense,
  onSimulateShareLantern,
  onSimulatePrayerComment,
  onAddParticipantsBatch,
  onCustomSimulatedEvent,
  onResetDemo,
  onClearParticipants,
  onResetSeating,
  onUpdateGiftMappings,
  onUpdateVoiceSettings,
  onTestVoice,
  onClearVoiceQueue,
  onEnableAudio,
  onUpdateOverlaySettings,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('demo');
  const [tiktokInput, setTiktokInput] = useState(connectionSnapshot.tiktokUsername || '');
  const [isConnecting, setIsConnecting] = useState(false);

  // VieNeu Voices Catalog & Connection Test State
  const [availableVoices, setAvailableVoices] =
    useState<VieNeuVoiceOption[]>(CURATED_VIENEU_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesWarning, setVoicesWarning] = useState('');
  const [effectiveVieNeuUrl, setEffectiveVieNeuUrl] = useState(
    'https://api.vieneu.io/api/v1/audio/speech',
  );
  const [testingTts, setTestingTts] = useState(false);
  const [ttsTestBanner, setTtsTestBanner] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Custom event tester fields
  const [customUsername, setCustomUsername] = useState('phattu.anlac');
  const [customComment, setCustomComment] = useState('Nam mô A Di Đà Phật, cầu gia đạo bình an');
  const [newPeacefulMsg, setNewPeacefulMsg] = useState('');

  const loadVieNeuVoices = async (mode: VieNeuMode, localUrl?: string) => {
    setLoadingVoices(true);
    setVoicesWarning('');
    try {
      const res = await voiceManager.fetchVoices(mode, localUrl);
      setAvailableVoices(res.voices);
      setEffectiveVieNeuUrl(res.effectiveEndpoint);
      if (res.warning) {
        setVoicesWarning(res.warning);
      }
    } finally {
      setLoadingVoices(false);
    }
  };

  useEffect(() => {
    if (voiceSettings.provider === 'vieneu') {
      void loadVieNeuVoices(voiceSettings.vieneuMode, voiceSettings.localEndpoint);
    }
  }, [voiceSettings.provider, voiceSettings.vieneuMode]);

  const handleRunConnectionTest = async () => {
    setTestingTts(true);
    setTtsTestBanner(null);
    try {
      const res = await voiceManager.testTTSConnection();
      if (res.ok) {
        setTtsTestBanner({
          ok: true,
          message: `Kết nối thành công tới ${res.providerUsed || voiceSettings.provider}${
            res.modeUsed ? ` (${res.modeUsed.toUpperCase()})` : ''
          }${res.latencyMs !== undefined ? ` · Độ trễ ${res.latencyMs}ms` : ''}.`,
        });
      } else {
        setTtsTestBanner({
          ok: false,
          message: res.errorMessage || 'Kiểm tra kết nối thất bại.',
        });
      }
    } finally {
      setTestingTts(false);
    }
  };

  const handleConnectClick = async () => {
    if (!tiktokInput.trim()) return;
    setIsConnecting(true);
    try {
      await onConnectTikTok(tiktokInput);
    } finally {
      setIsConnecting(false);
    }
  };

  const getCustomUserPayload = () => {
    const cleanUser = customUsername.trim().replace(/^@+/, '') || 'phattu.anlac';
    const userId = `custom-${cleanUser.toLowerCase()}`;
    return {
      userId,
      username: cleanUser,
      nickname: cleanUser,
      avatarUrl: buildSacredAvatarDataUri(userId, cleanUser),
    };
  };

  const handleSendCustomComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customComment.trim()) return;
    const u = getCustomUserPayload();
    onCustomSimulatedEvent({
      eventId: `custom-chat-${Date.now()}`,
      type: 'comment',
      ...u,
      comment: customComment.trim(),
      isDemo: true,
      timestamp: Date.now(),
    });
  };

  const handleSendCustomGift = (mapping: GiftMapping) => {
    const u = getCustomUserPayload();
    onCustomSimulatedEvent({
      eventId: `custom-gift-${Date.now()}`,
      type: 'gift',
      ...u,
      giftId: mapping.giftId,
      giftName: mapping.giftName,
      giftCount: 1,
      diamondCount: mapping.referenceCoins || (mapping.isLarge ? 199 : 1),
      isDemo: true,
      timestamp: Date.now(),
    });
  };

  const handleSendCustomSocialAction = (
    actionType: 'like' | 'follow' | 'share',
    likeAmount: 10 | 100 | 1000 = 10,
  ) => {
    const u = getCustomUserPayload();
    onCustomSimulatedEvent({
      eventId: `custom-${actionType}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: actionType,
      ...u,
      likeCount: actionType === 'like' ? likeAmount : undefined,
      isDemo: true,
      timestamp: Date.now(),
    });
  };

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { id: 'demo', label: 'Demo Lễ', icon: Play },
      { id: 'gifts', label: 'Quà tặng', icon: Gift },
      { id: 'tiktok', label: 'TikTok LIVE', icon: Radio },
      { id: 'voice', label: 'Giọng AI', icon: Mic },
      { id: 'characters', label: 'Phật tử', icon: Users },
      { id: 'streaming', label: 'OBS / Khung', icon: Monitor },
    ];

  return (
    <section
      aria-label="Bảng Điều Khiển Quản Trị Chùa Online"
      className="flex flex-col h-full w-full bg-[#130908] border-l border-[#d4af37]/30 text-[#f5ead6]"
    >
      {/* Top Studio Header */}
      <div className="px-4 py-3 border-b border-[#d4af37]/25 bg-gradient-to-b from-[#290b10] to-[#150809] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-[#ffe082] truncate">
            Quản Trị Chùa Online
          </h2>
          <p className="text-[11px] text-[#cbb696] mt-0.5 truncate">
            Phật tử: <span className="font-mono-tabular text-[#fff4dc]">{participantsCount}</span> ·
            Đệm:{' '}
            <span className="font-mono-tabular text-[#fff4dc]">
              {occupiedMainSeats}/{TOTAL_MAIN_MATS}
            </span>{' '}
            · ❤️{' '}
            <span className="font-mono-tabular text-[#ffd978]">
              {totalLikesCount.toLocaleString('vi-VN')}
            </span>{' '}
            · 🥁{' '}
            <span className="font-mono-tabular text-[#ffd978]">
              {totalWoodenFishCount.toLocaleString('vi-VN')}
            </span>
          </p>
        </div>

        {!voiceSnapshot.audioEnabled ? (
          <button
            type="button"
            onClick={onEnableAudio}
            className="px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e5c24e] text-[#170d06] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Bật Âm Thanh
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onUpdateOverlaySettings({
                ...overlaySettings,
                obsCleanView: true,
              })
            }
            className="px-3 py-1.5 rounded-lg bg-[#2e0d14] hover:bg-[#3f131c] border border-[#d4af37]/45 text-[#ffe082] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            OBS Toàn Màn Hình
          </button>
        )}
      </div>

      {/* Segmented Navigation Bar */}
      <div className="px-3 py-2 border-b border-white/10 bg-[#0d0606] flex items-center gap-1 overflow-x-auto temple-scroll">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#d4af37] text-[#180d06] font-semibold'
                  : 'text-[#cbb696] hover:text-[#fff3d6] hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Active Panel Body */}
      <div className="flex-1 overflow-y-auto temple-scroll p-4 space-y-5">
        {/* ==========================================================================
            1. DEMO CEREMONIES & LIKE = GÕ MÕ CONTROLS TAB
           ========================================================================== */}
        {activeTab === 'demo' && (
          <div className="space-y-5">
            {/* Section 1: The 5 Ceremonial Buddhist Offerings ("🪷 CÚNG DƯỜNG CẦU AN") */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#ffe082]">
                  01. Năm Nghi Lễ &ldquo;🪷 CÚNG DƯỜNG CẦU AN&rdquo;
                </h3>
                <span className="text-[11px] text-[#cbb696] font-mono-tabular">
                  @{PRIMARY_DEMO_VIEWER.username}
                </span>
              </div>
              <p className="text-xs text-[#b8a285] mt-1 leading-relaxed">
                Nhấn để Phật tử đứng dậy rời đệm ngồi, tiến lên bàn thờ thực hiện nghi lễ tương ứng, hiện khung Hoa Sen Avatar, phát giọng đọc VieNeu rồi quay về đúng đệm ngồi cũ.
              </p>

              <div className="grid grid-cols-1 gap-2 mt-3">
                {giftMappings.map((gm) => {
                  const liveCount = giftEventCounts[gm.id] ?? 0;
                  const isGrand = gm.ritualType === 'altar_pagoda' || gm.isLarge;
                  return (
                    <button
                      key={gm.id}
                      type="button"
                      onClick={() => onSimulateGiftMapping(gm)}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isGrand
                          ? 'bg-gradient-to-r from-[#46111b] to-[#2b0c12] hover:from-[#571622] hover:to-[#381018] border-[#f5cd63]/65 text-[#fff4d8]'
                          : 'bg-[#260d12] hover:bg-[#351219] border-[#d4af37]/40 text-[#fff4dc]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {gm.iconType === 'bell' ? (
                          <Bell className="w-4 h-4 text-[#ffd978] shrink-0" />
                        ) : gm.iconType === 'pagoda' ? (
                          <Sparkles className="w-4 h-4 text-[#ffe082] shrink-0" />
                        ) : (
                          <Flower2 className="w-4 h-4 text-[#ff9ec7] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#ffe394] truncate">
                            {gm.ceremonyTitle} – {gm.vietnameseLabel} –{' '}
                            <span className="font-mono-tabular">{gm.referenceCoins} xu</span>
                          </p>
                          <p className="text-[10.5px] text-[#ccb79a] truncate">
                            +{gm.points} công đức · {gm.badgeCeremonyLabel}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#140608] border border-[#d4af37]/35 font-mono-tabular text-[11px] font-bold text-[#ffd978] shrink-0">
                        {liveCount} lễ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Interactive LIKE = GÕ MÕ System (10 / 100 / 1000 Likes) */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#ffe082]">
                  02. Hệ Thống &ldquo;❤️ LIKE = GÕ MÕ&rdquo; (1 Like = +1 Công Đức)
                </h3>
              </div>
              <p className="text-xs text-[#b8a285] mt-1 leading-relaxed">
                Gõ mõ gỗ trực tiếp tại đệm ngồi, âm thanh mõ khớp từng nhịp dùi: <strong>10 Likes</strong> (1 nhịp), <strong>100 Likes</strong> (3 nhịp + hạt vàng), <strong>1000 Likes</strong> (6 nhịp đại lễ + sen vàng + giọng đọc VieNeu).
              </p>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onSimulateLikeMilestone(10)}
                  className="flex flex-col items-center justify-center gap-1 px-2.5 py-2.5 rounded-lg bg-[#260f13] hover:bg-[#36151b] border border-[#d4af37]/40 text-xs font-semibold text-[#fff3da] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1 text-[#ff9ebb]">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span className="font-mono-tabular">+10 Likes</span>
                  </span>
                  <span className="text-[10px] font-normal text-[#d8c3a5]">Gõ 1 tiếng mõ</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSimulateLikeMilestone(100)}
                  className="flex flex-col items-center justify-center gap-1 px-2.5 py-2.5 rounded-lg bg-[#301217] hover:bg-[#421920] border border-[#e5bd5a]/50 text-xs font-semibold text-[#ffe59e] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1 text-[#ffa8c5]">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span className="font-mono-tabular">+100 Likes</span>
                  </span>
                  <span className="text-[10px] font-normal text-[#e3cfa8]">3 tiếng + Hạt vàng</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSimulateLikeMilestone(1000)}
                  className="flex flex-col items-center justify-center gap-1 px-2.5 py-2.5 rounded-lg bg-gradient-to-b from-[#4f131e] to-[#2e0b12] hover:from-[#631826] hover:to-[#3b0e17] border border-[#f5cd63]/75 text-xs font-bold text-[#ffe699] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1 text-[#ffd978]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-mono-tabular">+1000 Likes</span>
                  </span>
                  <span className="text-[10px] font-normal text-[#f7e2bc]">6 tiếng + VieNeu</span>
                </button>
              </div>
            </div>

            {/* Section 3: Other Temple Interactions & Crowd Load Testing */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-[#ffe082]">
                03. Bình Luận, Follow, Share &amp; Đông Đảo Phật Tử
              </h3>
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={onSimulateFirstComment}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-[#f7d57c] shrink-0" />
                  <span className="truncate">Bình luận đầu (Vào đệm)</span>
                </button>

                <button
                  type="button"
                  onClick={onSimulatePrayerComment}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-[#9bc4ff] shrink-0" />
                  <span className="truncate">Bình luận Cầu nguyện</span>
                </button>

                <button
                  type="button"
                  onClick={onSimulateFollowIncense}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-[#ffb86b] shrink-0" />
                  <span className="truncate">Follow → Thắp hương</span>
                </button>

                <button
                  type="button"
                  onClick={onSimulateShareLantern}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#ffd27d] shrink-0" />
                  <span className="truncate">Share → Thả hoa đăng</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onAddParticipantsBatch(10)}
                  className="px-3.5 py-2 rounded-lg bg-[#22130d] hover:bg-[#311c13] border border-white/15 text-xs font-medium text-[#f5ead6] transition-colors whitespace-nowrap cursor-pointer"
                >
                  + Thêm 10 Phật tử
                </button>
                <button
                  type="button"
                  onClick={() => onAddParticipantsBatch(50)}
                  className="px-3.5 py-2 rounded-lg bg-[#22130d] hover:bg-[#311c13] border border-white/15 text-xs font-medium text-[#f5ead6] transition-colors whitespace-nowrap cursor-pointer"
                >
                  + Thêm 50 Phật tử
                </button>
                <button
                  type="button"
                  onClick={onResetDemo}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#3d1316] hover:bg-[#521a1e] border border-red-400/35 text-xs font-medium text-red-200 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại Demo</span>
                </button>
              </div>
            </div>

            {/* Section 4: Custom User Event Sender */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-[#ffe082]">
                04. Giả Lập Tài Khoản Người Xem Tùy Chỉnh
              </h3>
              <form onSubmit={handleSendCustomComment} className="space-y-2.5 mt-2.5">
                <div>
                  <label className="block text-[11px] text-[#cbb696] mb-1">
                    TikTok Username người xem
                  </label>
                  <input
                    type="text"
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    placeholder="phattu.anlac"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0b0605] border border-white/15 text-xs text-[#fff6e5] focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customComment}
                    onChange={(e) => setCustomComment(e.target.value)}
                    placeholder="Nhập lời cầu nguyện (bình an, sức khỏe, tài lộc...)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#0b0605] border border-white/15 text-xs text-[#fff6e5] focus:outline-none focus:border-[#d4af37]"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e3be46] text-[#180d06] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Bình luận</span>
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <button
                  type="button"
                  onClick={() => handleSendCustomSocialAction('like', 10)}
                  className="px-2.5 py-1 rounded bg-[#290e13] hover:bg-[#3a141b] border border-[#d4af37]/30 text-[11px] text-[#ffe5b4] cursor-pointer"
                >
                  +10 Likes (Gõ 1 mõ)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCustomSocialAction('like', 100)}
                  className="px-2.5 py-1 rounded bg-[#290e13] hover:bg-[#3a141b] border border-[#d4af37]/30 text-[11px] text-[#ffe5b4] cursor-pointer"
                >
                  +100 Likes (Gõ 3 mõ)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCustomSocialAction('like', 1000)}
                  className="px-2.5 py-1 rounded bg-[#3b1219] hover:bg-[#4f1822] border border-[#f5cd63]/45 text-[11px] text-[#ffe28a] cursor-pointer"
                >
                  +1000 Likes (6 mõ)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCustomSocialAction('follow')}
                  className="px-2.5 py-1 rounded bg-[#26140c] hover:bg-[#361d11] border border-[#d4af37]/30 text-[11px] text-[#ffe5b4] cursor-pointer"
                >
                  Follow → Thắp hương
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCustomSocialAction('share')}
                  className="px-2.5 py-1 rounded bg-[#26140c] hover:bg-[#361d11] border border-[#d4af37]/30 text-[11px] text-[#ffe5b4] cursor-pointer"
                >
                  Share → Hoa đăng
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {giftMappings.map((gm) => (
                  <button
                    key={gm.id}
                    type="button"
                    onClick={() => handleSendCustomGift(gm)}
                    className="px-2.5 py-1 rounded bg-[#1f0c0f] hover:bg-[#2f1217] border border-[#d4af37]/30 text-[11px] text-[#f6d98e] cursor-pointer"
                  >
                    Tặng {gm.vietnameseLabel} (+{gm.points})
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================================================
            2. ADMIN GIFT-MAPPING TABLE TAB ("🪷 CÚNG DƯỜNG CẦU AN")
           ========================================================================== */}
        {activeTab === 'gifts' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#ffe082]">
                  Bảng Ánh Xạ Quà Tặng TikTok &amp; &ldquo;🪷 CÚNG DƯỜNG CẦU AN&rdquo;
                </h3>
                <p className="text-[11px] text-[#b8a285] mt-0.5 leading-relaxed">
                  Tên quà tiếng Việt và mệnh giá xu hiển thị trên bảng là cấu hình tham chiếu có thể chỉnh sửa; hệ thống đối chiếu sự kiện thực từ máy chủ bằng <strong>TikTok Gift ID</strong> và <strong>Gift Name</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateGiftMappings(DEFAULT_GIFT_MAPPINGS.map((item) => ({ ...item })))
                }
                className="px-2.5 py-1.5 rounded-lg bg-[#261114] hover:bg-[#36181c] border border-[#d4af37]/35 text-[11px] text-[#ffe082] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Khôi phục mặc định
              </button>
            </div>

            {/* Ceremony Queue Concurrency & 3D Effects Controls */}
            <div className="rounded-xl bg-[#1b0b0e] border border-[#d4af37]/25 p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[#e6d5b8]">
                  Số Phật tử hành lễ đồng thời tối đa tại bàn thờ
                </label>
                <span className="font-mono-tabular font-bold text-[#ffe082]">
                  {overlaySettings.maxConcurrentCeremonies} người
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={overlaySettings.maxConcurrentCeremonies}
                onChange={(e) =>
                  onUpdateOverlaySettings({
                    ...overlaySettings,
                    maxConcurrentCeremonies: Number(e.target.value),
                  })
                }
                className="w-full accent-[#d4af37]"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#b8a285]">
                  Hiệu ứng hạt sen vàng, cột sáng &amp; hào quang 3D
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.effectsEnabled}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      effectsEnabled: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </div>
            </div>

            {/* Editable 5-Row Gift Mapping Cards */}
            <div className="space-y-3">
              {giftMappings.map((gm, idx) => (
                <div
                  key={gm.id}
                  className="rounded-xl bg-[#1a0b0d] border border-[#d4af37]/25 p-3.5 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <div className="min-w-0">
                      <span className="font-display font-bold text-sm text-[#ffe082]">
                        {gm.ceremonyTitle} – {gm.vietnameseLabel}
                      </span>
                      <span className="ml-2 text-[11px] font-mono-tabular text-[#cbb696]">
                        ({gm.referenceCoins} xu · Đã nhận: {giftEventCounts[gm.id] ?? 0})
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#e6d5b8] shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gm.enabled}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = { ...gm, enabled: e.target.checked };
                          onUpdateGiftMappings(next);
                        }}
                        className="accent-[#d4af37]"
                      />
                      <span>Hiển thị</span>
                    </label>
                  </div>

                  {/* Row 1: Ceremony Title + Reference Vietnamese Gift Label + Reference Xu */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        Tên cầu nguyện
                      </label>
                      <input
                        type="text"
                        value={gm.ceremonyTitle}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = { ...gm, ceremonyTitle: e.target.value };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        Tên lễ vật (Tham chiếu)
                      </label>
                      <input
                        type="text"
                        value={gm.vietnameseLabel}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = { ...gm, vietnameseLabel: e.target.value };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        Xu hiển thị
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99999}
                        value={gm.referenceCoins}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = {
                            ...gm,
                            referenceCoins: Math.max(1, Number(e.target.value) || 1),
                          };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 font-mono-tabular text-xs text-[#ffd978]"
                      />
                    </div>
                  </div>

                  {/* Row 2: Actual Backend-Verified TikTok Gift ID + Gift Name + Merit Points */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        TikTok Gift ID thực
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={gm.giftId}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = {
                            ...gm,
                            giftId: Math.max(1, Number(e.target.value) || 1),
                          };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-[#d4af37]/30 font-mono-tabular text-xs text-[#ffe28a]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        TikTok Gift Name
                      </label>
                      <input
                        type="text"
                        value={gm.giftName}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = { ...gm, giftName: e.target.value };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        Điểm công đức
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={gm.points}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = {
                            ...gm,
                            points: Math.max(1, Number(e.target.value) || 10),
                          };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 font-mono-tabular text-xs text-[#fff4dc]"
                      />
                    </div>
                  </div>

                  {/* Row 3: 3D Ritual Animation + Icon + Lotus Avatar Badge Title */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        Nghi lễ 3D tại điện
                      </label>
                      <select
                        value={gm.ritualType}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = {
                            ...gm,
                            ritualType: e.target.value as RitualActionType,
                          };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
                      >
                        <option value="altar_flower">Dâng Hoa Hồng</option>
                        <option value="altar_bell">Thỉnh Chuông Đồng</option>
                        <option value="altar_fruit_tray">Dâng Mâm Ngũ Quả</option>
                        <option value="altar_lotus_pedestal">Dâng Đài Sen Vàng</option>
                        <option value="altar_pagoda">Đại Lễ Bảo Tháp</option>
                        <option value="altar_incense">Thắp Hương Cầu An</option>
                        <option value="altar_lantern">Thả Hoa Đăng</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        Biểu tượng
                      </label>
                      <select
                        value={gm.iconType}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = {
                            ...gm,
                            iconType: e.target.value as GiftIconType,
                          };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
                      >
                        <option value="rose">Hoa Hồng</option>
                        <option value="bell">Chuông Đồng</option>
                        <option value="fruit">Mâm Quả</option>
                        <option value="lotus">Đài Sen</option>
                        <option value="pagoda">Bảo Tháp</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] text-[#b8a285] mb-1">
                        Nhãn Hoa Sen Avatar
                      </label>
                      <input
                        type="text"
                        value={gm.badgeCeremonyLabel}
                        onChange={(e) => {
                          const next = [...giftMappings];
                          next[idx] = { ...gm, badgeCeremonyLabel: e.target.value };
                          onUpdateGiftMappings(next);
                        }}
                        className="w-full px-2 py-1.5 rounded bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
                      />
                    </div>
                  </div>

                  {/* Row 4: VieNeuTTS Automatic Announcement Template */}
                  <div>
                    <label className="block text-[10.5px] text-[#b8a285] mb-1">
                      Lời chúc tự động VieNeuTTS khi hành lễ ({'{username}'})
                    </label>
                    <input
                      type="text"
                      value={gm.ttsTemplate}
                      onChange={(e) => {
                        const next = [...giftMappings];
                        next[idx] = { ...gm, ttsTemplate: e.target.value };
                        onUpdateGiftMappings(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0c0506] border border-white/15 text-xs text-[#fff4dc]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==========================================================================
            3. TIKTOK LIVE CONNECTION TAB
           ========================================================================== */}
        {activeTab === 'tiktok' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-[#ffe082]">
                Kết Nối Phiên Phát Trực Tiếp TikTok LIVE Thực Tế
              </h3>
              <p className="text-xs text-[#b8a285] mt-1 leading-relaxed">
                Máy chủ Node.js sử dụng <code className="text-[#f3d892]">TikTok-Live-Connector</code>{' '}
                để xác thực sự kiện thực (chống trùng lặp <code className="text-[#f3d892]">msgId</code>{' '}
                &amp; combo quà tặng), đồng bộ avatar thật và danh tính duy nhất theo{' '}
                <code className="text-[#f3d892]">userId</code>.
              </p>

              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-[#cbb696]">
                  TikTok Username đang phát LIVE
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tiktokInput}
                    onChange={(e) => setTiktokInput(e.target.value)}
                    placeholder="@ten_tai_khoan_tiktok"
                    className="flex-1 px-3.5 py-2 rounded-lg bg-[#0b0604] border border-white/15 text-xs text-[#fff6e5] focus:outline-none focus:border-[#d4af37]"
                  />
                  {connectionSnapshot.status === ConnectionStatus.LIVE ||
                  connectionSnapshot.status === ConnectionStatus.CONNECTING ? (
                    <button
                      type="button"
                      onClick={() => void onDisconnectTikTok()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#471818] hover:bg-[#5c2020] border border-red-400/35 text-xs font-semibold text-red-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Unplug className="w-3.5 h-3.5" />
                      <span>Ngắt kết nối</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isConnecting || !tiktokInput.trim()}
                      onClick={() => void handleConnectClick()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e4bf47] disabled:opacity-50 text-[#180d06] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <PlugZap className="w-3.5 h-3.5" />
                      <span>{isConnecting ? 'Đang kết nối...' : 'Kết nối LIVE'}</span>
                    </button>
                  )}
                </div>
              </div>

              {connectionSnapshot.lastError && (
                <div className="mt-3 rounded-lg bg-[#2e1212] border border-red-400/30 px-3.5 py-2.5 text-xs text-red-200">
                  {connectionSnapshot.lastError}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Trạng thái kết nối</span>
                <span className="font-mono-tabular font-semibold text-[#ffe082]">
                  {connectionSnapshot.status}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Bộ thu sự kiện (Event Receiver)</span>
                <span className="font-medium text-[#f5ead6]">
                  {connectionSnapshot.receiverActive
                    ? 'Đang thu trực tiếp (LIVE)'
                    : 'Chế độ chờ / Demo'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Tổng sự kiện đã xử lý</span>
                <span className="font-mono-tabular text-[#f5ead6]">{totalEventsProcessed}</span>
              </div>
              {connectionSnapshot.roomId && (
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-[#b8a285]">TikTok Room ID</span>
                  <span className="font-mono-tabular text-[#f5ead6]">
                    {connectionSnapshot.roomId}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 text-xs text-[#b8a285] space-y-1.5">
              <p className="font-semibold text-[#e6d5b8]">
                Tích hợp cầu nối Webhook &amp; Console API:
              </p>
              <p>
                • Gọi trực tiếp trên trình duyệt:{' '}
                <code className="text-[#f3d892]">window.handleTikTokEvent(event)</code>
              </p>
              <p>
                • Hoặc gửi HTTP POST từ TikFinity / Streamer.bot tới:{' '}
                <code className="text-[#f3d892]">/api/tiktok/webhook</code>
              </p>
            </div>
          </div>
        )}

        {/* ==========================================================================
            4. VOICE AI / VIENEU PRIMARY TTS TAB
           ========================================================================== */}
        {activeTab === 'voice' && (
          <div className="space-y-5 text-xs">
            <div className="rounded-xl bg-[#1b0c0e] border border-[#d4af37]/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="w-4 h-4 text-[#ffe082] shrink-0" />
                  <span className="font-semibold text-[#ffe082] truncate">
                    Trạng Thái Voice API &amp; Âm Thanh
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onEnableAudio}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    voiceSnapshot.audioEnabled
                      ? 'bg-[#203824] text-[#9ef0b4] border border-[#499e5b]/40'
                      : 'bg-[#d4af37] hover:bg-[#e5c24e] text-[#180d06]'
                  }`}
                >
                  {voiceSnapshot.audioEnabled ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Âm thanh đã bật</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Bật Âm Thanh</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-white/10 text-[11px]">
                <div className="flex justify-between gap-2">
                  <span className="text-[#b8a285]">Trạng thái kết nối TTS:</span>
                  <span
                    className={`font-semibold ${
                      voiceSnapshot.apiStatus === 'connected'
                        ? 'text-[#8ee6a8]'
                        : voiceSnapshot.apiStatus === 'fallback'
                          ? 'text-[#f6d375]'
                          : voiceSnapshot.apiStatus === 'error'
                            ? 'text-red-300'
                            : 'text-[#e6d5b8]'
                    }`}
                  >
                    {voiceSnapshot.apiStatus === 'connected'
                      ? `Đã kết nối (${voiceSnapshot.lastProviderLabel}${
                          voiceSnapshot.lastLatencyMs !== null
                            ? ` · ${voiceSnapshot.lastLatencyMs}ms`
                            : ''
                        })`
                      : voiceSnapshot.apiStatus === 'testing'
                        ? 'Đang kiểm tra kết nối...'
                        : voiceSnapshot.apiStatus === 'fallback'
                          ? 'Đang phát dự phòng qua trình duyệt'
                          : voiceSnapshot.apiStatus === 'error'
                            ? 'Lỗi kết nối API'
                            : 'Sẵn sàng kiểm tra'}
                  </span>
                </div>

                {voiceSettings.provider === 'vieneu' && voiceSettings.vieneuMode === 'cloud' && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[#b8a285]">Khóa VIENEU_API_KEY (Secrets):</span>
                    <span
                      className={
                        connectionSnapshot.availableServerTts.vieneuCloudKeyConfigured
                          ? 'text-[#8ee6a8] font-medium'
                          : 'text-[#f6d375] font-medium'
                      }
                    >
                      {connectionSnapshot.availableServerTts.vieneuCloudKeyConfigured
                        ? 'Đã cấu hình trên máy chủ'
                        : 'Chưa cấu hình (Cần thêm vào Secrets)'}
                    </span>
                  </div>
                )}

                {connectionSnapshot.availableServerTts.vieneuEnvUrlWasLocalhost &&
                  voiceSettings.vieneuMode === 'cloud' && (
                    <p className="text-[10.5px] text-[#cbb696]">
                      • Đã tự động dùng endpoint đám mây chuẩn{' '}
                      <code className="text-[#f3d892]">api.vieneu.io/api/v1/audio/speech</code>.
                    </p>
                  )}
              </div>

              {voiceSnapshot.lastWarning && (
                <div className="rounded-lg bg-[#2e1412] border border-red-400/35 px-3 py-2 text-[11px] text-red-200 leading-relaxed">
                  <span className="font-semibold">Chi tiết lỗi TTS:</span> {voiceSnapshot.lastWarning}
                </div>
              )}
            </div>

            {/* Primary Provider Selection */}
            <div className="space-y-3">
              <div>
                <label className="block text-[#cbb696] mb-1 font-medium">
                  Nhà cung cấp giọng đọc (VieNeu là mặc định chính)
                </label>
                <select
                  value={voiceSettings.provider}
                  onChange={(e) =>
                    onUpdateVoiceSettings({
                      ...voiceSettings,
                      provider: e.target.value as TTSProviderType,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0604] border border-white/15 text-[#fff6e5]"
                >
                  <option value="vieneu">
                    VieNeu Tiếng Việt Tự Nhiên (Chính · Cloud / Local)
                  </option>
                  <option value="browser">Trình duyệt SpeechSynthesis (Miễn phí nội bộ)</option>
                  <option value="gemini">
                    Gemini TTS Máy Chủ (
                    {connectionSnapshot.availableServerTts.gemini ? 'Sẵn sàng' : 'Tùy chọn'})
                  </option>
                  <option value="elevenlabs">
                    ElevenLabs TTS (
                    {connectionSnapshot.availableServerTts.elevenlabs ? 'Sẵn sàng' : 'Tùy chọn'})
                  </option>
                  <option value="openai">
                    OpenAI TTS (
                    {connectionSnapshot.availableServerTts.openai ? 'Sẵn sàng' : 'Tùy chọn'})
                  </option>
                </select>
              </div>

              {/* VieNeu CLOUD vs LOCAL Mode Selector */}
              {voiceSettings.provider === 'vieneu' && (
                <div className="space-y-3 rounded-xl bg-[#180c0d] border border-white/10 p-3.5">
                  <label className="block text-[#e6d5b8] font-medium">
                    Chế độ kết nối VieNeu TTS
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          vieneuMode: 'cloud',
                        })
                      }
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        voiceSettings.vieneuMode === 'cloud'
                          ? 'bg-[#d4af37] text-[#180d06] border-[#d4af37] font-semibold'
                          : 'bg-[#0e0805] text-[#cbb696] border-white/10 hover:text-white'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5 shrink-0" />
                      <span>VieNeu Cloud</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          vieneuMode: 'local',
                        })
                      }
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        voiceSettings.vieneuMode === 'local'
                          ? 'bg-[#d4af37] text-[#180d06] border-[#d4af37] font-semibold'
                          : 'bg-[#0e0805] text-[#cbb696] border-white/10 hover:text-white'
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5 shrink-0" />
                      <span>VieNeu Local (Mac)</span>
                    </button>
                  </div>

                  {voiceSettings.vieneuMode === 'cloud' ? (
                    <div className="text-[11px] text-[#b8a285] space-y-1">
                      <p>
                        Endpoint:{' '}
                        <code className="text-[#f3d892] break-all">{effectiveVieNeuUrl}</code>
                      </p>
                      <p>
                        Sử dụng biến môi trường máy chủ{' '}
                        <code className="text-[#f3d892]">VIENEU_API_KEY</code> (không lộ khóa ra
                        trình duyệt).
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] text-[#cbb696] mb-1">
                          Địa chỉ máy chủ VieNeuTTS trên máy Mac (Local HTTP)
                        </label>
                        <input
                          type="text"
                          value={voiceSettings.localEndpoint}
                          onChange={(e) =>
                            onUpdateVoiceSettings({
                              ...voiceSettings,
                              localEndpoint: e.target.value,
                            })
                          }
                          placeholder="http://127.0.0.1:8000/v1/audio/speech"
                          className="w-full px-3 py-1.5 rounded bg-[#0b0604] border border-white/15 text-[#fff6e5] font-mono-tabular text-[11px]"
                        />
                      </div>
                      {connectionSnapshot.isCloudRuntime && (
                        <p className="text-[11px] text-[#f6d375] leading-relaxed">
                          Lưu ý: Hiện ứng dụng đang chạy trên đám mây Google AI Studio nên máy chủ sẽ
                          không truy cập localhost của máy Mac. Chế độ này dành cho khi bạn xuất mã
                          nguồn về chạy trực tiếp trên máy Mac.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Available VieNeu Voice Selector */}
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="text-[#cbb696] font-medium">
                        Chọn giọng đọc VieNeu ({availableVoices.length} giọng)
                      </label>
                      <button
                        type="button"
                        disabled={loadingVoices}
                        onClick={() =>
                          void loadVieNeuVoices(
                            voiceSettings.vieneuMode,
                            voiceSettings.localEndpoint,
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] text-[#ffe082] hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${loadingVoices ? 'animate-spin' : ''}`}
                        />
                        <span>Tải lại danh sách</span>
                      </button>
                    </div>

                    <select
                      value={voiceSettings.voiceId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const matched = availableVoices.find((v) => v.id === selectedId);
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          voiceId: selectedId,
                          gender: matched?.gender === 'male' ? 'male' : 'female',
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0604] border border-white/15 text-[#fff6e5]"
                    >
                      {availableVoices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.recommended ? '★ ' : ''}
                          {v.name} —{' '}
                          {v.description || (v.gender === 'male' ? 'Giọng nam' : 'Giọng nữ')}
                        </option>
                      ))}
                    </select>

                    {voicesWarning && (
                      <p className="text-[10.5px] text-[#cbb696] leading-snug">{voicesWarning}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Voice ID & Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#cbb696] mb-1">Mã giọng (Voice ID tùy chỉnh)</label>
                  <input
                    type="text"
                    value={voiceSettings.voiceId}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        voiceId: e.target.value,
                      })
                    }
                    placeholder="Ngọc Lan"
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0604] border border-white/15 text-[#fff6e5]"
                  />
                </div>
                <div>
                  <label className="block text-[#cbb696] mb-1">Âm sắc ưu tiên</label>
                  <select
                    value={voiceSettings.gender}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        gender: e.target.value as 'female' | 'male',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0b0604] border border-white/15 text-[#fff6e5]"
                  >
                    <option value="female">Nữ dịu dàng, trầm ấm</option>
                    <option value="male">Nam điềm đạm, trang nghiêm</option>
                  </select>
                </div>
              </div>

              {/* Volume & Speed Sliders */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#cbb696]">Âm lượng giọng đọc</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {Math.round(voiceSettings.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={voiceSettings.volume}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        volume: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#d4af37]"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#cbb696]">Tốc độ giọng đọc</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {voiceSettings.speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.3}
                    step={0.04}
                    value={voiceSettings.speed}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        speed: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#d4af37]"
                  />
                </div>
              </div>

              {/* Connection Test, Test Voice & Queue Clear Controls */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={testingTts}
                  onClick={() => void handleRunConnectionTest()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e5c14b] disabled:opacity-55 text-[#180d06] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <PlugZap className="w-3.5 h-3.5" />
                  <span>{testingTts ? 'Đang kiểm tra...' : 'Kiểm tra kết nối TTS'}</span>
                </button>

                <button
                  type="button"
                  onClick={onTestVoice}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#26160c] hover:bg-[#362012] border border-[#d4af37]/40 text-xs font-medium text-[#fff4dc] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#ffe082]" />
                  <span>Nghe thử giọng</span>
                </button>

                <button
                  type="button"
                  onClick={onClearVoiceQueue}
                  className="px-3 py-2 rounded-lg bg-[#2a170d] hover:bg-[#382012] border border-white/15 text-xs text-[#f5ead6] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Xóa hàng đợi ({voiceSnapshot.queueLength})
                </button>
              </div>

              {ttsTestBanner && (
                <div
                  className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed border ${
                    ttsTestBanner.ok
                      ? 'bg-[#132918] border-[#499e5b]/45 text-[#b6f5c6]'
                      : 'bg-[#2e1313] border-red-400/40 text-red-200'
                  }`}
                >
                  {ttsTestBanner.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#70e08c]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
                  )}
                  <span>{ttsTestBanner.message}</span>
                </div>
              )}

              {/* Background Đàn Tranh Music Volume */}
              <div className="pt-3 border-t border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 text-[#f5ead6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceSettings.bgMusicEnabled}
                      onChange={(e) =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          bgMusicEnabled: e.target.checked,
                        })
                      }
                      className="accent-[#d4af37]"
                    />
                    <span>Nhạc thiền Đàn Tranh (Tự giảm âm khi đọc)</span>
                  </label>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {Math.round(voiceSettings.bgMusicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.02}
                  value={voiceSettings.bgMusicVolume}
                  onChange={(e) =>
                    onUpdateVoiceSettings({
                      ...voiceSettings,
                      bgMusicVolume: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#d4af37]"
                />
              </div>

              {/* Automatic Voice Behavior Toggles */}
              <div className="pt-3 border-t border-white/10 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#ffe082] font-medium">
                    Bật giọng đọc tự động (Automatic Voice On/Off)
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.autoNarrationEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        autoNarrationEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#e6d5b8]">
                    Dùng giọng trình duyệt dự phòng khi VieNeu chưa sẵn sàng
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.browserFallbackEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        browserFallbackEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#e6d5b8]">
                    Đọc lời chúc tự động khi hành lễ Cúng dường &amp; mốc 1000 Likes
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.giftAnnouncementsEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        giftAnnouncementsEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#e6d5b8]">Chào mừng Phật tử bình luận lần đầu</span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.welcomeAnnouncementsEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        welcomeAnnouncementsEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                {voiceSettings.welcomeAnnouncementsEnabled && (
                  <div className="pt-0.5">
                    <label className="block text-[11px] text-[#cbb696] mb-1">
                      Mẫu câu chào mừng Phật tử mới ({'{username}'})
                    </label>
                    <input
                      type="text"
                      value={voiceSettings.welcomeTemplate}
                      onChange={(e) =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          welcomeTemplate: e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-[#0b0604] border border-white/15 text-xs text-[#fff6e5]"
                    />
                  </div>
                )}

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#e6d5b8]">
                    Đọc lời chúc bình an mỗi 120s khi hàng đợi rảnh
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.backgroundNarrationEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        backgroundNarrationEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[#cbb696]">Chu kỳ lời chúc nền (giây)</span>
                  <input
                    type="number"
                    min={30}
                    max={600}
                    value={voiceSettings.backgroundIntervalSec}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        backgroundIntervalSec: Math.max(30, Number(e.target.value) || 120),
                      })
                    }
                    className="w-20 px-2.5 py-1 rounded bg-[#0b0604] border border-white/15 font-mono-tabular text-right text-[#fff4dc]"
                  />
                </div>

                <label className="flex items-center justify-between cursor-pointer pt-1">
                  <span className="text-[#cbb696]">Biến thiên lời chúc bằng AI (Gemini)</span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.useAiPeacefulMessages}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        useAiPeacefulMessages: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>
              </div>

              {/* Custom Peaceful Narration Messages */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <span className="block font-medium text-[#e6d5b8]">
                  Danh sách câu chúc bình an ({voiceSettings.customPeacefulMessages.length})
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPeacefulMsg}
                    onChange={(e) => setNewPeacefulMsg(e.target.value)}
                    placeholder="Thêm câu chúc bình an mới..."
                    className="flex-1 px-3 py-1.5 rounded bg-[#0b0604] border border-white/15 text-xs text-[#fff6e5]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = newPeacefulMsg.trim();
                      if (!clean) return;
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        customPeacefulMessages: [...voiceSettings.customPeacefulMessages, clean],
                      });
                      setNewPeacefulMsg('');
                    }}
                    className="px-3 py-1.5 rounded bg-[#26160c] hover:bg-[#362012] border border-[#d4af37]/35 text-xs text-[#ffe082] whitespace-nowrap cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================================================
            5. CHARACTERS & SEATING TAB
           ========================================================================== */}
        {activeTab === 'characters' && (
          <div className="space-y-5">
            <div className="space-y-2.5 text-xs">
              <h3 className="text-sm font-semibold text-[#ffe082]">
                Quản Lý Phật Tử &amp; Sơ Đồ 200 Đệm Lễ Phật
              </h3>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Số nhân vật 3D đang hiển thị</span>
                <span className="font-mono-tabular font-semibold text-[#ffe082]">
                  {participantsCount}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Đệm ngồi chính đã lấp đầy</span>
                <span className="font-mono-tabular text-[#f5ead6]">
                  {occupiedMainSeats} / {TOTAL_MAIN_MATS}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Khu vực mở rộng / Hàng chờ</span>
                <span className="font-mono-tabular text-[#f5ead6]">{waitingOverflowCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Tổng lượt thích / Tổng tiếng mõ</span>
                <span className="font-mono-tabular text-[#ffd978]">
                  ❤️ {totalLikesCount.toLocaleString('vi-VN')} · 🥁{' '}
                  {totalWoodenFishCount.toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between text-xs">
                <label className="text-[#cbb696]">Giới hạn nhân vật hiển thị đồng thời</label>
                <span className="font-mono-tabular text-[#ffe082]">
                  {overlaySettings.maxParticipants}
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={250}
                step={10}
                value={overlaySettings.maxParticipants}
                onChange={(e) =>
                  onUpdateOverlaySettings({
                    ...overlaySettings,
                    maxParticipants: Number(e.target.value),
                  })
                }
                className="w-full accent-[#d4af37]"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="block text-xs text-[#cbb696]">
                Mức đồ họa 3D (Tối ưu mượt cho phát trực tiếp dài giờ)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as QualityPreset[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        quality: q,
                      })
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      overlaySettings.quality === q
                        ? 'bg-[#d4af37] text-[#180d06] border-[#d4af37] font-semibold'
                        : 'bg-[#1c1009] text-[#cbb696] border-white/10 hover:text-white'
                    }`}
                  >
                    {q === 'low' ? 'Thấp (Mượt)' : q === 'medium' ? 'Trung bình' : 'Cao (Đẹp)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onResetSeating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#26160c] hover:bg-[#362012] border border-[#d4af37]/35 text-xs font-medium text-[#f5ead6] transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#ffe082]" />
                <span>Sắp xếp lại chỗ ngồi</span>
              </button>

              <button
                type="button"
                onClick={onClearParticipants}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3c1515] hover:bg-[#521d1d] border border-red-400/30 text-xs font-medium text-red-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ Phật tử</span>
              </button>
            </div>
          </div>
        )}

        {/* ==========================================================================
            6. STREAMING / OBS SETTINGS TAB
           ========================================================================== */}
        {activeTab === 'streaming' && (
          <div className="space-y-5 text-xs">
            <div>
              <h3 className="text-sm font-semibold text-[#ffe082]">
                Cấu Hình Giao Diện TikTok LIVE (9:16) &amp; OBS
              </h3>
              <p className="text-xs text-[#b8a285] mt-1 leading-relaxed">
                Bố cục chuẩn 1080×1920 giữ tôn tượng Đức Phật Vàng hoàn toàn thông thoáng ở trung tâm, hai bảng nằm gọn góc trên trái/phải.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdateOverlaySettings({
                  ...overlaySettings,
                  obsCleanView: true,
                })
              }
              className="w-full py-2.5 px-4 rounded-lg bg-[#d4af37] hover:bg-[#e5c14b] text-[#180d06] font-semibold transition-colors cursor-pointer"
            >
              Mở Chế Độ Toàn Màn Hình OBS (Ẩn Quản Trị)
            </button>

            <div className="space-y-3 pt-2 border-t border-white/10">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#e6d5b8]">Khung dọc chuẩn TikTok 9:16 (1080×1920)</span>
                <input
                  type="checkbox"
                  checked={overlaySettings.vertical916}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      vertical916: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#ffe082] font-medium">
                  Hiển thị bảng &ldquo;🪷 Cúng Dường Cầu An&rdquo; (Góc trên phải)
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showGiftPanel}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showGiftPanel: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#ffe082] font-medium">
                  Hiển thị &ldquo;Bảng Công Đức&rdquo; (Góc trên trái · Top 4 + Cuộn)
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showLeaderboard}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showLeaderboard: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#e6d5b8]">
                  Hiển thị khung Hoa Sen Avatar khi Phật tử hành lễ
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showLotusAvatars}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showLotusAvatars: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#e6d5b8]">
                  Hiển thị Thanh Hướng Dẫn &ldquo;❤️ LIKE: GÕ MÕ&rdquo; &amp; Bộ Đếm
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showEventBar}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showEventBar: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#e6d5b8]">Hiển thị bong bóng bình luận 5 giây</span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showCommentBubbles}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showCommentBubbles: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#e6d5b8]">Hiển thị luồng thông báo góc dưới trái</span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showNotifications}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showNotifications: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#e6d5b8]">Hiển thị tên tài khoản trên đầu nhân vật</span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showUsernames}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showUsernames: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>
            </div>

            <div className="rounded-xl bg-[#1b0b0e] border border-[#d4af37]/25 p-3.5 space-y-1.5 text-[#cbb696]">
              <p className="font-semibold text-[#ffe082]">Mẹo quay OBS Browser Source:</p>
              <p>
                Thêm tham số <code className="text-[#fff4dc]">?obs=1</code> vào cuối URL với kích
                thước{' '}
                <span className="font-mono-tabular text-[#fff4dc]">Width: 1080, Height: 1920</span>{' '}
                để mở thẳng khung phát trực tiếp sạch.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
