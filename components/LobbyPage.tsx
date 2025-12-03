import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';
import { WalletButton } from './WalletButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { useOnlinePlayers } from '../hooks/useOnlinePlayers';
import { supabase } from '../lib/supabase';
import { useRecentWins } from '../hooks/useRecentWins';
import { WinsTicker } from './WinsTicker';

interface LobbyPageProps {
  player: Player;
  onStartBattle: () => void;
  matches?: any[];
  onMatchesChange?: (matches: any[]) => void;
  isInBattle?: boolean;
}

interface Match {
  id: string;
  betAmount: number;
  creator: string;
  createdAt: Date;
  flag: string;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
  player,
  onStartBattle,
  matches: propMatches = [],
  onMatchesChange,
  isInBattle = false
}) => {
  const { connected, publicKey } = useWallet();
  const { onlineCount, isLoading } = useOnlinePlayers();
  const { wins } = useRecentWins();
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<number>(0.1);
  const [gameBalance, setGameBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Use prop matches or fall back to empty array
  const matches = propMatches;

  // Fetch user's game balance
  useEffect(() => {
    const fetchGameBalance = async () => {
      if (!player.id || player.id.length < 20) {
        setIsLoadingBalance(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('players')
          .select('game_balance')
          .eq('id', player.id)
          .single();

        if (error) throw error;

        setGameBalance(data?.game_balance || 0);
        setIsLoadingBalance(false);
      } catch (error) {
        console.error('Error fetching game balance:', error);
        setGameBalance(0);
        setIsLoadingBalance(false);
      }
    };

    fetchGameBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchGameBalance, 10000);

    return () => clearInterval(interval);
  }, [player.id]);

  const handleCreateMatch = async () => {
    if (!connected || !publicKey) {
      return;
    }

    // Check if user has sufficient balance
    if (gameBalance < selectedBet) {
      setBalanceError(`Insufficient balance. You have ${gameBalance.toFixed(2)} SOL but need ${selectedBet.toFixed(1)} SOL`);
      setTimeout(() => setBalanceError(null), 5000);
      return;
    }

    const newMatch: Match = {
      id: Math.random().toString(36).substr(2, 9),
      betAmount: selectedBet,
      creator: publicKey.toBase58().slice(0, 4) + '...' + publicKey.toBase58().slice(-4),
      createdAt: new Date(),
      flag: player.countryFlag,
    };

    // TODO: Save to database via Supabase and deduct bet amount
    // const { data, error } = await supabase
    //   .from('matches')
    //   .insert({
    //     bet_amount: selectedBet,
    //     creator_wallet: publicKey.toBase58(),
    //     creator_flag: player.countryFlag,
    //     status: 'waiting'
    //   });
    //
    // if (!error) {
    //   // Deduct bet amount from balance
    //   await supabase
    //     .from('players')
    //     .update({ game_balance: gameBalance - selectedBet })
    //     .eq('id', player.id);
    //   setGameBalance(prev => prev - selectedBet);
    // }

    // Update matches through parent component
    if (onMatchesChange) {
      onMatchesChange([...matches, newMatch]);
    }

    setBalanceError(null);
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
          <h1 className="text-5xl font-black mb-2 text-lime-500 animate-pulse">WARFOG.IO</h1>
          <p className="text-md text-gray-400 mb-6">Strategic Defense Game</p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>

        {/* How to Play Section */}
        <div className="bg-black/60 border-2 border-lime-900 mb-6">
          <button
            onClick={() => setIsHowToPlayOpen(!isHowToPlayOpen)}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 hover:bg-lime-900/10 transition-all relative"
          >
            <span className="material-icons-outlined text-yellow-500 text-xl">help_outline</span>
            <h3 className="text-yellow-500 font-bold text-lg tracking-widest">HOW TO PLAY</h3>
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
                    Select 2 silos to protect from enemy missiles. Hit silos lose 1 HP (2 HP each).
                  </p>
                  <div>
                    <img 
                      src="/src\defend GIF.gif" 
                      alt="Defend mechanics" 
                      className="w-full rounded-md"
                    />
                  </div>
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
                    Select 3 enemy silos to attack. Each destroyed silo grants you +1 HP to allocate on your defenses.
                  </p>
                  <div>
                    <img 
                      src="/src\attack GIF.gif" 
                      alt="Attack mechanics" 
                      className="w-full rounded-md"
                    />
                  </div>
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
                    First player to destroy 3 enemy silos wins the match.
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
                    Fast decisions. No time for caution.
                  </p>
                </div>
              </div>

              {/* Fog of War Note */}
              <div className="mt-4 pt-4 bg-yellow-900/25 border border-yellow-900/100 p-3">
                <div className="flex items-start gap-2">
                  <div>
                    <div className="text-yellow-500 font-bold text-center text-xl mb-1">FOG OF WAR</div>
                    <p className="text-sm text-lime-500/90 text-center leading-relaxed">
                      In this game you can't see the enemy HP or which nuclear silos they are defending. You must predict, adapt, and outthink your opponent!
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Join Battle Button */}
        <div className="btn-snake-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: 'transparent', stopOpacity: 0 }} />
                <stop offset="30%" style={{ stopColor: '#84cc16', stopOpacity: 0.3 }} />
                <stop offset="70%" style={{ stopColor: '#a3e635', stopOpacity: 0.5 }} />
                <stop offset="100%" style={{ stopColor: '#84cc16', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: 'transparent', stopOpacity: 0 }} />
                <stop offset="30%" style={{ stopColor: '#65a30d', stopOpacity: 0.3 }} />
                <stop offset="70%" style={{ stopColor: '#84cc16', stopOpacity: 0.5 }} />
                <stop offset="100%" style={{ stopColor: '#65a30d', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" />
            <rect x="2" y="2" width="calc(100% - 4px)" height="calc(100% - 4px)" />
          </svg>
          <button
            onClick={onStartBattle}
            disabled={isInBattle}
            className="w-full py-6 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-black text-2xl hover:bg-lime-900/60 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_50px_rgba(163,230,53,0.5)] tracking-widest relative z-10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40"
          >
            JOIN FREE BATTLE
          </button>
        </div>

        <div className="text-center mt-3 text-xs text-gray-600 mb-6">
        </div>

        {/* Recent Wins Ticker */}
        <WinsTicker wins={wins} />

        {/* Live Operations Table */}
        <div className="bg-black/60 border-2 border-lime-900">
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10 flex justify-between items-center">
            <h2 className="text-lime-500 font-bold text-md tracking-widest">SOL OPERATIONS</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
              <span className="text-red-500 font-bold text-xs font-mono">
                {isLoading ? '0' : onlineCount} Online
              </span>
            </div>
          </div>
          <div className="p-4 space-y-4">

            {/* Create Match Section */}
            <div className="space-y-3">
              {/* Balance Display */}
              {connected && (
                <div className="text-left text-md">
                  <span className="text-gray-500">Game Balance: </span>
                  <span className="text-lime-500 font-bold font-mono">
                    {isLoadingBalance ? '...' : `${gameBalance.toFixed(2)} SOL`}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <span className="text-lime-500 font-bold text-sm sm:block hidden">SOL</span>
                <div className="flex gap-2 flex-1 mb-2">
                  <button
                    onClick={() => setSelectedBet(0.1)}
                    disabled={!connected || isInBattle}
                    className={`flex-1 px-4 py-2 border font-mono text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedBet === 0.1
                        ? 'bg-lime-900/40 border-lime-500 text-lime-400'
                        : 'bg-gray-900 border-lime-900 text-lime-500 hover:border-lime-500 hover:bg-lime-900/20'
                    }`}
                  >
                    0,1
                  </button>
                  <button
                    onClick={() => setSelectedBet(0.5)}
                    disabled={!connected || isInBattle}
                    className={`flex-1 px-4 py-2 border font-mono text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedBet === 0.5
                        ? 'bg-lime-900/40 border-lime-500 text-lime-400'
                        : 'bg-gray-900 border-lime-900 text-lime-500 hover:border-lime-500 hover:bg-lime-900/20'
                    }`}
                  >
                    0,5
                  </button>
                  <button
                    onClick={() => setSelectedBet(1)}
                    disabled={!connected || isInBattle}
                    className={`flex-1 px-4 py-2 border font-mono text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedBet === 1
                        ? 'bg-lime-900/40 border-lime-500 text-lime-400'
                        : 'bg-gray-900 border-lime-900 text-lime-500 hover:border-lime-500 hover:bg-lime-900/20'
                    }`}
                  >
                    1
                  </button>
                </div>
                <button
                  onClick={handleCreateMatch}
                  disabled={!connected || gameBalance < selectedBet || isInBattle}
                  className="w-full sm:w-auto px-6 py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all text-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40"
                >
                  CREATE SOL MATCH
                </button>
              </div>

              {!connected && (
                <div className="text-center text-xs text-yellow-600">
                  Connect wallet to create a match
                </div>
              )}

              {balanceError && (
                <div className="bg-red-900/20 border border-red-700 px-3 py-2">
                  <span className="text-red-500 text-xs font-bold">{balanceError}</span>
                </div>
              )}
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
                        disabled={isInBattle}
                        className="px-4 py-2 bg-lime-900/40 border border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40"
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
