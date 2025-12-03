import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createGuestPlayer, getPlayerById, getPlayerByWallet } from '../lib/database';
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
      }

      // PRIORITY 2: Check if player ID exists in localStorage
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