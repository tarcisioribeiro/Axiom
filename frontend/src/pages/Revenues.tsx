import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  Download,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable } from '@/components/common/DataTable';
import { ExportModal } from '@/components/common/ExportModal';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReceiptButton } from '@/components/receipts';
import { RevenueForm } from '@/components/revenues/RevenueForm';
import { RevenuesFilters } from '@/components/revenues/RevenuesFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRevenuesPage } from '@/hooks/use-revenues-page';
import { formatCurrency } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

export default function Revenues() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    revenues,
    accounts,
    loans,
    isLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedRevenue,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedAccounts,
    isExportModalOpen,
    setIsExportModalOpen,
    toggleAccount,
    clearFilters,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleExport,
    totalRevenues,
    hasActiveFilters,
    columns,
    prefillRevenueData,
  } = useRevenuesPage();

  const BREAKDOWN_COLORS = [
    'bg-success',
    'bg-primary',
    'bg-info',
    'bg-warning',
    'bg-accent',
    'bg-destructive',
  ] as const;

  const { receivedCount, receivedAmount, pendingCount, pendingAmount } = useMemo(() => {
    const filtered = revenues.filter(
      (r) => !r.related_transfer && !r.is_transfer_generated
    );
    const received = filtered.filter((r) => r.received);
    const pending = filtered.filter((r) => !r.received);
    return {
      receivedCount: received.length,
      receivedAmount: received.reduce((s, r) => s + parseFloat(r.value), 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, r) => s + parseFloat(r.value), 0),
    };
  }, [revenues]);

  const categoryBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const r of revenues.filter(
      (r) => !r.related_transfer && !r.is_transfer_generated
    )) {
      groups[r.category] = (groups[r.category] ?? 0) + parseFloat(r.value);
    }
    const total = Object.values(groups).reduce((s, v) => s + v, 0);
    return Object.entries(groups)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([cat, amount]) => ({
        cat,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }));
  }, [revenues]);

  return (
    <PageContainer>
      <PageHeader title={t('pages.revenues.title')} icon={<TrendingUp />}>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsExportModalOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {t('common.actions.export')}
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('pages.revenues.newBtn')}
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <Card className="overflow-hidden border-t-2 border-t-success/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.revenues.stats.totalAmount')}
            </p>
            <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalRevenues)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">
              {revenues.length} lançamentos
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-primary/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.revenues.stats.received')}</p>
            <div className="rounded-lg bg-primary/10 p-sm ring-1 ring-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{receivedCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {formatCurrency(receivedAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-warning/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.revenues.stats.pending')}</p>
            <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{pendingCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {formatCurrency(pendingAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {categoryBreakdown.length > 1 && (
        <div className="rounded-lg border bg-card p-md">
          <p className="mb-sm text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Por categoria
          </p>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {categoryBreakdown.map(({ cat, pct }, i) => (
              <div
                key={cat}
                className={`h-full transition-all ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`}
                style={{ width: `${pct}%` }}
                title={`${translateCategory(cat, 'revenue')}: ${pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="mt-sm flex flex-wrap gap-md">
            {categoryBreakdown.map(({ cat, pct }, i) => (
              <div key={cat} className="flex items-center gap-xs">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`}
                />
                <span className="text-xs text-muted-foreground">
                  {translateCategory(cat, 'revenue')} · {Math.round(pct)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RevenuesFilters
        accounts={accounts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedAccounts={selectedAccounts}
        toggleAccount={toggleAccount}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        totalRevenues={totalRevenues}
        count={revenues.length}
      />

      <DataTable
        data={revenues}
        columns={columns}
        keyExtractor={(revenue) => revenue.id}
        isLoading={isLoading}
        emptyState={{
          icon: <TrendingUp className="h-12 w-12 text-muted-foreground" />,
          message: t('pages.revenues.emptyState'),
        }}
        actions={(revenue) => (
          <div className="flex items-center justify-end gap-2">
            {revenue.received && (
              <ReceiptButton
                source={{ type: 'revenue', data: revenue }}
                memberName={getMemberDisplayName(revenue.member_name, user)}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(revenue)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(revenue.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <ExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        title={t('pages.revenues.exportTitle')}
        description={t('pages.revenues.exportDesc')}
        onExport={handleExport}
        initialDateFrom={startDate}
        initialDateTo={endDate}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRevenue
                ? t('pages.revenues.editTitle')
                : t('pages.revenues.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedRevenue
                ? t('pages.revenues.editDesc')
                : t('pages.revenues.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <RevenueForm
            revenue={selectedRevenue}
            prefillData={!selectedRevenue ? prefillRevenueData : undefined}
            accounts={accounts}
            loans={loans}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
