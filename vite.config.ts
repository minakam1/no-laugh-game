import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/chat/completions': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: () => '/v1/chat/completions',
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
