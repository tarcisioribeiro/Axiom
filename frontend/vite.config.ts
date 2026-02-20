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
        // Divide chunks por vendor para melhor cache
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react', 'recharts'],
          'form-vendor': ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
    // Aumenta limite de aviso de chunk
    chunkSizeWarningLimit: 1000,
  },
})
