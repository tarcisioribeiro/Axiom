vi.mock('framer-motion', () => ({
  useMotionValue: (initial: number) => ({ set: vi.fn(), initial }),
  animate: vi.fn((_mv, end, { onUpdate } = {}) => {
    onUpdate?.(end);
    return { stop: vi.fn() };
  }),
  useInView: vi.fn(() => false),
}));

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useCounter, useScrollAnimation } from '@/lib/animations/hooks';

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
};

describe('useScrollAnimation', () => {
  it('returns a ref and isInView value', () => {
    const { result } = renderHook(() => useScrollAnimation());
    expect(result.current).toHaveProperty('ref');
    expect(result.current).toHaveProperty('isInView');
    expect(result.current.isInView).toBe(false);
  });

  it('accepts once=false parameter without error', () => {
    const { result } = renderHook(() => useScrollAnimation(false));
    expect(result.current.isInView).toBe(false);
  });
});

describe('useCounter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the end value immediately when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useCounter(500));
    expect(result.current).toBe(500);
  });

  it('starts animation from 0 when prefers-reduced-motion is not set', () => {
    mockMatchMedia(false);
    // animate mock calls onUpdate(end) synchronously, so the final value is end
    const { result } = renderHook(() => useCounter(500));
    expect(result.current).toBe(500);
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('does not call animate when prefers-reduced-motion is set', async () => {
    mockMatchMedia(true);
    const { animate } = await import('framer-motion');
    renderHook(() => useCounter(999));
    expect(animate).not.toHaveBeenCalled();
  });
});
