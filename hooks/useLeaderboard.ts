import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface LeaderboardPlayer {
  rank: number;
  username: string;
  countryFlag: string;
  wins: number;
  losses: number;
  winRate: number;
  wallet: string;
  gameBalance: number;
  totalSolWon: number;
  rating: number;
  registeredAt: string;
}

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('username, country_code, total_wins, total_losses, wallet_address, game_balance, total_sol_won, rating, created_at, is_guest')
          .eq('is_guest', false) // Only registered wallets
          .not('wallet_address', 'is', null) // Exclude null wallet addresses
          .order('rating', { ascending: false }) // Primary sort: Elo rating (highest first)
          .order('created_at', { ascending: true }) // Secondary sort: registration date
          .limit(100); // Show top 100 instead of just 10

        if (error) throw error;

        if (data) {
          const leaderboardData: LeaderboardPlayer[] = data.map((player, index) => {
            const wins = player.total_wins || 0;
            const losses = player.total_losses || 0;
            const totalGames = wins + losses;
            const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

            return {
              rank: index + 1,
              username: player.username || 'Anonymous',
              countryFlag: player.country_code || 'us',
              wins,
              losses,
              winRate,
              wallet: player.wallet_address || '',
              gameBalance: player.game_balance || 0,
              totalSolWon: player.total_sol_won || 0,
              rating: player.rating || 500,
              registeredAt: player.created_at || '',
            };
          });

          setLeaderboard(leaderboardData);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setLeaderboard([]);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchLeaderboard();

    // Refresh every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000);

    return () => clearInterval(interval);
  }, []);

  return { leaderboard, isLoading };
};