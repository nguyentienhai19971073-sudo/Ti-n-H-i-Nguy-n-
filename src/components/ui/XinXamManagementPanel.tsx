import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Flower2,
  LayoutList,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  DEFAULT_XIN_XAM_VOICE_TEMPLATE,
  FORTUNE_CATEGORIES,
  FORTUNE_CLASSIFICATION_META,
  FortuneCategory,
  FortuneRecord,
  GiftMapping,
  StreamOverlaySettings,
  XinXamSettings,
  formatFortuneCode,
  formatQueXamHeader,
  renderXinXamVoiceText,
  vietnameseNumberToWords,
} from '../../types/temple';
import { XinXamRegistrySnapshot, xinXamRegistry } from '../../systems/XinXamRegistry';
import { BuddhistGiftPanel } from './BuddhistGiftPanel';

interface XinXamManagementPanelProps {
  xinXamSnapshot: XinXamRegistrySnapshot;
  giftMappings?: GiftMapping[];
  giftEventCounts?: Record<string, number>;
  overlaySettings?: StreamOverlaySettings;
  onSimulateGiftMapping?: (mapping: GiftMapping) => void;
  onTriggerDemoXinXam: (options?: {
    username?: string;
    forcedFortuneNumber?: number;
  }) => void;
  onTriggerQueueDemoXinXam: () => void;
  onDrawRandomFortune: () => void;
  onPreviewFortuneResult?: (options?: {
    username?: string;
    forcedFortuneNumber?: number;
  }) => void;
  onTriggerEffectsPreview: () => void;
  onPreviewVoice: (sampleText: string) => void;
}

interface FortuneFormDraft {
  fortuneId?: string;
  fortuneNumber: number;
  fortuneTitle: string;
  fortuneType: FortuneCategory;
  shortVerse: string;
  interpretation: string;
  advice: string;
  voiceText: string;
  enabled: boolean;
}

const EMPTY_FORTUNE_DRAFT: FortuneFormDraft = {
  fortuneNumber: 101,
  fortuneTitle: 'Tâm An Vạn Sự Lành',
  fortuneType: 'Trung Cát',
  shortVerse: 'Trăng thanh soi sáng mái chùa xưa,\nTâm tịnh bình yên giữa nắng mưa.',
  interpretation:
    'Mọi việc tiến triển thuận hòa khi giữ tâm bình tĩnh, làm lành lánh dữ và hiếu kính gia đình.',
  advice: 'Hãy giữ lòng từ bi, kiên nhẫn và sống hòa thuận.',
  voiceText: '',
  enabled: true,
};

function getClassificationBadgeColor(cat: FortuneCategory): string {
  switch (cat) {
    case 'Đại Cát':
      return 'text-[#ffe680] border-[#ffe680]/45 bg-[#3b1c0a]';
    case 'Trung Cát':
      return 'text-[#f8d778] border-[#f8d778]/40 bg-[#32170c]';
    case 'Tiểu Cát':
      return 'text-[#ffd0e0] border-[#f7a8c4]/40 bg-[#33101e]';
    case 'Bình':
      return 'text-[#f2dfc0] border-[#d8c4a0]/35 bg-[#26160e]';
    case 'Cần Thận Trọng':
      return 'text-[#f4b998] border-[#ed9e72]/40 bg-[#30140a]';
  }
}

