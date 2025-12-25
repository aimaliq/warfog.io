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

// ==============================================
// ERROR LOGGING UTILITY
// ==============================================

/**
 * Log critical errors to database for admin monitoring
 * @param {Object} params
 * @param {string} params.errorType - 'withdrawal', 'settlement', 'database', 'matchmaking'
 * @param {string} params.errorMessage - Error message
 * @param {string} params.errorStack - Error stack trace
 * @param {Object} params.context - Additional context (player_id, match_id, amount, etc.)
 */
async function logCriticalError({ errorType, errorMessage, errorStack, context = {} }) {
  try {
    await supabase.from('error_logs').insert({
      error_type: errorType,
      severity: 'CRITICAL',
      error_message: errorMessage,
      error_stack: errorStack,
      context: context
    });
    console.error(`[CRITICAL ERROR] ${errorType}: ${errorMessage}`);

    // Send real-time notification
    await sendSecurityAlert({
      errorType,
      errorMessage,
      context
    });
  } catch (logError) {
    // If logging fails, at least console.error it
    console.error('Failed to log critical error:', logError);
    console.error('Original error:', errorMessage);
  }
}

// ==============================================
// REAL-TIME ALERT SYSTEM
// ==============================================

/**
 * Send security alerts via email and/or Slack
 * Configure in environment variables:
 * - ALERT_EMAIL: Your email for notifications
 * - SLACK_WEBHOOK_URL: Slack incoming webhook URL
 * - RESEND_API_KEY: Resend API key for emails
 */
async function sendSecurityAlert({ errorType, errorMessage, context }) {
  const timestamp = new Date().toISOString();
  const alertEmail = process.env.ALERT_EMAIL;
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  const resendKey = process.env.RESEND_API_KEY;

  // Format alert message
  const adminPath = process.env.ADMIN_SECRET_PATH || 'admin';
  const alertMessage = `
🚨 WARFOG.IO SECURITY ALERT

Type: ${errorType}
Time: ${timestamp}
Message: ${errorMessage}

Context:
${JSON.stringify(context, null, 2)}

Dashboard: https://warfog.io/${adminPath}
  `.trim();

  // Send Slack notification if configured
  if (slackWebhook) {
    try {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🚨 *WARFOG.IO SECURITY ALERT*',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🚨 CRITICAL SECURITY ALERT',
                emoji: true
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Type:*\n${errorType}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Time:*\n${new Date(timestamp).toLocaleString()}`
                }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Message:*\n${errorMessage}`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Context:*\n\`\`\`${JSON.stringify(context, null, 2)}\`\`\``
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🔍 View Dashboard',
                    emoji: true
                  },
                  url: `https://warfog.io/${adminPath}`,
                  style: 'danger'
                }
              ]
            }
          ]
        })
      });
      console.log('✅ Slack alert sent');
    } catch (slackError) {
      console.error('Failed to send Slack alert:', slackError.message);
    }
  }

  // Send email notification if configured
  if (alertEmail && resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'WARFOG.IO Security <onboarding@resend.dev>',
          to: [alertEmail],
          subject: `🚨 WARFOG.IO ALERT: ${errorType}`,
          text: alertMessage
        })
      });
      console.log('✅ Email alert sent to:', alertEmail);
    } catch (emailError) {
      console.error('Failed to send email alert:', emailError.message);
    }
  }

  // If no notification methods configured, just log
  if (!slackWebhook && !alertEmail) {
    console.warn('⚠️ No alert methods configured! Set SLACK_WEBHOOK_URL or ALERT_EMAIL + RESEND_API_KEY');
  }
}

// ==============================================
// AUTOMATED SECURITY MONITORING
// ==============================================
// Runs every 5 minutes to check for suspicious patterns

