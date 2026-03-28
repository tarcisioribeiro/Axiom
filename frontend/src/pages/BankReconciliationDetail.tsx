import { ArrowLeft, ArrowLeftRight, Link2, Plus, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DataTable, type Column } from '@/components/common/DataTable';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { bankReconciliationService } from '@/services/bank-reconciliation-service';
import { expensesService } from '@/services/expenses-service';
import { revenuesService } from '@/services/revenues-service';
import type { BankStatementEntry, BankStatementImport, Expense, Revenue } from '@/types';
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
    manual: 'bg-primary/10 text-primary border-primary/30',
  };
  const labels: Record<string, string> = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
    manual: 'Manual',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variants[confidence] ?? ''}`}
    >
      {labels[confidence] ?? confidence}
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

  // Manual match modal state
  const [matchingEntry, setMatchingEntry] = useState<BankStatementEntry | null>(null);
  const [candidates, setCandidates] = useState<(Expense | Revenue)[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateLoading, setCandidateLoading] = useState(false);

  useEffect(() => {
    if (importId) void loadImport(Number(importId));
  }, [importId]);

  // Debounced candidate search
  useEffect(() => {
    if (!matchingEntry) return;
    const timer = setTimeout(() => {
      void loadCandidates(matchingEntry, candidateSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [candidateSearch, matchingEntry]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function loadCandidates(entry: BankStatementEntry, search: string) {
    setCandidateLoading(true);
    try {
      const amount = Math.abs(Number(entry.amount));
      const minValue = (amount * 0.9).toFixed(2);
      const maxValue = (amount * 1.1).toFixed(2);
      const entryDate = new Date(entry.date);
      const dateFrom = new Date(entryDate);
      dateFrom.setDate(dateFrom.getDate() - 7);
      const dateTo = new Date(entryDate);
      dateTo.setDate(dateTo.getDate() + 7);

      const params: Record<string, unknown> = {
        min_value: minValue,
        max_value: maxValue,
        date_from: dateFrom.toISOString().split('T')[0],
        date_to: dateTo.toISOString().split('T')[0],
      };
      if (search) params.search = search;

      if (entry.transaction_type === 'debit') {
        const results = await expensesService.getAll(params);
        setCandidates(results);
      } else {
        const results = await revenuesService.getAll(params);
        setCandidates(results);
      }
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setCandidateLoading(false);
    }
  }

  async function openManualMatch(entry: BankStatementEntry) {
    setMatchingEntry(entry);
    setCandidates([]);
    setCandidateSearch('');
    await loadCandidates(entry, '');
  }

  async function handleManualMatch(candidateId: number) {
    if (!matchingEntry || !importData) return;
    setUpdatingId(matchingEntry.id);
    try {
      const payload =
        matchingEntry.transaction_type === 'debit'
          ? { matched_expense_id: candidateId }
          : { matched_revenue_id: candidateId };

      await bankReconciliationService.manualMatch(importData.id, matchingEntry.id, payload);
      setMatchingEntry(null);

      const updated = await bankReconciliationService.getImport(importData.id);
      setImportData(updated);
      setEntries(updated.entries ?? []);
      toast({ title: 'Vinculação manual realizada com sucesso!' });
    } catch (err) {
      toast({ title: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  }

  function handleCreateFromEntry(entry: BankStatementEntry) {
    const prefill = {
      description: entry.description,
      value: Math.abs(Number(entry.amount)),
      date: entry.date,
    };
    if (entry.transaction_type === 'debit') {
      navigate('/expenses', { state: { prefillExpense: prefill } });
    } else {
      navigate('/revenues', { state: { prefillRevenue: prefill } });
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
        if (entry.status === 'matched' || entry.status === 'ignored') return null;
        const isUpdating = updatingId === entry.id;
        const hasMatch = !!(entry.matched_expense ?? entry.matched_revenue);
        const isDebit = entry.transaction_type === 'debit';

        return (
          <div className="flex flex-wrap gap-1">
            {/* Auto-match confirmation buttons (pending entries with a suggestion) */}
            {entry.status === 'pending' && hasMatch && (
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
            {entry.status === 'pending' && (
              <>
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
              </>
            )}

            {/* Manual match */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={isUpdating}
              title="Vincular manualmente"
              onClick={() => void openManualMatch(entry)}
            >
              <Link2 className="h-3 w-3" />
              Vincular
            </Button>

            {/* Create expense / revenue pre-filled */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={isUpdating}
              title={isDebit ? 'Criar despesa a partir desta entrada' : 'Criar receita a partir desta entrada'}
              onClick={() => handleCreateFromEntry(entry)}
            >
              <Plus className="h-3 w-3" />
              {isDebit ? 'Despesa' : 'Receita'}
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

  const candidateLabel = matchingEntry?.transaction_type === 'debit' ? 'despesas' : 'receitas';

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

      {/* Manual Match Modal */}
      <Dialog open={!!matchingEntry} onOpenChange={(open) => { if (!open) setMatchingEntry(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Vincular manualmente
            </DialogTitle>
            <DialogDescription>
              Selecione uma {candidateLabel === 'despesas' ? 'despesa' : 'receita'} existente para
              vincular a esta entrada do extrato.
            </DialogDescription>
          </DialogHeader>

          {matchingEntry && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{matchingEntry.description}</p>
              <p className="mt-1 text-muted-foreground">
                {formatDate(matchingEntry.date)} ·{' '}
                <span
                  className={
                    matchingEntry.transaction_type === 'debit' ? 'text-destructive' : 'text-success'
                  }
                >
                  {matchingEntry.transaction_type === 'debit' ? '-' : '+'}
                  {formatCurrency(Math.abs(Number(matchingEntry.amount)))}
                </span>
              </p>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={`Buscar ${candidateLabel} por descrição...`}
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
            />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {candidateLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : candidates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma {candidateLabel === 'despesas' ? 'despesa' : 'receita'} encontrada com
                valor e data próximos.
              </p>
            ) : (
              candidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.description}</p>
                    <p className="text-muted-foreground">
                      {formatDate(c.date)} · {formatCurrency(Math.abs(Number(c.value)))}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={updatingId === matchingEntry?.id}
                    onClick={() => void handleManualMatch(c.id)}
                  >
                    Selecionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
