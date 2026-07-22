import { useInView, useMotionValue, animate } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

import { EASING } from './transitions';

export const useScrollAnimation = (once = true) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, amount: 0.3 });

  return { ref, isInView };
};

export const useCounter = (end: number, duration = 2) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const motionValue = useMotionValue(prefersReducedMotion ? end : 0);
  const [count, setCount] = useState(prefersReducedMotion ? end : 0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls = animate(motionValue, end, {
      duration,
      ease: EASING.smooth,
      onUpdate: setCount,
    });
    return controls.stop;
  }, [end, duration, motionValue, prefersReducedMotion]);

  return count;
};
