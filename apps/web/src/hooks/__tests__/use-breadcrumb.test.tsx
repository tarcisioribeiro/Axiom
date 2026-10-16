import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useBreadcrumb } from '../use-breadcrumb';

const wrapper =
  (pathname: string) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  );

const labels = (
  breadcrumbs: ReturnType<typeof useBreadcrumb>['breadcrumbs']
): string[] => breadcrumbs.map((b) => b.label);

describe('useBreadcrumb', () => {
  it('resolve módulo, submódulo e página para uma rota do nav-config', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/planning/tasks-goals'),
    });

    expect(labels(result.current.breadcrumbs)).toEqual([
      'Início',
      'Planejamento Pessoal',
      'Rotina Diária',
      'Tarefas e Objetivos',
    ]);
    // Módulo e submódulo apontam pro dashboard do módulo — não ficam sem link.
    expect(result.current.breadcrumbs[1].href).toBe('/planning/dashboard');
    expect(result.current.breadcrumbs[2].href).toBe('/planning/dashboard');
    // Página atual não tem link (é a própria tela).
    expect(result.current.breadcrumbs[3].href).toBeUndefined();
  });

  it('resolve uma página secundária (fora da sidebar) via extraRoutes', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/vaults/simulator'),
    });

    expect(labels(result.current.breadcrumbs)).toEqual([
      'Início',
      'Controle Financeiro',
      'Simulador de Cofre',
    ]);
  });

  it('resolve um item do menu principal (fora dos módulos)', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/webhooks'),
    });

    expect(labels(result.current.breadcrumbs)).toEqual(['Início', 'Webhooks']);
  });

  it('casa o detalhe de conciliação bancária por prefixo, ignorando o :importId', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/bank-reconciliation/some-import-id'),
    });

    expect(labels(result.current.breadcrumbs)).toEqual([
      'Início',
      'Controle Financeiro',
      'Conciliação Bancária',
    ]);
  });

  it('resolve uma aba de uma página com abas (rota aninhada de 1 nível)', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/transactions/revenues'),
    });

    expect(labels(result.current.breadcrumbs)).toEqual([
      'Início',
      'Controle Financeiro',
      'Registros',
      'Receitas',
    ]);
    // Última aba atual não tem link; módulo/submódulo apontam pro dashboard.
    expect(result.current.breadcrumbs[1].href).toBe('/dashboard');
    expect(result.current.breadcrumbs[2].href).toBe('/dashboard');
    expect(result.current.breadcrumbs[3].href).toBeUndefined();
  });

  it('resolve a aba de Treino como último nível', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/planning/workout/sessions'),
    });

    const items = labels(result.current.breadcrumbs);
    expect(items[1]).toBe('Planejamento Pessoal');
    expect(items.at(-1)).toBe('Sessões');
  });

  it('resolve uma sub-aba de 2 níveis (routine > focus-blocks)', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/planning/tasks-goals/routine/focus-blocks'),
    });

    expect(labels(result.current.breadcrumbs)).toEqual([
      'Início',
      'Planejamento Pessoal',
      'Rotina Diária',
      'Tarefas Rotineiras',
      'Blocos de Foco',
    ]);
    // A aba intermediária ("Tarefas Rotineiras") agora tem link pro seu nível.
    expect(result.current.breadcrumbs[3].href).toBe('/planning/tasks-goals/routine');
    expect(result.current.breadcrumbs[4].href).toBeUndefined();
  });

  it('cai só no Início quando a rota não é reconhecida', () => {
    const { result } = renderHook(() => useBreadcrumb(), {
      wrapper: wrapper('/rota/que/nao/existe'),
    });

    expect(labels(result.current.breadcrumbs)).toEqual(['Início']);
  });
});
