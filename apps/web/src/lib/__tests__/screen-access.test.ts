import { describe, expect, it } from 'vitest';

import { canAccess, canAccessModule, screenForPath } from '@/lib/screen-access';

describe('screenForPath', () => {
  it('casa a rota da tela, abas e detalhes por prefixo', () => {
    expect(screenForPath('/security/passwords')).toBe('security.passwords');
    expect(screenForPath('/transactions/expenses')).toBe('finance.transactions');
    expect(screenForPath('/bank-reconciliation/42')).toBe('finance.accounts');
  });

  it('prefere o prefixo mais longo', () => {
    expect(screenForPath('/vaults/simulator')).toBe('finance.vaults');
    expect(screenForPath('/security/health')).toBe('security.dashboard');
  });

  it('rota fora dos módulos não tem tela', () => {
    expect(screenForPath('/')).toBeUndefined();
    expect(screenForPath('/agents')).toBeUndefined();
    expect(screenForPath('/dashboardx')).toBeUndefined();
  });
});

describe('canAccess', () => {
  const grants = { 'security.passwords': ['view', 'add'], 'finance.accounts': ['add'] };

  it('acesso total (staff) libera tudo', () => {
    expect(canAccess(null, 'security.passwords', 'reveal')).toBe(true);
  });

  it('exige a ação e também "Ver" na tela', () => {
    expect(canAccess(grants, 'security.passwords', 'add')).toBe(true);
    expect(canAccess(grants, 'security.passwords', 'reveal')).toBe(false);
    expect(canAccess(grants, 'finance.accounts', 'add')).toBe(false);
  });

  it('tela sem registro é livre e tela não liberada é negada', () => {
    expect(canAccess(grants, undefined)).toBe(true);
    expect(canAccess(grants, 'intellect.books')).toBe(false);
  });
});

describe('canAccessModule', () => {
  it('libera o módulo com alguma tela com "Ver"', () => {
    const grants = { 'finance.accounts': ['view'], 'security.passwords': ['add'] };
    expect(canAccessModule(grants, 'finance')).toBe(true);
    expect(canAccessModule(grants, 'security')).toBe(false);
    expect(canAccessModule(grants, 'intellect')).toBe(false);
    expect(canAccessModule(null, 'intellect')).toBe(true);
  });
});
