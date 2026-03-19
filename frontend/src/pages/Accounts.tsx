import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  ArrowLeftRight,
  FileUp,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AccountForm } from '@/components/accounts/AccountForm';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const variants: Record<string, string> = {
    completed: 'bg-success/10 text-success border-success/30',
    processing: 'bg-warning/10 text-warning border-warning/30',
    failed: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  const labels: Record<string, string> = {
    completed: 'Concluído',
    processing: 'Processando',
    failed: 'Falhou',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[status] ?? ''}`}
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
      toast({ title: t('pages.accounts.created'), description: t('pages.accounts.createdDesc') });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({ title: t('common.messages.saveError'), description: getErrorMessage(error), variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AccountFormData }) =>
      accountsService.update(id, data),
    onSuccess: () => {
      void invalidateAccounts();
      toast({ title: t('pages.accounts.updated'), description: t('pages.accounts.updatedDesc') });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({ title: t('common.messages.saveError'), description: getErrorMessage(error), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountsService.delete(id),
    onSuccess: () => {
      void invalidateAccounts();
      toast({ title: t('pages.accounts.deleted'), description: t('pages.accounts.deletedDesc') });
    },
    onError: (error: unknown) => {
      toast({ title: t('common.messages.deleteError'), description: getErrorMessage(error), variant: 'destructive' });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

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

  // Definir colunas da tabela
  const columns: Column<Account>[] = [
    {
      key: 'account_name',
      label: t('pages.accounts.columns.name'),
      render: (account) => <div className="font-medium">{account.account_name}</div>,
    },
    {
      key: 'account_type',
      label: t('pages.accounts.columns.type'),
      render: (account) => (
        <Badge variant="secondary">
          {translate('accountTypes', account.account_type)}
        </Badge>
      ),
    },
    {
      key: 'institution',
      label: t('pages.accounts.columns.institution'),
      render: (account) => translate('institutions', account.institution),
    },
    {
      key: 'account_number_masked',
      label: t('pages.accounts.columns.number'),
      render: (account) => (
        <span className="font-mono text-sm">{account.account_number_masked}</span>
      ),
    },
    {
      key: 'balance',
      label: t('pages.accounts.columns.balance'),
      align: 'right',
      render: (account) => (
        <span
          className={`font-semibold ${
            parseFloat(account.balance) >= 0 ? 'text-success' : 'text-destructive'
          }`}
        >
          {formatCurrency(account.balance)}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: t('pages.accounts.columns.createdAt'),
      render: (account) => (
        <span className="text-sm">{formatDate(account.created_at)}</span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.accounts.title')}
        icon={<Wallet />}
        action={{
          label: t('pages.accounts.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <DataTable
        data={accounts}
        columns={columns}
        keyExtractor={(account) => account.id}
        isLoading={isLoading}
        emptyState={{
          message: t('pages.accounts.emptyState'),
        }}
        actions={(account) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void openReconciliation(account)}
              title="Conciliação Bancária"
              aria-label="Conciliação Bancária"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(account)}
              title={t('common.actions.edit')}
              aria-label={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(account.id)}
              title={t('common.actions.delete')}
              aria-label={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

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
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Conciliação Bancária — {reconciliationAccount?.account_name}
            </DialogTitle>
            <DialogDescription>
              Importe extratos bancários para conciliar com suas transações.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setIsUploadOpen(true)}>
              <FileUp className="mr-2 h-4 w-4" />
              Importar Extrato
            </Button>
          </div>

          {importsLoading ? (
            <div className="flex items-center justify-center py-8">
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
                    <th className="p-3 text-left font-medium">Arquivo</th>
                    <th className="p-3 text-left font-medium">Formato</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-right font-medium">Entradas</th>
                    <th className="p-3 text-right font-medium">Conciliados</th>
                    <th className="p-3 text-left font-medium">Importado em</th>
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
                          Ver
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
            <DialogTitle>Importar Extrato Bancário</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleUploadSubmit(e)} className="space-y-md">
            <div className="space-y-sm">
              <Label htmlFor="upload-file">Arquivo (.ofx ou .csv)</Label>
              <input
                id="upload-file"
                type="file"
                accept=".ofx,.csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
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
