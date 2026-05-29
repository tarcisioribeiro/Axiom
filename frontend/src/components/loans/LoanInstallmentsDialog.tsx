import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { Loan, LoanInstallment } from '@/types';

interface LoanInstallmentsDialogProps {
  loan: Loan | null;
  installments: LoanInstallment[];
  isLoading: boolean;
  onClose: () => void;
}

export function LoanInstallmentsDialog({
  loan,
  installments,
  isLoading,
  onClose,
}: LoanInstallmentsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={!!loan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="custom-scrollbar max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.loans.installments.title')}</DialogTitle>
          <DialogDescription>{loan?.description}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-xl text-center text-sm text-muted-foreground">
            {t('common.actions.loading')}
          </div>
        ) : installments.length === 0 ? (
          <div className="py-xl text-center text-sm text-muted-foreground">
            {t('pages.loans.installments.emptyState')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-sm pr-md">
                    {t('pages.loans.installments.number')}
                  </th>
                  <th className="pb-sm pr-md">
                    {t('pages.loans.installments.dueDate')}
                  </th>
                  <th className="pb-sm pr-md text-right">
                    {t('pages.loans.installments.value')}
                  </th>
                  <th className="pb-sm">{t('pages.loans.installments.status')}</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst) => (
                  <tr key={inst.id} className="border-b last:border-0">
                    <td className="py-sm pr-md">{inst.installment_number}</td>
                    <td className="py-sm pr-md">
                      {formatDate(inst.due_date, 'dd/MM/yyyy')}
                    </td>
                    <td className="py-sm pr-md text-right">
                      {formatCurrency(inst.value)}
                    </td>
                    <td className="py-sm">
                      <Badge variant={inst.payed ? 'secondary' : 'outline'}>
                        {inst.payed
                          ? t('pages.loans.installments.paid')
                          : t('pages.loans.installments.pending')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
