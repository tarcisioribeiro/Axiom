import { Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReceiptButton } from '@/components/receipts';
import { TransferForm } from '@/components/transfers/TransferForm';
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
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { accountsService } from '@/services/accounts-service';
import { transfersService } from '@/services/transfers-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Transfer, TransferFormData, Account } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Transfers() {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [transfersData, accountsData] = await Promise.all([
        transfersService.getAll(),
        accountsService.getAll(),
      ]);
      setTransfers(transfersData);
      setAccounts(accountsData);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: TransferFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedTransfer) {
        await transfersService.update(selectedTransfer.id, data);
        toast({
          title: t('pages.transfers.updated'),
          description: t('pages.transfers.updatedDesc'),
        });
      } else {
        await transfersService.create(data);
        toast({
          title: t('pages.transfers.created'),
          description: t('pages.transfers.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
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

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.transfers.deleteTitle'),
      description: t('pages.transfers.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await transfersService.delete(id);
      toast({
        title: t('pages.transfers.deleted'),
        description: t('pages.transfers.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setIsDialogOpen(true);
  };

  // Definir colunas da tabela
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
        <Badge>{translate('transferTypes', transfer.category)}</Badge>
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
      key: 'date',
      label: t('pages.transfers.columns.date'),
      render: (transfer) => (
        <span className="text-sm">
          {formatDate(transfer.date)} às {transfer.horary}
        </span>
      ),
    },
  ];

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

      <DataTable
        data={transfers}
        columns={columns}
        keyExtractor={(transfer) => transfer.id}
        isLoading={isLoading}
        emptyState={{
          message: t('pages.transfers.emptyState'),
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
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(transfer.id)}
              aria-label="Excluir"
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
