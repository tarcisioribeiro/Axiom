import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { IconComponent } from '@/types/icon';

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const alertDialogOverlayVariants = cva('fixed inset-0 z-50', {
  variants: {
    blur: {
      none: 'bg-black/80',
      sm: 'bg-black/60 backdrop-blur-sm',
      md: 'bg-black/50 backdrop-blur-md',
      lg: 'bg-black/40 backdrop-blur-lg',
    },
  },
  defaultVariants: {
    blur: 'md',
  },
});

interface AlertDialogOverlayProps
  extends
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>,
    VariantProps<typeof alertDialogOverlayVariants> {}

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  AlertDialogOverlayProps
>(({ className, blur, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      alertDialogOverlayVariants({ blur }),
      'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
      className
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const alertDialogContentVariants = cva(
  'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-md border border-border/60 bg-card p-lg shadow-2xl sm:rounded-lg focus:outline-none',
  {
    variants: {
      animation: {
        default: 'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
        // erro: chacoalha em vez do pop padrão
        shake: 'data-[state=open]:animate-shake data-[state=closed]:animate-pop-out',
      },
    },
    defaultVariants: {
      animation: 'default',
    },
  }
);

interface AlertDialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>,
    VariantProps<typeof alertDialogContentVariants> {
  overlayBlur?: 'none' | 'sm' | 'md' | 'lg';
}

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, animation, overlayBlur, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay blur={overlayBlur} />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(alertDialogContentVariants({ animation }), className)}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}
    {...props}
  />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'sm:space-x-sm flex flex-col-reverse sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const variantIcons: Record<string, IconComponent> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
  info: Info,
  default: AlertCircle,
};

const variantIconColors: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
  default: 'text-foreground',
};

interface AlertDialogTitleProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Title
> {
  icon?: IconComponent | React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  showIcon?: boolean;
}

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  AlertDialogTitleProps
>(
  (
    { className, icon, variant = 'default', showIcon = true, children, ...props },
    ref
  ) => {
    // Elemento JSX (<Icone />) é renderizado como veio; componente (Icone) —
    // inclusive os do lucide, que são objetos forwardRef, não funções — vai inline.
    const isElement = React.isValidElement(icon);
    const Icon = icon
      ? isElement
        ? null
        : (icon as IconComponent)
      : variantIcons[variant];

    return (
      <AlertDialogPrimitive.Title
        ref={ref}
        className={cn(
          'text-lg font-semibold',
          showIcon && 'gap-sm flex items-center',
          className
        )}
        {...props}
      >
        {showIcon &&
          (isElement ? (
            icon
          ) : Icon ? (
            <Icon
              className={cn('h-5 w-5 shrink-0', variantIconColors[variant])}
              aria-hidden="true"
            />
          ) : null)}
        {children}
      </AlertDialogPrimitive.Title>
    );
  }
);
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'outline' }), 'mt-sm sm:mt-0', className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
