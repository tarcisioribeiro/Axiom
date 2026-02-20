import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface UseThemeReturn {
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** Current theme name */
  theme: Theme;
  /** Toggle between dark and light mode */
  toggle: () => void;
  /** Set a specific theme */
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'darkMode';

/**
 * Centralized hook for theme management (Dracula/Alucard)
 *
 * Handles:
 * - Reading from localStorage
 * - Falling back to system preference
 * - Smooth transitions when changing themes
 * - Persisting preference to localStorage
 *
 * @example
 * const { isDark, toggle } = useTheme();
 *
 * <Button onClick={toggle}>
 *   {isDark ? <Sun /> : <Moon />}
 * </Button>
 */
export function useTheme(): UseThemeReturn {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Initialize from localStorage or system preference
    if (typeof window === 'undefined') return true;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved !== 'false';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const applyTheme = useCallback((dark: boolean, withTransition = false) => {
    const root = document.documentElement;

    if (withTransition) {
      root.classList.add('theme-transitioning');
    }

    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (withTransition) {
      setTimeout(() => {
        root.classList.remove('theme-transitioning');
      }, 300);
    }
  }, []);

  // Apply theme to document on mount and when isDark changes
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark, applyTheme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only apply if user hasn't set a preference
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
      applyTheme(next, true);
      return next;
    });
  }, [applyTheme]);

  const setTheme = useCallback(
    (theme: Theme) => {
      const dark = theme === 'dark';
      setIsDark(dark);
      localStorage.setItem(STORAGE_KEY, String(dark));
      applyTheme(dark, true);
    },
    [applyTheme]
  );

  return {
    isDark,
    theme: isDark ? 'dark' : 'light',
    toggle,
    setTheme,
  };
}
