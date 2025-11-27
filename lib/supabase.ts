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