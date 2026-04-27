/**
 * Accessibility regression tests using jest-axe.
 *
 * Ensures common components have no automatically-detectable axe violations.
 * Run: npm run test:coverage
 *
 * Note: jest-axe must be installed — run `npm install` after adding it to
 * package.json.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('framer-motion', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal();
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) =>
          React.forwardRef(
            ({ children, ...props }: React.ComponentPropsWithRef<'div'>, ref) =>
              React.createElement(tag, { ...props, ref }, children)
          ),
      }
    ),
    useReducedMotion: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/lib/animations', () => ({
  cardVariants: {},
  emptyStateVariants: {},
  useCounter: (end: number) => end,
}));

import { render } from '@testing-library/react';
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';

import { EmptyState } from '@/components/common/EmptyState';
import { IconButton } from '@/components/common/IconButton';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { StatCard } from '@/components/common/StatCard';

expect.extend(toHaveNoViolations);

const axe = configureAxe();

describe('Accessibility (axe)', () => {
  it('EmptyState — no violations', async () => {
    const { container } = render(<EmptyState message="Nenhum item encontrado" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('EmptyState with title — no violations', async () => {
    const { container } = render(
      <EmptyState title="Lista vazia" message="Adicione um item para começar" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('LoadingState spinner — no violations', async () => {
    const { container } = render(<LoadingState message="Carregando" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('PageHeader with action — no violations', async () => {
    const { container } = render(
      <PageHeader
        title="Despesas"
        action={{ label: 'Nova Despesa', onClick: vi.fn() }}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SearchInput — no violations', async () => {
    const { container } = render(
      // Wrap in a form to give proper context; SearchInput itself is a labelled input
      <div role="search">
        <label htmlFor="search-field">Buscar</label>
        <SearchInput
          id="search-field"
          value=""
          onValueChange={vi.fn()}
          aria-label="Buscar transações"
        />
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('IconButton — no violations', async () => {
    const { container } = render(
      <IconButton aria-label="Fechar diálogo">✕</IconButton>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('StatCard — no violations', async () => {
    const { container } = render(
      <StatCard
        title="Receitas do mês"
        value="R$ 5.000,00"
        trend={{ value: 10, isPositive: true }}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
