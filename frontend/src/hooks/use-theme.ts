import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

export type DarkVariant =
  | 'dracula'
  | 'catppuccin-mocha'
  | 'tokyo-night'
  | 'gruvbox-dark'
  | 'cyberpunk'
  | 'flat-remix'
  | 'everforest';

export type LightVariant =
  | 'alucard'
  | 'catppuccin-latte'
  | 'rose-pine-dawn'
  | 'everforest-light'
  | 'gruvbox-light'
  | 'solarized-light'
  | 'nord-light';

interface UseThemeReturn {
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** Current theme name */
  theme: Theme;
  /** Active dark variant (only relevant when isDark is true) */
  darkVariant: DarkVariant;
  /** Active light variant (only relevant when isDark is false) */
  lightVariant: LightVariant;
  /** Toggle between dark and light mode */
  toggle: () => void;
  /** Set a specific theme */
  setTheme: (theme: Theme) => void;
  /** Set the active dark variant (also activates dark mode) */
  setDarkVariant: (variant: DarkVariant) => void;
  /** Set the active light variant (also activates light mode) */
  setLightVariant: (variant: LightVariant) => void;
}

const STORAGE_KEY = 'darkMode';
const DARK_VARIANT_KEY = 'darkVariant';
const LIGHT_VARIANT_KEY = 'lightVariant';
const DEFAULT_DARK_VARIANT: DarkVariant = 'dracula';
const DEFAULT_LIGHT_VARIANT: LightVariant = 'alucard';

function readDarkVariant(): DarkVariant {
  if (typeof window === 'undefined') return DEFAULT_DARK_VARIANT;
  const saved = localStorage.getItem(DARK_VARIANT_KEY);
  if (saved && isValidDarkVariant(saved)) return saved;
  return DEFAULT_DARK_VARIANT;
}

function readLightVariant(): LightVariant {
  if (typeof window === 'undefined') return DEFAULT_LIGHT_VARIANT;
  const saved = localStorage.getItem(LIGHT_VARIANT_KEY);
  if (saved && isValidLightVariant(saved)) return saved;
  return DEFAULT_LIGHT_VARIANT;
}

function isValidDarkVariant(value: string): value is DarkVariant {
  return [
    'dracula',
    'catppuccin-mocha',
    'tokyo-night',
    'gruvbox-dark',
    'cyberpunk',
    'flat-remix',
    'everforest',
  ].includes(value);
}

function isValidLightVariant(value: string): value is LightVariant {
  return [
    'alucard',
    'catppuccin-latte',
    'rose-pine-dawn',
    'everforest-light',
    'gruvbox-light',
    'solarized-light',
    'nord-light',
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

function applyLightVariantAttr(variant: LightVariant) {
  const root = document.documentElement;
  if (variant === 'alucard') {
    root.removeAttribute('data-light-theme');
  } else {
    root.setAttribute('data-light-theme', variant);
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
 * - Dark mode variant selection (Dracula, Catppuccin Mocha, Tokyo Night, Gruvbox Dark, Cyberpunk, Flat Remix, Everforest)
 * - Light mode variant selection (Alucard, Catppuccin Latte, Rosé Pine Dawn, Everforest Light, Gruvbox Light, Solarized Light, Nord Light)
 *
 * @example
 * const { isDark, toggle, darkVariant, setDarkVariant, lightVariant, setLightVariant } = useTheme();
 */
export function useTheme(): UseThemeReturn {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved !== 'false';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [darkVariant, setDarkVariantState] = useState<DarkVariant>(readDarkVariant);
  const [lightVariant, setLightVariantState] = useState<LightVariant>(readLightVariant);

  const applyTheme = useCallback(
    (
      dark: boolean,
      dVariant: DarkVariant,
      lVariant: LightVariant,
      withTransition = false
    ) => {
      const root = document.documentElement;

      if (withTransition) {
        root.classList.add('theme-transitioning');
      }

      if (dark) {
        root.classList.add('dark');
        applyDarkVariantAttr(dVariant);
        root.removeAttribute('data-light-theme');
      } else {
        root.classList.remove('dark');
        root.removeAttribute('data-dark-theme');
        applyLightVariantAttr(lVariant);
      }

      if (withTransition) {
        setTimeout(() => {
          root.classList.remove('theme-transitioning');
        }, 300);
      }
    },
    []
  );

  // Apply theme to document on mount and when isDark/darkVariant/lightVariant changes
  useEffect(() => {
    applyTheme(isDark, darkVariant, lightVariant);
  }, [isDark, darkVariant, lightVariant, applyTheme]);

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
      applyTheme(next, darkVariant, lightVariant, true);
      return next;
    });
  }, [applyTheme, darkVariant, lightVariant]);

  const setTheme = useCallback(
    (theme: Theme) => {
      const dark = theme === 'dark';
      setIsDark(dark);
      localStorage.setItem(STORAGE_KEY, String(dark));
      applyTheme(dark, darkVariant, lightVariant, true);
    },
    [applyTheme, darkVariant, lightVariant]
  );

  const setDarkVariant = useCallback(
    (variant: DarkVariant) => {
      setDarkVariantState(variant);
      localStorage.setItem(DARK_VARIANT_KEY, variant);
      setIsDark(true);
      localStorage.setItem(STORAGE_KEY, 'true');
      applyTheme(true, variant, lightVariant, true);
    },
    [applyTheme, lightVariant]
  );

  const setLightVariant = useCallback(
    (variant: LightVariant) => {
      setLightVariantState(variant);
      localStorage.setItem(LIGHT_VARIANT_KEY, variant);
      setIsDark(false);
      localStorage.setItem(STORAGE_KEY, 'false');
      applyTheme(false, darkVariant, variant, true);
    },
    [applyTheme, darkVariant]
  );

  return {
    isDark,
    theme: isDark ? 'dark' : 'light',
    darkVariant,
    lightVariant,
    toggle,
    setTheme,
    setDarkVariant,
    setLightVariant,
  };
}
