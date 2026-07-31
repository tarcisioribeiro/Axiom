import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface XPParticle {
  id: number;
  x: number;
  y: number;
  xp: number;
}

interface XPFloatingProps {
  onMount?: (trigger: (x: number, y: number, xp?: number) => void) => void;
}

export function XPFloating({ onMount }: XPFloatingProps) {
  const [particles, setParticles] = useState<XPParticle[]>([]);

  const trigger = (x: number, y: number, xp: number = 10) => {
    const id = Date.now() + Math.random();
    setParticles((prev) => [...prev, { id, x, y, xp }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1200);
  };

  useEffect(() => {
    onMount?.(trigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="text-warning absolute font-bold select-none"
            style={{ left: p.x, top: p.y, fontSize: '1.1rem' }}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -52, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          >
            +{p.xp} XP
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useXPTrigger() {
  const [triggerFn, setTriggerFn] = useState<
    ((x: number, y: number, xp?: number) => void) | null
  >(null);

  const register = (fn: (x: number, y: number, xp?: number) => void) => {
    setTriggerFn(() => fn);
  };

  const fire = (x: number, y: number, xp?: number) => {
    triggerFn?.(x, y, xp);
  };

  return { register, fire };
}
