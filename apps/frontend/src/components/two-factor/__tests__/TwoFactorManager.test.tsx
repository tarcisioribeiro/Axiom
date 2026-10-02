vi.mock('@/services/auth-service', () => ({
  authService: {
    getTwoFactorStatus: vi.fn(),
    getTwoFactorSetup: vi.fn(),
    activateTwoFactor: vi.fn(),
    disableTwoFactor: vi.fn(),
  },
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { TwoFactorManager } from '@/components/two-factor/TwoFactorManager';
import ptBR from '@/i18n/locales/pt-BR.json';
import { queryClient } from '@/lib/query-client';
import { authService } from '@/services/auth-service';

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

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

describe('TwoFactorManager', () => {
  it('mantém os códigos de backup na tela e não refaz o setup após ativar', async () => {
    let active = false;
    vi.mocked(authService.getTwoFactorStatus).mockImplementation(() =>
      Promise.resolve({ is_active: active })
    );
    vi.mocked(authService.getTwoFactorSetup).mockImplementation(() =>
      active
        ? Promise.reject(new Error('2FA já está ativado para esta conta.'))
        : Promise.resolve({ secret: 's', qr_code: 'data:,', manual_entry_key: 'KEY' })
    );
    vi.mocked(authService.activateTwoFactor).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      active = true;
      // O api-client invalida todas as queries após qualquer resposta não-GET.
      void queryClient.invalidateQueries();
      return { message: 'ok', backup_codes: ['AAAA-1111'] };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TwoFactorManager />
      </QueryClientProvider>
    );

    await userEvent.type(
      await screen.findByLabelText('Código de confirmação'),
      '123456'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ativar 2FA' }));

    expect(await screen.findByText('Códigos de backup')).toBeTruthy();
    // Status refeito (já ativo) não pode tirar os códigos da tela.
    await waitFor(() =>
      expect(
        vi.mocked(authService.getTwoFactorStatus).mock.calls.length
      ).toBeGreaterThan(1)
    );
    expect(screen.getByText('Códigos de backup')).toBeTruthy();
    expect(authService.getTwoFactorSetup).toHaveBeenCalledTimes(1);
  });
});
