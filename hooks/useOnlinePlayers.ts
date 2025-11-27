import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useOnlinePlayers = () => {
  const [onlineCount, setOnlineCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Function to count online players (last active within 5 minutes)
    const fetchOnlineCount = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { count, error } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .gte('last_played_at', fiveMinutesAgo);

        if (error) throw error;

        setOnlineCount(count || 0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching online count:', error);
        setOnlineCount(0);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchOnlineCount();

    // Poll every 30 seconds for updated count
    const interval = setInterval(fetchOnlineCount, 30000);

    return () => clearInterval(interval);
  }, []);

  return { onlineCount, isLoading };
};