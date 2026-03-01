import {
  Plus,
  Pencil,
  Trash2,
  Vault,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCcw,
  History,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { vaultsService } from '@/services/vaults-service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  Vault as VaultType,
  VaultFormData,
  Account,
  VaultTransaction,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Vaults() {
  const { t, i18n } = useTranslation();
  const [vaults, setVaults] = useState<VaultType[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<VaultType | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationAmount, setOperationAmount] = useState<string>('');
  const [operationDescription, setOperationDescription] = useState<string>('');

  // Transactions dialog state
  const [isTransactionsDialogOpen, setIsTransactionsDialogOpen] = useState(false);
  const [transactions, setTransactions] = useState<VaultTransaction[]>([]);
  const [transactionsFilter, setTransactionsFilter] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<VaultTransaction | null>(
    null
  );
  const [editTransactionAmount, setEditTransactionAmount] = useState<string>('');
  const [editTransactionDescription, setEditTransactionDescription] =
    useState<string>('');

  // Form state
  const [formData, setFormData] = useState<VaultFormData>({
    description: '',
    account: 0,
    annual_yield_rate: 0,
    is_active: true,
    notes: '',
  });

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { user } = useAuthStore();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [vaultsData, accountsData] = await Promise.all([
        vaultsService.getAll(),
        accountsService.getAll(),
      ]);
      setVaults(vaultsData);
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
    if (accounts.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.vaults.noAccountMsg'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedVault(undefined);
    setFormData({
      description: '',
      account: accounts[0]?.id || 0,
      annual_yield_rate: 0,
      is_active: true,
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (vault: VaultType) => {
    setSelectedVault(vault);
    setFormData({
      description: vault.description,
      account: vault.account,
      annual_yield_rate: vault.annual_yield_rate_percentage, // Already in percentage
      is_active: vault.is_active,
      notes: vault.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const vault = vaults.find((v) => v.id === id);
    if (vault && parseFloat(vault.current_balance) > 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.vaults.cannotDeleteWithBalance'),
        variant: 'destructive',
      });
      return;
    }

    const confirmed = await showConfirm({
      title: t('pages.vaults.deleteTitle'),
      description: t('pages.vaults.deleteDesc'),
    });

    if (confirmed) {
      try {
        await vaultsService.delete(id);
        toast({
          title: t('pages.vaults.deleted'),
          description: t('pages.vaults.deletedDesc'),
        });
        void loadData();
      } catch (error: unknown) {
        toast({
          title: t('common.messages.deleteError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const dataToSend = {
        ...formData,
        annual_yield_rate: formData.annual_yield_rate / 100, // Convert from percentage to decimal
      };

      if (selectedVault) {
        await vaultsService.update(selectedVault.id, dataToSend);
        toast({
          title: t('pages.vaults.updated'),
          description: t('pages.vaults.updatedDesc'),
        });
      } else {
        await vaultsService.create(dataToSend);
        toast({
          title: t('pages.vaults.created'),
          description: t('pages.vaults.createdDesc'),
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

  const handleDeposit = async () => {
    if (!selectedVault) return;
    const amount = parseFloat(operationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('pages.vaults.invalidAmount'),
        description: t('pages.vaults.invalidDepositDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await vaultsService.deposit(selectedVault.id, {
        amount,
        description: operationDescription || undefined,
      });
      toast({
        title: t('pages.vaults.depositSuccess'),
        description: `${t('pages.vaults.depositSuccess')}: ${formatCurrency(amount)}`,
      });
      setIsDepositDialogOpen(false);
      setOperationAmount('');
      setOperationDescription('');
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

  const handleWithdraw = async () => {
    if (!selectedVault) return;
    const amount = parseFloat(operationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('pages.vaults.invalidAmount'),
        description: t('pages.vaults.invalidWithdrawDesc'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await vaultsService.withdraw(selectedVault.id, {
        amount,
        description: operationDescription || undefined,
      });
      toast({
        title: t('pages.vaults.withdrawSuccess'),
        description: `${t('pages.vaults.withdrawSuccess')}: ${formatCurrency(amount)}`,
      });
      setIsWithdrawDialogOpen(false);
      setOperationAmount('');
      setOperationDescription('');
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

  const handleApplyYield = async (vault: VaultType) => {
    try {
      const response = await vaultsService.applyYield(vault.id);
      if (response.yield_applied > 0) {
        toast({
          title: t('pages.vaults.yieldApplied'),
          description: `${t('pages.vaults.yieldApplied')}: ${formatCurrency(response.yield_applied)}`,
        });
      } else {
        toast({
          title: t('pages.vaults.noYield'),
          description: t('pages.vaults.noYieldDesc'),
        });
      }
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const openDepositDialog = (vault: VaultType) => {
    setSelectedVault(vault);
    setOperationAmount('');
    setOperationDescription('');
    setIsDepositDialogOpen(true);
  };

  const openWithdrawDialog = (vault: VaultType) => {
    setSelectedVault(vault);
    setOperationAmount('');
    setOperationDescription('');
    setIsWithdrawDialogOpen(true);
  };

  const openTransactionsDialog = async (vault: VaultType) => {
    setSelectedVault(vault);
    setTransactionsFilter('all');
    setEditingTransaction(null);
    try {
      const data = await vaultsService.getTransactions(vault.id);
      setTransactions(data);
      setIsTransactionsDialogOpen(true);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const loadTransactions = async () => {
    if (!selectedVault) return;
    try {
      const typeFilter = transactionsFilter === 'all' ? undefined : transactionsFilter;
      const data = await vaultsService.getTransactions(selectedVault.id, typeFilter);
      setTransactions(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const startEditTransaction = (transaction: VaultTransaction) => {
    setEditingTransaction(transaction);
    setEditTransactionAmount(transaction.amount);
    setEditTransactionDescription(transaction.description || '');
  };

  const cancelEditTransaction = () => {
    setEditingTransaction(null);
    setEditTransactionAmount('');
    setEditTransactionDescription('');
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    const amount = parseFloat(editTransactionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('pages.vaults.invalidAmount'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await vaultsService.updateTransaction(editingTransaction.id, {
        amount,
        description: editTransactionDescription || undefined,
      });
      toast({
        title: t('pages.vaults.transactionUpdated'),
        description: t('pages.vaults.transactionUpdatedDesc'),
      });
      cancelEditTransaction();
      void loadTransactions();
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.updateError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (transaction: VaultTransaction) => {
    const confirmed = await showConfirm({
      title: t('pages.vaults.deleteTransactionTitle'),
      description: `${t('pages.vaults.deleteTransactionTitle')}: ${formatCurrency(parseFloat(transaction.amount))}`,
    });

    if (confirmed) {
      try {
        await vaultsService.deleteTransaction(transaction.id);
        toast({
          title: t('pages.vaults.transactionDeleted'),
          description: t('pages.vaults.transactionDeletedDesc'),
        });
        void loadTransactions();
        void loadData();
      } catch (error: unknown) {
        toast({
          title: t('common.messages.deleteError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  };

  // Calculate totals
  const totalBalance = vaults.reduce(
    (sum, v) => sum + parseFloat(v.current_balance),
    0
  );
  const totalYield = vaults.reduce(
    (sum, v) => sum + parseFloat(v.accumulated_yield),
    0
  );
  const totalPendingYield = vaults.reduce((sum, v) => sum + v.pending_yield, 0);

  const columns: Column<VaultType>[] = [
    {
      key: 'description',
      label: t('pages.vaults.columns.description'),
      render: (vault) => (
        <div>
          <div className="font-medium">{vault.description}</div>
          <div className="text-xs text-muted-foreground">{vault.account_name}</div>
        </div>
      ),
    },
    {
      key: 'current_balance',
      label: t('pages.vaults.columns.currentBalance'),
      render: (vault) => (
        <span
          className={cn(
            'font-semibold',
            parseFloat(vault.current_balance) > 0 ? 'text-success' : ''
          )}
        >
          {formatCurrency(parseFloat(vault.current_balance))}
        </span>
      ),
    },
    {
      key: 'accumulated_yield',
      label: t('pages.vaults.columns.yields'),
      render: (vault) => (
        <div>
          <div className="text-success">
            {formatCurrency(parseFloat(vault.accumulated_yield))}
          </div>
          {vault.pending_yield > 0 && (
            <div className="text-xs text-muted-foreground">
              +{formatCurrency(vault.pending_yield)} {t('pages.vaults.pending')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'yield_rate',
      label: t('pages.vaults.columns.rate'),
      render: (vault) => (
        <div>
          <div className="font-medium">
            {vault.annual_yield_rate_percentage.toFixed(2)}% {t('pages.vaults.perYear')}
          </div>
          <div className="text-xs text-muted-foreground">
            {vault.daily_yield_rate_percentage.toFixed(4)}% {t('pages.vaults.perDay')}
          </div>
        </div>
      ),
    },
    {
      key: 'is_active',
      label: t('pages.vaults.columns.status'),
      render: (vault) => (
        <Badge variant={vault.is_active ? 'default' : 'secondary'}>
          {vault.is_active ? t('common.status.active') : t('common.status.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('common.table.actions'),
      render: (vault) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDepositDialog(vault)}
            aria-label={t('pages.vaults.depositBtn')}
            disabled={!vault.is_active}
          >
            <ArrowDownToLine className="h-4 w-4 text-success" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openWithdrawDialog(vault)}
            aria-label={t('pages.vaults.withdrawBtn')}
            disabled={!vault.is_active || parseFloat(vault.current_balance) <= 0}
          >
            <ArrowUpFromLine className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleApplyYield(vault)}
            aria-label={t('pages.vaults.applyYieldBtn')}
            disabled={!vault.is_active || vault.pending_yield <= 0}
          >
            <RefreshCcw className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openTransactionsDialog(vault)}
            aria-label={t('pages.vaults.transactionsBtn')}
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(vault)}
            aria-label={t('common.actions.edit')}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(vault.id)}
            aria-label={t('common.actions.delete')}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.vaults.title')}
        icon={<Vault />}
        action={{
          label: t('pages.vaults.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.vaults.totalBalance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalBalance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.vaults.totalYield')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalYield)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.vaults.pendingYield')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">
              {formatCurrency(totalPendingYield)}
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={vaults}
        columns={columns}
        keyExtractor={(vault) => vault.id}
        isLoading={isLoading}
        emptyState={{ message: t('pages.vaults.emptyState') }}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedVault ? t('pages.vaults.editTitle') : t('pages.vaults.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedVault ? t('pages.vaults.editDesc') : t('pages.vaults.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">{t('common.fields.description')} *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Ex: Reserva de Emergência"
              />
            </div>
            <div>
              <Label htmlFor="account">{t('common.fields.account')} *</Label>
              <Select
                value={formData.account.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, account: parseInt(value) })
                }
                disabled={!!selectedVault}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.fields.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="annual_yield_rate">
                {t('pages.vaults.yieldRateLabel')}
              </Label>
              <Input
                id="annual_yield_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.annual_yield_rate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    annual_yield_rate: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="Ex: 12.00"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('pages.vaults.yieldRateHint')}
              </p>
            </div>
            <div>
              <Label htmlFor="notes">{t('common.fields.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre o cofre..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
              />
              <Label htmlFor="is_active">{t('pages.vaults.activeVault')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.description}
            >
              {isSubmitting
                ? t('common.actions.saving')
                : selectedVault
                  ? t('common.actions.save')
                  : t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.vaults.depositTitle')}</DialogTitle>
            <DialogDescription>
              {selectedVault && (
                <>
                  {t('pages.vaults.depositVaultDesc', {
                    name: selectedVault.description,
                  })}
                  <br />
                  {t('pages.vaults.availableAccountBalance')}{' '}
                  {formatCurrency(parseFloat(selectedVault.account_balance))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deposit_amount">
                {t('pages.vaults.depositAmountLabel')}
              </Label>
              <Input
                id="deposit_amount"
                type="number"
                step="0.01"
                min="0.01"
                max={
                  selectedVault ? parseFloat(selectedVault.account_balance) : undefined
                }
                value={operationAmount}
                onChange={(e) => setOperationAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="deposit_description">
                {t('common.fields.description')}
              </Label>
              <Input
                id="deposit_description"
                value={operationDescription}
                onChange={(e) => setOperationDescription(e.target.value)}
                placeholder="Ex: Depósito mensal"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDepositDialogOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleDeposit} disabled={isSubmitting || !operationAmount}>
              {isSubmitting
                ? t('pages.vaults.depositAction')
                : t('pages.vaults.depositBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.vaults.withdrawTitle')}</DialogTitle>
            <DialogDescription>
              {selectedVault && (
                <>
                  {t('pages.vaults.withdrawVaultDesc', {
                    name: selectedVault.description,
                  })}
                  <br />
                  {t('pages.vaults.availableVaultBalance')}{' '}
                  {formatCurrency(parseFloat(selectedVault.current_balance))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw_amount">
                {t('pages.vaults.withdrawAmountLabel')}
              </Label>
              <Input
                id="withdraw_amount"
                type="number"
                step="0.01"
                min="0.01"
                max={
                  selectedVault ? parseFloat(selectedVault.current_balance) : undefined
                }
                value={operationAmount}
                onChange={(e) => setOperationAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="withdraw_description">
                {t('common.fields.description')}
              </Label>
              <Input
                id="withdraw_description"
                value={operationDescription}
                onChange={(e) => setOperationDescription(e.target.value)}
                placeholder="Ex: Saque para emergência"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawDialogOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={isSubmitting || !operationAmount}
            >
              {isSubmitting
                ? t('pages.vaults.withdrawAction')
                : t('pages.vaults.withdrawBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog
        open={isTransactionsDialogOpen}
        onOpenChange={setIsTransactionsDialogOpen}
      >
        <DialogContent className="custom-scrollbar max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.vaults.transactionsTitle')}</DialogTitle>
            <DialogDescription>
              {selectedVault && (
                <>
                  {t('pages.vaults.transactionHistoryDesc', {
                    name: selectedVault.description,
                  })}
                  <br />
                  {t('pages.vaults.columns.currentBalance')}:{' '}
                  {formatCurrency(parseFloat(selectedVault.current_balance))} |
                  {t('pages.vaults.columns.yields')}:{' '}
                  {formatCurrency(parseFloat(selectedVault.accumulated_yield))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Label>{t('pages.vaults.filterByType')}</Label>
              <Select
                value={transactionsFilter}
                onValueChange={(value) => {
                  setTransactionsFilter(value);
                  setTimeout(() => {
                    void loadTransactions();
                  }, 0);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('pages.vaults.filterAll')}</SelectItem>
                  <SelectItem value="deposit">
                    {t('pages.vaults.filterDeposits')}
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    {t('pages.vaults.filterWithdrawals')}
                  </SelectItem>
                  <SelectItem value="yield">
                    {t('pages.vaults.filterYields')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transactions Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pages.vaults.columns.date')}</TableHead>
                    <TableHead>{t('pages.vaults.columns.type')}</TableHead>
                    <TableHead>{t('pages.vaults.columns.amount')}</TableHead>
                    <TableHead>{t('common.fields.description')}</TableHead>
                    <TableHead>{t('pages.vaults.columns.afterBalance')}</TableHead>
                    <TableHead className="text-right">
                      {t('common.table.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {t('pages.vaults.noTransactions')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {new Date(transaction.transaction_date).toLocaleDateString(
                            i18n.language
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.transaction_type === 'deposit'
                                ? 'default'
                                : transaction.transaction_type === 'withdrawal'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {transaction.transaction_type_display}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {editingTransaction?.id === transaction.id ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={editTransactionAmount}
                              onChange={(e) => setEditTransactionAmount(e.target.value)}
                              className="w-24"
                            />
                          ) : (
                            <span
                              className={cn(
                                transaction.transaction_type === 'deposit' ||
                                  transaction.transaction_type === 'yield'
                                  ? 'text-success'
                                  : 'text-destructive'
                              )}
                            >
                              {transaction.transaction_type === 'withdrawal'
                                ? '-'
                                : '+'}
                              {formatCurrency(parseFloat(transaction.amount))}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTransaction?.id === transaction.id ? (
                            <Input
                              value={editTransactionDescription}
                              onChange={(e) =>
                                setEditTransactionDescription(e.target.value)
                              }
                              className="w-40"
                            />
                          ) : (
                            transaction.description || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(parseFloat(transaction.balance_after))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(transaction.transaction_type === 'deposit' ||
                              transaction.transaction_type === 'withdrawal') &&
                              selectedVault && (
                                <ReceiptButton
                                  source={{
                                    type:
                                      transaction.transaction_type === 'deposit'
                                        ? 'vault_deposit'
                                        : 'vault_withdrawal',
                                    data: { vault: selectedVault, transaction },
                                  }}
                                  memberName={getMemberDisplayName(null, user)}
                                />
                              )}
                            {transaction.transaction_type === 'yield' && (
                              <>
                                {editingTransaction?.id === transaction.id ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleUpdateTransaction}
                                      disabled={isSubmitting}
                                    >
                                      {t('common.actions.save')}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelEditTransaction}
                                    >
                                      {t('common.actions.cancel')}
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => startEditTransaction(transaction)}
                                      aria-label={t('common.actions.edit')}
                                    >
                                      <Pencil className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleDeleteTransaction(transaction)
                                      }
                                      aria-label={t('common.actions.delete')}
                                    >
                                      <Trash2
                                        className="h-4 w-4 text-destructive"
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTransactionsDialogOpen(false)}
            >
              {t('common.actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
