import { useInView, useMotionValue, animate } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { EASING } from './transitions';

export const useScrollAnimation = (once = true) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, amount: 0.3 });

  return { ref, isInView };
};

export const useCounter = (end: number, duration = 2) => {
  const motionValue = useMotionValue(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controls = animate(motionValue, end, {
      duration,
      ease: EASING.smooth,
      onUpdate: setCount,
    });
    return controls.stop;
  }, [end, duration, motionValue]);

  return count;
};
