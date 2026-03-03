import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountForm } from '@/components/accounts/AccountForm';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
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
import { getErrorMessage } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import type { Account, AccountFormData } from '@/types';

export default function Accounts() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const accountsData = await accountsService.getAll();
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

  const handleCreate = () => {
    setSelectedAccount(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: Account) => {
    setSelectedAccount(account);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.accounts.deleteTitle'),
      description: t('pages.accounts.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await accountsService.delete(id);
      toast({
        title: t('pages.accounts.deleted'),
        description: t('pages.accounts.deletedDesc'),
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

  const handleSubmit = async (data: AccountFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedAccount) {
        await accountsService.update(selectedAccount.id, data);
        toast({
          title: t('pages.accounts.updated'),
          description: t('pages.accounts.updatedDesc'),
        });
      } else {
        await accountsService.create(data);
        toast({
          title: t('pages.accounts.created'),
          description: t('pages.accounts.createdDesc'),
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

  // Definir colunas da tabela
  const columns: Column<Account>[] = [
    {
      key: 'account_name',
      label: t('pages.accounts.columns.name'),
      render: (account) => <div className="font-medium">{account.account_name}</div>,
    },
    {
      key: 'account_type',
      label: t('pages.accounts.columns.type'),
      render: (account) => (
        <Badge variant="secondary">
          {translate('accountTypes', account.account_type)}
        </Badge>
      ),
    },
    {
      key: 'institution',
      label: t('pages.accounts.columns.institution'),
      render: (account) => translate('institutions', account.institution),
    },
    {
      key: 'account_number_masked',
      label: t('pages.accounts.columns.number'),
      render: (account) => (
        <span className="font-mono text-sm">{account.account_number_masked}</span>
      ),
    },
    {
      key: 'balance',
      label: t('pages.accounts.columns.balance'),
      align: 'right',
      render: (account) => (
        <span
          className={`font-semibold ${
            parseFloat(account.balance) >= 0 ? 'text-success' : 'text-destructive'
          }`}
        >
          {formatCurrency(account.balance)}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: t('pages.accounts.columns.createdAt'),
      render: (account) => (
        <span className="text-sm">{formatDate(account.created_at)}</span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.accounts.title')}
        icon={<Wallet />}
        action={{
          label: t('pages.accounts.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <DataTable
        data={accounts}
        columns={columns}
        keyExtractor={(account) => account.id}
        isLoading={isLoading}
        emptyState={{
          message: t('pages.accounts.emptyState'),
        }}
        actions={(account) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(account)}
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(account.id)}
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
              {selectedAccount
                ? t('pages.accounts.editTitle')
                : t('pages.accounts.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedAccount
                ? t('pages.accounts.editDesc')
                : t('pages.accounts.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            account={selectedAccount}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
