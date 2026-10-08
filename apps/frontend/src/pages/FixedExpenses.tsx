/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, TrendingDown, History } from 'lucide-react';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { FixedExpenseForm } from '@/components/expenses/FixedExpenseForm';
import { LaunchExpensesDialog } from '@/components/expenses/LaunchExpensesDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { expensesService } from '@/services/expenses-service';
import { fixedExpensesService } from '@/services/fixed-expenses-service';
import type {
  Expense,
  FixedExpense,
  FixedExpenseFormData,
  Account,
  CreditCard,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const EMPTY_FIXED_EXPENSES: FixedExpense[] = [];
const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_CARDS: CreditCard[] = [];

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function FixedExpenses({
  embedded = false,
  newExpenseRef,
  launchExpensesRef,
}: {
  embedded?: boolean;
  newExpenseRef?: RefObject<(() => void) | undefined>;
  launchExpensesRef?: RefObject<(() => void) | undefined>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyItem, setHistoryItem] = useState<FixedExpense | null>(null);
  const [historyExpenses, setHistoryExpenses] = useState<Expense[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    if (newExpenseRef) {
      newExpenseRef.current = () => {
        setSelectedExpense(undefined);
        setIsDialogOpen(true);
      };
    }
    if (launchExpensesRef) {
      launchExpensesRef.current = () => setIsLaunchDialogOpen(true);
    }
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['fixed-expenses'],
    queryFn: async () => {
      try {
        const [expensesData, accountsData, cardsData] = await Promise.all([
          fixedExpensesService.getAll(),
          accountsService.getAll(),
          creditCardsService.getAll(),
        ]);
        return {
          fixedExpenses: expensesData,
          accounts: accountsData,
          creditCards: cardsData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return {
          fixedExpenses: EMPTY_FIXED_EXPENSES,
          accounts: EMPTY_ACCOUNTS,
          creditCards: EMPTY_CARDS,
        };
      }
    },
  });
  const fixedExpenses = pageData?.fixedExpenses ?? EMPTY_FIXED_EXPENSES;
  const accounts = pageData?.accounts ?? EMPTY_ACCOUNTS;
  const creditCards = pageData?.creditCards ?? EMPTY_CARDS;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });

  const openHistory = async (item: FixedExpense) => {
    setHistoryItem(item);
    setHistoryExpenses([]);
    setHistoryLoading(true);
    try {
      const results = await expensesService.getAll({ fixed_expense_template: item.id });
      setHistoryExpenses(Array.isArray(results) ? results : []);
    } catch {
      setHistoryExpenses([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (data: FixedExpenseFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedExpense) {
        await fixedExpensesService.update(selectedExpense.id, data);
        toast({
          title: t('pages.fixedExpenses.updated'),
        });
      } else {
        await fixedExpensesService.create(data);
        toast({
          title: t('pages.fixedExpenses.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.fixedExpenses.deleteTitle'),
      description: t('pages.fixedExpenses.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await fixedExpensesService.delete(id);
      toast({
        title: t('pages.fixedExpenses.deleted'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const columns: Column<FixedExpense>[] = [
    {
      key: 'description',
      label: t('pages.fixedExpenses.columns.description'),
      render: (item) => <span className="font-medium">{item.description}</span>,
    },
    {
      key: 'default_value',
      label: t('pages.fixedExpenses.columns.defaultAmount'),
      align: 'right',
      render: (item) => (
        <span className="text-destructive font-semibold">
          {formatCurrency(item.default_value)}
        </span>
      ),
    },
    {
      key: 'due_day',
      label: t('pages.fixedExpenses.columns.dueDay'),
      align: 'center',
      render: (item) => (
        <Badge variant="outline">
          {t('pages.fixedExpenses.dueDayBadge', { day: item.due_day })}
        </Badge>
      ),
    },
    {
      key: 'account_name',
      label: t('pages.fixedExpenses.columns.account'),
      render: (item) => <Badge variant="outline">{item.account_name || 'N/A'}</Badge>,
    },
    {
      key: 'category',
      label: t('pages.fixedExpenses.columns.category'),
      render: (item) => (
        <Badge variant="secondary">
          {translate('expenseCategories', item.category)}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: t('pages.fixedExpenses.columns.status'),
      render: (item) => (
        <Badge variant={item.is_active ? 'default' : 'secondary'}>
          {item.is_active ? t('common.status.active') : t('common.status.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <Wrapper embedded={embedded}>
      {/* Table */}
      <DataTable
        centerList
        pageSize={7}
        data={fixedExpenses}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyState={{
          icon: <TrendingDown className="text-muted-foreground h-12 w-12" />,
          title: t('pages.fixedExpenses.emptyState'),
        }}
        rowClassName={(item) => (item.is_active ? '' : 'opacity-60')}
        actions={(item) => (
          <div className="gap-sm flex items-center justify-end">
            {item.total_generated > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void openHistory(item)}
                aria-label={t('pages.fixedExpenses.historyBtn')}
                title={t('pages.fixedExpenses.historyBtn')}
              >
                <History className="text-muted-foreground h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedExpense(item);
                setIsDialogOpen(true);
              }}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(item.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader sticky>
            <DialogTitle mode={selectedExpense ? 'edit' : 'create'}>
              {selectedExpense
                ? t('pages.fixedExpenses.editTitle')
                : t('pages.fixedExpenses.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedExpense
                  ? t('pages.fixedExpenses.editDesc')
                  : t('pages.fixedExpenses.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <FixedExpenseForm
            fixedExpense={selectedExpense}
            accounts={accounts}
            creditCards={creditCards}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Launch Dialog */}
      <LaunchExpensesDialog
        isOpen={isLaunchDialogOpen}
        onClose={() => setIsLaunchDialogOpen(false)}
        fixedExpenses={fixedExpenses.filter((e) => e.is_active)}
        onSuccess={refresh}
      />

      {/* History Dialog */}
      <Dialog
        open={!!historyItem}
        onOpenChange={(v) => {
          if (!v) setHistoryItem(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <History className="h-4 w-4" />
              {t('pages.fixedExpenses.historyTitle')}: {historyItem?.description}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.fixedExpenses.historyDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {historyLoading ? (
            <p className="py-md text-muted-foreground text-center text-sm">
              {t('common.actions.loading')}
            </p>
          ) : historyExpenses.length === 0 ? (
            <p className="py-md text-muted-foreground text-center text-sm">
              {t('pages.fixedExpenses.historyEmpty')}
            </p>
          ) : (
            <PaginatedSlide items={historyExpenses} pageSize={5} pinNav={false}>
              {(pageItems) => (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                      <th className="pb-xs pr-md">{t('common.fields.date')}</th>
                      <th className="pb-xs pr-md">{t('common.fields.description')}</th>
                      <th className="pb-xs text-right">{t('common.fields.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pageItems.map((exp) => (
                      <tr key={exp.id}>
                        <td className="py-xs pr-md text-muted-foreground">
                          {formatDate(exp.date)}
                        </td>
                        <td className="py-xs pr-md">{exp.description}</td>
                        <td
                          className={cn(
                            'py-xs text-right font-medium',
                            exp.payed
                              ? 'text-muted-foreground line-through'
                              : 'text-destructive'
                          )}
                        >
                          {formatCurrency(exp.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PaginatedSlide>
          )}
          <DialogCloseFooter />
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
