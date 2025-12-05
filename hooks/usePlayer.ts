import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createGuestPlayer, getPlayerById, getPlayerByWallet, updatePlayerWallet } from '../lib/database';
import { Player as DBPlayer } from '../lib/supabase';

export function usePlayer() {
  const { publicKey, connected } = useWallet();
  const [dbPlayer, setDbPlayer] = useState<DBPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);

  const initializePlayer = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // PRIORITY 1: Check if wallet is connected and has existing player
      if (connected && publicKey) {
        const walletAddress = publicKey.toBase58();
        console.log('Looking up wallet:', walletAddress);
        const walletPlayer = await getPlayerByWallet(walletAddress);

        if (walletPlayer) {
          console.log('Found existing player:', walletPlayer.username);
          setDbPlayer(walletPlayer);
          localStorage.setItem('warfog_player_id', walletPlayer.id);
          setIsLoading(false);
          return;
        }

        console.log('No player found for wallet, checking localStorage...');
        // Wallet connected but no player found by wallet
        // Check if there's a player in localStorage that needs wallet linking
        const savedPlayerId = localStorage.getItem('warfog_player_id');
        if (savedPlayerId) {
          const existingPlayer = await getPlayerById(savedPlayerId);
          if (existingPlayer) {
            console.log('Linking wallet to existing player:', existingPlayer.username);
            // Link this wallet to existing player
            const updatedPlayer = await updatePlayerWallet(savedPlayerId, walletAddress);
            if (updatedPlayer) {
              setDbPlayer(updatedPlayer);
              setIsLoading(false);
              return;
            }
          }
        }

        console.log('Creating new player with wallet...');
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
  }, [connected, publicKey]);

  useEffect(() => {
    const newWallet = publicKey?.toBase58() || null;

    // If wallet disconnected, clear everything and stop
    if (!connected || !publicKey) {
      setDbPlayer(null);
      setCurrentWallet(null);
      setIsLoading(false);
      return;
    }

    // If wallet actually SWITCHED (not initial load), clear old data
    if (currentWallet && newWallet && newWallet !== currentWallet) {
      console.log('Wallet switched from', currentWallet, 'to', newWallet);
      setDbPlayer(null);
    }

    // Update current wallet tracking
    setCurrentWallet(newWallet);

    // Load player data
    console.log('Initializing player for wallet:', newWallet);
    initializePlayer();
  }, [publicKey, connected, currentWallet, initializePlayer]);

  return {
    player: dbPlayer,
    isLoading,
    error,
    refreshPlayer: initializePlayer,
  };
}