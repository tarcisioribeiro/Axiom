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
    useReducedMotion: () => true, // skip animation in tests
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/components/common/EmailVerificationBanner', () => ({
  EmailVerificationBanner: () => null,
}));

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { PageContainer } from '@/components/common/PageContainer';

describe('PageContainer', () => {
  it('renders children', () => {
    render(
      <PageContainer>
        <p data-testid="child">content</p>
      </PageContainer>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies default spacing classes', () => {
    const { container } = render(
      <PageContainer>
        <p>content</p>
      </PageContainer>
    );
    expect(container.firstChild).toHaveClass('space-y-lg');
    expect(container.firstChild).toHaveClass('px-sm');
    expect(container.firstChild).toHaveClass('py-md');
  });

  it('merges additional className', () => {
    const { container } = render(
      <PageContainer className="max-w-xl">
        <p>content</p>
      </PageContainer>
    );
    expect(container.firstChild).toHaveClass('max-w-xl');
  });

  it('renders multiple children', () => {
    render(
      <PageContainer>
        <p data-testid="first">First</p>
        <p data-testid="second">Second</p>
      </PageContainer>
    );
    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.getByTestId('second')).toBeInTheDocument();
  });
});
