import { Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import { useState, useEffect } from 'react';

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
        title: 'Erro ao carregar dados',
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
          title: 'Transferência atualizada',
          description: 'A transferência foi atualizada com sucesso.',
        });
      } else {
        await transfersService.create(data);
        toast({
          title: 'Transferência criada',
          description: 'A transferência foi criada com sucesso.',
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
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
        title: 'Ação não permitida',
        description:
          'É necessário ter pelo menos duas contas cadastradas antes de criar uma transferência.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedTransfer(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir transferência',
      description:
        'Tem certeza que deseja excluir esta transferência? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await transfersService.delete(id);
      toast({
        title: 'Transferência excluída',
        description: 'A transferência foi excluída com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
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
      label: 'Descrição',
      render: (transfer) => <div className="font-medium">{transfer.description}</div>,
    },
    {
      key: 'value',
      label: 'Valor',
      align: 'right',
      render: (transfer) => (
        <span className="font-semibold">{formatCurrency(transfer.value)}</span>
      ),
    },
    {
      key: 'category',
      label: 'Tipo',
      render: (transfer) => (
        <Badge>{translate('transferTypes', transfer.category)}</Badge>
      ),
    },
    {
      key: 'accounts',
      label: 'Origem → Destino',
      render: (transfer) => (
        <span className="text-sm">
          {transfer.origin_account_name} → {transfer.destiny_account_name}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Data',
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
        title="Transferências"
        icon={<ArrowLeftRight />}
        action={{
          label: 'Nova Transferência',
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
          message: 'Nenhuma transferência cadastrada.',
        }}
        actions={(transfer) => (
          <div className="flex items-center justify-end gap-2">
            <ReceiptButton
              source={{ type: 'transfer', data: transfer }}
              memberName={getMemberDisplayName(null, user)}
            />
            <Button variant="ghost" size="icon" onClick={() => handleEdit(transfer)} aria-label="Editar">
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(transfer.id)} aria-label="Excluir">
              <Trash2 className="w-4 h-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTransfer ? 'Editar Transferência' : 'Nova Transferência'}
            </DialogTitle>
            <DialogDescription>
              {selectedTransfer
                ? 'Atualize as informações da transferência'
                : 'Adicione uma nova transferência ao sistema'}
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
