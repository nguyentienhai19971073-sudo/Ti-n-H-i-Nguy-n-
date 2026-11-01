import { useEffect, useMemo, useState } from 'react';
import {
  FORTUNE_CLASSIFICATION_META,
  FortuneCategory,
  XinXamDrawResult,
  XinXamPopupDisplayMode,
  extractConciseVietnameseSentence,
  formatQueXamHeader,
  formatTraditionalVerseLines,
  isValidFortuneCategory,
  normalizeSingleFlowVietnameseText,
  sanitizeCeremonialText,
} from '../../types/temple';
import { buildSacredAvatarDataUri } from '../../systems/DemoEventManager';
import { buildXinXamResultPanelStyle, clampPanelScale } from '../../systems/OverlayTheme';

interface XinXamResultPanelProps {
  result: XinXamDrawResult | null;
  panelOpacity?: number;
  panelScale?: number;
  displayMode?: XinXamPopupDisplayMode;
  textScale?: number;
  showAvatar?: boolean;
}

function getClassificationTextClass(category: FortuneCategory): string {
  switch (category) {
    case 'Đại Cát':
      return 'text-[#ffea88]';
    case 'Trung Cát':
      return 'text-[#ffe08a]';
    case 'Tiểu Cát':
      return 'text-[#ffd4e2]';
    case 'Bình':
      return 'text-[#f5e7cb]';
    case 'Cần Thận Trọng':
      return 'text-[#ffd0a6]';
  }
}

/**
 * Compact Lower-Middle Fortune Result Popup ("🪷 KẾT QUẢ XIN XĂM")
 * - Width: 85vw, max-width: 580px (clamped within parent 9:16 frame), height: auto, max-height: 30vh (compact).
 * - Semi-transparent burgundy RGBA background (default alpha 0.55) with crisp gold/category border.
 * - Anchored in the lower-middle zone (`bottom-[11.5%]`) so the Golden Buddha statue and altar stay 100% clear.
 * - Full-width text (`width: 100%`, `min-width: 0`) with normal Vietnamese word wrapping and responsive `clamp()` sizing.
 */
