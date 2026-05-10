import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { accountsService } from '@/services/accounts-service';
import { transfersService } from '@/services/transfers-service';
import type { Transfer, TransferFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  processing: 'default',
  completed: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
};

export function getTransferStatus(transfer: Transfer): string {
  if (transfer.transfered) return 'completed';
  return transfer.status ?? 'pending';
}

export function useTransfersData() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: transfers = [], isLoading: transfersLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => transfersService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const filteredTransfers = useMemo(
    () =>
      transfers.filter((transfer) => {
        if (
          debouncedSearch &&
          !transfer.description.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
          return false;
        if (statusFilter !== 'all' && getTransferStatus(transfer) !== statusFilter)
          return false;
        if (accountFilter !== 'all') {
          const id = parseInt(accountFilter);
          if (transfer.origin_account !== id && transfer.destiny_account !== id)
            return false;
        }
        if (startDate && new Date(transfer.date) < startDate) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (new Date(transfer.date) > end) return false;
        }
        return true;
      }),
    [transfers, debouncedSearch, statusFilter, accountFilter, startDate, endDate]
  );

  const totalVolume = useMemo(
    () => transfers.reduce((s, tr) => s + parseFloat(tr.value), 0),
    [transfers]
  );
  const completedCount = useMemo(
    () => transfers.filter((tr) => getTransferStatus(tr) === 'completed').length,
    [transfers]
  );
  const pendingCount = useMemo(
    () =>
      transfers.filter((tr) =>
        ['pending', 'processing'].includes(getTransferStatus(tr))
      ).length,
    [transfers]
  );
  const hasActiveFilters =
    !!searchTerm ||
    statusFilter !== 'all' ||
    accountFilter !== 'all' ||
    !!startDate ||
    !!endDate;

  const invalidateTransfers = () =>
    queryClient.invalidateQueries({ queryKey: ['transfers'] });

  const createMutation = useMutation({
    mutationFn: (data: TransferFormData) => transfersService.create(data),
    onSuccess: () => {
      void invalidateTransfers();
      toast({
        title: t('pages.transfers.created'),
        description: t('pages.transfers.createdDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TransferFormData }) =>
      transfersService.update(id, data),
    onSuccess: () => {
      void invalidateTransfers();
      toast({
        title: t('pages.transfers.updated'),
        description: t('pages.transfers.updatedDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transfersService.delete(id),
    onSuccess: () => {
      void invalidateTransfers();
      toast({
        title: t('pages.transfers.deleted'),
        description: t('pages.transfers.deletedDesc'),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (accounts.length < 2) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.transfers.noAccountMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedTransfer(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.transfers.deleteTitle'),
      description: t('pages.transfers.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    deleteMutation.mutate(id);
  };

  const handleSubmit = (data: TransferFormData) => {
    if (selectedTransfer) updateMutation.mutate({ id: selectedTransfer.id, data });
    else createMutation.mutate(data);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAccountFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return {
    transfers,
    accounts,
    filteredTransfers,
    isLoading: transfersLoading || accountsLoading,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
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
    hasActiveFilters,
    clearFilters,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
  };
}
