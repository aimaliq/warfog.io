import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { WalletButton } from './WalletButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';
import { FlagIcon } from './FlagIcon';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useOnlinePlayers } from '../hooks/useOnlinePlayers';

const COUNTRY_CODES = [
  'us', 'gb', 'ca', 'au', 'de', 'fr', 'it', 'es', 'nl', 'se',
  'no', 'dk', 'fi', 'pl', 'ru', 'jp', 'cn', 'kr', 'in', 'br',
  'mx', 'ar', 'za', 'eg', 'ng', 'ke', 'il', 'tr', 'sa', 'ae'
];

interface PlayPageProps {
  player: Player;
  onStartBattle: (matchId?: string) => void;
  onPlayerUpdate?: (updates: Partial<Player>) => void;
  isInBattle?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const PlayPage: React.FC<PlayPageProps> = ({ player, onStartBattle, onPlayerUpdate, isInBattle = false, isMuted = false, onToggleMute }) => {
  const { connected, publicKey } = useWallet();
  const { activities } = useActivityFeed('free');
  const { onlineCount, isLoading } = useOnlinePlayers();
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(player.username === 'COMMANDER_ALPHA' ? '' : player.username);
  const [editCountry, setEditCountry] = useState(player.countryFlag);
  const [isSaving, setIsSaving] = useState(false);
  const [prevPlayerId, setPrevPlayerId] = useState(player.id);

  // players simulation
  const [fPlayers, setFPlayers] = useState<number>(0);

  // ✅ NEW: Queue state for free match matchmaking
  const [queueStatus, setQueueStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [queuedPlayers, setQueuedPlayers] = useState<any[]>([]);

  // Update local state when player prop changes (e.g., wallet disconnect creates new guest)
  useEffect(() => {
    // If player ID changed (new guest after wallet disconnect), update immediately
    if (player.id !== prevPlayerId) {
      setPrevPlayerId(player.id);
      setEditUsername(player.username === 'COMMANDER_ALPHA' ? '' : player.username);
      setEditCountry(player.countryFlag);
    }
  }, [player.id, player.username, player.countryFlag, prevPlayerId]);

  // Fake player simulation
  useEffect(() => {
    const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    setFPlayers(getRandom(4, 12));

    const interval = setInterval(() => {
      setFPlayers(getRandom(4, 12));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // ✅ NEW: Fetch queued players for activity feed
  useEffect(() => {
    const fetchQueue = async () => {
      const { data } = await supabase
        .from('active_matchmaking_queue')
        .select('*');

      setQueuedPlayers(data || []);
    };

    fetchQueue();

    // Realtime subscription for queue changes
    const subscription = supabase
      .channel('queue_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matchmaking_queue'
      }, fetchQueue)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ✅ NEW: Poll for match when queued
  useEffect(() => {
    if (queueStatus !== 'searching') return;

    // Record when we started searching to avoid detecting old matches
    const searchStartTime = new Date().toISOString();

    const interval = setInterval(async () => {
      try {
        const { data: matches } = await supabase
          .from('matches')
          .select('id, created_at')
          .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
          .eq('status', 'active')
          .gte('created_at', searchStartTime)  // Only matches created after we started searching
          .order('created_at', { ascending: false })
          .limit(1);

        if (matches && matches.length > 0) {
          const foundMatchId = matches[0].id;
          setMatchId(foundMatchId);
          setQueueStatus('matched');
          onStartBattle(foundMatchId);
        }
      } catch (error) {
        // No match yet, keep polling
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [queueStatus, player.id, onStartBattle]);

  // ✅ NEW: Cleanup - Cancel queue on unmount
  useEffect(() => {
    return () => {
      if (queueStatus === 'searching') {
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: player.id })
        }).catch(console.error);
      }
    };
  }, [queueStatus, player.id]);

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const walletAddress = connected && publicKey ? publicKey.toBase58() : null;
      let playerId = player.id;

      if (playerId && playerId.length > 20) {
        await supabase
          .from('players')
          .update({
            username: editUsername,
            country_code: editCountry,
            wallet_address: walletAddress,
            is_guest: !connected,
          })
          .eq('id', playerId);
      } else {
        const { data } = await supabase
          .from('players')
          .insert({
            username: editUsername,
            country_code: editCountry,
            wallet_address: walletAddress,
            is_guest: !connected,
          })
          .select()
          .single();

        if (data) playerId = data.id;
      }

      if (onPlayerUpdate) {
        onPlayerUpdate({
          id: playerId,
          username: editUsername,
          countryFlag: editCountry,
          isGuest: !connected,
        });
      }

      setIsSaving(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      setIsSaving(false);
    }
  };

  // ✅ NEW: Join matchmaking queue (free matches)
  const handleJoinQueue = async () => {
    if (!player.id || isInBattle || queueStatus !== 'idle') return;

    setQueueStatus('searching');

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          wagerAmount: 0  // Free match
        })
      });

      const data = await response.json();

      if (data.status === 'matched') {
        setMatchId(data.matchId);
        setQueueStatus('matched');
        onStartBattle(data.matchId);
      }
    } catch (error) {
      console.error('Failed to join queue:', error);
      setQueueStatus('idle');
    }
  };

  // ✅ NEW: Cancel queue
  const handleCancelQueue = async () => {
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id })
      });
      setQueueStatus('idle');
    } catch (error) {
      console.error('Failed to cancel queue:', error);
    }
  };

  // ✅ NEW: Bot match handler (moved from PLAY button)
  const handlePlayBot = () => {
    onStartBattle(undefined);  // No matchId = bot match
  };

  // ✅ NEW: Join existing queued player's match
  const handleJoinMatch = async (opponentId: string) => {
    if (!player.id || queueStatus !== 'idle') return;

    setQueueStatus('searching');

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/join-specific`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          targetPlayerId: opponentId
        })
      });

      const data = await response.json();

      if (data.status === 'matched') {
        setMatchId(data.matchId);
        setQueueStatus('matched');
        onStartBattle(data.matchId);
      } else {
        // If match failed, return to idle
        setQueueStatus('idle');
      }
    } catch (error) {
      console.error('Failed to join match:', error);
      setQueueStatus('idle');
    }
  };

  return (
    <div className="flex flex-col items-center px-4 py-8 lg:ml-64">
      <div className="w-full max-w-2xl">

        {/* Header - Volume Button (left) and Wallet Button (right) */}
        <div className="mb-8 flex items-center justify-between">
          {/* Volume Toggle Button */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              className="p-3 bg-gray-900/60 border border-lime-900 hover:border-lime-500 rounded transition-all group"
              title={isMuted ? "Unmute music" : "Mute music"}
            >
              <span className="material-icons-outlined text-lime-500 group-hover:text-lime-400 text-2xl">
                {isMuted ? 'volume_off' : 'volume_up'}
              </span>
            </button>
          )}
          <WalletButton className="wallet-custom" />
        </div>

        {/* WARFOG.IO Logo - Centered and Prominent */}
        <div className="text-center mb-12 mt-12">
          <h1 className="text-5xl font-black text-lime-500 tracking-wider animate-pulse">WARFOG.IO</h1>
        </div>

        {/* Player */}
        <div className="mb-10 max-w-md mx-auto px-3 space-y-4">
          {/* Inline Flag and Username */}
          <div className="flex gap-3 items-center justify-center">
            {/* Flag Selector */}
            <div className="relative">
              <label className="block text-xs text-gray-400 mb-2 ">Country</label>
              <div className="relative">
                <select
                  value={editCountry}
                  onChange={(e) => {
                    setEditCountry(e.target.value);
                    handleSaveProfile();
                  }}
                  className="bg-gray-900 border border-lime-900 text-lime-500 px-4 py-3 h-12 font-mono focus:outline-none focus:border-lime-500 appearance-none cursor-pointer pr-16 rounded"
                >
                  {COUNTRY_CODES.map((code) => (
                    <option key={code} value={code} className="bg-gray-900">
                      {code.toUpperCase()}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <FlagIcon countryCode={editCountry} width="32px" height="24px" />
                </div>
              </div>
            </div>

            {/* Username Input */}
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-2">Nickname</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                onBlur={handleSaveProfile}
                maxLength={20}
                autoFocus={player.isGuest && !editUsername}
                className="w-full bg-gray-900 border text-sm border-lime-900 text-lime-500 px-4 py-3 h-12 font-mono focus:outline-none focus:border-lime-500 rounded placeholder:text-gray-600 placeholder:italic"
                placeholder="Enter your nickname"
              />
            </div>
          </div>

          {/* Play Button - Queue System */}
          {queueStatus === 'idle' ? (
            <button
              onClick={handleJoinQueue}
              disabled={isInBattle || isSaving}
              className="w-full py-4 bg-lime-900/40 border-2 rounded border-lime-400 text-lime-400 font-black text-2xl hover:bg-lime-900/60 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_50px_rgba(163,230,53,0.5)] tracking-widest disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40 animate-pulse"
            >
              PLAY
            </button>
          ) : queueStatus === 'searching' ? (
            <div className="space-y-3">
              <div className="w-full py-4 bg-yellow-900/40 border-2 rounded border-yellow-400 text-yellow-400 font-black text-xl text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="material-icons-outlined animate-spin">refresh</span>
                  <span>SEARCHING FOR OPPONENT...</span>
                </div>
              </div>
              <button
                onClick={handleCancelQueue}
                className="w-full py-2 bg-red-900/40 border border-red-400 text-red-400 font-bold text-sm hover:bg-red-900/60 transition-all rounded"
              >
                CANCEL
              </button>
            </div>
          ) : null}
        </div>

      {/* How to Play Section */}
        <div className="bg-black/60 mb-6 mr-4">
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

              {/* ✅ NEW: Step 5 - Play Against Bot */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-lime-900/30">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-900/40 border border-blue-500 flex items-center justify-center">
                  <span className="material-icons-outlined text-blue-400 text-sm">smart_toy</span>
                </div>
                <div className="flex-1">
                  <div className="text-blue-400 font-bold text-sm mb-1">PRACTICE AGAINST BOT</div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-3">
                    Practice the game mechanics against a bot opponent before facing real players.
                  </p>
                  <button
                    onClick={handlePlayBot}
                    disabled={isInBattle || queueStatus !== 'idle'}
                    className="w-full py-2 bg-blue-900/40 border border-blue-400 text-blue-400 font-bold text-sm hover:bg-blue-900/60 transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    PLAY AGAINST BOT
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Activity Feed - Free Matches Only */}
        <div className="bg-black/60">
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10 flex items-center justify-between">
            <h2 className="text-lime-500 font-bold text-md tracking-widest">ACTIVITY</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
              <span className="text-red-500 font-bold text-xs font-mono">
                {isLoading ? fPlayers : ((onlineCount || 0) + fPlayers)} Playing
              </span>
            </div>
          </div>
          <div className="p-2 space-y-2">
            {/* ✅ NEW: Show queued players with JOIN button */}
            {queuedPlayers.length > 0 && queuedPlayers
              .filter(q => q.player_id !== player.id)  // Don't show self
              .map((entry) => {
                const timeAgo = Math.floor((Date.now() - new Date(entry.created_at).getTime()) / 1000);
                const timeDisplay = timeAgo < 5 ? 'now...' : `${timeAgo}s ago`;

                return (
                  <div
                    key={entry.queue_id}
                    className="flex items-center gap-2 py-3 px-3 bg-yellow-900/20 border border-yellow-500/30 hover:bg-yellow-900/30 transition-all text-xs font-bold rounded"
                  >
                    {entry.country_code && <FlagIcon countryCode={entry.country_code} width="16px" height="12px" />}
                    <span className="text-white">{entry.username}</span>
                    <span className="text-yellow-400">looking for opponent</span>
                    <span className="text-yellow-500 ml-auto">⚡{entry.rating}</span>
                    <span className="text-gray-500 text-xs">{timeDisplay}</span>
                    <button
                      onClick={() => handleJoinMatch(entry.player_id)}
                      disabled={queueStatus !== 'idle'}
                      className="ml-2 px-3 py-1 bg-lime-500 text-black font-bold rounded hover:bg-lime-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      JOIN
                    </button>
                  </div>
                );
              })}

            {/* Recent Activities */}
            {activities.length > 0 && (
              <div className={queuedPlayers.filter(q => q.player_id !== player.id).length > 0 ? "pt-4 border-t border-gray-700/20" : ""}>
                {(() => {
                  // Deduplicate "started battle" activities
                  const deduplicatedActivities: typeof activities = [];
                  const seenBattles = new Set<string>();

                  activities.forEach((activity) => {
                    if (activity.message.includes('started battle')) {
                      const match = activity.message.match(/(.+?) started battle vs (.+)/);
                      if (match) {
                        const [_, wallet1, wallet2] = match;
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

                  // Parse message to build content with proper formatting
                  let emoji = '';
                  let content: JSX.Element | null = null;

                  if (activity.message.includes('joined')) {
                    const lobbyMatch = activity.message.match(/(.+?) joined ([\d.]+) lobby/);
                    if (lobbyMatch) {
                      const username = lobbyMatch[1];
                      emoji = '☢️';
                      content = (
                        <>
                          {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                          <span className="text-white"> {username}</span>
                          <span className="text-blue-400"> joined lobby</span>
                        </>
                      );
                    }
                  } else if (activity.message.includes('started battle')) {
                    const vsMatch = activity.message.match(/(.+?) started battle vs (.+)/);
                    if (vsMatch) {
                      emoji = '⚔️';
                      const username1 = vsMatch[1];
                      const username2 = vsMatch[2];
                      content = (
                        <>
                          {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                          <span className="text-white"> {username1}</span>
                          <span className="text-yellow-400"> vs </span>
                          {activity.opponentCountryCode && <FlagIcon countryCode={activity.opponentCountryCode} width="16px" height="12px" />}
                          <span className="text-white"> {username2}</span>
                        </>
                      );
                    }
                  } else if (activity.message.includes('connected wallet')) {
                    const walletMatch = activity.message.match(/(.+?) connected wallet/);
                    if (walletMatch) {
                      const username = walletMatch[1];
                      emoji = '💎';
                      content = (
                        <>
                          {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                          <span className="text-white"> {username}</span>
                          <span className="text-red-400"> connected wallet</span>
                        </>
                      );
                    }
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
                })()}
              </div>
            )}

            {/* No players or activity */}
            {queuedPlayers.filter(q => q.player_id !== player.id).length === 0 && activities.length === 0 && (
              <div className="text-center py-8 text-gray-600 text-sm">No players in queue</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
