import {
  Plus,
  Pencil,
  Trash2,
  Vault,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCcw,
  History,
  CalendarClock,
  Zap,
  TrendingUp,
  Calculator,
} from 'lucide-react';
import { useState, useEffect, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { SimulatorScenarioResult } from '@/services/vault-simulator-service';
import { vaultSimulatorService } from '@/services/vault-simulator-service';
import { vaultsService } from '@/services/vaults-service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  Vault as VaultType,
  VaultFormData,
  Account,
  VaultTransaction,
  VaultRecurringContribution,
  VaultRecurringContributionFormData,
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

  // Recurring contributions state
  const [isContributionsDialogOpen, setIsContributionsDialogOpen] = useState(false);
  const [contributions, setContributions] = useState<VaultRecurringContribution[]>([]);
  const [isContributionsLoading, setIsContributionsLoading] = useState(false);
  const [isContributionFormOpen, setIsContributionFormOpen] = useState(false);
  const [editingContribution, setEditingContribution] =
    useState<VaultRecurringContribution | null>(null);
  const [contributionFormData, setContributionFormData] =
    useState<VaultRecurringContributionFormData>({
      amount: 0,
      day_of_month: 1,
      is_active: true,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: undefined,
      description: '',
    });
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [formData, setFormData] = useState<VaultFormData>({
    description: '',
    account: 0,
    annual_yield_rate: 0,
    is_active: true,
    notes: '',
  });

  // Simulator state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorVault, setSimulatorVault] = useState<VaultType | null>(null);
  const [simInitialAmount, setSimInitialAmount] = useState('');
  const [simMonthlyDeposit, setSimMonthlyDeposit] = useState('');
  const [simAnnualRate, setSimAnnualRate] = useState('');
  const [simMonths, setSimMonths] = useState('12');
  const [simResults, setSimResults] = useState<SimulatorScenarioResult[] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const simFormId = useId();

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
        description: t('pages.vaults.depositSuccessDesc', {
          amount: formatCurrency(amount),
        }),
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
        description: t('pages.vaults.withdrawSuccessDesc', {
          amount: formatCurrency(amount),
        }),
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
          description: t('pages.vaults.yieldAppliedDesc', {
            amount: formatCurrency(response.yield_applied),
          }),
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

  // Recurring Contributions handlers
  const openContributionsDialog = async (vault: VaultType) => {
    setSelectedVault(vault);
    setIsContributionFormOpen(false);
    setEditingContribution(null);
    setIsContributionsLoading(true);
    setIsContributionsDialogOpen(true);
    try {
      const data = await vaultsService.getContributions(vault.id);
      setContributions(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsContributionsLoading(false);
    }
  };

  const openContributionForm = (contribution?: VaultRecurringContribution) => {
    if (contribution) {
      setEditingContribution(contribution);
      setContributionFormData({
        amount: parseFloat(contribution.amount),
        day_of_month: contribution.day_of_month,
        is_active: contribution.is_active,
        start_date: contribution.start_date,
        end_date: contribution.end_date,
        description: contribution.description,
      });
    } else {
      setEditingContribution(null);
      setContributionFormData({
        amount: 0,
        day_of_month: 10,
        is_active: true,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: undefined,
        description: '',
      });
    }
    setIsContributionFormOpen(true);
  };

  const handleSaveContribution = async () => {
    if (!selectedVault) return;
    try {
      setIsSubmitting(true);
      if (editingContribution) {
        await vaultsService.updateContribution(
          editingContribution.id,
          contributionFormData
        );
        toast({
          title: t('pages.vaults.recurringContributions.updated'),
          description: t('pages.vaults.recurringContributions.updatedDesc'),
        });
      } else {
        await vaultsService.createContribution(selectedVault.id, contributionFormData);
        toast({
          title: t('pages.vaults.recurringContributions.created'),
          description: t('pages.vaults.recurringContributions.createdDesc'),
        });
      }
      setIsContributionFormOpen(false);
      setEditingContribution(null);
      const data = await vaultsService.getContributions(selectedVault.id);
      setContributions(data);
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

  const handleDeleteContribution = async (contribution: VaultRecurringContribution) => {
    const confirmed = await showConfirm({
      title: t('pages.vaults.recurringContributions.deleteTitle'),
      description: t('pages.vaults.recurringContributions.deleteDesc'),
    });
    if (!confirmed || !selectedVault) return;
    try {
      await vaultsService.deleteContribution(contribution.id);
      toast({
        title: t('pages.vaults.recurringContributions.deleted'),
        description: t('pages.vaults.recurringContributions.deletedDesc'),
      });
      const data = await vaultsService.getContributions(selectedVault.id);
      setContributions(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleGenerateContributions = async () => {
    try {
      setIsGenerating(true);
      const result = await vaultsService.generateContributions(generateMonth);
      toast({
        title: t('pages.vaults.recurringContributions.generateSuccess'),
        description: t('pages.vaults.recurringContributions.generateSuccessDesc', {
          count: result.generated_count,
        }),
      });
      setIsGenerateDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.vaults.recurringContributions.generateError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
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

  const openSimulator = (vault: VaultType) => {
    setSimulatorVault(vault);
    setSimInitialAmount(vault.current_balance);
    setSimMonthlyDeposit('');
    setSimAnnualRate(String(vault.annual_yield_rate_percentage.toFixed(2)));
    setSimMonths('12');
    setSimResults(null);
    setIsSimulatorOpen(true);
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const data = await vaultSimulatorService.simulate([
        {
          name: simulatorVault?.description || 'Simulação',
          initial_amount: parseFloat(simInitialAmount) || 0,
          monthly_deposit: parseFloat(simMonthlyDeposit) || 0,
          annual_rate: parseFloat(simAnnualRate) || 0,
          months: parseInt(simMonths) || 12,
        },
      ]);
      setSimResults(data.scenarios);
    } catch (err) {
      toast({
        title: t('pages.vaultSimulator.simulationError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const simChartData = useMemo(() => {
    if (!simResults?.length) return [];
    return simResults[0].data_points.map((dp) => ({
      label: dp.label,
      value: dp.balance,
    }));
  }, [simResults]);

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
            title={t('pages.vaults.depositBtn')}
            disabled={!vault.is_active}
          >
            <ArrowDownToLine className="h-4 w-4 text-success" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openWithdrawDialog(vault)}
            aria-label={t('pages.vaults.withdrawBtn')}
            title={t('pages.vaults.withdrawBtn')}
            disabled={!vault.is_active || parseFloat(vault.current_balance) <= 0}
          >
            <ArrowUpFromLine className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleApplyYield(vault)}
            aria-label={t('pages.vaults.applyYieldBtn')}
            title={t('pages.vaults.applyYieldBtn')}
            disabled={!vault.is_active || vault.pending_yield <= 0}
          >
            <RefreshCcw className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openTransactionsDialog(vault)}
            aria-label={t('pages.vaults.transactionsBtn')}
            title={t('pages.vaults.transactionsBtn')}
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openContributionsDialog(vault)}
            aria-label={t('pages.vaults.recurringContributions.btn')}
            title={t('pages.vaults.recurringContributions.btn')}
          >
            <CalendarClock className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openSimulator(vault)}
            title={t('pages.vaultSimulator.title')}
            aria-label={t('pages.vaultSimulator.title')}
          >
            <TrendingUp className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(vault)}
            title={t('common.actions.edit')}
            aria-label={t('common.actions.edit')}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(vault.id)}
            title={t('common.actions.delete')}
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

      <div className="mb-4 flex justify-end">
        <Button variant="outline" onClick={() => setIsGenerateDialogOpen(true)}>
          <Zap className="mr-2 h-4 w-4" />
          {t('pages.vaults.recurringContributions.generateBtn')}
        </Button>
      </div>

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
        emptyState={{
          icon: <Vault className="h-12 w-12 text-muted-foreground" />,
          message: t('pages.vaults.emptyState'),
        }}
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
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked === true })
                }
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                {t('pages.vaults.activeVault')}
              </Label>
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
                                      title={t('common.actions.edit')}
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
                                      title={t('common.actions.delete')}
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
      {/* Generate Contributions Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('pages.vaults.recurringContributions.generateTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.vaults.recurringContributions.generateDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="generate_month">
                {t('pages.vaults.recurringContributions.generateMonth')}
              </Label>
              <Input
                id="generate_month"
                type="month"
                value={generateMonth}
                onChange={(e) => setGenerateMonth(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleGenerateContributions} disabled={isGenerating}>
              {isGenerating
                ? t('common.actions.saving')
                : t('pages.vaults.recurringContributions.generateConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Contributions Dialog */}
      <Dialog
        open={isContributionsDialogOpen}
        onOpenChange={setIsContributionsDialogOpen}
      >
        <DialogContent className="custom-scrollbar max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pages.vaults.recurringContributions.title')}</DialogTitle>
            <DialogDescription>
              {selectedVault &&
                t('pages.vaults.recurringContributions.desc', {
                  name: selectedVault.description,
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* New contribution button */}
            {!isContributionFormOpen && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => openContributionForm()}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t('pages.vaults.recurringContributions.newBtn')}
                </Button>
              </div>
            )}

            {/* Inline form */}
            {isContributionFormOpen && (
              <div className="space-y-3 rounded-md border p-4">
                <h4 className="text-sm font-medium">
                  {editingContribution
                    ? t('common.actions.edit')
                    : t('pages.vaults.recurringContributions.newBtn')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="contrib_description">
                      {t('pages.vaults.recurringContributions.fields.description')}
                    </Label>
                    <Input
                      id="contrib_description"
                      value={contributionFormData.description}
                      onChange={(e) =>
                        setContributionFormData({
                          ...contributionFormData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Ex: Poupança mensal"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contrib_amount">
                      {t('pages.vaults.recurringContributions.fields.amount')}
                    </Label>
                    <Input
                      id="contrib_amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={contributionFormData.amount}
                      onChange={(e) =>
                        setContributionFormData({
                          ...contributionFormData,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contrib_day">
                      {t('pages.vaults.recurringContributions.fields.dayOfMonth')}
                    </Label>
                    <Input
                      id="contrib_day"
                      type="number"
                      min="1"
                      max="31"
                      value={contributionFormData.day_of_month}
                      onChange={(e) =>
                        setContributionFormData({
                          ...contributionFormData,
                          day_of_month: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="contrib_start">
                      {t('pages.vaults.recurringContributions.fields.startDate')}
                    </Label>
                    <Input
                      id="contrib_start"
                      type="date"
                      value={contributionFormData.start_date}
                      onChange={(e) =>
                        setContributionFormData({
                          ...contributionFormData,
                          start_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="contrib_end">
                      {t('pages.vaults.recurringContributions.fields.endDate')}
                    </Label>
                    <Input
                      id="contrib_end"
                      type="date"
                      value={contributionFormData.end_date || ''}
                      onChange={(e) =>
                        setContributionFormData({
                          ...contributionFormData,
                          end_date: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Checkbox
                      id="contrib_active"
                      checked={contributionFormData.is_active}
                      onCheckedChange={(checked) =>
                        setContributionFormData({
                          ...contributionFormData,
                          is_active: checked === true,
                        })
                      }
                    />
                    <Label htmlFor="contrib_active" className="cursor-pointer">
                      {t('pages.vaults.recurringContributions.fields.isActive')}
                    </Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsContributionFormOpen(false);
                      setEditingContribution(null);
                    }}
                  >
                    {t('common.actions.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveContribution}
                    disabled={
                      isSubmitting ||
                      !contributionFormData.description ||
                      contributionFormData.amount <= 0
                    }
                  >
                    {isSubmitting
                      ? t('common.actions.saving')
                      : t('common.actions.save')}
                  </Button>
                </div>
              </div>
            )}

            {/* Contributions list */}
            {isContributionsLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('common.messages.loading')}
              </div>
            ) : contributions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('pages.vaults.recurringContributions.emptyState')}
              </div>
            ) : (
              <div className="space-y-2">
                {contributions.map((contribution) => (
                  <div
                    key={contribution.id}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {contribution.description}
                        </span>
                        <Badge
                          variant={contribution.is_active ? 'default' : 'secondary'}
                          className="shrink-0 text-xs"
                        >
                          {contribution.is_active
                            ? t('pages.vaults.recurringContributions.active')
                            : t('pages.vaults.recurringContributions.inactive')}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-success">
                        {formatCurrency(parseFloat(contribution.amount))}
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        <div>
                          {t('pages.vaults.columns.date')}: {contribution.day_of_month}{' '}
                          &bull; {contribution.start_date}
                          {contribution.end_date && ` → ${contribution.end_date}`}
                        </div>
                        {contribution.next_contribution_date &&
                          contribution.is_active && (
                            <div>
                              {t('pages.vaults.recurringContributions.nextDate')}{' '}
                              {new Date(
                                contribution.next_contribution_date
                              ).toLocaleDateString(i18n.language)}
                            </div>
                          )}
                        {contribution.last_generated_month && (
                          <div>
                            {t('pages.vaults.recurringContributions.lastGenerated')}{' '}
                            {contribution.last_generated_month}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openContributionForm(contribution)}
                        aria-label={t('common.actions.edit')}
                        title={t('common.actions.edit')}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteContribution(contribution)}
                        aria-label={t('common.actions.delete')}
                        title={t('common.actions.delete')}
                      >
                        <Trash2
                          className="h-4 w-4 text-destructive"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsContributionsDialogOpen(false)}
            >
              {t('common.actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulator dialog */}
      <Dialog open={isSimulatorOpen} onOpenChange={setIsSimulatorOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('pages.vaultSimulator.title')} — {simulatorVault?.description}
            </DialogTitle>
            <DialogDescription>{t('pages.vaults.simulatorDesc')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t('pages.vaultSimulator.initialAmount')}
              </Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={simInitialAmount}
                onChange={(e) => setSimInitialAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t('pages.vaultSimulator.monthlyDeposit')}
              </Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={simMonthlyDeposit}
                onChange={(e) => setSimMonthlyDeposit(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('pages.vaultSimulator.annualRate')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={simAnnualRate}
                onChange={(e) => setSimAnnualRate(e.target.value)}
                placeholder="12,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('pages.vaultSimulator.termMonths')}</Label>
              <Input
                type="number"
                min="1"
                max="600"
                step="1"
                value={simMonths}
                onChange={(e) => setSimMonths(e.target.value)}
                placeholder="12"
              />
            </div>
          </div>

          <Button onClick={() => void handleSimulate()} disabled={isSimulating}>
            <Calculator className="mr-2 h-4 w-4" />
            {isSimulating
              ? t('pages.vaultSimulator.calculating')
              : t('pages.vaultSimulator.calculate')}
          </Button>

          {simResults && simResults.length > 0 && (
            <div className="space-y-3 rounded-lg border p-4">
              {simResults.map((s, idx) => (
                <div
                  key={`${simFormId}-${idx}`}
                  className="grid grid-cols-2 gap-2 text-sm"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.vaultSimulator.columns.totalInvested')}
                    </p>
                    <p className="font-semibold">{formatCurrency(s.total_invested)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.vaultSimulator.columns.yield')}
                    </p>
                    <p className="font-semibold text-success">
                      {formatCurrency(s.total_yield)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.vaultSimulator.columns.finalBalance')}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(s.final_balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.vaultSimulator.columns.term')}
                    </p>
                    <p className="font-semibold">
                      {t('pages.vaultSimulator.monthsValue', { count: s.months })}
                    </p>
                  </div>
                </div>
              ))}
              {simChartData.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('pages.vaults.simulatorFinalBalance', {
                      months: simResults[0].months,
                    })}
                  </p>
                  <div className="flex h-16 items-end gap-0.5">
                    {simChartData
                      .filter(
                        (_, i) =>
                          i % Math.max(1, Math.floor(simChartData.length / 20)) === 0
                      )
                      .map((d, i) => {
                        const max = Math.max(...simChartData.map((x) => x.value));
                        const pct = max > 0 ? (d.value / max) * 100 : 0;
                        return (
                          <div
                            key={i}
                            title={`${d.label}: ${formatCurrency(d.value)}`}
                            className="flex-1 rounded-sm bg-primary/60 transition-colors hover:bg-primary"
                            style={{ height: `${pct}%`, minHeight: '2px' }}
                          />
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
