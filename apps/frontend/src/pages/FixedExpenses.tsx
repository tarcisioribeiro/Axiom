/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Trash2,
  TrendingDown,
  History,
  Tag,
  Wallet,
  CircleDot,
} from 'lucide-react';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS, TASK_STATUS_ICONS } from '@/config/icons';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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
      render: (item) => {
        const StatusIcon = TASK_STATUS_ICONS[item.is_active ? 'active' : 'inactive'];
        return (
          <Badge variant={item.is_active ? 'default' : 'secondary'} className="gap-xs">
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {item.is_active ? t('common.status.active') : t('common.status.inactive')}
          </Badge>
        );
      },
    },
  ];

  const filteredExpenses = fixedExpenses.filter((item) => {
    if (
      searchTerm &&
      !item.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (accountFilter !== 'all' && String(item.account ?? '') !== accountFilter)
      return false;
    if (statusFilter !== 'all' && (statusFilter === 'active') !== item.is_active)
      return false;
    return true;
  });

  const hasActiveFilters =
    searchTerm !== '' ||
    categoryFilter !== 'all' ||
    accountFilter !== 'all' ||
    statusFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setAccountFilter('all');
    setStatusFilter('all');
  };

  return (
    <Wrapper embedded={embedded}>
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        activeFilters={[
          ...(categoryFilter !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('pages.fixedExpenses.allCategories')}: ${EXPENSE_CATEGORIES_CANONICAL.find((c) => c.key === categoryFilter)?.label ?? categoryFilter}`,
                  onRemove: () => setCategoryFilter('all'),
                },
              ]
            : []),
          ...(accountFilter !== 'all'
            ? [
                {
                  key: 'account',
                  label: `${t('pages.fixedExpenses.allAccounts')}: ${accounts.find((a) => String(a.id) === accountFilter)?.account_name ?? accountFilter}`,
                  onRemove: () => setAccountFilter('all'),
                },
              ]
            : []),
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${statusFilter === 'active' ? t('common.status.active') : t('common.status.inactive')}`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')}>
          <SearchInput
            placeholder={t('pages.fixedExpenses.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-44"
          />
        </FilterField>
        <FilterField label={t('common.fields.category')}>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.fixedExpenses.allCategories')}
              startIcon={<Tag className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.fixedExpenses.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.fixedExpenses.allCategories')}
              </SelectItem>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => {
                const Icon = EXPENSE_CATEGORY_ICONS[key];
                return (
                  <SelectItem
                    key={key}
                    value={key}
                    icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                  >
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.fields.account')}>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.fixedExpenses.allAccounts')}
              startIcon={<Wallet className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.fixedExpenses.allAccounts')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.fixedExpenses.allAccounts')}
              </SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.fields.status')}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-36"
              aria-label={t('pages.fixedExpenses.allStatus')}
              startIcon={<CircleDot className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.fixedExpenses.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.fixedExpenses.allStatus')}</SelectItem>
              <SelectItem
                value="active"
                icon={<TASK_STATUS_ICONS.active className="h-4 w-4" />}
              >
                {t('common.status.active')}
              </SelectItem>
              <SelectItem
                value="inactive"
                icon={<TASK_STATUS_ICONS.inactive className="h-4 w-4" />}
              >
                {t('common.status.inactive')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {/* Table */}
      <DataTable
        centerList
        pageSize={LIST_PAGE_SIZE}
        data={filteredExpenses}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyState={{
          icon: <TrendingDown className="text-muted-foreground h-12 w-12" />,
          title: t('pages.fixedExpenses.emptyState'),
        }}
        rowClassName={(item) => (item.is_active ? '' : 'opacity-60')}
        actions={(item) => (
          <div className="gap-sm flex items-center justify-center">
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
          <DialogHeader>
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
