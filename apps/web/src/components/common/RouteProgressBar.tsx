import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

export const RouteProgressBar = () => {
  const location = useLocation();
  const controls = useAnimation();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await controls.start({ width: '0%', opacity: 1, transition: { duration: 0 } });
      if (cancelled) return;
      await controls.start({
        width: '85%',
        transition: { duration: 0.8, ease: 'easeOut' },
      });
      if (cancelled) return;
      await new Promise<void>((r) => setTimeout(r, 200));
      if (cancelled) return;
      await controls.start({ width: '100%', transition: { duration: 0.15 } });
      if (cancelled) return;
      await controls.start({ opacity: 0, transition: { duration: 0.2 } });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, controls]);

  return (
    <motion.div
      className="z-toast bg-primary pointer-events-none fixed top-0 left-0 h-[2px]"
      animate={controls}
      initial={{ width: '0%', opacity: 0 }}
    />
  );
};
