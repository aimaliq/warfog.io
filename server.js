import express from 'express';
import cors from 'cors';
import { Connection, PublicKey, SystemProgram, Transaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Treasury wallet keypair - FOR DEVNET ONLY!
// In production, this should be stored securely (e.g., AWS KMS, HashiCorp Vault)
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;

if (!TREASURY_PRIVATE_KEY) {
  console.error('ERROR: TREASURY_PRIVATE_KEY not set in .env file');
  console.log('\nTo set up your treasury wallet:');
  console.log('1. Export private key from Phantom wallet');
  console.log('2. Add it to .env: TREASURY_PRIVATE_KEY=your_base58_key');
  console.log('3. Ensure wallet is funded with devnet SOL\n');
  process.exit(1);
}

// Create keypair from private key (supports both base58 string and array format)
let treasuryKeypair;
try {
  // Try base58 string format first (from Phantom export)
  const bs58 = await import('bs58');
  treasuryKeypair = Keypair.fromSecretKey(bs58.default.decode(TREASURY_PRIVATE_KEY));
  console.log('✅ Loaded treasury keypair from base58 string');
} catch (e) {
  // Fallback to array format
  try {
    treasuryKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(TREASURY_PRIVATE_KEY))
    );
    console.log('✅ Loaded treasury keypair from array format');
  } catch (e2) {
    console.error('❌ Invalid TREASURY_PRIVATE_KEY format');
    console.error('Expected: base58 string from Phantom OR array format like [1,2,3,...]');
    process.exit(1);
  }
}

console.log('🏦 Treasury Wallet:', treasuryKeypair.publicKey.toBase58());

// Solana network configuration
const SOLANA_NETWORK = process.env.VITE_SOLANA_NETWORK || 'devnet';
const SOLANA_RPC_URL = process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

console.log('🌐 Network:', SOLANA_NETWORK);
console.log('🔗 RPC URL:', SOLANA_RPC_URL);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    treasuryWallet: treasuryKeypair.publicKey.toBase58(),
    network: SOLANA_NETWORK,
    rpcUrl: SOLANA_RPC_URL
  });
});

// Get treasury balance
app.get('/api/treasury/balance', async (req, res) => {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const balance = await connection.getBalance(treasuryKeypair.publicKey);

    res.json({
      publicKey: treasuryKeypair.publicKey.toBase58(),
      balance: balance / LAMPORTS_PER_SOL,
      lamports: balance
    });
  } catch (error) {
    console.error('Error fetching treasury balance:', error);
    res.status(500).json({ error: 'Failed to fetch treasury balance' });
  }
});

// Process withdrawal
app.post('/api/withdraw', async (req, res) => {
  try {
    const { playerWallet, amount, playerId } = req.body;

    // Validate input
    if (!playerWallet || !amount || !playerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    // Verify player has sufficient balance in database
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('game_balance, wallet_address')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (player.wallet_address !== playerWallet) {
      return res.status(403).json({ error: 'Wallet address mismatch' });
    }

    if (player.game_balance < withdrawAmount) {
      return res.status(400).json({
        error: `Insufficient balance. You have ${player.game_balance} SOL`
      });
    }

    // Create connection to Solana
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Check treasury balance
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const requiredLamports = Math.floor(withdrawAmount * LAMPORTS_PER_SOL);
    const estimatedFee = 5000; // ~0.000005 SOL

    if (treasuryBalance < requiredLamports + estimatedFee) {
      return res.status(500).json({
        error: 'Insufficient treasury balance. Please contact support.',
        treasuryBalance: treasuryBalance / LAMPORTS_PER_SOL
      });
    }

    // Create recipient public key
    const recipientPubkey = new PublicKey(playerWallet);

    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: requiredLamports,
      })
    );

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;

    // Sign and send transaction
    transaction.sign(treasuryKeypair);
    const signature = await connection.sendRawTransaction(transaction.serialize());

    console.log(`📤 Withdrawal initiated: ${signature}`);
    console.log(`   From: ${treasuryKeypair.publicKey.toBase58()}`);
    console.log(`   To: ${playerWallet}`);
    console.log(`   Amount: ${withdrawAmount} SOL`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
    }

    console.log(`✅ Withdrawal confirmed: ${signature}`);

    // Update player balance in database
    const { error: updateError } = await supabase
      .from('players')
      .update({
        game_balance: Math.max(0, player.game_balance - withdrawAmount),
      })
      .eq('id', playerId);

    if (updateError) {
      console.error('Warning: Transaction succeeded but database update failed:', updateError);
      // Transaction already sent, so we return success but log the error
    }

    // Log transaction to history
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        player_id: playerId,
        type: 'withdrawal',
        amount: withdrawAmount,
        signature: signature
      });

    if (txError) {
      console.error('Warning: Failed to log transaction history:', txError);
    }

    // Generate explorer URL based on network
    const clusterParam = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`;

    res.json({
      success: true,
      signature,
      amount: withdrawAmount,
      recipient: playerWallet,
      explorerUrl: `https://explorer.solana.com/tx/${signature}${clusterParam}`
    });

  } catch (error) {
    console.error('❌ Withdrawal error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process withdrawal'
    });
  }
});

