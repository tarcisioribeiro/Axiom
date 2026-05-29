/* eslint-disable max-lines */
import {
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  Download,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@/components/common/DataTable';
import { ExportModal } from '@/components/common/ExportModal';
import { FilterBar } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ReceiptButton } from '@/components/receipts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
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
import { useExpensesPage } from '@/hooks/use-expenses-page';
import { formatCurrency } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function Expenses({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    expenses,
    accounts,
    loans,
    payables,
    isLoading,
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
    handleExport,
    totalExpenses,
    hasActiveFilters,
    columns,
    prefillExpenseData,
  } = useExpensesPage();

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
        <div className="flex items-center gap-sm">
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

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
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
          >
            <SelectValue placeholder={t('pages.expenses.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.expenses.allCategories')}</SelectItem>
            {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" aria-label={t('pages.expenses.allStatus')}>
            <SelectValue placeholder={t('pages.expenses.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.expenses.allStatus')}</SelectItem>
            <SelectItem value="paid">{t('common.status.paid')}</SelectItem>
            <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-xs">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t('pages.expenses.dateFrom')}
          </span>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder={t('pages.expenses.dateFrom')}
            clearable
          />
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t('pages.expenses.dateTo')}
          </span>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder={t('pages.expenses.dateTo')}
            clearable
          />
        </div>
      </FilterBar>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Card className="overflow-hidden border-t-2 border-t-destructive/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.expenses.stats.totalAmount')}
            </p>
            <div className="rounded-lg bg-destructive/10 p-sm ring-1 ring-destructive/20">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalExpenses)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.expenses.stats.entriesCount', { count: expenses.length })}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-success/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.expenses.stats.paid')}</p>
            <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{paidCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {formatCurrency(paidAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-warning/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.expenses.stats.pending')}</p>
            <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{pendingCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {formatCurrency(pendingAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {categoryBreakdown.length > 1 && (
        <div className="rounded-lg border bg-card p-md">
          <p className="mb-sm text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Por categoria
          </p>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {categoryBreakdown.map(({ cat, pct }, i) => (
              <div
                key={cat}
                className={`h-full transition-all ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`}
                style={{ width: `${pct}%` }}
                title={`${translateCategory(cat, 'expense')}: ${pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="mt-sm flex flex-wrap gap-md">
            {categoryBreakdown.map(({ cat, pct }, i) => (
              <div key={cat} className="flex items-center gap-xs">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`}
                />
                <span className="text-xs text-muted-foreground">
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
        emptyState={{
          icon: <TrendingDown className="h-12 w-12 text-muted-foreground" />,
          message: t('pages.expenses.emptyState'),
        }}
        actions={(expense) => (
          <div className="flex items-center justify-end gap-sm">
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
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
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
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
