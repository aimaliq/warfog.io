import React, { useState, useMemo } from 'react';
import { Player } from '../types';

interface ShareVictoryProps {
  player: Player;
  enemy: Player;
  betAmount: number;
  basesDestroyed: number;
}

// Convert country code to flag emoji (ISO 3166-1 alpha-2)
const getFlagEmoji = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const ShareVictory: React.FC<ShareVictoryProps> = ({
  player,
  enemy,
  betAmount,
  basesDestroyed,
}) => {
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [copyError, setCopyError] = useState(false);

  // Generate share text based on match type
  const shareText = useMemo(() => {
    const winRate = player.gamesPlayed > 0
      ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
      : '0.0';
    const solWon = (betAmount * 1.9).toFixed(2);
    const isFree = betAmount === 0;
    const currentStreak = player.currentStreak;

    const playerFlag = getFlagEmoji(player.countryFlag);
    const enemyFlag = getFlagEmoji(enemy.countryFlag);

    if (isFree) {
      return `I just won a battle on WARFOG.IO
And now my Rating is ${player.rating} !

🔥 ${currentStreak} win streak | ${winRate}% overall

Join WARFOG.IO

#warfog #sol`;
    }

    return `I just won ${solWon} SOL playing against ${enemy.username} on WARFOG.IO

🔥 ${currentStreak} win streak | ${winRate}% overall

Join WARFOG.IO

#WARFOG #Solana #PvPGaming
warfog.io`;
  }, [player, enemy, betAmount, basesDestroyed]);

  // Share on X/Twitter
  const handleTwitterShare = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(tweetUrl, '_blank', 'width=550,height=420');
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setShowCopySuccess(true);
      setCopyError(false);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  };

  return (
    <div className="flex flex-row gap-3 w-64 mb-6">
      {/* Twitter Share Button */}
      <button
        onClick={handleTwitterShare}
        className="flex-1 py-3 px-4 bg-yellow-900/20 border-2 border-yellow-400 text-yellow-400 font-bold font-mono text-xs tracking-wider hover:bg-yellow-500 hover:text-black transition-all shadow-[0_0_30px_rgba(250,204,21,0.6)] hover:shadow-[0_0_40px_rgba(250,204,21,0.8)] animate-pulse"
      >
        SHARE ON X
      </button>

      {/* Clipboard Copy Button */}
      <button
        onClick={handleCopyToClipboard}
        className={`flex-1 py-3 px-4 font-bold font-mono text-xs tracking-wider transition-all ${
          showCopySuccess
            ? 'bg-lime-500 border-2 border-lime-400 text-black'
            : copyError
            ? 'bg-red-900/20 border-2 border-red-500 text-red-400'
            : 'bg-yellow-900/20 border-2 border-yellow-400 text-yellow-400 hover:bg-yellow-500 hover:text-black shadow-[0_0_30px_rgba(250,204,21,0.6)] hover:shadow-[0_0_40px_rgba(250,204,21,0.8)] animate-pulse'
        }`}
      >
        {showCopySuccess ? '✓ COPIED!' : copyError ? '✗ FAILED' : 'COPY LINK'}
      </button>
    </div>
  );
};