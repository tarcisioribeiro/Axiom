import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { AmortizationSchedule, Loan } from '@/types';

interface LoanAmortizationDialogProps {
  loan: Loan | null;
  amortization: AmortizationSchedule | null;
  method: 'price' | 'sac';
  isLoading: boolean;
  onClose: () => void;
  onChangeMethod: (loan: Loan, method: 'price' | 'sac') => void;
}

export function LoanAmortizationDialog({
  loan,
  amortization,
  method,
  isLoading,
  onClose,
  onChangeMethod,
}: LoanAmortizationDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={!!loan}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="custom-scrollbar max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.loans.amortization.title')}</DialogTitle>
          <DialogDescription>{loan?.description}</DialogDescription>
        </DialogHeader>
        <div className="mb-md flex items-center gap-3">
          <Label>{t('pages.loans.amortization.method')}:</Label>
          <div className="flex gap-sm">
            {(['price', 'sac'] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={method === m ? 'default' : 'outline'}
                onClick={() => loan && onChangeMethod(loan, m)}
              >
                {t(`pages.loans.amortization.${m}`)}
              </Button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="py-xl text-center text-sm text-muted-foreground">
            {t('pages.loans.amortization.loading')}
          </div>
        ) : !amortization ? (
          <div className="py-xl text-center text-sm text-muted-foreground">
            {t('pages.loans.amortization.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-sm pr-3">#</th>
                  <th className="pb-sm pr-3">
                    {t('pages.loans.amortization.dueDate')}
                  </th>
                  <th className="pb-sm pr-3 text-right">
                    {t('pages.loans.amortization.payment')}
                  </th>
                  <th className="pb-sm pr-3 text-right">
                    {t('pages.loans.amortization.principal')}
                  </th>
                  <th className="pb-sm pr-3 text-right">
                    {t('pages.loans.amortization.interest')}
                  </th>
                  <th className="pb-sm text-right">
                    {t('pages.loans.amortization.balance')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {amortization.schedule.map((entry) => (
                  <tr key={entry.installment} className="border-b last:border-0">
                    <td className="py-xs pr-3">{entry.installment}</td>
                    <td className="py-xs pr-3">
                      {formatDate(entry.due_date, 'dd/MM/yyyy')}
                    </td>
                    <td className="py-xs pr-3 text-right">
                      {formatCurrency(entry.payment)}
                    </td>
                    <td className="py-xs pr-3 text-right">
                      {formatCurrency(entry.principal)}
                    </td>
                    <td className="py-xs pr-3 text-right">
                      {formatCurrency(entry.interest)}
                    </td>
                    <td className="py-xs text-right">
                      {formatCurrency(entry.balance)}
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
