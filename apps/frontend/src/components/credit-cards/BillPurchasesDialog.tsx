import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { translate } from '@/config/constants';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { creditCardInstallmentsService } from '@/services/credit-card-installments-service';
import type { CreditCardBill } from '@/types';

interface BillPurchasesDialogProps {
  bill?: CreditCardBill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BillPurchasesDialog({
  bill,
  open,
  onOpenChange,
}: BillPurchasesDialogProps) {
  const { t } = useTranslation();

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['credit-card-bills', bill?.id, 'installments'],
    queryFn: () => creditCardInstallmentsService.getByBill(bill!.id),
    enabled: open && !!bill,
  });

  const sorted = [...installments].sort((a, b) =>
    (a.purchase_date ?? a.due_date).localeCompare(b.purchase_date ?? b.due_date)
  );
  // Total da fatura: soma todas as compras, não só a página visível.
  const total = sorted.reduce((sum, i) => sum + Number(i.value), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <ShoppingCart
              className="text-primary h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {t('pages.creditCardBills.purchases.title')}
            {bill && ` - ${translate('months', bill.month)}/${bill.year}`}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              {t('pages.creditCardBills.purchases.title')}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>

        {isLoading ? (
          <LoadingState />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="text-muted-foreground h-10 w-10" />}
            title={t('pages.creditCardBills.purchases.empty')}
          />
        ) : (
          <div className="min-h-[24rem]">
            <PaginatedSlide
              items={sorted}
              pageSize={LIST_PAGE_SIZE}
              pinNav={false}
              centerList
            >
              {(pageItems) => (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('pages.creditCardBills.purchases.date')}</TableHead>
                      <TableHead>
                        {t('pages.creditCardBills.purchases.description')}
                      </TableHead>
                      <TableHead>
                        {t('pages.creditCardBills.purchases.category')}
                      </TableHead>
                      <TableHead>
                        {t('pages.creditCardBills.purchases.installment')}
                      </TableHead>
                      <TableHead className="text-right">
                        {t('pages.creditCardBills.purchases.value')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="text-sm">
                          {formatDate(i.purchase_date ?? i.due_date)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {i.description || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {i.category ? translateCategory(i.category, 'expense') : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {i.installment_number}/{i.total_installments ?? 1}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(i.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>
                        {t('pages.creditCardBills.purchases.total')}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </PaginatedSlide>
          </div>
        )}
        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
