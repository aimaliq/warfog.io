// WARFOG.IO - Type Definitions
// Strategic Base Defense PvP Game

export interface Base {
  id: number; // 0-4 (5 bases per player)
  hp: number; // 0, 1, or 2
  isDestroyed: boolean; // true when hp === 0
}

export interface Player {
  id: string;
  walletAddress?: string; // Optional for guest mode
  username: string; // Guest username or custom callsign
  countryFlag: string; // Emoji flag
  isGuest: boolean;

  // Game state
  bases: Base[]; // Array of 5 bases
  basesDestroyed: number; // Count 0-3
  totalHP: number; // Sum of all base HP (0-10)

  // Selections (current turn)
  defendedBases: number[]; // Array of 2 base IDs
  attackedBases: number[]; // Array of 3 base IDs

  // HP allocation
  pendingHP: number; // HP gifts to allocate (0-2)

  // Stats
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number; // Current win streak counter
  longestStreak: number; // Longest win streak achieved
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  MATCHMAKING = 'MATCHMAKING',
  PLANNING = 'PLANNING', // 15 second turn - select defenses & attacks
  RESOLVING = 'RESOLVING', // 3-5 second animation
  HP_ALLOCATION = 'HP_ALLOCATION', // 10 second conditional phase
  GAME_OVER = 'GAME_OVER'
}

export interface TurnResult {
  turnNumber: number;

  // Player 1
  player1Defended: number[];
  player1Attacked: number[];
  player1DamageDealt: number;
  player1Hits: number[]; // Which attacks hit
  player1Blocks: number[]; // Which attacks were blocked

  // Player 2
  player2Defended: number[];
  player2Attacked: number[];
  player2DamageDealt: number;
  player2Hits: number[];
  player2Blocks: number[];

  // Rewards
  player1HPGifts: number; // How many bases they destroyed this turn
  player2HPGifts: number;
}

export interface GameState {
  gameId: string;
  phase: GamePhase;

  // Players
  player1: Player;
  player2: Player;
  currentPlayer: string; // 'player1' or 'player2' (which perspective)

  // Turn management
  currentTurn: number;
  turnTimeLeft: number; // Milliseconds (10000 for planning phase)

  // Results
  lastTurnResult: TurnResult | null;
  turnHistory: TurnResult[];

  // Winner
  winner: string | null; // player1 ID or player2 ID
  winReason: 'BASES_DESTROYED' | 'OPPONENT_FORFEIT' | 'TIE_HP' | 'TIE_COINFLIP' | null;
}

export interface MatchHistory {
  matchId: string;
  player1Address: string;
  player2Address: string;
  winnerAddress: string;
  totalTurns: number;
  durationSeconds: number;
  createdAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  countryFlag: string;
  username: string;
  totalWins: number;
  totalLosses: number;
  winRate: number;
}

// Matchmaking
export interface MatchmakingQueue {
  playerId: string;
  isFree: boolean; // true = free match, false = wagered match
  wagerAmount?: number; // SOL amount for wagered matches
  timestamp: number;
}

// Combat resolution
export interface AttackResult {
  attackerBaseId: number;
  defenderBaseId: number;
  result: 'HIT' | 'BLOCKED' | 'WASTED'; // wasted = attacking destroyed base
  damageDealt: number; // 0 or 1
}