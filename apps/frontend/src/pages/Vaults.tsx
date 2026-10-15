/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, Vault, Wallet, Zap } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VaultApplyYieldDialog } from '@/components/vaults/VaultApplyYieldDialog';
import { VaultCard } from '@/components/vaults/VaultCard';
import { VaultContributionsDialog } from '@/components/vaults/VaultContributionsDialog';
import { VaultDetailModal } from '@/components/vaults/VaultDetailModal';
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
import { accountsService } from '@/services/accounts-service';
import { vaultsService } from '@/services/vaults-service';
import type { Account, Vault as VaultType } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const EMPTY_VAULTS: VaultType[] = [];
const EMPTY_ACCOUNTS: Account[] = [];

export default function Vaults() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [selectedVault, setSelectedVault] = useState<VaultType | undefined>();
  const [detailVault, setDetailVault] = useState<VaultType | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isApplyYieldOpen, setIsApplyYieldOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [isContributionsOpen, setIsContributionsOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['vaults'],
    queryFn: async () => {
      try {
        const [vaultsData, accountsData] = await Promise.all([
          vaultsService.getAll(),
          accountsService.getAll(),
        ]);
        return { vaults: vaultsData, accounts: accountsData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return { vaults: EMPTY_VAULTS, accounts: EMPTY_ACCOUNTS };
      }
    },
  });
  const vaults = pageData?.vaults ?? EMPTY_VAULTS;
  const accounts = pageData?.accounts ?? EMPTY_ACCOUNTS;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['vaults'] });

  const handleCreate = () => {
    if (accounts.length === 0) {
      toast({
        title: t('pages.vaults.noAccountMsg'),
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
        title: t('pages.vaults.cannotDeleteWithBalance'),
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
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const filteredVaults = vaults.filter((vault) => {
    if (
      searchTerm &&
      !vault.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    if (accountFilter !== 'all' && String(vault.account) !== accountFilter)
      return false;
    return true;
  });

  const hasActiveFilters = searchTerm !== '' || accountFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setAccountFilter('all');
  };

  const totalBalance = vaults.reduce(
    (sum, v) => sum + parseFloat(v.current_balance),
    0
  );

  return (
    <PageContainer>
      <PageHeader title={t('pages.vaults.title')} icon={<Vault />}>
        <div className="gap-sm flex items-center">
          <Button variant="outline" onClick={() => setIsGenerateOpen(true)}>
            <Zap className="h-4 w-4" />
            {t('pages.vaults.recurringContributions.generateBtn')}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            {t('pages.vaults.newBtn')}
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <LoadingState />
      ) : vaults.length === 0 ? (
        <EmptyState
          icon={<Vault className="text-muted-foreground h-12 w-12" />}
          title={t('pages.vaults.emptyState')}
        />
      ) : (
        <>
          <FilterBar
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            activeFilters={[
              ...(accountFilter !== 'all'
                ? [
                    {
                      key: 'account',
                      label: `${t('pages.vaults.allAccounts')}: ${
                        accounts.find((a) => String(a.id) === accountFilter)
                          ?.account_name ?? accountFilter
                      }`,
                      onRemove: () => setAccountFilter('all'),
                    },
                  ]
                : []),
            ]}
          >
            <FilterField label={t('common.filterLabels.search')} icon={Search}>
              <SearchInput
                placeholder={t('pages.vaults.searchPlaceholder')}
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="w-44"
              />
            </FilterField>
            <FilterField label={t('common.fields.account')} icon={Wallet}>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger
                  className="w-48"
                  aria-label={t('pages.vaults.allAccounts')}
                  startIcon={<Building2 className="h-3.5 w-3.5" />}
                >
                  <SelectValue placeholder={t('pages.vaults.allAccounts')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('pages.vaults.allAccounts')}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </FilterBar>

          {filteredVaults.length === 0 ? (
            <EmptyState
              icon={<Vault className="text-muted-foreground h-12 w-12" />}
              title={t('pages.vaults.emptyState')}
            />
          ) : (
            <PaginatedSlide
              items={filteredVaults}
              pageSize={GRID_PAGE_SIZE}
              className="gap-md grid md:grid-cols-2 lg:grid-cols-3"
            >
              {(pageItems) =>
                pageItems.map((vault) => (
                  <VaultCard
                    key={vault.id}
                    vault={vault}
                    onOpenDetail={(v) => setDetailVault(v)}
                    onDeposit={(v) => {
                      setSelectedVault(v);
                      setIsDepositOpen(true);
                    }}
                    onWithdraw={(v) => {
                      setSelectedVault(v);
                      setIsWithdrawOpen(true);
                    }}
                    onApplyYield={(v) => {
                      setSelectedVault(v);
                      setIsApplyYieldOpen(true);
                    }}
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
                ))
              }
            </PaginatedSlide>
          )}
        </>
      )}

      <VaultFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        selectedVault={selectedVault}
        accounts={accounts}
        onSuccess={() => void refresh()}
      />
      <VaultDetailModal
        vault={detailVault ?? null}
        totalBalance={totalBalance}
        onClose={() => setDetailVault(undefined)}
      />
      <VaultDepositDialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        vault={selectedVault}
        onSuccess={() => void refresh()}
      />
      <VaultWithdrawDialog
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        vault={selectedVault}
        onSuccess={() => void refresh()}
      />
      <VaultApplyYieldDialog
        open={isApplyYieldOpen}
        onOpenChange={setIsApplyYieldOpen}
        vault={selectedVault}
        onSuccess={() => void refresh()}
      />
      <VaultTransactionsDialog
        open={isTransactionsOpen}
        onOpenChange={setIsTransactionsOpen}
        vault={selectedVault}
        onSuccess={() => void refresh()}
      />
      <VaultContributionsDialog
        open={isContributionsOpen}
        onOpenChange={setIsContributionsOpen}
        vault={selectedVault}
      />
      <VaultGenerateDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onSuccess={() => void refresh()}
      />
      <VaultSimulatorDialog
        open={isSimulatorOpen}
        onOpenChange={setIsSimulatorOpen}
        vault={selectedVault ?? null}
      />
    </PageContainer>
  );
}
