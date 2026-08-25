import * as React from 'react';

import {
  SEMANTIC_ACCENT_INPUT_CLASS,
  SEMANTIC_ACCENT_TEXT_CLASS,
} from '@/lib/semantic-accent';
import type { SemanticAccent } from '@/lib/semantic-accent';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  accentColor?: SemanticAccent;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, accentColor = 'default', ...props }, ref) => {
    return (
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
          type="number"
          step="0.01"
          ref={ref}
          className={cn(
            'border-border/70 bg-background py-xs placeholder:text-muted-foreground/50 focus-visible:border-ring/50 focus-visible:ring-ring flex h-9 w-full rounded-md border pr-3 pl-9 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            SEMANTIC_ACCENT_INPUT_CLASS[accentColor],
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
