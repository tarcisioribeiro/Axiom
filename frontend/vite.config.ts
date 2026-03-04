import path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // Apenas arquivos > 1KB
    }),
    // Brotli compression (melhor taxa de compressao)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    // Otimizacoes de build
    sourcemap: false, // Desabilitar sourcemaps em producao
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log em producao
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // Divide chunks por vendor para melhor cache.
        // Usa formato função para capturar sub-pacotes internos (react/jsx-runtime,
        // scheduler, etc.) e garantir a ordem correta de inicialização entre chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (
            id.includes('/framer-motion/') ||
            id.includes('/lucide-react/') ||
            id.includes('/recharts/')
          ) {
            return 'ui-vendor';
          }
          if (
            id.includes('/react-hook-form/') ||
            id.includes('/zod/') ||
            id.includes('/@hookform/')
          ) {
            return 'form-vendor';
          }
        },
      },
    },
    // Aumenta limite de aviso de chunk
    chunkSizeWarningLimit: 1000,
  },
})
