import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { checkmarkCircleVariants, pulseRingVariants } from '@/lib/animations/variants';
import { DURATION } from '@/lib/animations/transitions';

type SuccessVariant = 'minimal' | 'standard' | 'celebration';

interface SuccessAnimationProps {
  /** Mostra/esconde a animação */
  show: boolean;
  /** Variante visual: minimal (só check), standard (check + círculo), celebration (com partículas) */
  variant?: SuccessVariant;
  /** Tamanho do componente */
  size?: 'sm' | 'md' | 'lg';
  /** Callback quando animação termina */
  onComplete?: () => void;
  /** Classe CSS adicional */
  className?: string;
  /** Duração antes de chamar onComplete (ms) */
  duration?: number;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
};

const iconSizes = {
  sm: 24,
  md: 32,
  lg: 48,
};

/**
 * Componente de animação de sucesso com checkmark animado.
 *
 * Variantes:
 * - minimal: Apenas o checkmark com fade in
 * - standard: Checkmark com círculo e efeito pulse
 * - celebration: Standard + partículas de confetti
 *
 * @example
 * ```tsx
 * const [showSuccess, setShowSuccess] = useState(false);
 *
 * const handleSave = async () => {
 *   await save();
 *   setShowSuccess(true);
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleSave}>Salvar</button>
 *     <SuccessAnimation
 *       show={showSuccess}
 *       variant="standard"
 *       onComplete={() => setShowSuccess(false)}
 *     />
 *   </>
 * );
 * ```
 */
export function SuccessAnimation({
  show,
  variant = 'standard',
  size = 'md',
  onComplete,
  className,
  duration = 1500,
}: SuccessAnimationProps) {
  const iconSize = iconSizes[size];

  React.useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, duration);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete, duration]);

  const renderParticles = () => {
    if (variant !== 'celebration') return null;

    const particles = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 8;
      const colors = [
        'hsl(var(--success))',
        'hsl(var(--primary))',
        'hsl(var(--accent))',
        'hsl(var(--warning))',
      ];
      const color = colors[i % colors.length];

      return (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
          animate={{
            scale: [0, 1, 0.5],
            opacity: [1, 1, 0],
            x: Math.cos(angle) * 40,
            y: Math.sin(angle) * 40,
          }}
          transition={{
            duration: DURATION.slow,
            ease: 'easeOut',
            delay: DURATION.fast,
          }}
        />
      );
    });

    return <>{particles}</>;
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={cn(
            'relative flex items-center justify-center',
            sizeClasses[size],
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Pulse ring effect */}
          {variant !== 'minimal' && (
            <motion.div
              className="absolute inset-0 rounded-full bg-success/20"
              variants={pulseRingVariants}
              initial="initial"
              animate="animate"
            />
          )}

          {/* Main circle */}
          {variant !== 'minimal' && (
            <motion.div
              className={cn(
                'absolute inset-0 rounded-full bg-success',
                sizeClasses[size]
              )}
              variants={checkmarkCircleVariants}
              initial="initial"
              animate="animate"
            />
          )}

          {/* Checkmark SVG */}
          <motion.svg
            className="relative z-10"
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: {
                delay: variant === 'minimal' ? 0 : DURATION.fast,
                duration: DURATION.normal,
                type: 'spring',
                stiffness: 300,
                damping: 20,
              },
            }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke={
                variant === 'minimal'
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--success-foreground))'
              }
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: 1,
                transition: {
                  delay: variant === 'minimal' ? 0.1 : DURATION.normal,
                  duration: 0.4,
                  ease: 'easeOut',
                },
              }}
            />
          </motion.svg>

          {/* Celebration particles */}
          {renderParticles()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SuccessAnimation;
