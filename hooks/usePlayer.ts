import { useState, useEffect } from 'react';
import { createGuestPlayer, getPlayerById } from '../lib/database';
import { Player as DBPlayer } from '../lib/supabase';

export function usePlayer() {
  const [dbPlayer, setDbPlayer] = useState<DBPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializePlayer();
  }, []);

  async function initializePlayer() {
    try {
      setIsLoading(true);

      // Check if player ID exists in localStorage
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

      // Create new guest player
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