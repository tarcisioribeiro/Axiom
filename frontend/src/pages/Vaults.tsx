import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReceiptButton } from '@/components/receipts';
import { vaultsService } from '@/services/vaults-service';
import { accountsService } from '@/services/accounts-service';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/utils/error-utils';
import { formatCurrency } from '@/lib/formatters';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import type {
  Vault as VaultType,
  VaultFormData,
  Account,
  VaultTransaction,
} from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageContainer } from '@/components/common/PageContainer';
import { cn } from '@/lib/utils';

export default function Vaults() {
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
        title: 'Erro ao carregar dados',
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
        title: 'Ação não permitida',
        description:
          'É necessário ter pelo menos uma conta cadastrada antes de criar um cofre.',
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
        title: 'Ação não permitida',
        description:
          'Não é possível excluir um cofre com saldo. Realize um saque completo primeiro.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = await showConfirm({
      title: 'Excluir cofre',
      description:
        'Tem certeza que deseja excluir este cofre? Esta ação não pode ser desfeita.',
    });

    if (confirmed) {
      try {
        await vaultsService.delete(id);
        toast({
          title: 'Cofre excluído',
          description: 'O cofre foi excluído com sucesso.',
        });
        void loadData();
      } catch (error: unknown) {
        toast({
          title: 'Erro ao excluir',
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
          title: 'Cofre atualizado',
          description: 'O cofre foi atualizado com sucesso.',
        });
      } else {
        await vaultsService.create(dataToSend);
        toast({
          title: 'Cofre criado',
          description: 'O cofre foi criado com sucesso.',
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

  const handleDeposit = async () => {
    if (!selectedVault) return;
    const amount = parseFloat(operationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor válido para o depósito.',
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
        title: 'Depósito realizado',
        description: `Depósito de ${formatCurrency(amount)} realizado com sucesso.`,
      });
      setIsDepositDialogOpen(false);
      setOperationAmount('');
      setOperationDescription('');
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro no depósito',
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
        title: 'Valor inválido',
        description: 'Informe um valor válido para o saque.',
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
        title: 'Saque realizado',
        description: `Saque de ${formatCurrency(amount)} realizado com sucesso.`,
      });
      setIsWithdrawDialogOpen(false);
      setOperationAmount('');
      setOperationDescription('');
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro no saque',
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
          title: 'Rendimento aplicado',
          description: `Rendimento de ${formatCurrency(response.yield_applied)} aplicado ao cofre.`,
        });
      } else {
        toast({
          title: 'Sem rendimento',
          description: 'Não há rendimento pendente para aplicar.',
        });
      }
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao aplicar rendimento',
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
        title: 'Erro ao carregar transações',
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
        title: 'Erro ao carregar transações',
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
        title: 'Valor inválido',
        description: 'Informe um valor válido.',
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
        title: 'Transação atualizada',
        description: 'A transação foi atualizada com sucesso.',
      });
      cancelEditTransaction();
      void loadTransactions();
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (transaction: VaultTransaction) => {
    const confirmed = await showConfirm({
      title: 'Excluir transação de rendimento',
      description: `Tem certeza que deseja excluir esta transação de ${formatCurrency(parseFloat(transaction.amount))}? O valor será revertido do saldo do cofre.`,
    });

    if (confirmed) {
      try {
        await vaultsService.deleteTransaction(transaction.id);
        toast({
          title: 'Transação excluída',
          description: 'A transação foi excluída e o saldo revertido.',
        });
        void loadTransactions();
        void loadData();
      } catch (error: unknown) {
        toast({
          title: 'Erro ao excluir',
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
      label: 'Descrição',
      render: (vault) => (
        <div>
          <div className="font-medium">{vault.description}</div>
          <div className="text-xs text-muted-foreground">{vault.account_name}</div>
        </div>
      ),
    },
    {
      key: 'current_balance',
      label: 'Saldo Atual',
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
      label: 'Rendimentos',
      render: (vault) => (
        <div>
          <div className="text-success">
            {formatCurrency(parseFloat(vault.accumulated_yield))}
          </div>
          {vault.pending_yield > 0 && (
            <div className="text-xs text-muted-foreground">
              +{formatCurrency(vault.pending_yield)} pendente
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'yield_rate',
      label: 'Taxa',
      render: (vault) => (
        <div>
          <div className="font-medium">
            {vault.annual_yield_rate_percentage.toFixed(2)}% ao ano
          </div>
          <div className="text-xs text-muted-foreground">
            {vault.daily_yield_rate_percentage.toFixed(4)}% ao dia
          </div>
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (vault) => (
        <Badge variant={vault.is_active ? 'default' : 'secondary'}>
          {vault.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (vault) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDepositDialog(vault)}
            aria-label="Depositar"
            disabled={!vault.is_active}
          >
            <ArrowDownToLine className="h-4 w-4 text-success" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openWithdrawDialog(vault)}
            aria-label="Sacar"
            disabled={!vault.is_active || parseFloat(vault.current_balance) <= 0}
          >
            <ArrowUpFromLine className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleApplyYield(vault)}
            aria-label="Aplicar Rendimento"
            disabled={!vault.is_active || vault.pending_yield <= 0}
          >
            <RefreshCcw className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openTransactionsDialog(vault)}
            aria-label="Ver Transações"
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(vault)}
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(vault.id)}
            aria-label="Excluir"
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
        title="Cofres"
        icon={<Vault />}
        action={{
          label: 'Novo Cofre',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
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
              Rendimentos Acumulados
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
            <CardTitle className="text-sm font-medium">Rendimentos Pendentes</CardTitle>
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
        emptyState={{ message: 'Nenhum cofre cadastrado' }}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVault ? 'Editar Cofre' : 'Novo Cofre'}</DialogTitle>
            <DialogDescription>
              {selectedVault
                ? 'Altere os dados do cofre abaixo.'
                : 'Preencha os dados para criar um novo cofre.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Descrição *</Label>
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
              <Label htmlFor="account">Conta Associada *</Label>
              <Select
                value={formData.account.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, account: parseInt(value) })
                }
                disabled={!!selectedVault}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
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
              <Label htmlFor="annual_yield_rate">Taxa de Rendimento (% ao ano)</Label>
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
                Deixe 0 para cofres sem rendimento. Ex: 12 = 12% ao ano
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
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
              <Label htmlFor="is_active">Cofre ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.description}
            >
              {isSubmitting ? 'Salvando...' : selectedVault ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Depositar no Cofre</DialogTitle>
            <DialogDescription>
              {selectedVault && (
                <>
                  Depositar no cofre "{selectedVault.description}".
                  <br />
                  Saldo disponível na conta:{' '}
                  {formatCurrency(parseFloat(selectedVault.account_balance))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deposit_amount">Valor do Depósito *</Label>
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
              <Label htmlFor="deposit_description">Descrição</Label>
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
              Cancelar
            </Button>
            <Button onClick={handleDeposit} disabled={isSubmitting || !operationAmount}>
              {isSubmitting ? 'Depositando...' : 'Depositar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sacar do Cofre</DialogTitle>
            <DialogDescription>
              {selectedVault && (
                <>
                  Sacar do cofre "{selectedVault.description}".
                  <br />
                  Saldo disponível no cofre:{' '}
                  {formatCurrency(parseFloat(selectedVault.current_balance))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw_amount">Valor do Saque *</Label>
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
              <Label htmlFor="withdraw_description">Descrição</Label>
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
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={isSubmitting || !operationAmount}
            >
              {isSubmitting ? 'Sacando...' : 'Sacar'}
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
            <DialogTitle>Transações do Cofre</DialogTitle>
            <DialogDescription>
              {selectedVault && (
                <>
                  Histórico de transações do cofre "{selectedVault.description}".
                  <br />
                  Saldo atual:{' '}
                  {formatCurrency(parseFloat(selectedVault.current_balance))} |
                  Rendimentos:{' '}
                  {formatCurrency(parseFloat(selectedVault.accumulated_yield))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Label>Filtrar por tipo:</Label>
              <Select
                value={transactionsFilter}
                onValueChange={(value) => {
                  setTransactionsFilter(value);
                  setTimeout(() => { void loadTransactions(); }, 0);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="deposit">Depósitos</SelectItem>
                  <SelectItem value="withdrawal">Saques</SelectItem>
                  <SelectItem value="yield">Rendimentos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transactions Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Saldo Após</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Nenhuma transação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {new Date(transaction.transaction_date).toLocaleDateString(
                            'pt-BR'
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
                                      Salvar
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelEditTransaction}
                                    >
                                      Cancelar
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => startEditTransaction(transaction)}
                                      aria-label="Editar"
                                    >
                                      <Pencil className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteTransaction(transaction)}
                                      aria-label="Excluir"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
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
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
