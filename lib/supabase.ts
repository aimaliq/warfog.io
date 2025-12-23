import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database Types
export interface Player {
  id: string;
  username: string;
  is_guest: boolean;
  wallet_address: string | null;
  country_code: string;
  total_wins: number;
  total_losses: number;
  current_streak: number;
  best_streak: number;
  warfog_balance: number;
  rating: number;
  created_at: string;
  last_played_at: string;
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  status: 'waiting' | 'active' | 'completed' | 'forfeit';
  wager_amount: number;
  total_turns: number;
  duration_seconds: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GameState {
  id: string;
  match_id: string;
  current_turn: number;
  turn_phase: 'planning' | 'resolution' | 'hp_allocation' | 'game_over';
  turn_deadline: string | null;

  player1_silos: number[];
  player1_destroyed_count: number;
  player1_pending_hp: number;
  player1_ready: boolean;
  player1_defended: number[] | null;
  player1_attacked: number[] | null;

  player2_silos: number[];
  player2_destroyed_count: number;
  player2_pending_hp: number;
  player2_ready: boolean;
  player2_defended: number[] | null;
  player2_attacked: number[] | null;

  updated_at: string;
}

export interface TurnHistory {
  id: string;
  match_id: string;
  turn_number: number;

  player1_defended: number[] | null;
  player1_attacked: number[] | null;
  player1_damage_dealt: number;
  player1_silos_destroyed: number;

  player2_defended: number[] | null;
  player2_attacked: number[] | null;
  player2_damage_dealt: number;
  player2_silos_destroyed: number;

  created_at: string;
}

export interface MatchmakingQueue {
  id: string;
  player_id: string;
  wager_amount: number;
  joined_at: string;
}

// Utility function to update last_played_at timestamp
export const updateLastPlayedAt = async (playerId: string): Promise<void> => {
  try {
    // Skip if ID is invalid (guest player)
    if (!playerId || playerId.length < 20) {
      return;
    }

    await supabase
      .from('players')
      .update({ last_played_at: new Date().toISOString() })
      .eq('id', playerId);
  } catch (error) {
    console.error('Error updating last_played_at:', error);
  }
};

// Elo Rating System Functions
// K-factor of 16 (standard chess rating)
const ELO_K_FACTOR = 16;
const MIN_RATING = 100; // Floor rating

/**
 * Calculate Elo rating change for a player
 * @param playerRating Current rating of the player
 * @param opponentRating Current rating of the opponent
 * @param didWin True if player won, false if lost
 * @param kFactor K-factor for rating volatility (default 16)
 * @returns Rating change (positive or negative integer)
 */
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  didWin: boolean,
  kFactor: number = ELO_K_FACTOR
): number {
  // Calculate expected score (probability of winning)
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

  // Actual score: 1 for win, 0 for loss
  const actualScore = didWin ? 1 : 0;

  // Calculate rating change
  const ratingChange = kFactor * (actualScore - expectedScore);

  // Round to nearest integer
  return Math.round(ratingChange);
}

/**
 * Apply rating change with floor enforcement
 * @param currentRating Player's current rating
 * @param change Rating change to apply
 * @returns New rating (cannot drop below MIN_RATING)
 */
export function applyRatingChange(currentRating: number, change: number): number {
  const newRating = currentRating + change;
  return Math.max(MIN_RATING, newRating); // Floor at 100
}