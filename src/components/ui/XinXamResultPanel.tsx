import { useEffect, useMemo, useState } from 'react';
import {
  FORTUNE_CLASSIFICATION_META,
  FortuneCategory,
  XinXamDrawResult,
  formatQueXamHeader,
  isValidFortuneCategory,
  sanitizeCeremonialText,
} from '../../types/temple';
import { buildSacredAvatarDataUri } from '../../systems/DemoEventManager';
import { buildXinXamResultPanelStyle, clampPanelScale } from '../../systems/OverlayTheme';

interface XinXamResultPanelProps {
  result: XinXamDrawResult | null;
  panelOpacity?: number;
  panelScale?: number;
  showAvatar?: boolean;
}

interface ClassificationVisualTheme {
  textClass: string;
  badgeBgStyle: string;
  badgeBorderStyle: string;
  glowStyle: string;
}

function getClassificationVisualTheme(category: FortuneCategory): ClassificationVisualTheme {
  switch (category) {
    case 'Đại Cát':
      return {
        textClass: 'text-[#ffea88]',
        badgeBgStyle: 'rgba(118, 42, 14, 0.56)',
        badgeBorderStyle: 'rgba(255, 222, 112, 0.88)',
        glowStyle: '0 0 14px rgba(255, 214, 92, 0.34)',
      };
    case 'Trung Cát':
      return {
        textClass: 'text-[#ffe08a]',
        badgeBgStyle: 'rgba(92, 30, 18, 0.52)',
        badgeBorderStyle: 'rgba(244, 198, 92, 0.78)',
        glowStyle: '0 0 11px rgba(244, 198, 92, 0.24)',
      };
    case 'Tiểu Cát':
      return {
        textClass: 'text-[#ffd4e2]',
        badgeBgStyle: 'rgba(88, 22, 42, 0.52)',
        badgeBorderStyle: 'rgba(248, 178, 200, 0.76)',
        glowStyle: '0 0 11px rgba(248, 172, 196, 0.22)',
      };
    case 'Bình':
      return {
        textClass: 'text-[#f5e7cb]',
        badgeBgStyle: 'rgba(58, 26, 18, 0.5)',
        badgeBorderStyle: 'rgba(224, 196, 144, 0.68)',
        glowStyle: '0 0 8px rgba(224, 196, 144, 0.16)',
      };
    case 'Cần Thận Trọng':
      return {
        textClass: 'text-[#ffd0a6]',
        badgeBgStyle: 'rgba(84, 32, 14, 0.54)',
        badgeBorderStyle: 'rgba(238, 170, 116, 0.76)',
        glowStyle: '0 0 10px rgba(238, 162, 104, 0.2)',
      };
  }
}

/**
 * Center Fortune Result Panel ("🪷 KẾT QUẢ XIN XĂM")
 * - Translucent dark-burgundy RGBA background (default 0.45), gold border & subtle lotus filigree.
 * - Anchored below the elevated Golden Buddha statue (`top-[49.5%]`) so it NEVER covers the Buddha's face or throne.
 * - Displays:
 *   1) Title: "🪷 KẾT QUẢ XIN XĂM"
 *   2) Real TikTok circular avatar + username
 *   3) Single-line fortune number ("QUẺ XĂM 18" — never wraps)
 *   4) Prominent uppercase fortune classification (ĐẠI CÁT / TRUNG CÁT / TIỂU CÁT / BÌNH / CẦN THẬN TRỌNG)
 *      with distinct subtle visual accents and respectful symbolic guidance subtitle
 *   5) Fortune title, poetic verse, interpretation, and gentle advice.
 */
