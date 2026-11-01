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
  Clock,
  LogOut,
  MessageSquareHeart,
  Trophy,
  Save,
  Sliders,
  Camera,
  Image as ImageIcon,
  Grid,
} from 'lucide-react';
import {
  BuddhaModelLoadStatus,
  CURATED_VIENEU_VOICES,
  ConnectionStatus,
  DEFAULT_COMMENT_VOICE_FORMULA,
  DEFAULT_SCENE_CALIBRATION,
  GiftCalculationLogEntry,
  GiftCeremonyQueueItemSnapshot,
  GiftInterruptPolicy,
  GiftMapping,
  MeritLedgerEntry,
  QualityPreset,
  SceneCalibrationSettings,
  ServerConnectionSnapshot,
  StreamOverlaySettings,
  TTSProviderType,
  TikTokNormalizedEvent,
  VieNeuMode,
  VieNeuVoiceOption,
  VoiceSettings,
  buildSortedOfferingItems,
} from '../../types/temple';
import { GiftRegistrySnapshot } from '../../systems/GiftRegistry';
import {
  VoiceStateSnapshot,
  formatCommentSpeechFormula,
  voiceManager,
} from '../../systems/VoiceManager';
import {
  PRIMARY_DEMO_VIEWER,
  PrayerDemoTopic,
  buildSacredAvatarDataUri,
} from '../../systems/DemoEventManager';
import { TOTAL_MAIN_MATS } from '../../systems/SeatManager';
import {
  savePersistedOverlaySettings,
  savePersistedVoiceSettings,
} from '../../systems/OverlayTheme';
import { GiftVisualIcon } from './BuddhistGiftPanel';
import { GiftManagementPanel } from './GiftManagementPanel';
import { GiftSimulatorPanel } from './GiftSimulatorPanel';
import { XinXamManagementPanel } from './XinXamManagementPanel';
import { XinXamRegistrySnapshot } from '../../systems/XinXamRegistry';

import { savePersistedSceneCalibration } from '../../systems/SceneCalibration';

type AdminTab =
  | 'demo'
  | 'background'
  | 'xinxam'
  | 'tiktok'
  | 'characters'
  | 'gifts'
  | 'voice'
  | 'streaming';

interface AdminDashboardProps {
  connectionSnapshot: ServerConnectionSnapshot;
  registrySnapshot: GiftRegistrySnapshot;
  xinXamSnapshot: XinXamRegistrySnapshot;
  leaderboard: MeritLedgerEntry[];
  ceremonyQueueInspector: GiftCeremonyQueueItemSnapshot[];
  recentGiftLogs: GiftCalculationLogEntry[];
  participantsCount: number;
  departingCount: number;
  sessionMeritUsersCount: number;
  departedUsersCount: number;
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
  sceneCalibration?: SceneCalibrationSettings;
  buddhaModelStatus: BuddhaModelLoadStatus;
  buddhaModelDetail: string;
  onConnectTikTok: (username: string) => Promise<void>;
  onDisconnectTikTok: () => Promise<void>;
  onSimulateFirstComment: () => void;
  onSimulateLikeMilestone: (likes: 10 | 100 | 1000) => void;
  onSimulateGiftMapping: (mapping: GiftMapping) => void;
  onSimulateFollowIncense: () => void;
  onSimulateShareLantern: () => void;
  onSimulatePrayerComment: () => void;
  onSimulatePrayerTopic: (topic: PrayerDemoTopic) => void;
  onSimulateOrdinaryComment: () => void;
  onTestGiftPriorityVoice: () => void;
  onPopulateLeaderboardDemo: () => void;
  onAddParticipantsBatch: (count: number) => void;
  onManualRemoveInactive: () => number;
  onCustomSimulatedEvent: (ev: TikTokNormalizedEvent) => void;
  onResetDemo: () => void;
  onClearParticipants: () => void;
  onResetSeating: () => void;
  onUpdateGiftMappings: (mappings: GiftMapping[]) => void;
  onUpdateVoiceSettings: (settings: VoiceSettings) => void;
  onTestVoice: (sampleText?: string) => void;
  onClearVoiceQueue: () => void;
  onEnableAudio: () => void;
  onUpdateOverlaySettings: (settings: StreamOverlaySettings) => void;
  onUpdateSceneCalibration?: (settings: SceneCalibrationSettings) => void;
  onResetSceneCalibration?: () => void;
  onTriggerDemoXinXam: (options?: { username?: string; forcedFortuneNumber?: number }) => void;
  onTriggerQueueDemoXinXam: () => void;
  onDrawRandomFortune: () => void;
  onPreviewFortuneResult?: (options?: { username?: string; forcedFortuneNumber?: number }) => void;
  onTriggerXinXamEffects: () => void;
  onPreviewXinXamVoice: (sampleText: string) => void;
}

