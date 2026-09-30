import * as React from 'react';

import {
  SEMANTIC_ACCENT_INPUT_CLASS,
  SEMANTIC_ACCENT_TEXT_CLASS,
} from '@/lib/semantic-accent';
import type { SemanticAccent } from '@/lib/semantic-accent';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  accentColor?: SemanticAccent;
}

const formatMasked = (value: CurrencyInputProps['value']): string => {
  if (value === '' || value == null) return '';
  const num = Number(value);
  return isNaN(num)
    ? ''
    : num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

/**
 * Campo de moeda com máscara por centavos (prefixo R$): digitar "890" exibe "8,90",
 * "150000" exibe "1.500,00"; um "-" em qualquer posição torna o valor negativo.
 * `onChange` recebe `e.target.value` normalizado ("1500.00", ou "" se vazio),
 * compatível com `parseFloat`.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, accentColor = 'default', value, onChange, ...props }, ref) => (
    <div className="relative flex items-center">
      <span
        className={cn(
          'pointer-events-none absolute left-3 text-sm font-medium select-none',
          SEMANTIC_ACCENT_TEXT_CLASS[accentColor]
        )}
      >
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        ref={ref}
        className={cn(
          'border-border/70 bg-background py-xs placeholder:text-muted-foreground/50 focus-visible:border-ring/50 focus-visible:ring-ring flex h-9 w-full rounded-md border pr-3 pl-9 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          SEMANTIC_ACCENT_INPUT_CLASS[accentColor],
          className
        )}
        {...props}
        value={formatMasked(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          const sign = e.target.value.includes('-') ? -1 : 1;
          // React restaura o valor formatado (controlado) após o handler
          e.target.value = digits ? ((sign * Number(digits)) / 100).toFixed(2) : '';
          onChange?.(e);
        }}
      />
    </div>
  )
);
CurrencyInput.displayName = 'CurrencyInput';

interface MaskedCurrencyInputProps extends Omit<
  CurrencyInputProps,
  'value' | 'onChange'
> {
  value: number;
  onValueChange: (value: number) => void;
}

/** Atalho do CurrencyInput para estado numérico (ex.: `Controller` do react-hook-form). */
const MaskedCurrencyInput = ({
  value,
  onValueChange,
  ...props
}: MaskedCurrencyInputProps) => (
  <CurrencyInput
    {...props}
    value={value}
    onChange={(e) => onValueChange(Number(e.target.value))}
  />
);

export { CurrencyInput, MaskedCurrencyInput };
