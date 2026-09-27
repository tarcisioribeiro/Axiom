import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { InstallmentsPlanDialog } from '@/components/common/InstallmentsPlanDialog';
import { Button } from '@/components/ui/button';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import type { Payable, PayableInstallment } from '@/types';

interface PayableInstallmentsDialogProps {
  payable: Payable | null;
  installments: PayableInstallment[];
  isLoading: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onIncreaseValue?: () => void;
}

export function PayableInstallmentsDialog({
  payable,
  installments,
  isLoading,
  onClose,
  onUpdated,
  onIncreaseValue,
}: PayableInstallmentsDialogProps) {
  const { t } = useTranslation();
  const canIncrease =
    !!payable?.is_cumulative &&
    payable.status !== 'paid' &&
    payable.status !== 'cancelled';

  return (
    <InstallmentsPlanDialog
      open={!!payable}
      title={t('pages.payables.installments.title')}
      description={payable?.description}
      installments={installments}
      isLoading={isLoading}
      i18nBase="pages.payables.installments"
      onClose={onClose}
      onChanged={() => onUpdated?.()}
      extra={
        canIncrease && (
          <div className="gap-sm flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onIncreaseValue}
              className="gap-xs text-xs"
            >
              <TrendingUp className="h-3 w-3" />
              {t('pages.payables.form.increaseValueBtn')}
            </Button>
          </div>
        )
      }
      saveInstallment={async (num, data) => {
        if (!payable) return;
        await payableInstallmentsService.updateInstallment(payable.id, num, data);
      }}
      recalculate={async (count, dryRun) => {
        if (!payable) return { installments_preview: [] };
        const res = await payableInstallmentsService.recalculateInstallments(
          payable.id,
          'change_count',
          count,
          dryRun
        );
        return { installments_preview: res.preview.installments_preview };
      }}
    />
  );
}
