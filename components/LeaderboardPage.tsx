import React from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLeaderboardChanges } from '../hooks/useLeaderboardChanges';
import { FOMOTicker } from './FOMOTicker';

interface LeaderboardPageProps {
  player: Player;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ player }) => {
  const { leaderboard, isLoading } = useLeaderboard();
  const changes = useLeaderboardChanges(leaderboard);
  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="relative mb-6">
            <h1 className="text-3xl font-black text-lime-500 mb-8">GLOBAL RANKING</h1>
        </div>

        {/* Guest Warning - Tactical */}
        {player.isGuest && (
          <div className="relative bg-yellow-900/10 border border-yellow-600/50 px-4 py-3 mb-6 overflow-hidden">
            <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-yellow-600/70"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-yellow-600/70"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-yellow-600/70"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-yellow-600/70"></div>

            <div className="flex items-center justify-center gap-2 font-mono">
              <span className="text-yellow-500 text-xs tracking-wider">⚠ Login </span>
              <span className="text-yellow-600/50">|</span>
              <span className="text-yellow-600/80 text-xs">Connect wallet</span>
            </div>
          </div>
        )}

        {/* FOMO Ticker */}
        <FOMOTicker changes={changes} />

        {/* Leaderboard Table - Tactical */}
        <div className="relative bg-black/90 border border-lime-500/40 shadow-[0_0_30px_rgba(0,255,0,0.1)]">
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-lime-500/70"></div>
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-lime-500/70"></div>
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-lime-500/70"></div>
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-lime-500/70"></div>

          {/* Table Header */}
          <div className="relative grid grid-cols-12 gap-2 sm:gap-4 px-2 sm:px-4 py-3 bg-lime-950/30 border-b border-lime-500/30 text-lime-500 font-bold font-mono text-sm tracking-widest">
            <div className="col-span-1 flex items-center justify-center ml-2">#</div>
            <div className="col-span-1"></div>
            <div className="col-span-1"></div>
            <div className="col-span-4 sm:col-span-5">PLAYER</div>
            <div className="col-span-5 sm:col-span-4 flex items-center justify-center">SOL WON</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-lime-900/30">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading leaderboard...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center text-sm py-8 text-gray-500">
                No players on leaderboard yet
              </div>
            ) : (
              leaderboard.map((entry) => {
                const isCurrentPlayer = entry.wallet === player.walletAddress;
                const walletDisplay = entry.wallet
                  ? `${entry.wallet.slice(0, 4)}..${entry.wallet.slice(-4)}`
                  : 'Anonymous';

                const isTopThree = entry.rank <= 3;
                const rankBadge = entry.rank === 1 ? '# ' : entry.rank === 2 ? '# ' : entry.rank === 3 ? '# ' : '# ';
                const rankColor = entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : entry.rank === 3 ? 'text-orange-400' : 'text-gray-500';

                return (
                  <div
                    key={entry.wallet || entry.rank}
                    className={`relative grid grid-cols-12 gap-2 sm:gap-4 px-2 sm:px-4 py-3 sm:py-4 hover:bg-lime-900/20 transition-all border-l-2 ${
                      isCurrentPlayer
                        ? 'bg-lime-900/30 border-lime-400 shadow-[inset_0_0_20px_rgba(0,255,0,0.1)]'
                        : isTopThree
                        ? 'bg-lime-950/20 border-lime-700/30'
                        : 'border-transparent'
                    }`}
                  >
                    {/* Tactical grid overlay for current player */}
                    {isCurrentPlayer && (
                      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                        backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, #00ff00 10px, #00ff00 11px)',
                      }}></div>
                    )}

                    <div className={`col-span-1 flex items-center justify-center font-black font-mono text-xs sm:text-base ml-2 ${rankColor}`}>
                      {isTopThree && <span className="mr-1">{rankBadge}</span>}
                      {String(entry.rank).padStart(2, '0')}
                    </div>
                    <div className="col-span-1 flex items-center justify-center"></div>
                    <div className="col-span-1 flex items-center justify-center">
                      <FlagIcon countryCode={entry.countryFlag} width="24px" height="18px" className="sm:w-[40px] sm:h-[28px]" />
                    </div>
                    <div className="col-span-4 pl-2">
                      <div className="text-white text-[14px] sm:text-base truncate font-mono tracking-wide">
                        {isCurrentPlayer && <span className="text-yellow-500 mr-1">▸</span>}
                        {walletDisplay}
                      </div>
                      <div className="text-[11px] sm:text-[12px] text-lime-500 font-mono truncate tracking-wider">
                        {entry.username}
                      </div>
                    </div>
                    <div className="col-span-5 sm:col-span-4 flex items-center justify-center">
                      <div className="inline-block bg-black/50 px-2 sm:px-3 py-1">
                        <span className="text-yellow-400 font-bold font-mono text-[18px] sm:text-base tracking-wider">
                          {entry.totalSolWon.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Info - Tactical */}
        <div className="relative mt-6 py-3 px-4 bg-black/60 border border-lime-900/30">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-lime-500/30"></div>
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-lime-500/30"></div>
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-lime-500/30"></div>
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-lime-500/30"></div>

          <div className="flex items-center justify-center gap-4 text-[10px] font-mono tracking-wider">
           
            {/* Update Message */}
            <div className="flex items-center gap-2 text-lime-500">
              <div className="w-2 h-2 bg-lime-500 rounded-full animate-pulse"></div>
              <span>Follow on </span>
            </div>

             {/* Social Icons */}
            <div className="flex items-center gap-3 text-lime-500">
              <a
                href="https://x.com/warfog_io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-500 hover:text-lime-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://t.me/warfog_io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lime-500 hover:text-lime-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
