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
import type { Payable, PayableInstallment } from '@/types';

interface PayableInstallmentsDialogProps {
  payable: Payable | null;
  installments: PayableInstallment[];
  isLoading: boolean;
  onClose: () => void;
}

export function PayableInstallmentsDialog({
  payable,
  installments,
  isLoading,
  onClose,
}: PayableInstallmentsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={!!payable} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="custom-scrollbar max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pages.payables.installments.title')}</DialogTitle>
          <DialogDescription>{payable?.description}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-xl text-center text-sm text-muted-foreground">
            {t('common.actions.loading')}
          </div>
        ) : installments.length === 0 ? (
          <div className="py-xl text-center text-sm text-muted-foreground">
            {t('pages.payables.installments.emptyState')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-sm pr-md">
                    {t('pages.payables.installments.number')}
                  </th>
                  <th className="pb-sm pr-md">
                    {t('pages.payables.installments.dueDate')}
                  </th>
                  <th className="pb-sm pr-md text-right">
                    {t('pages.payables.installments.value')}
                  </th>
                  <th className="pb-sm">{t('pages.payables.installments.status')}</th>
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
                          ? t('pages.payables.installments.paid')
                          : t('pages.payables.installments.pending')}
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
