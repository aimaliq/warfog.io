import React, { useState, useEffect } from 'react';
import { RecentWin } from '../hooks/useRecentWins';

interface WinsTickerProps {
  wins: RecentWin[];
}

export const WinsTicker: React.FC<WinsTickerProps> = ({ wins }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (wins.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % wins.length);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }, 3000);

    return () => clearInterval(interval);
  }, [wins.length]);

  if (wins.length === 0) {
    return (
      <div className="relative bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-purple-900/20 border border-purple-500/30 px-4 py-2.5 mb-6">
        <div className="flex items-center justify-center gap-2 text-purple-400/50 font-bold text-xs">
          <span className="animate-pulse">💎</span>
          <span>Waiting for wins...</span>
          <span className="animate-pulse">💎</span>
        </div>
      </div>
    );
  }

  const currentWin = wins[currentIndex];

  // Color gradients array
  const gradients = [
    { bg: 'from-purple-600/10 via-pink-600/10 to-purple-600/10', border: 'border-purple-500/40', shimmer: 'via-purple-500/5' },
    { bg: 'from-yellow-600/10 via-orange-600/10 to-yellow-600/10', border: 'border-yellow-500/40', shimmer: 'via-yellow-500/5' },
    { bg: 'from-green-600/10 via-lime-600/10 to-green-600/10', border: 'border-green-500/40', shimmer: 'via-green-500/5' },
    { bg: 'from-blue-600/10 via-cyan-600/10 to-blue-600/10', border: 'border-blue-500/40', shimmer: 'via-cyan-500/5' },
  ];

  // Emojis array
  const emojiPairs = [
    { left: '🔥', right: '💰' },
    { left: '💵', right: '💸' },
    { left: '🚀', right: '💎' },
    { left: '🎯', right: '🏆' },
    { left: '💰', right: '💵' },
  ];

  const colorScheme = gradients[currentIndex % gradients.length];
  const emojis = emojiPairs[currentIndex % emojiPairs.length];

  return (
    <div className={`relative bg-gradient-to-r ${colorScheme.bg} border-2 ${colorScheme.border} px-4 py-2.5 mb-6 overflow-hidden transition-all duration-200 ${
      isShaking ? 'animate-shake' : ''
    }`}>
      {/* Animated gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${colorScheme.shimmer} to-transparent animate-shimmer`}></div>

      {/* Content */}
      <div className="relative flex items-center justify-center gap-2 text-sm font-bold">
        <span className="text-yellow-400 text-lg">{emojis.left}</span>
        <span className="text-white">{currentWin.winnerWallet}</span>
        <span className="text-purple-400">just won</span>
        <span className="text-lime-400 font-black">{currentWin.amount.toFixed(2)} SOL</span>
        <span className="text-yellow-400 text-lg">{emojis.right}</span>
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
