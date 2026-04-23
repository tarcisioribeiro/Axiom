import { ArrowLeftRight, FileUp, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DataTable, type Column } from '@/components/common/DataTable';
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
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[status] ?? ''}`}
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
            <Label htmlFor="upload-file">
              {t('pages.bankReconciliation.upload.fileLabel')}
            </Label>
            <input
              id="upload-file"
              type="file"
              accept=".ofx,.csv"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — {t('pages.bankReconciliation.upload.detectedFormat')}:{' '}
                <strong>
                  {detectFormat(file.name).toUpperCase() ||
                    t('pages.bankReconciliation.upload.unknownFormat')}
                </strong>
              </p>
            )}
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

  const columns: Column<BankStatementImport>[] = [
    {
      key: 'original_filename',
      label: t('pages.bankReconciliation.columns.file'),
      render: (imp) => <span className="font-medium">{imp.original_filename}</span>,
    },
    {
      key: 'file_format',
      label: t('pages.bankReconciliation.columns.format'),
      render: (imp) => <Badge variant="outline">{imp.file_format.toUpperCase()}</Badge>,
    },
    {
      key: 'status',
      label: t('pages.bankReconciliation.columns.status'),
      render: (imp) => <ImportStatusBadge status={imp.status} />,
    },
    {
      key: 'total_entries',
      label: t('pages.bankReconciliation.columns.entries'),
      render: (imp) => imp.total_entries,
    },
    {
      key: 'matched_count',
      label: t('pages.bankReconciliation.columns.matched'),
      render: (imp) => (
        <span className="font-medium text-success">{imp.matched_count}</span>
      ),
    },
    {
      key: 'unmatched_count',
      label: t('pages.bankReconciliation.columns.divergences'),
      render: (imp) => (
        <span className="font-medium text-destructive">{imp.unmatched_count}</span>
      ),
    },
    {
      key: 'created_at',
      label: t('pages.bankReconciliation.columns.importedAt'),
      render: (imp) => formatDate(imp.created_at),
    },
    {
      key: 'actions',
      label: t('pages.bankReconciliation.columns.actions'),
      render: (imp) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/bank-reconciliation/${imp.id}`)}
        >
          {t('pages.bankReconciliation.viewBtn')}
        </Button>
      ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.bankReconciliation.title')}
        icon={<ArrowLeftRight />}
        action={{
          label: t('pages.bankReconciliation.importBtn'),
          icon: <FileUp className="h-4 w-4" />,
          onClick: () => setUploadOpen(true),
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
        <DataTable
          data={imports}
          columns={columns}
          keyExtractor={(imp) => imp.id}
          emptyState={{
            icon: <ArrowLeftRight className="h-12 w-12" />,
            title: t('pages.bankReconciliation.emptyTitle'),
            message: t('pages.bankReconciliation.emptyMessage'),
          }}
        />
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
