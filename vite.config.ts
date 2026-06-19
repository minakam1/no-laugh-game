import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const FRONTEND_PORT = 3000;
const API_PORT = 1234;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
    open: true,
    proxy: {
      '/api/chat/completions': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        rewrite: () => '/v1/chat/completions',
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
