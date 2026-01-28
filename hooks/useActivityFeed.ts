import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ActivityLog {
  id: string;
  wallet: string;
  message: string;
  timestamp: number;
  countryCode: string | null;
  opponentCountryCode?: string | null;
}

export const useActivityFeed = (wagerFilter?: 'free' | 'wagered') => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select(`
            id,
            wallet_address,
            activity_type,
            details,
            created_at,
            player:players!activity_logs_player_id_fkey(country_code, username)
          `)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // For battle activities, we need to fetch opponent country codes
        const formattedActivities: ActivityLog[] = await Promise.all(
          (data || []).map(async (activity) => {
            const wallet = activity.wallet_address || 'Unknown';
            const formattedWallet = wallet.length > 8
              ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
              : wallet;

            // Get username from player data, or use wallet as fallback
            const username = activity.player?.username || formattedWallet;
            const wager = activity.details?.wager_amount || 0;

            // For free matches (wager = 0), use username; for wagered, use wallet
            const displayName = wager === 0 ? username : formattedWallet;

            let message = '';
            let opponentCountryCode: string | null = null;

            switch (activity.activity_type) {
              case 'wallet_connected':
                message = `${displayName} connected wallet`;
                break;
              case 'joined_lobby':
                message = `${displayName} joined ${wager.toFixed(2)} lobby`;
                break;
              case 'match_started':
                const opponent = activity.details?.opponent_wallet || 'Unknown';
                const formattedOpponent = opponent.length > 8
                  ? `${opponent.slice(0, 4)}...${opponent.slice(-4)}`
                  : opponent;

                let opponentDisplayName = formattedOpponent;

                // Fetch opponent's country code and username
                if (opponent && opponent !== 'Unknown') {
                  let opponentData = null;

                  if (opponent.startsWith('guest_')) {
                    // Guest player - look up by player ID
                    const guestId = opponent.replace('guest_', '');
                    const { data } = await supabase
                      .from('players')
                      .select('country_code, username, wallet_address')
                      .eq('id', guestId)
                      .single();
                    opponentData = data;
                  } else {
                    // Wallet player - look up by wallet address
                    const { data } = await supabase
                      .from('players')
                      .select('country_code, username, wallet_address')
                      .eq('wallet_address', opponent)
                      .single();
                    opponentData = data;
                  }

                  opponentCountryCode = opponentData?.country_code || null;

                  // Use username for free matches, wallet for wagered
                  if (wager === 0 && opponentData?.username) {
                    opponentDisplayName = opponentData.username;
                  }
                }

                message = `${displayName} started battle vs ${opponentDisplayName}`;
                break;
              default:
                message = `${displayName} performed action`;
            }

            return {
              id: activity.id,
              wallet: formattedWallet,
              message,
              timestamp: new Date(activity.created_at).getTime(),
              countryCode: activity.player?.country_code || null,
              opponentCountryCode
            };
          })
        );

        // Deduplicate battles: each match creates 2 logs (one per player), show only one
        const seenBattles = new Set<string>();
        const deduplicatedActivities = formattedActivities.filter((activity, index) => {
          const original = data![index];
          if (original.activity_type !== 'match_started') return true;

          // Create a key from sorted player wallets + timestamp (within 5 sec window)
          const wallet1 = original.wallet_address || '';
          const wallet2 = original.details?.opponent_wallet || '';
          const timeKey = Math.floor(new Date(original.created_at).getTime() / 5000); // 5-second window
          const battleKey = [wallet1, wallet2].sort().join('|') + '|' + timeKey;

          if (seenBattles.has(battleKey)) return false;
          seenBattles.add(battleKey);
          return true;
        });

        // Apply wager filter if specified
        let filteredActivities = deduplicatedActivities;
        if (wagerFilter) {
          filteredActivities = deduplicatedActivities.filter((activity) => {
            // Find original activity by id
            const originalActivity = data!.find(d => d.id === activity.id);
            const wager = originalActivity?.details?.wager_amount || 0;

            if (wagerFilter === 'free') {
              return wager === 0;
            } else if (wagerFilter === 'wagered') {
              return wager > 0;
            }
            return true;
          });
        }

        setActivities(filteredActivities);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching activity feed:', error);
        setActivities([]);
        setIsLoading(false);
      }
    };

    fetchActivities();

    // Refresh every 10 seconds
    const interval = setInterval(fetchActivities, 10000);

    return () => clearInterval(interval);
  }, [wagerFilter]);

  return { activities, isLoading };
};
