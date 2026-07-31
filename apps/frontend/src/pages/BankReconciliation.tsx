/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  FileUp,
  RefreshCw,
  Upload,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { bankReconciliationService } from '@/services/bank-reconciliation-service';
import type { Account, BankStatementImport } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function ImportStatusBadge({ status }: { status: BankStatementImport['status'] }) {
  const { t } = useTranslation();
  const variants: Record<string, string> = {
    completed: 'bg-success/10 text-success border-success/30',
    processing: 'bg-warning/10 text-warning border-warning/30',
    failed: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  return (
    <span
      className={`px-sm inline-flex items-center rounded-full border py-0.5 text-xs font-medium ${variants[status] ?? ''}`}
    >
      {t(`pages.bankReconciliation.statuses.${status}`, { defaultValue: status })}
    </span>
  );
}

function UploadDialog({
  open,
  onClose,
  accounts,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess: (imp: BankStatementImport) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  function detectFormat(filename: string): 'ofx' | 'csv' | '' {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.ofx')) return 'ofx';
    if (lower.endsWith('.csv')) return 'csv';
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !accountId) {
      toast({
        title: t('pages.bankReconciliation.upload.fillRequired'),
        variant: 'destructive',
      });
      return;
    }

    const format = detectFormat(file.name);
    if (!format) {
      toast({
        title: t('pages.bankReconciliation.upload.invalidFormat'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account', accountId);
      formData.append('file_format', format);

      const imported = await bankReconciliationService.importFile(formData);

      // Auto-run matching
      try {
        const matched = await bankReconciliationService.runMatch(imported.id);
        onSuccess(matched);
      } catch {
        onSuccess(imported);
      }

      toast({ title: t('pages.bankReconciliation.upload.success') });
      onClose();
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pages.bankReconciliation.upload.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.bankReconciliation.upload.desc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-md">
          <div className="space-y-sm">
            <Label htmlFor="upload-file-input">
              {t('pages.bankReconciliation.upload.fileLabel')}
            </Label>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                'p-xl flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                file
                  ? 'border-success/50 bg-success/5'
                  : 'border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
              )}
              onClick={() => document.getElementById('upload-file-input')?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  document.getElementById('upload-file-input')?.click();
              }}
              style={{ cursor: 'pointer' }}
            >
              {file ? (
                <>
                  <div className="bg-success/10 mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                    <FileUp className="text-success h-6 w-6" />
                  </div>
                  <p className="font-medium">{file.name}</p>
                  <p className="mt-xs text-muted-foreground text-xs">
                    {t('pages.bankReconciliation.upload.detectedFormat')}:{' '}
                    <strong>
                      {detectFormat(file.name).toUpperCase() ||
                        t('pages.bankReconciliation.upload.unknownFormat')}
                    </strong>
                  </p>
                </>
              ) : (
                <>
                  <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                    <FileUp className="text-muted-foreground h-6 w-6" />
                  </div>
                  <p className="font-medium">
                    {t('pages.bankReconciliation.upload.dropzone', {
                      defaultValue: 'Arraste ou clique para selecionar',
                    })}
                  </p>
                  <p className="mt-xs text-muted-foreground text-xs">
                    {t('pages.bankReconciliation.upload.supportedFormats', {
                      defaultValue: 'Suporte: OFX, CSV',
                    })}
                  </p>
                </>
              )}
              <input
                id="upload-file-input"
                type="file"
                accept=".ofx,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="space-y-sm">
            <Label htmlFor="upload-account">
              {t('pages.bankReconciliation.upload.accountLabel')}
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="upload-account">
                <SelectValue
                  placeholder={t('pages.bankReconciliation.upload.accountPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.account_name}
                    {acc.institution ? ` — ${acc.institution}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? t('pages.bankReconciliation.upload.importing')
                : t('pages.bankReconciliation.upload.importBtn')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BankReconciliation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['bank-reconciliation'],
    queryFn: async () => {
      try {
        const [importsData, accountsData] = await Promise.all([
          bankReconciliationService.getAll(),
          accountsService.getAll(),
        ]);
        return { imports: importsData, accounts: accountsData };
      } catch (err) {
        toast({ title: getErrorMessage(err), variant: 'destructive' });
        return { imports: [] as BankStatementImport[], accounts: [] as Account[] };
      }
    },
  });
  const imports = data?.imports ?? [];
  const accounts = data?.accounts ?? [];

  function handleImportSuccess(imp: BankStatementImport) {
    queryClient.setQueryData<typeof data>(['bank-reconciliation'], (prev) =>
      prev ? { ...prev, imports: [imp, ...prev.imports] } : prev
    );
    void navigate(`/bank-reconciliation/${imp.id}`);
  }

  const lastImportDate = imports.length > 0 ? formatDate(imports[0].created_at) : '—';

  const completedCount = imports.filter((imp) => imp.status === 'completed').length;
  const pendingCount = imports.filter((imp) => imp.status !== 'completed').length;

  if (loading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.bankReconciliation.title')}
        icon={<ArrowLeftRight />}
        action={{
          label: t('pages.bankReconciliation.importWithPreview'),
          icon: <FileUp className="h-4 w-4" />,
          onClick: () => void navigate('/bank-reconciliation/import'),
        }}
      />

      {/* Flow orientation banner */}
      <div className="mt-md bg-muted/40 p-md rounded-lg border">
        <p className="mb-md text-muted-foreground text-sm font-medium">
          {t('pages.bankReconciliation.flowTitle')}
        </p>
        <div className="gap-md flex flex-col sm:flex-row sm:items-center">
          <div className="gap-sm flex items-center">
            <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              1
            </div>
            <div className="gap-xs flex items-center">
              <Upload className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">
                {t('pages.bankReconciliation.flowStep1')}
              </span>
            </div>
          </div>
          <div className="bg-border hidden h-px flex-1 sm:block" />
          <div className="gap-sm flex items-center">
            <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              2
            </div>
            <div className="gap-xs flex items-center">
              <Search className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">
                {t('pages.bankReconciliation.flowStep2')}
              </span>
            </div>
          </div>
          <div className="bg-border hidden h-px flex-1 sm:block" />
          <div className="gap-sm flex items-center">
            <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              3
            </div>
            <div className="gap-xs flex items-center">
              <CheckCircle2 className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">
                {t('pages.bankReconciliation.flowStep3')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-lg mt-lg gap-md grid grid-cols-1 sm:grid-cols-2">
        <StatCard
          title={t('pages.bankReconciliation.totalImports')}
          value={imports.length}
          icon={<ArrowLeftRight className="text-muted-foreground h-4 w-4" />}
        />
        <StatCard
          title={t('pages.bankReconciliation.lastImport')}
          value={lastImportDate}
          icon={<RefreshCw className="text-muted-foreground h-4 w-4" />}
        />
      </div>

      {/* Stat summary below cards */}
      {imports.length > 0 && (
        <div className="mb-lg gap-md text-muted-foreground flex text-sm">
          <span className="text-success font-medium">
            {completedCount}{' '}
            {t('pages.bankReconciliation.completedLabel', {
              defaultValue: 'concluídos',
            })}
          </span>
          {pendingCount > 0 && (
            <span className="text-warning font-medium">
              {pendingCount}{' '}
              {t('pages.bankReconciliation.pendingLabel', {
                defaultValue: 'pendentes',
              })}
            </span>
          )}
        </div>
      )}

      {imports.length === 0 ? (
        <EmptyState
          title={t('pages.bankReconciliation.emptyTitle')}
          message={t('pages.bankReconciliation.emptyGuide')}
          icon={<ArrowLeftRight className="h-8 w-8" />}
          action={{
            label: t('pages.bankReconciliation.flowStep1'),
            onClick: () => void navigate('/bank-reconciliation/import'),
          }}
        />
      ) : (
        <div className="space-y-3">
          {imports.map((imp) => {
            const matchPct =
              imp.total_entries > 0
                ? Math.round((imp.matched_count / imp.total_entries) * 100)
                : 0;
            return (
              <div key={imp.id} className="bg-card p-md rounded-lg border">
                <div className="gap-md flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-xs gap-sm flex items-center">
                      <Badge variant="outline">{imp.file_format.toUpperCase()}</Badge>
                      <ImportStatusBadge status={imp.status} />
                    </div>
                    <p className="truncate font-medium">{imp.original_filename}</p>
                    <p className="mt-xs text-muted-foreground text-xs">
                      {imp.total_entries}{' '}
                      {t('pages.bankReconciliation.transactionsLabel', {
                        defaultValue: 'transações',
                      })}{' '}
                      ·{' '}
                      {t('pages.bankReconciliation.importedAtLabel', {
                        defaultValue: 'importado em',
                      })}{' '}
                      {formatDate(imp.created_at)}
                    </p>

                    {/* Barra de progresso de conciliação */}
                    <div className="space-y-xs mt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t('pages.bankReconciliation.reconciliationLabel', {
                            defaultValue: 'Conciliação',
                          })}
                        </span>
                        <span
                          className={
                            matchPct === 100
                              ? 'text-success font-semibold'
                              : 'text-muted-foreground'
                          }
                        >
                          {matchPct}%
                        </span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            matchPct === 100
                              ? 'bg-success'
                              : matchPct >= 70
                                ? 'bg-info'
                                : 'bg-warning'
                          )}
                          style={{ width: `${matchPct}%` }}
                        />
                      </div>
                      <div className="text-muted-foreground flex gap-3 text-xs">
                        <span className="text-success">
                          {imp.matched_count}{' '}
                          {t('pages.bankReconciliation.matchedLabel', {
                            defaultValue: 'conciliados',
                          })}
                        </span>
                        {imp.unmatched_count > 0 && (
                          <span className="text-destructive">
                            {imp.unmatched_count}{' '}
                            {t('pages.bankReconciliation.divergencesLabel', {
                              defaultValue: 'divergências',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void navigate(`/bank-reconciliation/${imp.id}`)}
                  >
                    {t('pages.bankReconciliation.viewBtn')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        accounts={accounts}
        onSuccess={handleImportSuccess}
      />
    </PageContainer>
  );
}
