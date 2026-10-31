import { Participant } from '../../types/temple';

interface LeaderboardProps {
  leaderboard: Participant[];
}

export function Leaderboard({ leaderboard }: LeaderboardProps) {
  const topFour = leaderboard.slice(0, 4);
  const remaining = leaderboard.slice(4);

  const renderRow = (p: Participant, rank: number) => {
    const rankColor =
      rank === 1
        ? 'text-[#ffe07d] font-bold'
        : rank === 2
          ? 'text-[#f4ead7] font-semibold'
          : rank === 3
            ? 'text-[#e7b07a] font-semibold'
            : rank === 4
              ? 'text-[#d8c19a] font-medium'
              : 'text-[#ad9679]';

    return (
      <div
        key={p.userId}
        className="flex items-center justify-between gap-1 text-[10px] py-0.5 border-b border-[#d4af37]/12 last:border-b-0"
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className={`w-3.5 text-right font-mono-tabular shrink-0 ${rankColor}`}>
            {rank}
          </span>
          <span className="text-[#f7efe2] truncate font-medium">{p.username}</span>
        </div>
        <span className="font-mono-tabular text-[#f6d275] font-semibold shrink-0">
          {p.points}
        </span>
      </div>
    );
  };

  return (
    <aside
      aria-label="Bảng Công Đức"
      className="w-[140px] sm:w-[154px] rounded-lg bg-gradient-to-b from-[#3b0b13]/95 via-[#22080c]/94 to-[#140608]/95 border border-[#d4af37]/60 shadow-[0_6px_22px_rgba(0,0,0,0.65)] overflow-hidden pointer-events-auto"
    >
      {/* Ornate Burgundy & Gold Header Matching "🪷 CÚNG DƯỜNG CẦU AN" */}
      <div className="px-2 py-1.5 border-b border-[#d4af37]/40 bg-gradient-to-b from-[#5e111d] to-[#2e0910] text-center">
        <div className="flex items-center justify-center gap-1">
          <svg
            viewBox="0 0 24 24"
            className="w-3 h-3 text-[#ffe28a] shrink-0 fill-current"
            aria-hidden="true"
          >
            <path d="M12 3C10.2 6.2 8.5 8.8 8.5 11.4C8.5 13.5 10 15.2 12 15.8C14 15.2 15.5 13.5 15.5 11.4C15.5 8.8 13.8 6.2 12 3ZM5.2 9.5C4.8 12.2 6 14.8 8.8 16.1C7.6 14.3 7.2 12.1 7.6 10.2C6.8 9.9 6 9.7 5.2 9.5ZM18.8 9.5C18 9.7 17.2 9.9 16.4 10.2C16.8 12.1 16.4 14.3 15.2 16.1C18 14.8 19.2 12.2 18.8 9.5ZM4 16.8C6.6 18.8 9.3 19.5 12 19.5C14.7 19.5 17.4 18.8 20 16.8C17.2 16.9 14.6 17.4 12 18.2C9.4 17.4 6.8 16.9 4 16.8Z" />
          </svg>
          <h2 className="font-display text-[12px] sm:text-[12.5px] font-bold tracking-wider text-[#ffe28a] leading-none whitespace-nowrap">
            BẢNG CÔNG ĐỨC
          </h2>
        </div>
        <div className="mt-1 mx-auto w-20 h-[1px] bg-gradient-to-r from-transparent via-[#f3cf6d]/75 to-transparent" />
      </div>

      {leaderboard.length === 0 ? (
        <p className="text-[10px] text-[#c4ad8f] text-center py-2.5 px-2 font-display italic">
          Chưa có Phật tử ghi danh
        </p>
      ) : (
        <div>
          {/* Top 4 Shown Directly */}
          <div className="px-2 py-1 space-y-0.5">
            {topFour.map((p, idx) => renderRow(p, idx + 1))}
          </div>

          {/* 5th User Onward Inside Compact Scrollable List */}
          {remaining.length > 0 && (
            <div className="border-t border-[#d4af37]/25 bg-[#110507]/90">
              <div className="max-h-[56px] overflow-y-auto temple-scroll px-2 py-1 space-y-0.5">
                {remaining.map((p, idx) => renderRow(p, idx + 5))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
