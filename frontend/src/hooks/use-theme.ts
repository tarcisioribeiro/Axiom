import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

export type DarkVariant =
  | 'dracula'
  | 'catppuccin-mocha'
  | 'tokyo-night'
  | 'gruvbox-dark'
  | 'cyberpunk'
  | 'flat-remix';

interface UseThemeReturn {
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** Current theme name */
  theme: Theme;
  /** Active dark variant (only relevant when isDark is true) */
  darkVariant: DarkVariant;
  /** Toggle between dark and light mode */
  toggle: () => void;
  /** Set a specific theme */
  setTheme: (theme: Theme) => void;
  /** Set the active dark variant (also activates dark mode) */
  setDarkVariant: (variant: DarkVariant) => void;
}

const STORAGE_KEY = 'darkMode';
const DARK_VARIANT_KEY = 'darkVariant';
const DEFAULT_DARK_VARIANT: DarkVariant = 'dracula';

function readDarkVariant(): DarkVariant {
  if (typeof window === 'undefined') return DEFAULT_DARK_VARIANT;
  const saved = localStorage.getItem(DARK_VARIANT_KEY);
  if (saved && isValidDarkVariant(saved)) return saved;
  return DEFAULT_DARK_VARIANT;
}

function isValidDarkVariant(value: string): value is DarkVariant {
  return [
    'dracula',
    'catppuccin-mocha',
    'tokyo-night',
    'gruvbox-dark',
    'cyberpunk',
    'flat-remix',
  ].includes(value);
}

function applyDarkVariantAttr(variant: DarkVariant) {
  const root = document.documentElement;
  if (variant === 'dracula') {
    root.removeAttribute('data-dark-theme');
  } else {
    root.setAttribute('data-dark-theme', variant);
  }
}

/**
 * Centralized hook for theme management (Dracula/Alucard + dark variants)
 *
 * Handles:
 * - Reading from localStorage
 * - Falling back to system preference
 * - Smooth transitions when changing themes
 * - Persisting preference to localStorage
 * - Dark mode variant selection (Dracula, Catppuccin Mocha, Tokyo Night, Gruvbox Dark, Cyberpunk, Flat Remix)
 *
 * @example
 * const { isDark, toggle, darkVariant, setDarkVariant } = useTheme();
 */
export function useTheme(): UseThemeReturn {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved !== 'false';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [darkVariant, setDarkVariantState] = useState<DarkVariant>(readDarkVariant);

  const applyTheme = useCallback(
    (dark: boolean, variant: DarkVariant, withTransition = false) => {
      const root = document.documentElement;

      if (withTransition) {
        root.classList.add('theme-transitioning');
      }

      if (dark) {
        root.classList.add('dark');
        applyDarkVariantAttr(variant);
      } else {
        root.classList.remove('dark');
        root.removeAttribute('data-dark-theme');
      }

      if (withTransition) {
        setTimeout(() => {
          root.classList.remove('theme-transitioning');
        }, 300);
      }
    },
    []
  );

  // Apply theme to document on mount and when isDark/darkVariant changes
  useEffect(() => {
    applyTheme(isDark, darkVariant);
  }, [isDark, darkVariant, applyTheme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(STORAGE_KEY) === null) {
        setIsDark(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      applyTheme(next, darkVariant, true);
      return next;
    });
  }, [applyTheme, darkVariant]);

  const setTheme = useCallback(
    (theme: Theme) => {
      const dark = theme === 'dark';
      setIsDark(dark);
      localStorage.setItem(STORAGE_KEY, String(dark));
      applyTheme(dark, darkVariant, true);
    },
    [applyTheme, darkVariant]
  );

  const setDarkVariant = useCallback(
    (variant: DarkVariant) => {
      setDarkVariantState(variant);
      localStorage.setItem(DARK_VARIANT_KEY, variant);
      setIsDark(true);
      localStorage.setItem(STORAGE_KEY, 'true');
      applyTheme(true, variant, true);
    },
    [applyTheme]
  );

  return {
    isDark,
    theme: isDark ? 'dark' : 'light',
    darkVariant,
    toggle,
    setTheme,
    setDarkVariant,
  };
}
