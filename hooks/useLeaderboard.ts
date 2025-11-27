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
}

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('username, country_code, total_wins, total_losses, wallet_address')
          .order('total_wins', { ascending: false })
          .limit(10);

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
              countryFlag: player.country_code || 'US',
              wins,
              losses,
              winRate,
              wallet: player.wallet_address || '',
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