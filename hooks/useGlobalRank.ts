import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useGlobalRank = (playerId?: string, walletAddress?: string) => {
  const [rank, setRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalRank = async () => {
      // If no player ID or wallet, return null
      if (!playerId && !walletAddress) {
        setRank(null);
        setIsLoading(false);
        return;
      }

      try {
        // Get all registered players ordered by game balance (descending), then created_at (ascending)
        // This matches the leaderboard ranking logic
        const { data: allPlayers, error } = await supabase
          .from('players')
          .select('id, wallet_address, game_balance, created_at, is_guest')
          .eq('is_guest', false) // Only registered wallets
          .not('wallet_address', 'is', null) // Exclude null wallet addresses
          .order('game_balance', { ascending: false }) // Primary sort: SOL balance
          .order('created_at', { ascending: true }); // Secondary sort: registration date

        if (error) throw error;

        if (allPlayers) {
          // Find the index of the current player
          const playerIndex = allPlayers.findIndex(p => {
            if (playerId) {
              return p.id === playerId;
            } else if (walletAddress) {
              return p.wallet_address === walletAddress;
            }
            return false;
          });

          // Rank is index + 1 (1-based ranking)
          if (playerIndex !== -1) {
            setRank(playerIndex + 1);
          } else {
            setRank(null);
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching global rank:', error);
        setRank(null);
        setIsLoading(false);
      }
    };

    fetchGlobalRank();

    // Refresh rank every 60 seconds
    const interval = setInterval(fetchGlobalRank, 60000);

    return () => clearInterval(interval);
  }, [playerId, walletAddress]);

  return { rank, isLoading };
};