import { useTranslation } from 'react-i18next';

import { InstallmentsPlanDialog } from '@/components/common/InstallmentsPlanDialog';
import { loanInstallmentsService } from '@/services/loan-installments-service';
import type { Loan, LoanInstallment } from '@/types';

interface LoanInstallmentsDialogProps {
  loan: Loan | null;
  installments: LoanInstallment[];
  isLoading: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function LoanInstallmentsDialog({
  loan,
  installments,
  isLoading,
  onClose,
  onUpdated,
}: LoanInstallmentsDialogProps) {
  const { t } = useTranslation();

  return (
    <InstallmentsPlanDialog
      open={!!loan}
      title={t('pages.loans.installments.title')}
      description={loan?.description}
      installments={installments}
      isLoading={isLoading}
      i18nBase="pages.loans.installments"
      onClose={onClose}
      onChanged={() => onUpdated?.()}
      saveInstallment={async (num, data) => {
        if (!loan) return;
        await loanInstallmentsService.updateInstallment(loan.id, num, data);
      }}
      recalculate={async (count, dryRun) => {
        if (!loan) return { installments_preview: [] };
        const res = await loanInstallmentsService.recalculateInstallments(
          loan.id,
          'change_count',
          count,
          dryRun
        );
        return { installments_preview: res.preview.installments_preview };
      }}
    />
  );
}
