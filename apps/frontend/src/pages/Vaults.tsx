/* eslint-disable max-lines */
import { PiggyBank, Plus, Sparkles, TrendingUp, Vault, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VaultCard } from '@/components/vaults/VaultCard';
import { VaultContributionsDialog } from '@/components/vaults/VaultContributionsDialog';
import { VaultFormDialog } from '@/components/vaults/VaultFormDialog';
import { VaultGenerateDialog } from '@/components/vaults/VaultGenerateDialog';
import {
  VaultDepositDialog,
  VaultWithdrawDialog,
} from '@/components/vaults/VaultOperationDialogs';
import { VaultSimulatorDialog } from '@/components/vaults/VaultSimulatorDialog';
import { VaultTransactionsDialog } from '@/components/vaults/VaultTransactionsDialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { accountsService } from '@/services/accounts-service';
import { vaultsService } from '@/services/vaults-service';
import type { Account, Vault as VaultType } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Vaults() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const [vaults, setVaults] = useState<VaultType[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVault, setSelectedVault] = useState<VaultType | undefined>();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isContributionsOpen, setIsContributionsOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const loadData = useCallback(async () => {
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
  }, [toast, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    setIsFormOpen(true);
  };

  const handleEdit = (vault: VaultType) => {
    setSelectedVault(vault);
    setIsFormOpen(true);
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
    if (!confirmed) return;
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
  };

  const handleApplyYield = async (vault: VaultType) => {
    try {
      const response = await vaultsService.applyYield(vault.id);
      toast(
        response.yield_applied > 0
          ? {
              title: t('pages.vaults.yieldApplied'),
              description: t('pages.vaults.yieldAppliedDesc', {
                amount: formatCurrency(response.yield_applied),
              }),
            }
          : {
              title: t('pages.vaults.noYield'),
              description: t('pages.vaults.noYieldDesc'),
            }
      );
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const totalBalance = vaults.reduce(
    (sum, v) => sum + parseFloat(v.current_balance),
    0
  );
  const totalYield = vaults.reduce(
    (sum, v) => sum + parseFloat(v.accumulated_yield),
    0
  );
  const totalPendingYield = vaults.reduce((sum, v) => sum + v.pending_yield, 0);

  return (
    <PageContainer>
      <PageHeader title={t('pages.vaults.title')} icon={<Vault />}>
        <div className="flex items-center gap-sm">
          <Button variant="outline" onClick={() => setIsGenerateOpen(true)}>
            <Zap className="mr-sm h-4 w-4" />
            {t('pages.vaults.recurringContributions.generateBtn')}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-sm h-4 w-4" />
            {t('pages.vaults.newBtn')}
          </Button>
        </div>
      </PageHeader>

      <div className="mb-lg grid grid-cols-1 gap-md md:grid-cols-3">
        <Card className="border-t-2 border-t-success">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <PiggyBank className="h-4 w-4 text-success" />
              {t('pages.vaults.totalBalance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalBalance)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-amber-500">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {t('pages.vaults.totalYield')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalYield)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-info">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-info" />
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

      {isLoading ? (
        <LoadingState />
      ) : vaults.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Vault className="mb-md h-12 w-12" />
          <p>{t('pages.vaults.emptyState')}</p>
        </div>
      ) : (
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {vaults.map((vault, index) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              index={index}
              totalBalance={totalBalance}
              onDeposit={(v) => {
                setSelectedVault(v);
                setIsDepositOpen(true);
              }}
              onWithdraw={(v) => {
                setSelectedVault(v);
                setIsWithdrawOpen(true);
              }}
              onApplyYield={(v) => void handleApplyYield(v)}
              onTransactions={(v) => {
                setSelectedVault(v);
                setIsTransactionsOpen(true);
              }}
              onContributions={(v) => {
                setSelectedVault(v);
                setIsContributionsOpen(true);
              }}
              onSimulator={(v) => {
                setSelectedVault(v);
                setIsSimulatorOpen(true);
              }}
              onEdit={handleEdit}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      )}

      <VaultFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        selectedVault={selectedVault}
        accounts={accounts}
        onSuccess={() => void loadData()}
      />
      <VaultDepositDialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        vault={selectedVault}
        onSuccess={() => void loadData()}
      />
      <VaultWithdrawDialog
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        vault={selectedVault}
        onSuccess={() => void loadData()}
      />
      <VaultTransactionsDialog
        open={isTransactionsOpen}
        onOpenChange={setIsTransactionsOpen}
        vault={selectedVault}
        onSuccess={() => void loadData()}
      />
      <VaultContributionsDialog
        open={isContributionsOpen}
        onOpenChange={setIsContributionsOpen}
        vault={selectedVault}
      />
      <VaultGenerateDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onSuccess={() => void loadData()}
      />
      <VaultSimulatorDialog
        open={isSimulatorOpen}
        onOpenChange={setIsSimulatorOpen}
        vault={selectedVault ?? null}
      />
    </PageContainer>
  );
}