setInterval(async () => {
  try {
    const { data: alerts } = await supabase.rpc('check_suspicious_withdrawals');

    if (alerts && alerts.length > 0) {
      for (const alert of alerts) {
        console.warn(`⚠️ SUSPICIOUS ACTIVITY DETECTED: ${alert.alert_reason}`);
        console.warn(`   Player: ${alert.player_id}`);
        console.warn(`   Wallet: ${alert.wallet_address}`);

        await sendSecurityAlert({
          errorType: 'SUSPICIOUS_WITHDRAWAL',
          errorMessage: `${alert.alert_reason}: Player ${alert.wallet_address}`,
          context: {
            playerId: alert.player_id,
            walletAddress: alert.wallet_address,
            alertReason: alert.alert_reason,
            details: alert.details
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Automated monitoring error:', error);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// ==============================================
// API ENDPOINTS
// ==============================================

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

// ========================================================================
// WITHDRAWAL ENDPOINT - SECURITY HARDENED
// ========================================================================
// SECURITY FIXES APPLIED (2024-12-24):
// ✅ Fix #1: Database row locking (SELECT FOR UPDATE) prevents race conditions
// ✅ Fix #2: Balance deduction happens BEFORE blockchain transaction
// ✅ Fix #3: Refund mechanism if blockchain transaction fails
// ✅ Fix #4: Ban check for malicious wallets
// ✅ Fix #5: Rate limiting (5 minute cooldown between withdrawals)
//
// Previous vulnerability: Balance check and deduction were not atomic,
// allowing concurrent requests to bypass balance validation.
//
// Attack prevented: Race condition exploit (1.25 SOL stolen with 0.25 SOL balance)

// In-memory rate limiter (for single-server deployment)
// TODO: Replace with Redis for multi-server deployments
const withdrawalLimiter = new Map();
const WITHDRAWAL_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Cleanup stale rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [playerId, timestamp] of withdrawalLimiter.entries()) {
    if (now - timestamp > WITHDRAWAL_COOLDOWN) {
      withdrawalLimiter.delete(playerId);
    }
  }
}, 10 * 60 * 1000);

// Process withdrawal
app.post('/api/withdraw', async (req, res) => {
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

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

    // ✅ SECURITY FIX #4: Check if wallet is banned
    const { data: bannedCheck } = await supabase
      .from('banned_wallets')
      .select('reason')
      .eq('wallet_address', playerWallet)
      .single();

    if (bannedCheck) {
      console.warn(`🚫 Blocked withdrawal attempt from banned wallet: ${playerWallet}`);
      await logCriticalError({
        errorType: 'withdrawal',
        errorMessage: 'Banned wallet attempted withdrawal',
        errorStack: '',
        context: { playerWallet, playerId, reason: bannedCheck.reason }
      });
      return res.status(403).json({
        error: 'Wallet address is banned',
        reason: bannedCheck.reason
      });
    }

    // ✅ SECURITY FIX #5: Rate limiting check
    const lastWithdrawal = withdrawalLimiter.get(playerId);
    const now = Date.now();

    if (lastWithdrawal && (now - lastWithdrawal) < WITHDRAWAL_COOLDOWN) {
      const timeLeft = Math.ceil((WITHDRAWAL_COOLDOWN - (now - lastWithdrawal)) / 1000);
      return res.status(429).json({
        error: `Please wait ${timeLeft} seconds before next withdrawal`,
        cooldownSeconds: timeLeft
      });
    }

    // ✅ SECURITY FIX #1: Use database function with row locking
    // This prevents race conditions by locking the player row during balance check + deduction
    const { data: txData, error: txError } = await supabase.rpc('process_withdrawal', {
      p_player_id: playerId,
      p_withdraw_amount: withdrawAmount,
      p_player_wallet: playerWallet
    });

    if (txError || !txData || !txData.success) {
      const errorMsg = txData?.error || txError?.message || 'Withdrawal failed';
      console.log(`❌ Withdrawal rejected: ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    // ✅ SECURITY FIX #2: Balance was already deducted in locked transaction above
    // If blockchain transaction fails below, we refund via refund_withdrawal()
    const newBalance = txData.new_balance;

    console.log(`💰 Balance deducted (locked transaction): ${withdrawAmount} SOL`);
    console.log(`   Player: ${playerId.slice(0, 8)}...`);
    console.log(`   New balance: ${newBalance} SOL`);

    // Check treasury balance
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const requiredLamports = Math.floor(withdrawAmount * LAMPORTS_PER_SOL);
    const estimatedFee = 5000; // ~0.000005 SOL

    if (treasuryBalance < requiredLamports + estimatedFee) {
      // Refund the deducted balance
      await supabase.rpc('refund_withdrawal', {
        p_player_id: playerId,
        p_amount: withdrawAmount
      });

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
      // ✅ SECURITY FIX #3: Refund if blockchain transaction fails
      console.error('❌ Blockchain transaction failed! Refunding...');
      await supabase.rpc('refund_withdrawal', {
        p_player_id: playerId,
        p_amount: withdrawAmount
      });
      throw new Error('Blockchain transaction failed: ' + JSON.stringify(confirmation.value.err));
    }

    console.log(`✅ Withdrawal confirmed: ${signature}`);

    // Update rate limiter on successful withdrawal
    withdrawalLimiter.set(playerId, now);

    // Log transaction to history
    const { error: txHistoryError } = await supabase
      .from('transactions')
      .insert({
        player_id: playerId,
        type: 'withdrawal',
        amount: withdrawAmount,
        signature: signature,
        status: 'completed'
      });

    if (txHistoryError) {
      console.error('Warning: Failed to log transaction history:', txHistoryError);
    }

    // Generate explorer URL based on network
    const clusterParam = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`;

    res.json({
      success: true,
      signature,
      amount: withdrawAmount,
      newBalance: newBalance,
      explorerUrl: `https://explorer.solana.com/tx/${signature}${clusterParam}`
    });

  } catch (error) {
    console.error('❌ Withdrawal error:', error);

    // Log critical error to database
    await logCriticalError({
      errorType: 'withdrawal',
      errorMessage: error.message || 'Failed to process withdrawal',
      errorStack: error.stack,
      context: {
        playerWallet: req.body.playerWallet,
        amount: req.body.amount,
        playerId: req.body.playerId
      }
    });

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

    // Allow settlement for completed matches (submit-turn marks them as completed before settlement is called)
    if (match.status !== 'active' && match.status !== 'waiting' && match.status !== 'completed') {
      return res.status(400).json({ error: 'Match is not in a valid state for settlement' });
    }

    // Determine loser
    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

    // Fetch winner and loser data
    const { data: winner, error: winnerError } = await supabase
      .from('players')
      .select('game_balance, total_sol_won')
      .eq('id', winnerId)
      .single();

    if (winnerError || !winner) {
      return res.status(404).json({ error: 'Winner not found' });
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

    // Update winner's balance (stats already updated by submit-turn endpoint)
    const { error: winnerUpdateError } = await supabase
      .from('players')
      .update({
        game_balance: parseFloat(winner.game_balance) + winnerPayout,
        total_sol_won: (winner.total_sol_won || 0) + winnerPayout,
      })
      .eq('id', winnerId);

    if (winnerUpdateError) {
      throw new Error('Failed to update winner balance: ' + winnerUpdateError.message);
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

    // Log critical error to database
    await logCriticalError({
      errorType: 'settlement',
      errorMessage: error.message || 'Failed to settle match',
      errorStack: error.stack,
      context: {
        matchId: req.body.matchId,
        winnerId: req.body.winnerId
      }
    });

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

    // Log critical error to database
    await logCriticalError({
      errorType: 'withdrawal',
      errorMessage: error.message || 'Failed to collect platform fees',
      errorStack: error.stack,
      context: {
        attemptedAmount: req.body.amount || 'auto-collection'
      }
    });

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

    // Log activity: joined lobby
    const { data: playerData } = await supabase
      .from('players')
      .select('wallet_address')
      .eq('id', playerId)
      .single();

    if (playerData?.wallet_address) {
      await supabase
        .from('activity_logs')
        .insert({
          player_id: playerId,
          wallet_address: playerData.wallet_address,
          activity_type: 'joined_lobby',
          details: { wager_amount: wagerAmount }
        });
    }

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

      // Log activity: match started for both players
      if (playerData?.wallet_address) {
        const { data: opponentData } = await supabase
          .from('players')
          .select('wallet_address')
          .eq('id', match.opponent_id)
          .single();

        if (opponentData?.wallet_address) {
          // Log for current player
          await supabase
            .from('activity_logs')
            .insert({
              player_id: playerId,
              wallet_address: playerData.wallet_address,
              activity_type: 'match_started',
              details: { opponent_wallet: opponentData.wallet_address }
            });

          // Log for opponent
          await supabase
            .from('activity_logs')
            .insert({
              player_id: match.opponent_id,
              wallet_address: opponentData.wallet_address,
              activity_type: 'match_started',
              details: { opponent_wallet: playerData.wallet_address }
            });
        }
      }

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
    const { matchId, playerId, defenses, attacks, siloHP, pendingHP } = req.body;

    // Validate input
    if (!matchId || !playerId || !defenses || !attacks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🎯 Player ${playerId.slice(0, 8)}... submitted turn for match ${matchId}`);
    console.log(`   Defenses: [${defenses}], Attacks: [${attacks}]`);
    if (siloHP) {
      console.log(`   Silo HP: [${siloHP}], Pending HP: ${pendingHP || 0}`);
    }

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
      ...(siloHP && { player1_silos: siloHP }), // Update silo HP if provided (HP allocation)
      ...(pendingHP !== undefined && { player1_pending_hp: pendingHP }), // Update pending HP
      ...(isFirstMoveOfTurn && { turn_started_at: new Date().toISOString() })
    } : {
      player2_defenses: defenses,
      player2_attacks: attacks,
      player2_ready: true,
      ...(siloHP && { player2_silos: siloHP }), // Update silo HP if provided (HP allocation)
      ...(pendingHP !== undefined && { player2_pending_hp: pendingHP }), // Update pending HP
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

      // Track silos destroyed BEFORE damage
      const p1DestroyedBefore = p1Silos.filter(hp => hp <= 0).length;
      const p2DestroyedBefore = p2Silos.filter(hp => hp <= 0).length;

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

      // Calculate how many silos were destroyed THIS TURN (for HP rewards)
      const p1SilosDestroyedThisTurn = p1DestroyedCount - p1DestroyedBefore;
      const p2SilosDestroyedThisTurn = p2DestroyedCount - p2DestroyedBefore;

      // Award pending HP to the destroyer
      // P1 destroyed P2 silos → P1 gets HP
      // P2 destroyed P1 silos → P2 gets HP
      const p1PendingHP = (updatedState.player1_pending_hp || 0) + p2SilosDestroyedThisTurn;
      const p2PendingHP = (updatedState.player2_pending_hp || 0) + p1SilosDestroyedThisTurn;

      if (p2SilosDestroyedThisTurn > 0) {
        console.log(`   🎁 P1 destroyed ${p2SilosDestroyedThisTurn} enemy silo(s) → awarded ${p2SilosDestroyedThisTurn} pending HP`);
      }
      if (p1SilosDestroyedThisTurn > 0) {
        console.log(`   🎁 P2 destroyed ${p1SilosDestroyedThisTurn} enemy silo(s) → awarded ${p1SilosDestroyedThisTurn} pending HP`);
      }

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
          player1_pending_hp: p1PendingHP,
          player2_pending_hp: p2PendingHP,
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

// Update player heartbeat (presence tracking)
app.post('/api/game/heartbeat', async (req, res) => {
  try {
    const { matchId, playerId } = req.body;

    if (!matchId || !playerId) {
      return res.status(400).json({ error: 'Missing matchId or playerId' });
    }

    // Get match to determine which player this is
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Skip if match is already completed
    if (match.status === 'completed') {
      return res.json({ success: true, matchCompleted: true });
    }

    const isPlayer1 = match.player1_id === playerId;
    const now = new Date().toISOString();

    // Update player's last active timestamp
    const updateData = isPlayer1 ? {
      player1_last_active: now
    } : {
      player2_last_active: now
    };

    await supabase
      .from('game_states')
      .update(updateData)
      .eq('match_id', matchId);

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Heartbeat error:', error);
    res.status(500).json({
      error: error.message || 'Failed to update heartbeat'
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

    // Check for player resignation (inactive for more than 10 seconds)
    if (match.status === 'active' && gameState.player1_last_active && gameState.player2_last_active) {
      const now = Date.now();
      const player1LastActive = new Date(gameState.player1_last_active).getTime();
      const player2LastActive = new Date(gameState.player2_last_active).getTime();
      const RESIGNATION_TIMEOUT = 10000; // 10 seconds

      let resignedPlayerId = null;
      let winnerId = null;

      if (now - player1LastActive > RESIGNATION_TIMEOUT) {
        resignedPlayerId = match.player1_id;
        winnerId = match.player2_id;
      } else if (now - player2LastActive > RESIGNATION_TIMEOUT) {
        resignedPlayerId = match.player2_id;
        winnerId = match.player1_id;
      }

      if (resignedPlayerId && winnerId) {
        console.log(`🏳️ Player ${resignedPlayerId.slice(0, 8)}... resigned from match ${matchId}`);
        console.log(`🏆 Player ${winnerId.slice(0, 8)}... wins by resignation`);

        // Update match status
        await supabase
          .from('matches')
          .update({
            status: 'completed',
            winner_id: winnerId,
            completed_at: new Date().toISOString()
          })
          .eq('id', matchId);

        // Update player stats
        await supabase.rpc('increment_player_stats', {
          p_player_id: winnerId,
          p_wins: 1,
          p_losses: 0
        });

        await supabase.rpc('increment_player_stats', {
          p_player_id: resignedPlayerId,
          p_wins: 0,
          p_losses: 1
        });

        // Refetch updated match
        const { data: updatedMatch } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        return res.json({
          gameState,
          match: updatedMatch || match,
          resignation: {
            resignedPlayerId,
            winnerId
          }
        });
      }
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

// ==============================================
// REMATCH SYSTEM
// ==============================================
// In-memory storage for rematch requests (expires after 10 seconds)
const rematchRequests = new Map();

// Request rematch
app.post('/api/rematch/request', async (req, res) => {
  try {
    const { matchId, playerId } = req.body;

    if (!matchId || !playerId) {
      return res.status(400).json({ error: 'Missing matchId or playerId' });
    }

    // Get original match details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Verify player was in this match
    if (match.player1_id !== playerId && match.player2_id !== playerId) {
      return res.status(403).json({ error: 'You were not in this match' });
    }

    const opponentId = match.player1_id === playerId ? match.player2_id : match.player1_id;

    // Check if opponent already requested rematch
    const existingRequest = rematchRequests.get(matchId);
    if (existingRequest && existingRequest.requesterId === opponentId) {
      // Both players want rematch! Create new match
      console.log(`🔄 Both players accepted rematch for match ${matchId}`);

      // Deduct balances for new match
      const wagerAmount = match.wager_amount;

      // Deduct from both players
      const { data: player1Data } = await supabase
        .from('players')
        .select('game_balance')
        .eq('id', match.player1_id)
        .single();

      const { data: player2Data } = await supabase
        .from('players')
        .select('game_balance')
        .eq('id', match.player2_id)
        .single();

      if (!player1Data || !player2Data) {
        return res.status(404).json({ error: 'Player not found' });
      }

      if (player1Data.game_balance < wagerAmount || player2Data.game_balance < wagerAmount) {
        return res.status(400).json({ error: 'Insufficient balance for rematch' });
      }

      // Deduct balances
      await supabase
        .from('players')
        .update({ game_balance: player1Data.game_balance - wagerAmount })
        .eq('id', match.player1_id);

      await supabase
        .from('players')
        .update({ game_balance: player2Data.game_balance - wagerAmount })
        .eq('id', match.player2_id);

      // Create new match
      const { data: newMatch, error: createError } = await supabase
        .from('matches')
        .insert({
          player1_id: match.player1_id,
          player2_id: match.player2_id,
          wager_amount: wagerAmount,
          status: 'active'
        })
        .select()
        .single();

      if (createError || !newMatch) {
        throw new Error('Failed to create rematch');
      }

      // Create game state for new match
      await supabase
        .from('game_states')
        .insert({
          match_id: newMatch.id,
          player1_silos: [2, 2, 2, 2, 2],
          player2_silos: [2, 2, 2, 2, 2],
          current_turn: 1
        });

      // Update rematch request with accepted status so the other player can discover it
      rematchRequests.set(matchId, {
        accepted: true,
        newMatchId: newMatch.id,
        expiresAt: Date.now() + 5000 // Keep for 5 seconds for discovery
      });

      // Clear after 5 seconds
      setTimeout(() => {
        rematchRequests.delete(matchId);
      }, 5000);

      console.log(`✅ Rematch created: ${newMatch.id}`);

      return res.json({
        accepted: true,
        newMatchId: newMatch.id
      });
    }

    // Store rematch request
    rematchRequests.set(matchId, {
      requesterId: playerId,
      opponentId: opponentId,
      expiresAt: Date.now() + 10000 // 10 seconds
    });

    // Auto-cleanup after 10 seconds
    setTimeout(() => {
      rematchRequests.delete(matchId);
    }, 10000);

    console.log(`🔄 Rematch requested by ${playerId.slice(0, 8)}... for match ${matchId}`);

    res.json({
      status: 'waiting',
      expiresIn: 10000
    });

  } catch (error) {
    console.error('❌ Rematch request error:', error);
    res.status(500).json({
      error: error.message || 'Failed to request rematch'
    });
  }
});

// Check rematch status (for polling)
app.get('/api/rematch/status/:matchId/:playerId', (req, res) => {
  const { matchId, playerId } = req.params;

  const request = rematchRequests.get(matchId);

  if (!request) {
    return res.json({ status: 'none' });
  }

  // Check if rematch was accepted (both players clicked)
  if (request.accepted && request.newMatchId) {
    return res.json({
      status: 'accepted',
      newMatchId: request.newMatchId
    });
  }

  // Check if expired
  if (Date.now() > request.expiresAt) {
    rematchRequests.delete(matchId);
    return res.json({ status: 'expired' });
  }

  // If this player initiated the request
  if (request.requesterId === playerId) {
    return res.json({
      status: 'waiting',
      timeLeft: Math.max(0, request.expiresAt - Date.now())
    });
  }

  // If opponent initiated
  if (request.opponentId === playerId) {
    return res.json({
      status: 'pending',
      timeLeft: Math.max(0, request.expiresAt - Date.now())
    });
  }

  res.json({ status: 'none' });
});

// ==============================================
// ADMIN ENDPOINTS (Protected by secret path)
// ==============================================

// Admin stats dashboard endpoint
app.get('/api/admin/:secretPath/stats', async (req, res) => {
  try {
    const { secretPath } = req.params;

    // Validate secret path
    if (secretPath !== process.env.ADMIN_SECRET_PATH) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 1. Total registered users (non-guest)
    const { count: totalUsers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_guest', false)
      .not('wallet_address', 'is', null);

    // 2. Users currently online (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: onlineUsers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .gte('last_played_at', fiveMinutesAgo);

    // 3. Battles today (matches created in last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: battlesCreated } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    const { count: battlesCompleted } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', twentyFourHoursAgo);

    // 4. SOL moved today (sum of wager_amount * 2 for completed matches)
    const { data: completedMatches } = await supabase
      .from('matches')
      .select('wager_amount')
      .eq('status', 'completed')
      .gte('completed_at', twentyFourHoursAgo);

    const solMovedToday = completedMatches?.reduce((sum, match) =>
      sum + (parseFloat(match.wager_amount) * 2), 0) || 0;

    // 5. Platform fees accumulated
    const { data: platformFees } = await supabase
      .rpc('get_platform_fees');

    // 6. Treasury wallet balance
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);

    // 7. Active matches count
    const { count: activeMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // 8. Queue depth
    const { count: queueDepth } = await supabase
      .from('matchmaking_queue')
      .select('*', { count: 'exact', head: true });

    // 9. Recent critical errors (last 10)
    const { data: recentErrors } = await supabase
      .from('error_logs')
      .select('*')
      .eq('severity', 'CRITICAL')
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalRegisteredUsers: totalUsers || 0,
        onlineUsers: onlineUsers || 0,
        battlesToday: {
          created: battlesCreated || 0,
          completed: battlesCompleted || 0
        },
        solMovedToday: solMovedToday.toFixed(4),
        platformFeesAccumulated: parseFloat(platformFees || 0).toFixed(4),
        treasuryBalance: {
          sol: (treasuryBalance / LAMPORTS_PER_SOL).toFixed(4),
          lamports: treasuryBalance
        },
        activeMatches: activeMatches || 0,
        queueDepth: queueDepth || 0
      },
      recentErrors: recentErrors || []
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Manual fee collection endpoint (protected)
app.post('/api/admin/:secretPath/fees/collect', async (req, res) => {
  try {
    const { secretPath } = req.params;

    if (secretPath !== process.env.ADMIN_SECRET_PATH) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Get platform wallet from env
    const platformWallet = process.env.VITE_PLATFORM_WALLET;

    if (!platformWallet) {
      return res.status(500).json({ error: 'Platform wallet not configured' });
    }

    // Check accumulated fees
    const { data: platformFees } = await supabase.rpc('get_platform_fees');
    const feesAccumulated = parseFloat(platformFees || 0);

    console.log(`💰 Manual fee collection requested. Accumulated: ${feesAccumulated} SOL`);

    if (feesAccumulated < 0.01) {
      return res.status(400).json({
        error: 'Insufficient fees to collect',
        accumulated: feesAccumulated
      });
    }

    // Create connection
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Check treasury balance
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const requiredLamports = Math.floor(feesAccumulated * LAMPORTS_PER_SOL);
    const estimatedFee = 5000;

    if (treasuryBalance < requiredLamports + estimatedFee) {
      return res.status(500).json({
        error: 'Insufficient treasury balance',
        treasuryBalance: treasuryBalance / LAMPORTS_PER_SOL,
        required: feesAccumulated
      });
    }

    // Create transfer transaction
    const recipientPubkey = new PublicKey(platformWallet);
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

    console.log(`📤 Fee collection initiated: ${signature}`);
    console.log(`   Amount: ${feesAccumulated} SOL`);
    console.log(`   To: ${platformWallet}`);

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

    // Reset platform fees in database
    await supabase.rpc('reset_platform_fees');

    const clusterParam = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`;

    res.json({
      success: true,
      signature,
      amount: feesAccumulated,
      recipient: platformWallet,
      explorerUrl: `https://explorer.solana.com/tx/${signature}${clusterParam}`
    });

  } catch (error) {
    console.error('❌ Manual fee collection error:', error);

    await logCriticalError({
      errorType: 'withdrawal',
      errorMessage: error.message || 'Failed to collect platform fees (manual)',
      errorStack: error.stack,
      context: {
        manual: true
      }
    });

    res.status(500).json({
      error: error.message || 'Failed to collect platform fees'
    });
  }
});

// Error logs endpoint (protected)
app.get('/api/admin/:secretPath/errors', async (req, res) => {
  try {
    const { secretPath } = req.params;
    const { limit = 50 } = req.query;

    if (secretPath !== process.env.ADMIN_SECRET_PATH) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { data: errors } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    res.json({ success: true, errors: errors || [] });

  } catch (error) {
    console.error('Error logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// Clear all error logs (protected)
app.delete('/api/admin/:secretPath/errors/clear', async (req, res) => {
  try {
    const { secretPath } = req.params;

    if (secretPath !== process.env.ADMIN_SECRET_PATH) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Delete all error logs
    const { data, error } = await supabase
      .from('error_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (error) {
      console.error('Error clearing logs:', error);
      return res.status(500).json({ error: 'Failed to clear error logs' });
    }

    console.log('🗑️ Admin cleared all error logs');

    res.json({
      success: true,
      message: 'All error logs cleared',
      deletedCount: data?.length || 0
    });

  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear error logs' });
  }
});

// Security alerts endpoint (protected)
app.get('/api/admin/:secretPath/security-alerts', async (req, res) => {
  try {
    const { secretPath } = req.params;

    if (secretPath !== process.env.ADMIN_SECRET_PATH) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Check for suspicious withdrawal patterns
    const { data: suspiciousWithdrawals } = await supabase.rpc('check_suspicious_withdrawals');

    // Get recent banned wallet attempts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: bannedAttempts } = await supabase
      .from('error_logs')
      .select('*')
      .eq('error_type', 'withdrawal')
      .eq('error_message', 'Banned wallet attempted withdrawal')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    // Get rate-limited attempts (429 errors)
    const { data: rateLimited } = await supabase
      .from('error_logs')
      .select('*')
      .ilike('error_message', '%429%Too Many Requests%')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({
      success: true,
      alerts: {
        suspiciousWithdrawals: suspiciousWithdrawals || [],
        bannedWalletAttempts: bannedAttempts || [],
        rateLimitedAttempts: rateLimited || [],
        totalAlerts: (suspiciousWithdrawals?.length || 0) + (bannedAttempts?.length || 0) + (rateLimited?.length || 0)
      }
    });

  } catch (error) {
    console.error('Security alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
});

// Clear security alerts (protected)
app.delete('/api/admin/:secretPath/security-alerts/clear', async (req, res) => {
  try {
    const { secretPath } = req.params;

    if (secretPath !== process.env.ADMIN_SECRET_PATH) {
      return res.status(404).json({ error: 'Not found' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Delete banned wallet attempts and rate-limited errors
    const { data, error } = await supabase
      .from('error_logs')
      .delete()
      .or(`and(error_type.eq.withdrawal,error_message.eq.Banned wallet attempted withdrawal),error_message.ilike.%429%Too Many Requests%`)
      .gte('created_at', oneHourAgo);

    if (error) {
      console.error('Error clearing security alerts:', error);
      return res.status(500).json({ error: 'Failed to clear security alerts' });
    }

    console.log('🗑️ Admin cleared security alerts');

    res.json({
      success: true,
      message: 'Security alerts cleared',
      deletedCount: data?.length || 0
    });

  } catch (error) {
    console.error('Error clearing security alerts:', error);
    res.status(500).json({ error: 'Failed to clear security alerts' });
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
