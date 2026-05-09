import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import * as React from 'react';

import { DURATION } from '@/lib/animations/transitions';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-sm whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95 active:shadow-none',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/95',
        outline:
          'border border-input bg-background text-primary shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary/30 active:bg-primary/15',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:bg-secondary/90',
        ghost:
          'text-primary hover:bg-primary/10 hover:text-primary active:bg-primary/15',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 rounded-md px-md py-sm',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-xl',
        icon: 'h-9 w-9 rounded-full',
        xs: 'h-7 rounded-md px-sm text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, merges button styles onto the single child element instead of
   * rendering a wrapping <button>. Useful for rendering a <Link> with button
   * styles without nesting interactive elements.
   *
   * @example <Button asChild variant="outline"><Link to="/foo">Go</Link></Button>
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, disabled, asChild = false, children, ...props },
    ref
  ) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
      return React.cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
      } as React.HTMLAttributes<HTMLElement>);
    }

    return (
      <motion.button
        className={classes}
        ref={ref}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.95 }}
        transition={{ duration: DURATION.fast }}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
