import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Web Worker поддержка (для Stockfish)
  worker: {
    format: 'es',
  },
  build: {
    // Разбиваем на чанки для лучшей загрузки
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['vue', 'vue-router', 'pinia'],
          chess:   ['chess.js'],
          capacitor: ['@capacitor/core'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
});
