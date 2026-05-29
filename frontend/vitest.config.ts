import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov', 'cobertura'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/__tests__/**',
        // Storybook story files — not unit-tested; covered by Storybook visual tests
        'src/**/*.stories.tsx',
        'src/components/ui/**',
        // Pages without unit tests are covered by E2E; only Expenses/Accounts/Dashboard have unit tests
        'src/pages/!(Expenses|Accounts|Dashboard).tsx',
        // Admin pages — no unit tests yet; covered by E2E/integration tests
        'src/pages/admin/**',
        // Admin route guard — covered by E2E
        'src/components/common/AdminRoute.tsx',
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
        'src/components/loans/**',
        'src/components/members/**',
        'src/components/notifications/**',
        'src/components/payables/**',
        'src/components/nutrition/**',
        'src/components/personal-planning/**',
        'src/components/providers/**',
        'src/components/workout/**',
        'src/components/receipts/**',
        'src/components/revenues/**',
        'src/components/security/**',
        'src/components/transfers/**',
        'src/components/pdf/**',
        'src/components/receivables/**',
        'src/components/today-tasks/**',
        'src/components/two-factor/**',
        'src/components/user-profile/**',
        'src/components/vaults/**',
        // UI utility components without standalone unit tests
        'src/components/common/ExportModal.tsx',
        'src/components/common/EnvironmentBanner.tsx',
        'src/components/common/RouteProgressBar.tsx',
        'src/components/common/Skeleton.tsx',
        'src/components/common/StatementExportModal.tsx',
        // Barrel re-export files with no logic
        'src/components/common/DataTable/index.ts',
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
        'src/hooks/use-loans-page.ts',
        'src/hooks/use-offline-export.ts',
        'src/hooks/use-payables-page.ts',
        'src/hooks/use-receipt-generator.ts',
        'src/hooks/use-revenues-page.tsx',
        'src/hooks/use-sidebar.ts',
        'src/hooks/use-scroll-animation.ts',
        'src/hooks/use-statement-pdf.ts',
        'src/hooks/use-theme-assets.ts',
        'src/hooks/use-theme.ts',
        'src/hooks/use-toast.ts',
        'src/hooks/use-today-tasks.ts',
        'src/hooks/use-vault-status.ts',
        // Feature-specific lib utilities used only by excluded feature components
        'src/lib/chart-colors.ts',
        'src/lib/chart-formatters.ts',
        'src/lib/chart-types.ts',
        'src/lib/offline-export.ts',
        'src/lib/receipt-utils.ts',
        'src/lib/sentry.ts',
        'src/lib/statement-pdf.ts',
        // Zod validation schemas — type-level declarations, no branching logic
        'src/lib/validations.ts',
        // General-purpose helpers used by excluded feature components; hard to unit-test in isolation
        'src/lib/helpers.ts',
        // Feature-specific config (no runtime logic relevant to unit tests)
        'src/config/breadcrumb.ts',
        'src/config/chart-dimensions.ts',
        'src/config/chart-type.ts',
        'src/config/commands.ts',
        'src/config/nav-config.ts',
        'src/config/theme-assets.ts',
        // Feature-specific stores used only by excluded feature components
        'src/stores/notifications-store.ts',
        // Small error-classification utilities tested implicitly via api-client
        'src/utils/**',
      ],
      thresholds: { lines: 55, functions: 50, branches: 50, statements: 55 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
