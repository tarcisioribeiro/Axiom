import { useQuery } from '@tanstack/react-query';
import { CreditCard, Landmark, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import {
  Dialog,
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
import { translate } from '@/config/constants';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { creditCardInstallmentsService } from '@/services/credit-card-installments-service';
import { expensesService } from '@/services/expenses-service';
import type { Budget, Expense } from '@/types';

// Bills store the month as an English abbreviation ("Jan", "Feb", ...)
const BILL_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface Row {
  key: string;
  date: string;
  description: string;
  source: 'account' | 'card';
  sourceName: string;
  installment?: string;
  value: number;
}

interface BudgetPurchasesDialogProps {
  budget?: Budget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetPurchasesDialog({
  budget,
  open,
  onOpenChange,
}: BudgetPurchasesDialogProps) {
  const { t } = useTranslation();
  const enabled = open && !!budget;

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', 'budget', budget?.category, budget?.month, budget?.year],
    queryFn: () =>
      expensesService.getAllPages({
        category: budget!.category,
        month: budget!.month,
        year: budget!.year,
      }),
    enabled,
  });

  const { data: installments = [], isLoading: loadingInstallments } = useQuery({
    queryKey: [
      'credit-card-installments',
      'budget',
      budget?.category,
      budget?.month,
      budget?.year,
    ],
    queryFn: () =>
      creditCardInstallmentsService.getAll({
        purchase__category: budget!.category,
        bill__month: BILL_MONTHS[budget!.month - 1],
        bill__year: budget!.year,
      }),
    enabled,
  });

  const rows: Row[] = [
    // Bill payments are already listed below as card installments
    ...expenses
      .filter((e: Expense) => !e.related_bill_payment)
      .map((e) => ({
        key: `e-${e.id}`,
        date: e.date,
        description: e.description,
        source: 'account' as const,
        sourceName: e.account_name ?? '—',
        value: Number(e.value),
      })),
    ...installments.map((i) => ({
      key: `i-${i.id}`,
      date: i.purchase_date ?? i.due_date,
      description: i.description ?? '',
      source: 'card' as const,
      sourceName: i.card_name ?? '—',
      installment: `${i.installment_number}/${i.total_installments ?? 1}`,
      value: Number(i.value),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const total = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('pages.budgets.purchases.title')}
            {budget && ` — ${translate('expenseCategories', budget.category)}`}
          </DialogTitle>
          <DialogDescription>
            {budget && `${String(budget.month).padStart(2, '0')}/${budget.year}`}
          </DialogDescription>
        </DialogHeader>

        {loadingExpenses || loadingInstallments ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="text-muted-foreground h-10 w-10" />}
            message={t('pages.budgets.purchases.empty')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.budgets.purchases.date')}</TableHead>
                <TableHead>{t('pages.budgets.purchases.description')}</TableHead>
                <TableHead>{t('pages.budgets.purchases.source')}</TableHead>
                <TableHead className="text-right">
                  {t('pages.budgets.purchases.value')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const Icon = r.source === 'card' ? CreditCard : Landmark;
                return (
                  <TableRow key={r.key}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium">
                      {r.description || '—'}
                      {r.installment && (
                        <span className="text-muted-foreground ml-xs text-xs">
                          ({r.installment})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="gap-xs flex items-center">
                        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span>
                          {t(`pages.budgets.purchases.${r.source}`)}: {r.sourceName}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(r.value)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>{t('pages.budgets.purchases.total')}</TableCell>
                <TableCell className="text-right font-bold">
                  {formatCurrency(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
