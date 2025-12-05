import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createGuestPlayer, getPlayerById, getPlayerByWallet, updatePlayerWallet } from '../lib/database';
import { Player as DBPlayer } from '../lib/supabase';

export function usePlayer() {
  const { publicKey, connected } = useWallet();
  const [dbPlayer, setDbPlayer] = useState<DBPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializePlayer();
  }, [publicKey, connected]);

  async function initializePlayer() {
    try {
      setIsLoading(true);
      setError(null);

      // Clear previous player state when wallet changes
      setDbPlayer(null);

      // PRIORITY 1: Check if wallet is connected and has existing player
      if (connected && publicKey) {
        const walletAddress = publicKey.toBase58();
        const walletPlayer = await getPlayerByWallet(walletAddress);

        if (walletPlayer) {
          setDbPlayer(walletPlayer);
          localStorage.setItem('warfog_player_id', walletPlayer.id);
          setIsLoading(false);
          return;
        }

        // Wallet connected but no player found by wallet
        // Check if there's a player in localStorage that needs wallet linking
        const savedPlayerId = localStorage.getItem('warfog_player_id');
        if (savedPlayerId) {
          const existingPlayer = await getPlayerById(savedPlayerId);
          if (existingPlayer) {
            // Link this wallet to existing player
            const updatedPlayer = await updatePlayerWallet(savedPlayerId, walletAddress);
            if (updatedPlayer) {
              setDbPlayer(updatedPlayer);
              setIsLoading(false);
              return;
            }
          }
        }

        // No existing player - create new one with wallet
        const newPlayer = await createGuestPlayer();
        if (newPlayer) {
          // Immediately link wallet to new player
          const updatedPlayer = await updatePlayerWallet(newPlayer.id, walletAddress);
          if (updatedPlayer) {
            setDbPlayer(updatedPlayer);
            localStorage.setItem('warfog_player_id', updatedPlayer.id);
          } else {
            setDbPlayer(newPlayer);
            localStorage.setItem('warfog_player_id', newPlayer.id);
          }
          setIsLoading(false);
          return;
        }
      }

      // PRIORITY 2: No wallet connected - check localStorage
      const savedPlayerId = localStorage.getItem('warfog_player_id');

      if (savedPlayerId) {
        // Try to load existing player
        const existingPlayer = await getPlayerById(savedPlayerId);

        if (existingPlayer) {
          setDbPlayer(existingPlayer);
          setIsLoading(false);
          return;
        }
      }

      // PRIORITY 3: Create new guest player
      const newPlayer = await createGuestPlayer();

      if (newPlayer) {
        setDbPlayer(newPlayer);
        localStorage.setItem('warfog_player_id', newPlayer.id);
      } else {
        setError('Failed to create player');
      }
    } catch (err) {
      console.error('Error initializing player:', err);
      setError('Failed to initialize player');
    } finally {
      setIsLoading(false);
    }
  }

  return {
    player: dbPlayer,
    isLoading,
    error,
    refreshPlayer: initializePlayer,
  };
}