/* eslint-disable max-lines */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  ArrowLeftRight,
  FileUp,
  RefreshCw,
  Banknote,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AccountForm } from '@/components/accounts/AccountForm';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { getErrorMessage } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { bankReconciliationService } from '@/services/bank-reconciliation-service';
import type { Account, AccountFormData, BankStatementImport } from '@/types';

function ImportStatusBadge({ status }: { status: BankStatementImport['status'] }) {
  const { t } = useTranslation();
  const variants: Record<string, string> = {
    completed: 'bg-success/10 text-success border-success/30',
    processing: 'bg-warning/10 text-warning border-warning/30',
    failed: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  const labels: Record<string, string> = {
    completed: t('pages.accounts.imports.statusCompleted'),
    processing: t('pages.accounts.imports.statusProcessing'),
    failed: t('pages.accounts.imports.statusFailed'),
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-sm py-0.5 text-xs font-medium ${variants[status] ?? ''}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function Accounts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  // Bank reconciliation state
  const [reconciliationAccount, setReconciliationAccount] = useState<
    Account | undefined
  >();
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false);
  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [importsLoading, setImportsLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateAccounts = () =>
    queryClient.invalidateQueries({ queryKey: ['accounts'] });

  const createMutation = useMutation({
    mutationFn: (data: AccountFormData) => accountsService.create(data),
    onSuccess: () => {
      void invalidateAccounts();
      toast({
        title: t('pages.accounts.created'),
        description: t('pages.accounts.createdDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AccountFormData }) =>
      accountsService.update(id, data),
    onSuccess: () => {
      void invalidateAccounts();
      toast({
        title: t('pages.accounts.updated'),
        description: t('pages.accounts.updatedDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountsService.delete(id),
    onSuccess: () => {
      void invalidateAccounts();
      toast({
        title: t('pages.accounts.deleted'),
        description: t('pages.accounts.deletedDesc'),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const q = searchTerm.toLowerCase();
    return accounts.filter(
      (a) =>
        a.account_name.toLowerCase().includes(q) ||
        translate('institutions', a.institution).toLowerCase().includes(q) ||
        (a.account_number_masked ?? '').toLowerCase().includes(q)
    );
  }, [accounts, searchTerm]);

  const ACCOUNT_TYPE_COLORS: Record<
    string,
    { border: string; icon: string; bg: string }
  > = {
    CC: { border: 'border-l-info', icon: 'text-info', bg: 'bg-info/5' },
    CS: { border: 'border-l-success', icon: 'text-success', bg: 'bg-success/5' },
    FG: { border: 'border-l-warning', icon: 'text-warning', bg: 'bg-warning/5' },
    VA: { border: 'border-l-accent', icon: 'text-accent', bg: 'bg-accent/5' },
    VR: { border: 'border-l-accent', icon: 'text-accent', bg: 'bg-accent/5' },
    CP: { border: 'border-l-primary', icon: 'text-primary', bg: 'bg-primary/5' },
  };

  const BALANCE_DIST_COLORS = [
    'bg-info',
    'bg-success',
    'bg-primary',
    'bg-warning',
    'bg-accent',
    'bg-destructive',
  ] as const;

  const { totalBalance, totalAvailable } = useMemo(() => {
    const balance = accounts.reduce((s, a) => s + parseFloat(a.balance), 0);
    const available = accounts.reduce(
      (s, a) => s + parseFloat(a.balance) + parseFloat(a.overdraft_limit ?? '0'),
      0
    );
    return { totalBalance: balance, totalAvailable: available };
  }, [accounts]);

  const balanceDistribution = useMemo(() => {
    const positiveAccounts = accounts.filter((a) => parseFloat(a.balance) > 0);
    const totalPositive = positiveAccounts.reduce(
      (s, a) => s + parseFloat(a.balance),
      0
    );
    return { positiveAccounts, totalPositive };
  }, [accounts]);

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
    deleteMutation.mutate(id);
  };

  const handleSubmit = (data: AccountFormData) => {
    if (selectedAccount) {
      updateMutation.mutate({ id: selectedAccount.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openReconciliation = async (account: Account) => {
    setReconciliationAccount(account);
    setImportsLoading(true);
    setIsReconciliationOpen(true);
    try {
      const all = await bankReconciliationService.getAll();
      setImports(all.filter((imp) => imp.account === account.id));
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setImportsLoading(false);
    }
  };

  function detectFormat(filename: string): 'ofx' | 'csv' | '' {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.ofx')) return 'ofx';
    if (lower.endsWith('.csv')) return 'csv';
    return '';
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !reconciliationAccount) return;
    const format = detectFormat(uploadFile.name);
    if (!format) {
      toast({ title: 'Formato inválido. Use OFX ou CSV.', variant: 'destructive' });
      return;
    }
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('account', String(reconciliationAccount.id));
      formData.append('file_format', format);
      const imported = await bankReconciliationService.importFile(formData);
      try {
        const matched = await bankReconciliationService.runMatch(imported.id);
        setIsUploadOpen(false);
        setUploadFile(null);
        setIsReconciliationOpen(false);
        void navigate(`/bank-reconciliation/${matched.id}`);
      } catch {
        setIsUploadOpen(false);
        setUploadFile(null);
        setIsReconciliationOpen(false);
        void navigate(`/bank-reconciliation/${imported.id}`);
      }
    } catch (error: unknown) {
      toast({ title: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title={t('pages.accounts.title')} icon={<Wallet />}>
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.accounts.newBtn')}
        </Button>
      </PageHeader>

      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <SearchInput
          placeholder={t('pages.accounts.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
      </FilterBar>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Card
          className={`overflow-hidden border-t-2 ${totalBalance >= 0 ? 'border-t-success/60' : 'border-t-destructive/60'}`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.accounts.stats.totalBalance')}
            </p>
            <div
              className={`rounded-lg p-sm ring-1 ${totalBalance >= 0 ? 'bg-success/10 ring-success/20' : 'bg-destructive/10 ring-destructive/20'}`}
            >
              <Banknote
                className={`h-4 w-4 ${totalBalance >= 0 ? 'text-success' : 'text-destructive'}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-success' : 'text-destructive'}`}
            >
              {formatCurrency(totalBalance)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.accounts.stats.accountsCount', { count: accounts.length })}
            </p>
          </CardContent>
        </Card>

        <Card
          className={`overflow-hidden border-t-2 ${totalAvailable >= 0 ? 'border-t-info/60' : 'border-t-destructive/60'}`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.accounts.stats.availableBalance')}
            </p>
            <div
              className={`rounded-lg p-sm ring-1 ${totalAvailable >= 0 ? 'bg-info/10 ring-info/20' : 'bg-destructive/10 ring-destructive/20'}`}
            >
              <ShieldCheck
                className={`h-4 w-4 ${totalAvailable >= 0 ? 'text-info' : 'text-destructive'}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalAvailable >= 0 ? 'text-info' : 'text-destructive'}`}
            >
              {formatCurrency(totalAvailable)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.accounts.stats.overdraftIncluded')}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-primary/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.accounts.stats.count')}</p>
            <div className="rounded-lg bg-primary/10 p-sm ring-1 ring-primary/20">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{accounts.length}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.accounts.stats.institutionsSubtitle')}
            </p>
          </CardContent>
        </Card>
      </div>

      {balanceDistribution.positiveAccounts.length > 1 && (
        <div className="rounded-lg border bg-card p-md">
          <p className="mb-sm text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Distribuição de saldo
          </p>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {balanceDistribution.positiveAccounts.map((acc, i) => (
              <div
                key={acc.id}
                className={`h-full transition-all ${BALANCE_DIST_COLORS[i % BALANCE_DIST_COLORS.length]}`}
                style={{
                  width: `${(parseFloat(acc.balance) / balanceDistribution.totalPositive) * 100}%`,
                }}
                title={`${acc.account_name}: ${formatCurrency(acc.balance)}`}
              />
            ))}
          </div>
          <div className="mt-sm flex flex-wrap gap-md">
            {balanceDistribution.positiveAccounts.map((acc, i) => (
              <div key={acc.id} className="flex items-center gap-xs">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${BALANCE_DIST_COLORS[i % BALANCE_DIST_COLORS.length]}`}
                />
                <span className="text-xs text-muted-foreground">
                  {acc.account_name} · {formatCurrency(acc.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-12 w-12 text-muted-foreground" />}
          message={t('pages.accounts.emptyState')}
        />
      ) : (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAccounts.map((account) => {
            const balance = parseFloat(account.balance);
            const overdraft = parseFloat(account.overdraft_limit ?? '0');
            const available = balance + overdraft;
            const typeColors = ACCOUNT_TYPE_COLORS[account.account_type];
            const initials = account.account_name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase();
            return (
              <Card
                key={account.id}
                className={`overflow-hidden transition-shadow hover:shadow-md ${typeColors ? `border-l-4 ${typeColors.border}` : ''}`}
              >
                <CardHeader className="pb-sm">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex items-center gap-sm">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${typeColors ? `${typeColors.bg} ${typeColors.icon}` : 'bg-muted text-muted-foreground'}`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight">
                          {account.account_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {translate('institutions', account.institution)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {translate('accountTypes', account.account_type)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {account.account_number_masked && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {account.account_number_masked}
                    </p>
                  )}
                  <div className="rounded-lg bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      {t('pages.accounts.columns.balance')}
                    </p>
                    <p
                      className={`text-xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}
                    >
                      {formatCurrency(account.balance)}
                    </p>
                    {overdraft > 0 && (
                      <p
                        className={`text-xs ${available >= 0 ? 'text-muted-foreground' : 'text-destructive'}`}
                      >
                        {t('pages.accounts.available', {
                          value: formatCurrency(String(available)),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t pt-sm">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(account.created_at)}
                    </span>
                    <div className="flex gap-xs">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void openReconciliation(account)}
                        title="Conciliação Bancária"
                        aria-label="Conciliação Bancária"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(account)}
                        title={t('common.actions.edit')}
                        aria-label={t('common.actions.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(account.id)}
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

      {/* Bank Reconciliation dialog */}
      <Dialog open={isReconciliationOpen} onOpenChange={setIsReconciliationOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-sm">
              <ArrowLeftRight className="h-5 w-5" />
              Conciliação Bancária — {reconciliationAccount?.account_name}
            </DialogTitle>
            <DialogDescription>
              Importe extratos bancários para conciliar com suas transações.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsUploadOpen(true)}>
              <FileUp className="mr-sm h-4 w-4" />
              Importar Extrato
            </Button>
          </div>

          {importsLoading ? (
            <div className="flex items-center justify-center py-xl">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : imports.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="h-12 w-12 text-muted-foreground" />}
              title="Nenhum extrato importado"
              message="Clique em 'Importar Extrato' para começar."
            />
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">
                      {t('pages.accounts.imports.file')}
                    </th>
                    <th className="p-3 text-left font-medium">
                      {t('pages.accounts.imports.format')}
                    </th>
                    <th className="p-3 text-left font-medium">
                      {t('pages.accounts.imports.status')}
                    </th>
                    <th className="p-3 text-right font-medium">
                      {t('pages.accounts.imports.entries')}
                    </th>
                    <th className="p-3 text-right font-medium">
                      {t('pages.accounts.imports.matched')}
                    </th>
                    <th className="p-3 text-left font-medium">
                      {t('pages.accounts.imports.importedAt')}
                    </th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{imp.original_filename}</td>
                      <td className="p-3">
                        <Badge variant="outline">{imp.file_format.toUpperCase()}</Badge>
                      </td>
                      <td className="p-3">
                        <ImportStatusBadge status={imp.status} />
                      </td>
                      <td className="p-3 text-right">{imp.total_entries}</td>
                      <td className="p-3 text-right font-medium text-success">
                        {imp.matched_count}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(imp.created_at)}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsReconciliationOpen(false);
                            void navigate(`/bank-reconciliation/${imp.id}`);
                          }}
                        >
                          {t('pages.bankReconciliation.viewBtn')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.accounts.imports.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleUploadSubmit(e)} className="space-y-md">
            <div className="space-y-sm">
              <Label htmlFor="upload-file">Arquivo (.ofx ou .csv)</Label>
              <input
                id="upload-file"
                type="file"
                accept=".ofx,.csv"
                className="block w-full text-sm text-muted-foreground file:mr-md file:rounded-md file:border-0 file:bg-primary/10 file:px-md file:py-sm file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} — formato:{' '}
                  <strong>
                    {detectFormat(uploadFile.name).toUpperCase() || 'desconhecido'}
                  </strong>
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadOpen(false)}
                disabled={uploadLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadLoading || !uploadFile}>
                {uploadLoading ? 'Importando...' : 'Importar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
