import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface MatchHistory {
  id: string;
  opponentWallet: string;
  opponentCountry: string;
  result: 'WON' | 'LOST';
  wagerAmount: number;
  playedAt: Date;
}

export const useMatchHistory = (playerId?: string, walletAddress?: string) => {
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatchHistory = async () => {
      // If no player ID or wallet, return empty array
      if (!playerId && !walletAddress) {
        setMatches([]);
        setIsLoading(false);
        return;
      }

      try {
        // Query completed matches involving this player
        let query = supabase
          .from('matches')
          .select(`
            id,
            player1_id,
            player2_id,
            winner_id,
            wager_amount,
            completed_at,
            status,
            player1:players!matches_player1_id_fkey(wallet_address, country_code),
            player2:players!matches_player2_id_fkey(wallet_address, country_code)
          `)
          .eq('status', 'completed')
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(20);

        // Filter by player ID
        if (playerId) {
          query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching match history:', error);
          setMatches([]);
          setIsLoading(false);
          return;
        }

        if (data) {
          const matchHistory: MatchHistory[] = data.map((match: any) => {
            // Determine if current player is player1 or player2
            const isPlayer1 = match.player1_id === playerId;

            // Get opponent data
            const opponent = isPlayer1 ? match.player2 : match.player1;
            const opponentWallet = opponent?.wallet_address || 'Unknown';
            const opponentCountry = opponent?.country_code || 'us';

            // Format wallet address
            const formattedWallet = opponentWallet.length > 8
              ? `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}`
              : opponentWallet;

            // Determine result
            const isWinner = match.winner_id === playerId;

            return {
              id: match.id,
              opponentWallet: formattedWallet,
              opponentCountry,
              result: isWinner ? 'WON' : 'LOST',
              wagerAmount: match.wager_amount || 0,
              playedAt: new Date(match.completed_at),
            };
          });

          setMatches(matchHistory);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching match history:', error);
        setMatches([]);
        setIsLoading(false);
      }
    };

    fetchMatchHistory();

    // Refresh every 30 seconds
    const interval = setInterval(fetchMatchHistory, 30000);

    return () => clearInterval(interval);
  }, [playerId, walletAddress]);

  return { matches, isLoading };
};
