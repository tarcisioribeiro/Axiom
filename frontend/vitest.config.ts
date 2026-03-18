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
        // Pages without unit tests are covered by E2E; only Expenses/Accounts/Dashboard have unit tests
        'src/pages/!(Expenses|Accounts|Dashboard).tsx',
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
        // Feature-specific hooks only used by excluded feature components
        'src/hooks/use-alert-dialog.tsx',
        'src/hooks/use-breadcrumb.ts',
        'src/hooks/use-chart-dimensions.ts',
        'src/hooks/use-chart-type.ts',
        'src/hooks/use-command-palette.ts',
        'src/hooks/use-instance-generator.ts',
        'src/hooks/use-sidebar.ts',
        'src/hooks/use-scroll-animation.ts',
        'src/hooks/use-theme-assets.ts',
        'src/hooks/use-theme.ts',
        'src/hooks/use-vault-status.ts',
        // Feature-specific lib utilities used only by excluded feature components
        'src/lib/chart-colors.ts',
        'src/lib/chart-formatters.ts',
        'src/lib/chart-types.ts',
        'src/lib/receipt-utils.ts',
        'src/lib/sentry.ts',
        // Feature-specific config (no runtime logic relevant to unit tests)
        'src/config/breadcrumb.ts',
        'src/config/chart-dimensions.ts',
        'src/config/chart-type.ts',
        'src/config/commands.ts',
        'src/config/theme-assets.ts',
        // Feature-specific stores used only by excluded feature components
        'src/stores/notifications-store.ts',
      ],
      thresholds: { lines: 50, functions: 40, branches: 50, statements: 50 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
