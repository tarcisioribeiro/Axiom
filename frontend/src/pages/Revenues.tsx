import { Plus, Pencil, Trash2, TrendingUp, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@/components/common/DataTable';
import { ExportModal } from '@/components/common/ExportModal';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReceiptButton } from '@/components/receipts';
import { RevenueForm } from '@/components/revenues/RevenueForm';
import { RevenuesFilters } from '@/components/revenues/RevenuesFilters';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRevenuesPage } from '@/hooks/use-revenues-page';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

export default function Revenues() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    revenues, accounts, loans, isLoading,
    isDialogOpen, setIsDialogOpen, selectedRevenue, isSubmitting,
    searchTerm, setSearchTerm, categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter, startDate, setStartDate,
    endDate, setEndDate, selectedAccounts,
    isExportModalOpen, setIsExportModalOpen,
    toggleAccount, clearFilters,
    handleCreate, handleEdit, handleDelete, handleSubmit, handleExport,
    totalRevenues, hasActiveFilters, columns,
  } = useRevenuesPage();

  return (
    <PageContainer>
      <PageHeader title={t('pages.revenues.title')} icon={<TrendingUp />}>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsExportModalOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            {t('common.actions.export')}
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('pages.revenues.newBtn')}
          </Button>
        </div>
      </PageHeader>

      <RevenuesFilters
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
        totalRevenues={totalRevenues}
        count={revenues.length}
      />

      <DataTable
        data={revenues}
        columns={columns}
        keyExtractor={(revenue) => revenue.id}
        isLoading={isLoading}
        emptyState={{ message: t('pages.revenues.emptyState') }}
        actions={(revenue) => (
          <div className="flex items-center justify-end gap-2">
            <ReceiptButton
              source={{ type: 'revenue', data: revenue }}
              memberName={getMemberDisplayName(revenue.member_name, user)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(revenue)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(revenue.id)}
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
        title={t('pages.revenues.exportTitle')}
        description={t('pages.revenues.exportDesc')}
        onExport={handleExport}
        initialDateFrom={startDate}
        initialDateTo={endDate}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRevenue ? t('pages.revenues.editTitle') : t('pages.revenues.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedRevenue ? t('pages.revenues.editDesc') : t('pages.revenues.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <RevenueForm
            revenue={selectedRevenue}
            accounts={accounts}
            loans={loans}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
