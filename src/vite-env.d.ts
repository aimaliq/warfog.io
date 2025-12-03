/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SOLANA_NETWORK: string
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_PLATFORM_WALLET: string
  readonly VITE_TREASURY_WALLET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
