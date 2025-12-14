import React, { useState, useEffect } from 'react';
import { RecentWin } from '../hooks/useRecentWins';
import { FlagIcon } from './FlagIcon';

interface WinsTickerProps {
  wins: RecentWin[];
}

export const WinsTicker: React.FC<WinsTickerProps> = ({ wins }) => {
  const [isShaking, setIsShaking] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    if (wins.length === 0) return;

    // Change color every 3 seconds and shake
    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % 4);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }, 3000);

    return () => clearInterval(interval);
  }, [wins.length]);

  if (wins.length === 0) {
    return (
      <div className="relative bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-purple-900/20 border border-purple-500/30 px-4 py-2.5">
        <div className="flex items-center justify-center gap-2 text-purple-400/50 font-bold text-xs">
          <span className="animate-pulse">💎</span>
          <span>Waiting for wins...</span>
          <span className="animate-pulse">💎</span>
        </div>
      </div>
    );
  }

  // Always show the latest win (first in array)
  const currentWin = wins[0];

  // Calculate time ago
  const timeAgo = Math.floor((Date.now() - currentWin.timestamp) / 1000);
  let timeDisplay = '';
  if (timeAgo < 60) {
    timeDisplay = `${timeAgo}s ago`;
  } else if (timeAgo < 3600) {
    timeDisplay = `${Math.floor(timeAgo / 60)}m ago`;
  } else if (timeAgo < 86400) {
    timeDisplay = `${Math.floor(timeAgo / 3600)}h ago`;
  } else {
    timeDisplay = `${Math.floor(timeAgo / 86400)}d ago`;
  }

  // Color gradients array
  const gradients = [
    { bg: 'from-purple-600/10 via-pink-600/10 to-purple-600/10', border: 'border-purple-500/40', shimmer: 'via-purple-500/5' },
    { bg: 'from-yellow-600/10 via-orange-600/10 to-yellow-600/10', border: 'border-yellow-500/40', shimmer: 'via-yellow-500/5' },
    { bg: 'from-green-600/10 via-lime-600/10 to-green-600/10', border: 'border-green-500/40', shimmer: 'via-green-500/5' },
    { bg: 'from-blue-600/10 via-cyan-600/10 to-blue-600/10', border: 'border-blue-500/40', shimmer: 'via-cyan-500/5' },
  ];

  const colorScheme = gradients[colorIndex % gradients.length];

  return (
    <div className={`relative bg-gradient-to-r ${colorScheme.bg} border-2 ${colorScheme.border} px-4 py-2.5 overflow-hidden transition-all duration-200 ${
      isShaking ? 'animate-shake' : ''
    }`}>
      {/* Animated gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${colorScheme.shimmer} to-transparent animate-shimmer`}></div>

      {/* Content */}
      <div className="relative flex items-center justify-center gap-2 text-sm font-bold">
        {currentWin.countryCode && <FlagIcon countryCode={currentWin.countryCode} width="16px" height="12px" />}
        <span className="text-white">{currentWin.winnerWallet}</span>
        <span className="text-purple-400 text-xs">won</span>
        <span className="text-lime-400 font-black">{currentWin.amount.toFixed(2)} SOL</span>
        <span className="text-gray-500 text-xs ml-1">{timeDisplay}</span>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        .animate-shimmer {
          animation: shimmer 2s linear infinite;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};
