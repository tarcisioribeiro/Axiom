import { useTranslation } from 'react-i18next';

import { InstallmentsPlanDialog } from '@/components/common/InstallmentsPlanDialog';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import type { Payable, PayableInstallment } from '@/types';

interface PayableInstallmentsDialogProps {
  payable: Payable | null;
  installments: PayableInstallment[];
  isLoading: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function PayableInstallmentsDialog({
  payable,
  installments,
  isLoading,
  onClose,
  onUpdated,
}: PayableInstallmentsDialogProps) {
  const { t } = useTranslation();

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
