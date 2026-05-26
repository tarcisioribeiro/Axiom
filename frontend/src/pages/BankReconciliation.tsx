/* eslint-disable max-lines */
import { ArrowLeftRight, FileUp, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
      className={`inline-flex items-center rounded-full border px-sm py-0.5 text-xs font-medium ${variants[status] ?? ''}`}
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
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-xl transition-colors',
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
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                    <FileUp className="h-6 w-6 text-success" />
                  </div>
                  <p className="font-medium">{file.name}</p>
                  <p className="mt-xs text-xs text-muted-foreground">
                    {t('pages.bankReconciliation.upload.detectedFormat')}:{' '}
                    <strong>
                      {detectFormat(file.name).toUpperCase() ||
                        t('pages.bankReconciliation.upload.unknownFormat')}
                    </strong>
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium">
                    {t('pages.bankReconciliation.upload.dropzone', {
                      defaultValue: 'Arraste ou clique para selecionar',
                    })}
                  </p>
                  <p className="mt-xs text-xs text-muted-foreground">
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

  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [importsData, accountsData] = await Promise.all([
        bankReconciliationService.getAll(),
        accountsService.getAll(),
      ]);
      setImports(importsData);
      setAccounts(accountsData);
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleImportSuccess(imp: BankStatementImport) {
    setImports((prev) => [imp, ...prev]);
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
          label: 'Importar com prévia',
          icon: <FileUp className="h-4 w-4" />,
          onClick: () => void navigate('/bank-reconciliation/import'),
        }}
      />

      <div className="mb-lg mt-lg grid grid-cols-1 gap-md sm:grid-cols-2">
        <StatCard
          title={t('pages.bankReconciliation.totalImports')}
          value={imports.length}
          icon={<ArrowLeftRight className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title={t('pages.bankReconciliation.lastImport')}
          value={lastImportDate}
          icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Stat summary below cards */}
      {imports.length > 0 && (
        <div className="mb-lg flex gap-md text-sm text-muted-foreground">
          <span className="font-medium text-success">
            {completedCount}{' '}
            {t('pages.bankReconciliation.completedLabel', {
              defaultValue: 'concluídos',
            })}
          </span>
          {pendingCount > 0 && (
            <span className="font-medium text-warning">
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
          message={t('pages.bankReconciliation.emptyMessage')}
          icon={<ArrowLeftRight className="h-8 w-8" />}
          action={{
            label: t('pages.bankReconciliation.importBtn'),
            onClick: () => setUploadOpen(true),
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
              <div key={imp.id} className="rounded-lg border bg-card p-md">
                <div className="flex items-start justify-between gap-md">
                  <div className="min-w-0 flex-1">
                    <div className="mb-xs flex items-center gap-sm">
                      <Badge variant="outline">{imp.file_format.toUpperCase()}</Badge>
                      <ImportStatusBadge status={imp.status} />
                    </div>
                    <p className="truncate font-medium">{imp.original_filename}</p>
                    <p className="mt-xs text-xs text-muted-foreground">
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
                    <div className="mt-3 space-y-xs">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t('pages.bankReconciliation.reconciliationLabel', {
                            defaultValue: 'Conciliação',
                          })}
                        </span>
                        <span
                          className={
                            matchPct === 100
                              ? 'font-semibold text-success'
                              : 'text-muted-foreground'
                          }
                        >
                          {matchPct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
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
                      <div className="flex gap-3 text-xs text-muted-foreground">
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
