import { useState, useEffect, useRef } from 'react';
import { GameState, GamePhase, Player, Base } from './types';
import BattleScreen from './components/BattleScreen';
import { Navigation } from './components/Navigation';
import { PlayPage } from './components/PlayPage';
import { SOLBattlesPage } from './components/SOLBattlesPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { ProfilePage } from './components/ProfilePage';
import { TermsPage } from './components/TermsPage';
import { AdminStatusPage } from './components/AdminStatusPage';
import { usePlayer } from './hooks/usePlayer';
import { updateLastPlayedAt } from './lib/supabase';

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
  rating: 500,
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
  rating: 500,
};

const INITIAL_GAME_STATE: GameState = {
  gameId: 'test-game-1',
  phase: GamePhase.LOBBY,
  player1: INITIAL_PLAYER,
  player2: INITIAL_ENEMY,
  currentPlayer: 'player1',
  currentTurn: 1,
  turnTimeLeft: 10000,
  betAmount: 0,
  lastTurnResult: null,
  turnHistory: [],
  winner: null,
  winReason: null,
};

export default function App() {
  const { player: dbPlayer, isLoading, refreshPlayer } = usePlayer();
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [activeTab, setActiveTab] = useState('play');
  const [showAdmin, setShowAdmin] = useState(false);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Audio ref for lobby music
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize lobby music on mount
  useEffect(() => {
    const audio = new Audio('/sounds/Lobby-music.m4a');
    audio.loop = true;
    audio.volume = 0.1;
    audioRef.current = audio;

    // Try to play immediately (may be blocked by browser autoplay policy)
    audio.play().catch(error => {
      console.log('Autoplay blocked - music will start after user interaction:', error);
    });

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Retry audio playback when player connects (user interaction)
  useEffect(() => {
    if (dbPlayer && audioRef.current && !isMuted) {
      // User has interacted by connecting wallet - try to play audio
      audioRef.current.play().catch(() => {
        // Still blocked, user needs to click somewhere
      });
    }
  }, [dbPlayer, isMuted]);

  // Handle mute/unmute
  useEffect(() => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.pause();
    } else if (gameState.phase === GamePhase.LOBBY) {
      audioRef.current.play().catch(() => {
        // Autoplay blocked
      });
    }
  }, [isMuted, gameState.phase]);

  // Check for admin access via URL hash
  useEffect(() => {
    const checkAdminAccess = () => {
      const hash = window.location.hash.slice(1); // Remove '#'
      const secretPath = import.meta.env.VITE_ADMIN_SECRET_PATH || '';

      if (hash === secretPath && secretPath) {
        setShowAdmin(true);
        // Clear hash to hide the secret
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    checkAdminAccess();
    window.addEventListener('hashchange', checkAdminAccess);

    return () => window.removeEventListener('hashchange', checkAdminAccess);
  }, []);

  // Pause music during battles, resume in lobby
  useEffect(() => {
    if (!audioRef.current || isMuted) return;

    if (gameState.phase === GamePhase.LOBBY) {
      // In lobby - play music
      audioRef.current.play().catch(() => {
        // Autoplay blocked or already playing
      });
    } else {
      // In battle - pause music
      audioRef.current.pause();
    }
  }, [gameState.phase, isMuted]);

  // Update game state when database player loads or clears
  useEffect(() => {
    if (dbPlayer) {
      setGameState(prev => ({
        ...prev,
        player1: {
          ...prev.player1,
          id: dbPlayer.id,
          username: dbPlayer.username,
          countryFlag: dbPlayer.country_code,
          walletAddress: dbPlayer.wallet_address || undefined,
          isGuest: dbPlayer.is_guest,
          wins: dbPlayer.total_wins,
          losses: dbPlayer.total_losses,
          gamesPlayed: dbPlayer.total_wins + dbPlayer.total_losses,
          winRate: dbPlayer.total_wins + dbPlayer.total_losses > 0
            ? (dbPlayer.total_wins / (dbPlayer.total_wins + dbPlayer.total_losses)) * 100
            : 0,
          currentStreak: dbPlayer.current_streak,
          longestStreak: dbPlayer.best_streak,
          rating: dbPlayer.rating || 500,
        }
      }));

      // Update last_played_at when player loads (wallet connects)
      updateLastPlayedAt(dbPlayer.id);
    } else {
      // Player disconnected - reset to initial state but restore saved guest profile
      const savedUsername = localStorage.getItem('warfog_guest_username');
      const savedCountry = localStorage.getItem('warfog_guest_country');
      setGameState(prev => ({
        ...prev,
        player1: {
          ...INITIAL_PLAYER,
          username: savedUsername || INITIAL_PLAYER.username,
          countryFlag: savedCountry || INITIAL_PLAYER.countryFlag,
        },
      }));
    }
  }, [dbPlayer]);

  // Periodic heartbeat to update last_played_at while user is active
  useEffect(() => {
    if (!dbPlayer?.id) return;

    // Update immediately on mount
    updateLastPlayedAt(dbPlayer.id);

    // Update every 60 seconds while app is active
    const heartbeatInterval = setInterval(() => {
      updateLastPlayedAt(dbPlayer.id);
    }, 60000);

    return () => clearInterval(heartbeatInterval);
  }, [dbPlayer?.id]);

  const handlePlayerUpdate = (updates: Partial<Player>) => {
    setGameState(prev => ({
      ...prev,
      player1: {
        ...prev.player1,
        ...updates,
      }
    }));
  };

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
    // Admin dashboard takes precedence over everything
    if (showAdmin) {
      return <AdminStatusPage onClose={() => setShowAdmin(false)} />;
    }

    // During gameplay, always show battle screen regardless of tab
    if (gameState.phase !== GamePhase.LOBBY) {
      return <BattleScreen gameState={gameState} setGameState={setGameState} matchId={currentMatchId} onRefreshPlayer={refreshPlayer} />;
    }

    // In lobby, show content based on active tab
    if (activeTab === 'play') {
      return (
        <PlayPage
          player={gameState.player1}
          onStartBattle={(matchId?: string) => {
            setCurrentMatchId(matchId || null);
            // Reset game state for new battle - use functional update to get latest state
            // (ensurePlayerInDB may have updated player1.id just before this call)
            setGameState(prev => ({
              ...INITIAL_GAME_STATE,
              player1: {
                ...prev.player1,
                bases: createBases(),
                basesDestroyed: 0,
                totalHP: 10,
                defendedBases: [],
                attackedBases: [],
                pendingHP: 0,
              },
              player2: {
                ...prev.player2,
                bases: createBases(),
                basesDestroyed: 0,
                totalHP: 10,
                defendedBases: [],
                attackedBases: [],
                pendingHP: 0,
              },
              phase: GamePhase.MATCHMAKING,
              betAmount: 0,
            }));
          }}
          onPlayerUpdate={handlePlayerUpdate}
          isInBattle={gameState.phase !== GamePhase.LOBBY}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
        />
      );
    } else if (activeTab === 'sol') {
      return (
        <SOLBattlesPage
          player={gameState.player1}
          onStartBattle={(matchId?: string) => {
            setCurrentMatchId(matchId || null);
            // Reset game state for new battle - use functional update to get latest state
            setGameState(prev => ({
              ...INITIAL_GAME_STATE,
              player1: {
                ...prev.player1,
                bases: createBases(),
                basesDestroyed: 0,
                totalHP: 10,
                defendedBases: [],
                attackedBases: [],
                pendingHP: 0,
              },
              player2: {
                ...prev.player2,
                bases: createBases(),
                basesDestroyed: 0,
                totalHP: 10,
                defendedBases: [],
                attackedBases: [],
                pendingHP: 0,
              },
              phase: GamePhase.MATCHMAKING,
              betAmount: 0,
            }));
          }}
          isInBattle={gameState.phase !== GamePhase.LOBBY}
        />
      );
    } else if (activeTab === 'leaderboard') {
      return <LeaderboardPage player={gameState.player1} />;
    } else if (activeTab === 'profile') {
      return (
        <ProfilePage
          player={gameState.player1}
          onPlayerUpdate={handlePlayerUpdate}
          onNavigateToTerms={() => setActiveTab('terms')}
        />
      );
    } else if (activeTab === 'terms') {
      return <TermsPage />;
    }
  };

  // Show loading screen while initializing player
  if (isLoading) {
    return (
      <div className="h-screen bg-terminal-bg text-terminal-green font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold mb-4 animate-pulse">INITIALIZING...</div>
          <div className="text-sm text-lime-700">Connecting to command center</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-terminal-bg text-terminal-green font-mono relative flex flex-col overflow-hidden">
      {/* Background Grid Effect */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none grid-scroll-overlay"
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