import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Edit3,
  KeyRound,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  AnnouncementPriority,
  CHARACTER_ANIMATION_OPTIONS,
  DEFAULT_GIFT_THANK_YOU_TEMPLATE,
  GiftActionPreset,
  GiftCharacterAnimType,
  GiftEffectType,
  GiftIconType,
  GiftMapping,
  GiftSoundEffectType,
  RITUAL_ACTION_OPTIONS,
  RitualActionType,
  SOUND_EFFECT_OPTIONS,
  StreamOverlaySettings,
  UnknownGiftRecord,
  VISUAL_EFFECT_OPTIONS,
  VOICE_PRIORITY_OPTIONS,
  getRitualDisplayNameVi,
  normalizeGiftId,
  renderGiftVoiceTemplate,
} from '../../types/temple';
import { GiftRegistrySnapshot, giftRegistry } from '../../systems/GiftRegistry';
import { voiceManager } from '../../systems/VoiceManager';
import { GiftVisualIcon } from './BuddhistGiftPanel';

interface GiftManagementPanelProps {
  registrySnapshot: GiftRegistrySnapshot;
  giftEventCounts: Record<string, number>;
  overlaySettings: StreamOverlaySettings;
  onUpdateOverlaySettings: (settings: StreamOverlaySettings) => void;
  onTestGiftInDemo: (mapping: GiftMapping, openSimulatorTab?: boolean) => void;
}

interface GiftFormDraft {
  giftId: string;
  giftName: string;
  vietnameseLabel: string;
  ceremonyTitle: string;
  badgeCeremonyLabel: string;
  iconType: GiftIconType;
  iconUrl: string;
  uploadedImageData: string;
  referenceCoins: number;
  points: number;
  isLarge: boolean;
  ritualType: RitualActionType;
  characterAnimation: GiftCharacterAnimType;
  effect: GiftEffectType;
  soundEffect: GiftSoundEffectType;
  ttsTemplate: string;
  voicePriority: AnnouncementPriority;
  animationDurationSec: number;
  cooldownSec: number;
  enabled: boolean;
  showInOverlayPanel: boolean;
}

function createEmptyDraft(): GiftFormDraft {
  return {
    giftId: '',
    giftName: '',
    vietnameseLabel: '',
    ceremonyTitle: 'CẦU BÌNH AN',
    badgeCeremonyLabel: 'LỄ PHẬT CẦU AN',
    iconType: 'lotus',
    iconUrl: '',
    uploadedImageData: '',
    referenceCoins: 10,
    points: 100,
    isLarge: false,
    ritualType: 'altar_flower',
    characterAnimation: 'walk_offer_bow',
    effect: 'lotus_petals',
    soundEffect: 'offering_chime',
    ttsTemplate: DEFAULT_GIFT_THANK_YOU_TEMPLATE,
    voicePriority: AnnouncementPriority.NORMAL_GIFT,
    animationDurationSec: 4.5,
    cooldownSec: 1.5,
    enabled: true,
    showInOverlayPanel: true,
  };
}

function mappingToDraft(m: GiftMapping): GiftFormDraft {
  return {
    giftId: normalizeGiftId(m.giftId),
    giftName: m.giftName || '',
    vietnameseLabel: m.vietnameseLabel || m.giftName || '',
    ceremonyTitle: m.ceremonyTitle || 'CẦU BÌNH AN',
    badgeCeremonyLabel: m.badgeCeremonyLabel || 'LỄ PHẬT CẦU AN',
    iconType: m.iconType || 'lotus',
    iconUrl: m.iconUrl || '',
    uploadedImageData: m.uploadedImageData || '',
    referenceCoins: Number(m.referenceCoins ?? 1),
    points: Number(m.points ?? 50),
    isLarge: Boolean(m.isLarge),
    ritualType: m.ritualType || 'altar_flower',
    characterAnimation: m.characterAnimation || 'walk_offer_bow',
    effect: m.effect || 'lotus_petals',
    soundEffect: m.soundEffect || 'offering_chime',
    ttsTemplate: m.ttsTemplate || DEFAULT_GIFT_THANK_YOU_TEMPLATE,
    voicePriority: m.voicePriority ?? AnnouncementPriority.NORMAL_GIFT,
    animationDurationSec: Number(m.animationDurationSec ?? 4.5),
    cooldownSec: Number(m.cooldownSec ?? 1.5),
    enabled: Boolean(m.enabled),
    showInOverlayPanel: m.showInOverlayPanel !== false,
  };
}

const TEMPLATE_VARIABLES: { token: string; label: string }[] = [
  { token: '{username}', label: 'Tên Phật tử' },
  { token: '{giftName}', label: 'Tên quà' },
  { token: '{giftCount}', label: 'Số lượng' },
  { token: '{meritPoints}', label: 'Điểm công đức' },
  { token: '{ritualName}', label: 'Tên nghi lễ' },
];

