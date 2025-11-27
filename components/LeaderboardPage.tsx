import React from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';
import { useLeaderboard } from '../hooks/useLeaderboard';

interface LeaderboardPageProps {
  player: Player;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ player }) => {
  const { leaderboard, isLoading } = useLeaderboard();
  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-lime-500">GLOBAL RANKINGS</h1>
        </div>

        {/* Guest Warning */}
        {player.isGuest && (
          <div className="bg-yellow-900/20 border-2 border-yellow-700/50 px-4 py-3 mb-6 text-center">
            <span className="text-yellow-600 text-sm font-bold">
            Connect wallet to get on Leaderboard
            </span>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="bg-black/60 border-2 border-lime-900">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 sm:gap-4 px-2 sm:px-4 py-3 bg-lime-900/10 border-b border-lime-900 text-lime-500 font-bold
           sm:text-s tracking-widest">
            <div className="col-span-1 flex items-center justify-center ml-2">#</div>
            <div className="col-span-1"></div>
            <div className="col-span-1"></div>
            <div className="col-span-4 sm:col-span-5">COMMANDER</div>
            <div className="col-span-2 flex items-center justify-center">WIN%</div>
            <div className="col-span-3 flex items-center justify-center">SOL</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-lime-900/30">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading leaderboard...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No players on leaderboard yet
              </div>
            ) : (
              leaderboard.map((entry) => {
                const isCurrentPlayer = entry.wallet === player.walletAddress;
                const walletDisplay = entry.wallet
                  ? `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`
                  : 'Anonymous';

                return (
                  <div
                    key={entry.wallet || entry.rank}
                    className={`grid grid-cols-12 gap-2 sm:gap-4 px-2 sm:px-4 py-3 sm:py-4 hover:bg-lime-900/10 transition-all ${
                      isCurrentPlayer ? 'bg-lime-900/20 border-l-4 border-lime-500' : ''
                    }`}
                  >
                    <div className="col-span-1 flex items-center justify-center text-gray-400 font-bold font-mono text-xs sm:text-base ml-2">
                      #{entry.rank}
                    </div>
                    <div className="col-span-1 flex items-center justify-center"></div>
                    <div className="col-span-1 flex items-center justify-center">
                      <FlagIcon countryCode={entry.countryFlag} width="24px" height="18px" className="sm:w-[40px] sm:h-[28px]" />
                    </div>
                    <div className="col-span-4 pl-2">
                      <div className="text-lime-500 font-bold text-[14px] sm:text-base truncate">{walletDisplay}</div>
                      <div className="text-[12px] sm:text-[12px] text-gray-600 font-mono truncate">{entry.username}</div>
                    </div>
                    <div className="col-span-2 flex items-center justify-center text-lime-500 font-bold font-mono text-sm sm:text-base">
                      {entry.winRate.toFixed(1)}%
                    </div>
                    <div className="col-span-3 flex items-center justify-center">
                      <div className="inline-block bg-lime-900/30 px-1.5 sm:px-3 py-0.5 sm:py-1 border border-lime-700">
                        <span className="text-lime-500 font-bold font-mono text-[12px] sm:text-base">
                          {entry.wins}/{entry.losses}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-6 text-xs text-gray-600">
          Leaderboard updates every 60 seconds
        </div>
      </div>
    </div>
  );
};
