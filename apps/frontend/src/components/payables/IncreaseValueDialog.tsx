import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import type { Payable, RecalculationPreview } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { RecalculationPreviewDialog } from './RecalculationPreviewDialog';

interface IncreaseValueDialogProps {
  payable: Payable | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function IncreaseValueDialog({
  payable,
  onClose,
  onSuccess,
}: IncreaseValueDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [newValue, setNewValue] = useState(0);
  const [preview, setPreview] = useState<RecalculationPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!payable) return null;

  const handleRequestPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const { preview: result } = await payableInstallmentsService.increaseValue(
        payable.id,
        newValue,
        true
      );
      setPreview(result);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await payableInstallmentsService.increaseValue(payable.id, newValue, false);
      toast({
        title: t('pages.payables.form.valueIncreased'),
        description: t('pages.payables.form.valueIncreasedDesc'),
      });
      onSuccess?.();
      handleClose();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    setNewValue(0);
    onClose();
  };

  if (preview) {
    return (
      <RecalculationPreviewDialog
        open
        title={t('pages.payables.form.recalculationPreviewTitle')}
        description={payable.description}
        preview={preview}
        isLoading={isConfirming}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setPreview(null)}
      />
    );
  }

  return (
    <Dialog open={!!payable} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pages.payables.form.increaseValueTitle')}</DialogTitle>
          <DialogDescription>
            {payable.description} — {t('pages.payables.form.increaseValueDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="space-y-xs">
            <Label>{t('pages.payables.form.newValueLabel')} *</Label>
            <CurrencyInput
              accentColor="destructive"
              value={newValue}
              onChange={(e) => setNewValue(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleRequestPreview()}
            disabled={isLoadingPreview || newValue <= parseFloat(payable.value)}
          >
            {isLoadingPreview ? t('common.actions.loading') : t('common.actions.next')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
