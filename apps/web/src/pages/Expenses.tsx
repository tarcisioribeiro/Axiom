/* eslint-disable max-lines */
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Download,
  GitFork,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { DataTable } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { ExportModal } from '@/components/common/ExportModal';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { TransactionsTabsNav } from '@/components/common/TransactionsTabsNav';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ExpenseSplitsModal } from '@/components/expenses/ExpenseSplitsModal';
import { ReceiptButton } from '@/components/receipts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
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
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS, PAYMENT_STATUS_ICONS } from '@/config/icons';
import { useCurrentMember } from '@/hooks/use-current-member';
import { useExpensesPage } from '@/hooks/use-expenses-page';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';
import type { Expense } from '@/types';

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function Expenses({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  // Pré-carrega para o modal do formulário já abrir completo (sem campo surgindo depois).
  useCurrentMember();
  const [splitExpense, setSplitExpense] = useState<Expense | null>(null);
  const {
    expenses,
    accounts,
    loans,
    payables,
    fixedExpenses,
    isLoading,
    page,
    setPage,
    pageSize,
    totalCount,
    isDialogOpen,
    setIsDialogOpen,
    selectedExpense,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isExportModalOpen,
    setIsExportModalOpen,
    clearFilters,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleRedistributedSuccess,
    handleExport,
    hasActiveFilters,
    columns,
    prefillExpenseData,
  } = useExpensesPage();

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader title={t('pages.expenses.title')} icon={<TrendingDown />}>
        <div className="gap-sm flex items-center">
          <Can action="export">
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-sm"
            >
              <Download className="h-4 w-4" />
              {t('common.actions.export')}
            </Button>
          </Can>
          <Can action="add">
            <Button onClick={handleCreate} className="gap-sm">
              <Plus className="h-4 w-4" />
              {t('pages.expenses.newBtn')}
            </Button>
          </Can>
        </div>
      </PageHeader>

      {embedded && <TransactionsTabsNav />}

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.expenses.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-44"
          />
        </FilterField>
        <FilterField label={t('common.fields.category')} icon={Tag}>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.expenses.allCategories')}
              startIcon={<Tag className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.expenses.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.expenses.allCategories')}</SelectItem>
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
        <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-36"
              aria-label={t('pages.expenses.allStatus')}
              startIcon={<CircleDot className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.expenses.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.expenses.allStatus')}</SelectItem>
              <SelectItem
                value="paid"
                icon={<PAYMENT_STATUS_ICONS.paid className="h-4 w-4" />}
              >
                {t('common.status.paid')}
              </SelectItem>
              <SelectItem
                value="pending"
                icon={<PAYMENT_STATUS_ICONS.pending className="h-4 w-4" />}
              >
                {t('common.status.pending')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </FilterField>
      </FilterBar>

      <DataTable
        data={expenses}
        columns={columns}
        keyExtractor={(expense) => expense.id}
        isLoading={isLoading}
        rowClassName={(expense) => (expense.payed ? 'opacity-60' : '')}
        emptyState={{
          icon: <TrendingDown className="text-muted-foreground h-12 w-12" />,
          title: t('pages.expenses.emptyState'),
        }}
        pagination={{
          page,
          pageSize,
          total: totalCount,
          onPageChange: setPage,
        }}
        mobileCard={(expense) => (
          <div className="px-md py-3">
            <div className="gap-sm flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{expense.description}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {formatDate(expense.date)} ·{' '}
                  {translateCategory(expense.category, 'expense')}
                </p>
              </div>
              <div className="text-right">
                <p className="numeric text-destructive text-sm font-semibold">
                  {formatCurrency(parseFloat(expense.value))}
                </p>
                <span
                  className={`px-xs text-2xs mt-0.5 inline-block rounded py-0.5 font-medium ${
                    expense.payed
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {expense.payed ? t('common.status.paid') : t('common.status.pending')}
                </span>
              </div>
            </div>
            <div className="mt-sm gap-xs flex items-center justify-center">
              {expense.payed && (
                <ReceiptButton
                  source={{ type: 'expense', data: expense }}
                  memberName={getMemberDisplayName(expense.member_name, user)}
                />
              )}
              <Can action="change">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(expense)}
                  aria-label={t('common.actions.edit')}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
              <Can action="delete">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(expense.id)}
                  aria-label={t('common.actions.delete')}
                >
                  <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
            </div>
          </div>
        )}
        actions={(expense) => (
          <div className="gap-sm flex items-center justify-center">
            {expense.payed && (
              <ReceiptButton
                source={{ type: 'expense', data: expense }}
                memberName={getMemberDisplayName(expense.member_name, user)}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSplitExpense(expense)}
              aria-label={t('pages.expenses.splits.manage')}
              title={t('pages.expenses.splits.manage')}
            >
              <GitFork className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Can action="change">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(expense)}
                aria-label={t('common.actions.edit')}
                title={t('common.actions.edit')}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
            <Can action="delete">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(expense.id)}
                aria-label={t('common.actions.delete')}
                title={t('common.actions.delete')}
              >
                <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        )}
      />

      <ExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        title={t('pages.expenses.exportTitle')}
        onExport={handleExport}
        initialDateFrom={startDate}
        initialDateTo={endDate}
      />

      <ExpenseSplitsModal
        expense={splitExpense}
        open={!!splitExpense}
        onOpenChange={(v) => {
          if (!v) setSplitExpense(null);
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle mode={selectedExpense ? 'edit' : 'create'}>
              {selectedExpense
                ? t('pages.expenses.editTitle')
                : t('pages.expenses.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedExpense
                  ? t('pages.expenses.editDesc')
                  : t('pages.expenses.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <ExpenseForm
            expense={selectedExpense}
            prefillData={!selectedExpense ? prefillExpenseData : undefined}
            accounts={accounts}
            loans={loans}
            payables={payables}
            fixedExpenses={fixedExpenses}
            onSubmit={handleSubmit}
            onRedistributedSuccess={handleRedistributedSuccess}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