// Settle wagered match
app.post('/api/match/settle', async (req, res) => {
  try {
    const { matchId, winnerId } = req.body;

    // Validate input
    if (!matchId || !winnerId) {
      return res.status(400).json({ error: 'Missing matchId or winnerId' });
    }

    // Fetch match details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.status !== 'active' && match.status !== 'waiting') {
      return res.status(400).json({ error: 'Match is not active' });
    }

    // Determine loser
    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

    // Fetch winner and loser data
    const { data: winner, error: winnerError } = await supabase
      .from('players')
      .select('game_balance, total_wins, total_matches')
      .eq('id', winnerId)
      .single();

    const { data: loser, error: loserError } = await supabase
      .from('players')
      .select('total_losses, total_matches')
      .eq('id', loserId)
      .single();

    if (winnerError || !winner || loserError || !loser) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Calculate pot and fee split
    const totalPot = parseFloat(match.wager_amount) * 2;
    const houseRake = parseFloat(process.env.VITE_HOUSE_RAKE) || 0.05; // 5%
    const platformFee = totalPot * houseRake;
    const winnerPayout = totalPot - platformFee;

    console.log(`💰 Settling match ${matchId}`);
    console.log(`   Total pot: ${totalPot} SOL`);
    console.log(`   Winner payout: ${winnerPayout} SOL (95%)`);
    console.log(`   Platform fee: ${platformFee} SOL (5%)`);

    // Update winner's balance and stats
    const { error: winnerUpdateError } = await supabase
      .from('players')
      .update({
        game_balance: parseFloat(winner.game_balance) + winnerPayout,
        total_wins: (winner.total_wins || 0) + 1,
        total_matches: (winner.total_matches || 0) + 1,
      })
      .eq('id', winnerId);

    if (winnerUpdateError) {
      throw new Error('Failed to update winner balance: ' + winnerUpdateError.message);
    }

    // Update loser's stats
    const { error: loserUpdateError } = await supabase
      .from('players')
      .update({
        total_losses: (loser.total_losses || 0) + 1,
        total_matches: (loser.total_matches || 0) + 1,
      })
      .eq('id', loserId);

    if (loserUpdateError) {
      console.error('Warning: Failed to update loser stats:', loserUpdateError);
    }

    // Increment platform fees using database function
    const { data: newFees, error: feeError } = await supabase
      .rpc('increment_platform_fees', { amount: platformFee });

    if (feeError) {
      console.error('Warning: Failed to increment platform fees:', feeError);
    } else {
      console.log(`✅ Platform fees accumulated: ${newFees} SOL`);
    }

    // Update match status
    const { error: matchUpdateError } = await supabase
      .from('matches')
      .update({
        status: 'completed',
        winner_id: winnerId,
        ended_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (matchUpdateError) {
      console.error('Warning: Failed to update match status:', matchUpdateError);
    }

    // Remove players from matchmaking queue
    await supabase
      .from('matchmaking_queue')
      .delete()
      .in('player_id', [winnerId, loserId]);

    // Check if platform fees reached threshold for collection
    const feeThreshold = parseFloat(process.env.VITE_FEE_COLLECTION_THRESHOLD) || 5.0;
    if (newFees >= feeThreshold) {
      console.log(`🎯 Platform fees reached threshold (${newFees} >= ${feeThreshold} SOL)`);
      console.log(`📤 Triggering automatic fee collection...`);

      // Trigger fee collection asynchronously (non-blocking)
      const backendUrl = process.env.VITE_BACKEND_URL || `http://localhost:${PORT}`;
      fetch(`${backendUrl}/api/fees/collect`, {
        method: 'POST',
      }).catch(err => {
        console.error('❌ Auto fee collection failed:', err.message);
      });
    }

    res.json({
      success: true,
      matchId,
      winnerId,
      totalPot,
      winnerPayout,
      platformFee,
      platformFeesAccumulated: newFees || 0,
    });

  } catch (error) {
    console.error('❌ Match settlement error:', error);
    res.status(500).json({
      error: error.message || 'Failed to settle match'
    });
  }
});

// Collect platform fees
app.post('/api/fees/collect', async (req, res) => {
  try {
    // Get platform wallet from env
    const platformWallet = process.env.VITE_PLATFORM_WALLET;
    if (!platformWallet) {
      return res.status(500).json({ error: 'Platform wallet not configured' });
    }

    // Get current accumulated fees
    const { data: currentFees, error: feeError } = await supabase
      .rpc('get_platform_fees');

    if (feeError) {
      throw new Error('Failed to get platform fees: ' + feeError.message);
    }

    const feesToCollect = parseFloat(currentFees) || 0;

    if (feesToCollect <= 0) {
      return res.json({
        success: true,
        message: 'No fees to collect',
        amount: 0,
      });
    }

    console.log(`💸 Collecting platform fees: ${feesToCollect} SOL`);

    // Create connection to Solana
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Check treasury balance
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const requiredLamports = Math.floor(feesToCollect * LAMPORTS_PER_SOL);
    const estimatedFee = 5000; // ~0.000005 SOL

    if (treasuryBalance < requiredLamports + estimatedFee) {
      return res.status(500).json({
        error: 'Insufficient treasury balance for fee collection',
        treasuryBalance: treasuryBalance / LAMPORTS_PER_SOL,
        required: feesToCollect,
      });
    }

    // Create platform wallet public key
    const platformPubkey = new PublicKey(platformWallet);

    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: platformPubkey,
        lamports: requiredLamports,
      })
    );

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;

    // Sign and send transaction
    transaction.sign(treasuryKeypair);
    const signature = await connection.sendRawTransaction(transaction.serialize());

    console.log(`📤 Fee collection initiated: ${signature}`);
    console.log(`   From: ${treasuryKeypair.publicKey.toBase58()}`);
    console.log(`   To: ${platformWallet}`);
    console.log(`   Amount: ${feesToCollect} SOL`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
    }

    console.log(`✅ Fee collection confirmed: ${signature}`);

    // Reset platform fees to 0
    const { error: resetError } = await supabase
      .rpc('reset_platform_fees');

    if (resetError) {
      console.error('Warning: Transaction succeeded but fee reset failed:', resetError);
    }

    // Generate explorer URL based on network
    const clusterParam = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`;

    res.json({
      success: true,
      signature,
      amount: feesToCollect,
      recipient: platformWallet,
      explorerUrl: `https://explorer.solana.com/tx/${signature}${clusterParam}`
    });

  } catch (error) {
    console.error('❌ Fee collection error:', error);
    res.status(500).json({
      error: error.message || 'Failed to collect platform fees'
    });
  }
});

