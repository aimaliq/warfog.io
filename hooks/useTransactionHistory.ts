import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Transaction {
  id: string;
  amount: number;
  operation: 'deposit' | 'withdrawal';
  signature: string;
  createdAt: Date;
}

export const useTransactionHistory = (playerId?: string) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactionHistory = async () => {
      if (!playerId) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      try {
        // Query transactions for this player
        const { data, error } = await supabase
          .from('transactions')
          .select('id, amount, type, signature, created_at')
          .eq('player_id', playerId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error fetching transaction history:', error);
          setTransactions([]);
          setIsLoading(false);
          return;
        }

        if (data) {
          const formattedTransactions: Transaction[] = data.map((tx: any) => ({
            id: tx.id,
            amount: tx.amount || 0,
            operation: tx.type as 'deposit' | 'withdrawal',
            signature: tx.signature || '',
            createdAt: new Date(tx.created_at)
          }));

          setTransactions(formattedTransactions);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching transaction history:', error);
        setTransactions([]);
        setIsLoading(false);
      }
    };

    fetchTransactionHistory();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTransactionHistory, 30000);

    return () => clearInterval(interval);
  }, [playerId]);

  return { transactions, isLoading };
};
