import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

export type DarkVariant =
  | 'dracula'
  | 'catppuccin-mocha'
  | 'tokyo-night'
  | 'gruvbox-dark'
  | 'everforest'
  | 'ubuntu'
  | 'mint-dark';

export type LightVariant =
  | 'alucard'
  | 'catppuccin-latte'
  | 'everforest-light'
  | 'gruvbox-light'
  | 'tokyo-day'
  | 'ubuntu-light'
  | 'mint-light';

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
// Avisa as outras instâncias de useTheme (header, paleta, atalho T) da troca
const THEME_CHANGE_EVENT = 'axiom:theme-change';

/** Par claro de cada tema escuro — `T` alterna dentro do par */
export const LIGHT_PAIR: Record<DarkVariant, LightVariant> = {
  dracula: 'alucard',
  'catppuccin-mocha': 'catppuccin-latte',
  'tokyo-night': 'tokyo-day',
  'gruvbox-dark': 'gruvbox-light',
  everforest: 'everforest-light',
  ubuntu: 'ubuntu-light',
  'mint-dark': 'mint-light',
};

export const DARK_PAIR = Object.fromEntries(
  Object.entries(LIGHT_PAIR).map(([dark, light]) => [light, dark])
) as Record<LightVariant, DarkVariant>;

function readIsDark(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return saved !== 'false';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

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

export function isValidDarkVariant(value: string): value is DarkVariant {
  return [
    'dracula',
    'catppuccin-mocha',
    'tokyo-night',
    'gruvbox-dark',
    'everforest',
    'ubuntu',
    'mint-dark',
  ].includes(value);
}

export function isValidLightVariant(value: string): value is LightVariant {
  return [
    'alucard',
    'catppuccin-latte',
    'everforest-light',
    'gruvbox-light',
    'tokyo-day',
    'ubuntu-light',
    'mint-light',
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
 * - Dark mode variant selection (Dracula, Catppuccin Mocha, Tokyo Night, Gruvbox Dark, Everforest, Ubuntu, Linux Mint)
 * - Light mode variant selection (Alucard, Catppuccin Latte, Everforest Light, Gruvbox Light, Tokyo Day, Ubuntu Light, Linux Mint Light)
 *
 * @example
 * const { isDark, toggle, darkVariant, setDarkVariant, lightVariant, setLightVariant } = useTheme();
 */
export function useTheme(): UseThemeReturn {
  const [isDark, setIsDark] = useState<boolean>(readIsDark);

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

  // Re-lê o storage quando outra instância troca o tema
  useEffect(() => {
    const sync = () => {
      setIsDark(readIsDark());
      setDarkVariantState(readDarkVariant());
      setLightVariantState(readLightVariant());
    };
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  // Salva modo + par de variantes e aplica; as variantes vêm do storage para
  // não usar o estado defasado de uma instância que não viu a última troca.
  const commit = useCallback(
    (dark: boolean, dVariant: DarkVariant, lVariant: LightVariant) => {
      localStorage.setItem(STORAGE_KEY, String(dark));
      localStorage.setItem(DARK_VARIANT_KEY, dVariant);
      localStorage.setItem(LIGHT_VARIANT_KEY, lVariant);
      applyTheme(dark, dVariant, lVariant, true);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    },
    [applyTheme]
  );

  const toggle = useCallback(() => {
    commit(!readIsDark(), readDarkVariant(), readLightVariant());
  }, [commit]);

  const setTheme = useCallback(
    (theme: Theme) => commit(theme === 'dark', readDarkVariant(), readLightVariant()),
    [commit]
  );

  const setDarkVariant = useCallback(
    (variant: DarkVariant) => commit(true, variant, LIGHT_PAIR[variant]),
    [commit]
  );

  const setLightVariant = useCallback(
    (variant: LightVariant) => commit(false, DARK_PAIR[variant], variant),
    [commit]
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
