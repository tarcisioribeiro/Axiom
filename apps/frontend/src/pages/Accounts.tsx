/* eslint-disable max-lines */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shapes,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { AccountForm } from '@/components/accounts/AccountForm';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
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
import { FileInput } from '@/components/ui/file-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { translate, TRANSLATIONS } from '@/config/constants';
import { ACCOUNT_TYPE_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { getErrorMessage } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { ValidationError } from '@/services/api-errors';
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
      className={`px-sm inline-flex items-center rounded-full border py-0.5 text-xs font-medium ${variants[status] ?? ''}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

/** 4 cards por linha × 2 linhas por página. */
const ACCOUNTS_PAGE_SIZE = 8;

export default function Accounts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showDelete } = useAlertDialog();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

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
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >();

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
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      setFieldErrors(error instanceof ValidationError ? error.errors : undefined);
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      setFieldErrors(error instanceof ValidationError ? error.errors : undefined);
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        a.account_name.toLowerCase().includes(q) ||
        translate('institutions', a.institution).toLowerCase().includes(q) ||
        (a.account_number_masked ?? '').toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || a.account_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [accounts, searchTerm, typeFilter]);

  const ACCOUNT_TYPE_COLORS: Record<string, { icon: string; bg: string }> = {
    CC: { icon: 'text-info', bg: 'bg-info/5' },
    CS: { icon: 'text-success', bg: 'bg-success/5' },
    FG: { icon: 'text-warning', bg: 'bg-warning/5' },
    VA: { icon: 'text-accent', bg: 'bg-accent/5' },
    VR: { icon: 'text-accent', bg: 'bg-accent/5' },
    CP: { icon: 'text-primary', bg: 'bg-primary/5' },
  };

  const handleCreate = () => {
    setSelectedAccount(undefined);
    setFieldErrors(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: Account) => {
    setSelectedAccount(account);
    setFieldErrors(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const account = accounts?.find((a) => a.id === id);
    const confirmed = await showDelete(String(account?.account_name ?? ''));
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
        title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
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
      toast({ title: t('pages.accounts.invalidFormat'), variant: 'destructive' });
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

      <FilterBar
        hasActiveFilters={!!searchTerm || typeFilter !== 'all'}
        onClear={() => {
          setSearchTerm('');
          setTypeFilter('all');
        }}
        activeFilters={[
          ...(typeFilter !== 'all'
            ? [
                {
                  key: 'type',
                  label: `${t('common.fields.type')}: ${translate('accountTypes', typeFilter)}`,
                  onRemove: () => setTypeFilter('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.accounts.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.fields.type')} icon={Shapes}>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              className="w-44"
              aria-label={t('pages.accounts.allTypes')}
              startIcon={<Wallet className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.accounts.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.accounts.allTypes')}</SelectItem>
              {Object.keys(TRANSLATIONS.accountTypes).map((key) => {
                const Icon = ACCOUNT_TYPE_ICONS[key];
                return (
                  <SelectItem
                    key={key}
                    value={key}
                    icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                  >
                    {translate('accountTypes', key)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {isLoading ? (
        <div className="gap-md grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted/30 h-52 animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="text-muted-foreground h-12 w-12" />}
          title={t('pages.accounts.emptyState')}
        />
      ) : (
        <PaginatedSlide
          key={`${searchTerm}-${typeFilter}`}
          items={filteredAccounts}
          pageSize={ACCOUNTS_PAGE_SIZE}
          className="gap-md grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {(pageItems) =>
            pageItems.map((account) => {
              const balance = parseFloat(account.balance);
              const overdraft = parseFloat(account.overdraft_limit ?? '0');
              const available = balance + overdraft;
              const reservedInVaults = parseFloat(account.deposited_in_vaults ?? '0');
              const availableForSpending = parseFloat(
                account.available_balance ?? account.balance
              );
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
                  className="flex flex-col overflow-hidden transition-colors"
                >
                  <CardHeader className="pb-sm">
                    <div className="gap-sm flex items-start justify-between">
                      <div className="gap-sm flex items-center">
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${typeColors ? `${typeColors.bg} ${typeColors.icon}` : 'bg-muted text-muted-foreground'}`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate leading-tight font-semibold">
                            {account.account_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {translate('institutions', account.institution)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {translate('accountTypes', account.account_type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="gap-md flex flex-1 flex-col">
                    {account.account_number_masked && (
                      <p className="text-muted-foreground text-xs">
                        {account.account_number_masked}
                      </p>
                    )}
                    <div className="bg-muted/30 my-auto rounded-lg p-3 text-center">
                      <p className="text-muted-foreground text-xs">
                        {t('pages.accounts.columns.balance')}
                      </p>
                      <p
                        className={`text-xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {formatCurrency(account.balance)}
                      </p>
                      {/* Sempre 2 linhas (reserva ou cheque especial, ou espaço
                          invisível), para todos os cards terem a altura do maior. */}
                      <div
                        className={`mt-xs pt-xs space-y-0.5 border-t ${reservedInVaults > 0 ? 'border-border/60' : 'border-transparent'}`}
                      >
                        {overdraft > 0 && (
                          <p
                            className={`text-xs ${available >= 0 ? 'text-muted-foreground' : 'text-destructive'}`}
                          >
                            {t('pages.accounts.available', {
                              value: formatCurrency(String(available)),
                            })}
                          </p>
                        )}
                        {reservedInVaults > 0 && (
                          <>
                            <p className="text-muted-foreground text-xs">
                              {t('pages.accounts.reservedInVaults', {
                                value: formatCurrency(String(reservedInVaults)),
                              })}
                            </p>
                            <p
                              className={`text-xs font-medium ${availableForSpending >= 0 ? 'text-info' : 'text-destructive'}`}
                            >
                              {t('pages.accounts.availableForSpending', {
                                value: formatCurrency(String(availableForSpending)),
                              })}
                            </p>
                          </>
                        )}
                        {Array.from(
                          {
                            length: Math.max(
                              0,
                              2 -
                                (overdraft > 0 ? 1 : 0) -
                                (reservedInVaults > 0 ? 2 : 0)
                            ),
                          },
                          (_, i) => (
                            <p key={i} aria-hidden="true" className="invisible text-xs">
                              &nbsp;
                            </p>
                          )
                        )}
                      </div>
                    </div>
                    <div className="pt-sm mt-auto flex items-center justify-between border-t">
                      <span className="text-muted-foreground text-xs">
                        {formatDate(account.created_at)}
                      </span>
                      <div className="gap-xs flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => void openReconciliation(account)}
                          title={t('pages.accounts.bankReconciliation')}
                          aria-label={t('pages.accounts.bankReconciliation')}
                        >
                          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(account)}
                          title={t('common.actions.edit')}
                          aria-label={t('common.actions.edit')}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
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
                            className="text-destructive h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          }
        </PaginatedSlide>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle mode={selectedAccount ? 'edit' : 'create'}>
              {selectedAccount
                ? t('pages.accounts.editTitle')
                : t('pages.accounts.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedAccount
                  ? t('pages.accounts.editDesc')
                  : t('pages.accounts.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <AccountForm
            account={selectedAccount}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
            fieldErrors={fieldErrors}
          />
        </DialogContent>
      </Dialog>

      {/* Bank Reconciliation dialog */}
      <Dialog open={isReconciliationOpen} onOpenChange={setIsReconciliationOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <ArrowLeftRight className="h-5 w-5" />
              {t('pages.accounts.bankReconciliationTitle', {
                account: reconciliationAccount?.account_name,
              })}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.accounts.bankReconciliationDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsUploadOpen(true)}>
              <FileUp className="h-4 w-4" />
              {t('pages.accounts.importStatement')}
            </Button>
          </div>

          {importsLoading ? (
            <div className="py-xl flex items-center justify-center">
              <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : imports.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="text-muted-foreground h-12 w-12" />}
              title={t('pages.accounts.noImports')}
            />
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
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
                      <td className="text-success p-3 text-right font-medium">
                        {imp.matched_count}
                      </td>
                      <td className="text-muted-foreground p-3">
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReconciliationOpen(false)}>
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle icon={Upload}>
              {t('pages.accounts.imports.dialogTitle')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleUploadSubmit(e)} className="space-y-md">
            <div className="space-y-sm">
              <Label className="gap-xs flex items-center" htmlFor="upload-file">
                <Upload className="text-muted-foreground h-3.5 w-3.5" />
                Arquivo (.ofx ou .csv)
              </Label>
              <FileInput id="upload-file" accept=".ofx,.csv" onChange={setUploadFile} />
              {uploadFile && (
                <p className="text-muted-foreground text-xs">
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
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadLoading || !uploadFile}>
                {uploadLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadLoading ? 'Importando...' : 'Importar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
