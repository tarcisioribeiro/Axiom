import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAlertDialogStore } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';

export const AlertDialogProvider = () => {
  const {
    isOpen,
    title,
    description,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    variant = 'default',
    animation = 'default',
    blur = 'md',
    icon,
    showIcon = true,
  } = useAlertDialogStore();

  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const getActionButtonClass = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
      case 'success':
        return 'bg-success text-success-foreground hover:bg-success/90';
      case 'warning':
        return 'bg-warning text-warning-foreground hover:bg-warning/90';
      case 'info':
        return 'bg-info text-info-foreground hover:bg-info/90';
      default:
        return '';
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent variant={variant} animation={animation} overlayBlur={blur}>
        <AlertDialogHeader variant={variant} icon={icon} showIcon={showIcon}>
          <AlertDialogTitle className="text-xl font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {onCancel && (
            <AlertDialogCancel onClick={handleCancel} className="min-w-24">
              {cancelText || 'Cancelar'}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn('min-w-24', getActionButtonClass())}
          >
            {confirmText || 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
