import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { StatCard } from '@/components/common/StatCard';
import { ReceiptButton } from '@/components/receipts';
import { TransferForm } from '@/components/transfers/TransferForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { accountsService } from '@/services/accounts-service';
import { transfersService } from '@/services/transfers-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Transfer, TransferFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  processing: 'default',
  completed: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
};

function getTransferStatus(transfer: Transfer): string {
  return transfer.status ?? (transfer.transfered ? 'completed' : 'pending');
}

export default function Transfers() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

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

  const isLoading = transfersLoading || accountsLoading;

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
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
    });
  }, [transfers, debouncedSearch, statusFilter, accountFilter, startDate, endDate]);

  const totalVolume = useMemo(
    () => transfers.reduce((s, t) => s + parseFloat(t.value), 0),
    [transfers]
  );
  const completedCount = useMemo(
    () => transfers.filter((t) => getTransferStatus(t) === 'completed').length,
    [transfers]
  );
  const pendingCount = useMemo(
    () =>
      transfers.filter((t) => ['pending', 'processing'].includes(getTransferStatus(t)))
        .length,
    [transfers]
  );

  const hasActiveFilters =
    !!searchTerm ||
    statusFilter !== 'all' ||
    accountFilter !== 'all' ||
    !!startDate ||
    !!endDate;

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAccountFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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
    if (selectedTransfer) {
      updateMutation.mutate({ id: selectedTransfer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns: Column<Transfer>[] = [
    {
      key: 'description',
      label: t('pages.transfers.columns.description'),
      render: (transfer) => <div className="font-medium">{transfer.description}</div>,
    },
    {
      key: 'value',
      label: t('pages.transfers.columns.amount'),
      align: 'right',
      render: (transfer) => (
        <span className="font-semibold">{formatCurrency(transfer.value)}</span>
      ),
    },
    {
      key: 'category',
      label: t('pages.transfers.columns.type'),
      render: (transfer) => (
        <Badge variant="outline">{translate('transferTypes', transfer.category)}</Badge>
      ),
    },
    {
      key: 'accounts',
      label: t('pages.transfers.columns.route'),
      render: (transfer) => (
        <span className="text-sm">
          {transfer.origin_account_name} → {transfer.destiny_account_name}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('pages.transfers.columns.status'),
      render: (transfer) => {
        const s = getTransferStatus(transfer);
        return (
          <Badge variant={STATUS_VARIANTS[s] ?? 'outline'}>
            {t(`common.status.${s}`, { defaultValue: s })}
          </Badge>
        );
      },
    },
    {
      key: 'date',
      label: t('pages.transfers.columns.date'),
      render: (transfer) => (
        <span className="text-sm">
          {formatDate(transfer.date)} às {transfer.horary}
        </span>
      ),
    },
  ];

  const emptyMessage = hasActiveFilters
    ? t('pages.transfers.emptySearch')
    : t('pages.transfers.emptyState');

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.transfers.title')}
        icon={<ArrowLeftRight />}
        action={{
          label: t('pages.transfers.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t('pages.transfers.stats.totalAmount')}
          value={formatCurrency(totalVolume)}
          icon={<ArrowLeftRight />}
        />
        <StatCard
          title={t('pages.transfers.stats.completed')}
          value={completedCount}
          icon={<CheckCircle2 />}
          variant="success"
        />
        <StatCard
          title={t('pages.transfers.stats.pending')}
          value={pendingCount}
          icon={<Clock />}
          variant="warning"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          placeholder={t('pages.transfers.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('pages.transfers.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.transfers.allStatus')}</SelectItem>
            <SelectItem value="pending">{t('common.status.pending')}</SelectItem>
            <SelectItem value="processing">{t('common.status.processing')}</SelectItem>
            <SelectItem value="completed">{t('common.status.completed')}</SelectItem>
            <SelectItem value="failed">{t('common.status.failed')}</SelectItem>
            <SelectItem value="cancelled">{t('common.status.cancelled')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('pages.transfers.allAccounts')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.transfers.allAccounts')}</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={String(acc.id)}>
                {acc.account_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker
          value={startDate}
          onChange={setStartDate}
          placeholder={t('pages.transfers.dateFrom')}
        />
        <DatePicker
          value={endDate}
          onChange={setEndDate}
          placeholder={t('pages.transfers.dateTo')}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            {t('common.actions.clearFilters', { defaultValue: 'Limpar' })}
          </Button>
        )}
      </div>

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
          <div className="flex items-center justify-end gap-2">
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
