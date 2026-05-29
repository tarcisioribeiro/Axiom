/* eslint-disable max-lines */
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Copy,
  Wallet,
  Building2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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

export default function StoredAccounts() {
  const [accounts, setAccounts] = useState<StoredBankAccount[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<Account[]>([]);
  const [currentUserMember, setCurrentUserMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<
    StoredBankAccount | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState<
    Map<number, { password?: string; password2?: string }>
  >(new Map());
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [accountsData, financeAccountsData, memberData] = await Promise.all([
        storedAccountsService.getAll(),
        accountsService.getAll(),
        membersService.getCurrentUserMember(),
      ]);
      setAccounts(accountsData);
      setFinanceAccounts(financeAccountsData);
      setCurrentUserMember(memberData);
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
      void loadData();
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
      newMap.set(id, { password: data.password, password2: data.password2 });
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

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.institution_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_number_masked?.includes(searchTerm)
  );

  return (
    <VaultGuard>
      <PageContainer>
        <PageHeader title={t('pages.storedAccounts.title')} icon={<Wallet />}>
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.storedAccounts.newBtn')}
          </Button>
        </PageHeader>

        <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
          <SearchInput
            placeholder={t('pages.storedAccounts.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterBar>

        {!isLoading && filteredAccounts.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-12 w-12 text-muted-foreground" />}
            message={
              searchTerm
                ? t('pages.storedAccounts.emptySearch')
                : t('pages.storedAccounts.emptySearch')
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
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
                        <p className="truncate font-semibold leading-tight">
                          {acc.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
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
                    <div className="space-y-sm rounded-lg bg-muted/40 px-3 py-sm">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t('pages.storedAccounts.columns.number')}
                        </span>
                        <span className="font-mono">{acc.account_number_masked}</span>
                      </div>
                      {acc.agency && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('pages.storedAccounts.columns.agency')}
                          </span>
                          <span className="font-mono">{acc.agency}</span>
                        </div>
                      )}
                    </div>

                    {/* Passwords section */}
                    {revealed ? (
                      <div className="space-y-sm rounded-lg border border-primary/20 bg-primary/5 px-3 py-sm">
                        {revealed.password && (
                          <div className="flex items-center justify-between gap-sm text-sm">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t('pages.storedAccounts.password1')}
                            </span>
                            <div className="flex items-center gap-xs">
                              <span className="font-mono">{revealed.password}</span>
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
                            </div>
                          </div>
                        )}
                        {revealed.password2 && (
                          <div className="flex items-center justify-between gap-sm text-sm">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t('pages.storedAccounts.password2')}
                            </span>
                            <div className="flex items-center gap-xs">
                              <span className="font-mono">{revealed.password2}</span>
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
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-muted/40 px-3 py-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t('pages.storedAccounts.columns.passwords')}
                        </p>
                        <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                          ••••••••
                        </p>
                      </div>
                    )}

                    {/* Footer: finance link + actions */}
                    <div className="flex items-center justify-between gap-sm pt-xs">
                      <div className="min-w-0">
                        {acc.finance_account_name && (
                          <p className="truncate text-xs text-muted-foreground">
                            {acc.finance_account_name}
                          </p>
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
                            className="h-3.5 w-3.5 text-destructive"
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
          <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
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
