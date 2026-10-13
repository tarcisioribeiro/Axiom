/**
 * Login page — aviso de Caps Lock no campo de senha.
 */

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ login: vi.fn(), isLoading: false, error: null }),
}));

vi.mock('@/hooks/use-theme-assets', () => ({
  useThemeAssets: () => ({ logo: '/logo.svg' }),
}));

import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import Login from '@/pages/Login';

function setup() {
  const { container } = render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
  const password = container.querySelector('#password')!;
  const warningVisible = () =>
    container.querySelector('#caps-lock-warning')!.getAttribute('aria-hidden') ===
    'false';
  return { password, warningVisible };
}

describe('Login caps lock warning', () => {
  it('alterna a cada toque no Caps Lock', () => {
    const { password, warningVisible } = setup();
    const capsLock = { key: 'CapsLock' };

    fireEvent.keyDown(password, capsLock);
    fireEvent.keyUp(password, capsLock);
    expect(warningVisible()).toBe(true);

    // Não depende de getModifierState (inconsistente no Chrome/Linux)
    fireEvent.keyDown(password, capsLock);
    fireEvent.keyUp(password, capsLock);
    expect(warningVisible()).toBe(false);
  });

  it('esconde o aviso ao perder o foco', () => {
    const { password, warningVisible } = setup();
    fireEvent.keyDown(password, { key: 'CapsLock' });
    expect(warningVisible()).toBe(true);
    fireEvent.blur(password);
    expect(warningVisible()).toBe(false);
  });
});
