import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { Pencil, Plus, X } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const dialogContentVariants = cva(
  'fixed left-[50%] top-[50%] z-50 grid w-full max-h-[90vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-md border border-border/60 bg-card p-lg shadow-xl data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out sm:rounded-lg',
  {
    variants: {
      size: {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-3xl',
        xl: 'max-w-4xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

interface DialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size, onInteractOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      onInteractOutside={(e) => {
        // Prevent dialog close when clicking inside a Flatpickr calendar
        // (the calendar is appended to document.body, outside the dialog DOM)
        if ((e.target as Element)?.closest?.('.flatpickr-calendar')) {
          e.preventDefault();
          return;
        }
        onInteractOutside?.(e);
      }}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** `sticky`: cabeçalho fixo no topo enquanto o conteúdo rola (ver
 * `.dialog-header-sticky` em index.css). */
const DialogHeader = ({
  className,
  sticky,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { sticky?: boolean }) => (
  <div
    className={cn(
      'space-y-sm flex flex-col text-center sm:text-left',
      sticky && 'dialog-header-sticky',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'dialog-footer sm:space-x-sm flex flex-col-reverse sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/** Rodapé fixo com só "Fechar", para modais informativos sem outra ação de saída. */
const DialogCloseFooter = () => {
  const { t } = useTranslation();
  return (
    <DialogFooter className="sm:justify-start">
      <DialogClose asChild>
        <Button variant="outline">
          <X className="h-4 w-4" />
          {t('common.actions.close')}
        </Button>
      </DialogClose>
    </DialogFooter>
  );
};

/** `mode`: modal de formulário — ícone padrão de inclusão (+) ou edição (lápis). */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
    mode?: 'create' | 'edit';
  }
>(({ className, mode, children, ...props }, ref) => {
  const ModeIcon = mode === 'edit' ? Pencil : mode === 'create' ? Plus : null;
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        'heading-2 leading-none',
        ModeIcon && 'gap-sm flex items-center',
        className
      )}
      {...props}
    >
      {ModeIcon && (
        <ModeIcon className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {children}
    </DialogPrimitive.Title>
  );
});
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogCloseFooter,
  DialogTitle,
  DialogDescription,
};
