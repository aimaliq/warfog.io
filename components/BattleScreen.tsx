import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Base, Player } from '../types';
import { FlagIcon } from './FlagIcon';
import { ShareVictory } from './ShareVictory';
import { supabase, updateLastPlayedAt } from '../lib/supabase';

// Helper to create fresh bases
const createBases = (): Base[] => [
  { id: 0, hp: 2, isDestroyed: false },
  { id: 1, hp: 2, isDestroyed: false },
  { id: 2, hp: 2, isDestroyed: false },
  { id: 3, hp: 2, isDestroyed: false },
  { id: 4, hp: 2, isDestroyed: false },
];

// Helper function to update game results in database
const updateGameResults = async (
  winnerId: string,
  loserId: string,
  betAmount: number
) => {
  try {
    // Skip if IDs are invalid (guest players)
    if (!winnerId || winnerId.length < 20 || !loserId || loserId.length < 20) {
      console.log('Skipping database update: guest player detected');
      return;
    }

    // Calculate balance changes (winner gets 1.9x bet, loser loses 1x bet)
    const winnerGain = betAmount * 1.9;
    const loserLoss = betAmount * 1.0;

    // Get current balances first
    const { data: winnerData } = await supabase
      .from('players')
      .select('total_wins, game_balance, total_sol_won')
      .eq('id', winnerId)
      .single();

    const { data: loserData } = await supabase
      .from('players')
      .select('total_losses, game_balance')
      .eq('id', loserId)
      .single();

    // Update winner balance and stats
    if (winnerData) {
      await supabase
        .from('players')
        .update({
          total_wins: (winnerData.total_wins || 0) + 1,
          game_balance: (winnerData.game_balance || 0) + winnerGain,
          total_sol_won: (winnerData.total_sol_won || 0) + winnerGain
        })
        .eq('id', winnerId);
    }

    // Update loser balance and stats
    if (loserData) {
      await supabase
        .from('players')
        .update({
          total_losses: (loserData.total_losses || 0) + 1,
          game_balance: Math.max(0, (loserData.game_balance || 0) - loserLoss) // Don't go negative
        })
        .eq('id', loserId);
    }

    console.log(`Game results updated: Winner ${winnerId} (+${winnerGain} SOL), Loser ${loserId} (-${loserLoss} SOL)`);
  } catch (error) {
    console.error('Error updating game results:', error);
  }
};

interface BattleScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  matchId?: string | null;
}

// Missile component for visual effects
const Missile = ({ fromEnemy, targetIndex, delay }: { fromEnemy: boolean; targetIndex: number; delay: number }) => {
  // Calculate horizontal offset based on target index (scatter effect)
  const horizontalOffset = (targetIndex - 2) * 80; // Spread missiles horizontally

  return (
    <div
      className={`absolute w-2 h-8 bg-gradient-to-b ${
        fromEnemy ? 'from-red-500 to-orange-600' : 'from-lime-500 to-yellow-400'
      } rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] pointer-events-none z-50`}
      style={{
        left: '50%',
        top: fromEnemy ? '15%' : '85%',
        marginLeft: '-4px', // Center the 8px wide missile
        animationName: fromEnemy ? 'missile-down' : 'missile-up',
        animationDuration: '1500ms',
        animationDelay: `${delay}ms`,
        animationTimingFunction: 'ease-in',
        animationFillMode: 'forwards',
        '--target-offset': `${horizontalOffset}px`
      } as React.CSSProperties & { '--target-offset': string }}
    >
      <div className="absolute inset-0 blur-sm bg-inherit opacity-60"></div>
    </div>
  );
};

// Floating damage notification
const DamageNotification = ({ count, isPlayer }: { count: number; isPlayer: boolean }) => {
  if (count === 0) return null;

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-float-up pointer-events-none"
    >
      <div className={`text-2xl font-black ${isPlayer ? 'text-lime-500' : 'text-red-500'} drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]`}>
        {count} SILO{count > 1 ? 'S' : ''} {isPlayer ? 'LOST' : 'DESTROYED'}
      </div>
    </div>
  );
};

