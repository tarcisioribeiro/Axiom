/* eslint-disable max-lines */
import {
  PlusIcon as Plus,
  PencilIcon as Pencil,
  TrashIcon as Trash2,
  EyeIcon as Eye,
  EyeSlashIcon as EyeOff,
  ArrowTopRightOnSquareIcon as ExternalLink,
  ArrowPathIcon as Loader2,
  Square2StackIcon as Copy,
  CheckIcon as Check,
  StarIcon as Star,
  WalletIcon as Wallet,
  BuildingOffice2Icon as Building2,
} from '@heroicons/react/24/solid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { StoredAccountForm } from '@/components/security/StoredAccountForm';
import { VaultGuard } from '@/components/security/VaultGuard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { getErrorMessage } from '@/utils/error-utils';

type AccountTypeConfig = { badge: string; avatar: string; border: string };

const ACCOUNT_TYPE_CONFIG: Record<string, AccountTypeConfig> = {
  CC: {
    badge: 'bg-primary/10 text-primary border-primary/25',
    avatar: 'bg-primary/15 text-primary ring-1 ring-primary/25',
    border: 'border-l-primary/60',
  },
  CS: {
    badge: 'bg-success/10 text-success border-success/25',
    avatar: 'bg-success/15 text-success ring-1 ring-success/25',
    border: 'border-l-success/60',
  },
  CP: {
    badge: 'bg-info/10 text-info border-info/25',
    avatar: 'bg-info/15 text-info ring-1 ring-info/25',
    border: 'border-l-info/60',
  },
  CI: {
    badge: 'bg-warning/10 text-warning border-warning/25',
    avatar: 'bg-warning/15 text-warning ring-1 ring-warning/25',
    border: 'border-l-warning/60',
  },
  OTHER: {
    badge: '',
    avatar: 'bg-muted text-muted-foreground ring-1 ring-border',
    border: 'border-l-border',
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

export default function StoredAccounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<
    StoredBankAccount | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState<
    Map<number, { account_number?: string; password?: string; password2?: string }>
  >(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['stored-accounts'],
    queryFn: async () => {
      try {
        const [accountsData, financeAccountsData, memberData] = await Promise.all([
          storedAccountsService.getAll(),
          accountsService.getAll(),
          membersService.getCurrentUserMember(),
        ]);
        return {
          accounts: accountsData,
          financeAccounts: financeAccountsData,
          currentUserMember: memberData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
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
        description: t('pages.storedAccounts.deletedDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
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

    const confirmed = await showConfirm({
      title: t('pages.storedAccounts.revealTitle'),
      description: t('pages.storedAccounts.revealDesc'),
      confirmText: t('pages.storedAccounts.revealBtn'),
      cancelText: t('common.actions.cancel'),
    });

    if (!confirmed) return;

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
        description: t('pages.storedAccounts.revealedDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.storedAccounts.revealError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    toast({
      title: t('common.messages.copied'),
      description: t('common.messages.copiedDesc', { label }),
    });
  };

  const handleCopyAccountNumber = async (id: number) => {
    try {
      setCopyingId(id);
      const data = await storedAccountsService.copy(id);
      await copyToClipboard(data.account_number);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.copyError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setCopyingId(null);
    }
  };

  const handleSubmit = async (data: StoredBankAccountFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedAccount) {
        const updateData = { ...data };
        if (!updateData.password) delete updateData.password;
        if (!updateData.digital_password) delete updateData.digital_password;
        await storedAccountsService.update(selectedAccount.id, updateData);
        toast({
          title: t('pages.storedAccounts.updated'),
          description: t('pages.storedAccounts.updatedDesc'),
        });
      } else {
        await storedAccountsService.create(data);
        toast({
          title: t('pages.storedAccounts.created'),
          description: t('pages.storedAccounts.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
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
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (showFavoritesOnly && !acc.is_favorite) return false;
    return (
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.institution_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_number_masked?.includes(searchTerm)
    );
  });

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.storedAccounts.title')} icon={<Wallet />}>
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.storedAccounts.newBtn')}
          </Button>
        </PageHeader>

        <FilterBar
          hasActiveFilters={!!searchTerm || showFavoritesOnly}
          onClear={() => {
            setSearchTerm('');
            setShowFavoritesOnly(false);
          }}
        >
          <SearchInput
            placeholder={t('pages.storedAccounts.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className="gap-xs"
            title={t('common.actions.favorites')}
          >
            <Star className={cn('h-4 w-4', showFavoritesOnly && 'fill-current')} />
            {t('common.actions.favorites')}
          </Button>
        </FilterBar>

        {!isLoading && filteredAccounts.length === 0 ? (
          <EmptyState
            icon={<Building2 className="text-muted-foreground h-12 w-12" />}
            message={
              searchTerm
                ? t('pages.storedAccounts.emptySearch')
                : t('pages.storedAccounts.emptySearch')
            }
          />
        ) : (
          <div className="gap-md grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filteredAccounts.map((acc) => {
              const typeCfg =
                ACCOUNT_TYPE_CONFIG[acc.account_type] ?? DEFAULT_ACCOUNT_TYPE;
              const revealed = revealedData.get(acc.id);
              const initials = getInstitutionInitials(acc.institution_name);

              return (
                <Card
                  key={acc.id}
                  className={cn('overflow-hidden border-l-2', typeCfg.border)}
                >
                  <CardHeader className="pb-3">
                    {/* Institution row */}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                          typeCfg.avatar
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate leading-tight font-semibold">
                          {acc.name}
                        </p>
                        <p className="text-muted-foreground truncate text-sm">
                          {translate('institutions', acc.institution_name)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn('shrink-0 text-xs', typeCfg.badge)}
                      >
                        {translate('accountTypes', acc.account_type)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    {/* Account details */}
                    <div className="space-y-sm bg-muted/40 py-sm rounded-lg px-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          {t('pages.storedAccounts.columns.number')}
                        </span>
                        <span className="font-mono">
                          {revealed?.account_number ?? acc.account_number_masked}
                        </span>
                      </div>
                      {acc.agency && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            {t('pages.storedAccounts.columns.agency')}
                          </span>
                          <span className="font-mono">{acc.agency}</span>
                        </div>
                      )}
                    </div>

                    {/* Passwords section */}
                    {revealed ? (
                      <div className="space-y-sm border-primary/20 bg-primary/5 py-sm rounded-lg border px-3">
                        <div className="gap-sm flex items-center justify-between text-sm">
                          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            {t('pages.storedAccounts.password1')}
                          </span>
                          <div className="gap-xs flex items-center">
                            <span className="font-mono">
                              {revealed.password ||
                                t('pages.storedAccounts.noPassword')}
                            </span>
                            {revealed.password && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                                onClick={() =>
                                  handleCopy(
                                    revealed.password!,
                                    t('pages.storedAccounts.password1')
                                  )
                                }
                                aria-label={t('common.actions.copy')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="gap-sm flex items-center justify-between text-sm">
                          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            {t('pages.storedAccounts.password2')}
                          </span>
                          <div className="gap-xs flex items-center">
                            <span className="font-mono">
                              {revealed.password2 ||
                                t('pages.storedAccounts.noPassword')}
                            </span>
                            {revealed.password2 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                                onClick={() =>
                                  handleCopy(
                                    revealed.password2!,
                                    t('pages.storedAccounts.password2')
                                  )
                                }
                                aria-label={t('common.actions.copy')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/40 py-sm rounded-lg px-3">
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          {t('pages.storedAccounts.columns.passwords')}
                        </p>
                        <p className="text-muted-foreground mt-0.5 font-mono text-sm">
                          ••••••••
                        </p>
                      </div>
                    )}

                    {/* Footer: finance link + actions */}
                    <div className="gap-sm pt-xs flex items-center justify-between">
                      <div className="min-w-0">
                        {acc.finance_account_name && (
                          <button
                            className="text-primary flex items-center gap-0.5 truncate text-xs hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigate('/accounts');
                            }}
                          >
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            {acc.finance_account_name}
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleReveal(acc.id)}
                          disabled={revealingId === acc.id}
                          title={
                            revealed
                              ? t('common.actions.hide')
                              : t('common.actions.reveal')
                          }
                          aria-label={
                            revealed
                              ? t('common.actions.hide')
                              : t('common.actions.reveal')
                          }
                        >
                          {revealingId === acc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : revealed ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn(
                            'h-8 w-8 p-0',
                            copiedId === acc.id && 'text-success'
                          )}
                          onClick={() => void handleCopyAccountNumber(acc.id)}
                          disabled={copyingId === acc.id}
                          title={
                            copiedId === acc.id
                              ? t('common.messages.copied')
                              : t('pages.storedAccounts.copyAccountNumber')
                          }
                          aria-label={t('pages.storedAccounts.copyAccountNumber')}
                        >
                          {copyingId === acc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : copiedId === acc.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn(
                            'h-8 w-8 p-0',
                            acc.is_favorite && 'text-warning'
                          )}
                          onClick={() => void handleToggleFavorite(acc.id)}
                          title={t('common.actions.favorite')}
                          aria-label={t('common.actions.favorite')}
                        >
                          <Star
                            className={cn(
                              'h-3.5 w-3.5',
                              acc.is_favorite && 'fill-current'
                            )}
                            aria-hidden="true"
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(acc)}
                          title={t('common.actions.edit')}
                          aria-label={t('common.actions.edit')}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDelete(acc.id)}
                          title={t('common.actions.delete')}
                          aria-label={t('common.actions.delete')}
                        >
                          <Trash2
                            className="text-destructive h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="custom-scrollbar max-w-2xl">
            <DialogHeader>
              <DialogTitle>
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
    </VaultGuard>
  );
}
