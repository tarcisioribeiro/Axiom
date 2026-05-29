import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-sm py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15',
        secondary:
          'border-border/60 bg-muted/60 text-muted-foreground hover:bg-muted/80',
        destructive:
          'border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15',
        outline: 'border-border/70 text-foreground',
        success:
          'border-success/25 bg-success/10 text-[hsl(var(--success))] hover:bg-success/15',
        warning:
          'border-warning/25 bg-warning/10 text-[hsl(var(--warning))] hover:bg-warning/15',
        info: 'border-info/25 bg-info/10 text-[hsl(var(--info))] hover:bg-info/15',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants };
