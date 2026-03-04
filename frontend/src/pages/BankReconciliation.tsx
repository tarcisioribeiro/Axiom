import { ArrowLeftRight, FileUp, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
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
      toast({ title: 'Preencha todos os campos.', variant: 'destructive' });
      return;
    }

    const format = detectFormat(file.name);
    if (!format) {
      toast({ title: 'Formato inválido. Use OFX ou CSV.', variant: 'destructive' });
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

      toast({ title: 'Extrato importado com sucesso!' });
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
          <DialogTitle>Importar Extrato Bancário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-md">
          <div className="space-y-sm">
            <Label htmlFor="upload-file">Arquivo (.ofx ou .csv)</Label>
            <input
              id="upload-file"
              type="file"
              accept=".ofx,.csv"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — formato detectado:{' '}
                <strong>
                  {detectFormat(file.name).toUpperCase() || 'desconhecido'}
                </strong>
              </p>
            )}
          </div>
          <div className="space-y-sm">
            <Label htmlFor="upload-account">Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="upload-account">
                <SelectValue placeholder="Selecione a conta" />
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
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BankReconciliation() {
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
      label: 'Arquivo',
      render: (imp) => <span className="font-medium">{imp.original_filename}</span>,
    },
    {
      key: 'file_format',
      label: 'Formato',
      render: (imp) => <Badge variant="outline">{imp.file_format.toUpperCase()}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (imp) => <ImportStatusBadge status={imp.status} />,
    },
    {
      key: 'total_entries',
      label: 'Entradas',
      render: (imp) => imp.total_entries,
    },
    {
      key: 'matched_count',
      label: 'Conciliados',
      render: (imp) => (
        <span className="font-medium text-success">{imp.matched_count}</span>
      ),
    },
    {
      key: 'unmatched_count',
      label: 'Divergências',
      render: (imp) => (
        <span className="font-medium text-destructive">{imp.unmatched_count}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Importado em',
      render: (imp) => formatDate(imp.created_at),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (imp) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/bank-reconciliation/${imp.id}`)}
        >
          Ver
        </Button>
      ),
    },
  ];

  if (loading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title="Conciliação Bancária"
        icon={<ArrowLeftRight />}
        action={{
          label: 'Importar Extrato',
          icon: <FileUp className="h-4 w-4" />,
          onClick: () => setUploadOpen(true),
        }}
      />

      <div className="mb-lg mt-lg grid grid-cols-1 gap-md sm:grid-cols-2">
        <StatCard
          title="Total de Importações"
          value={imports.length}
          icon={<ArrowLeftRight className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Última Importação"
          value={lastImportDate}
          icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {imports.length === 0 ? (
        <EmptyState
          title="Nenhum extrato importado"
          message="Clique em 'Importar Extrato' para começar."
          icon={<ArrowLeftRight className="h-8 w-8" />}
          action={{
            label: 'Importar Extrato',
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
            title: 'Nenhum extrato importado',
            message: 'Clique em Importar Extrato para começar.',
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
