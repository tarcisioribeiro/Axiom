vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useTheme } from '@/hooks/use-theme';

const mockUseTheme = useTheme as ReturnType<typeof vi.fn>;

describe('ThemeToggle', () => {
  const toggleFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button', () => {
    mockUseTheme.mockReturnValue({ isDark: false, toggle: toggleFn });
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows "Mudar para Modo Escuro" aria-label when in light mode', () => {
    mockUseTheme.mockReturnValue({ isDark: false, toggle: toggleFn });
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Mudar para Modo Escuro' })
    ).toBeInTheDocument();
  });

  it('shows "Mudar para Modo Claro" aria-label when in dark mode', () => {
    mockUseTheme.mockReturnValue({ isDark: true, toggle: toggleFn });
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Mudar para Modo Claro' })
    ).toBeInTheDocument();
  });

  it('calls toggle when clicked', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({ isDark: false, toggle: toggleFn });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    expect(toggleFn).toHaveBeenCalledOnce();
  });

  it('applies custom className to the button', () => {
    mockUseTheme.mockReturnValue({ isDark: false, toggle: toggleFn });
    render(<ThemeToggle className="my-custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });
});