// ==============================================
// MATCHMAKING ENDPOINTS
// ==============================================

// Join matchmaking queue
app.post('/api/matchmaking/join', async (req, res) => {
  try {
    const { playerId, wagerAmount } = req.body;

    // Validate input
    if (!playerId || wagerAmount === undefined) {
      return res.status(400).json({ error: 'Missing playerId or wagerAmount' });
    }

    // Validate player balance
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('game_balance')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (player.game_balance < wagerAmount) {
      return res.status(400).json({
        error: `Insufficient balance. You have ${player.game_balance} SOL but need ${wagerAmount} SOL`
      });
    }

    // Deduct balance atomically
    const { error: balanceError } = await supabase
      .from('players')
      .update({ game_balance: player.game_balance - wagerAmount })
      .eq('id', playerId);

    if (balanceError) {
      console.error('Error deducting balance:', balanceError);
      throw balanceError;
    }

    // Add player to queue
    const { error: queueError } = await supabase
      .from('matchmaking_queue')
      .insert({ player_id: playerId, wager_amount: wagerAmount });

    if (queueError) {
      // Rollback balance on queue error
      await supabase
        .from('players')
        .update({ game_balance: player.game_balance })
        .eq('id', playerId);
      console.error('Error joining queue:', queueError);
      throw queueError;
    }

    console.log(`🎮 Player ${playerId} joined queue for ${wagerAmount} SOL`);

    // Attempt instant match using atomic database function
    const { data: matchResult, error: matchError } = await supabase
      .rpc('find_and_create_match', {
        p_player_id: playerId,
        p_wager_amount: wagerAmount
      });

    if (matchError) {
      console.error('Error finding match:', matchError);
      // Player stays in queue even if match finding fails
      return res.json({
        status: 'queued',
        wagerAmount: wagerAmount
      });
    }

    // Check if match was found
    if (matchResult && matchResult.length > 0 && matchResult[0].match_id) {
      const match = matchResult[0];
      console.log(`✅ Instant match found! Match ID: ${match.match_id}`);

      return res.json({
        status: 'matched',
        matchId: match.match_id,
        opponentId: match.opponent_id
      });
    } else {
      // No opponent found, player stays in queue
      console.log(`⏳ No opponent found. Player ${playerId} waiting in queue...`);
      return res.json({
        status: 'queued',
        wagerAmount: wagerAmount
      });
    }

  } catch (error) {
    console.error('❌ Matchmaking join error:', error);
    res.status(500).json({
      error: error.message || 'Failed to join matchmaking'
    });
  }
});

