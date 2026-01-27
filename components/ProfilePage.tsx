import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { FlagIcon } from './FlagIcon';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from './WalletButton';
import { supabase } from '../lib/supabase';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useMatchHistory } from '../hooks/useMatchHistory';
import { useGlobalRank } from '../hooks/useGlobalRank';
import { useTransactionHistory } from '../hooks/useTransactionHistory';

interface ProfilePageProps {
  player: Player;
  onPlayerUpdate?: (updates: Partial<Player>) => void;
  onNavigateToTerms?: () => void;
}

// Common country codes
const COUNTRY_CODES = [
  'us', 'gb', 'ca', 'au', 'de', 'fr', 'it', 'es', 'nl', 'se',
  'no', 'dk', 'fi', 'pl', 'ru', 'jp', 'cn', 'kr', 'in', 'br',
  'mx', 'ar', 'za', 'eg', 'ng', 'ke', 'il', 'tr', 'sa', 'ae'
];

export const ProfilePage: React.FC<ProfilePageProps> = ({ player, onPlayerUpdate, onNavigateToTerms }) => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { matches, isLoading: isLoadingMatches } = useMatchHistory(
    player.id,
    connected && publicKey ? publicKey.toBase58() : undefined
  );
  const { rank: globalRank, isLoading: isLoadingRank } = useGlobalRank(
    player.id,
    connected && publicKey ? publicKey.toBase58() : undefined
  );
  const { transactions, isLoading: isLoadingTransactions } = useTransactionHistory(player.id);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Local state for currently displayed values (restore from localStorage for guests)
  const [currentUsername, setCurrentUsername] = useState(() => {
    if (player.username && player.username !== 'COMMANDER_ALPHA') return player.username;
    return localStorage.getItem('warfog_guest_username') || player.username;
  });
  const [currentCountry, setCurrentCountry] = useState(() => {
    if (player.countryFlag && player.countryFlag !== 'us') return player.countryFlag;
    return localStorage.getItem('warfog_guest_country') || player.countryFlag;
  });
  const [gameBalance, setGameBalance] = useState(0);

  // Edit state (what user is typing)
  const [editUsername, setEditUsername] = useState(() => {
    if (player.username && player.username !== 'COMMANDER_ALPHA') return player.username;
    return localStorage.getItem('warfog_guest_username') || player.username;
  });
  const [editCountry, setEditCountry] = useState(() => {
    if (player.countryFlag && player.countryFlag !== 'us') return player.countryFlag;
    return localStorage.getItem('warfog_guest_country') || player.countryFlag;
  });
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

  // Sync local state with player prop changes (for immediate UI updates on wallet connect/disconnect)
  useEffect(() => {
    const savedUsername = localStorage.getItem('warfog_guest_username');
    const savedCountry = localStorage.getItem('warfog_guest_country');
    const username = (player.username !== 'COMMANDER_ALPHA') ? player.username : (savedUsername || player.username);
    const country = (player.countryFlag !== 'us') ? player.countryFlag : (savedCountry || player.countryFlag);

    setCurrentUsername(username);
    setCurrentCountry(country);

    // Only update edit fields if edit modal is closed (don't overwrite user's typing)
    if (!isEditOpen) {
      setEditUsername(username);
      setEditCountry(country);
    }
  }, [player.username, player.countryFlag, isEditOpen]);

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

      // Save to localStorage for guest persistence
      localStorage.setItem('warfog_guest_username', editUsername);
      localStorage.setItem('warfog_guest_country', editCountry);

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
      const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
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

        // Log transaction to history
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            player_id: player.id,
            type: 'deposit',
            amount: amount,
            signature: signature
          });

        if (txError) {
          console.error('Warning: Failed to log transaction history:', txError);
        }
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
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://warfogio-production.up.railway.app';
      const response = await fetch(`${backendUrl}/api/withdraw`, {
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
    <div className="flex flex-col items-center px-4 py-8 lg:ml-64">
      <div className="w-full max-w-2xl">

        {/* Header - Wallet Button */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="lg:hidden text-3xl font-black text-lime-500">PROFILE</h1>
          <WalletButton className="wallet-custom lg:ml-auto" />
        </div>

        {/* Desktop Title */}
        <h1 className="hidden lg:block text-3xl font-black text-lime-500 mb-8">PROFILE</h1>

        {/* Profile Card */}
        <div className="bg-black/60 p-6">
          <div className="flex items-center gap-6 mb-6">
            <button className="hover:scale-110 transition-transform">
              <FlagIcon countryCode={currentCountry} width="66px" height="42px" />
            </button>
            <div className="flex-1">
              <div className="text-white font-black text-2xl">{currentUsername}</div>
              <div className="text-xl text-lime-500 font-mono">
                {connected && publicKey
                  ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
                  : 'GUEST_MODE'}
              </div>
            </div>
          </div>

          {/* WARFOG Balance - TEMPORARILY HIDDEN FOR FREE MATCHES TESTING */}
          {/* {connected && publicKey && (
            <div className="mb-3 space-y-2">
              <div className="border border-lime-700 rounded px-3 py-2 flex justify-between items-center">
                <span className="text-center font-bold">
                  <span className="text-white text-[21px]">GAME BALANCE:</span><br/><br/>
                  <span className="text-lime-500 text-2xl">{gameBalance.toFixed(2)} SOL</span>
                </span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setIsDepositOpen(!isDepositOpen);
                      if (!isDepositOpen) {
                        setIsWithdrawOpen(false);
                        setIsHistoryOpen(false);
                      }
                    }}
                    className="px-4 py-1 bg-lime-900/40 border rounded border-lime-500 text-lime-400 text-sm font-bold hover:bg-lime-900/60 transition-all"
                  >
                    DEPOSIT
                  </button>
                  <button
                    onClick={() => {
                      setIsWithdrawOpen(!isWithdrawOpen);
                      if (!isWithdrawOpen) {
                        setIsDepositOpen(false);
                        setIsHistoryOpen(false);
                      }
                    }}
                    className="px-4 py-1 bg-amber-900/40 border rounded border-amber-700 text-amber-400 text-sm font-bold hover:bg-amber-900/60 transition-all"
                  >
                    WITHDRAW
                  </button>
                  <button
                    onClick={() => {
                      setIsHistoryOpen(!isHistoryOpen);
                      if (!isHistoryOpen) {
                        setIsDepositOpen(false);
                        setIsWithdrawOpen(false);
                      }
                    }}
                    className="px-4 py-1 bg-gray-900/40 border rounded border-gray-500 text-gray-400 text-sm font-bold hover:bg-gray-900/60 transition-all"
                  >
                    HISTORY
                  </button>
                </div>
              </div>

              {/* Deposit Section */}
              {/* {isDepositOpen && (
                <div className="border rounded border-lime-700 p-3 bg-black/40 animate-fadeIn">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2 tracking-widest">AMOUNT (SOL)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full bg-black/40 border-2 rounded-full border-lime-900 text-lime-500 font-bold px-4 py-2 focus:border-lime-500 focus:outline-none transition-colors"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-600 mt-1">Transfer SOL from your wallet to your game balance</p>
                    </div>

                    {depositError && (
                      <div className="bg-red-900/20 border rounded border-red-700 px-3 py-2">
                        <span className="text-red-500 text-xs font-bold">{depositError}</span>
                      </div>
                    )}
                    {depositSuccess && (
                      <div className="bg-lime-900/20 border rounded border-lime-700 px-3 py-2">
                        <span className="text-lime-500 text-xs font-bold">✓ Deposit successful!</span>
                      </div>
                    )}

                    <button
                      onClick={handleDeposit}
                      disabled={isDepositing}
                      className="w-full py-2 bg-lime-900/40 border-2 rounded border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDepositing ? 'PROCESSING...' : 'CONFIRM DEPOSIT'}
                    </button>
                  </div>
                </div>
              )} */}

              {/* Withdraw Section */}
              {/* {isWithdrawOpen && (
                <div className="border rounded border-amber-700 p-3 bg-black/40 animate-fadeIn">
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
                        className="w-full bg-black/40 border-2 rounded border-amber-900 text-amber-500 font-bold px-4 py-2 focus:border-amber-500 focus:outline-none transition-colors"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-600 mt-1">Withdraw SOL from your game balance to your wallet</p>
                      <p className="text-xs text-amber-600 mt-1">Available: {gameBalance.toFixed(2)} SOL</p>
                    </div>

                    {withdrawError && (
                      <div className="bg-red-900/20 rounded border border-red-700 px-3 py-2">
                        <span className="text-red-500 text-xs font-bold">{withdrawError}</span>
                      </div>
                    )}
                    {withdrawSuccess && (
                      <div className="bg-lime-900/20 border rounded border-lime-700 px-3 py-2">
                        <span className="text-lime-500 text-xs font-bold">✓ Withdrawal successful!</span>
                      </div>
                    )}

                    <button
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || gameBalance === 0}
                      className="w-full py-2 bg-amber-900/40 border-2 rounded border-amber-400 text-amber-400 font-bold hover:bg-amber-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isWithdrawing ? 'PROCESSING...' : 'CONFIRM WITHDRAWAL'}
                    </button>
                  </div>
                </div>
              )} */}

              {/* Transaction History Section */}
              {/* {isHistoryOpen && (
                <div className="border border-gray-500 rounded p-3 bg-black/40 animate-fadeIn">
                  <div className="max-h-[300px] overflow-y-auto">
                    {isLoadingTransactions ? (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        Loading transaction history...
                      </div>
                    ) : transactions.length > 0 ? (
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-700/30">
                          {transactions.map((tx) => {
                            const getTimeAgo = (date: Date) => {
                              const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
                              if (seconds < 60) return `${seconds}s`;
                              const minutes = Math.floor(seconds / 60);
                              if (minutes < 60) return `${minutes}m`;
                              const hours = Math.floor(minutes / 60);
                              if (hours < 24) return `${hours}h`;
                              const days = Math.floor(hours / 24);
                              return `${days}d`;
                            };

                            const isDeposit = tx.operation === 'deposit';
                            const amountDisplay = isDeposit ? `+${tx.amount.toFixed(2)}` : `-${tx.amount.toFixed(2)}`;
                            const shortenedSignature = tx.signature.length > 8
                              ? `${tx.signature.slice(0, 4)}...${tx.signature.slice(-4)}`
                              : tx.signature;

                            // Determine network cluster for Solscan link
                            const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
                            const isMainnet = rpcUrl.includes('mainnet');
                            const clusterParam = isMainnet ? '' : '?cluster=devnet';

                            return (
                              <tr key={tx.id} className="hover:bg-gray-900/10 transition-all">
                                <td className="pl-3 pr-2 py-2">
                                  <span className={`font-mono text-sm ${isDeposit ? 'text-lime-500' : 'text-red-500'}`}>
                                    {amountDisplay}
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <span className="text-gray-400 text-sm uppercase">{tx.operation}</span>
                                </td>
                                <td className="px-2 py-2">
                                  <a
                                    href={`https://solscan.io/tx/${tx.signature}${clusterParam}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 font-mono text-sm underline"
                                  >
                                    {shortenedSignature}
                                  </a>
                                </td>
                                <td className="pr-3 pl-2 py-2 text-right">
                                  <span className="text-gray-600 text-xs">{getTimeAgo(tx.createdAt)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-8 text-gray-600 text-sm">
                        No transaction history yet
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )} */}

          <button
            onClick={() => setIsEditOpen(!isEditOpen)}
            className="w-full border-2 rounded-full border-lime-900 text-lime-500 font-bold hover:bg-lime-900/20 transition-all flex items-center justify-center gap-2 py-2"
          >
            <span className="material-icons-outlined text-sm">
              {isEditOpen ? 'expand_less' : 'edit'}
            </span>
            EDIT INFO
          </button>

          {/* Edit Profile Dropdown */}
          {isEditOpen && (
            <div className="mt-4 border-t-2 rounded border-lime-900 pt-4 space-y-4 animate-fadeIn">
              {/* Username Field */}
              <div>
                <label className="block text-xs text-gray-400 mb-2 tracking-widest">Nickname</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  maxLength={20}
                  className="w-full bg-black/40 border-2 rounded-full border-gray-700 text-white font-bold px-4 py-2 focus:border-gray-700 focus:outline-none transition-colors"
                  placeholder="Enter username"
                />
              </div>

              {/* Country Selector */}
              <div>
                <label className="block text-xs text-gray-400 mb-2 tracking-widest">Country</label>
                <div className="relative">
                  <select
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full bg-black/40 border-2 rounded-full border-gray-700 text-white font-bold px-4 py-2 focus:border-gray-700 focus:outline-none transition-colors appearance-none cursor-pointer"
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code} className="bg-black text-white">
                        {code.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <FlagIcon countryCode={editCountry} width="28px" height="21px" />
                  </div>
                </div>
              </div>

              {/* Status Messages */}
              {saveError && (
                <div className="bg-red-900/20 border rounded border-red-700 px-3 py-2">
                  <span className="text-red-500 text-xs font-bold">{saveError}</span>
                </div>
              )}
              {saveSuccess && (
                <div className="px-3 py-2">
                  <span className="text-lime-500 text-xs font-bold">✓ Changes saved!</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 py-2 bg-lime-900/40 border-2 rounded-full border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="flex-1 py-2 border-2 rounded-full border-gray-700 text-gray-500 font-bold hover:bg-gray-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 mb-3 mr-2 ml-2">
          {/* Row 1: Battles, Rank, Rating */}
          <div className="bg-black/60 p-4">
            <div className="text-[11px] text-gray-400 mb-1 tracking-widest">BATTLES</div>
            <div className="text-2xl text-gray-300 font-black font-mono">{player.gamesPlayed}</div>
          </div>

          <div className="bg-black/60 p-4">
            <div className="text-[11px] text-gray-400 mb-2 tracking-widest">RANK</div>
            <div className="flex justify-between items-center">
              <div className="text-2xl text-yellow-500 font-black font-mono">
                {player.isGuest ? '—' : isLoadingRank ? '#' : globalRank ? `#${globalRank}` : '—'}
              </div>
            </div>
            {player.isGuest && (
              <span className="text-xs text-yellow-600 mt-2 block">Connect wallet</span>
            )}
            {!player.isGuest && !globalRank && !isLoadingRank && (
              <span className="text-xs text-gray-600 mt-2 block">Play to get ranked</span>
            )}
          </div>

          <div className="bg-black/60 p-4">
            <div className="text-[11px] text-gray-400 mb-1 tracking-widest">RATING</div>
            <div className="text-2xl text-yellow-500 font-black font-mono">{player.rating || 500}</div>
          </div>

          {/* Row 2: Victories, SOL Won, Win Rate */}
          <div className="bg-black/60 p-4">
            <div className="text-[11px] text-gray-400 mb-1 tracking-widest">VICTORIES</div>
            <div className="text-2xl text-gray-300 font-black font-mono">{player.wins}</div>
          </div>

          <div className="bg-black/60 p-4">
            <div className="text-[11px] text-gray-400 mb-1 tracking-widest">SOL WON</div>
            <div className="text-2xl text-gray-300 font-black font-mono">{(player.totalSolWon || 0).toFixed(2)}</div>
          </div>

          <div className="bg-black/60 p-4">
            <div className="text-[11px] text-gray-400 mb-1 tracking-widest">WIN RATE</div>
            <div className="text-2xl text-gray-300 font-black font-mono">{winRate}%</div>
          </div>
        </div>

        {/* Match History */}
        <div className="bg-black/60">
          <div className="border-b border-lime-900 px-4 py-2 bg-lime-900/10">
            <h2 className="text-lime-500 font-bold text-md tracking-widest">RECENT BATTLES</h2>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {isLoadingMatches ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Loading match history...
              </div>
            ) : matches.length > 0 ? (
              <table className="w-full">
                <tbody className="divide-y divide-lime-900/30">
                  {matches.map((match) => {
                    const getTimeAgo = (date: Date) => {
                      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
                      if (seconds < 60) return `${seconds}s`;
                      const minutes = Math.floor(seconds / 60);
                      if (minutes < 60) return `${minutes}m`;
                      const hours = Math.floor(minutes / 60);
                      if (hours < 24) return `${hours}h`;
                      const days = Math.floor(hours / 24);
                      return `${days}d`;
                    };

                    const isWin = match.result === 'WON';
                    const amountDisplay = match.wagerAmount > 0
                      ? (isWin ? `+${(match.wagerAmount * 1.9).toFixed(2)}` : `-${match.wagerAmount.toFixed(2)}`)
                      : 'FREE';

                    return (
                      <tr key={match.id} className="hover:bg-lime-900/10 transition-all">
                        <td className="pl-4 pr-2 py-2">
                          <span className={`font-bold text-sm ${isWin ? 'text-lime-500' : 'text-red-500'}`}>
                            {match.result}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`font-mono text-sm ${match.wagerAmount === 0 ? 'text-gray-500' : isWin ? 'text-lime-500' : 'text-red-500'}`}>
                            {amountDisplay}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="text-yellow-500 font-mono text-sm">{match.opponentWallet}</span>
                        </td>
                        <td className="px-2 py-2">
                          <FlagIcon countryCode={match.opponentCountry} width="20px" height="14px" />
                        </td>
                        <td className="pr-4 pl-2 py-2 text-right">
                          <span className="text-gray-600 text-xs">{getTimeAgo(match.playedAt)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-gray-600 text-sm">
                No match history yet
              </div>
            )}
          </div>
        </div>

        {/* Terms of Service Link */}
        <div className="mt-6 text-center">
          <button
            onClick={onNavigateToTerms}
            className="text-gray-400 hover:text-gray-500 transition-colors text-xs"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </div>
  );
};
