import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTheme } from '@/hooks/use-theme';

describe('useTheme pairs', () => {
  beforeEach(() => localStorage.clear());

  it('picking a light theme saves its dark pair; toggle switches within the pair', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setLightVariant('gruvbox-light'));
    expect(localStorage.getItem('darkMode')).toBe('false');
    expect(localStorage.getItem('darkVariant')).toBe('gruvbox-dark');

    act(() => result.current.toggle());
    expect(result.current.isDark).toBe(true);
    expect(result.current.darkVariant).toBe('gruvbox-dark');
    expect(document.documentElement.getAttribute('data-dark-theme')).toBe(
      'gruvbox-dark'
    );
  });

  it('keeps other instances in sync (header modal vs. T shortcut)', () => {
    const header = renderHook(() => useTheme());
    const shortcut = renderHook(() => useTheme());
    act(() => header.result.current.setDarkVariant('tokyo-night'));
    expect(shortcut.result.current.darkVariant).toBe('tokyo-night');

    act(() => shortcut.result.current.toggle());
    expect(header.result.current.isDark).toBe(false);
    expect(header.result.current.lightVariant).toBe('tokyo-day');
  });
});