export function XinXamManagementPanel({
  xinXamSnapshot,
  giftMappings = [],
  giftEventCounts = {},
  overlaySettings,
  onSimulateGiftMapping,
  onTriggerDemoXinXam,
  onTriggerQueueDemoXinXam,
  onDrawRandomFortune,
  onPreviewFortuneResult,
  onTriggerEffectsPreview,
  onPreviewVoice,
}: XinXamManagementPanelProps) {
  const { settings, fortunes, recentDraws } = xinXamSnapshot;

  const [settingsDraft, setSettingsDraft] = useState<XinXamSettings>(() => ({
    ...settings,
  }));
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | FortuneCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [demoUsername, setDemoUsername] = useState('Minh Anh');
  const [previewFortuneNumber, setPreviewFortuneNumber] = useState<number>(18);

  const [editingFortune, setEditingFortune] = useState<FortuneFormDraft | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSettingsDraft({ ...settings });
  }, [
    settings.enabled,
    settings.eventTitle,
    settings.eventLabel,
    settings.giftId,
    settings.referenceCoins,
    settings.meritPoints,
    settings.voiceTemplate,
    settings.animationDurationSec,
    settings.particleDensity,
    settings.panelScale,
    settings.panelOpacity,
    settings.resultDisplayDurationMs,
  ]);

  const showToast = (ok: boolean, text: string) => {
    setFeedback({ ok, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4200);
  };

  const categorySummary = useMemo(() => {
    const counts: Record<FortuneCategory, number> = {
      'Đại Cát': 0,
      'Trung Cát': 0,
      'Tiểu Cát': 0,
      Bình: 0,
      'Cần Thận Trọng': 0,
    };
    let enabledCount = 0;
    for (const f of fortunes) {
      const ft = f.fortuneType || f.category;
      if (counts[ft] !== undefined) {
        counts[ft] += 1;
      }
      if (f.enabled) enabledCount += 1;
    }
    return { counts, enabledCount, total: fortunes.length };
  }, [fortunes]);

  const filteredFortunes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fortunes.filter((f) => {
      const ft = f.fortuneType || f.category;
      if (categoryFilter !== 'ALL' && ft !== categoryFilter) return false;
      if (statusFilter === 'ENABLED' && !f.enabled) return false;
      if (statusFilter === 'DISABLED' && f.enabled) return false;
      if (!q) return true;
      return (
        f.fortuneCode.toLowerCase().includes(q) ||
        String(f.fortuneNumber).includes(q) ||
        (f.fortuneTitle || f.title).toLowerCase().includes(q) ||
        ft.toLowerCase().includes(q) ||
        f.interpretation.toLowerCase().includes(q) ||
        (f.shortVerse || f.poem).toLowerCase().includes(q) ||
        f.advice.toLowerCase().includes(q)
      );
    });
  }, [fortunes, searchQuery, categoryFilter, statusFilter]);

  const sampleFortuneForVoice = useMemo(() => {
    return (
      fortunes.find((f) => f.fortuneNumber === previewFortuneNumber) ||
      fortunes.find((f) => f.fortuneNumber === 18) ||
      fortunes[0]
    );
  }, [fortunes, previewFortuneNumber]);

  const voicePreviewString = useMemo(() => {
    const f = sampleFortuneForVoice;
    if (!f) {
      return renderXinXamVoiceText(settingsDraft.voiceTemplate, {
        username: 'Minh Anh',
        fortuneNumber: 18,
        fortuneType: 'Trung Cát',
        fortuneTitle: 'Gia đạo an hòa',
        fortuneInterpretation:
          'Gia đình có thể đón nhận những điều thuận lợi khi mọi người biết quan tâm và chia sẻ.',
        fortuneAdvice: 'Hãy giữ lòng từ bi và sống hòa thuận.',
      });
    }
    return renderXinXamVoiceText(settingsDraft.voiceTemplate, {
      username: demoUsername.replace(/^@+/, '') || 'Minh Anh',
      fortuneNumber: f.fortuneNumber,
      fortuneType: f.fortuneType || f.category,
      fortuneTitle: f.fortuneTitle || f.title,
      fortuneInterpretation: f.voiceText || f.interpretation,
      fortuneAdvice: f.advice,
    });
  }, [settingsDraft.voiceTemplate, sampleFortuneForVoice, demoUsername]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await xinXamRegistry.saveSettings(settingsDraft);
      showToast(
        true,
        'Đã lưu cấu hình sự kiện Xin Xăm (tên sự kiện, mệnh giá xu, Gift ID, độ trong suốt RGBA & mẫu giọng VieNeuTTS).',
      );
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Lưu cấu hình thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggleEnabled = async (enabled: boolean) => {
    setSettingsDraft((prev) => ({ ...prev, enabled }));
    try {
      await xinXamRegistry.saveSettings({ ...settingsDraft, enabled });
      showToast(
        true,
        enabled ? 'Đã BẬT sự kiện Xin Xăm trong bảng Cúng Dường Cầu An.' : 'Đã TẮT sự kiện Xin Xăm.',
      );
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.');
    }
  };

  const handleOpenCreateFortune = () => {
    const maxNum = fortunes.reduce((m, f) => Math.max(m, f.fortuneNumber), 100);
    setIsCreatingNew(true);
    setEditingFortune({
      ...EMPTY_FORTUNE_DRAFT,
      fortuneNumber: maxNum + 1,
    });
  };

  const handleOpenEditFortune = (f: FortuneRecord) => {
    setIsCreatingNew(false);
    setEditingFortune({
      fortuneId: f.fortuneId,
      fortuneNumber: f.fortuneNumber,
      fortuneTitle: f.fortuneTitle || f.title,
      fortuneType: f.fortuneType || f.category,
      shortVerse: f.shortVerse || f.poem,
      interpretation: f.interpretation,
      advice: f.advice,
      voiceText: f.voiceText || '',
      enabled: f.enabled,
    });
  };

  const handleSubmitFortuneDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFortune) return;
    setSaving(true);
    try {
      const payload = {
        fortuneNumber: editingFortune.fortuneNumber,
        fortuneTitle: editingFortune.fortuneTitle.trim(),
        title: editingFortune.fortuneTitle.trim(),
        fortuneType: editingFortune.fortuneType,
        category: editingFortune.fortuneType,
        shortVerse: editingFortune.shortVerse.trim(),
        poem: editingFortune.shortVerse.trim(),
        interpretation: editingFortune.interpretation.trim(),
        advice: editingFortune.advice.trim(),
        voiceText: editingFortune.voiceText.trim(),
        enabled: editingFortune.enabled,
      };
      if (isCreatingNew) {
        await xinXamRegistry.createFortune(payload);
        showToast(
          true,
          `Đã thêm mới ${formatQueXamHeader(editingFortune.fortuneNumber)} (${editingFortune.fortuneType}) · ${editingFortune.fortuneTitle}.`,
        );
      } else if (editingFortune.fortuneId) {
        await xinXamRegistry.updateFortune(editingFortune.fortuneId, payload);
        showToast(
          true,
          `Đã cập nhật ${formatQueXamHeader(editingFortune.fortuneNumber)} (${editingFortune.fortuneType}) · ${editingFortune.fortuneTitle}.`,
        );
      }
      setEditingFortune(null);
      setIsCreatingNew(false);
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Lưu quẻ xăm thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFortuneEnabled = async (f: FortuneRecord) => {
    try {
      await xinXamRegistry.updateFortune(f.fortuneId, { enabled: !f.enabled });
      showToast(
        true,
        `${!f.enabled ? 'Đã bật' : 'Đã tạm tắt'} ${formatQueXamHeader(f.fortuneNumber)}.`,
      );
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Không thể đổi trạng thái quẻ xăm.');
    }
  };

  const handleConfirmDeleteFortune = async (f: FortuneRecord) => {
    try {
      await xinXamRegistry.deleteFortune(f.fortuneId);
      setConfirmDeleteId(null);
      showToast(true, `Đã xóa ${formatQueXamHeader(f.fortuneNumber)}.`);
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Không thể xóa quẻ xăm.');
    }
  };

  const handleExportJson = () => {
    const jsonStr = xinXamRegistry.buildExportJsonString();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chua-online-100-que-xam-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(true, `Đã xuất tệp JSON gồm ${fortunes.length} quẻ xăm.`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const res = await xinXamRegistry.importJson(parsed, importMode);
        showToast(
          true,
          `Đã nhập thành công ${res.importedCount} quẻ xăm (chế độ: ${
            importMode === 'replace' ? 'Thay thế' : 'Gộp'
          }).`,
        );
      } catch (err) {
        showToast(
          false,
          err instanceof Error ? err.message : 'Tệp JSON không hợp lệ hoặc nhập thất bại.',
        );
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleConfirmResetDefaults = async () => {
    try {
      await xinXamRegistry.resetDefaultFortunes();
      setConfirmResetAll(false);
      showToast(
        true,
        'Đã khôi phục nguyên bản 100 quẻ xăm truyền thống (5 phân loại: Đại Cát, Trung Cát, Tiểu Cát, Bình, Cần Thận Trọng).',
      );
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Khôi phục thất bại.');
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {/* HEADER & DEMO / PREVIEW CONTROLS */}
      <div className="rounded-xl bg-gradient-to-b from-[#330d15] to-[#17070a] border border-[#f5cd63]/55 p-3.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-4 h-4 text-[#ffe082] shrink-0" />
            <h3 className="font-display text-sm font-bold tracking-wide text-[#ffe494] truncate">
              QUẢN LÝ XIN XĂM · 5 PHÂN LOẠI QUẺ
            </h3>
          </div>
          <label className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#140508] border border-[#d4af37]/45 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settingsDraft.enabled}
              onChange={(e) => void handleQuickToggleEnabled(e.target.checked)}
              className="accent-[#d4af37]"
            />
            <span className="text-[10.5px] font-semibold text-[#ffe082]">
              {settingsDraft.enabled ? 'Đang BẬT' : 'Đang TẮT'}
            </span>
          </label>
        </div>

        <p className="text-[11px] text-[#d8c4a6] leading-relaxed">
          Mỗi thẻ xăm mang sẵn phân loại văn hóa trang nghiêm (<strong className="text-[#ffe680]">Đại Cát</strong>,{' '}
          <strong className="text-[#f8d778]">Trung Cát</strong>,{' '}
          <strong className="text-[#ffd0e0]">Tiểu Cát</strong>,{' '}
          <strong className="text-[#f2dfc0]">Bình</strong>,{' '}
          <strong className="text-[#f4b998]">Cần Thận Trọng</strong>) như lời nhắc thiện lành. Khi thẻ
          xăm rơi ra, bảng trung tâm hiện rõ loại quẻ và VieNeuTTS đọc đầy đủ loại quẻ, tiêu đề, lời
          giải cùng lời khuyên.
        </p>

        {/* DEMO & PREVIEW BUTTONS */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onTriggerDemoXinXam({ username: demoUsername })}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f4cf65] hover:brightness-105 text-[#1a0b05] text-xs font-bold shadow cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>THỬ XIN XĂM 3D</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onPreviewFortuneResult
                ? onPreviewFortuneResult({
                    username: demoUsername,
                    forcedFortuneNumber: previewFortuneNumber,
                  })
                : onDrawRandomFortune()
            }
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#2e0f16] hover:bg-[#421520] border border-[#f5cd63]/65 text-xs font-semibold text-[#ffe89e] cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#ffe082] shrink-0" />
            <span>XEM TRƯỚC KẾT QUẢ</span>
          </button>

          <button
            type="button"
            onClick={onDrawRandomFortune}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#260c12] hover:bg-[#38121b] border border-[#d4af37]/45 text-xs font-semibold text-[#fff3da] cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#ffe082] shrink-0" />
            <span>RÚT QUẺ NGẪU NHIÊN</span>
          </button>

          <button
            type="button"
            onClick={() => onPreviewVoice(voicePreviewString)}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#260c12] hover:bg-[#38121b] border border-[#d4af37]/45 text-xs font-semibold text-[#ffe8a6] cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#ffe082] shrink-0" />
            <span>THỬ GIỌNG ĐỌC</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="text"
            value={demoUsername}
            onChange={(e) => setDemoUsername(e.target.value)}
            placeholder="Tên Phật tử thử xin xăm..."
            className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-lg bg-[#120608] border border-[#d4af37]/35 text-xs text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
          />
          <button
            type="button"
            onClick={onTriggerEffectsPreview}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#210b10] hover:bg-[#331119] border border-[#d4af37]/40 text-[11px] font-semibold text-[#f7b2cd] cursor-pointer"
          >
            <Flower2 className="w-3.5 h-3.5 shrink-0" />
            <span>Mưa Sen</span>
          </button>
          <button
            type="button"
            onClick={onTriggerQueueDemoXinXam}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#210b10] hover:bg-[#331119] border border-[#d4af37]/40 text-[11px] font-semibold text-[#ffe082] cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>Xếp Hàng 3</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg px-3 py-2 border text-[11px] flex items-center gap-2 ${
            feedback.ok
              ? 'bg-[#132918] border-[#499e5b]/50 text-[#9ef0b4]'
              : 'bg-[#361115] border-[#e57373]/50 text-[#ffb4b4]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* EVENT NAME, COIN VALUE, GIFT ID & PANEL OPACITY SETTINGS */}
      <div className="rounded-xl bg-[#1a0a0d] border border-[#d4af37]/35 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-[#ffe082]">
            Cấu Hình Sự Kiện XIN XĂM Trong Bảng &ldquo;CÚNG DƯỜNG CẦU AN&rdquo;
          </h4>
          <span className="text-[10.5px] font-mono-tabular text-[#ffd978]">
            {settingsDraft.referenceCoins} xu · +{settingsDraft.meritPoints} công đức
          </span>
        </div>

        <p className="text-[11px] text-[#cbb696] leading-relaxed">
          Mục <strong className="text-[#ffe082]">{settingsDraft.eventTitle || 'XIN XĂM'}</strong> nằm
          trực tiếp trong bảng <strong className="text-[#ffe082]">CÚNG DƯỜNG CẦU AN</strong> và tự
          động sắp xếp tăng dần theo mệnh giá xu. Hệ thống chỉ kích hoạt trên TikTok LIVE khi khớp{' '}
          <strong className="text-[#ffe082]">TikTok Gift ID thực tế</strong> (không bao giờ tự bịa ID).
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] text-[#d9c5a7] mb-1">
              Tên sự kiện trên bảng
            </label>
            <input
              type="text"
              value={settingsDraft.eventTitle}
              onChange={(e) =>
                setSettingsDraft((prev) => ({ ...prev, eventTitle: e.target.value }))
              }
              placeholder="XIN XĂM"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/40 text-xs text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#d9c5a7] mb-1">
              Mô tả nghi lễ hiển thị đầy đủ
            </label>
            <input
              type="text"
              value={settingsDraft.eventLabel}
              onChange={(e) =>
                setSettingsDraft((prev) => ({ ...prev, eventLabel: e.target.value }))
              }
              placeholder="Xin xăm cầu an"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/40 text-xs text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#d9c5a7] mb-1">
              Mệnh giá xu (Tự sắp xếp thứ tự)
            </label>
            <input
              type="number"
              min={1}
              max={100000}
              value={settingsDraft.referenceCoins}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  referenceCoins: Math.max(1, Number(e.target.value) || 20),
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/40 text-xs font-mono-tabular text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#d9c5a7] mb-1">
              Điểm công đức mỗi lần Xin Xăm
            </label>
            <input
              type="number"
              min={0}
              max={100000}
              value={settingsDraft.meritPoints}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  meritPoints: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/40 text-xs font-mono-tabular text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-[11px] text-[#d9c5a7] mb-1">
              TikTok Gift ID cho Xin Xăm (Để trống cho tới khi nhập Gift ID thật)
            </label>
            <input
              type="text"
              value={settingsDraft.giftId}
              onChange={(e) =>
                setSettingsDraft((prev) => ({ ...prev, giftId: e.target.value.trim() }))
              }
              placeholder="Nhập TikTok Gift ID thực tế (ví dụ: 5658)..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/40 text-xs font-mono-tabular text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="flex justify-between mb-0.5 text-[11px]">
              <span className="text-[#cbb696]">Thời lượng quỳ lắc ống xăm</span>
              <span className="font-mono-tabular text-[#ffe082]">
                {settingsDraft.animationDurationSec.toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={3.5}
              max={12}
              step={0.2}
              value={settingsDraft.animationDurationSec}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  animationDurationSec: Number(e.target.value),
                }))
              }
              className="w-full accent-[#d4af37]"
            />
          </div>

          <div>
            <div className="flex justify-between mb-0.5 text-[11px]">
              <span className="text-[#cbb696]">Mật độ sen &amp; hạt vàng</span>
              <span className="font-mono-tabular text-[#ffe082]">
                {settingsDraft.particleDensity.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={2.2}
              step={0.05}
              value={settingsDraft.particleDensity}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  particleDensity: Number(e.target.value),
                }))
              }
              className="w-full accent-[#d4af37]"
            />
          </div>

          <div>
            <div className="flex justify-between mb-0.5 text-[11px]">
              <span className="text-[#cbb696]">Kích thước bảng kết quả</span>
              <span className="font-mono-tabular text-[#ffe082]">
                {Math.round(settingsDraft.panelScale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.72}
              max={1.15}
              step={0.02}
              value={settingsDraft.panelScale}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  panelScale: Number(e.target.value),
                }))
              }
              className="w-full accent-[#d4af37]"
            />
          </div>

          <div>
            <div className="flex justify-between mb-0.5 text-[11px]">
              <span className="text-[#cbb696]">Độ đậm nền RGBA (Chuẩn 0.45)</span>
              <span className="font-mono-tabular text-[#ffe082]">
                {settingsDraft.panelOpacity.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.28}
              max={0.85}
              step={0.01}
              value={settingsDraft.panelOpacity}
              onChange={(e) =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  panelOpacity: Number(e.target.value),
                }))
              }
              className="w-full accent-[#d4af37]"
            />
          </div>
        </div>

        {/* VIENEUTTS VOICE TEMPLATE FOR XIN XĂM (READS FORTUNE TYPE!) */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="font-semibold text-[#ffe082]">
              Công Thức Giọng Đọc VieNeuTTS (Bắt buộc đọc Phân Loại Quẻ)
            </label>
            <button
              type="button"
              onClick={() =>
                setSettingsDraft((prev) => ({
                  ...prev,
                  voiceTemplate: DEFAULT_XIN_XAM_VOICE_TEMPLATE,
                }))
              }
              className="text-[10.5px] text-[#ffe082] hover:underline cursor-pointer"
            >
              Mặc định chuẩn
            </button>
          </div>

          <textarea
            rows={2}
            value={settingsDraft.voiceTemplate}
            onChange={(e) =>
              setSettingsDraft((prev) => ({ ...prev, voiceTemplate: e.target.value }))
            }
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/40 text-xs text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-[#cbb696]">
            <span>
              Biến: <code className="text-[#ffe082]">{'{username}'}</code>,{' '}
              <code className="text-[#ffe082]">{'{fortuneNumber}'}</code> (18 → &ldquo;
              {vietnameseNumberToWords(18)}&rdquo;),{' '}
              <code className="text-[#ffe082]">{'{fortuneType}'}</code>,{' '}
              <code className="text-[#ffe082]">{'{fortuneTitle}'}</code>,{' '}
              <code className="text-[#ffe082]">{'{fortuneInterpretation}'}</code>,{' '}
              <code className="text-[#ffe082]">{'{fortuneAdvice}'}</code>
            </span>

            <div className="flex items-center gap-1.5">
              <span>Quẻ thử:</span>
              <input
                type="number"
                min={1}
                max={200}
                value={previewFortuneNumber}
                onChange={(e) => setPreviewFortuneNumber(Math.max(1, Number(e.target.value) || 18))}
                className="w-14 px-1.5 py-0.5 rounded bg-[#100507] border border-[#d4af37]/35 text-[#ffe082] font-mono-tabular"
              />
            </div>
          </div>

          <div className="rounded-lg bg-[#120608] border border-[#d4af37]/25 px-2.5 py-2 text-[11px] text-[#f5e7cf] italic leading-relaxed">
            “{voicePreviewString}”
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveSettings()}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#d4af37] hover:bg-[#e6c24d] text-[#180d06] text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Lưu Cấu Hình Xin Xăm &amp; Thứ Tự Cúng Dường</span>
        </button>
      </div>

      {/* LIVE PREVIEW OF SORTED "CÚNG DƯỜNG CẦU AN" PANEL WITH COMPLETE UNWRAPPED TEXT */}
      {giftMappings.length > 0 && (
        <div className="rounded-xl bg-[#1a0a0d] border border-[#d4af37]/35 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <LayoutList className="w-4 h-4 text-[#ffe082]" />
              <h4 className="font-semibold text-[#ffe082]">
                Xem Trước Bảng &ldquo;CÚNG DƯỜNG CẦU AN&rdquo; (Tự Sắp Xếp Theo Xu · Không Cắt Chữ)
              </h4>
            </div>
            <span className="text-[10.5px] font-mono-tabular text-[#cbb696]">
              RGBA {(overlaySettings?.panelOpacity ?? settingsDraft.panelOpacity).toFixed(2)}
            </span>
          </div>

          <p className="text-[11px] text-[#cbb696] leading-snug">
            Kiểm tra trực tiếp: mọi dòng sự kiện đều hiển thị đầy đủ tên tiếng Việt, vật phẩm/nghi
            lễ và số xu (từ thấp đến cao), không dùng dấu ba chấm cắt chữ.
          </p>

          <div className="rounded-lg bg-gradient-to-b from-[#23100a] to-[#0f0604] border border-[#d4af37]/25 p-3 flex justify-end">
            <BuddhistGiftPanel
              giftMappings={giftMappings}
              xinXamSettings={settingsDraft}
              giftEventCounts={giftEventCounts}
              isDemoMode={true}
              onTriggerDemoGift={onSimulateGiftMapping}
              onTriggerDemoXinXam={() => onTriggerDemoXinXam({ username: demoUsername })}
              panelOpacity={overlaySettings?.panelOpacity ?? settingsDraft.panelOpacity}
              panelScale={1}
            />
          </div>
        </div>
      )}

      {/* 100 FORTUNE STICKS DATABASE MANAGEMENT (5 CLASSIFICATIONS) */}
      <div className="rounded-xl bg-[#1a0a0d] border border-[#d4af37]/35 p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-[#ffe082]">
              Cơ Sở Dữ Liệu {categorySummary.total} Quẻ Xăm (Đang bật:{' '}
              {categorySummary.enabledCount})
            </h4>
            <p className="text-[10.5px] text-[#cbb696] mt-0.5 leading-relaxed">
              Đại Cát: <strong className="text-[#ffe680]">{categorySummary.counts['Đại Cát']}</strong>{' '}
              · Trung Cát:{' '}
              <strong className="text-[#f8d778]">{categorySummary.counts['Trung Cát']}</strong> ·
              Tiểu Cát:{' '}
              <strong className="text-[#ffd0e0]">{categorySummary.counts['Tiểu Cát']}</strong> ·
              Bình: <strong className="text-[#f2dfc0]">{categorySummary.counts.Bình}</strong> · Cần
              Thận Trọng:{' '}
              <strong className="text-[#f4b998]">
                {categorySummary.counts['Cần Thận Trọng']}
              </strong>
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateFortune}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e5c14b] text-[#180d06] text-[11px] font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Quẻ</span>
          </button>
        </div>

        {/* IMPORT / EXPORT / RESET TOOLBAR */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#260d13] hover:bg-[#37131c] border border-[#d4af37]/35 text-[11px] text-[#ffe082] cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Xuất JSON</span>
          </button>

          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
            className="px-2 py-1 rounded-md bg-[#120608] border border-[#d4af37]/35 text-[11px] text-[#f5ead6]"
          >
            <option value="merge">Nhập: Gộp</option>
            <option value="replace">Nhập: Thay thế</option>
          </select>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#260d13] hover:bg-[#37131c] border border-[#d4af37]/35 text-[11px] text-[#ffe082] cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>Nhập JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />

          {!confirmResetAll ? (
            <button
              type="button"
              onClick={() => setConfirmResetAll(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#220a0e] hover:bg-[#331017] border border-white/15 text-[11px] text-[#d8c4a6] cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Khôi phục 100 quẻ gốc</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => void handleConfirmResetDefaults()}
                className="px-2 py-1 rounded bg-[#b71c1c] text-white text-[10.5px] font-semibold cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetAll(false)}
                className="px-2 py-1 rounded bg-white/10 text-[#f5ead6] text-[10.5px] cursor-pointer"
              >
                Hủy
              </button>
            </div>
          )}
        </div>

        {/* ADD / EDIT FORTUNE FORM */}
        {editingFortune && (
          <form
            onSubmit={handleSubmitFortuneDraft}
            className="rounded-xl bg-[#120608] border border-[#f5cd63]/55 p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#ffe494]">
                {isCreatingNew
                  ? 'Thêm Quẻ Xăm Mới'
                  : `Chỉnh Sửa ${formatQueXamHeader(editingFortune.fortuneNumber)}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingFortune(null);
                  setIsCreatingNew(false);
                }}
                className="p-1 rounded hover:bg-white/10 text-[#cbb696] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-0.5">
                  Số quẻ (fortuneNumber)
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={editingFortune.fortuneNumber}
                  onChange={(e) =>
                    setEditingFortune((prev) =>
                      prev
                        ? { ...prev, fortuneNumber: Math.max(1, Number(e.target.value) || 1) }
                        : prev,
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-[#1b090d] border border-[#d4af37]/35 text-xs font-mono-tabular text-[#fff4dc]"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10.5px] text-[#cbb696] mb-0.5">
                  Phân loại quẻ (fortuneType)
                </label>
                <select
                  value={editingFortune.fortuneType}
                  onChange={(e) =>
                    setEditingFortune((prev) =>
                      prev ? { ...prev, fortuneType: e.target.value as FortuneCategory } : prev,
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-[#1b090d] border border-[#d4af37]/35 text-xs text-[#fff4dc]"
                >
                  {FORTUNE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {FORTUNE_CLASSIFICATION_META[cat].upperLabel} —{' '}
                      {FORTUNE_CLASSIFICATION_META[cat].meaningVi}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] text-[#cbb696] mb-0.5">
                Tiêu đề quẻ (fortuneTitle)
              </label>
              <input
                type="text"
                required
                value={editingFortune.fortuneTitle}
                onChange={(e) =>
                  setEditingFortune((prev) =>
                    prev ? { ...prev, fortuneTitle: e.target.value } : prev,
                  )
                }
                className="w-full px-2 py-1 rounded bg-[#1b090d] border border-[#d4af37]/35 text-xs text-[#fff4dc]"
              />
            </div>

            <div>
              <label className="block text-[10.5px] text-[#cbb696] mb-0.5">
                Thơ xăm (shortVerse)
              </label>
              <textarea
                rows={2}
                required
                value={editingFortune.shortVerse}
                onChange={(e) =>
                  setEditingFortune((prev) =>
                    prev ? { ...prev, shortVerse: e.target.value } : prev,
                  )
                }
                className="w-full px-2 py-1 rounded bg-[#1b090d] border border-[#d4af37]/35 text-xs text-[#fff4dc]"
              />
            </div>

            <div>
              <label className="block text-[10.5px] text-[#cbb696] mb-0.5">
                Lời giải (interpretation)
              </label>
              <textarea
                rows={2}
                required
                value={editingFortune.interpretation}
                onChange={(e) =>
                  setEditingFortune((prev) =>
                    prev ? { ...prev, interpretation: e.target.value } : prev,
                  )
                }
                className="w-full px-2 py-1 rounded bg-[#1b090d] border border-[#d4af37]/35 text-xs text-[#fff4dc]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-0.5">
                  Lời khuyên (advice)
                </label>
                <input
                  type="text"
                  required
                  value={editingFortune.advice}
                  onChange={(e) =>
                    setEditingFortune((prev) => (prev ? { ...prev, advice: e.target.value } : prev))
                  }
                  className="w-full px-2 py-1 rounded bg-[#1b090d] border border-[#d4af37]/35 text-xs text-[#fff4dc]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-0.5">
                  Lời đọc riêng (tùy chọn)
                </label>
                <input
                  type="text"
                  value={editingFortune.voiceText}
                  onChange={(e) =>
                    setEditingFortune((prev) =>
                      prev ? { ...prev, voiceText: e.target.value } : prev,
                    )
                  }
                  placeholder="Mặc định dùng lời giải..."
                  className="w-full px-2 py-1 rounded bg-[#1b090d] border border-[#d4af37]/35 text-xs text-[#fff4dc]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingFortune.enabled}
                  onChange={(e) =>
                    setEditingFortune((prev) =>
                      prev ? { ...prev, enabled: e.target.checked } : prev,
                    )
                  }
                  className="accent-[#d4af37]"
                />
                <span className="text-[11px] text-[#ffe082]">Cho phép rút quẻ này</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e5c14b] text-[#180d06] text-xs font-bold cursor-pointer"
              >
                {isCreatingNew ? 'Tạo Quẻ Xăm' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </form>
        )}

        {/* SEARCH & FILTER BAR */}
        <div className="grid grid-cols-12 gap-1.5">
          <div className="col-span-6 relative">
            <Search className="w-3.5 h-3.5 text-[#cbb696] absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm số quẻ (01–100), loại, tên..."
              className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/35 text-xs text-[#fff4dc] focus:outline-none focus:border-[#ffe082]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | FortuneCategory)}
            className="col-span-3 px-2 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/35 text-[11px] text-[#fff4dc]"
          >
            <option value="ALL">Tất cả 5 loại</option>
            {FORTUNE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ENABLED' | 'DISABLED')}
            className="col-span-3 px-2 py-1.5 rounded-lg bg-[#100507] border border-[#d4af37]/35 text-[11px] text-[#fff4dc]"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="ENABLED">Đang bật</option>
            <option value="DISABLED">Đang tắt</option>
          </select>
        </div>

        {/* SCROLLABLE 100-FORTUNE LIST */}
        <div className="max-h-[320px] overflow-y-auto temple-scroll space-y-1.5 pr-1">
          {filteredFortunes.map((f) => {
            const ft = f.fortuneType || f.category;
            return (
              <div
                key={f.fortuneId}
                className={`rounded-lg border p-2.5 transition-colors ${
                  f.enabled
                    ? 'bg-[#130709] border-[#d4af37]/30'
                    : 'bg-[#0f0507]/60 border-white/10 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-[#2b0c12] border border-[#d4af37]/40 font-mono-tabular text-[10.5px] font-bold text-[#ffe89e] whitespace-nowrap">
                        #{formatFortuneCode(f.fortuneNumber)} · {formatQueXamHeader(f.fortuneNumber)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap ${getClassificationBadgeColor(
                          ft,
                        )}`}
                      >
                        {ft}
                      </span>
                      <span className="font-semibold text-[#fff3da]">
                        {f.fortuneTitle || f.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#d9c5a7] mt-1 leading-snug">
                      {f.interpretation}
                    </p>
                    {f.advice && (
                      <p className="text-[10.5px] text-[#ffe39c] mt-0.5 leading-snug">
                        Lời khuyên: {f.advice}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onPreviewFortuneResult && (
                      <button
                        type="button"
                        title="Xem trước bảng kết quả của quẻ này trên màn hình"
                        onClick={() =>
                          onPreviewFortuneResult({
                            username: demoUsername,
                            forcedFortuneNumber: f.fortuneNumber,
                          })
                        }
                        className="px-1.5 py-1 rounded bg-[#210b10] hover:bg-[#34111a] border border-[#d4af37]/35 text-[10px] font-semibold text-[#ffe89e] cursor-pointer"
                      >
                        Xem
                      </button>
                    )}
                    <button
                      type="button"
                      title="Thử nghi lễ 3D rút đúng quẻ này"
                      onClick={() =>
                        onTriggerDemoXinXam({
                          username: demoUsername,
                          forcedFortuneNumber: f.fortuneNumber,
                        })
                      }
                      className="px-1.5 py-1 rounded bg-[#2d0f16] hover:bg-[#421621] border border-[#d4af37]/40 text-[10px] font-semibold text-[#ffe082] cursor-pointer"
                    >
                      Thử 3D
                    </button>
                    <button
                      type="button"
                      title={f.enabled ? 'Tạm tắt quẻ xăm' : 'Bật lại quẻ xăm'}
                      onClick={() => void handleToggleFortuneEnabled(f)}
                      className="p-1 rounded hover:bg-white/10 text-[#cbb696] cursor-pointer"
                    >
                      {f.enabled ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Chỉnh sửa quẻ xăm & phân loại"
                      onClick={() => handleOpenEditFortune(f)}
                      className="p-1 rounded hover:bg-white/10 text-[#ffe082] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteId === f.fortuneId ? (
                      <button
                        type="button"
                        onClick={() => void handleConfirmDeleteFortune(f)}
                        className="px-1.5 py-0.5 rounded bg-[#b71c1c] text-white text-[10px] font-bold cursor-pointer"
                      >
                        Xóa!
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Xóa quẻ xăm"
                        onClick={() => setConfirmDeleteId(f.fortuneId)}
                        className="p-1 rounded hover:bg-white/10 text-[#e57373] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredFortunes.length === 0 && (
            <p className="text-center py-6 text-[#cbb696]">
              Không tìm thấy quẻ xăm phù hợp với bộ lọc.
            </p>
          )}
        </div>
      </div>

      {/* RECENT FORTUNE RESULTS LOG */}
      <div className="rounded-xl bg-[#1a0a0d] border border-[#d4af37]/35 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-[#ffe082]">Lịch Sử Rút Quẻ Gần Đây</h4>
          <span className="text-[10.5px] font-mono-tabular text-[#cbb696]">
            {recentDraws.length} lượt
          </span>
        </div>

        {recentDraws.length === 0 ? (
          <p className="text-[11px] text-[#b8a285]">
            Chưa có lượt rút quẻ nào trong phiên. Nhấn &ldquo;THỬ XIN XĂM 3D&rdquo; hoặc &ldquo;XEM
            TRƯỚC KẾT QUẢ&rdquo; để kiểm tra.
          </p>
        ) : (
          <div className="max-h-[175px] overflow-y-auto temple-scroll space-y-1.5 pr-1">
            {recentDraws.slice(0, 15).map((d) => (
              <div
                key={d.drawId}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#120608] border border-white/10 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-tabular font-bold text-[#ffe89e] whitespace-nowrap">
                      {formatQueXamHeader(d.fortuneNumber)}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-[#f3cf74]">
                      {d.fortuneType || d.category}
                    </span>
                    <span className="text-[#f5ead6] truncate">@{d.username}</span>
                  </div>
                  <p className="text-[10px] text-[#bfa98a] truncate">
                    {d.fortuneTitle || d.title}
                  </p>
                </div>
                <span className="text-[10px] font-mono-tabular text-[#cbb696] shrink-0">
                  {new Date(d.createdAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
