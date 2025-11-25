import React from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';

interface LeaderboardEntry {
  rank: number;
  flag: string;
  username: string;
  winRate: number;
  solBalance: number;
  isCurrentPlayer?: boolean;
}

interface LeaderboardPageProps {
  player: Player;
}

// Mock data for demonstration
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, flag: 'kr', username: 'TACTICAL_STORM', winRate: 87.3, solBalance: 42.5 },
  { rank: 2, flag: 'jp', username: 'SILENT_DRAGON', winRate: 84.1, solBalance: 28.3 },
  { rank: 3, flag: 'us', username: 'EAGLE_STRIKE', winRate: 81.5, solBalance: 15.7 },
  { rank: 4, flag: 'cn', username: 'RED_PHOENIX', winRate: 79.2, solBalance: 8.2 },
  { rank: 5, flag: 'de', username: 'IRON_FALCON', winRate: 76.8, solBalance: 7.9 },
  { rank: 6, flag: 'gb', username: 'ROYAL_KNIGHT', winRate: 74.3, solBalance: 5.4 },
  { rank: 7, flag: 'fr', username: 'LEGION_ALPHA', winRate: 71.9, solBalance: 4.1 },
  { rank: 8, flag: 'ru', username: 'SHADOW_OPS', winRate: 69.4, solBalance: 2.8 },
];

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ player }) => {
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
            <div className="col-span-1 flex items-center justify-center ml-2">RANK</div>
            <div className="col-span-1"></div>
            <div className="col-span-5 sm:col-span-5">COMMANDER</div>
            <div className="col-span-2 flex items-center justify-center">WIN%</div>
            <div className="col-span-3 flex items-center justify-center">SOL</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-lime-900/30">
            {MOCK_LEADERBOARD.map((entry) => (
              <div
                key={entry.rank}
                className={`grid grid-cols-12 gap-2 sm:gap-4 px-2 sm:px-4 py-3 sm:py-4 hover:bg-lime-900/10 transition-all ${
                  entry.isCurrentPlayer ? 'bg-lime-900/20 border-l-4 border-lime-500' : ''
                }`}
              >
                <div className="col-span-1 flex items-center justify-center text-gray-400 font-bold font-mono text-xs sm:text-base ml-2">
                  #{entry.rank}
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <FlagIcon countryCode={entry.flag} width="24px" height="18px" className="sm:w-[40px] sm:h-[28px]" />
                </div>
                <div className="col-span-5 pl-2">
                  <div className="text-lime-500 font-bold text-[14px] sm:text-base truncate">0x{Math.random().toString(36).substr(2, 3).toUpperCase()}...{Math.random().toString(36).substr(2, 3).toUpperCase()}</div>
                  <div className="text-[12px] sm:text-[12px] text-gray-600 font-mono truncate">{entry.username}</div>
                </div>
                <div className="col-span-2 flex items-center justify-center text-lime-500 font-bold font-mono text-sm sm:text-base">
                  {entry.winRate}%
                </div>
                <div className="col-span-3 flex items-center justify-center">
                  <div className="inline-block bg-lime-900/30 px-1.5 sm:px-3 py-0.5 sm:py-1 border border-lime-700">
                    <span className="text-lime-500 font-bold font-mono text-[12px] sm:text-base">{entry.solBalance}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-6 text-xs text-gray-600">
          Leaderboard updates every 5 seconds
        </div>
      </div>
    </div>
  );
};
