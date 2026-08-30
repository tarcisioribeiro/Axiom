/* eslint-disable max-lines */
import {
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  Download,
  CheckCircle2,
  Clock,
  Tag,
  CircleDot,
  GitFork,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { ExportModal } from '@/components/common/ExportModal';
import { FilterBar } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ExpenseSplitsModal } from '@/components/expenses/ExpenseSplitsModal';
import { ReceiptButton } from '@/components/receipts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
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
    totalExpenses,
    hasActiveFilters,
    columns,
    prefillExpenseData,
  } = useExpensesPage({ onAfterCreate: setSplitExpense });

  const BREAKDOWN_COLORS = [
    'bg-primary',
    'bg-success',
    'bg-warning',
    'bg-info',
    'bg-accent',
    'bg-destructive',
  ] as const;

  const { paidCount, paidAmount, pendingCount, pendingAmount } = useMemo(() => {
    const filtered = expenses.filter(
      (e) => !e.related_transfer && !e.is_transfer_generated && !e.is_initial_balance
    );
    const paid = filtered.filter((e) => e.payed);
    const pending = filtered.filter((e) => !e.payed);
    return {
      paidCount: paid.length,
      paidAmount: paid.reduce((s, e) => s + parseFloat(e.value), 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, e) => s + parseFloat(e.value), 0),
    };
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const e of expenses.filter(
      (e) => !e.related_transfer && !e.is_transfer_generated && !e.is_initial_balance
    )) {
      groups[e.category] = (groups[e.category] ?? 0) + parseFloat(e.value);
    }
    const total = Object.values(groups).reduce((s, v) => s + v, 0);
    return Object.entries(groups)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([cat, amount]) => ({
        cat,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }));
  }, [expenses]);

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader title={t('pages.expenses.title')} icon={<TrendingDown />}>
        <div className="gap-sm flex items-center">
          <Button
            variant="outline"
            onClick={() => setIsExportModalOpen(true)}
            className="gap-sm"
          >
            <Download className="h-4 w-4" />
            {t('common.actions.export')}
          </Button>
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.expenses.newBtn')}
          </Button>
        </div>
      </PageHeader>

      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        activeFilters={[
          ...(categoryFilter !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('pages.expenses.allCategories')}: ${EXPENSE_CATEGORIES_CANONICAL.find((c) => c.key === categoryFilter)?.label ?? categoryFilter}`,
                  onRemove: () => setCategoryFilter('all'),
                },
              ]
            : []),
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${statusFilter === 'paid' ? t('common.status.paid') : t('common.status.pending')}`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
          ...(startDate
            ? [
                {
                  key: 'startDate',
                  label: `${t('common.fields.from')}: ${formatDate(startDate)}`,
                  onRemove: () => setStartDate(undefined),
                },
              ]
            : []),
          ...(endDate
            ? [
                {
                  key: 'endDate',
                  label: `${t('common.fields.to')}: ${formatDate(endDate)}`,
                  onRemove: () => setEndDate(undefined),
                },
              ]
            : []),
        ]}
      >
        <SearchInput
          placeholder={t('pages.expenses.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-44 flex-none"
        />
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
            <SelectItem value="paid">{t('common.status.paid')}</SelectItem>
            <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </FilterBar>

      <div className="gap-md grid grid-cols-1 sm:grid-cols-3">
        <Card className="border-t-destructive/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">
              {t('pages.expenses.stats.totalAmount')}
            </p>
            <div className="bg-destructive/10 p-sm ring-destructive/20 rounded-lg ring-1">
              <TrendingDown className="text-destructive h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">
              {formatCurrency(totalExpenses)}
            </div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.expenses.stats.entriesCount', { count: expenses.length })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-success/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.expenses.stats.paid')}</p>
            <div className="bg-success/10 p-sm ring-success/20 rounded-lg ring-1">
              <CheckCircle2 className="text-success h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-success text-2xl font-bold">{paidCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {formatCurrency(paidAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-warning/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.expenses.stats.pending')}</p>
            <div className="bg-warning/10 p-sm ring-warning/20 rounded-lg ring-1">
              <Clock className="text-warning h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-warning text-2xl font-bold">{pendingCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {formatCurrency(pendingAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {categoryBreakdown.length > 1 && (
        <div className="bg-card p-md rounded-lg border">
          <p className="mb-sm text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('pages.expenses.byCategory')}
          </p>
          <div className="bg-muted flex h-2 overflow-hidden rounded-full">
            {categoryBreakdown.map(({ cat, pct }, i) => (
              <div
                key={cat}
                className={`h-full transition-[width] ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`}
                style={{ width: `${pct}%` }}
                title={`${translateCategory(cat, 'expense')}: ${pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="mt-sm gap-md flex flex-wrap">
            {categoryBreakdown.map(({ cat, pct }, i) => (
              <div key={cat} className="gap-xs flex items-center">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`}
                />
                <span className="text-muted-foreground text-xs">
                  {translateCategory(cat, 'expense')} · {Math.round(pct)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable
        data={expenses}
        columns={columns}
        keyExtractor={(expense) => expense.id}
        isLoading={isLoading}
        rowClassName={(expense) => (expense.payed ? 'opacity-60' : '')}
        emptyState={{
          icon: <TrendingDown className="text-muted-foreground h-12 w-12" />,
          message: t('pages.expenses.emptyState'),
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
            <div className="mt-sm gap-xs flex items-center justify-end">
              {expense.payed && (
                <ReceiptButton
                  source={{ type: 'expense', data: expense }}
                  memberName={getMemberDisplayName(expense.member_name, user)}
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(expense)}
                aria-label={t('common.actions.edit')}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(expense.id)}
                aria-label={t('common.actions.delete')}
              >
                <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
        actions={(expense) => (
          <div className="gap-sm flex items-center justify-end">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(expense)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(expense.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <ExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        title={t('pages.expenses.exportTitle')}
        description={t('pages.expenses.exportDesc')}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedExpense
                ? t('pages.expenses.editTitle')
                : t('pages.expenses.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedExpense
                ? t('pages.expenses.editDesc')
                : t('pages.expenses.newDesc')}
            </DialogDescription>
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
