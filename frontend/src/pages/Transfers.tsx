import { ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReceiptButton } from '@/components/receipts';
import { getTransferColumns } from '@/components/transfers/getTransferColumns';
import { TransferFilters } from '@/components/transfers/TransferFilters';
import { TransferForm } from '@/components/transfers/TransferForm';
import { TransferStats } from '@/components/transfers/TransferStats';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTransfersData } from '@/hooks/use-transfers-data';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

export default function Transfers() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const {
    accounts,
    filteredTransfers,
    isLoading,
    isSubmitting,
    isDialogOpen,
    setIsDialogOpen,
    selectedTransfer,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    accountFilter,
    setAccountFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    totalVolume,
    completedCount,
    pendingCount,
    transfers,
    hasActiveFilters,
    clearFilters,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
  } = useTransfersData();

  const columns = getTransferColumns(t);
  const emptyMessage = hasActiveFilters
    ? t('pages.transfers.emptySearch')
    : t('pages.transfers.emptyState');

  return (
    <PageContainer>
      <PageHeader title={t('pages.transfers.title')} icon={<ArrowLeftRight />}>
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.transfers.newBtn')}
        </Button>
      </PageHeader>

      <TransferFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        accountFilter={accountFilter}
        onAccountChange={setAccountFilter}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        accounts={accounts}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      <TransferStats
        totalVolume={totalVolume}
        completedCount={completedCount}
        pendingCount={pendingCount}
        totalCount={transfers.length}
      />

      <DataTable
        data={filteredTransfers}
        columns={columns}
        keyExtractor={(transfer) => transfer.id}
        isLoading={isLoading}
        emptyState={{
          icon: <ArrowLeftRight className="h-12 w-12 text-muted-foreground" />,
          message: emptyMessage,
        }}
        actions={(transfer) => (
          <div className="flex items-center justify-end gap-sm">
            <ReceiptButton
              source={{ type: 'transfer', data: transfer }}
              memberName={getMemberDisplayName(null, user)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(transfer)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleDelete(transfer.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTransfer
                ? t('pages.transfers.editTitle')
                : t('pages.transfers.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedTransfer
                ? t('pages.transfers.editDesc')
                : t('pages.transfers.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <TransferForm
            transfer={selectedTransfer}
            accounts={accounts}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
