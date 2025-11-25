import React, { useState, useRef } from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';

interface LobbyPageProps {
  player: Player;
  onStartBattle: () => void;
}

interface Match {
  id: string;
  betAmount: number;
  creator: string;
  createdAt: Date;
  flag: string;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ player, onStartBattle }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const betInputRef = useRef<HTMLInputElement>(null);

  const handleCreateMatch = () => {
    const betAmount = parseFloat(betInputRef.current?.value || '0.1');

    if (betAmount < 0.1) {
      return;
    }

    const newMatch: Match = {
      id: Math.random().toString(36).substr(2, 9),
      betAmount,
      creator: player.isGuest ? 'GUEST' : '0x' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      createdAt: new Date(),
      flag: player.countryFlag,
    };

    setMatches(prev => [...prev, newMatch]);

    // Reset input to default
    if (betInputRef.current) {
      betInputRef.current.value = '0.1';
    }
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };
  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black mb-4 text-lime-500 animate-pulse">WARFOG.IO</h1>
          <p className="text-xl text-gray-400">Strategic Base Defense</p>
        </div>

        {/* Join Battle Button */}
        <button
          onClick={onStartBattle}
          className="w-full py-6 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-black text-2xl hover:bg-lime-900/60 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_50px_rgba(163,230,53,0.5)] tracking-widest"
        >
          JOIN FREE BATTLE
        </button>

        <div className="text-center mt-4 text-xs text-gray-600">
          Press to enter matchmaking queue
        </div>

        {/* How to Play Section */}
        <div className="mt-8 bg-black/60 border-2 border-lime-900 mb-6">
          <button
            onClick={() => setIsHowToPlayOpen(!isHowToPlayOpen)}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 hover:bg-lime-900/10 transition-all relative"
          >
            <span className="material-icons-outlined text-yellow-500 text-xl">help_outline</span>
            <h3 className="text-yellow-500 font-bold text-sm tracking-widest">HOW TO PLAY</h3>
            <span className="material-icons-outlined text-yellow-500 text-2xl absolute right-12">
              {isHowToPlayOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {isHowToPlayOpen && (
            <div className="px-4 pb-4 pt-2 border-t border-lime-900/30 space-y-4 animate-fadeIn">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-lime-900/40 border border-lime-500 flex items-center justify-center">
                  <span className="text-yellow-500 font-black text-sm">1</span>
                </div>
                <div className="flex-1">
                  <div className="text-lime-500 font-bold text-sm mb-1">DEFEND YOUR SILOS</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Select 2 of your 5 nuclear silos to shield (2 HP each) from enemy missiles. Undefended silos lose 1 HP when struck.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-lime-900/40 border border-lime-500 flex items-center justify-center">
                  <span className="text-yellow-500 font-black text-sm">2</span>
                </div>
                <div className="flex-1">
                  <div className="text-lime-500 font-bold text-sm mb-1">ATTACK THE ENEMY</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Select 3 enemy silos to strike. Each destroyed silo grants +1 HP to allocate on your defenses.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-lime-900/40 border border-lime-500 flex items-center justify-center">
                  <span className="text-yellow-500 font-black text-sm">3</span>
                </div>
                <div className="flex-1">
                  <div className="text-lime-500 font-bold text-sm mb-1">DESTROY 3 TO WIN</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    First to destroy 3 enemy silos wins.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-lime-900/40 border border-lime-500 flex items-center justify-center">
                  <span className="text-yellow-500 font-black text-sm">4</span>
                </div>
                <div className="flex-1">
                  <div className="text-lime-500 font-bold text-sm mb-1">10-SECOND TURNS</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Fast decisions under pressure. Hesitate and you forfeit your turn.
                  </p>
                </div>
              </div>

              {/* Fog of War Note */}
              <div className="mt-4 pt-4 border-t border-lime-900/30 bg-yellow-900/10 border border-yellow-900/30 p-3">
                <div className="flex items-start gap-2">
                  <div>
                    <div className="text-yellow-500 font-bold text-md mb-1">FOG OF WAR</div>
                    <p className="text-[12px] text-lime-600/80 leading-relaxed">
                      Describes the uncertainty, confusion, and lack of clarity in military conflicts, where information is often incomplete, misleading, or unavailable. In this game you can't see the enemy HP or which nuclear silos they are defending. Predict, adapt, and outthink your opponent!
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Live Operations Table */}
        <div className="bg-black/60 border-2 border-lime-900">
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10 flex justify-between items-center">
            <h2 className="text-lime-500 font-bold text-sm tracking-widest">SOL OPERATIONS</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
              <span className="text-red-500 font-bold text-xs font-mono">127 Online</span>
            </div>
          </div>
          <div className="p-4 space-y-4">

            {/* Create Match Section */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lime-500 font-bold text-sm">SOL</span>
                    <input
                      ref={betInputRef}
                      type="number"
                      step="0.1"
                      min="0.1"
                      defaultValue="0.1"
                      className="w-24 bg-gray-900 border border-lime-900 text-lime-500 px-2 py-1 text-sm font-mono focus:outline-none focus:border-lime-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateMatch}
                  className="px-6 py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all text-sm whitespace-nowrap">
                  CREATE MATCH
                </button>
              </div>

            {/* Active Matches */}
            {matches.length === 0 ? (
              <div className="text-center text-gray-600 text-md py-4">
                No operations detected
                <div className="text-xs mt-2">Create a match or check back soon</div>
              </div>
            ) : (
              <div className="space-y-2">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between border border-lime-900 bg-black/40 p-3 hover:bg-lime-900/10 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FlagIcon countryCode={match.flag} width="32px" height="24px" />
                      <div className="flex flex-col">
                        <div className="text-lime-500 font-bold text-xs font-mono">
                          {match.creator}
                        </div>
                        <div className="text-[10px] text-gray-600">
                          {getTimeAgo(match.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lime-500 font-bold text-sm font-mono">
                          {match.betAmount.toFixed(1)} SOL
                        </div>
                      </div>
                      <button
                        onClick={onStartBattle}
                        className="px-4 py-2 bg-lime-900/40 border border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all text-xs whitespace-nowrap"
                      >
                        JOIN
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
