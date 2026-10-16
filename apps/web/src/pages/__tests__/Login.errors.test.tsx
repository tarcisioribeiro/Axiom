/**
 * Login page — erro de credenciais vai para toast, não para o card.
 */

const { mockAuthStore, mockToast } = vi.hoisted(() => {
  const store = {
    login: vi.fn(),
    isLoading: false,
    requires2FA: false,
    error: null as string | null,
  };
  return { mockAuthStore: store, mockToast: vi.fn() };
});

vi.mock('@/hooks/use-registration-status', () => ({
  useRegistrationStatus: () => ({ data: { open: true } }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(() => mockAuthStore, { getState: () => mockAuthStore }),
}));

vi.mock('@/hooks/use-toast', () => ({ toast: mockToast }));

vi.mock('@/hooks/use-theme-assets', () => ({
  useThemeAssets: () => ({ logo: '/logo.svg' }),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import Login from '@/pages/Login';

describe('Login error', () => {
  it('mostra o erro de login em toast e não no card', async () => {
    const message = 'Usuário e/ou senha incorreto(s)';
    mockAuthStore.login.mockImplementation(() => {
      mockAuthStore.error = message;
      return Promise.reject(new Error(message));
    });

    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(container.querySelector('#username')!, {
      target: { value: 'user' },
    });
    fireEvent.change(container.querySelector('#password')!, {
      target: { value: 'wrong' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({ title: message, variant: 'destructive' })
    );
    expect(screen.queryByText(message)).toBeNull();
  });
});
