import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { WalletButton } from './WalletButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';
import { FlagIcon } from './FlagIcon';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useOnlinePlayers } from '../hooks/useOnlinePlayers';
import { RatingChart } from './RatingChart';

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
  const [editUsername, setEditUsername] = useState(() => {
    if (player.username && player.username !== 'COMMANDER_ALPHA') return player.username;
    return localStorage.getItem('warfog_guest_username') || '';
  });
  const [editCountry, setEditCountry] = useState(() => {
    if (player.countryFlag && player.countryFlag !== 'us') return player.countryFlag;
    return localStorage.getItem('warfog_guest_country') || player.countryFlag;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [prevPlayerId, setPrevPlayerId] = useState(player.id);

  // Tutorial modal state - show only on first visit
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // players simulation
  const [fPlayers, setFPlayers] = useState<number>(0);

  // ✅ NEW: Queue state for free match matchmaking
  const [queueStatus, setQueueStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [queuedPlayers, setQueuedPlayers] = useState<any[]>([]);

  // Rating history state
  const [ratingHistory, setRatingHistory] = useState<{ rating: number; matchNumber: number }[]>([]);
  const [lastRatingChange, setLastRatingChange] = useState<number | null>(null);

  // Read last rating change from localStorage (saved by BattleScreen on game over)
  useEffect(() => {
    const saved = localStorage.getItem('warfog_last_rating_change');
    if (saved !== null) {
      setLastRatingChange(parseInt(saved, 10));
      localStorage.removeItem('warfog_last_rating_change');
    }
  }, []);

  // Update local state when player prop changes (e.g., wallet disconnect creates new guest)
  useEffect(() => {
    // If player ID changed (new guest after wallet disconnect), update immediately
    if (player.id !== prevPlayerId) {
      setPrevPlayerId(player.id);
      const savedUsername = localStorage.getItem('warfog_guest_username');
      const savedCountry = localStorage.getItem('warfog_guest_country');
      setEditUsername(
        player.username !== 'COMMANDER_ALPHA' ? player.username
        : savedUsername || ''
      );
      setEditCountry(
        player.countryFlag !== 'us' ? player.countryFlag
        : savedCountry || player.countryFlag
      );
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
  const fetchQueue = async () => {
    const { data } = await supabase
      .from('active_matchmaking_queue')
      .select('*');

    setQueuedPlayers(data || []);
  };

  useEffect(() => {
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

    // Poll every 500ms (0.5 seconds) for instant queue updates
    const pollInterval = setInterval(fetchQueue, 500);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  // Check if this is user's first visit - show tutorial modal
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('warfog_tutorial_seen');
    if (!hasSeenTutorial) {
      setShowTutorialModal(true);
    }
  }, []);

  // Fetch rating history for the chart
  useEffect(() => {
    const fetchRatingHistory = async () => {
      if (!player.id || player.id.length < 20) return;

      try {
        // Fetch last 20 matches for this player (as winner or loser)
        const { data: matches } = await supabase
          .from('matches')
          .select('id, winner_id, player1_id, player2_id, created_at')
          .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
          .eq('status', 'completed')
          .order('created_at', { ascending: true })
          .limit(20);

        if (!matches || matches.length === 0) {
          setRatingHistory([]);
          return;
        }

        // Calculate rating progression by working backwards from actual current rating.
        // We know the actual current rating and the win/loss outcomes of recent matches.
        // Reverse-simulate to estimate what rating was before each match.
        const actualRating = player.rating || 500;
        const K = 16;

        // Work backwards from current rating through each DB match
        const reversedRatings: number[] = [actualRating]; // Start with current
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i];
          const won = match.winner_id === player.id;
          // Reverse the Elo change: if won, previous rating was lower; if lost, previous was higher
          const ratingChange = Math.round(K * ((won ? 1 : 0) - 0.5));
          const previousRating = Math.max(100, reversedRatings[reversedRatings.length - 1] - ratingChange);
          reversedRatings.push(previousRating);
        }

        // Reverse to get chronological order (index 0 = before first match, last = after last match)
        reversedRatings.reverse();

        // Build history: skip the first entry (pre-match baseline), use post-match ratings
        const history: { rating: number; matchNumber: number }[] = [];
        for (let i = 1; i < reversedRatings.length; i++) {
          history.push({ rating: reversedRatings[i], matchNumber: i });
        }

        // If we have a known lastRatingChange (from the game over screen), ensure the
        // graph's last segment correctly shows the latest match direction.
        // This handles the race condition where the DB may not have the latest match yet.
        if (lastRatingChange !== null && lastRatingChange !== 0 && history.length >= 2) {
          const expectedPrevRating = actualRating - lastRatingChange;
          const currentLastSegment = history[history.length - 1].rating - history[history.length - 2].rating;

          // If the last segment direction doesn't match (e.g., going up when it should go down),
          // fix the second-to-last point to show the correct pre-match rating
          if ((currentLastSegment > 0) !== (lastRatingChange > 0)) {
            history[history.length - 2].rating = expectedPrevRating;
          }
        }

        setRatingHistory(history);
      } catch (error) {
        console.error('Error fetching rating history:', error);
      }
    };

    fetchRatingHistory();

    // Re-fetch after a delay to pick up any DB changes
    const retryTimeout = setTimeout(fetchRatingHistory, 3000);
    return () => clearTimeout(retryTimeout);
  }, [player.id, player.rating, lastRatingChange]); // Refetch when player rating changes

  // Close tutorial modal and mark as seen
  const closeTutorialModal = () => {
    setShowTutorialModal(false);
    localStorage.setItem('warfog_tutorial_seen', 'true');
  };

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

      // Save to localStorage so anonymous players persist across matches
      localStorage.setItem('warfog_guest_username', editUsername);
      localStorage.setItem('warfog_guest_country', editCountry);

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

  // Ensure guest player has a database record, returns valid player ID
  const ensurePlayerInDB = async (): Promise<string | null> => {
    // If player already has a valid UUID (from database), use it
    if (player.id && player.id.length > 20) return player.id;

    // Guest player needs a database record
    const username = editUsername || localStorage.getItem('warfog_guest_username') || 'Guest';
    const country = editCountry || localStorage.getItem('warfog_guest_country') || 'us';

    const { data, error } = await supabase
      .from('players')
      .insert({
        username,
        country_code: country,
        is_guest: true,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create guest player:', error);
      return null;
    }

    // Save the new player ID
    localStorage.setItem('warfog_player_id', data.id);
    localStorage.setItem('warfog_guest_username', username);
    localStorage.setItem('warfog_guest_country', country);

    if (onPlayerUpdate) {
      onPlayerUpdate({
        id: data.id,
        username,
        countryFlag: country,
        isGuest: true,
      });
    }

    return data.id;
  };

  // ✅ NEW: Join matchmaking queue (free matches)
  const handleJoinQueue = async () => {
    if (!player.id || isInBattle || queueStatus !== 'idle') return;

    setQueueStatus('searching');

    try {
      const playerId = await ensurePlayerInDB();
      if (!playerId) {
        setQueueStatus('idle');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
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
      // Immediately refresh the queue to remove the banner for other players
      fetchQueue();
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
      const playerId = await ensurePlayerInDB();
      if (!playerId) {
        setQueueStatus('idle');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/matchmaking/join-specific`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
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

        {/* Header - Volume/Help Buttons (left) and Wallet Button (right) */}
        <div className="mb-8 flex items-center justify-between">
          {/* Left side buttons - Volume and Help */}
          <div className="flex items-center gap-3">
            {/* Volume Toggle Button */}
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className="w-12 h-12 flex items-center justify-center bg-gray-900/60 border border-yellow-900 hover:border-yellow-500 rounded-full transition-all group"
                title={isMuted ? "Unmute music" : "Mute music"}
              >
                <span className="material-icons-outlined text-yellow-500 group-hover:text-yellow-400 text-2xl">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
              </button>
            )}

            {/* Help/How to Play Button */}
            <button
              onClick={() => setShowTutorialModal(true)}
              className="w-12 h-12 flex items-center justify-center bg-gray-900/60 border border-yellow-900 hover:border-yellow-500 rounded-full transition-all group"
              title="How to play"
            >
              <span className="text-yellow-500 group-hover:text-yellow-300 text-2xl font-bold">
                ?
              </span>
            </button>
          </div>

          <WalletButton className="wallet-custom" />
        </div>

        {/* WARFOG.IO Logo - Centered and Prominent */}
        <div className="text-center mb-10 mt-10">
          <h1 className="text-4xl font-black text-lime-500 tracking-wider animate-pulse">WARFOG.IO</h1>
        </div>

        {/* Player */}
        <div className="mb-3 max-w-md mx-auto px-3 space-y-4">
          {/* Inline Username and Flag */}
          <div className="flex gap-3 items-center justify-center">
            {/* Username Input */}
            <div className="flex-1">
              <label className="block ml-3 text-sm text-gray-300 mb-2">Nickname</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                onBlur={handleSaveProfile}
                maxLength={20}
                autoFocus={player.isGuest && !editUsername}
                className="w-full bg-gray-900 border text-sm border-lime-900 text-white px-4 py-3 h-12 font-mono focus:outline-none focus:border-lime-500 rounded-full placeholder:text-gray-600 placeholder:italic"
                placeholder="Enter your nickname"
              />
            </div>

            {/* Flag Selector */}
            <div className="relative">
              <label className="block ml-3 text-sm text-gray-300 mb-2 ">Country</label>
              <div className="relative">
                <select
                  value={editCountry}
                  onChange={(e) => {
                    setEditCountry(e.target.value);
                    handleSaveProfile();
                  }}
                  className="bg-gray-900 border border-lime-900 text-white px-4 py-3 h-12 font-mono focus:outline-none focus:border-lime-500 appearance-none cursor-pointer pr-16 rounded-full"
                >
                  {COUNTRY_CODES.map((code) => (
                    <option key={code} value={code} className="bg-gray-900">
                      {code.toUpperCase()}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <FlagIcon countryCode={editCountry} width="28px" height="21px" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Chart */}
        <div className="max-w-md mx-auto px-3">
          <RatingChart data={ratingHistory} currentRating={player.rating || 500} lastRatingChange={lastRatingChange} />
        </div>

        {/* Battles activity Feed*/}
        <div className="bg-black/60">
          <div className="border-b border-lime-900 px-4 py-2 mb-4 bg-lime-900/10 flex items-center justify-between">
            <h2 className="text-lime-500 font-bold text-md tracking-widest">BATTLES</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
              <span className="text-red-500 font-bold text-xs font-mono">
                {isLoading ? fPlayers : ((onlineCount || 0) + fPlayers)} Playing
              </span>
            </div>
          </div>

          {/* Start battle button - Queue System */}
          {queueStatus === 'idle' ? (
            <button
              onClick={handleJoinQueue}
              disabled={isInBattle || isSaving}
              className="w-full py-3 bg-lime-900/40 border-2 rounded-full border-lime-400 text-lime-400 font-black text-xl hover:bg-lime-900/60 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_50px_rgba(163,230,53,0.5)] tracking-widest disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40 animate-pulse"
            >
              START BATTLE
            </button>
          ) : queueStatus === 'searching' ? (
            <div className="space-y-3">
              <div className="w-full py-4 bg-yellow-900/40 border-2 rounded-full border-yellow-400 text-yellow-400 font-black text-md text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="material-icons-outlined animate-spin">refresh</span>
                  <span className="animate-pulse">SEARCHING OPPONENTS...</span>
                </div>
              </div>
              <button
                onClick={handleCancelQueue}
                className="w-full py-2 mb-3 bg-red-900/40 border border-red-400 text-red-400 font-bold text-md hover:bg-red-900/60 transition-all rounded-full"
              >
                CANCEL
              </button>
            </div>
          ) : null}

            {/* ✅ NEW: Show queued players with PLAY button */}
            {queuedPlayers.length > 0 && queuedPlayers
              .filter(q => q.player_id !== player.id)  // Don't show self
              .map((entry) => {
                const timeAgo = Math.floor((Date.now() - new Date(entry.created_at).getTime()) / 1000);
                const timeDisplay = timeAgo < 5 ? 'now...' : `${timeAgo}s ago`;

                return (
                  <div
                    key={entry.queue_id}
                    className="flex items-center mt-3 ap-2 py-3 px-3 bg-yellow-900/30 border border-yellow-500/30 hover:bg-yellow-900/30 transition-all text-sm font-bold rounded-full"
                  >
                    {entry.country_code && <FlagIcon countryCode={entry.country_code} width="16px" height="12px" />}
                    <span className="text-white ml-2">{entry.username}</span>
                    <span className="text-yellow-500">⚡{entry.rating}</span>
                    <span className="text-gray-500 text-xs ml-auto">{timeDisplay}</span>
                    <button
                      onClick={() => handleJoinMatch(entry.player_id)}
                      disabled={queueStatus !== 'idle'}
                      className="ml-2 px-3 py-1 bg-lime-500 text-black font-bold rounded-full hover:bg-lime-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
                    >
                      PLAY
                    </button>
                  </div>
                );
              })}

          <div className="p-2 space-y-2 mt-2">
            {/* Recent Activities */}
            {activities.length > 0 && (
              <div className={queuedPlayers.filter(q => q.player_id !== player.id).length > 0 ? "pt-4 border-t border-gray-700/20" : ""}>
                {(() => {
                  // Filter to only show "started battle" activities (player vs player)
                  const battleActivities = activities.filter(activity =>
                    activity.message.includes('started battle')
                  );

                  // Show all battles (no deduplication - each match is unique)
                  return battleActivities.slice(0, 7).map((activity) => {
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

                  // Parse battle message to build content with proper formatting
                  let emoji = '⚔️';
                  let content: JSX.Element | null = null;

                  const vsMatch = activity.message.match(/(.+?) started battle vs (.+)/);
                  if (vsMatch) {
                    const username1 = vsMatch[1];
                    const username2 = vsMatch[2];
                    content = (
                      <>
                        {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                        <span className="text-white text-[13px]"> {username1}</span>
                        <span className="text-yellow-400"> vs </span>
                        {activity.opponentCountryCode && <FlagIcon countryCode={activity.opponentCountryCode} width="16px" height="12px" />}
                        <span className="text-white text-[13px]"> {username2}</span>
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
                })()}
              </div>
            )}

            {/* No players or activity */}
            {queuedPlayers.filter(q => q.player_id !== player.id).length === 0 && activities.filter(a => a.message.includes('started battle')).length === 0 && (
              <div className="text-center py-8 text-gray-600 text-sm">No active battles</div>
            )}
          </div>
        </div>

      </div>

      {/* Tutorial Modal - First Time Only */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-black border-2 rounded-xl border-gray-600 mx-4">

            {/* Close button */}
            <button
              onClick={closeTutorialModal}
              className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-gray-800/40 border-2 border-gray-700 text-gray-200 hover:bg-gray-800/40 transition-all rounded"
            >
              <span className="material-icons-outlined text-xl">close</span>
            </button>

            {/* Header */}
            <div className="px-6 py-4">
              <h2 className="text-2xl font-bold text-yellow-400 text-center gap-2">
                <span className="material-icons-outlined text-2xl mr-2">help_outline</span>
                HOW TO PLAY
              </h2>
            </div>

            {/* Content - Reuse How to Play section */}
            <div className="px-6 py-6 space-y-4">

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
                    Destroy 3 silos to win the match.
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

              {/* Step 5 - Rating System */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-lime-900/40 border border-lime-500 flex items-center justify-center">
                  <span className="text-yellow-500 font-black text-sm">5</span>
                </div>
                <div className="flex-1">
                  <div className="text-lime-500 font-bold text-sm mb-1">RATING SYSTEM</div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Start with 500 rating. Win (+8), lose (-8), win as underdog (+12), lose as underdog (-4).
                  </p>
                </div>
              </div>

              {/* Step 6 - Play Against Bot */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-900/40 border border-blue-500 flex items-center justify-center">
                  <span className="material-icons-outlined text-blue-400 text-sm">smart_toy</span>
                </div>
                <div className="flex-1">
                  <div className="text-blue-400 font-bold text-sm mb-1">PRACTICE</div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-3">
                    Practice the game against a bot.
                  </p>
                  <button
                    onClick={() => {
                      closeTutorialModal();
                      handlePlayBot();
                    }}
                    disabled={isInBattle || queueStatus !== 'idle'}
                    className="w-full py-2 bg-blue-900/40 border border-blue-400 text-blue-400 font-bold text-md hover:bg-blue-900/60 transition-all rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    PLAY BOT
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
