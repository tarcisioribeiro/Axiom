import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { Pencil, Plus, X } from 'lucide-react';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// `open` do Root, lido pelo DialogContent para congelar o conteúdo durante a saída.
const DialogOpenContext = React.createContext<boolean | undefined>(undefined);

const Dialog = (props: React.ComponentProps<typeof DialogPrimitive.Root>) => (
  <DialogOpenContext.Provider value={props.open}>
    <DialogPrimitive.Root {...props} />
  </DialogOpenContext.Provider>
);
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
  'fixed left-[50%] top-[50%] z-50 flex flex-col [&>*]:shrink-0 w-full max-h-[calc(100dvh-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-md border border-border/60 bg-card p-lg shadow-xl data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out sm:rounded-lg',
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
>(({ className, children, size, onInteractOutside, ...props }, ref) => {
  // Ao fechar, o chamador costuma limpar o estado (`setSelected(undefined)`) junto;
  // mantém o último conteúdo e a largura (className derivada desse estado) até a
  // animação de saída terminar, senão sobra um modal "vazio" ou mais estreito.
  const open = React.useContext(DialogOpenContext);
  const classes = cn(dialogContentVariants({ size }), className);
  const [shown, setShown] = React.useState({ children, classes });
  if (open !== false && (shown.children !== children || shown.classes !== classes))
    setShown({ children, classes });
  const closing = open === false;
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={closing ? shown.classes : classes}
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
        {closing ? shown.children : children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

/** Sempre fixo no topo do modal (ver `.dialog-header-sticky` em index.css). */
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'dialog-header-sticky space-y-sm flex flex-col text-center sm:text-left',
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

/** Rodapé de modal de detalhe: "Fechar" à esquerda; `children` (ações) à direita. */
const DialogCloseFooter = ({ children }: { children?: React.ReactNode }) => {
  const { t } = useTranslation();
  return (
    <DialogFooter className="gap-sm sm:justify-between sm:space-x-0">
      <DialogClose asChild>
        <Button variant="outline">
          <X className="h-4 w-4" />
          {t('common.actions.close')}
        </Button>
      </DialogClose>
      {children && <div className="gap-sm flex flex-wrap justify-end">{children}</div>}
    </DialogFooter>
  );
};

/** `mode`: modal de formulário — ícone padrão de inclusão (+) ou edição (lápis).
 * `icon`: ícone dos demais modais (detalhe, ação). */
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
    mode?: 'create' | 'edit';
    icon?: React.ElementType;
  }
>(({ className, mode, icon, children, ...props }, ref) => {
  const ModeIcon = icon ?? (mode === 'edit' ? Pencil : mode === 'create' ? Plus : null);
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
    className={cn(className, 'sr-only')}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogCloseFooter,
  DialogTitle,
  DialogDescription,
};