// Leave matchmaking queue
app.post('/api/matchmaking/leave', async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'Missing playerId' });
    }

    // Get queue entry to find wager amount for refund
    const { data: queueEntry, error: queueError } = await supabase
      .from('matchmaking_queue')
      .select('wager_amount')
      .eq('player_id', playerId)
      .single();

    if (queueError || !queueEntry) {
      return res.status(404).json({ error: 'Player not in queue' });
    }

    // Remove from queue
    const { error: deleteError } = await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('player_id', playerId);

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      throw deleteError;
    }

    // Refund balance
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('game_balance')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      console.error('Warning: Player not found for refund:', playerError);
      return res.json({
        success: true,
        refundedAmount: queueEntry.wager_amount,
        warning: 'Removed from queue but could not refund balance'
      });
    }

    const { error: refundError } = await supabase
      .from('players')
      .update({ game_balance: player.game_balance + queueEntry.wager_amount })
      .eq('id', playerId);

    if (refundError) {
      console.error('Error refunding balance:', refundError);
    }

    console.log(`❌ Player ${playerId} left queue. Refunded ${queueEntry.wager_amount} SOL`);

    res.json({
      success: true,
      refundedAmount: queueEntry.wager_amount
    });

  } catch (error) {
    console.error('❌ Leave queue error:', error);
    res.status(500).json({
      error: error.message || 'Failed to leave queue'
    });
  }
});

