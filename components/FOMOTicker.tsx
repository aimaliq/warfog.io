import React, { useState, useEffect } from 'react';
import { LeaderboardChange } from '../hooks/useLeaderboardChanges';

interface FOMOTickerProps {
  changes: LeaderboardChange[];
}

export const FOMOTicker: React.FC<FOMOTickerProps> = ({ changes }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  // Rotate through changes
  useEffect(() => {
    if (changes.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % changes.length);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }, 4000);

    return () => clearInterval(interval);
  }, [changes.length]);

  // Trigger shake when new change arrives
  useEffect(() => {
    if (changes.length > 0) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  }, [changes.length]);

  if (changes.length === 0) {
    return (
      <div className="relative bg-black/80 border-y border-lime-500/30 px-4 py-2.5 mb-6 overflow-hidden">
        {/* Corner decorations - only top-left and bottom-right */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-lime-500/50"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-lime-500/50"></div>

        <div className="flex items-center justify-center gap-2 text-lime-500/50 font-mono text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-lime-500/50 animate-pulse"></div>
          <span className="tracking-wider">STANDBY...</span>
          <div className="w-1.5 h-1.5 rounded-full bg-lime-500/50 animate-pulse"></div>
        </div>
      </div>
    );
  }

  const currentChange = changes[currentIndex];
  const walletDisplay = `${currentChange.wallet.slice(0, 4)}...${currentChange.wallet.slice(-4)}`;

  const getMessage = () => {
    if (currentChange.change === 'new') {
      return (
        <>
          <span className="text-lime-400"></span>
          <span className="text-white font-bold">{currentChange.username}</span>
          <span className="text-gray-500 text-[10px]">[{walletDisplay}]</span>
          <span className="text-lime-400">⟩</span>
          <span className="text-yellow-300 font-black">RANK #{String(currentChange.newRank).padStart(2, '0')}</span>
          <span className="text-lime-500 animate-pulse">◂</span>
        </>
      );
    } else if (currentChange.change === 'up') {
      const positions = currentChange.oldRank! - currentChange.newRank;
      return (
        <>
          <span className="text-lime-400 font-black tracking-wider">▲ ASCENDING</span>
          <span className="text-lime-400">|</span>
          <span className="text-white font-bold">{currentChange.username}</span>
          <span className="text-gray-500 text-[10px]">[{walletDisplay}]</span>
          <span className="text-lime-400">⟩</span>
          <span className="text-yellow-300 font-black">+{positions}</span>
          <span className="text-lime-400">⟩</span>
          <span className="text-lime-300 font-black">RANK #{String(currentChange.newRank).padStart(2, '0')}</span>
          <span className="text-lime-500 animate-pulse">◂</span>
        </>
      );
    } else {
      const positions = currentChange.newRank - currentChange.oldRank!;
      return (
        <>
          <span className="text-red-400 font-black tracking-wider">▼ DESCENDING</span>
          <span className="text-red-400">|</span>
          <span className="text-white font-bold">{currentChange.username}</span>
          <span className="text-gray-500 text-[10px]">[{walletDisplay}]</span>
          <span className="text-red-400">⟩</span>
          <span className="text-orange-300 font-black">-{positions}</span>
          <span className="text-red-400">⟩</span>
          <span className="text-red-300 font-black">RANK #{String(currentChange.newRank).padStart(2, '0')}</span>
          <span className="text-red-500 animate-pulse">◂</span>
        </>
      );
    }
  };

  return (
    <div className={`relative bg-black/80 border-y border-lime-500/50 px-4 py-2.5 mb-6 overflow-hidden shadow-[0_0_20px_rgba(0,255,0,0.15)] transition-all duration-200 ${
      isShaking ? 'animate-shake' : ''
    }`}>
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00ff00 2px, #00ff00 3px)',
        backgroundSize: '100% 6px'
      }}></div>

      {/* Corner decorations - only top-left and bottom-right */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-lime-500/70"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-lime-500/70"></div>

      {/* Scan line effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-lime-500/30 to-transparent animate-scan-line"></div>
      </div>

      {/* Status indicator */}
      <div className="absolute top-2 left-3 flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${isShaking ? 'bg-yellow-400 animate-pulse' : 'bg-lime-500'}`}></div>
        <span className="text-[8px] text-lime-500/70 font-mono tracking-wider">SCAN</span>
      </div>

      {/* Ticker content */}
      <div className="relative flex items-center justify-center gap-2 text-xs font-mono">
        {getMessage()}
      </div>

      {/* Change counter - tactical style */}
      <div className="absolute top-2 right-3 text-[8px] text-lime-500/70 font-mono tracking-wider">
        [{String(currentIndex + 1).padStart(2, '0')}/{String(changes.length).padStart(2, '0')}]
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }

        @keyframes scan-line {
          0% { top: -10%; }
          100% { top: 110%; }
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .animate-scan-line {
          animation: scan-line 3s linear infinite;
        }
      `}</style>
    </div>
  );
};
