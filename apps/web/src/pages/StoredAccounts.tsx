/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Copy,
  CreditCard,
  Hash,
  Plus,
  Search,
  Shapes,
  Star,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import {
  StoredAccountDetailModal,
  type RevealedAccount,
} from '@/components/security/StoredAccountDetailModal';
import { StoredAccountForm } from '@/components/security/StoredAccountForm';
import { VaultGuard } from '@/components/security/VaultGuard';
import { VaultItemCard } from '@/components/security/VaultItemCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { STORED_ACCOUNT_TYPE_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useCurrentScreen, useScreenAccess } from '@/hooks/use-screen-access';
import { useToast } from '@/hooks/use-toast';
import { cn, copyToClipboard } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { membersService } from '@/services/members-service';
import { storedAccountsService } from '@/services/stored-accounts-service';
import type {
  StoredBankAccount,
  StoredBankAccountFormData,
  Account,
  Member,
} from '@/types';
import { ACCOUNT_TYPES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type AccountTypeConfig = { badge: string; avatar: string };

const ACCOUNT_TYPE_CONFIG: Record<string, AccountTypeConfig> = {
  CC: {
    badge: 'bg-primary/10 text-primary border-primary/25',
    avatar: 'bg-primary/15 text-primary ring-1 ring-primary/25',
  },
  CS: {
    badge: 'bg-success/10 text-success border-success/25',
    avatar: 'bg-success/15 text-success ring-1 ring-success/25',
  },
  CP: {
    badge: 'bg-info/10 text-info border-info/25',
    avatar: 'bg-info/15 text-info ring-1 ring-info/25',
  },
  CI: {
    badge: 'bg-warning/10 text-warning border-warning/25',
    avatar: 'bg-warning/15 text-warning ring-1 ring-warning/25',
  },
  OTHER: {
    badge: '',
    avatar: 'bg-muted text-muted-foreground ring-1 ring-border',
  },
};

const DEFAULT_ACCOUNT_TYPE: AccountTypeConfig = ACCOUNT_TYPE_CONFIG.OTHER;

function getInstitutionInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const EMPTY_ACCOUNTS: StoredBankAccount[] = [];
const EMPTY_FINANCE_ACCOUNTS: Account[] = [];

function StoredAccountsContent() {
  const { can } = useCurrentScreen();
  // Vínculo com a conta de Finanças só para quem tem a tela Contas
  const canLinkAccounts = useScreenAccess().can('finance.accounts');
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<
    StoredBankAccount | undefined
  >();
  const [detailAccount, setDetailAccount] = useState<StoredBankAccount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState<Map<number, RevealedAccount>>(
    new Map()
  );
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['stored-accounts', canLinkAccounts],
    queryFn: async () => {
      try {
        const [accountsData, financeAccountsData, memberData] = await Promise.all([
          storedAccountsService.getAll(),
          canLinkAccounts ? accountsService.getAll() : EMPTY_FINANCE_ACCOUNTS,
          membersService.getCurrentUserMember(),
        ]);
        return {
          accounts: accountsData,
          financeAccounts: financeAccountsData,
          currentUserMember: memberData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return {
          accounts: EMPTY_ACCOUNTS,
          financeAccounts: EMPTY_FINANCE_ACCOUNTS,
          currentUserMember: null as Member | null,
        };
      }
    },
  });
  const accounts = data?.accounts ?? EMPTY_ACCOUNTS;
  const financeAccounts = data?.financeAccounts ?? EMPTY_FINANCE_ACCOUNTS;
  const currentUserMember = data?.currentUserMember ?? null;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['stored-accounts'] });

  const handleCreate = () => {
    setSelectedAccount(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: StoredBankAccount) => {
    setSelectedAccount(account);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.storedAccounts.deleteTitle'),
      description: t('pages.storedAccounts.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await storedAccountsService.delete(id);
      toast({
        title: t('pages.storedAccounts.deleted'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleReveal = async (id: number) => {
    if (revealedData.has(id)) {
      const newMap = new Map(revealedData);
      newMap.delete(id);
      setRevealedData(newMap);
      return;
    }

    try {
      setRevealingId(id);
      const data = await storedAccountsService.reveal(id);
      const newMap = new Map(revealedData);
      newMap.set(id, {
        account_number: data.account_number,
        password: data.password,
        password2: data.digital_password,
      });
      setRevealedData(newMap);
      toast({
        title: t('pages.storedAccounts.revealed'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.storedAccounts.revealError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setRevealingId(null);
    }
  };

  // Copia a conta completa, um campo por linha com rótulo.
  const handleCopyAccountDetails = async (account: StoredBankAccount) => {
    try {
      const data = await storedAccountsService.copy(account.id);
      await copyToClipboard(
        [
          `${t('common.fields.institution')}: ${translate('institutions', account.institution_name)}`,
          `${t('pages.storedAccounts.columns.number')}: ${data.account_number}`,
          `${t('pages.storedAccounts.password1')}: ${data.password || '—'}`,
          `${t('pages.storedAccounts.password2')}: ${data.digital_password || '—'}`,
        ].join('\n')
      );
      toast({ title: t('common.messages.copied') });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.copyError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: StoredBankAccountFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedAccount) {
        const updateData: Partial<StoredBankAccountFormData> = { ...data };
        if (!updateData.account_number) delete updateData.account_number;
        if (!updateData.password) delete updateData.password;
        if (!updateData.digital_password) delete updateData.digital_password;
        await storedAccountsService.update(selectedAccount.id, updateData);
        toast({
          title: t('pages.storedAccounts.updated'),
        });
      } else {
        await storedAccountsService.create(data);
        toast({
          title: t('pages.storedAccounts.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      const updated = await storedAccountsService.toggleFavorite(id);
      queryClient.setQueryData<typeof data>(['stored-accounts'], (prev) =>
        prev
          ? { ...prev, accounts: prev.accounts.map((a) => (a.id === id ? updated : a)) }
          : prev
      );
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const institutionOptions = useMemo(
    () => Array.from(new Set(accounts.map((acc) => acc.institution_name))).sort(),
    [accounts]
  );

  const filteredAccounts = accounts.filter((acc) => {
    if (showFavoritesOnly && !acc.is_favorite) return false;
    if (accountTypeFilter !== 'all' && acc.account_type !== accountTypeFilter)
      return false;
    if (institutionFilter !== 'all' && acc.institution_name !== institutionFilter)
      return false;
    return (
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.institution_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_number_masked?.includes(searchTerm)
    );
  });

  return (
    <>
      <PageContainer>
        <PageHeader title={t('pages.storedAccounts.title')} icon={<Wallet />}>
          {can('add') && (
            <Button onClick={handleCreate} className="gap-sm">
              <Plus className="h-4 w-4" />
              {t('pages.storedAccounts.newBtn')}
            </Button>
          )}
        </PageHeader>

        <FilterBar
          hasActiveFilters={
            !!searchTerm ||
            showFavoritesOnly ||
            accountTypeFilter !== 'all' ||
            institutionFilter !== 'all'
          }
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
            setAccountTypeFilter('all');
            setInstitutionFilter('all');
          }}
          activeFilters={[
            ...(accountTypeFilter !== 'all'
              ? [
                  {
                    key: 'accountType',
                    label: `${t('pages.storedAccounts.allTypes')}: ${t(`pages.storedAccounts.accountTypes.${accountTypeFilter}`)}`,
                    onRemove: () => setAccountTypeFilter('all'),
                  },
                ]
              : []),
            ...(institutionFilter !== 'all'
              ? [
                  {
                    key: 'institution',
                    label: `${t('pages.storedAccounts.allInstitutions')}: ${translate('institutions', institutionFilter)}`,
                    onRemove: () => setInstitutionFilter('all'),
                  },
                ]
              : []),
          ]}
        >
          <FilterField label={t('common.filterLabels.search')} icon={Search}>
            <SearchInput
              placeholder={t('pages.storedAccounts.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-52 sm:w-64"
            />
          </FilterField>
          <FilterField label={t('common.fields.type')} icon={Shapes}>
            <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
              <SelectTrigger
                className="w-44"
                aria-label={t('pages.storedAccounts.allTypes')}
                startIcon={<CreditCard className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.storedAccounts.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.storedAccounts.allTypes')}
                </SelectItem>
                {ACCOUNT_TYPES.map(({ value }) => {
                  const Icon = STORED_ACCOUNT_TYPE_ICONS[value] ?? Building2;
                  return (
                    <SelectItem
                      key={value}
                      value={value}
                      icon={<Icon className="h-4 w-4" />}
                    >
                      {t(`pages.storedAccounts.accountTypes.${value}`)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.fields.institution')} icon={Building2}>
            <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
              <SelectTrigger
                className="w-48"
                aria-label={t('pages.storedAccounts.allInstitutions')}
                startIcon={<Building2 className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.storedAccounts.allInstitutions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.storedAccounts.allInstitutions')}
                </SelectItem>
                {institutionOptions.map((institution) => (
                  <SelectItem key={institution} value={institution}>
                    {translate('institutions', institution)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('common.actions.favorites')}
          </Button>
        </FilterBar>

        {!isLoading && filteredAccounts.length === 0 ? (
          <EmptyState
            icon={<Building2 className="text-muted-foreground h-12 w-12" />}
            title={t('pages.storedAccounts.emptySearch')}
          />
        ) : (
          <PaginatedSlide
            key={`${searchTerm}-${accountTypeFilter}-${institutionFilter}-${showFavoritesOnly}`}
            items={filteredAccounts}
            pageSize={GRID_PAGE_SIZE}
            className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          >
            {(pageItems) =>
              pageItems.map((acc) => {
                const typeCfg =
                  ACCOUNT_TYPE_CONFIG[acc.account_type] ?? DEFAULT_ACCOUNT_TYPE;
                return (
                  <VaultItemCard
                    key={acc.id}
                    avatar={
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                          typeCfg.avatar
                        )}
                      >
                        {getInstitutionInitials(acc.institution_name)}
                      </div>
                    }
                    title={acc.name}
                    subtitle={translate('institutions', acc.institution_name)}
                    badge={
                      <Badge
                        variant="outline"
                        className={cn('shrink-0 text-xs', typeCfg.badge)}
                      >
                        {translate('accountTypes', acc.account_type)}
                      </Badge>
                    }
                    metric={
                      <span className="gap-xs text-muted-foreground flex items-center text-xs">
                        <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('pages.storedAccounts.columns.number')}{' '}
                        <span className="text-foreground font-medium">
                          {acc.account_number_masked}
                        </span>
                      </span>
                    }
                    isFavorite={acc.is_favorite}
                    onOpen={() => setDetailAccount(acc)}
                    onFavorite={() => void handleToggleFavorite(acc.id)}
                    onEdit={() => handleEdit(acc)}
                    onDelete={() => void handleDelete(acc.id)}
                    menuActions={[
                      {
                        icon: Copy,
                        label: t('common.actions.copyDetails'),
                        action: 'reveal',
                        onClick: () => void handleCopyAccountDetails(acc),
                        color: 'copy' as const,
                      },
                    ]}
                  />
                );
              })
            }
          </PaginatedSlide>
        )}

        <StoredAccountDetailModal
          account={detailAccount}
          revealed={detailAccount ? revealedData.get(detailAccount.id) : undefined}
          isRevealing={!!detailAccount && revealingId === detailAccount.id}
          onReveal={(id) => void handleReveal(id)}
          onClose={() => setDetailAccount(null)}
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle mode={selectedAccount ? 'edit' : 'create'}>
                {selectedAccount
                  ? t('pages.storedAccounts.editTitle')
                  : t('pages.storedAccounts.newTitle')}
              </DialogTitle>
              <DialogDescription>
                {selectedAccount
                  ? t('pages.storedAccounts.editDesc')
                  : t('pages.storedAccounts.newDesc')}
              </DialogDescription>
            </DialogHeader>
            <StoredAccountForm
              account={selectedAccount}
              financeAccounts={financeAccounts}
              currentMember={currentUserMember}
              onSubmit={handleSubmit}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </PageContainer>
    </>
  );
}

// Os dados do cofre só são buscados depois do desbloqueio (o conteúdo monta dentro do guard).
export default function StoredAccounts() {
  return (
    <VaultGuard>
      <StoredAccountsContent />
    </VaultGuard>
  );
}
