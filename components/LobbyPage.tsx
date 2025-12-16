import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { WalletButton } from './WalletButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { useOnlinePlayers } from '../hooks/useOnlinePlayers';
import { supabase } from '../lib/supabase';
import { useRecentWins } from '../hooks/useRecentWins';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { WinsTicker } from './WinsTicker';
import { FlagIcon } from './FlagIcon';

interface LobbyPageProps {
  player: Player;
  onStartBattle: (matchId?: string) => void;
  matches?: any[];
  onMatchesChange?: (matches: any[]) => void;
  isInBattle?: boolean;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
  player,
  onStartBattle,
  isInBattle = false
}) => {
  const { connected, publicKey } = useWallet();
  const { onlineCount, isLoading } = useOnlinePlayers();
  const { wins } = useRecentWins();
  const { activities } = useActivityFeed();
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<number>(0.01);
  const [gameBalance, setGameBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Queue state
  const [queueStatus, setQueueStatus] = useState<'idle' | 'queued' | 'matched'>('idle');
  const [searchingWager, setSearchingWager] = useState<number | null>(null);
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [queueCount, setQueueCount] = useState<number>(0);

  // Shake animation state for Latest Wins
  const [previousWinsCount, setPreviousWinsCount] = useState<number>(0);
  const [isWinsShaking, setIsWinsShaking] = useState(false);

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

  // Poll for match creation when in queue (more reliable than Realtime subscriptions)
  useEffect(() => {
    if (queueStatus !== 'queued' || !player.id) return;

    // Track when we started searching - only match on games created AFTER this
    const searchStartTime = new Date().toISOString();
    console.log(`🔄 Starting match polling for player ${player.id} at ${searchStartTime}`);

    const checkForMatch = async () => {
      try {
        // Check if match was created AFTER we joined the queue
        const { data: match, error } = await supabase
          .from('matches')
          .select('*')
          .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
          .eq('status', 'active')
          .gte('created_at', searchStartTime)  // Only matches created after we joined queue
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error checking for match:', error);
          return;
        }

        if (match) {
          console.log('✅ Match found! Transitioning to battle...', match.id);
          setQueueStatus('matched');
          onStartBattle(match.id);
        }
      } catch (error) {
        console.error('Error in match polling:', error);
      }
    };

    // Check immediately, then every second
    checkForMatch();
    const interval = setInterval(checkForMatch, 1000);

    return () => {
      console.log('⏹️ Stopping match polling');
      clearInterval(interval);
    };
  }, [queueStatus, player.id]);

  // Nuclear icon rotation animation
  useEffect(() => {
    if (queueStatus !== 'queued') return;

    const interval = setInterval(() => {
      setRotationAngle(prev => (prev + 45) % 360);
    }, 200);

    return () => clearInterval(interval);
  }, [queueStatus]);

  // Queue count monitoring
  useEffect(() => {
    if (queueStatus !== 'queued' || !searchingWager) return;

    const fetchQueueCount = async () => {
      const { data } = await supabase
        .from('matchmaking_queue')
        .select('id')
        .eq('wager_amount', searchingWager);

      // Subtract 1 to exclude current player
      setQueueCount(Math.max(0, (data?.length || 0) - 1));
    };

    fetchQueueCount();
    const interval = setInterval(fetchQueueCount, 3000);
    return () => clearInterval(interval);
  }, [queueStatus, searchingWager]);

  // Timeout auto-cancel (3 minutes)
  useEffect(() => {
    if (queueStatus !== 'queued') return;

    const timeout = setTimeout(() => {
      setMatchmakingError('Matchmaking timed out. Please try again.');
      handleCancelQueue();
    }, 180000);

    return () => clearTimeout(timeout);
  }, [queueStatus]);

  // Browser close cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (queueStatus === 'queued' && player.id) {
        const blob = new Blob(
          [JSON.stringify({ playerId: player.id })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(
          `${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/leave`,
          blob
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [queueStatus, player.id]);

  // Detect new wins for shake animation
  useEffect(() => {
    if (wins.length > previousWinsCount && previousWinsCount > 0) {
      setIsWinsShaking(true);
      setTimeout(() => setIsWinsShaking(false), 500);
    }
    setPreviousWinsCount(wins.length);
  }, [wins.length]);

  const handleJoinQueue = async (wager: number) => {
    if (!connected || !publicKey) return;

    if (gameBalance < wager) {
      setBalanceError(`Insufficient balance. You have ${gameBalance.toFixed(2)} SOL but need ${wager.toFixed(2)} SOL`);
      setTimeout(() => setBalanceError(null), 5000);
      return;
    }

    try {
      setQueueStatus('queued');
      setSearchingWager(wager);
      setMatchmakingError(null);

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id, wagerAmount: wager })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to join queue');

      if (result.status === 'matched') {
        // Instant match found
        setQueueStatus('matched');
        setGameBalance(prev => prev - wager);
        onStartBattle(result.matchId);
      } else {
        // Waiting for opponent
        setGameBalance(prev => prev - wager);
      }
    } catch (error: any) {
      setMatchmakingError(error.message || 'Failed to join matchmaking');
      setQueueStatus('idle');
      setSearchingWager(null);
    }
  };

  const handleCancelQueue = async () => {
    if (!searchingWager) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setGameBalance(prev => prev + result.refundedAmount);
      setQueueStatus('idle');
      setSearchingWager(null);
    } catch (error: any) {
      setMatchmakingError(error.message || 'Failed to cancel');
    }
  };

  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-black text-lime-500 animate-pulse">WARFOG.IO</h1>
          <WalletButton className="wallet-custom" />
        </div>
      

        {/* How to Play Section */}
        <div className="bg-black/60 mb-2">
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
                  <div className="text-lime-500 font-bold text-sm mb-1">ATTACK THE ENEMY</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Attack 3 enemy silos. Each silo destroyed grants you +1 HP on your defenses.
                  </p>
                  <div>
                    <img
                      src="/attack-mechanics.gif"
                      alt="Attack mechanics"
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
                  <div className="text-lime-500 font-bold text-sm mb-1">DEFEND YOUR SILOS</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Defend 2 silos from enemy missiles. Hit silos lose -1 HP.
                  </p>
                  <div>
                    <img
                      src="/defend-mechanics.gif"
                      alt="Defend mechanics"
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
                    Destroy 3 enemy silos to win the match.
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
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    Fast decisions. No time for caution.
                  </p>
                </div>
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
                    onClick={() => onStartBattle()}
                    disabled={isInBattle}
                    className="w-full py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-black text-xl hover:bg-lime-900/60 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_50px_rgba(163,230,53,0.5)] tracking-widest relative z-10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40"
                  >
                    JOIN FREE BATTLE
                  </button>
                </div>
            </div>
          )}
        </div>
      
        <div className="text-center mt-3 text-xs text-gray-600 mb-6">
        </div>

        {/* Live Operations Table */}
        <div className="bg-black/60 mt-5">
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10 flex justify-between items-center">
            <h2 className="text-lime-500 font-bold text-md tracking-widest">SOL BATTLES</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
              <span className="text-red-500 font-bold text-xs font-mono">
                {isLoading ? '0' : onlineCount} Playing
              </span>
            </div>
          </div>
          <div className="p-4 space-y-4">

            {/* Queue-Based Matchmaking */}
            <div className="space-y-3">
              {/* Choose Lobby Header */}
              <div className="text-center mb-3">
                <h3 className="text-lime-500 font-bold text-lg tracking-widest">CHOOSE LOBBY</h3>
              </div>

              {/* Balance Display */}
              {connected && (
                <div className="text-left text-md">
                  <span className="text-gray-200">Game Balance: </span>
                  <span className="text-lime-500 font-bold font-mono">
                    {isLoadingBalance ? '...' : `${gameBalance.toFixed(2)} SOL`}
                  </span>
                </div>
              )}

              {/* Wager Selection + Join Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <span className="text-lime-500 font-bold text-sm sm:block hidden">SOL</span>
                <div className="flex flex-wrap gap-2 flex-1 mb-2">
                  {[0.01, 0.05, 0.1, 0.5, 1, 5].map(wager => (
                    <button
                      key={wager}
                      onClick={() => setSelectedBet(wager)}
                      disabled={!connected || isInBattle || queueStatus === 'queued'}
                      className={`flex-1 px-4 py-2 border font-mono text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedBet === wager
                          ? 'bg-lime-900/40 border-lime-500 text-lime-400'
                          : 'bg-gray-900 border-lime-900 text-lime-500 hover:border-lime-500 hover:bg-lime-900/20'
                      }`}
                    >
                      {wager.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Win Amount Display */}
              <div className="text-center text-gray-200 text-xl font-bold py-2">
                Play <span className="text-yellow-400">{selectedBet.toFixed(2)} SOL</span> to WIN <br></br><span className="text-yellow-400 text-2xl">{(selectedBet * 1.9).toFixed(3)} SOL</span>!
              </div>

              {/* Join Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <div className="btn-snake-wrapper w-full sm:w-auto">
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
                    onClick={() => handleJoinQueue(selectedBet)}
                    disabled={!connected || gameBalance < selectedBet || isInBattle || queueStatus === 'queued'}
                    className="w-full px-6 py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-black text-xl hover:bg-lime-900/60 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_50px_rgba(163,230,53,0.5)] tracking-widest relative z-10 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40"
                  >
                    JOIN SOL BATTLE
                  </button>
                </div>
              </div>

              {!connected && (
                <div className="text-center text-xs text-yellow-600">
                  Connect wallet to win SOL
                </div>
              )}

              {balanceError && (
                <div className="bg-red-900/20 border border-red-700 px-3 py-2">
                  <span className="text-red-500 text-xs font-bold">{balanceError}</span>
                </div>
              )}

              {matchmakingError && (
                <div className="bg-red-900/20 border border-red-700 px-3 py-2">
                  <span className="text-red-500 text-xs font-bold">{matchmakingError}</span>
                </div>
              )}
            </div>

            {/* Searching State or Empty Message */}
            {queueStatus === 'queued' && searchingWager !== null ? (
              <div className="border border-lime-500 bg-lime-900/20 p-6 space-y-4">
                <div className="text-center space-y-3">
                  {/* Rotating Nuclear Icon */}
                  <div
                    className="inline-block text-5xl transition-transform duration-500"
                    style={{ transform: `rotate(${rotationAngle}deg)` }}
                  >
                    ☢
                  </div>

                  <div className="text-lime-400 font-bold text-sm animate-pulse">
                    Searching for an opponent...
                  </div>

                  {/* Queue Count Display */}
                  {queueCount > 0 && (
                    <div className="text-gray-500 text-xs">
                      {queueCount} other player{queueCount > 1 ? 's' : ''} searching
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                <button
                  onClick={handleCancelQueue}
                  className="w-full px-6 py-3 bg-red-900/40 border-2 border-red-500 text-red-400 font-bold hover:bg-red-900/60 transition-all"
                >
                  CANCEL
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-black/60 mt-3">
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10">
            <h2 className="text-lime-500 font-bold text-md tracking-widest">ACTIVITY</h2>
          </div>
          <div className="p-2 space-y-2">
            {activities.length > 0 ? (
              (() => {
                // Deduplicate "started battle" activities (they appear twice, once for each player)
                const deduplicatedActivities: typeof activities = [];
                const seenBattles = new Set<string>();

                activities.forEach((activity) => {
                  if (activity.message.includes('started battle')) {
                    // Extract both wallets from the message
                    const match = activity.message.match(/(.+?) started battle vs (.+)/);
                    if (match) {
                      const [_, wallet1, wallet2] = match;
                      // Create a unique key for this battle (sorted wallets to avoid duplicates)
                      const battleKey = [wallet1, wallet2].sort().join('-');
                      if (!seenBattles.has(battleKey)) {
                        seenBattles.add(battleKey);
                        deduplicatedActivities.push(activity);
                      }
                    }
                  } else {
                    deduplicatedActivities.push(activity);
                  }
                });

                return deduplicatedActivities.slice(0, 7).map((activity) => {
                  const timeAgo = Math.floor((Date.now() - activity.timestamp) / 1000);
                  let timeDisplay = '';
                  if (timeAgo < 5) {
                    timeDisplay = 'now...';
                  } else if (timeAgo < 60) {
                    timeDisplay = `${timeAgo}s ago`;
                  } else if (timeAgo < 3600) {
                    timeDisplay = `${Math.floor(timeAgo / 60)}m ago`;
                  } else if (timeAgo < 86400) {
                    timeDisplay = `${Math.floor(timeAgo / 3600)}h ago`;
                  } else {
                    timeDisplay = `${Math.floor(timeAgo / 86400)}d ago`;
                  }

                  // Parse the message to extract wallet, action, and SOL amount
                  const messageParts = activity.message.split(' ');
                  const wallet = messageParts[0]; // e.g., "Fu8s...Shmz"

                  // Determine emoji, action text, and formatting
                  let emoji = '';
                  let content: JSX.Element | null = null;

                  if (activity.message.includes('joined')) {
                    const lobbyMatch = activity.message.match(/joined ([\d.]+) lobby/);
                    if (lobbyMatch) {
                      emoji = '🚀';
                      content = (
                        <>
                          {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                          <span className="text-white"> {wallet}</span>
                          <span className="text-blue-400"> joined lobby </span>
                          <span className="text-lime-400">{lobbyMatch[1]}</span>
                        </>
                      );
                    }
                  } else if (activity.message.includes('started battle')) {
                    const vsMatch = activity.message.match(/(.+?) started battle vs (.+)/);
                    if (vsMatch) {
                      emoji = '⚔️';
                      const wallet1 = vsMatch[1];
                      const wallet2 = vsMatch[2];
                      content = (
                        <>
                          {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                          <span className="text-white"> {wallet1}</span>
                          <span className="text-yellow-400"> vs </span>
                          {activity.opponentCountryCode && <FlagIcon countryCode={activity.opponentCountryCode} width="16px" height="12px" />}
                          <span className="text-white"> {wallet2}</span>
                        </>
                      );
                    }
                  } else if (activity.message.includes('connected wallet')) {
                    emoji = '💎';
                    content = (
                      <>
                        {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                        <span className="text-white"> {wallet}</span>
                        <span className="text-red-400"> connected wallet</span>
                      </>
                    );
                  }

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2 py-2 px-3 hover:bg-gray-900/20 transition-all text-xs font-bold border-b border-gray-700/20 last:border-b-0"
                    >
                      <span className="flex-1">{content}</span>
                      <span className="text-gray-500 text-xs">{timeDisplay}</span>
                      <span className="text-md">{emoji}</span>
                    </div>
                  );
                });
              })()
            ) : (
              <div className="text-center py-8 text-gray-600 text-sm">No activity yet</div>
            )}
          </div>
        </div>

        {/* Latest Wins Table */}
        <div className={`bg-black/60 mt-4 transition-transform ${isWinsShaking ? 'animate-shake' : ''}`}>
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10">
            <h2 className="text-lime-500 font-bold text-md tracking-widest">LATEST WINS</h2>
          </div>

        {/* Recent Wins Ticker */}
        <WinsTicker wins={wins} />

          <div className="p-2 space-y-2">
            {wins.length > 1 ? (
              wins.slice(1, 8).map((win) => {
                const timeAgo = Math.floor((Date.now() - win.timestamp) / 1000);
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

                return (
                  <div
                    key={win.id}
                    className="flex items-center gap-2 py-2 px-3 hover:bg-gray-900/20 transition-all text-sm font-bold border-b border-gray-700/20 last:border-b-0"
                  >
                    {win.countryCode && <FlagIcon countryCode={win.countryCode} width="16px" height="12px" />}
                    <span className="text-white text-xs">{win.winnerWallet}</span>
                    <span className="text-purple-400 text-xs">just won</span>
                    <span className="text-lime-400 font-black">{win.amount.toFixed(2)} SOL</span>
                    <span className="text-gray-500 text-xs ml-1">{timeDisplay}</span>
                  </div>
                );
              })
            ) : wins.length === 1 ? (
              <div className="text-center py-8 text-gray-600 text-sm">More wins coming soon...</div>
            ) : (
              <div className="text-center py-8 text-gray-600 text-sm">No wins yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