// ==============================================
// STALE QUEUE CLEANUP (Background Job)
// ==============================================
// Runs every 5 minutes to clean up abandoned queue entries
// Automatically refunds players who have been waiting too long

setInterval(async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Find stale queue entries (older than 5 minutes)
    const { data: staleEntries, error: queryError } = await supabase
      .from('matchmaking_queue')
      .select('player_id, wager_amount')
      .lt('joined_at', fiveMinutesAgo);

    if (queryError) {
      console.error('Error querying stale entries:', queryError);
      return;
    }

    if (!staleEntries || staleEntries.length === 0) {
      return; // No stale entries to clean
    }

    console.log(`🧹 Cleaning ${staleEntries.length} stale queue entries...`);

    for (const entry of staleEntries) {
      try {
        // Get player's current balance
        const { data: player } = await supabase
          .from('players')
          .select('game_balance')
          .eq('id', entry.player_id)
          .single();

        if (player) {
          // Refund balance
          await supabase
            .from('players')
            .update({ game_balance: player.game_balance + entry.wager_amount })
            .eq('id', entry.player_id);

          console.log(`   ↩️  Refunded ${entry.wager_amount} SOL to player ${entry.player_id}`);
        }

        // Remove from queue
        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('player_id', entry.player_id);

      } catch (entryError) {
        console.error(`   ❌ Failed to clean entry for player ${entry.player_id}:`, entryError);
      }
    }

    console.log(`✅ Stale queue cleanup complete`);

  } catch (error) {
    console.error('❌ Stale queue cleanup error:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// ==============================================
// ABANDONED TURN TIMEOUT (Background Job)
// ==============================================
// Runs every 30 seconds to detect abandoned turns
// Auto-forfeits players who don't submit moves within 60 seconds

setInterval(async () => {
  try {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();

    // Find active matches with abandoned turns
    // One player ready, other not ready, and turn started >60 seconds ago
    const { data: gameStates, error: queryError } = await supabase
      .from('game_states')
      .select(`
        *,
        match:matches!game_states_match_id_fkey(*)
      `)
      .lt('turn_started_at', sixtySecondsAgo)
      .neq('player1_ready', 'player2_ready'); // XOR - one true, one false

    if (queryError) {
      console.error('Error querying abandoned turns:', queryError);
      return;
    }

    if (!gameStates || gameStates.length === 0) {
      return; // No abandoned turns
    }

    console.log(`⏰ Found ${gameStates.length} abandoned turn(s)...`);

    for (const state of gameStates) {
      try {
        const match = state.match;

        // Skip if match is already completed
        if (match.status === 'completed') {
          continue;
        }

        // Determine who abandoned (didn't submit)
        const player1Abandoned = !state.player1_ready && state.player2_ready;
        const player2Abandoned = state.player1_ready && !state.player2_ready;

        if (!player1Abandoned && !player2Abandoned) {
          continue; // Both ready or both not ready, skip
        }

        const abandonedPlayerId = player1Abandoned ? match.player1_id : match.player2_id;
        const winnerId = player1Abandoned ? match.player2_id : match.player1_id;

        console.log(`   ⚠️  Player ${abandonedPlayerId.slice(0, 8)}... abandoned turn in match ${match.id}`);
        console.log(`   🏆 Auto-win awarded to ${winnerId.slice(0, 8)}...`);

        // Update match status - winner by forfeit
        await supabase
          .from('matches')
          .update({
            status: 'completed',
            winner_id: winnerId,
            completed_at: new Date().toISOString()
          })
          .eq('id', match.id);

        // Update player stats
        await supabase.rpc('increment_player_stats', {
          p_player_id: winnerId,
          p_wins: 1,
          p_losses: 0
        });

        await supabase.rpc('increment_player_stats', {
          p_player_id: abandonedPlayerId,
          p_wins: 0,
          p_losses: 1
        });

        console.log(`   ✅ Match ${match.id} completed (forfeit)`);

      } catch (entryError) {
        console.error(`   ❌ Failed to process abandoned turn for match ${state.match_id}:`, entryError);
      }
    }

  } catch (error) {
    console.error('❌ Abandoned turn cleanup error:', error);
  }
}, 30 * 1000); // Run every 30 seconds

// ==============================================
// GAME SYNCHRONIZATION ENDPOINTS
// ==============================================

// Submit player's turn (defenses + attacks)
app.post('/api/game/submit-turn', async (req, res) => {
  try {
    const { matchId, playerId, defenses, attacks } = req.body;

    // Validate input
    if (!matchId || !playerId || !defenses || !attacks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🎯 Player ${playerId.slice(0, 8)}... submitted turn for match ${matchId}`);
    console.log(`   Defenses: [${defenses}], Attacks: [${attacks}]`);

    // Get current game state
    const { data: gameState, error: gameError } = await supabase
      .from('game_states')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (gameError || !gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    // Get match data to determine which player this is
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const isPlayer1 = match.player1_id === playerId;

    // Check if this is the first move of the turn (start timeout timer)
    const isFirstMoveOfTurn = !gameState.player1_ready && !gameState.player2_ready;

    // Update game state with player's move
    const updateData = isPlayer1 ? {
      player1_defenses: defenses,
      player1_attacks: attacks,
      player1_ready: true,
      ...(isFirstMoveOfTurn && { turn_started_at: new Date().toISOString() })
    } : {
      player2_defenses: defenses,
      player2_attacks: attacks,
      player2_ready: true,
      ...(isFirstMoveOfTurn && { turn_started_at: new Date().toISOString() })
    };

    const { error: updateError } = await supabase
      .from('game_states')
      .update(updateData)
      .eq('match_id', matchId);

    if (updateError) {
      console.error('Error updating game state:', updateError);
      throw updateError;
    }

    // Fetch updated state to check if both players are ready
    const { data: updatedState, error: fetchError } = await supabase
      .from('game_states')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (fetchError || !updatedState) {
      return res.status(500).json({ error: 'Failed to fetch updated state' });
    }

    // If BOTH players ready → RESOLVE TURN
    if (updatedState.player1_ready && updatedState.player2_ready) {
      console.log(`⚔️  Both players ready! Resolving turn ${updatedState.current_turn}`);

      // Calculate hits
      const p1Attacks = updatedState.player1_attacks || [];
      const p2Attacks = updatedState.player2_attacks || [];
      const p1Defenses = updatedState.player1_defenses || [];
      const p2Defenses = updatedState.player2_defenses || [];

      // Update silo arrays
      let p1Silos = [...updatedState.player1_silos];
      let p2Silos = [...updatedState.player2_silos];

      // Player 2 takes damage from Player 1's undefended attacks
      for (const attackTarget of p1Attacks) {
        if (!p2Defenses.includes(attackTarget) && p2Silos[attackTarget] > 0) {
          p2Silos[attackTarget] -= 1;
          console.log(`   💥 P1 hit P2 silo ${attackTarget} (now ${p2Silos[attackTarget]} HP)`);
        }
      }

      // Player 1 takes damage from Player 2's undefended attacks
      for (const attackTarget of p2Attacks) {
        if (!p1Defenses.includes(attackTarget) && p1Silos[attackTarget] > 0) {
          p1Silos[attackTarget] -= 1;
          console.log(`   💥 P2 hit P1 silo ${attackTarget} (now ${p1Silos[attackTarget]} HP)`);
        }
      }

      // Check for game over - game ends when a player loses 3 silos
      const p1DestroyedCount = p1Silos.filter(hp => hp <= 0).length;
      const p2DestroyedCount = p2Silos.filter(hp => hp <= 0).length;

      let winnerId = null;
      let matchStatus = 'active';

      if (p1DestroyedCount >= 3 && p2DestroyedCount >= 3) {
        // Draw - both players lost 3+ silos
        winnerId = null;
        matchStatus = 'completed';
        console.log('   🤝 DRAW! Both players eliminated 3+ silos');
      } else if (p2DestroyedCount >= 3) {
        // Player 1 wins (Player 2 lost 3+ silos)
        winnerId = match.player1_id;
        matchStatus = 'completed';
        console.log(`   🏆 Player 1 (${winnerId.slice(0, 8)}...) WINS! (P2 lost ${p2DestroyedCount} silos)`);
      } else if (p1DestroyedCount >= 3) {
        // Player 2 wins (Player 1 lost 3+ silos)
        winnerId = match.player2_id;
        matchStatus = 'completed';
        console.log(`   🏆 Player 2 (${winnerId.slice(0, 8)}...) WINS! (P1 lost ${p1DestroyedCount} silos)`);
      }

      // Store moves for animation before clearing
      const lastTurnMoves = {
        player1_attacks: p1Attacks,
        player1_defenses: p1Defenses,
        player2_attacks: p2Attacks,
        player2_defenses: p2Defenses
      };

      // Update game state
      await supabase
        .from('game_states')
        .update({
          player1_silos: p1Silos,
          player2_silos: p2Silos,
          current_turn: updatedState.current_turn + 1,
          player1_ready: false,
          player2_ready: false,
          player1_defenses: p1Defenses, // Keep for animation
          player1_attacks: p1Attacks,   // Keep for animation
          player2_defenses: p2Defenses, // Keep for animation
          player2_attacks: p2Attacks,   // Keep for animation
          turn_resolved_at: new Date().toISOString(),
          turn_started_at: new Date().toISOString() // Reset timer for next turn
        })
        .eq('match_id', matchId);

      // If game over, update match status
      if (matchStatus === 'completed') {
        await supabase
          .from('matches')
          .update({
            status: 'completed',
            winner_id: winnerId,
            completed_at: new Date().toISOString()
          })
          .eq('id', matchId);

        // Update player stats
        if (winnerId) {
          const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;

          // Winner stats
          await supabase.rpc('increment_player_stats', {
            p_player_id: winnerId,
            p_wins: 1,
            p_losses: 0
          });

          // Loser stats
          await supabase.rpc('increment_player_stats', {
            p_player_id: loserId,
            p_wins: 0,
            p_losses: 1
          });
        }

        console.log(`✅ Match ${matchId} completed`);
      }

      return res.json({
        status: 'resolved',
        turnResolved: true,
        gameOver: matchStatus === 'completed',
        winnerId: winnerId
      });
    }

    // Only one player ready, waiting for opponent
    res.json({
      status: 'waiting',
      turnResolved: false
    });

  } catch (error) {
    console.error('❌ Submit turn error:', error);
    res.status(500).json({
      error: error.message || 'Failed to submit turn'
    });
  }
});

// Get current game state (for polling)
app.get('/api/game/state/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;

    // Fetch game state
    const { data: gameState, error: gameError } = await supabase
      .from('game_states')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (gameError || !gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }

    // Fetch match data
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({
      gameState,
      match
    });

  } catch (error) {
    console.error('❌ Get game state error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get game state'
    });
  }
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`\n🚀 WARFOG.IO Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 Network: ${SOLANA_NETWORK}`);
  console.log(`\n💡 Endpoints:`);
  console.log(`   GET  /api/health - Check server status`);
  console.log(`   GET  /api/treasury/balance - Get treasury balance`);
  console.log(`   POST /api/withdraw - Process withdrawal`);
  console.log(`   POST /api/match/settle - Settle wagered match`);
  console.log(`   POST /api/fees/collect - Collect platform fees`);
  console.log(`   POST /api/matchmaking/join - Join matchmaking queue`);
  console.log(`   POST /api/matchmaking/leave - Leave matchmaking queue`);
  console.log(`   POST /api/game/submit-turn - Submit player turn`);
  console.log(`   GET  /api/game/state/:matchId - Get game state\n`);
});
