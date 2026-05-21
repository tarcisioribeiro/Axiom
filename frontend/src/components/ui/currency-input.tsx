import * as React from 'react';

import { cn } from '@/lib/utils';

interface CurrencyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  accentColor?: 'default' | 'destructive' | 'success';
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, accentColor = 'default', ...props }, ref) => {
    const prefixColor = {
      default: 'text-muted-foreground',
      destructive: 'text-destructive',
      success: 'text-success',
    }[accentColor];

    return (
      <div className="relative flex items-center">
        <span
          className={cn(
            'pointer-events-none absolute left-3 select-none text-sm font-medium',
            prefixColor
          )}
        >
          R$
        </span>
        <input
          type="number"
          step="0.01"
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-md border border-border/70 bg-background py-xs pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/50 focus-visible:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            accentColor === 'destructive' &&
              'border-destructive/40 focus-visible:ring-destructive/30',
            accentColor === 'success' &&
              'border-success/40 focus-visible:ring-success/30',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
