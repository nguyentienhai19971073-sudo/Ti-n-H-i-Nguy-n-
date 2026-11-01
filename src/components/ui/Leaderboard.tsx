import { useMemo } from 'react';
import { MeritLedgerEntry } from '../../types/temple';
import {
  buildBurgundyHeaderStyle,
  buildBurgundyPanelStyle,
  buildBurgundyScrollFooterStyle,
} from '../../systems/OverlayTheme';

interface LeaderboardProps {
  leaderboard: MeritLedgerEntry[];
  panelOpacity?: number;
  panelScale?: number;
}

export function Leaderboard({
  leaderboard,
  panelOpacity = 0.5,
  panelScale = 0.86,
}: LeaderboardProps) {
  const topFour = leaderboard.slice(0, 4);
  const remaining = leaderboard.slice(4);

  const panelStyle = useMemo(
    () =>
      buildBurgundyPanelStyle(panelOpacity, {
        scale: panelScale,
        transformOrigin: 'top left',
      }),
    [panelOpacity, panelScale],
  );
  const headerStyle = useMemo(() => buildBurgundyHeaderStyle(panelOpacity), [panelOpacity]);
  const scrollFooterStyle = useMemo(
    () => buildBurgundyScrollFooterStyle(panelOpacity),
    [panelOpacity],
  );

  const renderRow = (entry: MeritLedgerEntry, rank: number) => {
    const rankColor =
      rank === 1
        ? 'text-[#ffe48a] font-bold'
        : rank === 2
          ? 'text-[#f6edd9] font-semibold'
          : rank === 3
            ? 'text-[#ebb983] font-semibold'
            : rank === 4
              ? 'text-[#dfd0b4] font-medium'
              : 'text-[#cbb899]';

    return (
      <div
        key={entry.userId}
        className="flex items-center justify-between gap-1 text-[8px] py-[1px] border-b border-[#d4af37]/12 last:border-b-0 leading-tight"
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className={`w-2.5 text-right font-mono-tabular shrink-0 ${rankColor}`}>
            {rank}
          </span>
          <span
            className={`truncate ${
              entry.isActiveInScene ? 'text-[#fff7ea] font-medium' : 'text-[#e3d4be]'
            }`}
          >
            {entry.username}
          </span>
        </div>
        <span className="font-mono-tabular text-[#ffe082] font-semibold shrink-0">
          {entry.points}
        </span>
      </div>
    );
  };

  return (
    <aside
      aria-label="Bảng Công Đức"
      style={panelStyle}
      className="w-[90px] sm:w-[98px] rounded border overflow-hidden pointer-events-auto"
    >
      {/* Compact Dark Burgundy & Gold Lotus Header */}
      <div style={headerStyle} className="px-1 py-[2px] border-b text-center">
        <div className="flex items-center justify-center gap-0.5">
          <svg
            viewBox="0 0 24 24"
            className="w-2 h-2 text-[#ffe28a] shrink-0 fill-current"
            aria-hidden="true"
          >
            <path d="M12 3C10.2 6.2 8.5 8.8 8.5 11.4C8.5 13.5 10 15.2 12 15.8C14 15.2 15.5 13.5 15.5 11.4C15.5 8.8 13.8 6.2 12 3ZM5.2 9.5C4.8 12.2 6 14.8 8.8 16.1C7.6 14.3 7.2 12.1 7.6 10.2C6.8 9.9 6 9.7 5.2 9.5ZM18.8 9.5C18 9.7 17.2 9.9 16.4 10.2C16.8 12.1 16.4 14.3 15.2 16.1C18 14.8 19.2 12.2 18.8 9.5ZM4 16.8C6.6 18.8 9.3 19.5 12 19.5C14.7 19.5 17.4 18.8 20 16.8C17.2 16.9 14.6 17.4 12 18.2C9.4 17.4 6.8 16.9 4 16.8Z" />
          </svg>
          <h2 className="font-display text-[8.5px] font-bold tracking-wider text-[#ffe89e] leading-none whitespace-nowrap">
            BẢNG CÔNG ĐỨC
          </h2>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <p className="text-[7.5px] text-[#dfd0b8] text-center py-1 px-1 font-display italic">
          Chưa ghi danh
        </p>
      ) : (
        <div>
          {/* Fixed Top 4 Ranks Displayed Directly */}
          <div className="px-1 py-[1.5px]">
            {topFour.map((entry, idx) => renderRow(entry, idx + 1))}
          </div>

          {/* Ranks 5+ Accessible Through Compact Scrollable Section */}
          {remaining.length > 0 && (
            <div style={scrollFooterStyle} className="border-t">
              <div className="max-h-[34px] overflow-y-auto temple-scroll px-1 py-[1.5px]">
                {remaining.map((entry, idx) => renderRow(entry, idx + 5))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
