import { useState } from 'react';
import { GameState, GamePhase, Player, Base } from './types';
import BattleScreen from './components/BattleScreen';
import { Navigation } from './components/Navigation';
import { LobbyPage } from './components/LobbyPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { ProfilePage } from './components/ProfilePage';

// Initialize 5 bases with 2 HP each
const createBases = (): Base[] => [
  { id: 0, hp: 2, isDestroyed: false },
  { id: 1, hp: 2, isDestroyed: false },
  { id: 2, hp: 2, isDestroyed: false },
  { id: 3, hp: 2, isDestroyed: false },
  { id: 4, hp: 2, isDestroyed: false },
];

const INITIAL_PLAYER: Player = {
  id: 'player1',
  username: 'COMMANDER_ALPHA',
  countryFlag: 'us',
  isGuest: true,
  bases: createBases(),
  basesDestroyed: 0,
  totalHP: 10,
  defendedBases: [],
  attackedBases: [],
  pendingHP: 0,
  wins: 0,
  losses: 0,
  gamesPlayed: 0,
  winRate: 0,
  currentStreak: 0,
  longestStreak: 0,
};

const INITIAL_ENEMY: Player = {
  id: 'player2',
  username: 'SHADOW_OPS',
  countryFlag: 'ru',
  isGuest: true,
  bases: createBases(),
  basesDestroyed: 0,
  totalHP: 10,
  defendedBases: [],
  attackedBases: [],
  pendingHP: 0,
  wins: 0,
  losses: 0,
  gamesPlayed: 0,
  winRate: 0,
  currentStreak: 0,
  longestStreak: 0,
};

const INITIAL_GAME_STATE: GameState = {
  gameId: 'test-game-1',
  phase: GamePhase.LOBBY,
  player1: INITIAL_PLAYER,
  player2: INITIAL_ENEMY,
  currentPlayer: 'player1',
  currentTurn: 1,
  turnTimeLeft: 10000,
  lastTurnResult: null,
  turnHistory: [],
  winner: null,
  winReason: null,
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [activeTab, setActiveTab] = useState('lobby');

  const handleForfeit = () => {
    // Player clicked nav during match - they forfeit and lose
    setGameState({
      ...gameState,
      phase: GamePhase.GAME_OVER,
      winner: gameState.player2.id,
      winReason: 'OPPONENT_FORFEIT',
    });
    // Update player stats
    const updatedPlayer1 = {
      ...gameState.player1,
      losses: gameState.player1.losses + 1,
      gamesPlayed: gameState.player1.gamesPlayed + 1,
    };
    const updatedPlayer2 = {
      ...gameState.player2,
      wins: gameState.player2.wins + 1,
      gamesPlayed: gameState.player2.gamesPlayed + 1,
    };
    setGameState(prev => ({
      ...prev,
      player1: updatedPlayer1,
      player2: updatedPlayer2,
    }));
  };

  const renderContent = () => {
    // During gameplay, always show battle screen regardless of tab
    if (gameState.phase !== GamePhase.LOBBY) {
      return <BattleScreen gameState={gameState} setGameState={setGameState} />;
    }

    // In lobby, show content based on active tab
    if (activeTab === 'lobby') {
      return (
        <LobbyPage
          player={gameState.player1}
          onStartBattle={() => setGameState({ ...gameState, phase: GamePhase.PLANNING })}
        />
      );
    } else if (activeTab === 'leaderboard') {
      return <LeaderboardPage player={gameState.player1} />;
    } else if (activeTab === 'profile') {
      return <ProfilePage player={gameState.player1} />;
    }
  };

  return (
    <div className="h-screen bg-terminal-bg text-terminal-green font-mono relative flex flex-col overflow-hidden">
      {/* Background Grid Effect */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#a3e635 1px, transparent 1px), linear-gradient(90deg, #a3e635 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
        {renderContent()}
      </div>

      <Navigation
        activeTab={activeTab}
        onChange={setActiveTab}
        isInMatch={gameState.phase !== GamePhase.LOBBY}
        onForfeit={handleForfeit}
      />
    </div>
  );
}