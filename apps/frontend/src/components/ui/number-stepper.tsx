import { Minus, Plus } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PlainButton } from '@/components/ui/plain-button';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Nome acessível do valor (o componente não tem rótulo visível). */
  'aria-label': string;
  className?: string;
}

/** Inteiro com botões − / + e setas ↑/↓; sem digitação livre, nunca fica inválido. */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  'aria-label': ariaLabel,
  className,
}: NumberStepperProps) {
  const { t } = useTranslation();
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'ArrowUp') set(value + step);
    else if (e.key === 'ArrowDown') set(value - step);
    else return;
    e.preventDefault();
  };

  const buttonClass =
    'text-muted-foreground hover:bg-category-exercise/10 hover:text-category-exercise focus-visible:ring-ring flex h-full w-9 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40';

  return (
    <div
      className={cn(
        'border-border/70 bg-background flex h-9 items-stretch overflow-hidden rounded-md border shadow-sm',
        className
      )}
    >
      <PlainButton
        type="button"
        aria-label={t('common.actions.decrease')}
        onClick={() => set(value - step)}
        disabled={value <= min}
        className={cn(buttonClass, 'border-border/70 border-r')}
      >
        <Minus className="h-3.5 w-3.5" />
      </PlainButton>
      <span
        role="spinbutton"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
        onKeyDown={handleKeyDown}
        className="text-foreground focus-visible:ring-ring flex min-w-10 items-center justify-center text-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        {value}
      </span>
      <PlainButton
        type="button"
        aria-label={t('common.actions.increase')}
        onClick={() => set(value + step)}
        disabled={value >= max}
        className={cn(buttonClass, 'border-border/70 border-l')}
      >
        <Plus className="h-3.5 w-3.5" />
      </PlainButton>
    </div>
  );
}
