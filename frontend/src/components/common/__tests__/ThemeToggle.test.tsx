vi.mock('@/hooks/use-theme', () => ({
  useTheme: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useTheme } from '@/hooks/use-theme';

const mockUseTheme = useTheme as ReturnType<typeof vi.fn>;

const baseThemeMock = {
  toggle: vi.fn(),
  setDarkVariant: vi.fn(),
  setLightVariant: vi.fn(),
  darkVariant: 'dracula' as const,
  lightVariant: 'alucard' as const,
};

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button', () => {
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: false });
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows "Mudar para Modo Escuro" aria-label when in light mode', () => {
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: false });
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Mudar para Modo Escuro' })
    ).toBeInTheDocument();
  });

  it('shows "Mudar para Modo Claro" aria-label when in dark mode', () => {
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: true });
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Mudar para Modo Claro' })
    ).toBeInTheDocument();
  });

  it('opens dropdown when trigger button is clicked', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: false });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Alucard')).toBeInTheDocument();
    expect(screen.getByText('Catppuccin Latte')).toBeInTheDocument();
    expect(screen.getByText('Dracula')).toBeInTheDocument();
    expect(screen.getByText('Catppuccin Mocha')).toBeInTheDocument();
    expect(screen.getByText('Tokyo Night')).toBeInTheDocument();
    expect(screen.getByText('Gruvbox Dark')).toBeInTheDocument();
    expect(screen.getByText('Cyberpunk')).toBeInTheDocument();
    expect(screen.getByText('Flat Remix')).toBeInTheDocument();
  });

  it('calls setLightVariant("alucard") when Alucard option is clicked', async () => {
    const user = userEvent.setup();
    const setLightVariantFn = vi.fn();
    mockUseTheme.mockReturnValue({
      ...baseThemeMock,
      isDark: true,
      setLightVariant: setLightVariantFn,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Alucard'));
    expect(setLightVariantFn).toHaveBeenCalledWith('alucard');
  });

  it('calls setDarkVariant when a dark variant is clicked', async () => {
    const user = userEvent.setup();
    const setDarkVariantFn = vi.fn();
    mockUseTheme.mockReturnValue({
      ...baseThemeMock,
      isDark: true,
      setDarkVariant: setDarkVariantFn,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Tokyo Night'));
    expect(setDarkVariantFn).toHaveBeenCalledWith('tokyo-night');
  });

  it('applies custom className to the trigger button', () => {
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: false });
    render(<ThemeToggle className="my-custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });

  it('shows checkmark next to active dark variant', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({
      ...baseThemeMock,
      isDark: true,
      darkVariant: 'catppuccin-mocha' as const,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    const catppuccinItem = screen
      .getByText('Catppuccin Mocha')
      .closest('[role="menuitem"]');
    expect(catppuccinItem).toBeInTheDocument();
  });

  it('shows checkmark next to Alucard when light mode is active', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: false });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    const alucardItem = screen.getByText('Alucard').closest('[role="menuitem"]');
    expect(alucardItem).toBeInTheDocument();
  });
});
