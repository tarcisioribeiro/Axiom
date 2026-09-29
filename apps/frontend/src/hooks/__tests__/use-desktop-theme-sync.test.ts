vi.mock('@/services/api-client', () => ({
  apiClient: { get: vi.fn() },
}));

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useDesktopThemeSync } from '@/hooks/use-desktop-theme-sync';
import { apiClient } from '@/services/api-client';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

describe('useDesktopThemeSync', () => {
  const setDark = vi.fn();
  const setLight = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('applies a new dark theme once and remembers it', async () => {
    mockGet.mockResolvedValue({ theme: 'tokyo-night' });
    renderHook(() => useDesktopThemeSync(true, setDark, setLight));
    await waitFor(() => expect(setDark).toHaveBeenCalledWith('tokyo-night'));
    expect(localStorage.getItem('desktopThemeSynced')).toBe('tokyo-night');

    setDark.mockClear();
    renderHook(() => useDesktopThemeSync(true, setDark, setLight));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(setDark).not.toHaveBeenCalled();
  });

  it('routes light themes to setLightVariant', async () => {
    mockGet.mockResolvedValue({ theme: 'nord-light' });
    renderHook(() => useDesktopThemeSync(true, setDark, setLight));
    await waitFor(() => expect(setLight).toHaveBeenCalledWith('nord-light'));
  });

  it('ignores unknown themes, null and request errors', async () => {
    mockGet.mockResolvedValueOnce({ theme: 'bogus' });
    renderHook(() => useDesktopThemeSync(true, setDark, setLight));
    mockGet.mockResolvedValueOnce({ theme: null });
    renderHook(() => useDesktopThemeSync(true, setDark, setLight));
    mockGet.mockRejectedValueOnce(new Error('401'));
    renderHook(() => useDesktopThemeSync(true, setDark, setLight));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3));
    expect(setDark).not.toHaveBeenCalled();
    expect(setLight).not.toHaveBeenCalled();
    expect(localStorage.getItem('desktopThemeSynced')).toBeNull();
  });

  it('does nothing when disabled (public pages)', () => {
    renderHook(() => useDesktopThemeSync(false, setDark, setLight));
    expect(mockGet).not.toHaveBeenCalled();
  });
});
