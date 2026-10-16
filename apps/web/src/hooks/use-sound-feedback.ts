import { useCallback } from 'react';

function playTone(
  frequency: number,
  duration: number,
  volume: number = 0.08,
  type: OscillatorType = 'sine'
): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => void ctx.close();
  } catch {
    // AudioContext unavailable or blocked — silent failure
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Standalone sound functions — usable outside React (e.g. the global
 * QueryClient mutation cache), not just inside components via the hook below.
 */
export function playSuccessSound(): void {
  if (prefersReducedMotion()) return;
  playTone(880, 0.1, 0.06);
  setTimeout(() => playTone(1320, 0.08, 0.04), 90);
}

export function playDeleteSound(): void {
  if (prefersReducedMotion()) return;
  playTone(440, 0.1, 0.06);
}

export function playErrorSound(): void {
  if (prefersReducedMotion()) return;
  playTone(220, 0.15, 0.07, 'triangle');
}

/**
 * Subtle sound feedback for CRUD operations.
 * Automatically disabled when prefers-reduced-motion is active.
 * All tones are very low volume (≤ 0.08) and short (≤ 0.2s).
 */
export const useSoundFeedback = () => {
  const playSuccess = useCallback(() => playSuccessSound(), []);
  const playDelete = useCallback(() => playDeleteSound(), []);
  const playError = useCallback(() => playErrorSound(), []);

  return { playSuccess, playDelete, playError };
};
