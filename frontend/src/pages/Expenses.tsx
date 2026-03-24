import { Plus, Pencil, Trash2, TrendingDown, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@/components/common/DataTable';
import { ExportModal } from '@/components/common/ExportModal';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ExpensesFilters } from '@/components/expenses/ExpensesFilters';
import { ReceiptButton } from '@/components/receipts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useExpensesPage } from '@/hooks/use-expenses-page';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

export default function Expenses() {
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
    selectedAccounts,
    isExportModalOpen,
    setIsExportModalOpen,
    toggleAccount,
    clearFilters,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleExport,
    totalExpenses,
    hasActiveFilters,
    columns,
  } = useExpensesPage();

  return (
    <PageContainer>
      <PageHeader title={t('pages.expenses.title')} icon={<TrendingDown />}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsExportModalOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t('common.actions.export')}
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('pages.expenses.newBtn')}
          </Button>
        </div>
      </PageHeader>

      <ExpensesFilters
        accounts={accounts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedAccounts={selectedAccounts}
        toggleAccount={toggleAccount}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        totalExpenses={totalExpenses}
        count={expenses.length}
      />

      <DataTable
        data={expenses}
        columns={columns}
        keyExtractor={(expense) => expense.id}
        isLoading={isLoading}
        emptyState={{ message: t('pages.expenses.emptyState') }}
        actions={(expense) => (
          <div className="flex items-center justify-end gap-2">
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
            accounts={accounts}
            loans={loans}
            payables={payables}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
