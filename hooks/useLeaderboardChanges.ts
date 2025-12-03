import { useState, useEffect, useRef } from 'react';
import { LeaderboardPlayer } from './useLeaderboard';

export interface LeaderboardChange {
  id: string;
  wallet: string;
  username: string;
  oldRank: number | null;
  newRank: number;
  change: 'up' | 'down' | 'new';
  timestamp: number;
}

export const useLeaderboardChanges = (currentLeaderboard: LeaderboardPlayer[]) => {
  const [changes, setChanges] = useState<LeaderboardChange[]>([]);
  const previousLeaderboard = useRef<LeaderboardPlayer[]>([]);

  useEffect(() => {
    if (currentLeaderboard.length === 0) return;

    const newChanges: LeaderboardChange[] = [];

    // Compare with previous leaderboard
    currentLeaderboard.forEach((player) => {
      const previousPlayer = previousLeaderboard.current.find(
        (p) => p.wallet === player.wallet
      );

      if (!previousPlayer) {
        // New player on leaderboard
        newChanges.push({
          id: `${player.wallet}-${Date.now()}`,
          wallet: player.wallet,
          username: player.username,
          oldRank: null,
          newRank: player.rank,
          change: 'new',
          timestamp: Date.now(),
        });
      } else if (previousPlayer.rank !== player.rank) {
        // Rank changed
        newChanges.push({
          id: `${player.wallet}-${Date.now()}`,
          wallet: player.wallet,
          username: player.username,
          oldRank: previousPlayer.rank,
          newRank: player.rank,
          change: player.rank < previousPlayer.rank ? 'up' : 'down',
          timestamp: Date.now(),
        });
      }
    });

    if (newChanges.length > 0) {
      setChanges((prev) => {
        const combined = [...newChanges, ...prev];
        // Keep only last 20 changes
        return combined.slice(0, 20);
      });
    }

    // Update previous leaderboard
    previousLeaderboard.current = currentLeaderboard;
  }, [currentLeaderboard]);

  return changes;
};
