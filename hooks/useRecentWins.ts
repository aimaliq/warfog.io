import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RecentWin {
  id: string;
  winnerWallet: string;
  amount: number;
  timestamp: number;
  countryCode: string | null;
}

export const useRecentWins = () => {
  const [wins, setWins] = useState<RecentWin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecentWins = async () => {
      try {
        // Query wagered matches only (wager_amount > 0)
        const { data: matches, error } = await supabase
          .from('matches')
          .select(`
            id,
            winner_id,
            wager_amount,
            completed_at,
            winner:players!matches_winner_id_fkey(wallet_address, country_code)
          `)
          .gt('wager_amount', 0)
          .eq('status', 'completed')
          .not('winner_id', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const formattedWins: RecentWin[] = matches?.map(match => {
          const wallet = match.winner?.wallet_address || 'Unknown';
          const formatted = wallet.length > 8
            ? `${wallet.slice(0, 4)}...${wallet.slice(-3)}`
            : wallet;

          return {
            id: match.id,
            winnerWallet: formatted,
            amount: match.wager_amount,
            timestamp: new Date(match.completed_at).getTime(),
            countryCode: match.winner?.country_code || null
          };
        }) || [];

        setWins(formattedWins);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching recent wins:', error);
        setWins([]);
        setIsLoading(false);
      }
    };

    fetchRecentWins();

    // Refresh every 30 seconds
    const interval = setInterval(fetchRecentWins, 30000);

    return () => clearInterval(interval);
  }, []);

  return { wins, isLoading };
};
