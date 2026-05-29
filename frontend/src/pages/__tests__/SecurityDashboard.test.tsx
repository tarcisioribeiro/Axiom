// Service mocks — hoisted before imports
vi.mock('@/services/security-dashboard-service', () => ({
  securityDashboardService: {
    getStats: vi.fn(),
  },
}));

vi.mock('@/services/security-vault-service', () => ({
  vaultConfigService: {
    exportVaultZip: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/components/security/VaultGuard', () => ({
  VaultGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/security/VaultHealthSection', () => ({
  VaultHealthSection: () => <div data-testid="vault-health-section" />,
}));

vi.mock('@/components/charts', () => ({
  ChartContainer: () => <div data-testid="chart-container" />,
}));

vi.mock('@/lib/chart-colors', () => ({
  useChartColors: () => ({
    primary: '#8B5CF6',
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  }),
  usePasswordStrengthColors: () => ({
    weak: '#EF4444',
    medium: '#F59E0B',
    strong: '#22C55E',
  }),
}));

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import React from 'react';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import SecurityDashboard from '@/pages/SecurityDashboard';
import { securityDashboardService } from '@/services/security-dashboard-service';
import { vaultConfigService } from '@/services/security-vault-service';

queryClient.setDefaultOptions({ queries: { retry: false } });

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: 'pt-BR',
      fallbackLng: 'pt-BR',
      resources: { 'pt-BR': { translation: ptBR } },
      interpolation: { escapeValue: false },
    });
  }
});

const sampleStats = {
  total_passwords: 12,
  total_stored_cards: 3,
  total_stored_accounts: 5,
  total_archives: 2,
  passwords_by_category: [],
  recent_activity: [],
  items_distribution: [],
  password_strength_distribution: [],
  activities_by_action: [],
  activities_timeline: [],
};

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SecurityDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SecurityDashboard', () => {
  beforeEach(() => {
    queryClient.clear();
    mockToast.mockClear();
    vi.mocked(securityDashboardService.getStats).mockResolvedValue(sampleStats);
    vi.mocked(vaultConfigService.exportVaultZip).mockResolvedValue(undefined);
  });

  it('renders page heading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders passwords count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  it('renders stored cards count', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('renders vault health section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('vault-health-section')).toBeInTheDocument();
    });
  });

  it('calls exportVaultZip when export button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByRole('heading', { level: 1 }));

    const exportButton = screen.getByRole('button', { name: /exportar/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(vaultConfigService.exportVaultZip).toHaveBeenCalledTimes(1);
    });
  });
});
