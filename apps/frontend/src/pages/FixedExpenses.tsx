/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  TrendingDown,
  History,
  ClipboardList,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { FixedExpenseForm } from '@/components/expenses/FixedExpenseForm';
import { FixedExpenseStats } from '@/components/expenses/FixedExpenseStats';
import { LaunchExpensesDialog } from '@/components/expenses/LaunchExpensesDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { creditCardsService } from '@/services/credit-cards-service';
import { expensesService } from '@/services/expenses-service';
import { fixedExpensesService } from '@/services/fixed-expenses-service';
import type {
  Expense,
  FixedExpense,
  FixedExpenseFormData,
  FixedExpenseGenerationLog,
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

export default function FixedExpenses({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyItem, setHistoryItem] = useState<FixedExpense | null>(null);
  const [historyExpenses, setHistoryExpenses] = useState<Expense[]>([]);
  const [showGenerationLog, setShowGenerationLog] = useState(false);

  const generationLogQuery = useQuery<FixedExpenseGenerationLog[]>({
    queryKey: ['fixedExpenses', 'generationLog'],
    queryFn: () => fixedExpensesService.getGenerationLog(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    enabled: showGenerationLog,
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

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
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
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
          description: t('pages.fixedExpenses.updatedDesc'),
        });
      } else {
        await fixedExpensesService.create(data);
        toast({
          title: t('pages.fixedExpenses.created'),
          description: t('pages.fixedExpenses.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
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
        description: t('pages.fixedExpenses.deletedDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const columns: Column<FixedExpense>[] = [
    {
      key: 'description',
      label: t('pages.fixedExpenses.columns.description'),
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
            {item.due_day}
          </div>
          <div>
            <div className="font-medium">{item.description}</div>
            <div className="text-muted-foreground text-xs">
              {t('pages.fixedExpenses.dueDayDesc', { day: item.due_day })}
            </div>
          </div>
        </div>
      ),
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
    {
      key: 'total_generated',
      label: t('pages.fixedExpenses.columns.generated'),
      align: 'center',
      render: (item) => <span className="text-sm">{item.total_generated}x</span>,
    },
  ];

  return (
    <Wrapper embedded={embedded}>
      <PageHeader
        title={t('pages.fixedExpenses.title')}
        icon={<Calendar className="h-6 w-6" />}
        action={{
          label: t('pages.fixedExpenses.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setSelectedExpense(undefined);
            setIsDialogOpen(true);
          },
        }}
      />

      {/* Stats Dashboard */}
      <FixedExpenseStats />

      {/* 3 cards horizontais: lançamento | comprometimento | calendário */}
      {(() => {
        const activeExpenses = fixedExpenses.filter((e) => e.is_active);
        const totalMonthlyFixed = activeExpenses.reduce(
          (sum, e) => sum + parseFloat(e.default_value || '0'),
          0
        );
        return (
          <div
            className={cn(
              'gap-md grid',
              activeExpenses.length > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'
            )}
          >
            {/* Card 1: Lançamento */}
            <div className="bg-card p-md flex flex-col justify-between rounded-lg border">
              <div>
                <h3 className="text-base font-semibold">
                  {t('pages.fixedExpenses.launchSection')}
                </h3>
                <p className="mt-xs text-muted-foreground text-sm">
                  {t('pages.fixedExpenses.launchDesc')}
                </p>
              </div>
              <Button
                onClick={() => setIsLaunchDialogOpen(true)}
                className="mt-md w-full"
              >
                <TrendingDown className="mr-sm h-4 w-4" />
                {t('pages.fixedExpenses.launchBtn')}
              </Button>
            </div>

            {activeExpenses.length > 0 && (
              <>
                {/* Card 2: Comprometimento */}
                <div className="bg-card p-md rounded-lg border">
                  <p className="text-sm font-medium">
                    {t('pages.fixedExpenses.stats.monthlyCommitment')}
                  </p>
                  <p className="mt-xs text-destructive text-2xl font-bold">
                    {formatCurrency(totalMonthlyFixed)}
                  </p>
                  <p className="mt-sm text-muted-foreground text-xs">
                    {t('pages.fixedExpenses.stats.activeCountDesc', {
                      count: activeExpenses.length,
                    })}
                  </p>
                </div>

                {/* Card 3: Calendário */}
                <div className="bg-card p-md rounded-lg border">
                  <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                    {t('pages.fixedExpenses.scheduleTitle')}
                  </p>
                  <div className="gap-sm flex flex-wrap">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                      const expensesOnDay = activeExpenses.filter(
                        (e) => e.due_day === day
                      );
                      const hasExpense = expensesOnDay.length > 0;
                      return (
                        <div
                          key={day}
                          title={
                            hasExpense
                              ? expensesOnDay.map((e) => e.description).join(', ')
                              : undefined
                          }
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                            hasExpense
                              ? 'bg-destructive/15 text-destructive ring-destructive/30 ring-1'
                              : 'text-muted-foreground'
                          )}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Table */}
      <DataTable
        data={fixedExpenses}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyState={{
          icon: <TrendingDown className="text-muted-foreground h-12 w-12" />,
          message: t('pages.fixedExpenses.emptyState'),
        }}
        rowClassName={(item) =>
          item.is_active
            ? 'border-l-4 border-l-destructive/50'
            : 'border-l-4 border-l-muted opacity-60'
        }
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

      {/* Generation Log */}
      <div className="bg-card rounded-lg border">
        <button
          type="button"
          className="px-md py-sm flex w-full items-center justify-between text-left"
          onClick={() => setShowGenerationLog((v) => !v)}
        >
          <div className="gap-sm flex items-center">
            <ClipboardList className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">
              {t('pages.fixedExpenses.generationLog.viewLog')}
            </span>
          </div>
          {showGenerationLog ? (
            <ChevronUp className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          )}
        </button>
        {showGenerationLog && (
          <div className="px-md pb-md pt-sm border-t">
            {generationLogQuery.isLoading ? (
              <p className="py-sm text-muted-foreground text-center text-sm">
                {t('common.actions.loading')}
              </p>
            ) : !generationLogQuery.data?.length ? (
              <p className="py-sm text-muted-foreground text-center text-sm">
                {t('pages.fixedExpenses.generationLog.emptyState')}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="pb-xs pr-md">
                      {t('pages.fixedExpenses.generationLog.month')}
                    </th>
                    <th className="pb-xs pr-md text-right">
                      {t('pages.fixedExpenses.generationLog.totalGenerated')}
                    </th>
                    <th className="pb-xs pr-md">
                      {t('pages.fixedExpenses.generationLog.generatedBy')}
                    </th>
                    <th className="pb-xs text-right">
                      {t('pages.fixedExpenses.generationLog.generatedAt')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {generationLogQuery.data.map((log) => (
                    <tr key={log.id}>
                      <td className="py-xs pr-md font-medium">{log.month}</td>
                      <td className="py-xs pr-md text-right">{log.total_generated}</td>
                      <td className="py-xs pr-md text-muted-foreground">
                        {log.generated_by_name ?? '—'}
                      </td>
                      <td className="py-xs text-muted-foreground text-right">
                        {formatDate(log.created_at, 'dd/MM/yyyy HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedExpense
                ? t('pages.fixedExpenses.editTitle')
                : t('pages.fixedExpenses.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedExpense
                ? t('pages.fixedExpenses.editDesc')
                : t('pages.fixedExpenses.newDesc')}
            </DialogDescription>
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
            <DialogDescription>
              {t('pages.fixedExpenses.historyDesc')}
            </DialogDescription>
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
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="pb-xs pr-md">{t('common.fields.date')}</th>
                    <th className="pb-xs pr-md">{t('common.fields.description')}</th>
                    <th className="pb-xs text-right">{t('common.fields.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyExpenses.map((exp) => (
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
