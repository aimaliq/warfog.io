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
}

export const PlayPage: React.FC<PlayPageProps> = ({ player, onStartBattle, onPlayerUpdate, isInBattle = false }) => {
  const { connected, publicKey } = useWallet();
  const { activities } = useActivityFeed('free');
  const { onlineCount, isLoading } = useOnlinePlayers();
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(player.username);
  const [editCountry, setEditCountry] = useState(player.countryFlag);
  const [isSaving, setIsSaving] = useState(false);

  // players simulation
  const [fPlayers, setFPlayers] = useState<number>(0);

  // Sync local state with player prop changes (for immediate UI updates on wallet connect/disconnect)
  useEffect(() => {
    setEditUsername(player.username);
    setEditCountry(player.countryFlag);
  }, [player.username, player.countryFlag]);

  // Fake player simulation
  useEffect(() => {
    const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    setFPlayers(getRandom(4, 12));

    const interval = setInterval(() => {
      setFPlayers(getRandom(4, 12));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="flex flex-col items-center px-4 py-8 lg:ml-64">
      <div className="w-full max-w-2xl">

        {/* Header - Wallet Button Only */}
        <div className="mb-8 flex items-center justify-end">
          <WalletButton className="wallet-custom" />
        </div>

        {/* WARFOG.IO Logo - Centered and Prominent */}
        <div className="text-center mb-8 mt-12">
          <h1 className="text-5xl font-black text-lime-500 tracking-wider animate-pulse">WARFOG.IO</h1>
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
            </div>
          )}
        </div>

        {/* Player */}
        <div className="mb-10 max-w-md mx-auto mr-3 ml-3 space-y-4">
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
                className="w-full bg-gray-900 border text-sm border-lime-900 text-lime-500 px-4 py-3 h-12 font-mono focus:outline-none focus:border-lime-500 rounded"
                placeholder="Enter nickname"
              />
            </div>
          </div>

          {/* Play Button */}
          <button
            onClick={() => onStartBattle()}
            disabled={isInBattle || isSaving}
            className="w-full py-4 bg-lime-900/40 border-2 rounded border-lime-400 text-lime-400 font-black text-2xl hover:bg-lime-900/60 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_50px_rgba(163,230,53,0.5)] tracking-widest disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-lime-900/40 animate-pulse"
          >
            PLAY
          </button>
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
            {activities.length > 0 ? (
              (() => {
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
                      emoji = '🎮';
                      content = (
                        <>
                          {activity.countryCode && <FlagIcon countryCode={activity.countryCode} width="16px" height="12px" />}
                          <span className="text-white"> {username}</span>
                          <span className="text-blue-400"> joined free lobby</span>
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
              })()
            ) : (
              <div className="text-center py-8 text-gray-600 text-sm">No activity yet</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
