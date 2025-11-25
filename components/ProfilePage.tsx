import React, { useState } from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';

interface ProfilePageProps {
  player: Player;
}

// Mock match history
const MOCK_HISTORY = [
  { opponent: 'SHADOW_OPS', result: 'VICTORY', damage: '3/5', date: '2 hours ago' },
  { opponent: 'EAGLE_STRIKE', result: 'DEFEAT', damage: '2/5', date: '3 hours ago' },
  { opponent: 'RED_PHOENIX', result: 'VICTORY', damage: '3/5', date: '5 hours ago' },
];

// Common country codes
const COUNTRY_CODES = [
  'us', 'gb', 'ca', 'au', 'de', 'fr', 'it', 'es', 'nl', 'se',
  'no', 'dk', 'fi', 'pl', 'ru', 'jp', 'cn', 'kr', 'in', 'br',
  'mx', 'ar', 'za', 'eg', 'ng', 'ke', 'il', 'tr', 'sa', 'ae'
];

export const ProfilePage: React.FC<ProfilePageProps> = ({ player }) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(player.username);
  const [editCountry, setEditCountry] = useState(player.countryFlag);

  const winRate = player.gamesPlayed > 0
    ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
    : 0;

  const handleSaveProfile = () => {
    // TODO: Save profile changes
    console.log('Saving profile:', { username: editUsername, country: editCountry });
    setIsEditOpen(false);
  };

  const handleCancelEdit = () => {
    setEditUsername(player.username);
    setEditCountry(player.countryFlag);
    setIsEditOpen(false);
  };

  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <h1 className="text-3xl font-black text-lime-500 mb-8">COMMANDER PROFILE</h1>

        {/* Profile Card */}
        <div className="bg-black/60 border-2 border-lime-900 p-6 mb-6">
          <div className="flex items-center gap-6 mb-6">
            <button className="hover:scale-110 transition-transform">
              <FlagIcon countryCode={player.countryFlag} width="96px" height="72px" />
            </button>
            <div className="flex-1">
              <div className="text-lime-500 font-black text-xl mb-2">{player.username}</div>
              <div className="text-xs text-gray-600 font-mono mb-3">
                {player.isGuest ? 'GUEST_MODE' : '0x7F9A...B2E1'}
              </div>
              {!player.isGuest && (
                <div className="bg-lime-900/20 border border-lime-700 px-3 py-1 inline-block">
                  <span className="text-lime-500 text-xs font-bold">WARFOG BALANCE: 0.00 SOL</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {player.isGuest ? (
              <button className="w-full py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all">
                CONNECT WALLET
              </button>
            ) : (
              <button className="w-full py-3 border-2 border-red-900 text-red-500 font-bold hover:bg-red-900/20 transition-all flex items-center justify-center gap-2">
                <span className="material-icons-outlined text-lg">logout</span>
                DISCONNECT WALLET
              </button>
            )}
            <button
              onClick={() => setIsEditOpen(!isEditOpen)}
              className="w-full py-3 border-2 border-lime-900 text-lime-500 font-bold hover:bg-lime-900/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-icons-outlined text-lg">
                {isEditOpen ? 'expand_less' : 'edit'}
              </span>
              EDIT PROFILE
            </button>
          </div>

          {/* Edit Profile Dropdown */}
          {isEditOpen && (
            <div className="mt-4 border-t-2 border-lime-900 pt-4 space-y-4 animate-fadeIn">
              {/* Username Field */}
              <div>
                <label className="block text-xs text-gray-600 mb-2 tracking-widest">USERNAME</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  maxLength={20}
                  className="w-full bg-black/40 border-2 border-lime-900 text-lime-500 font-bold px-4 py-2 focus:border-lime-500 focus:outline-none transition-colors"
                  placeholder="Enter username"
                />
              </div>

              {/* Country Selector */}
              <div>
                <label className="block text-xs text-gray-600 mb-2 tracking-widest">COUNTRY</label>
                <div className="relative">
                  <select
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full bg-black/40 border-2 border-lime-900 text-lime-500 font-bold px-4 py-2 focus:border-lime-500 focus:outline-none transition-colors appearance-none cursor-pointer"
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code} className="bg-black text-lime-500">
                        {code.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <FlagIcon countryCode={editCountry} width="32px" height="24px" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  className="flex-1 py-2 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all"
                >
                  SAVE CHANGES
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 py-2 border-2 border-gray-700 text-gray-500 font-bold hover:bg-gray-900/20 transition-all"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black/60 border-2 border-lime-900 p-4">
            <div className="text-[11px] text-gray-600 mb-1 tracking-widest">TOTAL GAMES</div>
            <div className="text-3xl text-lime-500 font-black font-mono">{player.gamesPlayed}</div>
          </div>

          <div className="bg-black/60 border-2 border-lime-900 p-4">
            <div className="text-[11px] text-gray-600 mb-1 tracking-widest">WIN RATE</div>
            <div className="text-3xl text-lime-500 font-black font-mono">{winRate}%</div>
          </div>

          <div className="bg-black/60 border-2 border-lime-900 p-4">
            <div className="text-[11px] text-gray-600 mb-1 tracking-widest">VICTORIES</div>
            <div className="text-3xl text-lime-500 font-black font-mono">{player.wins}</div>
          </div>

          <div className="bg-black/60 border-2 border-lime-900 p-4">
            <div className="text-[11px] text-gray-600 mb-1 tracking-widest">DEFEATS</div>
            <div className="text-3xl text-red-500 font-black font-mono">{player.losses}</div>
          </div>
        </div>

        {/* Current Rank & Longest Streak */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black/60 border-2 border-lime-900 p-4">
            <div className="text-[11px] text-gray-600 mb-2 tracking-widest">GLOBAL RANK</div>
            <div className="flex justify-between items-center">
              <div className="text-4xl text-lime-500 font-black font-mono">
                {player.isGuest ? '—' : '#127'}
              </div>
            </div>
            {player.isGuest && (
              <span className="text-xs text-yellow-600 mt-2 block">Connect wallet</span>
            )}
          </div>

          <div className="bg-black/60 border-2 border-lime-900 p-4">
            <div className="text-[11px] text-gray-600 mb-2 tracking-widest flex items-center gap-1">
              <span className="material-icons-outlined text-xs text-gray-600">local_fire_department</span>
              LONGEST STREAK
            </div>
            <div className="text-4xl text-lime-500 font-black font-mono">
              {player.longestStreak}
            </div>
          </div>
        </div>

        {/* Match History */}
        <div className="bg-black/60 border-2 border-lime-900">
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10">
            <h2 className="text-lime-500 font-bold text-sm tracking-widest">RECENT OPERATIONS</h2>
          </div>
          <div className="divide-y divide-lime-900/30">
            {MOCK_HISTORY.length > 0 ? (
              MOCK_HISTORY.map((match, i) => (
                <div key={i} className="px-4 py-3 hover:bg-lime-900/10 transition-all">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-lime-500 font-bold text-sm">vs {match.opponent}</div>
                      <div className="text-[10px] text-gray-600">{match.date}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm ${match.result === 'VICTORY' ? 'text-lime-500' : 'text-red-500'}`}>
                        {match.result}
                      </div>
                      <div className="text-[10px] text-gray-600">Damage: {match.damage}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-600 text-sm">
                No match history yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