export function XinXamResultPanel({
  result,
  panelOpacity = 0.45,
  panelScale = 0.92,
  showAvatar = true,
}: XinXamResultPanelProps) {
  const [phase, setPhase] = useState<'enter' | 'steady' | 'exit'>('enter');
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!result) return;
    setImgFailed(false);
    setPhase('enter');

    const now = Date.now();
    const remainingMs = Math.max(450, result.expiresAt - now);
    const enterTimer = window.setTimeout(() => {
      setPhase('steady');
    }, 35);
    const exitLeadMs = Math.max(200, remainingMs - 380);
    const exitTimer = window.setTimeout(() => {
      setPhase('exit');
    }, exitLeadMs);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [result?.drawId, result?.expiresAt]);

  const resolvedFortuneType: FortuneCategory = useMemo(() => {
    const candidate = result?.fortuneType || result?.category;
    return isValidFortuneCategory(candidate) ? candidate : 'Trung Cát';
  }, [result?.fortuneType, result?.category]);

  const cardStyle = useMemo(
    () => buildXinXamResultPanelStyle(panelOpacity, resolvedFortuneType),
    [panelOpacity, resolvedFortuneType],
  );

  if (!result) return null;

  const scale = clampPanelScale(panelScale);
  const singleLineQueXam = formatQueXamHeader(result.fortuneNumber);
  const meta = FORTUNE_CLASSIFICATION_META[resolvedFortuneType];
  const classificationUpper = meta?.upperLabel || resolvedFortuneType.toUpperCase();
  const theme = getClassificationVisualTheme(resolvedFortuneType);

  const cleanTitle = sanitizeCeremonialText(
    result.fortuneTitle || result.title,
    'Tâm An Vạn Sự Lành',
  );
  const cleanVerse = sanitizeCeremonialText(result.shortVerse || result.poem, '');
  const cleanInterpretation = sanitizeCeremonialText(
    result.interpretation,
    'Tâm thành lễ Phật, giữ lòng thiện lành thì mọi việc hanh thông.',
  );
  const cleanAdvice = sanitizeCeremonialText(result.advice, '');

  const fallbackAvatarUri = buildSacredAvatarDataUri(
    result.userId,
    result.nickname || result.username,
  );
  const resolvedAvatarSrc =
    !imgFailed && result.avatarUrl ? result.avatarUrl : fallbackAvatarUri;

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
      aria-label="Kết quả Xin Xăm"
      className="pointer-events-none absolute left-1/2 top-[49.5%] -translate-x-1/2 z-30 w-[88%] min-w-[244px] max-w-[288px] flex justify-center"
    >
      <div
        style={{
          ...cardStyle,
          transform: Math.abs(scale - 1) > 0.005 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center',
        }}
        className={`relative w-full max-h-[41vh] overflow-y-auto temple-scroll rounded-lg border px-2.5 py-2 text-center transition-all duration-300 ease-out ${animClasses}`}
      >
        {/* Subtle Corner Lotus Filigree Accents */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 text-[#d4af37]/50 fill-current"
        >
          <path d="M12 3C10.2 6.2 8.5 8.8 8.5 11.4C8.5 13.5 10 15.2 12 15.8C14 15.2 15.5 13.5 15.5 11.4C15.5 8.8 13.8 6.2 12 3Z" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 text-[#d4af37]/50 fill-current"
        >
          <path d="M12 3C10.2 6.2 8.5 8.8 8.5 11.4C8.5 13.5 10 15.2 12 15.8C14 15.2 15.5 13.5 15.5 11.4C15.5 8.8 13.8 6.2 12 3Z" />
        </svg>

        {/* 1. Panel Header Title */}
        <h3 className="font-display text-[10px] font-bold tracking-[0.12em] text-[#ffe89e] leading-tight whitespace-nowrap">
          🪷 KẾT QUẢ XIN XĂM
        </h3>

        {/* 2. Real TikTok Circular Avatar + Username */}
        <div className="mt-1 flex items-center justify-center gap-1.5 min-w-0">
          {showAvatar && (
            <div className="w-5 h-5 rounded-full p-[1px] bg-gradient-to-b from-[#ffe89e] via-[#d4af37] to-[#8f6814] shrink-0 shadow-[0_0_8px_rgba(245,205,99,0.3)]">
              <img
                src={resolvedAvatarSrc}
                alt={result.username}
                onError={() => setImgFailed(true)}
                className="w-full h-full rounded-full object-cover bg-[#24080e]"
              />
            </div>
          )}
          <span className="text-[9.5px] font-semibold text-[#f8e7c9] break-all">
            @{result.username}
          </span>
        </div>

        <div className="my-1 h-px bg-gradient-to-r from-transparent via-[#d4af37]/45 to-transparent" />

        {/* 3. Single-Line Fortune Number Header ("QUẺ XĂM 18" — NEVER WRAPS) */}
        <p
          data-testid="xinxam-single-line-number"
          className="font-display text-[12px] sm:text-[13px] font-bold tracking-[0.1em] text-[#ffe89e] leading-none whitespace-nowrap"
        >
          {singleLineQueXam}
        </p>

        {/* 4. Prominent Large Fortune Classification Badge */}
        <div
          data-testid="xinxam-fortune-classification"
          style={{
            backgroundColor: theme.badgeBgStyle,
            borderColor: theme.badgeBorderStyle,
            boxShadow: theme.glowStyle,
          }}
          className="mt-1 inline-flex flex-col items-center justify-center rounded border px-2.5 py-1"
        >
          <span
            className={`font-display text-[14px] sm:text-[16px] font-extrabold tracking-[0.14em] uppercase leading-none whitespace-nowrap ${theme.textClass}`}
          >
            {classificationUpper}
          </span>
          {meta?.meaningVi && (
            <span className="mt-0.5 text-[7.5px] text-[#f5e4c8] leading-tight">
              {meta.meaningVi}
            </span>
          )}
        </div>

        {/* 5. Fortune Title */}
        <p className="mt-1 font-display text-[10.5px] sm:text-[11px] font-bold text-[#fff1c2] leading-snug">
          {cleanTitle}
        </p>

        {/* 6. Poetic Fortune Verse (shortVerse) */}
        {cleanVerse && (
          <p className="mt-0.5 font-display italic text-[8.8px] text-[#f7e5c6] leading-snug whitespace-pre-line">
            {cleanVerse}
          </p>
        )}

        {/* 7. Interpretation */}
        <p className="mt-1 text-[9px] text-[#fff8ec] leading-snug px-0.5">
          {cleanInterpretation}
        </p>

        {/* 8. Symbolic Advice */}
        {cleanAdvice && (
          <p className="mt-1 pt-1 border-t border-[#d4af37]/25 text-[8.5px] font-medium text-[#ffe59e] leading-snug px-0.5">
            Lời khuyên: {cleanAdvice}
          </p>
        )}
      </div>
    </div>
  );
}
