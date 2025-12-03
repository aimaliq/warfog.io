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

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`\n🚀 Withdrawal server running on http://localhost:${PORT}`);
  console.log(`📡 Network: ${SOLANA_NETWORK}`);
  console.log(`\n💡 Endpoints:`);
  console.log(`   GET  /api/health - Check server status`);
  console.log(`   GET  /api/treasury/balance - Get treasury balance`);
  console.log(`   POST /api/withdraw - Process withdrawal\n`);
});
