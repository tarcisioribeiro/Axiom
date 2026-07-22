import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useSuccessAnimation } from '@/hooks/use-success-animation';

describe('useSuccessAnimation', () => {
  it('starts with isShowing false', () => {
    const { result } = renderHook(() => useSuccessAnimation());
    expect(result.current.isShowing).toBe(false);
  });

  it('showSuccess sets isShowing to true', () => {
    const { result } = renderHook(() => useSuccessAnimation());
    act(() => result.current.showSuccess());
    expect(result.current.isShowing).toBe(true);
  });

  it('hideSuccess sets isShowing to false', () => {
    const { result } = renderHook(() => useSuccessAnimation());
    act(() => result.current.showSuccess());
    act(() => result.current.hideSuccess());
    expect(result.current.isShowing).toBe(false);
  });

  it('animationProps contains show reflecting isShowing', () => {
    const { result } = renderHook(() =>
      useSuccessAnimation({ variant: 'standard', size: 'lg' })
    );
    expect(result.current.animationProps.show).toBe(false);
    act(() => result.current.showSuccess());
    expect(result.current.animationProps.show).toBe(true);
  });

  it('animationProps forwards variant, size, className and duration from options', () => {
    const { result } = renderHook(() =>
      useSuccessAnimation({
        variant: 'celebration',
        size: 'sm',
        className: 'custom',
        duration: 2000,
      })
    );
    expect(result.current.animationProps.variant).toBe('celebration');
    expect(result.current.animationProps.size).toBe('sm');
    expect(result.current.animationProps.className).toBe('custom');
    expect(result.current.animationProps.duration).toBe(2000);
  });

  it('animationProps.onComplete hides animation and calls options.onComplete', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useSuccessAnimation({ onComplete }));
    act(() => result.current.showSuccess());
    act(() => result.current.animationProps.onComplete());
    expect(result.current.isShowing).toBe(false);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('animationProps.onComplete works without options.onComplete defined', () => {
    const { result } = renderHook(() => useSuccessAnimation());
    act(() => result.current.showSuccess());
    expect(() => act(() => result.current.animationProps.onComplete())).not.toThrow();
    expect(result.current.isShowing).toBe(false);
  });
});
