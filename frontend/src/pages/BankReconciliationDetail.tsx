import { ArrowLeft, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DataTable, type Column } from '@/components/common/DataTable';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { bankReconciliationService } from '@/services/bank-reconciliation-service';
import type { BankStatementEntry, BankStatementImport } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function ConfidenceBadge({
  confidence,
}: {
  confidence: BankStatementEntry['match_confidence'];
}) {
  if (!confidence) return <span className="text-muted-foreground">—</span>;
  const variants: Record<string, string> = {
    high: 'bg-success/10 text-success border-success/30',
    medium: 'bg-warning/10 text-warning border-warning/30',
    low: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  const labels: Record<string, string> = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[confidence]}`}
    >
      {labels[confidence]}
    </span>
  );
}

function EntryStatusBadge({ status }: { status: BankStatementEntry['status'] }) {
  const variants: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground border-border',
    matched: 'bg-success/10 text-success border-success/30',
    unmatched: 'bg-destructive/10 text-destructive border-destructive/30',
    ignored: 'bg-muted text-muted-foreground border-border',
  };
  const labels: Record<string, string> = {
    pending: 'Pendente',
    matched: 'Conciliado',
    unmatched: 'Divergente',
    ignored: 'Ignorado',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[status]}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function BankReconciliationDetail() {
  const { importId } = useParams<{ importId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [importData, setImportData] = useState<BankStatementImport | null>(null);
  const [entries, setEntries] = useState<BankStatementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (importId) void loadImport(Number(importId));
  }, [importId]);

  async function loadImport(id: number) {
    setLoading(true);
    try {
      const data = await bankReconciliationService.getImport(id);
      setImportData(data);
      setEntries(data.entries ?? []);
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRunMatch() {
    if (!importData) return;
    setMatchLoading(true);
    try {
      const updated = await bankReconciliationService.runMatch(importData.id);
      setImportData(updated);
      setEntries(updated.entries ?? []);
      toast({ title: 'Conciliação executada com sucesso!' });
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleUpdateEntry(
    entry: BankStatementEntry,
    newStatus: BankStatementEntry['status'],
    matchedExpenseId?: number | null,
    matchedRevenueId?: number | null
  ) {
    setUpdatingId(entry.id);
    try {
      const payload: Record<string, unknown> = { status: newStatus };
      if (matchedExpenseId !== undefined) payload.matched_expense = matchedExpenseId;
      if (matchedRevenueId !== undefined) payload.matched_revenue = matchedRevenueId;

      await bankReconciliationService.updateEntry(
        entry.id,
        payload as Partial<BankStatementEntry>
      );

      // Refresh import to get updated stats
      if (importData) {
        const updated = await bankReconciliationService.getImport(importData.id);
        setImportData(updated);
        setEntries(updated.entries ?? []);
      }
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  }

  const columns: Column<BankStatementEntry>[] = [
    {
      key: 'date',
      label: 'Data',
      render: (entry) => formatDate(entry.date),
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (entry) => {
        const isDebit = entry.transaction_type === 'debit';
        return (
          <span className={isDebit ? 'text-destructive' : 'text-success'}>
            {isDebit ? '-' : '+'}
            {formatCurrency(Math.abs(Number(entry.amount)))}
          </span>
        );
      },
    },
    {
      key: 'description',
      label: 'Descrição',
      render: (entry) => (
        <span className="block max-w-xs truncate" title={entry.description}>
          {entry.description}
        </span>
      ),
    },
    {
      key: 'match',
      label: 'Sugestão de Match',
      render: (entry) => {
        const match = entry.matched_expense ?? entry.matched_revenue;
        if (!match) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {match.description}{' '}
            <span className="text-muted-foreground">({formatDate(match.date)})</span>
          </span>
        );
      },
    },
    {
      key: 'match_confidence',
      label: 'Confiança',
      render: (entry) => <ConfidenceBadge confidence={entry.match_confidence} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (entry) => <EntryStatusBadge status={entry.status} />,
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (entry) => {
        if (entry.status !== 'pending') return null;
        const isUpdating = updatingId === entry.id;
        const hasMatch = !!(entry.matched_expense ?? entry.matched_revenue);

        return (
          <div className="flex gap-1">
            {hasMatch && (
              <Button
                size="sm"
                variant="outline"
                className="border-success/50 text-success hover:bg-success/10"
                disabled={isUpdating}
                onClick={() =>
                  handleUpdateEntry(
                    entry,
                    'matched',
                    entry.matched_expense?.id ?? null,
                    entry.matched_revenue?.id ?? null
                  )
                }
              >
                ✓
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={isUpdating}
              onClick={() => handleUpdateEntry(entry, 'unmatched')}
            >
              ✗
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isUpdating}
              onClick={() => handleUpdateEntry(entry, 'ignored')}
            >
              —
            </Button>
          </div>
        );
      },
    },
  ];

  if (loading) return <LoadingState />;
  if (!importData) return null;

  const pendingCount =
    importData.total_entries -
    importData.matched_count -
    importData.unmatched_count -
    importData.ignored_count;

  return (
    <PageContainer>
      <div className="mb-lg flex items-center gap-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/bank-reconciliation')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <PageHeader
        title={importData.original_filename}
        icon={<ArrowLeftRight />}
        action={{
          label: matchLoading ? 'Conciliando...' : 'Executar Conciliação',
          icon: (
            <RefreshCw className={`h-4 w-4 ${matchLoading ? 'animate-spin' : ''}`} />
          ),
          onClick: () => {
            void handleRunMatch();
          },
        }}
      />

      <div className="mb-lg mt-lg grid grid-cols-2 gap-md sm:grid-cols-4">
        <StatCard
          title="Conciliados"
          value={importData.matched_count}
          variant="success"
        />
        <StatCard
          title="Divergências"
          value={importData.unmatched_count}
          variant="danger"
        />
        <StatCard title="Ignorados" value={importData.ignored_count} />
        <StatCard title="Pendentes" value={pendingCount} variant="warning" />
      </div>

      <div className="mb-md flex items-center gap-md">
        <Badge variant="outline">{importData.file_format.toUpperCase()}</Badge>
        <span className="text-sm text-muted-foreground">
          {importData.total_entries} transações · importado em{' '}
          {formatDate(importData.created_at)}
        </span>
      </div>

      <DataTable
        data={entries}
        columns={columns}
        keyExtractor={(entry) => entry.id}
        emptyState={{
          icon: <ArrowLeftRight className="h-12 w-12" />,
          title: 'Nenhuma entrada',
          message: 'Este extrato não possui transações.',
        }}
      />
    </PageContainer>
  );
}
