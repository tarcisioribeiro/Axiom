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
  };
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StreakBadge } from '@/components/common/StreakBadge';

describe('StreakBadge', () => {
  it('renders the streak count and label (md size)', () => {
    render(<StreakBadge days={7} label="dias seguidos" />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('dias seguidos')).toBeInTheDocument();
  });

  it('renders the best-streak note when provided', () => {
    render(
      <StreakBadge
        days={3}
        label="dias seguidos"
        bestDays={10}
        bestLabel="Melhor sequência"
      />
    );
    expect(screen.getByText(/Melhor sequência: 10/)).toBeInTheDocument();
  });

  it('omits the best-streak note when not provided', () => {
    render(<StreakBadge days={3} label="dias seguidos" />);
    expect(screen.queryByText(/Melhor sequência/)).not.toBeInTheDocument();
  });

  it('renders the compact sm variant without a label', () => {
    render(<StreakBadge days={5} size="sm" pulse />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
