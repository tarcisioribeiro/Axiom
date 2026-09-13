import path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    // PWA — service worker + manifest
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'icon-dark.png', 'icon-light.png', 'logo.png'],
      manifest: {
        name: 'Axiom',
        short_name: 'Axiom',
        description: 'Gestão financeira pessoal inteligente',
        theme_color: '#7c3aed',
        background_color: '#1a1b2e',
        display: 'standalone',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-dark.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Exclude large on-demand chunks (e.g. exceljs) from precache
        globIgnores: ['**/routine-export-*.js'],
        // Cache-first para listas estáticas; network-first para API
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 86400 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Replace react-force-graph's VR/AR sub-packages with no-op stubs.
      // These packages depend on AFRAME and THREE as globals (A-Frame ecosystem)
      // which are never loaded in this app. Since we only use ForceGraph2D,
      // the VR/AR variants are never rendered and can safely be stubbed out.
      '3d-force-graph-vr': path.resolve(__dirname, './src/stubs/kapsule-noop.ts'),
      '3d-force-graph-ar': path.resolve(__dirname, './src/stubs/kapsule-noop.ts'),
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
  esbuild: {
    // Remove console.log/debugger em producao (build) — mantido do terser antigo
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    // Otimizacoes de build
    target: 'es2020',
    sourcemap: false, // Desabilitar sourcemaps em producao
    // esbuild minify (~10x mais rapido que terser, ~1% maior no bundle final)
    minify: 'esbuild',
    rollupOptions: {},
    // Aumenta limite de aviso de chunk
    chunkSizeWarningLimit: 1000,
  },
})
