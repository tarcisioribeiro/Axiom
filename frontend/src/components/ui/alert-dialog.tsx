import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const alertDialogOverlayVariants = cva(
  'fixed inset-0 z-50 transition-all duration-200',
  {
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
  }
);

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
      'data-[state=closed]:animate-dialog-overlay-hide data-[state=open]:animate-dialog-overlay-show',
      className
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const alertDialogContentVariants = cva(
  'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl sm:rounded-lg focus:outline-none',
  {
    variants: {
      animation: {
        default:
          'data-[state=open]:animate-dialog-content-show data-[state=closed]:animate-dialog-content-hide',
        slideUp:
          'data-[state=open]:animate-slide-up-fade data-[state=closed]:animate-dialog-content-hide',
        slideDown:
          'data-[state=open]:animate-slide-down-fade data-[state=closed]:animate-dialog-content-hide',
        bounce:
          'data-[state=open]:animate-bounce-in data-[state=closed]:animate-dialog-content-hide',
        shake:
          'data-[state=open]:animate-shake data-[state=closed]:animate-dialog-content-hide',
      },
      variant: {
        default: '',
        success: 'border-success/50',
        warning: 'border-warning/50',
        destructive: 'border-destructive/50',
        info: 'border-info/50',
      },
    },
    defaultVariants: {
      animation: 'default',
      variant: 'default',
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
>(({ className, animation, variant, overlayBlur, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay blur={overlayBlur} />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(alertDialogContentVariants({ animation, variant }), className)}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

interface AlertDialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon | React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  showIcon?: boolean;
}

const variantIcons: Record<string, LucideIcon> = {
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

const AlertDialogHeader = ({
  className,
  icon,
  variant = 'default',
  showIcon = true,
  children,
  ...props
}: AlertDialogHeaderProps) => {
  const IconComponent = icon
    ? typeof icon === 'function'
      ? icon
      : null
    : variantIcons[variant];

  return (
    <div
      className={cn('flex flex-col space-y-3 text-center sm:text-left', className)}
      {...props}
    >
      {showIcon && (
        <div className="flex justify-center sm:justify-start">
          {typeof icon === 'object' && icon !== null ? (
            icon
          ) : IconComponent ? (
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full p-3',
                variant === 'success' && 'bg-success/10',
                variant === 'warning' && 'bg-warning/10',
                variant === 'destructive' && 'bg-destructive/10',
                variant === 'info' && 'bg-info/10',
                variant === 'default' && 'bg-muted'
              )}
            >
              <IconComponent className={cn('h-6 w-6', variantIconColors[variant])} />
            </div>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
};
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
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
    className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};

export type {
  AlertDialogContentProps,
  AlertDialogHeaderProps,
  AlertDialogOverlayProps,
};
