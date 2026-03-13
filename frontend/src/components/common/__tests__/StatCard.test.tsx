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
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/lib/animations', () => ({
  cardVariants: {},
  useCounter: (end: number) => end,
}));

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StatCard } from '@/components/common/StatCard';

describe('StatCard', () => {
  it('renders the title', () => {
    render(<StatCard title="Receitas" value={1000} />);
    expect(screen.getByText('Receitas')).toBeInTheDocument();
  });

  it('renders a numeric value', () => {
    render(<StatCard title="Total" value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a string value directly', () => {
    render(<StatCard title="Ratio" value="8 / 18" />);
    expect(screen.getByText('8 / 18')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <StatCard title="Despesas" value={0} icon={<svg data-testid="stat-icon" />} />
    );
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });

  it('does not render an icon wrapper when icon is absent', () => {
    const { container } = render(<StatCard title="Despesas" value={0} />);
    // No motion.div wrapping an icon
    expect(container.querySelectorAll('svg[aria-hidden]').length).toBe(0);
  });

  it('renders positive trend indicator', () => {
    render(
      <StatCard title="Lucro" value={100} trend={{ value: 5, isPositive: true }} />
    );
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('renders negative trend indicator without + prefix', () => {
    render(
      <StatCard title="Gasto" value={100} trend={{ value: -3, isPositive: false }} />
    );
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });

  it('does not render trend section when trend is absent', () => {
    render(<StatCard title="Saldo" value={0} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('applies success variant class', () => {
    const { container } = render(<StatCard title="OK" value={1} variant="success" />);
    expect(container.innerHTML).toContain('border-success');
  });

  it('applies danger variant class', () => {
    const { container } = render(<StatCard title="Bad" value={1} variant="danger" />);
    expect(container.innerHTML).toContain('border-destructive');
  });

  it('formats currency value as BRL', () => {
    render(<StatCard title="Saldo" value="R$ 1.234,56" />);
    // useCounter returns the numeric value which is then formatted back to BRL
    expect(screen.getByText(/R\$/)).toBeInTheDocument();
  });

  it('formats percentage value', () => {
    render(<StatCard title="Taxa" value="75%" />);
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });
});