export function AdminDashboard({
  connectionSnapshot,
  registrySnapshot,
  xinXamSnapshot,
  leaderboard,
  ceremonyQueueInspector,
  recentGiftLogs,
  participantsCount,
  departingCount,
  sessionMeritUsersCount,
  departedUsersCount,
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
  sceneCalibration = DEFAULT_SCENE_CALIBRATION,
  buddhaModelStatus,
  buddhaModelDetail,
  onConnectTikTok,
  onDisconnectTikTok,
  onSimulateFirstComment,
  onSimulateLikeMilestone,
  onSimulateGiftMapping,
  onSimulateFollowIncense,
  onSimulateShareLantern,
  onSimulatePrayerComment: _onSimulatePrayerComment,
  onSimulatePrayerTopic,
  onSimulateOrdinaryComment,
  onTestGiftPriorityVoice,
  onPopulateLeaderboardDemo,
  onAddParticipantsBatch,
  onManualRemoveInactive,
  onCustomSimulatedEvent,
  onResetDemo,
  onClearParticipants,
  onResetSeating,
  onUpdateGiftMappings: _onUpdateGiftMappings,
  onUpdateVoiceSettings,
  onTestVoice,
  onClearVoiceQueue,
  onEnableAudio,
  onUpdateOverlaySettings,
  onUpdateSceneCalibration,
  onResetSceneCalibration,
  onTriggerDemoXinXam,
  onTriggerQueueDemoXinXam,
  onDrawRandomFortune,
  onPreviewFortuneResult,
  onTriggerXinXamEffects,
  onPreviewXinXamVoice,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('demo');
  const [simulatorGiftId, setSimulatorGiftId] = useState<string | undefined>(undefined);
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

  // Custom event tester, Comment Voice Formula preview & Buddha model input state
  const [customUsername, setCustomUsername] = useState('phattu.anlac');
  const [customComment, setCustomComment] = useState('Con cầu cho mẹ luôn mạnh khỏe');
  const [formulaPreviewUsername, setFormulaPreviewUsername] = useState('Minh Anh');
  const [formulaPreviewComment, setFormulaPreviewComment] = useState(
    'Con cầu cho mẹ luôn mạnh khỏe',
  );
  const [voiceSavedBanner, setVoiceSavedBanner] = useState<string | null>(null);
  const [overlaySavedBanner, setOverlaySavedBanner] = useState<string | null>(null);
  const [calibrationSavedBanner, setCalibrationSavedBanner] = useState<string | null>(null);
  const [newPeacefulMsg, setNewPeacefulMsg] = useState('');
  const [buddhaUrlDraft, setBuddhaUrlDraft] = useState(overlaySettings.buddhaModelUrl || '');
  const [manualDepartFeedback, setManualDepartFeedback] = useState<string | null>(null);

  useEffect(() => {
    setBuddhaUrlDraft(overlaySettings.buddhaModelUrl || '');
  }, [overlaySettings.buddhaModelUrl]);

  const commentFormulaPreview = formatCommentSpeechFormula(
    voiceSettings.commentVoiceFormula,
    formulaPreviewUsername,
    formulaPreviewComment,
    {
      maxCommentLength: voiceSettings.maxCommentLength,
      blockSpamLinksAndUnsafe: voiceSettings.blockSpamLinksAndUnsafe,
    },
  );

  const handleSaveCommentFormulaSettings = () => {
    savePersistedVoiceSettings(voiceSettings);
    onUpdateVoiceSettings({ ...voiceSettings });
    setVoiceSavedBanner('Đã lưu cài đặt CÔNG THỨC ĐỌC BÌNH LUẬN.');
    window.setTimeout(() => setVoiceSavedBanner(null), 3200);
  };

  const handleSaveOverlayStyleSettings = () => {
    savePersistedOverlaySettings(overlaySettings);
    onUpdateOverlaySettings({ ...overlaySettings });
    setOverlaySavedBanner('Đã lưu kích thước và độ trong suốt RGBA của các bảng hiển thị.');
    window.setTimeout(() => setOverlaySavedBanner(null), 3200);
  };

  const updateCal = (patch: Partial<SceneCalibrationSettings>) => {
    const next: SceneCalibrationSettings = {
      ...sceneCalibration,
      ...patch,
    };
    onUpdateSceneCalibration?.(next);
  };

  const handleSaveCalibrationClick = () => {
    savePersistedSceneCalibration(sceneCalibration);
    onUpdateSceneCalibration?.({ ...sceneCalibration });
    setCalibrationSavedBanner('Đã lưu vĩnh viễn cấu hình NỀN & CAMERA (3D Calibration).');
    window.setTimeout(() => setCalibrationSavedBanner(null), 3200);
  };

  const handleResetCalibrationClick = () => {
    onResetSceneCalibration?.();
    setCalibrationSavedBanner('Đã đặt lại căn chỉnh phối cảnh về chuẩn gốc 9:16.');
    window.setTimeout(() => setCalibrationSavedBanner(null), 3200);
  };

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

  const handleManualRemoveClick = () => {
    const removed = onManualRemoveInactive();
    setManualDepartFeedback(
      removed > 0
        ? `Đã mời ${removed} Phật tử không tương tác đứng dậy cúi chào và rời chánh điện.`
        : 'Hiện chưa có Phật tử nào rảnh để rời điện (hoặc đang hành lễ).',
    );
    window.setTimeout(() => setManualDepartFeedback(null), 4000);
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

  const handleInstantNormalCeremonyDemo = () => {
    const normalGift =
      giftMappings.find((g) => g.enabled && g.giftId === '5655') ||
      giftMappings.find((g) => g.enabled && !g.isLarge) ||
      giftMappings[0];
    if (normalGift) {
      onSimulateGiftMapping(normalGift);
    }
  };

  const handleInstantMajorCeremonyDemo = () => {
    const majorGift =
      giftMappings.find((g) => g.enabled && g.giftId === '29201') ||
      giftMappings.find((g) => g.enabled && g.giftId === '5827') ||
      giftMappings.find((g) => g.enabled && g.isLarge) ||
      giftMappings[giftMappings.length - 1];
    if (majorGift) {
      onSimulateGiftMapping(majorGift);
    }
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

  const effectiveTimeoutDisplay = overlaySettings.demoAcceleratedTimeout
    ? 12
    : overlaySettings.inactivityTimeoutSec;

  const unknownCount = registrySnapshot.unknownGifts.length;

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    [
      { id: 'demo', label: 'Demo Lễ', icon: Play },
      { id: 'background', label: 'Nền & Camera', icon: Camera },
      { id: 'xinxam', label: 'Xin Xăm (100)', icon: Sparkles },
      {
        id: 'gifts',
        label: unknownCount > 0 ? `Quà TikTok (${unknownCount})` : 'Quà TikTok',
        icon: Gift,
      },
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
      <div className="px-4 py-2.5 border-b border-[#d4af37]/25 bg-gradient-to-b from-[#290b10] to-[#150809] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-[#ffe082] truncate">
            QUẢN TRỊ &amp; DEMO · CHÙA ONLINE
          </h2>
          <p className="text-[11px] text-[#cbb696] mt-0.5 truncate">
            Hiện diện:{' '}
            <span className="font-mono-tabular text-[#fff4dc]">{participantsCount}</span> · Đệm:{' '}
            <span className="font-mono-tabular text-[#fff4dc]">
              {occupiedMainSeats}/{TOTAL_MAIN_MATS}
            </span>{' '}
            · Hết hạn:{' '}
            <span className="font-mono-tabular text-[#ffe082]">
              {overlaySettings.inactivityTimeoutEnabled ? `${effectiveTimeoutDisplay}s` : 'Tắt'}
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
            1. DEMO CEREMONIES, GIFT SIMULATOR ("GIẢ LẬP QUÀ TẶNG") & TIMEOUT TESTS
           ========================================================================== */}
        {activeTab === 'demo' && (
          <div className="space-y-5">
            {/* Instant Normal & Major Ceremonial Presentation Demo Card + Lotus Controls */}
            <div className="rounded-xl bg-gradient-to-b from-[#340c14] to-[#19070b] border border-[#f5cd63]/55 p-3.5 space-y-3 shadow-md">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Flower2 className="w-4 h-4 text-[#ffd978] shrink-0" />
                  <h3 className="font-display text-sm font-bold tracking-wide text-[#ffe494] truncate">
                    TEST NGAY MƯA HOA SEN &amp; BẢNG NGHI LỄ TRUNG TÂM
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#140508] border border-[#d4af37]/40 text-[10px] font-semibold text-[#ffe082] shrink-0">
                  60fps · 0 từ quà
                </span>
              </div>

              <p className="text-[11px] text-[#d8c4a6] leading-relaxed">
                Kiểm tra tức thì hiệu ứng hoa sen, cánh sen, lá sen rơi phân lớp cùng bảng thông báo nghi lễ trung tâm (kèm avatar tròn của Phật tử) và hàng đợi giọng đọc ưu tiên.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleInstantNormalCeremonyDemo}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#2e0f16] hover:bg-[#411520] border border-[#d4af37]/55 text-xs font-semibold text-[#fff3da] transition-colors cursor-pointer"
                >
                  <span>🌸 Test Nghi Lễ Thường</span>
                </button>

                <button
                  type="button"
                  onClick={handleInstantMajorCeremonyDemo}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f2ce68] hover:brightness-105 text-[#1a0c05] text-xs font-bold shadow transition-all cursor-pointer"
                >
                  <span>🪷 Test Đại Lễ Lớn</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onTestGiftPriorityVoice}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#240b10] hover:bg-[#351018] border border-[#f5cd63]/45 text-[11px] font-semibold text-[#ffe394] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Test Hàng Đợi Ưu Tiên: Đại Lễ &gt; Xin Xăm &gt; Lễ Thường &gt; Bình Luận</span>
              </button>

              {/* Quick 4-Button Xin Xăm Cầu Nguyện Demo Strip */}
              <div className="pt-2 border-t border-[#d4af37]/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#ffe89e]">
                    🪷 Xin Xăm Cầu Nguyện (100 Quẻ · Bàn Xăm 3D Riêng)
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('xinxam')}
                    className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
                  >
                    Quản lý 100 quẻ →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onTriggerDemoXinXam()}
                    className="px-2 py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f4cf65] text-[#1a0b05] text-[11px] font-bold cursor-pointer"
                  >
                    THỬ XIN XĂM
                  </button>
                  <button
                    type="button"
                    onClick={onDrawRandomFortune}
                    className="px-2 py-1.5 rounded-lg bg-[#2a0d14] hover:bg-[#3c131d] border border-[#d4af37]/45 text-[11px] font-semibold text-[#fff3da] cursor-pointer"
                  >
                    RÚT QUẺ NGẪU NHIÊN
                  </button>
                  <button
                    type="button"
                    onClick={onTriggerXinXamEffects}
                    className="px-2 py-1.5 rounded-lg bg-[#240b10] hover:bg-[#351018] border border-[#d4af37]/35 text-[11px] text-[#ffe8a6] cursor-pointer"
                  >
                    THỬ HIỆU ỨNG
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewXinXamVoice(
                        'Phật tử Minh Anh xin được xăm số mười tám, thuộc loại Trung Cát. Gia đạo an hòa. Gia đình có thể đón nhận những điều thuận lợi khi mọi người biết quan tâm và chia sẻ. Hãy giữ lòng từ bi và sống hòa thuận.',
                      )
                    }
                    className="px-2 py-1.5 rounded-lg bg-[#240b10] hover:bg-[#351018] border border-[#d4af37]/35 text-[11px] text-[#ffe8a6] cursor-pointer"
                  >
                    THỬ GIỌNG ĐỌC
                  </button>
                </div>
              </div>

              {/* Quick Lotus Shower & Center Panel Controls inside QUẢN TRỊ & DEMO */}
              <div className="pt-2 border-t border-[#d4af37]/25 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[#cbb696]">Mật độ sen rơi</span>
                      <span className="font-mono-tabular text-[#ffe082]">
                        {(overlaySettings.lotusParticleDensity ?? 1.15).toFixed(2)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={2.5}
                      step={0.05}
                      value={overlaySettings.lotusParticleDensity ?? 1.15}
                      onChange={(e) =>
                        onUpdateOverlaySettings({
                          ...overlaySettings,
                          lotusParticleDensity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#d4af37]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[#cbb696]">Thời lượng bảng giữa</span>
                      <span className="font-mono-tabular text-[#ffe082]">
                        {((overlaySettings.centerPanelDuration ?? 3400) / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1200}
                      max={10000}
                      step={200}
                      value={overlaySettings.centerPanelDuration ?? 3400}
                      onChange={(e) =>
                        onUpdateOverlaySettings({
                          ...overlaySettings,
                          centerPanelDuration: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#d4af37]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[#cbb696]">Cánh &amp; hoa sen</span>
                      <span className="font-mono-tabular text-[#ffe082]">
                        {overlaySettings.petalCount ?? 44}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={120}
                      step={2}
                      value={overlaySettings.petalCount ?? 44}
                      onChange={(e) =>
                        onUpdateOverlaySettings({
                          ...overlaySettings,
                          petalCount: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#d4af37]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[#cbb696]">Lá sen rơi</span>
                      <span className="font-mono-tabular text-[#ffe082]">
                        {overlaySettings.leafCount ?? 16}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={60}
                      step={1}
                      value={overlaySettings.leafCount ?? 16}
                      onChange={(e) =>
                        onUpdateOverlaySettings({
                          ...overlaySettings,
                          leafCount: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#d4af37]"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between pt-1 cursor-pointer">
                  <span className="text-[#e6d5b8]">
                    Hiện avatar tròn của Phật tử trong bảng nghi lễ trung tâm
                  </span>
                  <input
                    type="checkbox"
                    checked={overlaySettings.showAvatarInCenterPanel !== false}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        showAvatarInCenterPanel: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>
              </div>
            </div>

            {/* Dynamic Gift Simulator Panel ("GIẢ LẬP QUÀ TẶNG") */}
            <GiftSimulatorPanel
              gifts={giftMappings}
              selectedGiftId={simulatorGiftId}
              leaderboard={leaderboard}
              ceremonyQueueInspector={ceremonyQueueInspector}
              recentGiftLogs={recentGiftLogs}
              onDispatchDemoEvent={onCustomSimulatedEvent}
            />

            {/* Section 1: Configured Ceremonial Buddhist Offerings ("🪷 CÚNG DƯỜNG CẦU AN") */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#ffe082]">
                  01. Nhấn Nhanh Nghi Lễ &ldquo;🪷 CÚNG DƯỜNG CẦU AN&rdquo;
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('gifts')}
                  className="text-[11px] text-[#ffe28a] hover:underline cursor-pointer"
                >
                  Quản lý quà ({giftMappings.length}) →
                </button>
              </div>
              <p className="text-xs text-[#b8a285] mt-1 leading-relaxed">
                Nhấn để Phật tử @{PRIMARY_DEMO_VIEWER.username} đứng dậy rời đệm, tiến lên bàn thờ thực hiện nghi lễ và phát giọng đọc VieNeu ưu tiên cao nhất.
              </p>

              <div className="grid grid-cols-1 gap-1.5 mt-2.5">
                {buildSortedOfferingItems(giftMappings, xinXamSnapshot.settings).map((item) => {
                  const isXinXam = item.kind === 'xin_xam';
                  const liveCount = isXinXam
                    ? (giftEventCounts['xin_xam'] ??
                      (item.giftId ? giftEventCounts[item.giftId] : 0) ??
                      0)
                    : (giftEventCounts[item.giftId] ?? giftEventCounts[item.id] ?? 0);
                  const gm = item.giftMapping;
                  const meritPts = isXinXam ? xinXamSnapshot.settings.meritPoints : (gm?.points ?? 0);
                  const isGrand = Boolean(
                    gm &&
                      (gm.ritualType === 'altar_pagoda' ||
                        gm.ritualType === 'altar_grand_ceremony' ||
                        gm.isLarge),
                  );
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (isXinXam) {
                          onTriggerDemoXinXam();
                        } else if (gm) {
                          onSimulateGiftMapping(gm);
                        }
                      }}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        isGrand
                          ? 'bg-gradient-to-r from-[#46111b] to-[#2b0c12] hover:from-[#571622] hover:to-[#381018] border-[#f5cd63]/65 text-[#fff4d8]'
                          : 'bg-[#260d12] hover:bg-[#351219] border-[#d4af37]/40 text-[#fff4dc]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GiftVisualIcon
                          gift={{
                            iconType: item.iconType,
                            iconUrl: item.iconUrl,
                            uploadedImageData: item.uploadedImageData,
                            vietnameseLabel: item.vietnameseLabel,
                          }}
                          sizeClass="w-4 h-4"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#ffe394] whitespace-normal break-words">
                            {item.ceremonyTitle} – {item.vietnameseLabel} –{' '}
                            <span className="font-mono-tabular">{item.referenceCoins} xu</span>
                          </p>
                          <p className="text-[10.5px] text-[#ccb79a] whitespace-normal break-words">
                            {isXinXam
                              ? `ID: ${item.giftId || 'Chưa gắn (20 xu tham chiếu)'} · +${meritPts} công đức`
                              : `ID: ${item.giftId} · +${meritPts} công đức · ${gm?.badgeCeremonyLabel || item.ceremonyTitle}`}
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

            {/* Section 2: VieNeu Comment Narration & Gift-First Priority Testing */}
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#ffe082] flex items-center gap-1.5">
                  <MessageSquareHeart className="w-4 h-4 text-[#ff9ec7]" />
                  <span>02. Bong Bóng Bình Luận &amp; Giọng Đọc Nguyên Bản</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('voice')}
                  className="text-[11px] text-[#ffe28a] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Công thức đọc →
                </button>
              </div>
              <p className="text-xs text-[#b8a285] leading-relaxed">
                Bong bóng 5 giây chỉ hiển thị nội dung bình luận gốc trên đầu nhân vật (không kèm tên hay avatar). VieNeu đọc nguyên văn theo công thức quản trị và luôn ưu tiên Quà tặng trước.
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['binh_an', 'Cầu Bình An'],
                    ['suc_khoe', 'Cầu Sức Khỏe'],
                    ['tai_loc', 'Cầu Tài Lộc'],
                    ['gia_dao', 'Cầu Gia Đạo'],
                    ['tinh_duyen', 'Cầu Tình Duyên'],
                    ['hoc_hanh', 'Cầu Học Hành'],
                  ] as [PrayerDemoTopic, string][]
                ).map(([topicKey, label]) => (
                  <button
                    key={topicKey}
                    type="button"
                    onClick={() => onSimulatePrayerTopic(topicKey)}
                    className="px-2 py-1.5 rounded-lg bg-[#24120c] hover:bg-[#341a11] border border-[#d4af37]/35 text-[11px] font-medium text-[#fff4dc] transition-colors cursor-pointer truncate"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onSimulateOrdinaryComment}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#20130e] hover:bg-[#2f1c15] border border-white/15 text-xs font-medium text-[#f5ead6] transition-colors cursor-pointer"
                >
                  <span>Bình luận thường</span>
                </button>

                <button
                  type="button"
                  onClick={onTestGiftPriorityVoice}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-gradient-to-r from-[#4b121c] to-[#2e0b12] hover:from-[#5e1724] hover:to-[#3b0e17] border border-[#f5cd63]/70 text-xs font-semibold text-[#ffe699] transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Test Ưu Tiên Quà &gt; Bình Luận</span>
                </button>
              </div>
            </div>

            {/* Section 3: Interactive LIKE = GÕ MÕ System */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-[#ffe082]">
                03. Hệ Thống &ldquo;❤️ LIKE = GÕ MÕ&rdquo; (Làm Mới Hẹn Giờ 120s)
              </h3>
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => onSimulateLikeMilestone(10)}
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-[#260f13] hover:bg-[#36151b] border border-[#d4af37]/40 text-xs font-semibold text-[#fff3da] transition-colors cursor-pointer"
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
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-[#301217] hover:bg-[#421920] border border-[#e5bd5a]/50 text-xs font-semibold text-[#ffe59e] transition-colors cursor-pointer"
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
                  className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg bg-gradient-to-b from-[#4f131e] to-[#2e0b12] hover:from-[#631826] hover:to-[#3b0e17] border border-[#f5cd63]/75 text-xs font-bold text-[#ffe699] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1 text-[#ffd978]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-mono-tabular">+1000 Likes</span>
                  </span>
                  <span className="text-[10px] font-normal text-[#f7e2bc]">6 tiếng + VieNeu</span>
                </button>
              </div>
            </div>

            {/* Section 4: 120s Inactivity Timeout, 200-Seat 9:16 Frame & Compact Leaderboard Tests */}
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#ffe082] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#ffe082]" />
                  <span>04. Kiểm Thử Hết Hạn 120s, 200 Đệm 9:16 &amp; Top Công Đức</span>
                </h3>
              </div>

              <label className="flex items-center justify-between gap-2 rounded-lg bg-[#1d0c0f] border border-[#d4af37]/35 px-3 py-2 text-xs cursor-pointer">
                <div>
                  <p className="font-semibold text-[#ffe49e]">
                    Tăng tốc hết hạn 12 giây (Chỉ để test Demo)
                  </p>
                  <p className="text-[10.5px] text-[#b8a285]">
                    Mặc định sản xuất luôn giữ chuẩn <span className="font-mono-tabular">120s</span> (2 phút).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={overlaySettings.demoAcceleratedTimeout}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      demoAcceleratedTimeout: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37] w-4 h-4 shrink-0"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onSimulateFirstComment}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-[#f7d57c] shrink-0" />
                  <span className="truncate">Vào đệm / Quay lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualRemoveClick}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#2b1015] hover:bg-[#3c161d] border border-[#d4af37]/40 text-xs font-medium text-[#ffe39c] transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Mời rời điện ngay</span>
                </button>

                <button
                  type="button"
                  onClick={onPopulateLeaderboardDemo}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-[#ffd978] shrink-0" />
                  <span className="truncate">Tạo 8 Hạng Công Đức</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onAddParticipantsBatch(Math.max(10, TOTAL_MAIN_MATS - occupiedMainSeats))
                  }
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-[#9bc4ff] shrink-0" />
                  <span className="truncate">Lấp đầy {TOTAL_MAIN_MATS} Đệm Chính</span>
                </button>

                <button
                  type="button"
                  onClick={onSimulateFollowIncense}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-[#ffb86b] shrink-0" />
                  <span className="truncate">Follow → Thắp hương</span>
                </button>

                <button
                  type="button"
                  onClick={onSimulateShareLantern}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#24120c] hover:bg-[#331a11] border border-[#d4af37]/35 text-xs font-medium text-[#fff4dc] transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#ffd27d] shrink-0" />
                  <span className="truncate">Share → Hoa đăng</span>
                </button>
              </div>

              {manualDepartFeedback && (
                <p className="text-[11px] text-[#ffe28a] bg-[#240d12] border border-[#d4af37]/35 rounded-lg px-3 py-1.5">
                  {manualDepartFeedback}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onAddParticipantsBatch(10)}
                  className="px-3 py-1.5 rounded-lg bg-[#22130d] hover:bg-[#311c13] border border-white/15 text-xs font-medium text-[#f5ead6] transition-colors whitespace-nowrap cursor-pointer"
                >
                  + Thêm 10 Phật tử
                </button>
                <button
                  type="button"
                  onClick={() => onAddParticipantsBatch(50)}
                  className="px-3 py-1.5 rounded-lg bg-[#22130d] hover:bg-[#311c13] border border-white/15 text-xs font-medium text-[#f5ead6] transition-colors whitespace-nowrap cursor-pointer"
                >
                  + Thêm 50 Phật tử
                </button>
                <button
                  type="button"
                  onClick={onResetDemo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3d1316] hover:bg-[#521a1e] border border-red-400/35 text-xs font-medium text-red-200 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại Demo</span>
                </button>
              </div>
            </div>

            {/* Section 5: Custom User Event Sender */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-[#ffe082]">
                05. Giả Lập Tài Khoản Người Xem Tùy Chỉnh
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
                {giftMappings
                  .filter((gm) => gm.enabled)
                  .map((gm) => (
                    <button
                      key={gm.giftId || gm.id}
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
            1B. XIN XĂM MANAGEMENT TAB ("QUẢN LÝ XIN XĂM" - 100 FORTUNES)
           ========================================================================== */}
        {activeTab === 'xinxam' && (
          <XinXamManagementPanel
            xinXamSnapshot={xinXamSnapshot}
            giftMappings={giftMappings}
            giftEventCounts={giftEventCounts}
            overlaySettings={overlaySettings}
            onSimulateGiftMapping={onSimulateGiftMapping}
            onTriggerDemoXinXam={onTriggerDemoXinXam}
            onTriggerQueueDemoXinXam={onTriggerQueueDemoXinXam}
            onDrawRandomFortune={onDrawRandomFortune}
            onPreviewFortuneResult={onPreviewFortuneResult}
            onTriggerEffectsPreview={onTriggerXinXamEffects}
            onPreviewVoice={onPreviewXinXamVoice}
          />
        )}

        {/* ==========================================================================
            2. DYNAMIC TIKTOK GIFT MANAGEMENT TAB ("QUẢN LÝ QUÀ TẶNG TIKTOK")
           ========================================================================== */}
        {activeTab === 'gifts' && (
          <GiftManagementPanel
            registrySnapshot={registrySnapshot}
            giftEventCounts={giftEventCounts}
            overlaySettings={overlaySettings}
            onUpdateOverlaySettings={onUpdateOverlaySettings}
            onTestGiftInDemo={(gm, openSimTab) => {
              setSimulatorGiftId(gm.giftId);
              onSimulateGiftMapping(gm);
              if (openSimTab) {
                setActiveTab('demo');
              }
            }}
          />
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
            4. VOICE AI / VIENEU PRIMARY TTS + GIFT-FIRST PRIORITY + COMMENT VOICE
           ========================================================================== */}
        {activeTab === 'voice' && (
          <div className="space-y-5 text-xs">
            <div className="rounded-xl bg-[#1b0c0e] border border-[#d4af37]/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="w-4 h-4 text-[#ffe082] shrink-0" />
                  <span className="font-semibold text-[#ffe082] truncate">
                    Trạng Thái Voice API &amp; Hàng Đợi Ưu Tiên
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

                <div className="flex justify-between gap-2">
                  <span className="text-[#b8a285]">Đang phát / Hàng đợi ưu tiên:</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {voiceSnapshot.isSpeaking
                      ? `Mức ưu tiên #${voiceSnapshot.currentPriority ?? 1}`
                      : 'Đang rảnh'}{' '}
                    · Chờ: {voiceSnapshot.queueLength}
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
              </div>

              {voiceSnapshot.lastWarning && (
                <div className="rounded-lg bg-[#2e1412] border border-red-400/35 px-3 py-2 text-[11px] text-red-200 leading-relaxed">
                  <span className="font-semibold">Chi tiết lỗi TTS:</span> {voiceSnapshot.lastWarning}
                </div>
              )}
            </div>

            {/* ==========================================================================
                CÔNG THỨC ĐỌC BÌNH LUẬN (CUSTOM COMMENT VOICE FORMULA & QUEUE CONTROLS)
               ========================================================================== */}
            <div className="rounded-xl bg-gradient-to-b from-[#250c12] to-[#16080b] border border-[#d4af37]/45 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#ffe28a] tracking-wide">
                    CÔNG THỨC ĐỌC BÌNH LUẬN
                  </h3>
                  <p className="text-[10.5px] text-[#cbb696] mt-0.5">
                    VieNeuTTS đọc chính xác nguyên văn bình luận gốc của Phật tử — không tự ý tóm tắt hay thay thế.
                  </p>
                </div>

                <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0d0605] border border-[#d4af37]/35 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={voiceSettings.commentVoiceEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        commentVoiceEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37] w-3.5 h-3.5"
                  />
                  <span className="text-[11px] font-semibold text-[#ffe082]">
                    {voiceSettings.commentVoiceEnabled ? 'Đang bật' : 'Đã tắt'}
                  </span>
                </label>
              </div>

              {/* Editable Formula Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-medium text-[#e6d5b8]">
                    Mẫu công thức đọc (Hỗ trợ <code className="text-[#ffe082]">{'{username}'}</code> &amp;{' '}
                    <code className="text-[#ffe082]">{'{comment}'}</code>)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          commentVoiceFormula: `${voiceSettings.commentVoiceFormula} {username}`.trim(),
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-[#2c1218] hover:bg-[#3d1921] border border-[#d4af37]/30 text-[10px] text-[#ffe082] cursor-pointer"
                    >
                      + {'{username}'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          commentVoiceFormula: `${voiceSettings.commentVoiceFormula} {comment}`.trim(),
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-[#2c1218] hover:bg-[#3d1921] border border-[#d4af37]/30 text-[10px] text-[#ffe082] cursor-pointer"
                    >
                      + {'{comment}'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          commentVoiceFormula: DEFAULT_COMMENT_VOICE_FORMULA,
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-[#1f100b] hover:bg-[#2d1810] border border-white/15 text-[10px] text-[#cbb696] cursor-pointer"
                    >
                      Mặc định
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={voiceSettings.commentVoiceFormula}
                  onChange={(e) =>
                    onUpdateVoiceSettings({
                      ...voiceSettings,
                      commentVoiceFormula: e.target.value,
                    })
                  }
                  placeholder={DEFAULT_COMMENT_VOICE_FORMULA}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0604] border border-[#d4af37]/40 text-xs text-[#fff6e5] focus:outline-none focus:border-[#ffe082]"
                />
              </div>

              {/* Live Preview Showing Exact Text Sent to VieNeuTTS */}
              <div className="rounded-lg bg-[#0e0607] border border-[#d4af37]/30 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#ffe082]">
                    Xem Trước Trực Tiếp Nội Dung Gửi Tới VieNeuTTS
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFormulaPreviewUsername('Minh Anh');
                        setFormulaPreviewComment('Con cầu cho mẹ luôn mạnh khỏe');
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#241015] border border-[#d4af37]/25 text-[10px] text-[#e6d5b8] hover:text-[#ffe082] cursor-pointer"
                    >
                      Mẫu 1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormulaPreviewUsername('Hoàng Nam');
                        setFormulaPreviewComment('Nam mô A Di Đà Phật');
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#241015] border border-[#d4af37]/25 text-[10px] text-[#e6d5b8] hover:text-[#ffe082] cursor-pointer"
                    >
                      Mẫu 2
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="text"
                    value={formulaPreviewUsername}
                    onChange={(e) => setFormulaPreviewUsername(e.target.value)}
                    placeholder="Tên người xem"
                    className="col-span-1 px-2 py-1 rounded bg-[#080403] border border-white/10 text-[11px] text-[#fff6e5]"
                  />
                  <input
                    type="text"
                    value={formulaPreviewComment}
                    onChange={(e) => setFormulaPreviewComment(e.target.value)}
                    placeholder="Nội dung bình luận mẫu"
                    className="col-span-2 px-2 py-1 rounded bg-[#080403] border border-white/10 text-[11px] text-[#fff6e5]"
                  />
                </div>

                {commentFormulaPreview.allowed ? (
                  <div className="rounded bg-[#1b0b0f] border border-[#d4af37]/35 px-2.5 py-1.5">
                    <p className="text-[10px] text-[#b8a285] mb-0.5">Chuỗi đọc chính xác:</p>
                    <p className="font-display text-xs italic text-[#fff6df] leading-snug">
                      “{commentFormulaPreview.text}”
                    </p>
                  </div>
                ) : (
                  <div className="rounded bg-[#2b1111] border border-red-400/35 px-2.5 py-1.5 text-[11px] text-red-200">
                    Bình luận này sẽ được bỏ qua an toàn (không tự sửa chữ):{' '}
                    <strong>
                      {commentFormulaPreview.reason === 'exceeds_max_length'
                        ? `Vượt quá giới hạn ${voiceSettings.maxCommentLength} ký tự`
                        : commentFormulaPreview.reason === 'unsafe_or_spam'
                          ? 'Chứa đường dẫn / spam / từ khóa không phù hợp'
                          : 'Bình luận quá ngắn hoặc không chứa chữ cái'}
                    </strong>
                  </div>
                )}
              </div>

              {/* Volume, Cooldown, Max Length & Queue Settings */}
              <div className="space-y-2.5 pt-1">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-[#e6d5b8]">Âm lượng giọng đọc</span>
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

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10.5px] text-[#cbb696] mb-1">
                      Giãn cách giữa 2 bình luận (giây)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step={0.5}
                      value={voiceSettings.commentCooldownSec}
                      onChange={(e) =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          commentCooldownSec: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-2.5 py-1 rounded bg-[#0b0604] border border-white/15 font-mono-tabular text-[#fff4dc]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-[#cbb696] mb-1">
                      Giãn cách mỗi tài khoản (giây)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={120}
                      value={voiceSettings.perUserCommentCooldownSec}
                      onChange={(e) =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          perUserCommentCooldownSec: Math.max(2, Number(e.target.value) || 10),
                        })
                      }
                      className="w-full px-2.5 py-1 rounded bg-[#0b0604] border border-white/15 font-mono-tabular text-[#fff4dc]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-[#cbb696] mb-1">
                      Độ dài bình luận tối đa (ký tự)
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={220}
                      value={voiceSettings.maxCommentLength}
                      onChange={(e) =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          maxCommentLength: Math.max(20, Math.min(220, Number(e.target.value) || 90)),
                        })
                      }
                      className="w-full px-2.5 py-1 rounded bg-[#0b0604] border border-white/15 font-mono-tabular text-[#fff4dc]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-[#cbb696] mb-1">
                      Hàng đợi bình luận tối đa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={voiceSettings.maxCommentQueueSize}
                      onChange={(e) =>
                        onUpdateVoiceSettings({
                          ...voiceSettings,
                          maxCommentQueueSize: Math.max(
                            1,
                            Math.min(12, Number(e.target.value) || 5),
                          ),
                        })
                      }
                      className="w-full px-2.5 py-1 rounded bg-[#0b0604] border border-white/15 font-mono-tabular text-[#fff4dc]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#cbb696]">
                    Hủy bình luận chờ quá lâu (giây)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={voiceSettings.staleCommentTimeoutSec}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        staleCommentTimeoutSec: Math.max(5, Math.min(90, Number(e.target.value) || 20)),
                      })
                    }
                    className="w-20 px-2.5 py-1 rounded bg-[#0b0604] border border-white/15 font-mono-tabular text-right text-[#fff4dc]"
                  />
                </div>

                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[11px] text-[#e6d5b8]">
                    Bỏ qua bình luận chứa link, spam ký tự lặp hoặc từ ngữ nhạy cảm
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.blockSpamLinksAndUnsafe}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        blockSpamLinksAndUnsafe: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                <div className="pt-1 border-t border-white/10 space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#ffe082]">
                    Thứ Tự Hàng Đợi Ưu Tiên: Quà Lớn &gt; Quà Thường &gt; Nghi Lễ &gt; Bình Luận &gt; Lời Chúc Nền
                  </label>
                  <select
                    value={voiceSettings.giftInterruptPolicy}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        giftInterruptPolicy: e.target.value as GiftInterruptPolicy,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0b0604] border border-white/15 text-[11px] text-[#fff6e5]"
                  >
                    <option value="interrupt_comments">
                      Ngắt nhẹ bình luận đang đọc để phát Quà tặng ngay lập tức (Mặc định)
                    </option>
                    <option value="finish_current">
                      Đọc nốt câu hiện tại rồi phát toàn bộ Quà tặng trước các bình luận chờ
                    </option>
                  </select>
                </div>
              </div>

              {/* Test Voice & Save Settings Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onTestVoice(
                      commentFormulaPreview.allowed
                        ? commentFormulaPreview.text
                        : 'Phật tử Minh Anh gửi lời nguyện: Con cầu cho mẹ luôn mạnh khỏe',
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2a1419] hover:bg-[#3b1b22] border border-[#d4af37]/45 text-xs font-semibold text-[#ffe28a] transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Nghe thử câu xem trước</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCommentFormulaSettings}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e5c14b] text-[#180d06] text-xs font-bold transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu cài đặt</span>
                </button>
              </div>

              {voiceSavedBanner && (
                <p className="text-[11px] text-[#9ef0b4] bg-[#132918] border border-[#499e5b]/45 rounded-lg px-3 py-1.5">
                  {voiceSavedBanner}
                </p>
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
                  onClick={() => onTestVoice()}
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
                  <span className="text-[#ffe082] font-medium">
                    Đọc bình luận có lời cầu nguyện (theo Công Thức Đọc Bình Luận)
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.prayerAnnouncementsEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        prayerAnnouncementsEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#e6d5b8]">
                    Đọc cả bình luận thường hợp lệ (theo Công Thức Đọc Bình Luận)
                  </span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.commentAnnouncementsEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        commentAnnouncementsEnabled: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer pt-1">
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

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[#e6d5b8]">
                    Đùng giọng trình duyệt dự phòng khi VieNeu chưa sẵn sàng
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

                <div className="pt-2 border-t border-white/10">
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
            5. CHARACTERS, 200-SEAT 9:16 LAYOUT & 120-SECOND INACTIVITY TIMEOUT TAB
           ========================================================================== */}
        {activeTab === 'characters' && (
          <div className="space-y-5">
            <div className="space-y-2 text-xs">
              <h3 className="text-sm font-semibold text-[#ffe082]">
                Quản Lý Phật Tử, 200 Đệm Khung 9:16 &amp; Tự Động Rời Điện 120s
              </h3>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Phật tử đang hiện diện trong điện 3D</span>
                <span className="font-mono-tabular font-semibold text-[#ffe082]">
                  {participantsCount}
                  {departingCount > 0 ? ` (${departingCount} đang rời điện)` : ''}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Đệm ngồi chính trong khung 9:16</span>
                <span className="font-mono-tabular text-[#f5ead6]">
                  {occupiedMainSeats} / {TOTAL_MAIN_MATS}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Hàng chờ mở rộng (201+ tối ưu hiệu năng)</span>
                <span className="font-mono-tabular text-[#f5ead6]">{waitingOverflowCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Sổ Công Đức phiên LIVE (Bảo toàn khi rời)</span>
                <span className="font-mono-tabular text-[#98ebb0]">
                  {sessionMeritUsersCount} người (Đã rời: {departedUsersCount})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-[#b8a285]">Tổng lượt thích / Tổng tiếng mõ</span>
                <span className="font-mono-tabular text-[#ffd978]">
                  ❤️ {totalLikesCount.toLocaleString('vi-VN')} · 🥁{' '}
                  {totalWoodenFishCount.toLocaleString('vi-VN')}
                </span>
              </div>
            </div>

            {/* Required Inactivity Timeout Admin Configuration */}
            <div className="rounded-xl bg-[#1a0b0e] border border-[#d4af37]/30 p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#ffe082]">
                  Tự Động Cáo Lễ Rời Chánh Điện Sau 2 Phút (120 Giây)
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.inactivityTimeoutEnabled}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      inactivityTimeoutEnabled: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37] w-4 h-4"
                />
              </div>

              <p className="text-[11px] text-[#b8a285] leading-relaxed">
                Khi không gửi bình luận, quà, like, follow hoặc share trong 120s, nhân vật đứng dậy cúi chào Đức Phật, bước ra cửa chùa và nhường lại đệm ngồi (điểm Bảng Công Đức vẫn được giữ nguyên).
              </p>

              <div className="flex items-center justify-between gap-2">
                <label className="text-[#e6d5b8]">Thời gian chờ không tương tác (giây)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={15}
                    max={3600}
                    value={overlaySettings.inactivityTimeoutSec}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        inactivityTimeoutSec: Math.max(15, Number(e.target.value) || 120),
                      })
                    }
                    className="w-20 px-2.5 py-1 rounded bg-[#0b0604] border border-white/15 font-mono-tabular text-right text-[#ffe082]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        inactivityTimeoutSec: 120,
                        demoAcceleratedTimeout: false,
                      })
                    }
                    className="px-2 py-1 rounded bg-[#291318] hover:bg-[#3a1a22] border border-[#d4af37]/35 text-[10.5px] text-[#ffe082] cursor-pointer"
                  >
                    Chuẩn 120s
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 cursor-pointer">
                <span className="text-[#cbb696]">
                  Tăng tốc kiểm thử Demo (12s — không sửa cấu hình 120s)
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.demoAcceleratedTimeout}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      demoAcceleratedTimeout: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <button
                type="button"
                onClick={handleManualRemoveClick}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#2e1016] hover:bg-[#40161f] border border-[#d4af37]/45 text-xs font-semibold text-[#ffe28a] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Mời Các Phật Tử Không Tương Tác Rời Điện Thủ Công</span>
              </button>

              {manualDepartFeedback && (
                <p className="text-[11px] text-[#ffe28a]">{manualDepartFeedback}</p>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex justify-between text-xs">
                <label className="text-[#cbb696]">
                  Giới hạn nhân vật 3D hiển thị trên đệm chính (Tối đa {TOTAL_MAIN_MATS} đệm + Hàng chờ 200+)
                </label>
                <span className="font-mono-tabular text-[#ffe082]">
                  {Math.min(TOTAL_MAIN_MATS, overlaySettings.maxParticipants)}
                </span>
              </div>
              <input
                type="range"
                min={24}
                max={TOTAL_MAIN_MATS}
                step={8}
                value={Math.min(TOTAL_MAIN_MATS, overlaySettings.maxParticipants)}
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
                Mức đồ họa 3D (Tối ưu mượt cho MacBook M1 8GB phát LIVE dài giờ)
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
                <span>Đặt lại toàn bộ phiên</span>
              </button>
            </div>
          </div>
        )}

        {/* ==========================================================================
            BACKGROUND & CAMERA (3D PERSPECTIVE CALIBRATION + SCENE MODE SWITCH)
           ========================================================================== */}
        {activeTab === 'background' && (
          <div className="space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-semibold text-[#ffe082]">
                BACKGROUND &amp; CAMERA · Căn Chỉnh Phối Cảnh Nền Chùa &amp; Nhân Vật 3D
              </h3>
              <p className="text-[11px] text-[#cbb696] mt-1 leading-relaxed">
                Sử dụng ảnh nền tĩnh chất lượng cao{' '}
                <code className="text-[#ffe494]">/assets/temple-background.png</code> (9:16 không méo,
                không viền đen, hiển thị trọn vẹn tượng Phật) kết hợp nhân vật 3D căn chuẩn theo phối
                cảnh thảm đỏ trung tâm.
              </p>
            </div>

            {/* SCENE MODE SWITCH: IMAGE BACKGROUND vs ORIGINAL 3D TEMPLE */}
            <div className="rounded-xl bg-gradient-to-b from-[#2c0b13] to-[#17070a] border border-[#d4af37]/45 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#ffe082]" />
                  <span className="font-semibold text-[#ffe082]">CHẾ ĐỘ KHÔNG GIAN CHÁNH ĐIỆN</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#140508] border border-[#d4af37]/35 text-[10px] font-semibold text-[#ffe082]">
                  {sceneCalibration.sceneMode === 'image_background'
                    ? 'IMAGE BACKGROUND'
                    : 'ORIGINAL 3D TEMPLE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateCal({ sceneMode: 'image_background' })}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    sceneCalibration.sceneMode === 'image_background'
                      ? 'bg-[#d4af37] text-[#180d06] border-[#f5d76e] shadow'
                      : 'bg-[#1b0b0f] text-[#d8c3a4] border-white/10 hover:text-white'
                  }`}
                >
                  IMAGE BACKGROUND
                </button>

                <button
                  type="button"
                  onClick={() => updateCal({ sceneMode: 'original_3d' })}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    sceneCalibration.sceneMode === 'original_3d'
                      ? 'bg-[#d4af37] text-[#180d06] border-[#f5d76e] shadow'
                      : 'bg-[#1b0b0f] text-[#d8c3a4] border-white/10 hover:text-white'
                  }`}
                >
                  ORIGINAL 3D TEMPLE
                </button>
              </div>

              <p className="text-[10.5px] text-[#cbb696] leading-snug">
                Khi bật <strong>IMAGE BACKGROUND</strong>, hệ thống tự động ẩn tượng Phật 3D cũ, cột,
                tường, đèn lồng và sàn 3D trùng lặp để chỉ hiển thị duy nhất 1 tôn tượng Đức Phật Vàng
                từ ảnh nền.
              </p>

              {/* Alignment Guides Toggle */}
              <label className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 cursor-pointer">
                <span className="flex items-center gap-1.5 text-[#ffe082] font-medium">
                  <Grid className="w-3.5 h-3.5" />
                  <span>Hiện lưới căn chỉnh phối cảnh (Scene Alignment Guides)</span>
                </span>
                <input
                  type="checkbox"
                  checked={sceneCalibration.showAlignmentGuides}
                  onChange={(e) => updateCal({ showAlignmentGuides: e.target.checked })}
                  className="accent-[#d4af37]"
                />
              </label>
            </div>

            {/* 1. Background Scale & X/Y Offset */}
            <div className="rounded-xl bg-[#1a0b0e] border border-[#d4af37]/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#ffe082]">
                  1. Tỷ Lệ &amp; Dịch Chuyển Ảnh Nền (Background Scale &amp; X/Y Offset)
                </span>
                <button
                  type="button"
                  onClick={() => updateCal({ bgScale: 1.0, bgOffsetX: 0, bgOffsetY: 0 })}
                  className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
                >
                  Chuẩn 100% · (0, 0)
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#e6d5b8]">Background Scale (Giữ nguyên tỷ lệ)</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {Math.round(sceneCalibration.bgScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.85}
                  max={1.35}
                  step={0.01}
                  value={sceneCalibration.bgScale}
                  onChange={(e) => updateCal({ bgScale: Number(e.target.value) })}
                  className="w-full accent-[#d4af37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#e6d5b8]">Offset X (%)</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {sceneCalibration.bgOffsetX.toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={0.5}
                    value={sceneCalibration.bgOffsetX}
                    onChange={(e) => updateCal({ bgOffsetX: Number(e.target.value) })}
                    className="w-full accent-[#d4af37]"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#e6d5b8]">Offset Y (%)</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {sceneCalibration.bgOffsetY.toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={0.5}
                    value={sceneCalibration.bgOffsetY}
                    onChange={(e) => updateCal({ bgOffsetY: Number(e.target.value) })}
                    className="w-full accent-[#d4af37]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Camera Zoom & Character Near/Far Depth Scale */}
            <div className="rounded-xl bg-[#1a0b0e] border border-[#d4af37]/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#ffe082]">
                  2. Camera Zoom &amp; Kích Thước Nhân Vật Xa / Gần
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateCal({
                      cameraZoom: DEFAULT_SCENE_CALIBRATION.cameraZoom,
                      nearCharacterScale: DEFAULT_SCENE_CALIBRATION.nearCharacterScale,
                      farCharacterScale: DEFAULT_SCENE_CALIBRATION.farCharacterScale,
                    })
                  }
                  className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
                >
                  Đặt lại
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#e6d5b8]">Camera Zoom</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {sceneCalibration.cameraZoom.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.35}
                  step={0.01}
                  value={sceneCalibration.cameraZoom}
                  onChange={(e) => updateCal({ cameraZoom: Number(e.target.value) })}
                  className="w-full accent-[#d4af37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#e6d5b8]">Cỡ nhân vật Gần (Near)</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {sceneCalibration.nearCharacterScale.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.55}
                    step={0.02}
                    value={sceneCalibration.nearCharacterScale}
                    onChange={(e) => updateCal({ nearCharacterScale: Number(e.target.value) })}
                    className="w-full accent-[#d4af37]"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#e6d5b8]">Cỡ nhân vật Xa (Far)</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {sceneCalibration.farCharacterScale.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.45}
                    max={1.35}
                    step={0.02}
                    value={sceneCalibration.farCharacterScale}
                    onChange={(e) => updateCal({ farCharacterScale: Number(e.target.value) })}
                    className="w-full accent-[#d4af37]"
                  />
                </div>
              </div>
            </div>

            {/* 3. Seat Area Width, Depth & Offset */}
            <div className="rounded-xl bg-[#1a0b0e] border border-[#d4af37]/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#ffe082]">
                  3. Vùng Chỗ Ngồi 2 Bên Thảm Đỏ (Seat Width &amp; Depth)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateCal({
                      seatWidthScale: 1.0,
                      seatDepthScale: 1.0,
                      seatOffsetZ: 0,
                    })
                  }
                  className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
                >
                  Đặt lại
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#e6d5b8]">Độ rộng hai cánh chỗ ngồi (Seat Area Width)</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {Math.round(sceneCalibration.seatWidthScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.35}
                  step={0.02}
                  value={sceneCalibration.seatWidthScale}
                  onChange={(e) => updateCal({ seatWidthScale: Number(e.target.value) })}
                  className="w-full accent-[#d4af37]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#e6d5b8]">Độ sâu dãy ghế (Seat Area Depth)</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {Math.round(sceneCalibration.seatDepthScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.02}
                  value={sceneCalibration.seatDepthScale}
                  onChange={(e) => updateCal({ seatDepthScale: Number(e.target.value) })}
                  className="w-full accent-[#d4af37]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#e6d5b8]">Dịch khối chỗ ngồi Trước / Sau (Z Offset)</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {sceneCalibration.seatOffsetZ.toFixed(2)}m
                  </span>
                </div>
                <input
                  type="range"
                  min={-2.5}
                  max={2.5}
                  step={0.1}
                  value={sceneCalibration.seatOffsetZ}
                  onChange={(e) => updateCal({ seatOffsetZ: Number(e.target.value) })}
                  className="w-full accent-[#d4af37]"
                />
              </div>
            </div>

            {/* 4. Entrance Point & Altar Ritual Stations */}
            <div className="rounded-xl bg-[#1a0b0e] border border-[#d4af37]/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#ffe082]">
                  4. Điểm Bước Vào &amp; Trạm Hành Lễ Trước Bàn Thờ
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateCal({
                      entranceZ: DEFAULT_SCENE_CALIBRATION.entranceZ,
                      altarStationZ: DEFAULT_SCENE_CALIBRATION.altarStationZ,
                      altarStationSpreadX: DEFAULT_SCENE_CALIBRATION.altarStationSpreadX,
                    })
                  }
                  className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
                >
                  Đặt lại
                </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[#e6d5b8]">Điểm cửa vào / rời điện (Entrance Point Z)</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {sceneCalibration.entranceZ.toFixed(1)}m
                  </span>
                </div>
                <input
                  type="range"
                  min={11.5}
                  max={17.5}
                  step={0.2}
                  value={sceneCalibration.entranceZ}
                  onChange={(e) => updateCal({ entranceZ: Number(e.target.value) })}
                  className="w-full accent-[#d4af37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#e6d5b8]">Chiều sâu Trạm Lễ (Altar Z)</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {sceneCalibration.altarStationZ.toFixed(2)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-8.95}
                    max={-6.8}
                    step={0.05}
                    value={sceneCalibration.altarStationZ}
                    onChange={(e) => updateCal({ altarStationZ: Number(e.target.value) })}
                    className="w-full accent-[#d4af37]"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#e6d5b8]">Độ trải ngang Trạm Lễ</span>
                    <span className="font-mono-tabular text-[#ffe082]">
                      {Math.round(sceneCalibration.altarStationSpreadX * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.65}
                    max={1.35}
                    step={0.02}
                    value={sceneCalibration.altarStationSpreadX}
                    onChange={(e) => updateCal({ altarStationSpreadX: Number(e.target.value) })}
                    className="w-full accent-[#d4af37]"
                  />
                </div>
              </div>
            </div>

            {/* Save & Reset Calibration Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSaveCalibrationClick}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-[#d4af37] hover:bg-[#e5c14b] text-[#180d06] font-bold transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Căn Chỉnh</span>
              </button>

              <button
                type="button"
                onClick={handleResetCalibrationClick}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-[#2a1218] hover:bg-[#3b1922] border border-[#d4af37]/45 text-[#ffe082] font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Calibration</span>
              </button>
            </div>

            {calibrationSavedBanner && (
              <p className="text-[11px] text-[#9ef0b4] bg-[#132918] border border-[#499e5b]/45 rounded-lg px-3 py-2">
                {calibrationSavedBanner}
              </p>
            )}
          </div>
        )}

        {/* ==========================================================================
            6. STREAMING / OBS & GOLDEN BUDDHA GLB/GLTF ASSET CONFIGURATION TAB
           ========================================================================== */}
        {activeTab === 'streaming' && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#250c12] border border-[#d4af37]/40 p-3">
              <div>
                <p className="font-semibold text-[#ffe082]">
                  Chế độ nền hiện tại:{' '}
                  {sceneCalibration.sceneMode === 'image_background'
                    ? 'IMAGE BACKGROUND (Ảnh Chùa 9:16)'
                    : 'ORIGINAL 3D TEMPLE (Chánh Điện 3D Gốc)'}
                </p>
                <p className="text-[10.5px] text-[#cbb696] mt-0.5">
                  Chuyển sang mục &ldquo;Nền &amp; Camera&rdquo; để căn chỉnh phối cảnh hoặc đổi chế độ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('background')}
                className="px-2.5 py-1.5 rounded-lg bg-[#d4af37] text-[#180d06] font-semibold whitespace-nowrap cursor-pointer"
              >
                Mở Nền &amp; Camera
              </button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#ffe082]">
                Cấu Hình Khung 9:16, OBS &amp; Tôn Tượng Đức Phật Vàng 3D
              </h3>
              <p className="text-xs text-[#b8a285] mt-1 leading-relaxed">
                Tôn tượng Đức Phật Vàng hiển thị trọn vẹn 100% từ đỉnh hào quang đến đài sen trong khung 9:16, không bị bất kỳ bảng hay nhãn nào che khuất.
              </p>
            </div>

            {/* Configurable GLB/GLTF Buddha Model Path + Built-in Sculpted Fallback */}
            <div className="rounded-xl bg-[#1a0b0e] border border-[#d4af37]/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#ffe082]">
                  Mô Hình Tôn Tượng Đức Phật (GLB / GLTF hoặc Điêu Khắc Tích Hợp)
                </span>
                <span
                  className={`text-[10.5px] font-semibold ${
                    buddhaModelStatus === 'loaded'
                      ? 'text-[#8ee6a8]'
                      : buddhaModelStatus === 'fallback_error'
                        ? 'text-[#f6d375]'
                        : 'text-[#e6d5b8]'
                  }`}
                >
                  {buddhaModelStatus === 'loaded'
                    ? 'GLB tùy chỉnh'
                    : buddhaModelStatus === 'loading'
                      ? 'Đang tải...'
                      : 'Điêu khắc 3D tích hợp'}
                </span>
              </div>

              <p className="text-[11px] text-[#cbb696] leading-snug">{buddhaModelDetail}</p>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={buddhaUrlDraft}
                  onChange={(e) => setBuddhaUrlDraft(e.target.value)}
                  placeholder="/models/buddha.glb hoặc URL .glb/.gltf..."
                  className="flex-1 px-2.5 py-1.5 rounded bg-[#0b0604] border border-white/15 text-xs text-[#fff6e5]"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      buddhaModelUrl: buddhaUrlDraft.trim(),
                    })
                  }
                  className="px-3 py-1.5 rounded bg-[#d4af37] hover:bg-[#e5c14b] text-[#180d06] font-semibold whitespace-nowrap cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-[#e6d5b8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overlaySettings.buddhaGoldOverride}
                    onChange={(e) =>
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        buddhaGoldOverride: e.target.checked,
                      })
                    }
                    className="accent-[#d4af37]"
                  />
                  <span>Phủ vật liệu Vàng 24K PBR lên tệp GLB ngoài</span>
                </label>

                {overlaySettings.buddhaModelUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setBuddhaUrlDraft('');
                      onUpdateOverlaySettings({
                        ...overlaySettings,
                        buddhaModelUrl: '',
                      });
                    }}
                    className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
                  >
                    Dùng tượng tích hợp
                  </button>
                )}
              </div>
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

            {/* Global Panel Size & RGBA Opacity Controls */}
            <div className="rounded-xl bg-gradient-to-b from-[#250b11] to-[#16080b] border border-[#d4af37]/40 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#ffe082]" />
                  <span className="font-semibold text-[#ffe082]">
                    Kích Thước &amp; Độ Trong Suốt Nền RGBA Toàn Cục
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      panelScale: 0.86,
                      panelOpacity: 0.45,
                    })
                  }
                  className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
                >
                  Chuẩn 86% · 0.45
                </button>
              </div>

              <p className="text-[11px] text-[#cbb696] leading-relaxed">
                Sử dụng màu nền RGBA bán trong suốt (mặc định{' '}
                <span className="font-mono-tabular text-[#ffe082]">0.45</span>) thay vì CSS opacity
                toàn phần để chữ vàng/kem luôn sắc nét 100% và không bao giờ che tượng Phật.
              </p>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-[#e6d5b8]">Kích thước thu phóng bảng UI</span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {Math.round((overlaySettings.panelScale ?? 0.86) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.15}
                  step={0.02}
                  value={overlaySettings.panelScale ?? 0.86}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      panelScale: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#d4af37]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-[#e6d5b8]">
                    Độ đậm nền RGBA (Mặc định 0.45)
                  </span>
                  <span className="font-mono-tabular text-[#ffe082]">
                    {(overlaySettings.panelOpacity ?? 0.45).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={0.88}
                  step={0.01}
                  value={overlaySettings.panelOpacity ?? 0.45}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      panelOpacity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#d4af37]"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveOverlayStyleSettings}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#d4af37] hover:bg-[#e5c14b] text-[#180d06] text-xs font-bold transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu cấu hình giao diện</span>
              </button>

              {overlaySavedBanner && (
                <p className="text-[11px] text-[#9ef0b4] bg-[#132918] border border-[#499e5b]/45 rounded-lg px-3 py-1.5">
                  {overlaySavedBanner}
                </p>
              )}
            </div>

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
                  Hiện Avatar Tròn Trên Bảng Nghi Lễ &amp; Xin Xăm Trung Tâm
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showAvatarInCenterPanel !== false}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showAvatarInCenterPanel: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#ffe082] font-medium">
                  Hiển thị bảng thu gọn &ldquo;🪷 Xin Xăm Cầu Nguyện&rdquo;
                </span>
                <input
                  type="checkbox"
                  checked={overlaySettings.showXinXamPanel !== false}
                  onChange={(e) =>
                    onUpdateOverlaySettings({
                      ...overlaySettings,
                      showXinXamPanel: e.target.checked,
                    })
                  }
                  className="accent-[#d4af37]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#ffe082] font-medium">
                  Hiển thị bảng thu gọn &ldquo;Cúng Dường Cầu An&rdquo; (Sát mép phải)
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
                  Hiển thị &ldquo;Bảng Công Đức&rdquo; thu gọn (Hạng 1–4 cố định + Cuộn 5+)
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
                  Hiển thị huy hiệu Hoa Sen khi Phật tử hành lễ (Không ảnh đại diện)
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
                  Hiển thị dòng hướng dẫn thu gọn &ldquo;❤️ Like: Gõ mõ&rdquo; &amp; Bộ Đếm
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
                <span className="text-[#e6d5b8]">
                  Hiển thị thông báo sự kiện nhỏ sát mép dưới trái
                </span>
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
                <span className="text-[#ffe082] font-medium">
                  Hiển thị bong bóng bình luận 5s trên đầu nhân vật (Chỉ nội dung bình luận)
                </span>
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
                <span className="text-[#e6d5b8]">
                  Hiển thị nhãn tên nhỏ chống đè nhau trên đầu nhân vật
                </span>
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
