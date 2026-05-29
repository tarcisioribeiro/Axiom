import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// A component that throws when shouldThrow is true
const Bomb = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test explosion');
  }
  return <div data-testid="child">all good</div>;
};

// Suppress console.error for expected errors in these tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders the default error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
  });

  it('shows the retry button in the default error UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(
      screen.getByRole('button', { name: /tentar novamente/i })
    ).toBeInTheDocument();
  });

  it('shows the reload button in the default error UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /recarregar/i })).toBeInTheDocument();
  });

  it('dismisses the error UI after clicking retry when children no longer throw', async () => {
    const user = userEvent.setup();
    // Render boundary with non-throwing children; verify children appear
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();

    // Now inject throwing children via rerender to trigger the error boundary
    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();

    // Provide non-throwing children before retry to ensure recovery succeeds
    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders the custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">custom error</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.queryByText('Algo deu errado')).not.toBeInTheDocument();
  });

  it('calls onError callback when a child throws', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Test explosion');
  });

  it('reload button calls window.location.reload', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    await user.click(screen.getByRole('button', { name: /recarregar/i }));
    expect(reloadMock).toHaveBeenCalled();
  });
});
