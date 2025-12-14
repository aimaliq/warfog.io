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

export const useActivityFeed = () => {
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
            player:players!activity_logs_player_id_fkey(country_code)
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

            let message = '';
            let opponentCountryCode: string | null = null;

            switch (activity.activity_type) {
              case 'wallet_connected':
                message = `${formattedWallet} connected wallet`;
                break;
              case 'joined_lobby':
                const wager = activity.details?.wager_amount || 0;
                message = `${formattedWallet} joined ${wager.toFixed(2)} lobby`;
                break;
              case 'match_started':
                const opponent = activity.details?.opponent_wallet || 'Unknown';
                const formattedOpponent = opponent.length > 8
                  ? `${opponent.slice(0, 4)}...${opponent.slice(-4)}`
                  : opponent;
                message = `${formattedWallet} started battle vs ${formattedOpponent}`;

                // Fetch opponent's country code
                if (opponent && opponent !== 'Unknown') {
                  const { data: opponentData } = await supabase
                    .from('players')
                    .select('country_code')
                    .eq('wallet_address', opponent)
                    .single();
                  opponentCountryCode = opponentData?.country_code || null;
                }
                break;
              default:
                message = `${formattedWallet} performed action`;
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

        setActivities(formattedActivities);
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
  }, []);

  return { activities, isLoading };
};
