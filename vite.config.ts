import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Changed from 3003 to avoid conflict with backend
    host: true,
    strictPort: false, // Allow fallback to other ports if 5173 is busy
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});