export function GiftManagementPanel({
  registrySnapshot,
  giftEventCounts,
  overlaySettings,
  onUpdateOverlaySettings,
  onTestGiftInDemo,
}: GiftManagementPanelProps) {
  const { gifts, presets, unknownGifts, storage, authRequired } = registrySnapshot;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Form modal / drawer state inside panel
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingOriginalGiftId, setEditingOriginalGiftId] = useState<string>('');
  const [draft, setDraft] = useState<GiftFormDraft>(() => createEmptyDraft());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Inline confirmation states (NEVER window.confirm / window.alert)
  const [confirmDeleteGiftId, setConfirmDeleteGiftId] = useState<string | null>(null);
  const [confirmResetDefaults, setConfirmResetDefaults] = useState(false);
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);

  // Custom Preset Creation State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showSavePresetBar, setShowSavePresetBar] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

  // Optional Admin Token Bar when server ADMIN_ACCESS_TOKEN is configured
  const [tokenInput, setTokenInput] = useState(() => giftRegistry.getAdminToken());

  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const formContainerRef = useRef<HTMLDivElement | null>(null);

  const showToast = (ok: boolean, message: string) => {
    setFeedbackBanner({ ok, message });
    window.setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const filteredGifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return gifts.filter((g) => {
      if (statusFilter === 'enabled' && !g.enabled) return false;
      if (statusFilter === 'disabled' && g.enabled) return false;
      if (!q) return true;
      return (
        g.giftId.toLowerCase().includes(q) ||
        g.giftName.toLowerCase().includes(q) ||
        g.vietnameseLabel.toLowerCase().includes(q) ||
        g.ceremonyTitle.toLowerCase().includes(q)
      );
    });
  }, [gifts, searchQuery, statusFilter]);

  const openCreateForm = (prefill?: Partial<GiftFormDraft>) => {
    setFormError(null);
    setEditingOriginalGiftId('');
    setSelectedPresetId('');
    setDraft({
      ...createEmptyDraft(),
      ...prefill,
    });
    setFormMode('create');
    window.setTimeout(() => {
      formContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const openEditForm = (item: GiftMapping) => {
    setFormError(null);
    setEditingOriginalGiftId(item.giftId);
    setSelectedPresetId('');
    setDraft(mappingToDraft(item));
    setFormMode('edit');
    window.setTimeout(() => {
      formContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handleDuplicateGift = (item: GiftMapping) => {
    let suffix = 1;
    let candidateId = `${item.giftId}_copy`;
    const existingIds = new Set(gifts.map((g) => normalizeGiftId(g.giftId)));
    while (existingIds.has(candidateId)) {
      suffix += 1;
      candidateId = `${item.giftId}_copy${suffix}`;
    }
    openCreateForm({
      ...mappingToDraft(item),
      giftId: candidateId,
      vietnameseLabel: `${item.vietnameseLabel} (Bản sao)`,
    });
    showToast(
      true,
      `Đã nhân bản cấu hình từ "${item.vietnameseLabel}". Hãy nhập TikTok Gift ID thực rồi nhấn Lưu.`,
    );
  };

  const handleUnknownGiftConfigure = (unk: UnknownGiftRecord) => {
    openCreateForm({
      giftId: unk.giftId,
      giftName: unk.giftName,
      vietnameseLabel: unk.giftName,
      iconUrl: unk.iconUrl || '',
      referenceCoins: Math.max(1, unk.diamondCount || 1),
      points: Math.max(20, (unk.diamondCount || 1) * 10),
      isLarge: (unk.diamondCount || 0) >= 99,
      voicePriority:
        (unk.diamondCount || 0) >= 99
          ? AnnouncementPriority.LARGE_GIFT
          : AnnouncementPriority.NORMAL_GIFT,
    });
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = presets.find((p) => p.presetId === presetId);
    if (!found) return;
    setDraft((prev) => ({
      ...prev,
      ritualType: found.ritualType,
      characterAnimation: found.characterAnimation,
      effect: found.effect,
      soundEffect: found.soundEffect,
      ttsTemplate: found.ttsTemplate,
      voicePriority: found.voicePriority,
      animationDurationSec: found.animationDurationSec,
      cooldownSec: found.cooldownSec,
      isLarge: found.voicePriority === AnnouncementPriority.LARGE_GIFT,
    }));
  };

  const handleSaveCurrentAsPreset = async () => {
    if (!newPresetName.trim()) {
      setFormError('Vui lòng nhập tên Bộ Mẫu Hành Động trước khi lưu.');
      return;
    }
    try {
      const saved = await giftRegistry.savePreset({
        name: newPresetName.trim(),
        description:
          newPresetDesc.trim() ||
          `${getRitualDisplayNameVi(draft.ritualType)} · ${draft.animationDurationSec}s`,
        ritualType: draft.ritualType,
        characterAnimation: draft.characterAnimation,
        effect: draft.effect,
        soundEffect: draft.soundEffect,
        ttsTemplate: draft.ttsTemplate,
        voicePriority: draft.voicePriority,
        animationDurationSec: draft.animationDurationSec,
        cooldownSec: draft.cooldownSec,
      });
      setSelectedPresetId(saved.presetId);
      setNewPresetName('');
      setNewPresetDesc('');
      setShowSavePresetBar(false);
      showToast(true, `Đã lưu bộ mẫu hành động "${saved.name}".`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu bộ mẫu.');
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Chỉ hỗ trợ tệp hình ảnh (PNG, JPG, WEBP, SVG, GIF).');
      return;
    }
    if (file.size > 180 * 1024) {
      setFormError('Ảnh tải lên cần nhỏ hơn 180KB để tối ưu tốc độ đồng bộ livestream.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.length > 260_000) {
        setFormError('Dữ liệu ảnh vượt quá giới hạn 250KB. Vui lòng chọn ảnh nhỏ hơn.');
        return;
      }
      setFormError(null);
      setDraft((prev) => ({ ...prev, uploadedImageData: result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanGiftId = normalizeGiftId(draft.giftId);
    if (!cleanGiftId) {
      setFormError('TikTok Gift ID là bắt buộc (ví dụ: 5655).');
      return;
    }
    if (!/^[a-zA-Z0-9_.:-]+$/.test(cleanGiftId)) {
      setFormError('TikTok Gift ID chỉ được chứa chữ, số hoặc ký tự gạch ngang/gạch dưới.');
      return;
    }
    if (!draft.vietnameseLabel.trim() && !draft.giftName.trim()) {
      setFormError('Vui lòng nhập Tên quà TikTok hoặc Tên hiển thị tiếng Việt.');
      return;
    }
    if (!Number.isFinite(draft.points) || draft.points < 0 || draft.points > 1_000_000) {
      setFormError('Điểm công đức phải nằm trong khoảng 0 đến 1.000.000.');
      return;
    }
    if (
      !Number.isFinite(draft.animationDurationSec) ||
      draft.animationDurationSec < 1.5 ||
      draft.animationDurationSec > 20
    ) {
      setFormError('Thời lượng nghi lễ phải từ 1.5 giây đến 20 giây.');
      return;
    }

    const payload: Partial<GiftMapping> = {
      id: cleanGiftId,
      giftId: cleanGiftId,
      giftName: draft.giftName.trim() || draft.vietnameseLabel.trim(),
      vietnameseLabel: draft.vietnameseLabel.trim() || draft.giftName.trim(),
      ceremonyTitle: draft.ceremonyTitle.trim() || 'CẦU BÌNH AN',
      badgeCeremonyLabel:
        draft.badgeCeremonyLabel.trim() || draft.ceremonyTitle.trim() || 'LỄ PHẬT CẦU AN',
      iconType: draft.iconType,
      iconUrl: draft.iconUrl.trim() || undefined,
      uploadedImageData: draft.uploadedImageData || undefined,
      referenceCoins: Math.max(0, Math.round(Number(draft.referenceCoins) || 0)),
      points: Math.max(0, Math.round(Number(draft.points) || 0)),
      isLarge: draft.isLarge,
      ritualType: draft.ritualType,
      characterAnimation:
        draft.ritualType === 'no_animation' ? 'none' : draft.characterAnimation,
      effect: draft.effect,
      soundEffect: draft.soundEffect,
      ttsTemplate: draft.ttsTemplate.trim() || DEFAULT_GIFT_THANK_YOU_TEMPLATE,
      voicePriority: draft.voicePriority,
      animationDurationSec: Number(draft.animationDurationSec),
      cooldownSec: Math.max(0, Number(draft.cooldownSec) || 0),
      enabled: draft.enabled,
      showInOverlayPanel: draft.showInOverlayPanel,
    };

    setSaving(true);
    try {
      if (formMode === 'create') {
        const created = await giftRegistry.createGift(payload);
        showToast(
          true,
          `Đã thêm quà "${created.vietnameseLabel}" (Gift ID: ${created.giftId}) thành công.`,
        );
      } else {
        const updated = await giftRegistry.updateGift(editingOriginalGiftId, payload);
        showToast(
          true,
          `Đã cập nhật quà "${updated.vietnameseLabel}" (Gift ID: ${updated.giftId}) không cần tải lại trang.`,
        );
      }
      setFormMode('closed');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình quà tặng.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (item: GiftMapping) => {
    try {
      await giftRegistry.updateGift(item.giftId, {
        ...item,
        enabled: !item.enabled,
      });
      showToast(
        true,
        `${!item.enabled ? 'Đã bật' : 'Đã tạm tắt'} quà "${item.vietnameseLabel}" (ID: ${item.giftId}).`,
      );
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Không thể đổi trạng thái quà.');
    }
  };

  const handleConfirmDelete = async (giftId: string) => {
    try {
      await giftRegistry.deleteGift(giftId);
      setConfirmDeleteGiftId(null);
      if (formMode === 'edit' && editingOriginalGiftId === giftId) {
        setFormMode('closed');
      }
      showToast(true, `Đã xóa cấu hình Gift ID "${giftId}".`);
    } catch (err) {
      showToast(false, err instanceof Error ? err.message : 'Không thể xóa quà tặng.');
    }
  };

  const handleExportJson = () => {
    const jsonStr = giftRegistry.buildExportJsonString();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chua-online-gifts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(true, `Đã xuất ${gifts.length} cấu hình quà tặng ra tệp JSON.`);
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const { importedCount } = await giftRegistry.importJson(parsed, importMode);
      showToast(
        true,
        `Đã nhập thành công ${importedCount} quà tặng (${
          importMode === 'replace' ? 'Thay thế toàn bộ' : 'Gộp thêm'
        }).`,
      );
    } catch (err) {
      showToast(
        false,
        err instanceof Error
          ? `Lỗi nhập JSON: ${err.message}`
          : 'Tệp JSON không hợp lệ hoặc sai định dạng.',
      );
    } finally {
      e.target.value = '';
    }
  };

  const handlePreviewVoiceForGift = (params: {
    ttsTemplate: string;
    vietnameseLabel: string;
    giftName: string;
    points: number;
    ritualType: RitualActionType;
    soundEffect: GiftSoundEffectType;
    isLarge: boolean;
  }) => {
    const previewText = renderGiftVoiceTemplate(params.ttsTemplate, {
      username: 'Minh Anh',
      giftName: params.vietnameseLabel || params.giftName || 'Hoa Sen',
      giftCount: 1,
      meritPoints: params.points || 100,
      ritualName: getRitualDisplayNameVi(params.ritualType),
    });
    const playBell =
      params.soundEffect === 'temple_bell' ||
      params.soundEffect === 'grand_ceremony_bell' ||
      params.isLarge;
    voiceManager.previewGiftVoice(previewText, playBell);
  };

  const livePreviewSpeech = renderGiftVoiceTemplate(draft.ttsTemplate, {
    username: 'Minh Anh',
    giftName: draft.vietnameseLabel || draft.giftName || 'Lễ Vật',
    giftCount: 2,
    meritPoints: (draft.points || 0) * 2,
    ritualName: getRitualDisplayNameVi(draft.ritualType),
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Header Banner: QUẢN LÝ QUÀ TẶNG TIKTOK */}
      <div className="rounded-xl bg-gradient-to-b from-[#330b13] to-[#1a080b] border border-[#d4af37]/45 p-3.5 shadow-md space-y-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold tracking-wide text-[#ffe28a] flex items-center gap-1.5">
              <span>🪷</span>
              <span>QUẢN LÝ QUÀ TẶNG TIKTOK</span>
            </h3>
            <p className="text-[11px] text-[#d6c2a3] mt-0.5 leading-relaxed">
              Tra cứu chính xác theo <strong className="text-[#ffe28a]">TikTok Gift ID</strong> duy nhất. Mọi thay đổi áp dụng ngay lập tức cho cả TikTok LIVE &amp; Demo không cần biên dịch lại.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openCreateForm()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#d4af37] hover:bg-[#e5c24f] text-[#1a0c05] text-xs font-bold shadow transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ THÊM QUÀ TẶNG</span>
          </button>
        </div>

        {/* Search, Filter & JSON Import/Export Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
          <div className="sm:col-span-7 relative">
            <Search className="w-3.5 h-3.5 text-[#b8a285] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên quà hoặc Gift ID (VD: 5655)..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#0d0506] border border-[#d4af37]/30 text-xs text-[#fff4dc] focus:outline-none focus:border-[#d4af37]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#b8a285] hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="sm:col-span-5">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'enabled' | 'disabled')
              }
              aria-label="Lọc trạng thái quà tặng"
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d0506] border border-[#d4af37]/30 text-xs text-[#fff4dc] focus:outline-none focus:border-[#d4af37]"
            >
              <option value="all">Tất cả ({gifts.length} quà)</option>
              <option value="enabled">
                Đang bật ({gifts.filter((g) => g.enabled).length})
              </option>
              <option value="disabled">
                Đã tắt ({gifts.filter((g) => !g.enabled).length})
              </option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#d4af37]/20">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={jsonFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleImportJsonFile(e)}
              className="hidden"
            />
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
              aria-label="Chế độ nhập JSON"
              className="px-2 py-1 rounded bg-[#120608] border border-white/15 text-[10.5px] text-[#e6d5b8]"
            >
              <option value="merge">Nhập: Gộp thêm</option>
              <option value="replace">Nhập: Thay thế</option>
            </select>

            <button
              type="button"
              onClick={() => jsonFileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#261015] hover:bg-[#38171f] border border-[#d4af37]/35 text-[11px] font-medium text-[#ffe39c] cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>Nhập JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#261015] hover:bg-[#38171f] border border-[#d4af37]/35 text-[11px] font-medium text-[#ffe39c] cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Xuất JSON</span>
            </button>
          </div>

          {!confirmResetDefaults ? (
            <button
              type="button"
              onClick={() => setConfirmResetDefaults(true)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-[#230d10] hover:bg-[#351318] border border-white/15 text-[10.5px] text-[#cbb696] hover:text-[#ffe082] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Mặc định</span>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await giftRegistry.resetDefaults();
                    setConfirmResetDefaults(false);
                    showToast(true, 'Đã khôi phục 5 cấu hình quà tặng mặc định.');
                  } catch (err) {
                    showToast(
                      false,
                      err instanceof Error ? err.message : 'Lỗi khôi phục mặc định.',
                    );
                  }
                }}
                className="px-2 py-1 rounded bg-red-800/80 hover:bg-red-700 text-[10.5px] font-semibold text-white cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetDefaults(false)}
                className="px-2 py-1 rounded bg-white/10 text-[10.5px] text-[#e6d5b8] cursor-pointer"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Optional Admin Token Protection Bar (shown if ADMIN_ACCESS_TOKEN is active on server) */}
      {authRequired && (
        <div className="rounded-lg bg-[#251209] border border-[#f5cd63]/45 px-3 py-2 flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-[#ffe082] shrink-0" />
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Nhập mã ADMIN_ACCESS_TOKEN để lưu chỉnh sửa..."
            className="flex-1 px-2 py-1 rounded bg-[#0c0604] border border-white/15 text-[11px] text-[#fff4dc]"
          />
          <button
            type="button"
            onClick={() => {
              giftRegistry.setAdminToken(tokenInput);
              showToast(true, 'Đã lưu khóa xác thực Quản trị viên trong phiên này.');
            }}
            className="px-2.5 py-1 rounded bg-[#d4af37] text-[#1a0d06] text-[11px] font-semibold cursor-pointer"
          >
            Áp dụng
          </button>
        </div>
      )}

      {/* Status Toast Banner */}
      {feedbackBanner && (
        <div
          className={`rounded-lg px-3 py-2 border flex items-center justify-between gap-2 text-[11px] ${
            feedbackBanner.ok
              ? 'bg-[#132919] border-[#4ca965]/50 text-[#b5f5c6]'
              : 'bg-[#361215] border-red-400/50 text-red-200'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {feedbackBanner.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="opacity-75 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==========================================================================
          CREATE / EDIT GIFT DRAWER FORM (No page reload, full presets & voice preview)
         ========================================================================== */}
      {formMode !== 'closed' && (
        <div
          ref={formContainerRef}
          className="rounded-xl bg-gradient-to-b from-[#2b0c12] to-[#16070a] border-2 border-[#d4af37]/65 p-3.5 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#d4af37]/25 pb-2">
            <div>
              <h4 className="font-display text-sm font-bold text-[#ffe28a]">
                {formMode === 'create'
                  ? '✨ THÊM CẤU HÌNH QUÀ TẶNG TIKTOK MỚI'
                  : `✏️ CHỈNH SỬA QUÀ TẶNG (ID: ${editingOriginalGiftId})`}
              </h4>
              <p className="text-[10.5px] text-[#cbb696]">
                Ánh xạ trực tiếp từ TikTok Gift ID sang nghi lễ 3D, hiệu ứng &amp; giọng đọc VieNeuTTS.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormMode('closed')}
              aria-label="Đóng biểu mẫu"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#ffe082] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Reusable Event-Action Preset Selector & Creator */}
          <div className="rounded-lg bg-[#18070a] border border-[#d4af37]/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#ffe082] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bộ Mẫu Hành Động Tái Sử Dụng (Presets)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSavePresetBar((v) => !v)}
                className="text-[10.5px] text-[#f5cd63] hover:underline cursor-pointer"
              >
                {showSavePresetBar ? 'Đóng lưu mẫu' : '+ Lưu thiết lập hiện tại thành Mẫu'}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedPresetId}
                onChange={(e) => handleApplyPreset(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded bg-[#0c0406] border border-white/15 text-xs text-[#fff4dc]"
              >
                <option value="">-- Chọn bộ mẫu nghi lễ có sẵn để điền nhanh --</option>
                {presets.map((p: GiftActionPreset) => (
                  <option key={p.presetId} value={p.presetId}>
                    {p.isBuiltin ? '🪷 ' : '⭐ '}
                    {p.name} ({getRitualDisplayNameVi(p.ritualType)})
                  </option>
                ))}
              </select>

              {selectedPresetId &&
                presets.find((p) => p.presetId === selectedPresetId && !p.isBuiltin) && (
                  <>
                    {confirmDeletePresetId === selectedPresetId ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await giftRegistry.deletePreset(selectedPresetId);
                            setSelectedPresetId('');
                            setConfirmDeletePresetId(null);
                            showToast(true, 'Đã xóa bộ mẫu tùy chỉnh.');
                          } catch (err) {
                            setFormError(
                              err instanceof Error ? err.message : 'Lỗi xóa bộ mẫu.',
                            );
                          }
                        }}
                        className="px-2 py-1.5 rounded bg-red-700 text-[10.5px] font-semibold text-white shrink-0 cursor-pointer"
                      >
                        Xóa!
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePresetId(selectedPresetId)}
                        title="Xóa bộ mẫu tùy chỉnh này"
                        className="p-1.5 rounded bg-[#361116] text-red-200 border border-red-400/30 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
            </div>

            {showSavePresetBar && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 pt-1">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Tên mẫu mới (VD: Đại Lễ Chuông Vàng)"
                  className="sm:col-span-5 px-2 py-1 rounded bg-[#0c0406] border border-white/15 text-[11px] text-[#fff4dc]"
                />
                <input
                  type="text"
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="Mô tả ngắn..."
                  className="sm:col-span-5 px-2 py-1 rounded bg-[#0c0406] border border-white/15 text-[11px] text-[#fff4dc]"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveCurrentAsPreset()}
                  className="sm:col-span-2 px-2 py-1 rounded bg-[#d4af37] text-[#1a0d06] font-semibold text-[11px] cursor-pointer"
                >
                  Lưu Mẫu
                </button>
              </div>
            )}
          </div>

          <form onSubmit={(e) => void handleSubmitForm(e)} className="space-y-3">
            {/* Row 1: Identity & Names */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10.5px] font-semibold text-[#ffe082] mb-1">
                  TikTok Gift ID * (Duy nhất)
                </label>
                <input
                  type="text"
                  required
                  value={draft.giftId}
                  onChange={(e) => setDraft({ ...draft, giftId: e.target.value })}
                  placeholder="VD: 5655"
                  className="w-full px-2.5 py-1.5 rounded bg-[#0b0405] border border-[#d4af37]/45 font-mono-tabular text-xs text-[#ffe599] focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Tên quà TikTok (Gốc)
                </label>
                <input
                  type="text"
                  value={draft.giftName}
                  onChange={(e) => setDraft({ ...draft, giftName: e.target.value })}
                  placeholder="VD: Rose"
                  className="w-full px-2.5 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Tên hiển thị Tiếng Việt *
                </label>
                <input
                  type="text"
                  required
                  value={draft.vietnameseLabel}
                  onChange={(e) => setDraft({ ...draft, vietnameseLabel: e.target.value })}
                  placeholder="VD: Hoa Hồng"
                  className="w-full px-2.5 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                />
              </div>
            </div>

            {/* Row 2: Coins, Merit Points, Prayer Headers */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Xu (Tham chiếu)
                </label>
                <input
                  type="number"
                  min={0}
                  max={999999}
                  value={draft.referenceCoins}
                  onChange={(e) =>
                    setDraft({ ...draft, referenceCoins: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 font-mono-tabular text-xs text-[#ffd978]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-[#ffe082] mb-1">
                  Điểm Công Đức *
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={draft.points}
                  onChange={(e) =>
                    setDraft({ ...draft, points: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-[#d4af37]/40 font-mono-tabular text-xs text-[#9ef0b4]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Tiêu đề cầu nguyện
                </label>
                <input
                  type="text"
                  value={draft.ceremonyTitle}
                  onChange={(e) => setDraft({ ...draft, ceremonyTitle: e.target.value })}
                  placeholder="CẦU BÌNH AN"
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Nhãn Hoa Sen Avatar
                </label>
                <input
                  type="text"
                  value={draft.badgeCeremonyLabel}
                  onChange={(e) => setDraft({ ...draft, badgeCeremonyLabel: e.target.value })}
                  placeholder="LỄ PHẬT CẦU AN"
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                />
              </div>
            </div>

            {/* Row 3: Icon Vector Fallback + Icon URL + Optional Image Upload */}
            <div className="rounded-lg bg-[#160609] border border-white/10 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GiftVisualIcon
                    gift={{
                      iconType: draft.iconType,
                      iconUrl: draft.iconUrl,
                      uploadedImageData: draft.uploadedImageData,
                      vietnameseLabel: draft.vietnameseLabel || 'Icon',
                    }}
                    sizeClass="w-7 h-7"
                  />
                  <div>
                    <p className="text-[11px] font-semibold text-[#ffe39c]">
                      Biểu tượng &amp; Ảnh Quà Tặng
                    </p>
                    <p className="text-[10px] text-[#b8a285]">
                      Hỗ trợ biểu tượng chùa, URL ảnh ngoài, Emoji hoặc tải ảnh lên (&le;180KB).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    ref={imageUploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => imageUploadInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2d1016] hover:bg-[#3f161f] border border-[#d4af37]/35 text-[10.5px] text-[#ffe082] cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Tải ảnh lên</span>
                  </button>
                  {draft.uploadedImageData && (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, uploadedImageData: '' })}
                      className="px-2 py-1 rounded bg-red-900/50 text-[10.5px] text-red-200 cursor-pointer"
                    >
                      Xóa ảnh tải
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#b8a285] mb-1">
                    Biểu tượng mặc định
                  </label>
                  <select
                    value={draft.iconType}
                    onChange={(e) =>
                      setDraft({ ...draft, iconType: e.target.value as GiftIconType })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                  >
                    <option value="rose">Hoa Hồng</option>
                    <option value="bell">Chuông Đồng</option>
                    <option value="fruit">Mâm Ngũ Quả</option>
                    <option value="lotus">Đài Sen</option>
                    <option value="pagoda">Bảo Tháp</option>
                    <option value="incense">Lư Hương</option>
                    <option value="wooden_fish">Mõ Tụng Kinh</option>
                    <option value="prayer">Chắp Tay Lễ Phật</option>
                    <option value="light">Hào Quang Vàng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-[#b8a285] mb-1">
                    URL ảnh quà tặng hoặc Emoji (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={draft.iconUrl}
                    onChange={(e) => setDraft({ ...draft, iconUrl: e.target.value })}
                    placeholder="https://... hoặc 🪷"
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Ritual Action, Character Animation, Visual Effect, Sound Effect */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] font-semibold text-[#ffe082] mb-1">
                  Hành động nghi lễ (11 chế độ)
                </label>
                <select
                  value={draft.ritualType}
                  onChange={(e) => {
                    const nextRitual = e.target.value as RitualActionType;
                    let nextAnim = draft.characterAnimation;
                    if (nextRitual === 'no_animation') nextAnim = 'none';
                    else if (nextRitual === 'altar_bell') nextAnim = 'walk_ring_bell';
                    else if (nextRitual === 'altar_wooden_fish') nextAnim = 'walk_wooden_fish';
                    else if (nextRitual === 'altar_grand_ceremony') nextAnim = 'walk_prostrate_3';
                    else if (nextRitual === 'altar_pray_clasped') nextAnim = 'walk_kneel_pray';
                    else if (nextAnim === 'none') nextAnim = 'walk_offer_bow';
                    setDraft({
                      ...draft,
                      ritualType: nextRitual,
                      characterAnimation: nextAnim,
                    });
                  }}
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-[#d4af37]/40 text-xs text-[#fff4dc]"
                >
                  {RITUAL_ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.labelVi}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Chuyển động nhân vật 3D
                </label>
                <select
                  value={draft.characterAnimation}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      characterAnimation: e.target.value as GiftCharacterAnimType,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                >
                  {CHARACTER_ANIMATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.labelVi}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Hiệu ứng hình ảnh 3D
                </label>
                <select
                  value={draft.effect}
                  onChange={(e) =>
                    setDraft({ ...draft, effect: e.target.value as GiftEffectType })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                >
                  {VISUAL_EFFECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.labelVi}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Hiệu ứng âm thanh chùa
                </label>
                <select
                  value={draft.soundEffect}
                  onChange={(e) =>
                    setDraft({ ...draft, soundEffect: e.target.value as GiftSoundEffectType })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                >
                  {SOUND_EFFECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.labelVi}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 5: Priority, Duration & Cooldown */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Ưu tiên giọng đọc
                </label>
                <select
                  value={draft.voicePriority}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      voicePriority: Number(e.target.value) as AnnouncementPriority,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 text-xs text-[#fff4dc]"
                >
                  {VOICE_PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.labelVi}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Thời lượng lễ (giây)
                </label>
                <input
                  type="number"
                  step="0.2"
                  min={1.5}
                  max={20}
                  value={draft.animationDurationSec}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      animationDurationSec: Number(e.target.value) || 4.5,
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 font-mono-tabular text-xs text-[#fff4dc]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-[#cbb696] mb-1">
                  Cooldown chống lặp (s)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={120}
                  value={draft.cooldownSec}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      cooldownSec: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full px-2 py-1.5 rounded bg-[#0b0405] border border-white/15 font-mono-tabular text-xs text-[#fff4dc]"
                />
              </div>
            </div>

            {/* Row 6: VieNeuTTS Narration Template + Variable Chips + Voice Preview */}
            <div className="rounded-lg bg-[#160609] border border-[#d4af37]/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold text-[#ffe082]">
                  Mẫu Lời Chúc Tự Động VieNeuTTS
                </label>
                <button
                  type="button"
                  onClick={() =>
                    handlePreviewVoiceForGift({
                      ttsTemplate: draft.ttsTemplate,
                      vietnameseLabel: draft.vietnameseLabel,
                      giftName: draft.giftName,
                      points: draft.points,
                      ritualType: draft.ritualType,
                      soundEffect: draft.soundEffect,
                      isLarge: draft.isLarge,
                    })
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#d4af37]/20 hover:bg-[#d4af37]/35 border border-[#d4af37]/55 text-[10.5px] font-semibold text-[#ffe28a] cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Nghe thử giọng đọc</span>
                </button>
              </div>

              <textarea
                rows={2}
                value={draft.ttsTemplate}
                onChange={(e) => setDraft({ ...draft, ttsTemplate: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-[#090304] border border-white/15 text-xs text-[#fff4dc] focus:outline-none focus:border-[#d4af37]"
              />

              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-[#b8a285] mr-1">Chèn biến:</span>
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        ttsTemplate: `${prev.ttsTemplate.trim()} ${v.token}`,
                      }))
                    }
                    title={v.label}
                    className="px-1.5 py-0.5 rounded bg-[#290d13] hover:bg-[#3c131c] border border-[#d4af37]/30 font-mono-tabular text-[10px] text-[#ffe082] cursor-pointer"
                  >
                    {v.token}
                  </button>
                ))}
              </div>

              <p className="text-[10.5px] text-[#cbb696] italic bg-[#0d0406] rounded px-2 py-1 border border-white/5">
                Xem trước (2 lễ): &ldquo;{livePreviewSpeech}&rdquo;
              </p>
            </div>

            {/* Row 7: Flags */}
            <div className="flex flex-wrap items-center gap-4 pt-0.5">
              <label className="flex items-center gap-1.5 text-[11px] text-[#fff4dc] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  className="accent-[#d4af37]"
                />
                <span>Kích hoạt (Enabled)</span>
              </label>

              <label className="flex items-center gap-1.5 text-[11px] text-[#e6d5b8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.showInOverlayPanel}
                  onChange={(e) =>
                    setDraft({ ...draft, showInOverlayPanel: e.target.checked })
                  }
                  className="accent-[#d4af37]"
                />
                <span>Hiện trên bảng góc Cúng Dường</span>
              </label>

              <label className="flex items-center gap-1.5 text-[11px] text-[#ffe082] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isLarge}
                  onChange={(e) => setDraft({ ...draft, isLarge: e.target.checked })}
                  className="accent-[#d4af37]"
                />
                <span>Quà lớn (Banner Đại Lễ)</span>
              </label>
            </div>

            {formError && (
              <div className="rounded-lg bg-[#3b1216] border border-red-400/50 px-3 py-2 text-[11px] text-red-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() => setFormMode('closed')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-[#e6d5b8] cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e5c24e] disabled:opacity-50 text-[#180c05] text-xs font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {saving
                    ? 'Đang lưu...'
                    : formMode === 'create'
                      ? 'Lưu Quà Mới'
                      : 'Cập Nhật Quà'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          COMPACT ADMIN GIFT TABLE (Dark Burgundy & Gold, All Required Columns)
         ========================================================================== */}
      <div className="rounded-xl bg-[#18080b] border border-[#d4af37]/35 overflow-hidden shadow">
        <div className="overflow-x-auto temple-scroll">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#3b0c15] to-[#26080e] border-b border-[#d4af37]/35 text-[10px] font-semibold uppercase tracking-wider text-[#ffe082]">
                <th className="py-2 px-2">Icon</th>
                <th className="py-2 px-1.5">Gift ID</th>
                <th className="py-2 px-1.5">Tên Quà</th>
                <th className="py-2 px-1.5 text-right">Xu</th>
                <th className="py-2 px-1.5 text-right">Công Đức</th>
                <th className="py-2 px-1.5">Nghi Lễ</th>
                <th className="py-2 px-1.5 text-center">Bật</th>
                <th className="py-2 px-2 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d4af37]/15 text-[11px]">
              {filteredGifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 px-3 text-center text-[#b8a285]">
                    Không tìm thấy cấu hình quà tặng phù hợp. Nhấn{' '}
                    <strong className="text-[#ffe28a]">+ THÊM QUÀ TẶNG</strong> để tạo mới.
                  </td>
                </tr>
              ) : (
                filteredGifts.map((gm) => {
                  const receivedCount =
                    giftEventCounts[gm.giftId] ?? giftEventCounts[gm.id] ?? 0;
                  const isDeleting = confirmDeleteGiftId === gm.giftId;

                  return (
                    <tr
                      key={gm.giftId}
                      className={`transition-colors ${
                        gm.enabled
                          ? 'hover:bg-[#2c0d14]/70 text-[#fff4dc]'
                          : 'bg-[#110507]/80 text-[#9c8974] opacity-75'
                      }`}
                    >
                      <td className="py-2 px-2">
                        <GiftVisualIcon gift={gm} sizeClass="w-5 h-5" />
                      </td>

                      <td className="py-2 px-1.5 font-mono-tabular font-semibold text-[#ffe28a] whitespace-nowrap">
                        {gm.giftId}
                      </td>

                      <td className="py-2 px-1.5 max-w-[110px]">
                        <p className="font-semibold truncate" title={gm.vietnameseLabel}>
                          {gm.vietnameseLabel}
                        </p>
                        <p className="text-[9.5px] text-[#b8a285] truncate">
                          {gm.giftName}
                          {receivedCount > 0 ? ` · ${receivedCount} lễ` : ''}
                        </p>
                      </td>

                      <td className="py-2 px-1.5 text-right font-mono-tabular text-[#ffd978] whitespace-nowrap">
                        {gm.referenceCoins}
                      </td>

                      <td className="py-2 px-1.5 text-right font-mono-tabular font-semibold text-[#9ef0b4] whitespace-nowrap">
                        +{gm.points}
                      </td>

                      <td className="py-2 px-1.5 whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[#2b0e14] border border-[#d4af37]/25 text-[10px] text-[#ffe49e]">
                          {getRitualDisplayNameVi(gm.ritualType)}
                        </span>
                      </td>

                      <td className="py-2 px-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={gm.enabled}
                          onChange={() => void handleToggleEnabled(gm)}
                          aria-label={`Bật hoặc tắt ${gm.vietnameseLabel}`}
                          className="accent-[#d4af37] cursor-pointer"
                        />
                      </td>

                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        {isDeleting ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleConfirmDelete(gm.giftId)}
                              title="Xác nhận xóa quà tặng này"
                              className="px-1.5 py-1 rounded bg-red-700 hover:bg-red-600 text-[10px] font-bold text-white cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteGiftId(null)}
                              className="px-1.5 py-1 rounded bg-white/10 text-[10px] text-[#e6d5b8] cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onTestGiftInDemo(gm, false)}
                              title="Test ngay nghi lễ 3D & giọng đọc trong Demo"
                              className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded bg-[#2d140a] hover:bg-[#421e0f] border border-[#f5cd63]/45 text-[10px] font-semibold text-[#ffe28a] cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>Test</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handlePreviewVoiceForGift({
                                  ttsTemplate: gm.ttsTemplate,
                                  vietnameseLabel: gm.vietnameseLabel,
                                  giftName: gm.giftName,
                                  points: gm.points,
                                  ritualType: gm.ritualType,
                                  soundEffect: gm.soundEffect,
                                  isLarge: gm.isLarge,
                                })
                              }
                              title="Nghe thử mẫu câu VieNeuTTS"
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-[#ffe082] cursor-pointer"
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(gm)}
                              title="Chỉnh sửa (Edit)"
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-[#f5ead6] cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateGift(gm)}
                              title="Nhân bản cấu hình (Duplicate)"
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-[#cbb696] cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteGiftId(gm.giftId)}
                              title="Xóa cấu hình (Delete)"
                              className="p-1 rounded bg-[#331014] hover:bg-[#4d171d] text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==========================================================================
          UNKNOWN INCOMING GIFTS LOG ("QUÀ CHƯA CẤU HÌNH" — 1-Click Mapping)
         ========================================================================== */}
      <div className="rounded-xl bg-[#1b0b0e] border border-[#d4af37]/30 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-display text-xs font-bold tracking-wide text-[#ffe082]">
              QUÀ CHƯA CẤU HÌNH ({unknownGifts.length})
            </h4>
            <p className="text-[10.5px] text-[#b8a285]">
              Tự động ghi nhận các TikTok Gift ID lạ gửi vào phòng LIVE hoặc Demo để tạo cấu hình bằng 1 cú nhấp.
            </p>
          </div>
          {unknownGifts.length > 0 && (
            <button
              type="button"
              onClick={() => void giftRegistry.clearUnknownGifts()}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10.5px] text-[#cbb696] shrink-0 cursor-pointer"
            >
              Xóa nhật ký
            </button>
          )}
        </div>

        {unknownGifts.length === 0 ? (
          <p className="text-[11px] text-[#9e8a72] bg-[#110608] rounded-lg px-3 py-2 border border-white/5">
            Chưa phát hiện Gift ID lạ nào. Mọi quà chưa ánh xạ sẽ xuất hiện tại đây mà không gây lỗi hệ thống.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto temple-scroll">
            {unknownGifts.map((unk) => (
              <div
                key={unk.giftId}
                className="flex items-center justify-between gap-2 rounded-lg bg-[#120507] border border-[#d4af37]/25 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-tabular font-bold text-[#ffe28a]">
                      ID: {unk.giftId}
                    </span>
                    <span className="font-medium text-[#fff4dc] truncate">{unk.giftName}</span>
                    <span
                      className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                        unk.isDemo
                          ? 'bg-amber-900/60 text-amber-200'
                          : 'bg-emerald-900/60 text-emerald-200'
                      }`}
                    >
                      {unk.isDemo ? 'DEMO' : 'LIVE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#b8a285] truncate">
                    ~{unk.diamondCount} xu · Đã nhận {unk.occurrenceCount} lần · Từ @
                    {unk.sampleUsername}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleUnknownGiftConfigure(unk)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#d4af37] hover:bg-[#e5c24e] text-[#1a0c05] text-[10.5px] font-bold shrink-0 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>Tạo cấu hình</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global Sanctuary Ceremony Concurrency & Persistent SQLite Storage Notice */}
      <div className="rounded-xl bg-[#180a0c] border border-white/10 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] text-[#e6d5b8]">
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
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-[#b8a285]">
            Hiệu ứng hạt sen vàng, hoa sen phát sáng &amp; hào quang 3D
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

        <div className="pt-2 border-t border-white/10 flex items-start gap-2 text-[10.5px] text-[#b8a285]">
          <Database className="w-3.5 h-3.5 text-[#d4af37] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-[#e6d5b8]">Lưu trữ bền vững ({storage.engine.toUpperCase()}):</strong>{' '}
            {storage.durabilityNoteVi}
          </p>
        </div>
      </div>
    </div>
  );
}
