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
      reporter: ['text', 'html', 'lcov', 'cobertura'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/__tests__/**',
        'src/components/ui/**',
        // Pages are large route-level components — covered by E2E, not unit tests
        'src/pages/**',
        // Service files are thin API-call wrappers — covered by integration tests
        'src/services/**',
        // Feature-specific components depend on API data; tested via integration/E2E
        'src/components/accounts/**',
        'src/components/charts/**',
        'src/components/credit-cards/**',
        'src/components/dashboard/**',
        'src/components/expenses/**',
        'src/components/layout/**',
        'src/components/library/**',
        'src/components/members/**',
        'src/components/notifications/**',
        'src/components/personal-planning/**',
        'src/components/providers/**',
        'src/components/receipts/**',
        'src/components/revenues/**',
        'src/components/security/**',
        'src/components/transfers/**',
        // Type-only and config files with no runtime logic to cover
        'src/types/**',
        'src/i18n/**',
        'src/App.tsx',
      ],
      thresholds: { lines: 30, functions: 40, branches: 50, statements: 30 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
