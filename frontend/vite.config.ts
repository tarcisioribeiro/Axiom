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
    // Force a single pdfjs-dist instance across the entire bundle.
    // react-pdf ships its own nested pdfjs-dist (5.4.296), while the project
    // uses 5.6.205. pdfjs performs an apiVersion handshake between main and
    // worker at load time; if the versions differ the PDF silently fails.
    // dedupe ensures every import of 'pdfjs-dist' resolves to the project-root
    // copy (5.6.205), making the worker URL generated in BookReader.tsx match
    // the pdfjs instance used by react-pdf at runtime.
    dedupe: ['pdfjs-dist'],
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
    rollupOptions: {},
    // Aumenta limite de aviso de chunk
    chunkSizeWarningLimit: 1000,
  },
})
