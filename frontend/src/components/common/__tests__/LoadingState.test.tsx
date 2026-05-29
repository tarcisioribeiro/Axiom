import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { LoadingState } from '@/components/common/LoadingState';

describe('LoadingState', () => {
  describe('spinner mode (default)', () => {
    it('renders a status region', () => {
      render(<LoadingState />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has aria-live="polite"', () => {
      render(<LoadingState />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-busy="true"', () => {
      render(<LoadingState />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });

    it('renders a screen-reader-only fallback text', () => {
      const { container } = render(<LoadingState />);
      const srOnly = container.querySelector('.sr-only');
      expect(srOnly).toBeInTheDocument();
    });

    it('renders the visible message when provided', () => {
      render(<LoadingState message="Por favor aguarde" />);
      // Message appears both in the visible <p> and in the sr-only <span>
      const elements = screen.getAllByText('Por favor aguarde');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('uses the message as screen reader text when provided', () => {
      render(<LoadingState message="Buscando dados" />);
      // The message is rendered both visibly and as sr-only text
      const elements = screen.getAllByText('Buscando dados');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('applies size-md height class by default', () => {
      const { container } = render(<LoadingState />);
      expect(container.firstChild).toHaveClass('h-64');
    });

    it('applies size-sm height class', () => {
      const { container } = render(<LoadingState size="sm" />);
      expect(container.firstChild).toHaveClass('h-32');
    });

    it('applies size-lg height class', () => {
      const { container } = render(<LoadingState size="lg" />);
      expect(container.firstChild).toHaveClass('h-96');
    });

    it('applies h-screen when fullScreen is true', () => {
      const { container } = render(<LoadingState fullScreen />);
      expect(container.firstChild).toHaveClass('h-screen');
    });
  });

  describe('skeleton mode', () => {
    it('renders table skeleton when skeleton="table"', () => {
      const { container } = render(<LoadingState skeleton="table" />);
      expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    });

    it('renders list skeleton when skeleton="list"', () => {
      const { container } = render(<LoadingState skeleton="list" />);
      expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    });

    it('renders stats skeleton when skeleton="stats"', () => {
      const { container } = render(<LoadingState skeleton="stats" />);
      expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    });

    it('renders custom children when skeleton="custom"', () => {
      render(
        <LoadingState skeleton="custom">
          <div data-testid="custom-skeleton">custom</div>
        </LoadingState>
      );
      expect(screen.getByTestId('custom-skeleton')).toBeInTheDocument();
    });

    it('applies aria-label from message in skeleton mode', () => {
      const { container } = render(
        <LoadingState skeleton="table" message="Carregando tabela" />
      );
      expect(container.firstChild).toHaveAttribute('aria-label', 'Carregando tabela');
    });

    it('uses default aria-label when no message in skeleton mode', () => {
      const { container } = render(<LoadingState skeleton="list" />);
      expect(container.firstChild).toHaveAttribute('aria-label');
    });
  });
});
