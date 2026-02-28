import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/__tests__/**',
      ],
      // Thresholds are enforced in CI once sufficient coverage exists.
      // Target: 60% lines/functions/branches/statements.
      // Uncomment and raise progressively as test files are added:
      // thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
