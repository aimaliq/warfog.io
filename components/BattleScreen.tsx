import { useState, useEffect, useCallback } from 'react';
import { GameState, GamePhase, Base, Player } from '../types';
import { FlagIcon } from './FlagIcon';

interface BattleScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
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
      <div className={`text-2xl font-black ${isPlayer ? 'text-red-500' : 'text-lime-500'} drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]`}>
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
              ? 'border-yellow-400 bg-yellow-900/20 shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-pulse scale-105'
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

export default function BattleScreen({ gameState, setGameState }: BattleScreenProps) {
  const player = gameState.player1;
  const enemy = gameState.player2;

  const [selectedDefenses, setSelectedDefenses] = useState<number[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
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

      // Check if player has HP to allocate
      if (player.pendingHP > 0) {
        setIsAllocatingHP(true);
        setMessage(`ALLOCATE +${player.pendingHP} HP - TAP A SILO TO RE-INFORCE`);
      } else {
        setIsAllocatingHP(false);
        setMessage("TAP SILOS TO DEFEND & ATTACK");
      }
    }
  }, [gameState.phase, gameState.currentTurn, player.pendingHP]);

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

  const resolveTurn = useCallback(() => {
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

    // After 1.5s: Impact + shake
    setTimeout(() => {
      setShake(true);
      setMessage("IMPACT CONFIRMED. ANALYZING DAMAGE.");
      setTimeout(() => setShake(false), 500);

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
          const playerHighlights = latest.enemy > 0
            ? Array.from({ length: latest.enemy }, (_, i) => latest.playerStartIndex + i)
            : [];
          const enemyHighlights = latest.player > 0
            ? Array.from({ length: latest.player }, (_, i) => latest.enemyStartIndex + i)
            : [];

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
                 } else {
                    // Tie
                    winner = 'TIE';
                    winReason = 'TIE_HP';
                    updatedPlayer1.currentStreak = 0;
                    updatedPlayer2.currentStreak = 0;
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
  }, [selectedDefenses, selectedTargets, setGameState]); // Close the useCallback

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

  // Game Over Screen
  if (gameState.phase === GamePhase.GAME_OVER) {
     const isWin = gameState.winner === player.id;

     return (
         <div className="flex flex-col items-center justify-center min-h-screen animate-pulse z-50 relative w-full px-4">
             <h1 className={`text-5xl font-black mb-8 text-center ${isWin ? 'text-lime-500' : 'text-red-600'}`}>
                 {isWin ? 'TARGET DESTROYED' : 'MISSION FAILED'}
             </h1>

             <div className="text-3xl mb-8 font-bold font-mono">
                 {isWin ? '+1.9 SOL' : '-1.0 SOL'}
             </div>
             <div className="flex gap-8 mb-8">
                 <div className="text-center">
                     <div className="text-xs text-lime-500 mb-1">SILOS DESTROYED</div>
                     <div className="text-4xl text-lime-500 font-black">{enemyDestroyedCount}/5</div>
                 </div>
                 <div className="text-center">
                     <div className="text-xs text-lime-500 mb-1">SILOS LOST</div>
                     <div className="text-4xl text-lime-500 font-black">{playerDestroyedCount}/5</div>
                 </div>
             </div>
             <button
                onClick={() => window.location.reload()}
                className="w-64 py-3 bg-lime-900/40 border-2 border-lime-400 text-lime-400 font-bold hover:bg-lime-900/60 transition-all mb-6"
             >RETURN TO LOBBY
             </button>

             {/* Victory Streak Display */}
             <div className={`w-64 px-8 py-4 border-2 ${isWin ? 'border-lime-400 bg-lime-900/20' : 'border-gray-700 bg-gray-900/20'}`}>
               <div className="text-center">
                 <div className="text-xs text-gray-400 tracking-widest">VICTORY STREAK</div>
                 <div className={`text-3xl font-black font-mono ${isWin ? 'text-lime-500' : 'text-gray-600'}`}>
                   {player.currentStreak}
                 </div>
               </div>
             </div>
         </div>
     )
  }

  return (
    <div className={`flex flex-col justify-between h-full w-full max-w-6xl mx-auto px-4 pt-4 pb-2 relative ${shake ? 'translate-x-1 translate-y-1' : ''}`} style={{ minHeight: 'calc(100vh - 80px)' }}>

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
                className={`text-4xl font-black font-mono leading-none ${isUrgent ? 'animate-pulse' : ''}`}
                style={{ color: circleColor }}
              >
                {timeSec.toString().padStart(2, '0')}:{timeMs.toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-black/80 border border-lime-500/50 px-4 py-1 text-lime-400 font-bold tracking-widest shadow-[0_0_20px_rgba(163,230,53,0.2)] backdrop-blur-sm text-center text-[10px] md:text-xs">
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
