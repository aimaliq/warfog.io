import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RecentWin {
  id: string;
  winnerWallet: string;
  amount: number;
  timestamp: number;
}

export const useRecentWins = () => {
  const [wins, setWins] = useState<RecentWin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecentWins = async () => {
      try {
        // TODO: Query actual matches table when implemented
        // For now, generate mock data
        const mockWins: RecentWin[] = [
          {
            id: '1',
            winnerWallet: 'Fu8s...JsH',
            amount: 0.5,
            timestamp: Date.now() - 30000,
          },
          {
            id: '2',
            winnerWallet: '9KpL...mN2',
            amount: 1.0,
            timestamp: Date.now() - 60000,
          },
          {
            id: '3',
            winnerWallet: 'Abc4...Xyz',
            amount: 0.1,
            timestamp: Date.now() - 90000,
          },
        ];

        setWins(mockWins);
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