export function XinXamResultPanel({
  result,
  panelOpacity = 0.55,
  panelScale = 1.0,
  displayMode = 'compact',
  textScale = 1.0,
  showAvatar = true,
}: XinXamResultPanelProps) {
  const [phase, setPhase] = useState<'enter' | 'steady' | 'exit'>('enter');
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!result) return;
    setImgFailed(false);
    setPhase('enter');

    const now = Date.now();
    const remainingMs = Math.max(500, result.expiresAt - now);
    const enterTimer = window.setTimeout(() => {
      setPhase('steady');
    }, 30);
    const exitLeadMs = Math.max(220, remainingMs - 340);
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
  const ts = Math.max(0.8, Math.min(1.3, Number(textScale || 1.0)));
  const isCompact = displayMode !== 'detailed';

  const singleLineQueXam = formatQueXamHeader(result.fortuneNumber);
  const meta = FORTUNE_CLASSIFICATION_META[resolvedFortuneType];
  const classificationUpper = meta?.upperLabel || resolvedFortuneType.toUpperCase();
  const classificationColorClass = getClassificationTextClass(resolvedFortuneType);

  const cleanTitle = normalizeSingleFlowVietnameseText(
    sanitizeCeremonialText(result.fortuneTitle || result.title, 'Tâm An Vạn Sự Lành'),
  );
  const cleanVerse = formatTraditionalVerseLines(
    sanitizeCeremonialText(result.shortVerse || result.poem, ''),
    4,
  );
  const cleanInterpretation = normalizeSingleFlowVietnameseText(
    sanitizeCeremonialText(
      result.interpretation,
      'Tâm thành lễ Phật, giữ lòng thiện lành thì mọi việc hanh thông.',
    ),
  );
  const cleanAdvice = normalizeSingleFlowVietnameseText(
    sanitizeCeremonialText(result.advice, ''),
  );

  // Compact mode uses a concise single-sentence excerpt (or 2-line couplet fallback) + 1 concise advice sentence
  // while the complete verse, interpretation, and advice remain in game state, Admin history, and VieNeuTTS.
  const compactExcerpt = cleanInterpretation
    ? extractConciseVietnameseSentence(cleanInterpretation, 118)
    : formatTraditionalVerseLines(cleanVerse, 2);
  const compactIsVerseFallback = !cleanInterpretation && Boolean(compactExcerpt);
  const conciseAdvice = cleanAdvice ? extractConciseVietnameseSentence(cleanAdvice, 98) : '';

  const fallbackAvatarUri = buildSacredAvatarDataUri(
    result.userId,
    result.nickname || result.username,
  );
  const resolvedAvatarSrc =
    !imgFailed && result.avatarUrl ? result.avatarUrl : fallbackAvatarUri;

  const animClasses =
    phase === 'enter'
      ? 'translate-y-2 opacity-0 scale-[0.98]'
      : phase === 'exit'
        ? 'translate-y-1.5 opacity-0 scale-[0.98]'
        : 'translate-y-0 opacity-100 scale-100';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Kết quả Xin Xăm"
      className="pointer-events-none absolute inset-x-0 bottom-[11.5%] z-30 flex justify-center px-2"
    >
      <div
        style={{
          width: '85vw',
          maxWidth: 'min(580px, calc(100% - 8px))',
          height: 'auto',
          transform: Math.abs(scale - 1) > 0.005 ? `scale(${scale})` : undefined,
          transformOrigin: 'bottom center',
        }}
        className="min-w-0"
      >
        <div
          style={{
            ...cardStyle,
            maxHeight: isCompact ? '30vh' : '42vh',
          }}
          className={`w-full min-w-0 ${
            isCompact ? 'overflow-y-auto' : 'overflow-y-auto'
          } temple-scroll rounded-lg border px-2.5 sm:px-3 py-1.5 sm:py-2 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${animClasses}`}
        >
          {/* Row 1 & 2: Header ("🪷 KẾT QUẢ XIN XĂM") + Small Avatar & Username */}
          <div className="w-full min-w-0 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
            <h3
              style={{ fontSize: `calc(clamp(9.5px, 1.3vw, 11.5px) * ${ts})` }}
              className="font-display font-bold tracking-[0.08em] text-[#ffe89e] leading-tight whitespace-nowrap shrink-0"
            >
              🪷 KẾT QUẢ XIN XĂM
            </h3>

            <div className="flex items-center gap-1 min-w-0 max-w-full">
              {showAvatar && (
                <div className="w-4 h-4 rounded-full p-[1px] bg-gradient-to-b from-[#ffe89e] via-[#d4af37] to-[#8f6814] shrink-0">
                  <img
                    src={resolvedAvatarSrc}
                    alt={result.username}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full rounded-full object-cover bg-[#24080e]"
                  />
                </div>
              )}
              <span
                style={{ fontSize: `calc(clamp(9.5px, 1.25vw, 11.5px) * ${ts})` }}
                className="font-semibold text-[#f8e7c9] leading-tight whitespace-normal break-words [word-break:normal] min-w-0"
              >
                @{result.username}
              </span>
            </div>
          </div>

          {/* Row 3 & 4: "QUẺ XĂM 73 · TIỂU CÁT" + Fortune Title */}
          <div className="mt-0.5 pt-0.5 border-t border-[#d4af37]/25 w-full min-w-0 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <div className="flex items-baseline gap-1 whitespace-nowrap shrink-0 leading-tight">
              <span
                data-testid="xinxam-single-line-number"
                style={{ fontSize: `calc(clamp(11px, 1.55vw, 13.5px) * ${ts})` }}
                className="font-display font-bold tracking-[0.05em] text-[#ffe89e] whitespace-nowrap"
              >
                {singleLineQueXam}
              </span>
              <span className="text-[#d4af37]/80 text-[10px]" aria-hidden="true">
                ·
              </span>
              <span
                data-testid="xinxam-fortune-classification"
                style={{ fontSize: `calc(clamp(11px, 1.55vw, 13.5px) * ${ts})` }}
                className={`font-display font-extrabold tracking-[0.06em] uppercase whitespace-nowrap ${classificationColorClass}`}
              >
                {classificationUpper}
              </span>
            </div>

            <p
              style={{ fontSize: `calc(clamp(11px, 1.5vw, 13px) * ${ts})` }}
              className="font-display font-bold text-[#fff1c2] leading-snug whitespace-normal break-words [word-break:normal] min-w-0"
            >
              {cleanTitle}
            </p>
          </div>

          {/* Row 5 & 6: Body — Compact (short excerpt + 1 concise advice) OR Detailed (4-line verse + full text) */}
          {isCompact ? (
            <div className="mt-1 w-full min-w-0 space-y-0.5 text-left">
              {compactExcerpt && (
                <p
                  style={{ fontSize: `calc(clamp(10px, 1.35vw, 12px) * ${ts})` }}
                  className={`w-full min-w-0 text-[#fff8ec] leading-[1.32] break-words [word-break:normal] ${
                    compactIsVerseFallback
                      ? 'font-display italic whitespace-pre-line text-[#f7e5c6]'
                      : 'whitespace-normal'
                  }`}
                >
                  {compactExcerpt}
                </p>
              )}

              {conciseAdvice && (
                <p
                  style={{ fontSize: `calc(clamp(9.5px, 1.28vw, 11.5px) * ${ts})` }}
                  className="w-full min-w-0 text-[#ffe59e] font-medium leading-[1.3] whitespace-normal break-words [word-break:normal]"
                >
                  <span className="text-[#ffd778] font-semibold">Lời khuyên:</span> {conciseAdvice}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-1 pt-1 border-t border-[#d4af37]/20 w-full min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-x-2.5 gap-y-1 text-left">
              {cleanVerse && (
                <p
                  style={{ fontSize: `calc(clamp(9.8px, 1.3vw, 11.8px) * ${ts})` }}
                  className="sm:col-span-5 w-full min-w-0 font-display italic text-[#f7e5c6] leading-[1.34] whitespace-pre-line break-words [word-break:normal]"
                >
                  {cleanVerse}
                </p>
              )}

              <div
                className={`${
                  cleanVerse ? 'sm:col-span-7' : 'sm:col-span-12'
                } w-full min-w-0 space-y-0.5`}
              >
                <p
                  style={{ fontSize: `calc(clamp(10px, 1.32vw, 12px) * ${ts})` }}
                  className="w-full min-w-0 text-[#fff8ec] leading-[1.34] whitespace-normal break-words [word-break:normal]"
                >
                  {cleanInterpretation}
                </p>
                {cleanAdvice && (
                  <p
                    style={{ fontSize: `calc(clamp(9.5px, 1.26vw, 11.5px) * ${ts})` }}
                    className="w-full min-w-0 text-[#ffe59e] font-medium leading-[1.32] whitespace-normal break-words [word-break:normal]"
                  >
                    <span className="text-[#ffd778] font-semibold">Lời khuyên:</span> {cleanAdvice}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
