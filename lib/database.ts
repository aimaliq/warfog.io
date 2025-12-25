import { supabase, Player, Match, GameState, MatchmakingQueue } from './supabase';

// ============ PLAYER OPERATIONS ============

export async function createGuestPlayer(): Promise<Player | null> {
  // Empty username to encourage user to set their own nickname
  const guestName = '';

  const { data, error } = await supabase
    .from('players')
    .insert({
      username: guestName,
      is_guest: true,
      country_code: 'us',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating guest player:', error);
    return null;
  }

  return data;
}

export async function getPlayerById(playerId: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (error) {
    console.error('Error fetching player:', error);
    return null;
  }

  return data;
}

export async function getPlayerByWallet(walletAddress: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (error) {
    // Not an error if player doesn't exist yet
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching player by wallet:', error);
    return null;
  }

  return data;
}

export async function updatePlayerWallet(
  playerId: string,
  walletAddress: string
): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .update({
      wallet_address: walletAddress,
      is_guest: false // Mark as registered user when wallet is connected
    })
    .eq('id', playerId)
    .select()
    .single();

  if (error) {
    console.error('Error updating player wallet:', error);
    return null;
  }

  return data;
}

export async function updatePlayerStats(
  playerId: string,
  won: boolean
): Promise<void> {
  const player = await getPlayerById(playerId);
  if (!player) return;

  const updates: Partial<Player> = {
    last_played_at: new Date().toISOString(),
  };

  if (won) {
    updates.total_wins = player.total_wins + 1;
    updates.current_streak = player.current_streak + 1;
    updates.best_streak = Math.max(player.best_streak, player.current_streak + 1);
  } else {
    updates.total_losses = player.total_losses + 1;
    updates.current_streak = 0;
  }

  await supabase
    .from('players')
    .update(updates)
    .eq('id', playerId);
}

export async function getLeaderboard(limit: number = 100): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('total_wins', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data;
}

// ============ MATCHMAKING OPERATIONS ============

export async function joinMatchmakingQueue(
  playerId: string,
  wagerAmount: number = 0
): Promise<MatchmakingQueue | null> {
  const { data, error } = await supabase
    .from('matchmaking_queue')
    .insert({
      player_id: playerId,
      wager_amount: wagerAmount,
    })
    .select()
    .single();

  if (error) {
    console.error('Error joining queue:', error);
    return null;
  }

  return data;
}

export async function leaveMatchmakingQueue(playerId: string): Promise<void> {
  await supabase
    .from('matchmaking_queue')
    .delete()
    .eq('player_id', playerId);
}

export async function findOpponent(
  playerId: string,
  wagerAmount: number = 0
): Promise<MatchmakingQueue | null> {
  const { data, error } = await supabase
    .from('matchmaking_queue')
    .select('*')
    .eq('wager_amount', wagerAmount)
    .neq('player_id', playerId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.error('Error finding opponent:', error);
    return null;
  }

  return data;
}

// ============ MATCH OPERATIONS ============

export async function createMatch(
  player1Id: string,
  player2Id: string,
  wagerAmount: number = 0
): Promise<Match | null> {
  const { data: matchData, error: matchError } = await supabase
    .from('matches')
    .insert({
      player1_id: player1Id,
      player2_id: player2Id,
      status: 'active',
      wager_amount: wagerAmount,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (matchError) {
    console.error('Error creating match:', matchError);
    return null;
  }

  // Create initial game state
  const turnDeadline = new Date(Date.now() + 10000).toISOString(); // 10 seconds from now

  const { error: stateError } = await supabase
    .from('game_states')
    .insert({
      match_id: matchData.id,
      current_turn: 1,
      turn_phase: 'planning',
      turn_deadline: turnDeadline,
      player1_silos: [2, 2, 2, 2, 2],
      player2_silos: [2, 2, 2, 2, 2],
    });

  if (stateError) {
    console.error('Error creating game state:', stateError);
    return null;
  }

  return matchData;
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error) {
    console.error('Error fetching match:', error);
    return null;
  }

  return data;
}

export async function updateMatchStatus(
  matchId: string,
  status: Match['status'],
  winnerId?: string
): Promise<void> {
  const updates: Partial<Match> = { status };

  if (status === 'completed' || status === 'forfeit') {
    updates.completed_at = new Date().toISOString();
    if (winnerId) {
      updates.winner_id = winnerId;
    }
  }

  await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId);
}

// ============ GAME STATE OPERATIONS ============

export async function getGameState(matchId: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from('game_states')
    .select('*')
    .eq('match_id', matchId)
    .single();

  if (error) {
    console.error('Error fetching game state:', error);
    return null;
  }

  return data;
}

export async function updateGameState(
  matchId: string,
  updates: Partial<GameState>
): Promise<void> {
  await supabase
    .from('game_states')
    .update(updates)
    .eq('match_id', matchId);
}

export async function submitTurnActions(
  matchId: string,
  playerId: string,
  defended: number[],
  attacked: number[]
): Promise<void> {
  const gameState = await getGameState(matchId);
  if (!gameState) return;

  const match = await getMatch(matchId);
  if (!match) return;

  const isPlayer1 = match.player1_id === playerId;

  const updates: Partial<GameState> = {};
  if (isPlayer1) {
    updates.player1_defended = defended;
    updates.player1_attacked = attacked;
    updates.player1_ready = true;
  } else {
    updates.player2_defended = defended;
    updates.player2_attacked = attacked;
    updates.player2_ready = true;
  }

  await updateGameState(matchId, updates);
}

// ============ REALTIME SUBSCRIPTIONS ============

export function subscribeToGameState(
  matchId: string,
  callback: (gameState: GameState) => void
) {
  const subscription = supabase
    .channel(`game_state:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_states',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        callback(payload.new as GameState);
      }
    )
    .subscribe();

  return subscription;
}

export function subscribeToMatchmakingQueue(
  callback: (queue: MatchmakingQueue[]) => void
) {
  const subscription = supabase
    .channel('matchmaking_queue')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'matchmaking_queue',
      },
      async () => {
        // Fetch updated queue
        const { data } = await supabase
          .from('matchmaking_queue')
          .select('*')
          .order('joined_at', { ascending: true });

        if (data) {
          callback(data);
        }
      }
    )
    .subscribe();

  return subscription;
}