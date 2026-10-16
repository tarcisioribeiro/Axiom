import * as React from 'react';

import { cn } from '@/lib/utils';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows, ...props }, ref) => {
    // Campos de observação usam rows={1 ou 2} (uma linha visual); sem min-h
    // fixo eles respeitam `rows` de verdade em vez de ficarem sempre altos.
    const compact = typeof rows === 'number' && rows <= 2;
    return (
      <textarea
        rows={rows}
        className={cn(
          'border-border/70 bg-background py-sm placeholder:text-muted-foreground/50 focus-visible:border-ring/50 focus-visible:ring-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/50 flex w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:ring-2',
          compact ? 'min-h-0' : 'min-h-[60px]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
