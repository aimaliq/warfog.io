import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { supabase } from '../lib/supabase';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useMatchHistory } from '../hooks/useMatchHistory';
import { useGlobalRank } from '../hooks/useGlobalRank';

interface ProfilePageProps {
  player: Player;
  onPlayerUpdate?: (updates: Partial<Player>) => void;
}

// Common country codes
const COUNTRY_CODES = [
  'us', 'gb', 'ca', 'au', 'de', 'fr', 'it', 'es', 'nl', 'se',
  'no', 'dk', 'fi', 'pl', 'ru', 'jp', 'cn', 'kr', 'in', 'br',
  'mx', 'ar', 'za', 'eg', 'ng', 'ke', 'il', 'tr', 'sa', 'ae'
];

export const ProfilePage: React.FC<ProfilePageProps> = ({ player, onPlayerUpdate }) => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { matches, isLoading: isLoadingMatches } = useMatchHistory(
    player.id,
    connected && publicKey ? publicKey.toBase58() : undefined
  );
  const { rank: globalRank, isLoading: isLoadingRank } = useGlobalRank(
    player.id,
    connected && publicKey ? publicKey.toBase58() : undefined
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  // Local state for currently displayed values
  const [currentUsername, setCurrentUsername] = useState(player.username);
  const [currentCountry, setCurrentCountry] = useState(player.countryFlag);
  const [gameBalance, setGameBalance] = useState(0);

  // Edit state (what user is typing)
  const [editUsername, setEditUsername] = useState(player.username);
  const [editCountry, setEditCountry] = useState(player.countryFlag);
  const [depositAmount, setDepositAmount] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState(false);

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Fetch game balance on mount and when player changes
  useEffect(() => {
    const fetchGameBalance = async () => {
      if (!player.id || player.id.length < 20) {
        setGameBalance(0);
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
      } catch (error) {
        console.error('Error fetching game balance:', error);
        setGameBalance(0);
      }
    };

    fetchGameBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchGameBalance, 10000);

    return () => clearInterval(interval);
  }, [player.id]);

  const winRate = player.gamesPlayed > 0
    ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
    : 0;

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      setSaveError('Username cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Get wallet address if connected
      const walletAddress = connected && publicKey ? publicKey.toBase58() : null;

      // Check if player exists in database
      let playerId = player.id;

      // If player has a valid UUID (from database), update it
      if (playerId && playerId.length > 20) {
        const { error: updateError } = await supabase
          .from('players')
          .update({
            username: editUsername,
            country_code: editCountry,
            wallet_address: walletAddress,
            is_guest: !connected,
          })
          .eq('id', playerId);

        if (updateError) throw updateError;
      } else {
        // Create new player in database
        const { data, error: insertError } = await supabase
          .from('players')
          .insert({
            username: editUsername,
            country_code: editCountry,
            wallet_address: walletAddress,
            is_guest: !connected,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (data) playerId = data.id;
      }

      // Update local displayed state immediately
      setCurrentUsername(editUsername);
      setCurrentCountry(editCountry);

      // Update parent component state
      if (onPlayerUpdate) {
        onPlayerUpdate({
          id: playerId,
          username: editUsername,
          countryFlag: editCountry,
          isGuest: !connected,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditOpen(false);
        setSaveSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveError('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset edit fields to current displayed values
    setEditUsername(currentUsername);
    setEditCountry(currentCountry);
    setSaveError(null);
    setIsEditOpen(false);
  };

  const handleDeposit = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      setDepositError('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositError('Please enter a valid amount');
      return;
    }

    setIsDepositing(true);
    setDepositError(null);
    setDepositSuccess(false);

    try {
      // Create connection to Solana (reads from environment: mainnet or devnet)
      const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      // Game treasury wallet address from environment variable
      const treasuryAddress = import.meta.env.VITE_TREASURY_WALLET || '8aumkrXX3sS47zfnWZtFKAKrQnLCjnHXt9cduRcScshd';
      const TREASURY_WALLET = new PublicKey(treasuryAddress);

      // Create transfer instruction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY_WALLET,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Update balance in database
      if (player.id && player.id.length > 20) {
        const { error } = await supabase
          .from('players')
          .update({
            game_balance: (gameBalance + amount),
          })
          .eq('id', player.id);

        if (error) throw error;
      }

      // Update local balance
      setGameBalance(prev => prev + amount);
      setDepositAmount('');
      setDepositSuccess(true);

      setTimeout(() => {
        setIsDepositOpen(false);
        setDepositSuccess(false);
      }, 2000);

    } catch (error: any) {
      console.error('Deposit error:', error);
      setDepositError(error.message || 'Failed to deposit. Please try again.');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !publicKey) {
      setWithdrawError('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Please enter a valid amount');
      return;
    }

    if (amount > gameBalance) {
      setWithdrawError(`Insufficient balance. You have ${gameBalance.toFixed(2)} SOL`);
      return;
    }

    setIsWithdrawing(true);
    setWithdrawError(null);
    setWithdrawSuccess(false);

    try {
      // Call backend API to process withdrawal
      // The backend holds the treasury wallet private key and will send SOL to the user
      const response = await fetch('http://localhost:3003/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerWallet: publicKey.toBase58(),
          amount: amount,
          playerId: player.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process withdrawal');
      }

      console.log('✅ Withdrawal successful!', data);
      console.log('🔗 View on Solana Explorer:', data.explorerUrl);

      // Update local balance
      setGameBalance(prev => Math.max(0, prev - amount));
      setWithdrawAmount('');
      setWithdrawSuccess(true);

      // Show success message with transaction link
      setTimeout(() => {
        setIsWithdrawOpen(false);
        setWithdrawSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Withdraw error:', error);
      setWithdrawError(error.message || 'Failed to withdraw. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
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
              <FlagIcon countryCode={currentCountry} width="96px" height="72px" />
            </button>
            <div className="flex-1">
              <div className="text-lime-500 font-black text-2xl">
                {connected && publicKey
                  ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
                  : 'GUEST_MODE'}
              </div>
              <div className="text-LG text-gray-600 font-mono">{currentUsername}</div>
            </div>
          </div>

          {/* WARFOG Balance - Full Width */}
          {connected && publicKey && (
            <div className="mb-3 space-y-2">
              <div className="border border-lime-700 px-3 py-2 flex justify-between items-center">
                <span className="text-lime-500 text-lg font-bold">GAME BALANCE:<br/>{gameBalance.toFixed(2)} SOL</span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setIsDepositOpen(!isDepositOpen);
                      if (!isDepositOpen) setIsWithdrawOpen(false);
                    }}
                    className="px-4 py-1 bg-lime-900/40 border border-lime-500 text-lime-400 text-sm font-bold hover:bg-lime-900/60 transition-all"
                  >
                    DEPOSIT
                  </button>
                  <button
                    onClick={() => {
                      setIsWithdrawOpen(!isWithdrawOpen);
                      if (!isWithdrawOpen) setIsDepositOpen(false);
                    }}
                    className="px-4 py-1 bg-amber-900/40 border border-amber-700 text-amber-400 text-sm font-bold hover:bg-amber-900/60 transition-all"
                  >
                    WITHDRAW
                  </button>
                </div>
              </div>

              {/* Deposit Section */}
              {isDepositOpen && (
                <div className="border border-lime-700 p-3 bg-black/40 animate-fadeIn">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2 tracking-widest">AMOUNT (SOL)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full bg-black/40 border-2 border-lime-900 text-lime-500 font-bold px-4 py-2 focus:border-lime-500 focus:outline-none transition-colors"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-600 mt-1">Transfer SOL from your wallet to your game balance</p>
                    </div>

                    {depositError && (
                      <div className="bg-red-900/20 border border-red-700 px-3 py-2">
                        <span className="text-red-500 text-xs font-bold">{depositError}</span>
                      </div>
                    )}
                    {depositSuccess && (
                      <div className="bg-lime-900/20 border border-lime-700 px-3 py-2">
                        <span className="text-lime-500 text-xs font-bold">✓ Deposit successful!</span>
                      </div>
                    )}

                    <button
                      onClick={handleDeposit}
                      disabled={isDepositing}
                      className="w-full py-2 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDepositing ? 'PROCESSING...' : 'CONFIRM DEPOSIT'}
                    </button>
                  </div>
                </div>
              )}

              {/* Withdraw Section */}
              {isWithdrawOpen && (
                <div className="border border-amber-700 p-3 bg-black/40 animate-fadeIn">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2 tracking-widest">AMOUNT (SOL)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max={gameBalance}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-black/40 border-2 border-amber-900 text-amber-500 font-bold px-4 py-2 focus:border-amber-500 focus:outline-none transition-colors"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-600 mt-1">Withdraw SOL from your game balance to your wallet</p>
                      <p className="text-xs text-amber-600 mt-1">Available: {gameBalance.toFixed(2)} SOL</p>
                    </div>

                    {withdrawError && (
                      <div className="bg-red-900/20 border border-red-700 px-3 py-2">
                        <span className="text-red-500 text-xs font-bold">{withdrawError}</span>
                      </div>
                    )}
                    {withdrawSuccess && (
                      <div className="bg-lime-900/20 border border-lime-700 px-3 py-2">
                        <span className="text-lime-500 text-xs font-bold">✓ Withdrawal successful!</span>
                      </div>
                    )}

                    <button
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || gameBalance === 0}
                      className="w-full py-2 bg-amber-900/40 border-2 border-amber-400 text-amber-400 font-bold hover:bg-amber-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isWithdrawing ? 'PROCESSING...' : 'CONFIRM WITHDRAWAL'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <WalletMultiButton />
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

              {/* Status Messages */}
              {saveError && (
                <div className="bg-red-900/20 border border-red-700 px-3 py-2">
                  <span className="text-red-500 text-xs font-bold">{saveError}</span>
                </div>
              )}
              {saveSuccess && (
                <div className="bg-lime-900/20 border border-lime-700 px-3 py-2">
                  <span className="text-lime-500 text-xs font-bold">✓ Changes saved successfully!</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 py-2 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex-1 py-2 border-2 border-gray-700 text-gray-500 font-bold hover:bg-gray-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                {player.isGuest ? '—' : isLoadingRank ? '...' : globalRank ? `#${globalRank}` : '—'}
              </div>
            </div>
            {player.isGuest && (
              <span className="text-xs text-yellow-600 mt-2 block">Connect wallet</span>
            )}
            {!player.isGuest && !globalRank && !isLoadingRank && (
              <span className="text-xs text-gray-600 mt-2 block">Play to get ranked</span>
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
            {isLoadingMatches ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Loading match history...
              </div>
            ) : matches.length > 0 ? (
              matches.map((match) => {
                const getTimeAgo = (date: Date) => {
                  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
                  if (seconds < 60) return `${seconds}s ago`;
                  const minutes = Math.floor(seconds / 60);
                  if (minutes < 60) return `${minutes}m ago`;
                  const hours = Math.floor(minutes / 60);
                  if (hours < 24) return `${hours}h ago`;
                  const days = Math.floor(hours / 24);
                  return `${days}d ago`;
                };

                return (
                  <div key={match.id} className="px-4 py-3 hover:bg-lime-900/10 transition-all">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-lime-500 font-bold text-sm">vs {match.opponentUsername}</div>
                        <div className="text-[10px] text-gray-600">{match.opponent}</div>
                        <div className="text-[10px] text-gray-600">{getTimeAgo(match.playedAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-sm ${match.result === 'VICTORY' ? 'text-lime-500' : 'text-red-500'}`}>
                          {match.result}
                        </div>
                        <div className="text-[10px] text-gray-600">Damage: {match.damageDealt}/{match.damageTaken}</div>
                        {match.betAmount && (
                          <div className="text-[10px] text-yellow-600">{match.betAmount} SOL</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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
