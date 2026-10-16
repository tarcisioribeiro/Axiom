import { useState } from 'react';

/**
 * Returns a timestamp captured once when the component mounts.
 * Centralizing the `Date.now()` call here keeps consuming components
 * free of direct impure-function calls during render (react-hooks/purity).
 */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