const BaseIcon = ({
  base,
  isOwn,
  isSelected,
  onClick,
  mode,
  isGlowing
}: {
  base: Base;
  isOwn: boolean;
  isSelected: boolean;
  onClick: () => void;
  mode: 'attack' | 'defense' | 'heal';
  isGlowing?: boolean;
}) => {
  // Fog of War: Enemy bases always appear "alive" to hide their HP
  const visuallyDestroyed = isOwn && base.isDestroyed;
  const visuallyActive = !visuallyDestroyed;

  // Can click if it's enemy (even if destroyed) or own (if not destroyed)
  const canClick = !isOwn || (isOwn && !base.isDestroyed);

  return (
    <div
      onClick={canClick ? onClick : undefined}
      className={`
        relative w-16 h-24 md:w-24 md:h-32 border-2 flex flex-col items-center justify-center
        transition-all duration-300 overflow-hidden
        ${visuallyDestroyed
          ? 'border-gray-800 bg-gray-900/50 opacity-60 cursor-not-allowed'
          : isOwn
            ? isGlowing
              ? 'border-yellow-400 border-3 bg-yellow-900/30 shadow-[0_0_40px_rgba(250,204,21,0.9)] animate-pulse scale-105 brightness-115'
              : isSelected
              ? 'border-lime-400 bg-lime-900/20 shadow-[0_0_15px_rgba(163,230,53,0.4)] scale-105'
              : 'border-lime-900 bg-black hover:border-lime-500 hover:brightness-125'
            : isSelected
              ? 'border-red-500 bg-red-900/20 shadow-[0_0_15px_rgba(239,68,68,0.4)] scale-105'
              : 'border-red-900/30 bg-black hover:border-red-500 hover:brightness-125'
        }
        ${canClick ? 'cursor-pointer' : 'cursor-not-allowed'}
      `}
    >
      {/* HP Bar - Only visible for own bases */}
      {isOwn && (
        <div className="absolute top-1 left-1 right-1 flex gap-0.5">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 transition-all duration-300 ${
                i < base.hp ? 'bg-lime-500' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>
      )}

      {/* Selection Label */}
      {isSelected && (
        <div className={`absolute top-0 left-0 right-0 text-[10px] font-bold text-center py-0.5 z-10 ${
          isOwn ? 'bg-lime-500 text-black' : 'bg-red-500 text-black'
        }`}>
          {mode === 'defense' ? 'SHIELD' : 'ATTACK'}
        </div>
      )}

      {/* Base Content */}
      <div className="flex flex-col items-center justify-center mt-3">
        {visuallyDestroyed ? (
          <div className="text-3xl text-gray-800">⚠</div>
        ) : (
          <div className={`text-5xl md:text-6xl ${visuallyActive ? 'animate-spin-slow' : ''} ${
            isOwn ? 'text-lime-500' : isSelected ? 'text-red-400' : 'text-red-700'
          }`}>
            ☢
          </div>
        )}
      </div>

      {/* Base ID */}
      <div className={`absolute bottom-1 right-1 text-[8px] font-mono ${
        visuallyDestroyed ? 'text-gray-600' : isOwn ? 'text-lime-800' : 'text-red-800'
      }`}>
        S-{base.id}
      </div>
    </div>
  );
};

export default function BattleScreen({ gameState, setGameState, matchId }: BattleScreenProps) {
  const player = gameState.player1;
  const enemy = gameState.player2;

  const [selectedDefenses, setSelectedDefenses] = useState<number[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [matchDataLoaded, setMatchDataLoaded] = useState(false);

  // Turn synchronization state
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [lastTurnResolvedAt, setLastTurnResolvedAt] = useState<string | null>(null);
  const [submittedMoves, setSubmittedMoves] = useState<{defenses: number[], attacks: number[]} | null>(null);

  // Rematch state
  const [rematchCountdown, setRematchCountdown] = useState(0);
  const [rematchStatus, setRematchStatus] = useState('');

  // Load real opponent data when matchId exists
  useEffect(() => {
    if (!matchId || matchDataLoaded) return;

    const loadMatchData = async () => {
      try {
        console.log(`🔄 Loading match data for matchId: ${matchId}`);

        // Fetch match data
        const { data: match, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (matchError || !match) {
          console.error('Error loading match:', matchError);
          return;
        }

        // Fetch both players' data
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('*')
          .in('id', [match.player1_id, match.player2_id]);

        if (playersError || !players || players.length !== 2) {
          console.error('Error loading players:', playersError);
          return;
        }

        // Determine which player is current user and which is opponent
        const player1Data = players.find(p => p.id === match.player1_id);
        const player2Data = players.find(p => p.id === match.player2_id);

        if (!player1Data || !player2Data) {
          console.error('Could not find player data');
          return;
        }

        // Determine if current user is player1 or player2
        const isPlayer1 = gameState.player1.id === match.player1_id;
        const opponentData = isPlayer1 ? player2Data : player1Data;

        console.log(`✅ Loaded opponent: ${opponentData.username} (${opponentData.wallet_address?.slice(0, 8)}...)`);

        // Update game state with real opponent
        setGameState(prev => ({
          ...prev,
          player2: {
            ...prev.player2,
            id: opponentData.id,
            username: opponentData.username || 'UNKNOWN',
            countryFlag: opponentData.country_code || 'xx',
            isGuest: opponentData.is_guest || false,
            wins: opponentData.total_wins || 0,
            losses: opponentData.total_losses || 0,
            gamesPlayed: (opponentData.total_wins || 0) + (opponentData.total_losses || 0),
            winRate: (opponentData.total_wins || 0) + (opponentData.total_losses || 0) > 0
              ? ((opponentData.total_wins || 0) / ((opponentData.total_wins || 0) + (opponentData.total_losses || 0))) * 100
              : 0,
            currentStreak: opponentData.current_streak || 0,
            longestStreak: opponentData.best_streak || 0,
          },
          betAmount: match.wager_amount || 0
        }));

        setMatchDataLoaded(true);
      } catch (error) {
        console.error('Error in loadMatchData:', error);
      }
    };

    loadMatchData();
  }, [matchId, gameState.player1.id, matchDataLoaded]);

  // Send heartbeat to server (presence tracking for resignation detection)
  useEffect(() => {
    if (!matchId || gameState.phase === GamePhase.GAME_OVER) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/game/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId,
            playerId: player.id
          })
        });
      } catch (error) {
        console.error('❌ Heartbeat error:', error);
      }
    };

    // Send heartbeat immediately
    sendHeartbeat();

    // Send heartbeat every 3 seconds
    const interval = setInterval(sendHeartbeat, 3000);

    return () => clearInterval(interval);
  }, [matchId, player.id, gameState.phase]);

  // Continuous resignation detection during active match (even when not waiting)
  useEffect(() => {
    if (!matchId || gameState.phase === GamePhase.GAME_OVER || gameState.phase === GamePhase.MATCHMAKING) return;

    const checkResignation = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/game/state/${matchId}`);
        const data = await response.json();

        if (data.resignation) {
          console.log('🏳️ Opponent resigned during active play!');

          setGameState(current => ({
            ...current,
            phase: GamePhase.GAME_OVER,
            winner: data.resignation.winnerId,
            winReason: 'OPPONENT_FORFEIT'
          }));

          // Trigger settlement for wagered match
          if (data.match.wager_amount && data.match.wager_amount > 0 && data.resignation.winnerId) {
            console.log(`💰 Settling wagered match after resignation: ${matchId}`);
            fetch(`${import.meta.env.VITE_BACKEND_URL}/api/match/settle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchId: matchId,
                winnerId: data.resignation.winnerId
              })
            })
            .then(res => res.json())
            .then(data => {
              console.log('✅ Match settlement complete:', data);
            })
            .catch(err => {
              console.error('❌ Match settlement error:', err);
            });
          }
        }
      } catch (error) {
        console.error('❌ Error checking resignation:', error);
      }
    };

    // Check for resignation every 2 seconds
    const interval = setInterval(checkResignation, 2000);

    return () => clearInterval(interval);
  }, [matchId, gameState.phase, setGameState]);

  // Poll for game state updates when waiting for opponent or turn resolution
  useEffect(() => {
    if (!matchId || !waitingForOpponent) return;

    console.log('🔄 Starting game state polling...');

    const pollGameState = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/game/state/${matchId}`);
        const data = await response.json();

        if (!data.gameState || !data.match) {
          console.error('Invalid game state response:', data);
          return;
        }

        const { gameState: serverState, match, resignation } = data;

        // Check for resignation
        if (resignation) {
          console.log('🏳️ Opponent resigned!');
          setWaitingForOpponent(false);

          // Determine if current player won
          const isWinner = resignation.winnerId === player.id;

          setGameState(current => ({
            ...current,
            phase: GamePhase.GAME_OVER,
            winner: resignation.winnerId,
            winReason: 'OPPONENT_FORFEIT'
          }));

          // Trigger settlement for wagered match
          if (match.wager_amount && match.wager_amount > 0 && resignation.winnerId) {
            console.log(`💰 Settling wagered match after resignation: ${matchId}`);
            fetch(`${import.meta.env.VITE_BACKEND_URL}/api/match/settle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchId: matchId,
                winnerId: resignation.winnerId
              })
            })
            .then(res => res.json())
            .then(data => {
              console.log('✅ Match settlement complete:', data);
            })
            .catch(err => {
              console.error('❌ Match settlement error:', err);
            });
          }

          return;
        }

        // Check if turn has been resolved (turn_resolved_at changed)
        if (serverState.turn_resolved_at && serverState.turn_resolved_at !== lastTurnResolvedAt) {
          console.log('✅ Turn resolved! Applying server state...');
          setLastTurnResolvedAt(serverState.turn_resolved_at);
          setWaitingForOpponent(false);

          // Apply server-resolved game state
          applyServerResolvedTurn(serverState, match);
        }
      } catch (error) {
        console.error('❌ Error polling game state:', error);
      }
    };

    // Poll immediately, then every second
    pollGameState();
    const interval = setInterval(pollGameState, 1000);

    return () => {
      console.log('⏹️ Stopping game state polling');
      clearInterval(interval);
    };
  }, [matchId, waitingForOpponent, lastTurnResolvedAt, player.id, setGameState]);

  // Function to apply server-resolved turn and trigger animations
  const applyServerResolvedTurn = useCallback((serverState: any, match: any) => {
    console.log('🎮 Applying server-resolved turn:', serverState);

    // Determine if current player is player1 or player2 in the match
    const isPlayer1 = gameState.player1.id === match.player1_id;

    // Get silo HP arrays from server
    const playerSilos = isPlayer1 ? serverState.player1_silos : serverState.player2_silos;
    const enemySilos = isPlayer1 ? serverState.player2_silos : serverState.player1_silos;

    // Get the moves that were submitted
    const playerDefenses = isPlayer1 ? serverState.player1_defenses : serverState.player2_defenses;
    const playerAttacks = isPlayer1 ? serverState.player1_attacks : serverState.player2_attacks;
    const enemyDefenses = isPlayer1 ? serverState.player2_defenses : serverState.player1_defenses;
    const enemyAttacks = isPlayer1 ? serverState.player2_attacks : serverState.player1_attacks;

    // Show missiles animation
    setMessage("LAUNCH DETECTED. MISSILES AWAY.");
    setMissileTargets({ player: playerAttacks || [], enemy: enemyAttacks || [] });
    setShowMissiles(true);
    playMissilesSound();

    // After 1.5s: Impact + apply server state
    setTimeout(() => {
      setShake(true);
      setMessage("IMPACT CONFIRMED. ANALYZING DAMAGE.");
      playExplosionSound();
      setTimeout(() => setShake(false), 200);

      // Apply server state to local game
      setGameState(current => {
        // Convert silo HP arrays to base objects
        const newPlayerBases = playerSilos.map((hp: number, index: number) => ({
          id: index,
          hp: hp,
          isDestroyed: hp <= 0
        }));

        const newEnemyBases = enemySilos.map((hp: number, index: number) => ({
          id: index,
          hp: hp,
          isDestroyed: hp <= 0
        }));

        // Count destroyed bases
        const playerDestroyed = newPlayerBases.filter((b: Base) => b.isDestroyed).length;
        const enemyDestroyed = newEnemyBases.filter((b: Base) => b.isDestroyed).length;

        // Calculate total HP
        const playerTotalHP = playerSilos.reduce((sum: number, hp: number) => sum + hp, 0);
        const enemyTotalHP = enemySilos.reduce((sum: number, hp: number) => sum + hp, 0);

        // Calculate destructions this turn for notifications
        const playerDestroyedBefore = current.player1.bases.filter((b: Base) => b.isDestroyed).length;
        const enemyDestroyedBefore = current.player2.bases.filter((b: Base) => b.isDestroyed).length;
        const playerDestroyedThisTurn = playerDestroyed - playerDestroyedBefore;
        const enemyDestroyedThisTurn = enemyDestroyed - enemyDestroyedBefore;

        setLastTurnDestructions({
          player: playerDestroyedThisTurn,
          enemy: enemyDestroyedThisTurn,
          playerStartIndex: playerDestroyedBefore,
          enemyStartIndex: enemyDestroyedBefore
        });

        return {
          ...current,
          player1: {
            ...current.player1,
            bases: newPlayerBases,
            basesDestroyed: playerDestroyed,
            totalHP: playerTotalHP,
            pendingHP: 0 // Reset pending HP
          },
          player2: {
            ...current.player2,
            bases: newEnemyBases,
            basesDestroyed: enemyDestroyed,
            totalHP: enemyTotalHP,
            pendingHP: 0
          },
          phase: GamePhase.RESOLVING,
          currentTurn: serverState.current_turn
        };
      });

      setShowMissiles(false);

      // Show destruction notifications
      setTimeout(() => {
        setShowDestructionCount(true);

        setLastTurnDestructions(latest => {
          setHighlightedIcons({ player: [], enemy: [] });
          setIconsShrinking({ player: [], enemy: [] });

          const playerHighlights = latest.player > 0
            ? Array.from({ length: latest.player }, (_, i) => latest.playerStartIndex + i)
            : [];
          const enemyHighlights = latest.enemy > 0
            ? Array.from({ length: latest.enemy }, (_, i) => latest.enemyStartIndex + i)
            : [];

          if (playerHighlights.length > 0 || enemyHighlights.length > 0) {
            setHighlightedIcons({ player: playerHighlights, enemy: enemyHighlights });

            setTimeout(() => {
              setIconsShrinking({ player: playerHighlights, enemy: enemyHighlights });
              setTimeout(() => setIconsShrinking({ player: [], enemy: [] }), 600);
            }, 1200);

            setTimeout(() => setHighlightedIcons({ player: [], enemy: [] }), 1200);
          }

          return latest;
        });

        // Check for game over
        setTimeout(() => {
          setShowDestructionCount(false);

          if (match.status === 'completed') {
            // Game over
            console.log('🏁 Game over! Winner:', match.winner_id);

            // Call settlement endpoint if this is a wagered match
            if (match.wager_amount && match.wager_amount > 0 && match.winner_id) {
              console.log(`💰 Settling wagered match: ${matchId}`);
              fetch(`${import.meta.env.VITE_BACKEND_URL}/api/match/settle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  matchId: matchId,
                  winnerId: match.winner_id
                })
              })
              .then(res => res.json())
              .then(data => {
                console.log('✅ Match settlement complete:', data);
              })
              .catch(err => {
                console.error('❌ Match settlement error:', err);
              });
            }

            setGameState(current => {
              const winner = match.winner_id || 'TIE';
              const winReason = winner === 'TIE' ? 'TIE_HP' : 'BASES_DESTROYED';

              return {
                ...current,
                phase: GamePhase.GAME_OVER,
                winner,
                winReason
              };
            });
          } else {
            // Continue to next turn
            setGameState(prev => ({
              ...prev,
              phase: GamePhase.PLANNING,
              turnTimeLeft: 10000
            }));
          }
        }, 2000);
      }, 200);
    }, 1500);
  }, [gameState.player1.id, setGameState]);

  const [message, setMessage] = useState<string>("SHIELD YOUR SILOS (2) & STRIKE ENEMY (3)");
  const [shake, setShake] = useState(false);
  const [isAllocatingHP, setIsAllocatingHP] = useState(false);

  // Animation states
  const [showMissiles, setShowMissiles] = useState(false);
  const [missileTargets, setMissileTargets] = useState<{ player: number[], enemy: number[] }>({ player: [], enemy: [] });
  const [lastTurnDestructions, setLastTurnDestructions] = useState({
    player: 0,
    enemy: 0,
    playerStartIndex: 0,
    enemyStartIndex: 0
  });
  const [showDestructionCount, setShowDestructionCount] = useState(false);
  const [highlightedIcons, setHighlightedIcons] = useState<{ player: number[], enemy: number[] }>({ player: [], enemy: [] });
  const [iconsShrinking, setIconsShrinking] = useState<{ player: number[], enemy: number[] }>({ player: [], enemy: [] });

  // Timer pop animation state
  const [lastSecond, setLastSecond] = useState(-1);
  const [isPopping, setIsPopping] = useState(false);
  const popTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Matchmaking transition state
  const [matchmakingStartTime, setMatchmakingStartTime] = useState<number | null>(null);

  // Helper to count destroyed bases
  const countDestroyed = (playerData: Player) => playerData.bases.filter(b => b.isDestroyed).length;

  const enemyDestroyedCount = countDestroyed(enemy);
  const playerDestroyedCount = countDestroyed(player);

  // Timer countdown (10 seconds per turn)
  useEffect(() => {
    if (gameState.phase === GamePhase.PLANNING) {
      if (gameState.turnTimeLeft > 0) {
        const interval = setInterval(() => {
          setGameState(prev => {
            const newTime = Math.max(0, prev.turnTimeLeft - 50);
            return { ...prev, turnTimeLeft: newTime };
          });
        }, 50);
        return () => clearInterval(interval);
      } else {
        // Time expired - auto resolve with current selections
        setMessage("CRITICAL: SYSTEMS LOCKED");
        // Auto-launch even if not ready
        setTimeout(() => {
          if (gameState.phase === GamePhase.PLANNING) {
            resolveTurn();
          }
        }, 1000);
      }
    }
  }, [gameState.phase, gameState.turnTimeLeft]);

  // Reset selections each round and check for HP allocation
  useEffect(() => {
    if (gameState.phase === GamePhase.PLANNING) {
      setSelectedDefenses([]);
      setSelectedTargets([]);

      // Update last_played_at when game starts
      updateLastPlayedAt(player.id);
      updateLastPlayedAt(enemy.id);

      // Check if player has HP to allocate
      if (player.pendingHP > 0) {
        setIsAllocatingHP(true);
        setMessage(`ALLOCATE +${player.pendingHP} HP - TAP A SILO`);
      } else {
        setIsAllocatingHP(false);
        setMessage("TAP SILOS TO DEFEND & ATTACK");
      }
    }
  }, [gameState.phase, gameState.currentTurn, player.pendingHP, player.id, enemy.id]);

  // Play beep sound using Web Audio API
  const playBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Beep configuration
      oscillator.frequency.value = 900; // Hz - adjust for pitch
      oscillator.type = 'sine'; // Clean sine wave

      // Volume envelope (fade out quickly)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      // Play for 100ms
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('Error playing beep:', error);
    }
  }, []);

  // Play victory sound - ascending pleasant tones
  const playVictorySound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6 - major chord ascending

      notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const startTime = audioContext.currentTime + (index * 0.15);
        gainNode.gain.setValueAtTime(0.1, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);
      });
    } catch (error) {
      console.error('Error playing victory sound:', error);
    }
  }, []);

  // Play missiles launch sound - 3 rapid shots
  const playMissilesSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create 3 rapid missile "whoosh" sounds
      [0, 0.15, 0.3].forEach((delay) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Descending whoosh sound
        const startTime = audioContext.currentTime + delay;
        oscillator.frequency.setValueAtTime(800, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, startTime + 0.2);
        oscillator.type = 'sawtooth';

        // Volume envelope
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.2);
      });
    } catch (error) {
      console.error('Error playing missiles sound:', error);
    }
  }, []);

  // Play explosion sound - deep boom
  const playExplosionSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Low frequency rumble for explosion
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Deep boom that decays
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.5);
      oscillator.type = 'triangle';

      // Sharp attack, slow decay
      gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing explosion sound:', error);
    }
  }, []);

  // Play defeat sound - descending dramatic tones
  const playDefeatSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [392, 349, 294, 220]; // G4, F4, D4, A3 - descending dramatic

      notes.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sawtooth'; // More dramatic than sine

        const startTime = audioContext.currentTime + (index * 0.2);
        gainNode.gain.setValueAtTime(0.1, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 1);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.4);
      });
    } catch (error) {
      console.error('Error playing defeat sound:', error);
    }
  }, []);

  // Timer pop animation - trigger when second changes
  useEffect(() => {
    const currentSec = Math.floor(gameState.turnTimeLeft / 1000);
    if (currentSec !== lastSecond && gameState.phase === GamePhase.PLANNING) {
      setLastSecond(currentSec);
      setIsPopping(true);

      // Play beep sound - rapid beeping from 2.00 to 0.00
      if (currentSec <= 1) {
        // From 2→1 and 1→0: continuous rapid beeping (6 beeps per transition for smoothness)
        for (let i = 0; i < 6; i++) {
          setTimeout(() => playBeep(), i * 180); // 180ms apart = ~5.5 beeps per second, 12 total
        }
      } else {
        // Normal beep for other seconds
        playBeep();
      }

      // Clear any existing timer before setting a new one
      if (popTimerRef.current) {
        clearTimeout(popTimerRef.current);
      }

      // Set new timer to remove animation class after 300ms
      popTimerRef.current = setTimeout(() => {
        setIsPopping(false);
        popTimerRef.current = null;
      }, 300);
    }
  }, [gameState.turnTimeLeft, lastSecond, gameState.phase, playBeep]);

  // Cleanup timer on unmount only
  useEffect(() => {
    return () => {
      if (popTimerRef.current) {
        clearTimeout(popTimerRef.current);
      }
    };
  }, []);

  // Play victory/defeat sound when game ends
  useEffect(() => {
    if (gameState.phase === GamePhase.GAME_OVER) {
      const isWin = gameState.winner === player.id;
      const isDraw = gameState.winner === 'TIE';

      // Don't play sound for draws
      if (!isDraw) {
        if (isWin) {
          playVictorySound();
        } else {
          playDefeatSound();
        }
      }
    }
  }, [gameState.phase, gameState.winner, player.id, playVictorySound, playDefeatSound]);

  // Auto-transition from MATCHMAKING to PLANNING after 2.5 seconds
  useEffect(() => {
    if (gameState.phase === GamePhase.MATCHMAKING) {
      if (matchmakingStartTime === null) {
        setMatchmakingStartTime(Date.now());
      }

      const transitionTimer = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          phase: GamePhase.PLANNING,
          turnTimeLeft: 10000
        }));
        setMatchmakingStartTime(null);
      }, 2500);

      return () => clearTimeout(transitionTimer);
    }
  }, [gameState.phase, matchmakingStartTime, setGameState]);

  // Handle HP allocation
  const handleHPAllocation = (baseId: number) => {
    const base = player.bases[baseId];
    if (base.isDestroyed || base.hp >= 2) return;

    // Allocate 1 HP to this base
    setGameState(prev => {
      const updatedPlayer = { ...prev.player1 };
      updatedPlayer.bases = updatedPlayer.bases.map(b =>
        b.id === baseId ? { ...b, hp: Math.min(2, b.hp + 1) } : b
      );
      updatedPlayer.totalHP += 1;
      updatedPlayer.pendingHP -= 1;

      return { ...prev, player1: updatedPlayer };
    });

    // Update message
    const remaining = player.pendingHP - 1;
    if (remaining > 0) {
      setMessage(`ALLOCATE +${remaining} HP - TAP A SILO TO HEAL`);
    } else {
      setIsAllocatingHP(false);
      setMessage("TAP 2 SILOS TO DEFEND & 3 SILOS TO ATTACK");
    }
  };

  const handleSiloClick = (baseId: number, isOwn: boolean) => {
    if (gameState.phase !== GamePhase.PLANNING) return;

    if (isOwn) {
      const base = player.bases[baseId];
      if (base.isDestroyed) return;

      // If allocating HP, handle that first
      if (isAllocatingHP && player.pendingHP > 0) {
        handleHPAllocation(baseId);
        return;
      }

      // Normal defense selection
      if (selectedDefenses.includes(baseId)) {
        setSelectedDefenses(prev => prev.filter(id => id !== baseId));
      } else if (selectedDefenses.length < 2) {
        setSelectedDefenses(prev => [...prev, baseId]);
      }
    } else {
      // Attack selection
      if (selectedTargets.includes(baseId)) {
        setSelectedTargets(prev => prev.filter(id => id !== baseId));
      } else if (selectedTargets.length < 3) {
        setSelectedTargets(prev => [...prev, baseId]);
      }
    }
  };

  const resolveTurn = useCallback(async () => {
    // If no matchId, use old AI logic for free play
    if (!matchId) {
      // Enemy AI (Random)
      const enemyTargets: number[] = [];
      const enemyShields: number[] = [];

      // Enemy picks 3 UNIQUE targets
      while(enemyTargets.length < 3) {
         const t = Math.floor(Math.random() * 5);
         if (!enemyTargets.includes(t)) {
            enemyTargets.push(t);
         }
      }

      // Enemy shields 2 unique bases
      while(enemyShields.length < 2) {
        const s = Math.floor(Math.random() * 5);
        if(!enemyShields.includes(s)) enemyShields.push(s);
      }

      // Lock in moves & Start Animation
      setGameState(prev => ({ ...prev, phase: GamePhase.RESOLVING }));
      setMessage("LAUNCH DETECTED. MISSILES AWAY.");

      // Show missiles immediately
      setMissileTargets({ player: selectedTargets, enemy: enemyTargets });
      setShowMissiles(true);
      playMissilesSound(); // Play missiles launch sound

      // After 1.5s: Impact + shake
      setTimeout(() => {
        setShake(true);
        setMessage("IMPACT CONFIRMED. ANALYZING DAMAGE.");
        playExplosionSound(); // Play explosion sound on impact
        setTimeout(() => setShake(false), 200);

        // Apply damage and calculate destructions
        setGameState(current => {
          const nextPlayer = { ...current.player1, bases: current.player1.bases.map(b => ({...b})) };
          const nextEnemy = { ...current.player2, bases: current.player2.bases.map(b => ({...b})) };

          // Track bases destroyed this turn for HP rewards
          let playerBasesDestroyedThisTurn = 0;
          let enemyBasesDestroyedThisTurn = 0;

          // Capture the current destroyed count BEFORE applying damage (for animation indices)
          const playerDestroyedBeforeTurn = current.player1.bases.filter(b => b.isDestroyed).length;
          const enemyDestroyedBeforeTurn = current.player2.bases.filter(b => b.isDestroyed).length;

          // Enemy Attacks Player
          enemyTargets.forEach(targetId => {
              const base = nextPlayer.bases[targetId];
              if (base && !selectedDefenses.includes(targetId) && !base.isDestroyed) {
                  base.hp -= 1;
                  if (base.hp <= 0) {
                      base.isDestroyed = true;
                      base.hp = 0;
                      nextPlayer.basesDestroyed += 1;
                      nextPlayer.totalHP -= 2;
                      enemyBasesDestroyedThisTurn += 1;
                  } else {
                      nextPlayer.totalHP -= 1;
                  }
              }
          });

          // Player Attacks Enemy
          selectedTargets.forEach(targetId => {
              const base = nextEnemy.bases[targetId];
              if (base && !enemyShields.includes(targetId) && !base.isDestroyed) {
                  base.hp -= 1;
                  if (base.hp <= 0) {
                      base.isDestroyed = true;
                      base.hp = 0;
                      nextEnemy.basesDestroyed += 1;
                      nextEnemy.totalHP -= 2;
                      playerBasesDestroyedThisTurn += 1;
                  } else {
                      nextEnemy.totalHP -= 1;
                  }
              }
          });

          // Award HP gifts for destroyed bases
          nextPlayer.pendingHP += playerBasesDestroyedThisTurn;
          nextEnemy.pendingHP += enemyBasesDestroyedThisTurn;

          // Store destruction counts AND previous indices for notifications
          setLastTurnDestructions({
            player: enemyBasesDestroyedThisTurn,
            enemy: playerBasesDestroyedThisTurn,
            playerStartIndex: playerDestroyedBeforeTurn,
            enemyStartIndex: enemyDestroyedBeforeTurn
          });

          return {
              ...current,
              player1: nextPlayer,
              player2: nextEnemy,
              phase: current.phase,
              currentTurn: current.currentTurn,
              turnTimeLeft: current.turnTimeLeft,
              winner: null,
              winReason: null,
          };
        });

        setShowMissiles(false);

        // Show destruction notifications if any and trigger animations
        setTimeout(() => {
          setShowDestructionCount(true);

          // Use functional setState to get the latest lastTurnDestructions
          setLastTurnDestructions(latest => {
            // Clear any previous animations first
            setHighlightedIcons({ player: [], enemy: [] });
            setIconsShrinking({ player: [], enemy: [] });

            // Calculate which boxes should be highlighted based on destructions THIS TURN
            // latest.player = player bases destroyed by enemy -> highlight PLAYER's counter
            // latest.enemy = enemy bases destroyed by player -> highlight ENEMY's counter
            const playerHighlights = latest.player > 0
              ? Array.from({ length: latest.player }, (_, i) => latest.playerStartIndex + i)
              : [];
            const enemyHighlights = latest.enemy > 0
              ? Array.from({ length: latest.enemy }, (_, i) => latest.enemyStartIndex + i)
              : [];

            // Only trigger animations if there were actual destructions
            if (playerHighlights.length > 0 || enemyHighlights.length > 0) {
              // Phase 1: Start box pulse animation
              setHighlightedIcons({ player: playerHighlights, enemy: enemyHighlights });

              // Phase 2: After box pulse completes (1200ms = 400ms * 3), start icon shrink
              setTimeout(() => {
                setIconsShrinking({ player: playerHighlights, enemy: enemyHighlights });

                // Clear icon shrink after animation completes (600ms)
                setTimeout(() => {
                  setIconsShrinking({ player: [], enemy: [] });
                }, 600);
              }, 1200);

              // Clear box pulse highlights after animation completes (1200ms)
              setTimeout(() => {
                setHighlightedIcons({ player: [], enemy: [] });
              }, 1200);
            }

            return latest; // Return unchanged state
          });

          // After 2s: Check win condition and transition
          setTimeout(() => {
            setShowDestructionCount(false);

            setGameState(current => {
              const pDestroyed = current.player1.bases.filter(b => b.isDestroyed).length;
              const eDestroyed = current.player2.bases.filter(b => b.isDestroyed).length;

              let nextPhase = GamePhase.PLANNING;
              let winner: string | null = null;
              let winReason: 'BASES_DESTROYED' | 'OPPONENT_FORFEIT' | 'TIE_HP' | 'TIE_COINFLIP' | null = null;

              // Updated player objects with potential streak changes
              let updatedPlayer1 = { ...current.player1 };
              let updatedPlayer2 = { ...current.player2 };

              if (pDestroyed >= 3 || eDestroyed >= 3) {
                   nextPhase = GamePhase.GAME_OVER;
                   if (eDestroyed >= 3 && pDestroyed < 3) {
                      // Player 1 wins
                      winner = current.player1.id;
                      winReason = 'BASES_DESTROYED';
                      updatedPlayer1.currentStreak += 1;
                      updatedPlayer1.longestStreak = Math.max(updatedPlayer1.longestStreak, updatedPlayer1.currentStreak);
                      updatedPlayer2.currentStreak = 0;
                      updatedPlayer1.wins += 1;
                      updatedPlayer2.losses += 1;
                      updatedPlayer1.gamesPlayed += 1;
                      updatedPlayer2.gamesPlayed += 1;

                      // Update database with win/loss and balance changes (only for wagered matches)
                      if (current.betAmount > 0) {
                        updateGameResults(current.player1.id, current.player2.id, current.betAmount);
                      }
                   } else if (pDestroyed >= 3 && eDestroyed < 3) {
                      // Player 2 wins
                      winner = current.player2.id;
                      winReason = 'BASES_DESTROYED';
                      updatedPlayer1.currentStreak = 0;
                      updatedPlayer2.currentStreak += 1;
                      updatedPlayer2.longestStreak = Math.max(updatedPlayer2.longestStreak, updatedPlayer2.currentStreak);
                      updatedPlayer1.losses += 1;
                      updatedPlayer2.wins += 1;
                      updatedPlayer1.gamesPlayed += 1;
                      updatedPlayer2.gamesPlayed += 1;

                      // Update database with win/loss and balance changes (only for wagered matches)
                      if (current.betAmount > 0) {
                        updateGameResults(current.player2.id, current.player1.id, current.betAmount);
                      }
                   } else {
                      // Tie
                      winner = 'TIE';
                      winReason = 'TIE_HP';
                      updatedPlayer1.currentStreak = 0;
                      updatedPlayer2.currentStreak = 0;

                      // No balance updates for ties
                   }
              }

              return {
                  ...current,
                  player1: updatedPlayer1,
                  player2: updatedPlayer2,
                  phase: nextPhase,
                  currentTurn: current.currentTurn + 1,
                  turnTimeLeft: 10000,
                  winner,
                  winReason,
              };
            });
          }, 2000);
        }, 200);
      }, 1500); // Close the 1.5s setTimeout

      return; // Exit early for free play
    }

    // MULTIPLAYER MODE: Submit turn to backend
    try {
      console.log(`🎯 Submitting turn for match ${matchId}`);
      setMessage("TRANSMITTING STRIKE COORDINATES...");
      setGameState(prev => ({ ...prev, phase: GamePhase.RESOLVING }));

      // Store moves for later animation
      setSubmittedMoves({ defenses: selectedDefenses, attacks: selectedTargets });

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/game/submit-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          playerId: player.id,
          defenses: selectedDefenses,
          attacks: selectedTargets
        })
      });

      const data = await response.json();

      if (data.status === 'waiting') {
        // Waiting for opponent
        console.log('⏳ Waiting for opponent to submit turn...');
        setMessage("AWAITING ENEMY RESPONSE...");
        setWaitingForOpponent(true);
      } else if (data.turnResolved) {
        // Turn resolved immediately (both players submitted)
        console.log('✅ Turn resolved immediately! Fetching game state...');
        setMessage("AWAITING ENEMY RESPONSE...");
        setWaitingForOpponent(true); // Trigger polling to fetch resolved state
      }
    } catch (error) {
      console.error('❌ Error submitting turn:', error);
      setMessage("TRANSMISSION ERROR. RETRYING...");
      // Revert to planning phase
      setTimeout(() => {
        setGameState(prev => ({ ...prev, phase: GamePhase.PLANNING, turnTimeLeft: 10000 }));
      }, 2000);
    }
  }, [matchId, selectedDefenses, selectedTargets, player.id, setGameState, playMissilesSound, playExplosionSound]);

  const timeSec = Math.floor(gameState.turnTimeLeft / 1000);
  const timeMs = Math.floor((gameState.turnTimeLeft % 1000) / 10);
  const isUrgent = gameState.turnTimeLeft <= 5000;

  // Circle countdown timer (10 seconds) - must match SVG circle radius
  const radius = 13; // Matches the SVG circle r="13"
  const circumference = 2 * Math.PI * radius;
  const progress = gameState.turnTimeLeft / 10000;
  const dashoffset = circumference * (1 - progress);

  // Color transition from green to red
  const colorProgress = 1 - progress; // 0 at start, 1 at end
  const redValue = Math.round(163 + (colorProgress * (239 - 163)));
  const greenValue = Math.round(230 - (colorProgress * (230 - 68)));
  const circleColor = `rgb(${redValue}, ${greenValue}, 53)`;

  // Matchmaking Transition Screen
  if (gameState.phase === GamePhase.MATCHMAKING) {
    return (
      <div className="flex flex-col justify-between h-full w-full max-w-6xl mx-auto px-4 pt-4 pb-2 relative overflow-hidden" style={{ minHeight: 'calc(100vh - 80px)' }}>

        {/* Enemy Section - Slide Down */}
        <div className="w-full flex flex-col gap-2 animate-slide-down">
          <div className="flex justify-between items-start px-1">
            <div className="flex items-center gap-3">
              <FlagIcon countryCode={enemy.countryFlag} width="48px" height="32px" />
              <div>
                <div className="text-red-500 font-bold tracking-wider text-sm md:text-base">
                  {enemy.username}
                </div>
                <div className="text-[10px] text-red-800 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                  DETECTED
                </div>
              </div>
            </div>
          </div>

          {/* Enemy Grid */}
          <div className="relative mt-2">
            <div className="flex justify-center gap-2 md:gap-6">
              {enemy.bases.map(base => (
                <div key={base.id} className="relative w-16 h-24 md:w-24 md:h-32 border-2 border-red-900/30 bg-black flex flex-col items-center justify-center">
                  <div className="text-5xl md:text-6xl animate-spin-slow text-red-700">☢</div>
                  <div className="absolute bottom-1 right-1 text-[8px] font-mono text-red-800">S-{base.id}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Enemy Stats Bar - Slide Left */}
          <div className="w-full max-w-md mx-auto animate-slide-left">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-red-700 font-bold tracking-wider">ENEMY INTEGRITY:</span>
              <span className="text-[11px] text-red-500 font-bold font-mono">100%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-900 border border-red-900/50 relative">
              <div className="h-full bg-gradient-to-r from-red-900 to-red-500" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>

        {/* Center Text */}
        <div className="flex flex-col items-center justify-center gap-3 w-full z-20 my-2">
          <div className="bg-black/90 border-2 border-yellow-400 px-4 py-2 md:px-6 md:py-3 text-yellow-400 font-black text-lg md:text-xl tracking-widest shadow-[0_0_40px_rgba(250,204,21,0.6)] animate-conflict-pulse">
            CONFLICT IMMINENT...
          </div>
          <div className="text-gray-600 text-xs tracking-wider">
            INITIALIZING TACTICAL SYSTEMS
          </div>
        </div>

        {/* Player Section - Slide Up */}
        <div className="w-full flex flex-col gap-2 justify-end animate-slide-up">

          {/* Player Stats Bar - Slide Right */}
          <div className="w-full max-w-md mx-auto animate-slide-right">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-lime-700 font-bold tracking-wider">SYSTEMS INTEGRITY:</span>
              <span className="text-[11px] text-lime-500 font-bold font-mono">100%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-900 border border-lime-900/50 relative">
              <div className="h-full bg-gradient-to-r from-lime-900 to-lime-500" style={{ width: '100%' }}></div>
            </div>
          </div>

          {/* Player Grid */}
          <div className="relative mb-2">
            <div className="flex justify-center gap-2 md:gap-6">
              {player.bases.map(base => (
                <div key={base.id} className="relative w-16 h-24 md:w-24 md:h-32 border-2 border-lime-900 bg-black flex flex-col items-center justify-center">
                  <div className="absolute top-1 left-1 right-1 flex gap-0.5">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-1 flex-1 bg-lime-500" />
                    ))}
                  </div>
                  <div className="text-5xl md:text-6xl animate-spin-slow text-lime-500 mt-3">☢</div>
                  <div className="absolute bottom-1 right-1 text-[8px] font-mono text-lime-800">S-{base.id}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Player Info */}
          <div className="flex justify-between items-end px-1">
            <div className="flex items-center gap-3">
              <FlagIcon countryCode={player.countryFlag} width="48px" height="32px" />
              <div>
                <div className="text-lime-500 font-bold text-sm tracking-wider">{player.username}</div>
                <div className="text-[9px] text-lime-800">COMMANDER STATUS: ONLINE</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game Over Screen
  if (gameState.phase === GamePhase.GAME_OVER) {
     const isWin = gameState.winner === player.id;
     const isDraw = gameState.winner === 'TIE';
     const isFreeMatch = gameState.betAmount === 0;
     const isResignation = gameState.winReason === 'OPPONENT_FORFEIT';

     return (
         <div className="flex flex-col items-center justify-center min-h-screen animate-pulse z-50 relative w-full px-4">
             <h1 className={`text-5xl font-black mb-8 text-center ${isDraw ? 'text-yellow-500' : isWin ? 'text-lime-500' : 'text-red-600'}`}>
                 {isDraw ? 'TACTICAL STALEMATE' : isWin ? (isResignation ? 'OPPONENT RESIGNED' : 'TARGET DESTROYED') : 'MISSION FAILED'}
             </h1>

             {isResignation && isWin && (
               <div className="text-xl text-yellow-400 mb-4 font-bold tracking-wider animate-pulse">
                 ENEMY COMMANDER FLED THE BATTLEFIELD
               </div>
             )}

             {!isFreeMatch && (
               <div className={`text-3xl mb-8 font-bold font-mono ${isDraw ? 'text-yellow-500' : isWin ? 'text-lime-500' : 'text-red-600'}`}>
                   {isDraw ? '0 SOL' : isWin ? `+${(gameState.betAmount * 1.9).toFixed(3)} SOL` : `-${gameState.betAmount.toFixed(3)} SOL`}
               </div>
             )}

             {/* Rematch status message */}
             {rematchStatus && (
               <div className="text-xl mb-6 font-bold text-yellow-400 animate-pulse">
                 {rematchStatus}
                 {rematchCountdown > 0 && ` (${rematchCountdown}s)`}
               </div>
             )}

             {/* Share Victory - Only for wins and registered users */}
             {isWin && !player.isGuest && (
               <div className="flex flex-col items-center mb-6">
                 <div className="text-sm text-gray-400 mb-3 tracking-widest">SHARE WIN:</div>
                 <div className="flex flex-row gap-3 w-64">
                   <button
                     onClick={() => {
                       const winRate = player.gamesPlayed > 0 ? ((player.wins / player.gamesPlayed) * 100).toFixed(1) : '0.0';
                       const solWon = (gameState.betAmount * 1.9).toFixed(2);
                       const shareText = `I just won ${solWon} SOL playing against ${enemy.username} on WARFOG.IO\n\n🔥 ${player.currentStreak} win streak | ${winRate}% overall\n\nJoin WARFOG.IO\n\n#WARFOG #Solana #PvPGaming\nwarfog.io`;
                       const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                       window.open(tweetUrl, '_blank', 'width=550,height=420');
                     }}
                     className="flex-1 py-3 px-4 bg-yellow-900/20 border-2 border-yellow-400 text-yellow-400 font-bold font-mono text-xs tracking-wider hover:bg-yellow-500 hover:text-black transition-all shadow-[0_0_30px_rgba(250,204,21,0.6)] hover:shadow-[0_0_40px_rgba(250,204,21,0.8)] animate-pulse"
                   >
                     SHARE ON X
                   </button>
                   <button
                     onClick={async () => {
                       try {
                         const winRate = player.gamesPlayed > 0 ? ((player.wins / player.gamesPlayed) * 100).toFixed(1) : '0.0';
                         const solWon = (gameState.betAmount * 1.9).toFixed(2);
                         const shareText = `I just won ${solWon} SOL playing against ${enemy.username} on WARFOG.IO\n\n🔥 ${player.currentStreak} win streak | ${winRate}% overall\n\nJoin WARFOG.IO\n\n#WARFOG #Solana #PvPGaming\nwarfog.io`;
                         await navigator.clipboard.writeText(shareText);
                       } catch (err) {
                         console.error('Failed to copy:', err);
                       }
                     }}
                     className="flex-1 py-3 px-4 bg-yellow-900/20 border-2 border-yellow-400 text-yellow-400 font-bold font-mono text-xs tracking-wider hover:bg-yellow-500 hover:text-black transition-all shadow-[0_0_30px_rgba(250,204,21,0.6)] hover:shadow-[0_0_40px_rgba(250,204,21,0.8)] animate-pulse"
                   >
                     COPY LINK
                   </button>
                 </div>
               </div>
             )}

             {isDraw ? (
               <>
                 <button
                    onClick={() => {
                      // Reset game state for rematch
                      setGameState(prev => ({
                        ...prev,
                        phase: GamePhase.PLANNING,
                        currentTurn: 1,
                        turnTimeLeft: 10000,
                        winner: null,
                        winReason: null,
                        player1: {
                          ...prev.player1,
                          bases: createBases(),
                          basesDestroyed: 0,
                          totalHP: 10,
                          pendingHP: 0,
                        },
                        player2: {
                          ...prev.player2,
                          bases: createBases(),
                          basesDestroyed: 0,
                          totalHP: 10,
                          pendingHP: 0,
                        }
                      }));
                    }}
                    className="w-64 py-3 bg-yellow-900/40 border-2 border-yellow-400 text-yellow-400 font-bold hover:bg-yellow-900/60 transition-all mb-3"
                 >{isFreeMatch ? 'REMATCH' : 'REMATCH (0 SOL)'}
                 </button>
                 <button
                    onClick={() => window.location.reload()}
                    className="w-64 py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all mb-6"
                 >RETURN TO LOBBY
                 </button>
               </>
             ) : (
               <>
                 {/* Rematch button - only for wagered matches */}
                 {matchId && !isFreeMatch && (
                   <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rematch/request`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              matchId: matchId,
                              playerId: player.id
                            })
                          });
                          const data = await response.json();

                          if (data.accepted) {
                            // Both players accepted! Navigate to new match
                            console.log('🔄 Rematch accepted! New match:', data.newMatchId);
                            setRematchStatus('MATCH RESTARTING...');
                            setTimeout(() => {
                              window.location.href = `/?matchId=${data.newMatchId}`;
                            }, 1000);
                          } else if (data.status === 'waiting') {
                            // Waiting for opponent - start polling
                            console.log('⏳ Waiting for opponent to accept rematch...');
                            setRematchStatus("WAITING FOR OPPONENT");
                            setRematchCountdown(10);

                            let countdown = 10;
                            const countdownInterval = setInterval(() => {
                              countdown--;
                              setRematchCountdown(countdown);
                              if (countdown <= 0) {
                                clearInterval(countdownInterval);
                                setRematchStatus("OPPONENT DECLINED");
                                setTimeout(() => {
                                  setRematchStatus('');
                                  setRematchCountdown(0);
                                }, 3000);
                              }
                            }, 1000);

                            // Poll for status using dedicated status endpoint
                            const pollInterval = setInterval(async () => {
                              try {
                                const checkResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rematch/status/${matchId}/${player.id}`);
                                const checkData = await checkResponse.json();

                                if (checkData.status === 'accepted' && checkData.newMatchId) {
                                  // Rematch was accepted by both players!
                                  clearInterval(pollInterval);
                                  clearInterval(countdownInterval);
                                  console.log('🔄 Rematch accepted! New match:', checkData.newMatchId);
                                  setRematchStatus('MATCH RESTARTING...');
                                  setRematchCountdown(0);
                                  setTimeout(() => {
                                    window.location.href = `/?matchId=${checkData.newMatchId}`;
                                  }, 1000);
                                } else if (checkData.status === 'pending') {
                                  // Opponent wants rematch! Accept it
                                  const acceptResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rematch/request`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      matchId: matchId,
                                      playerId: player.id
                                    })
                                  });
                                  const acceptData = await acceptResponse.json();

                                  if (acceptData.accepted) {
                                    clearInterval(pollInterval);
                                    clearInterval(countdownInterval);
                                    console.log('🔄 Rematch accepted! New match:', acceptData.newMatchId);
                                    setRematchStatus('MATCH RESTARTING...');
                                    setRematchCountdown(0);
                                    setTimeout(() => {
                                      window.location.href = `/?matchId=${acceptData.newMatchId}`;
                                    }, 1000);
                                  }
                                } else if (checkData.status === 'expired' || checkData.status === 'none') {
                                  // Request expired or was cancelled
                                  clearInterval(pollInterval);
                                  clearInterval(countdownInterval);
                                }
                              } catch (error) {
                                console.error('Poll error:', error);
                              }
                            }, 1000);

                            // Stop polling after 10 seconds
                            setTimeout(() => {
                              clearInterval(pollInterval);
                              clearInterval(countdownInterval);
                            }, 10000);
                          }
                        } catch (error) {
                          console.error('❌ Rematch error:', error);
                          setRematchStatus("REMATCH ERROR");
                          setTimeout(() => {
                            setRematchStatus('');
                          }, 3000);
                        }
                      }}
                      className="w-64 py-3 bg-yellow-900/40 border-2 border-yellow-400 text-yellow-400 font-bold hover:bg-yellow-900/60 transition-all mb-3"
                   >REMATCH ({gameState.betAmount.toFixed(3)} SOL)
                   </button>
                 )}
                 <button
                    onClick={() => window.location.reload()}
                    className="w-64 py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all mb-6"
                 >RETURN TO LOBBY
                 </button>
               </>
             )}

             {/* Victory Streak Display */}
             <div className={`w-64 px-8 py-4 border-2 ${isDraw ? 'border-yellow-400 bg-yellow-900/20' : isWin ? 'border-lime-400 bg-lime-900/20' : 'border-gray-700 bg-gray-900/20'}`}>
               <div className="text-center">
                 <div className="text-xs text-gray-400 tracking-widest">VICTORY STREAK</div>
                 <div className={`text-3xl font-black font-mono ${isDraw ? 'text-yellow-500' : isWin ? 'text-lime-500' : 'text-gray-600'}`}>
                   {player.currentStreak}
                 </div>
               </div>
             </div>
         </div>
     )
  }

  return (
    <div className={`flex flex-col justify-between h-full w-full max-w-6xl mx-auto px-4 pt-4 pb-2 relative ${shake ? 'animate-screen-shake' : ''}`} style={{ minHeight: 'calc(100vh - 80px)' }}>

      {/* --- TOP SECTION: ENEMY --- */}
      <div className="w-full flex flex-col gap-2">
        {/* Enemy Header */}
        <div className="flex justify-between items-start px-1">
          <div className="flex items-center gap-3">
            <FlagIcon countryCode={enemy.countryFlag} width="48px" height="32px" />
            <div>
              <div className="text-red-500 font-bold tracking-wider text-sm md:text-base">
                {enemy.username}
              </div>
              <div className="text-[10px] text-red-800 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                LIVE
              </div>
            </div>
          </div>

          {/* Turn Counter */}
          <div className="text-right opacity-85">
            <div className="text-gray-400 font-bold font-mono tracking-wider">
              <span className="text-lg">TURN</span> <span className="text-2xl">{gameState.currentTurn}</span>
            </div>
          </div>
        </div>

        {/* Enemy Grid */}
        <div className="relative">
          <div className="flex justify-center gap-2 md:gap-6">
            {enemy.bases.map(base => (
              <BaseIcon
                key={base.id}
                base={base}
                isOwn={false}
                isSelected={selectedTargets.includes(base.id)}
                onClick={() => handleSiloClick(base.id, false)}
                mode="attack"
              />
            ))}
          </div>

        {/* Enemy Stats */}
        <div className="w-full max-w-md mx-auto">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-red-700 font-bold tracking-wider mt-2">ENEMY INTEGRITY:</span>
            <span className="text-[11px] text-red-500 font-bold font-mono mt-2">{enemy.totalHP * 10}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-900 border border-red-900/50 relative">
            <div
              className="h-full bg-gradient-to-r from-red-900 to-red-500 transition-all duration-500"
              style={{ width: `${Math.max(0, enemy.totalHP * 10)}%` }}
            ></div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="text-[10px] text-red-700 font-bold tracking-wider">SILOS DESTROYED:</div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-red-500 font-bold font-mono">{enemyDestroyedCount}/3</span>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 border border-red-900 flex items-center justify-center overflow-visible relative ${
                    i < enemyDestroyedCount ? 'bg-red-900/50' : 'bg-black'
                  } ${
                    highlightedIcons.enemy.includes(i) ? 'animate-box-pulse-enemy' : ''
                  }`}
                >
                  {i < enemyDestroyedCount && (
                    <span
                      className={`text-red-500 text-[9px] ${
                        iconsShrinking.enemy.includes(i)
                          ? 'animate-icon-shrink absolute inset-0 flex items-center justify-center'
                          : ''
                      }`}
                    >
                      ⚠
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* --- MIDDLE SECTION: CONTROLS --- */}
      <div className="flex flex-col items-center justify-center gap-3 w-full z-20 my-2">
        {/* Timer */}
        {gameState.phase === GamePhase.PLANNING && gameState.turnTimeLeft > 0 && (
          <div className="relative w-48 h-48">
            <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 30 30">
              <circle cx="15" cy="15" r="13" stroke="currentColor" strokeWidth="1" fill="transparent" className="text-gray-800" />
              <circle
                cx="15"
                cy="15"
                r="13"
                stroke={circleColor}
                strokeWidth="1"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={dashoffset}
                strokeLinecap="butt"
                className="transition-all duration-100 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`text-4xl font-black font-mono leading-none ${isPopping ? 'animate-timer-pop' : ''} ${isUrgent ? 'animate-pulse' : ''}`}
                style={{ color: circleColor }}
              >
                {timeSec.toString().padStart(2, '0')}:{timeMs.toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className={`bg-black/80 border px-4 py-1 font-bold tracking-widest backdrop-blur-sm text-center ${
          isAllocatingHP
            ? 'border-yellow-400 text-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-pulse text-sm md:text-base scale-110'
            : 'border-lime-500/50 text-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.2)] text-[10px] md:text-xs'
        }`}>
          {message}
        </div>
      </div>

      {/* --- BOTTOM SECTION: PLAYER --- */}
      <div className="w-full flex flex-col gap-2 justify-end">

        <div className="relative">
        {/* Player Stats */}
        <div className="w-full max-w-md mx-auto">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-lime-700 font-bold tracking-wider mt-2">SYSTEMS INTEGRITY:</span>
            <span className="text-[11px] text-lime-500 font-bold font-mono mt-2">{player.totalHP * 10}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-900 border border-lime-900/50 relative">
            <div
              className="h-full bg-gradient-to-r from-lime-900 to-lime-500 transition-all duration-500"
              style={{ width: `${Math.max(0, player.totalHP * 10)}%` }}
            ></div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-2 mb-3">
          <div className="text-[10px] text-lime-700 font-bold tracking-wider">SILOS DESTROYED:</div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-lime-500 font-bold font-mono">{playerDestroyedCount}/3</span>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 border border-lime-900 flex items-center justify-center overflow-visible relative ${
                    i < playerDestroyedCount ? 'bg-lime-900/50' : 'bg-black'
                  } ${
                    highlightedIcons.player.includes(i) ? 'animate-box-pulse-player' : ''
                  }`}
                >
                  {i < playerDestroyedCount && (
                    <span
                      className={`text-red-500 text-[9px] ${
                        iconsShrinking.player.includes(i)
                          ? 'animate-icon-shrink absolute inset-0 flex items-center justify-center'
                          : ''
                      }`}
                    >
                      ⚠
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Player Grid */}
          <div className="flex justify-center gap-2 md:gap-6">
            {player.bases.map(base => (
              <BaseIcon
                key={base.id}
                base={base}
                isOwn={true}
                isSelected={selectedDefenses.includes(base.id)}
                onClick={() => handleSiloClick(base.id, true)}
                mode={isAllocatingHP ? "heal" : "defense"}
                isGlowing={isAllocatingHP && !base.isDestroyed && base.hp < 2}
              />
            ))}
          </div>
        </div>

        {/* Player Info */}
        <div className="flex justify-between items-end px-1 mt-1">
          <div className="flex items-center gap-3">
            <FlagIcon countryCode={player.countryFlag} width="48px" height="32px" />
            <div>
              <div className="text-lime-500 font-bold text-sm tracking-wider">{player.username}</div>
              <div className="text-[9px] text-lime-800">COMMANDER STATUS: ONLINE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Missile Animations */}
      {showMissiles && (
        <>
          {/* Player missiles attacking enemy */}
          {missileTargets.player.map((targetId, idx) => (
            <Missile key={`player-${idx}`} fromEnemy={false} targetIndex={targetId} delay={idx * 100} />
          ))}
          {/* Enemy missiles attacking player */}
          {missileTargets.enemy.map((targetId, idx) => (
            <Missile key={`enemy-${idx}`} fromEnemy={true} targetIndex={targetId} delay={idx * 100} />
          ))}
        </>
      )}

      {/* Destruction Count Notifications */}
      {showDestructionCount && (
        <>
          {lastTurnDestructions.player > 0 && (
            <DamageNotification count={lastTurnDestructions.player} isPlayer={false} />
          )}
          {lastTurnDestructions.enemy > 0 && (
            <DamageNotification count={lastTurnDestructions.enemy} isPlayer={true} />
          )}
        </>
      )}
    </div>
  );
}
