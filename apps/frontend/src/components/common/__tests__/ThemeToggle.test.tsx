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

  it('opens the themes modal with light and dark sections', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: false });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'Temas' }));
    expect(screen.getByText('Temas claros')).toBeInTheDocument();
    expect(screen.getByText('Temas escuros')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alucard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Linux Mint Dark' })).toBeInTheDocument();
  });

  it('calls setLightVariant("alucard") when Alucard is clicked', async () => {
    const user = userEvent.setup();
    const setLightVariantFn = vi.fn();
    mockUseTheme.mockReturnValue({
      ...baseThemeMock,
      isDark: true,
      setLightVariant: setLightVariantFn,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'Temas' }));
    await user.click(screen.getByRole('button', { name: 'Alucard' }));
    expect(setLightVariantFn).toHaveBeenCalledWith('alucard');
  });

  it('calls setDarkVariant when a dark theme is clicked', async () => {
    const user = userEvent.setup();
    const setDarkVariantFn = vi.fn();
    mockUseTheme.mockReturnValue({
      ...baseThemeMock,
      isDark: true,
      setDarkVariant: setDarkVariantFn,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'Temas' }));
    await user.click(screen.getByRole('button', { name: 'Tokyo Night' }));
    expect(setDarkVariantFn).toHaveBeenCalledWith('tokyo-night');
  });

  it('applies custom className to the trigger button', () => {
    mockUseTheme.mockReturnValue({ ...baseThemeMock, isDark: false });
    render(<ThemeToggle className="my-custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('my-custom-class');
  });

  it('marks only the active theme as pressed', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({
      ...baseThemeMock,
      isDark: true,
      darkVariant: 'catppuccin-mocha' as const,
    });
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'Temas' }));
    expect(screen.getByRole('button', { name: 'Catppuccin Mocha' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Alucard' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
