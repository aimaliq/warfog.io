import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface MatchHistory {
  id: string;
  opponent: string;
  opponentUsername: string;
  result: 'VICTORY' | 'DEFEAT';
  damageDealt: number;
  damageTaken: number;
  playedAt: Date;
  betAmount?: number;
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
        // Query matches table for games involving this player
        // Note: This assumes a 'matches' table exists with structure:
        // - player1_id, player2_id (or player1_wallet, player2_wallet)
        // - winner_id (or winner_wallet)
        // - player1_damage_dealt, player2_damage_dealt
        // - played_at, bet_amount

        let query = supabase
          .from('matches')
          .select(`
            id,
            player1_id,
            player2_id,
            player1_wallet,
            player2_wallet,
            winner_id,
            winner_wallet,
            player1_damage_dealt,
            player2_damage_dealt,
            played_at,
            bet_amount,
            player1:players!matches_player1_id_fkey(username),
            player2:players!matches_player2_id_fkey(username)
          `)
          .order('played_at', { ascending: false })
          .limit(10);

        // Filter by player ID or wallet address
        if (playerId) {
          query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
        } else if (walletAddress) {
          query = query.or(`player1_wallet.eq.${walletAddress},player2_wallet.eq.${walletAddress}`);
        }

        const { data, error } = await query;

        if (error) {
          // If table doesn't exist or has different structure, fail gracefully
          console.error('Error fetching match history:', error);
          setMatches([]);
          setIsLoading(false);
          return;
        }

        if (data) {
          const matchHistory: MatchHistory[] = data.map((match: any) => {
            // Determine if current player is player1 or player2
            const isPlayer1 = playerId
              ? match.player1_id === playerId
              : match.player1_wallet === walletAddress;

            // Determine opponent
            const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
            const opponentWallet = isPlayer1 ? match.player2_wallet : match.player1_wallet;
            const opponentUsername = isPlayer1
              ? (match.player2?.username || 'Anonymous')
              : (match.player1?.username || 'Anonymous');

            // Determine result
            const isWinner = playerId
              ? match.winner_id === playerId
              : match.winner_wallet === walletAddress;

            // Get damage stats
            const damageDealt = isPlayer1 ? match.player1_damage_dealt : match.player2_damage_dealt;
            const damageTaken = isPlayer1 ? match.player2_damage_dealt : match.player1_damage_dealt;

            return {
              id: match.id,
              opponent: opponentWallet
                ? `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}`
                : opponentId || 'Unknown',
              opponentUsername,
              result: isWinner ? 'VICTORY' : 'DEFEAT',
              damageDealt: damageDealt || 0,
              damageTaken: damageTaken || 0,
              playedAt: new Date(match.played_at),
              betAmount: match.bet_amount,
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
  }, [playerId, walletAddress]);

  return { matches, isLoading };
};