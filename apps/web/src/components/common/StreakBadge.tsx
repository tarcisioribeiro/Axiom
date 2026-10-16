import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StreakBadgeProps {
  days: number;
  label?: React.ReactNode;
  bestDays?: number;
  bestLabel?: React.ReactNode;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

/**
 * StreakBadge - indicador de sequência (streak) reutilizável.
 *
 * `size="md"` é o pill com borda usado em painéis de destaque (com label
 * e nota opcional de melhor sequência); `size="sm"` é o pill compacto
 * usado inline ao lado de outros indicadores.
 */
export function StreakBadge({
  days,
  label,
  bestDays,
  bestLabel,
  size = 'md',
  pulse = false,
  className,
}: StreakBadgeProps) {
  const Wrapper = pulse ? motion.div : 'div';
  const pulseProps = pulse
    ? {
        animate: { scale: [1, 1.05, 1] },
        transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
      }
    : {};

  if (size === 'sm') {
    return (
      <Wrapper
        {...pulseProps}
        className={cn(
          'gap-xs px-sm py-xs flex items-center rounded-full bg-orange-500/15',
          className
        )}
      >
        <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
        <span className="text-sm font-bold text-orange-500">{days}</span>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      {...pulseProps}
      className={cn(
        'gap-sm px-md py-sm flex items-center rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30',
        className
      )}
    >
      <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
      <div className="text-xs">
        <span className="font-bold text-orange-600 dark:text-orange-400">{days}</span>
        {label && <span className="ml-xs text-muted-foreground">{label}</span>}
        {bestDays !== undefined && bestLabel && (
          <span className="ml-sm text-muted-foreground/70">
            ({bestLabel}: {bestDays})
          </span>
        )}
      </div>
    </Wrapper>
  );
}
