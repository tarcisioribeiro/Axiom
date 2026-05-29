/* eslint-disable max-lines */
import {
  ArrowLeft,
  ArrowLeftRight,
  Link2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { cn } from '@/lib/utils';
import { bankReconciliationService } from '@/services/bank-reconciliation-service';
import { expensesService } from '@/services/expenses-service';
import { revenuesService } from '@/services/revenues-service';
import type {
  BankStatementEntry,
  BankStatementImport,
  Expense,
  Revenue,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function ConfidenceBadge({
  confidence,
}: {
  confidence: BankStatementEntry['match_confidence'];
}) {
  const { t } = useTranslation();
  if (!confidence) return <span className="text-muted-foreground">—</span>;

  const bars =
    confidence === 'high'
      ? 4
      : confidence === 'medium'
        ? 2
        : confidence === 'low'
          ? 1
          : 3;
  const color =
    confidence === 'high'
      ? 'bg-success'
      : confidence === 'medium'
        ? 'bg-warning'
        : confidence === 'low'
          ? 'bg-destructive'
          : 'bg-primary';

  return (
    <div
      className="flex items-end gap-0.5"
      title={t('pages.bankReconciliation.detail.confidenceLevel', {
        level: confidence,
      })}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 rounded-sm transition-all',
            i <= bars ? color : 'bg-muted'
          )}
          style={{ height: `${i * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}

function EntryStatusBadge({ status }: { status: BankStatementEntry['status'] }) {
  const { t } = useTranslation();
  const variants: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground border-border',
    matched: 'bg-success/10 text-success border-success/30',
    unmatched: 'bg-destructive/10 text-destructive border-destructive/30',
    ignored: 'bg-muted text-muted-foreground border-border',
  };
  const labels: Record<string, string> = {
    pending: t('pages.bankReconciliation.detail.statusPending'),
    matched: t('pages.bankReconciliation.detail.statusMatched'),
    unmatched: t('pages.bankReconciliation.detail.statusUnmatched'),
    ignored: t('pages.bankReconciliation.detail.statusIgnored'),
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-sm py-0.5 text-xs font-medium ${variants[status]}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function BankReconciliationDetail() {
  const { t } = useTranslation();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast({ title: t('pages.bankReconciliation.detail.runSuccess') });
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

      await bankReconciliationService.manualMatch(
        importData.id,
        matchingEntry.id,
        payload
      );
      setMatchingEntry(null);

      const updated = await bankReconciliationService.getImport(importData.id);
      setImportData(updated);
      setEntries(updated.entries ?? []);
      toast({ title: t('pages.bankReconciliation.detail.linkSuccess') });
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
      void navigate('/expenses', { state: { prefillExpense: prefill } });
    } else {
      void navigate('/revenues', { state: { prefillRevenue: prefill } });
    }
  }

  const columns: Column<BankStatementEntry>[] = [
    {
      key: 'date',
      label: t('common.fields.date'),
      render: (entry) => formatDate(entry.date),
    },
    {
      key: 'amount',
      label: t('common.fields.amount'),
      render: (entry) => {
        const isDebit = entry.transaction_type === 'debit';
        return (
          <div className="flex items-center gap-xs">
            <span
              className={cn('text-xs', isDebit ? 'text-destructive' : 'text-success')}
            >
              {isDebit ? '↓' : '↑'}
            </span>
            <span
              className={cn(
                'font-semibold',
                isDebit ? 'text-destructive' : 'text-success'
              )}
            >
              {formatCurrency(Math.abs(Number(entry.amount)))}
            </span>
          </div>
        );
      },
    },
    {
      key: 'description',
      label: t('common.fields.description'),
      render: (entry) => (
        <span className="block max-w-xs truncate" title={entry.description}>
          {entry.description}
        </span>
      ),
    },
    {
      key: 'match',
      label: t('pages.bankReconciliation.detail.matchSuggestion'),
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
      label: t('pages.bankReconciliation.detail.confidence'),
      render: (entry) => <ConfidenceBadge confidence={entry.match_confidence} />,
    },
    {
      key: 'status',
      label: t('common.fields.status'),
      render: (entry) => <EntryStatusBadge status={entry.status} />,
    },
    {
      key: 'actions',
      label: t('common.table.actions'),
      render: (entry) => {
        if (entry.status === 'matched' || entry.status === 'ignored') return null;
        const isUpdating = updatingId === entry.id;
        const hasMatch = !!(entry.matched_expense ?? entry.matched_revenue);
        const isDebit = entry.transaction_type === 'debit';

        return (
          <div className="flex flex-wrap gap-xs">
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
              className="gap-xs"
              disabled={isUpdating}
              title={t('pages.bankReconciliation.detail.linkManually')}
              onClick={() => void openManualMatch(entry)}
            >
              <Link2 className="h-3 w-3" />
              {t('pages.bankReconciliation.detail.linkBtn')}
            </Button>

            {/* Create expense / revenue pre-filled */}
            <Button
              size="sm"
              variant="outline"
              className="gap-xs"
              disabled={isUpdating}
              title={
                isDebit
                  ? t('pages.bankReconciliation.detail.createExpenseTitle')
                  : t('pages.bankReconciliation.detail.createRevenueTitle')
              }
              onClick={() => handleCreateFromEntry(entry)}
            >
              <Plus className="h-3 w-3" />
              {isDebit
                ? t('pages.bankReconciliation.detail.createExpenseBtn')
                : t('pages.bankReconciliation.detail.createRevenueBtn')}
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

  const reconciliationPct =
    importData.total_entries > 0
      ? (importData.matched_count / importData.total_entries) * 100
      : 0;

  const candidateLabel =
    matchingEntry?.transaction_type === 'debit' ? 'despesas' : 'receitas';

  return (
    <PageContainer>
      <div className="mb-lg flex items-center gap-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/bank-reconciliation')}
        >
          <ArrowLeft className="mr-xs h-4 w-4" />
          {t('common.actions.back')}
        </Button>
      </div>

      <PageHeader
        title={importData.original_filename}
        icon={<ArrowLeftRight />}
        action={{
          label: matchLoading
            ? t('pages.bankReconciliation.detail.running')
            : t('pages.bankReconciliation.detail.runMatch'),
          icon: (
            <RefreshCw className={`h-4 w-4 ${matchLoading ? 'animate-spin' : ''}`} />
          ),
          onClick: () => {
            void handleRunMatch();
          },
        }}
      />

      {/* Progress bar */}
      <div className="mb-md rounded-lg border bg-card p-md">
        <div className="mb-sm flex items-center justify-between">
          <span className="text-sm font-medium">
            {t('pages.bankReconciliation.detail.progress')}
          </span>
          <span className="text-sm font-semibold">
            {t('pages.bankReconciliation.detail.transactions', {
              matched: importData.matched_count,
              total: importData.total_entries,
            })}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${reconciliationPct}%` }}
          />
        </div>
        <div className="mt-sm flex gap-md text-xs text-muted-foreground">
          <span className="text-success">
            {t('pages.bankReconciliation.detail.matchedCount', {
              count: importData.matched_count,
            })}
          </span>
          <span className="text-destructive">
            {t('pages.bankReconciliation.detail.unmatchedCount', {
              count: importData.unmatched_count,
            })}
          </span>
          <span>
            {t('pages.bankReconciliation.detail.ignoredCount', {
              count: importData.ignored_count,
            })}
          </span>
          <span>
            {t('pages.bankReconciliation.detail.pendingCount', { count: pendingCount })}
          </span>
        </div>
      </div>

      <div className="mb-lg mt-lg grid grid-cols-2 gap-md sm:grid-cols-4">
        <StatCard
          title={t('pages.bankReconciliation.detail.matched')}
          value={importData.matched_count}
          variant="success"
        />
        <StatCard
          title={t('pages.bankReconciliation.detail.divergences')}
          value={importData.unmatched_count}
          variant="danger"
        />
        <StatCard
          title={t('pages.bankReconciliation.detail.ignored')}
          value={importData.ignored_count}
        />
        <StatCard
          title={t('pages.bankReconciliation.detail.pending')}
          value={pendingCount}
          variant="warning"
        />
      </div>

      <div className="mb-md flex items-center gap-md">
        <Badge variant="outline">{importData.file_format.toUpperCase()}</Badge>
        <span className="text-sm text-muted-foreground">
          {t('pages.bankReconciliation.detail.entryInfo', {
            total: importData.total_entries,
            date: formatDate(importData.created_at),
          })}
        </span>
      </div>

      <DataTable
        data={entries}
        columns={columns}
        keyExtractor={(entry) => entry.id}
        emptyState={{
          icon: <ArrowLeftRight className="h-12 w-12" />,
          title: t('pages.bankReconciliation.detail.emptyTitle'),
          message: t('pages.bankReconciliation.detail.emptyMessage'),
        }}
        rowClassName={(entry) => {
          if (entry.status === 'matched')
            return 'bg-success/[0.03] border-l-4 border-l-success';
          if (entry.status === 'unmatched')
            return 'bg-destructive/[0.03] border-l-4 border-l-destructive';
          if (entry.status === 'ignored') return 'opacity-50 border-l-4 border-l-muted';
          return 'border-l-4 border-l-warning';
        }}
      />

      {/* Manual Match Modal */}
      <Dialog
        open={!!matchingEntry}
        onOpenChange={(open) => {
          if (!open) setMatchingEntry(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-sm">
              <Link2 className="h-4 w-4" />
              {t('pages.bankReconciliation.detail.dialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {candidateLabel === 'despesas'
                ? t('pages.bankReconciliation.detail.dialogDescExpense')
                : t('pages.bankReconciliation.detail.dialogDescRevenue')}
            </DialogDescription>
          </DialogHeader>

          {matchingEntry && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{matchingEntry.description}</p>
              <p className="mt-xs text-muted-foreground">
                {formatDate(matchingEntry.date)} ·{' '}
                <span
                  className={
                    matchingEntry.transaction_type === 'debit'
                      ? 'text-destructive'
                      : 'text-success'
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
              className="pl-xl"
              placeholder={
                candidateLabel === 'despesas'
                  ? t('pages.bankReconciliation.detail.searchExpenses')
                  : t('pages.bankReconciliation.detail.searchRevenues')
              }
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
            />
          </div>

          <div className="max-h-72 space-y-sm overflow-y-auto">
            {candidateLoading ? (
              <p className="py-md text-center text-sm text-muted-foreground">
                {t('common.actions.loading')}
              </p>
            ) : candidates.length === 0 ? (
              <p className="py-md text-center text-sm text-muted-foreground">
                {candidateLabel === 'despesas'
                  ? t('pages.bankReconciliation.detail.noExpensesFound')
                  : t('pages.bankReconciliation.detail.noRevenuesFound')}
              </p>
            ) : (
              candidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-sm rounded-md border p-sm text-sm"
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
                    {t('pages.bankReconciliation.detail.linkBtn')}
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
