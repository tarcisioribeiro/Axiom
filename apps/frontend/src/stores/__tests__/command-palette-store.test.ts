import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useCommandPaletteStore } from '@/stores/command-palette-store';

describe('useCommandPaletteStore', () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ isOpen: false });
  });

  it('starts with isOpen false', () => {
    const { result } = renderHook(() => useCommandPaletteStore());
    expect(result.current.isOpen).toBe(false);
  });

  it('open() sets isOpen to true', () => {
    const { result } = renderHook(() => useCommandPaletteStore());
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it('close() sets isOpen to false', () => {
    useCommandPaletteStore.setState({ isOpen: true });
    const { result } = renderHook(() => useCommandPaletteStore());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle() flips isOpen from false to true', () => {
    const { result } = renderHook(() => useCommandPaletteStore());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
  });

  it('toggle() flips isOpen from true to false', () => {
    useCommandPaletteStore.setState({ isOpen: true });
    const { result } = renderHook(() => useCommandPaletteStore());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });
});
