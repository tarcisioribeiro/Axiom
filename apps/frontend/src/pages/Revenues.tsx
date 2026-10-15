/* eslint-disable max-lines */
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Download,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { DataTable } from '@/components/common/DataTable';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { ExportModal } from '@/components/common/ExportModal';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { TransactionsTabsNav } from '@/components/common/TransactionsTabsNav';
import { ReceiptButton } from '@/components/receipts';
import { RevenueForm } from '@/components/revenues/RevenueForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { REVENUE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { PAYMENT_STATUS_ICONS, REVENUE_CATEGORY_ICONS } from '@/config/icons';
import { useCurrentMember } from '@/hooks/use-current-member';
import { useRevenuesPage } from '@/hooks/use-revenues-page';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { useAuthStore } from '@/stores/auth-store';

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function Revenues({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  // Pré-carrega para o modal do formulário já abrir completo (sem campo surgindo depois).
  useCurrentMember();
  const {
    revenues,
    accounts,
    loans,
    fixedRevenues,
    isLoading,
    page,
    setPage,
    pageSize,
    totalCount,
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
    isExportModalOpen,
    setIsExportModalOpen,
    clearFilters,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleExport,
    hasActiveFilters,
    columns,
    prefillRevenueData,
  } = useRevenuesPage();

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <PageHeader title={t('pages.revenues.title')} icon={<TrendingUp />}>
        <div className="gap-sm flex items-center">
          <Can action="export">
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-sm"
            >
              <Download className="h-4 w-4" />
              {t('common.actions.export')}
            </Button>
          </Can>
          <Can action="add">
            <Button onClick={handleCreate} className="gap-sm">
              <Plus className="h-4 w-4" />
              {t('pages.revenues.newBtn')}
            </Button>
          </Can>
        </div>
      </PageHeader>

      {embedded && <TransactionsTabsNav />}

      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        activeFilters={[
          ...(categoryFilter !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('pages.revenues.allCategories')}: ${REVENUE_CATEGORIES_CANONICAL.find((c) => c.key === categoryFilter)?.label ?? categoryFilter}`,
                  onRemove: () => setCategoryFilter('all'),
                },
              ]
            : []),
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${statusFilter === 'paid' ? t('common.status.paid') : t('common.status.pending')}`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
          ...(startDate
            ? [
                {
                  key: 'startDate',
                  label: `${t('pages.revenues.dateFrom')}: ${formatDate(startDate)}`,
                  onRemove: () => setStartDate(undefined),
                },
              ]
            : []),
          ...(endDate
            ? [
                {
                  key: 'endDate',
                  label: `${t('pages.revenues.dateTo')}: ${formatDate(endDate)}`,
                  onRemove: () => setEndDate(undefined),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.revenues.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-44"
          />
        </FilterField>
        <FilterField label={t('common.fields.category')} icon={Tag}>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40" startIcon={<Tag className="h-3.5 w-3.5" />}>
              <SelectValue placeholder={t('pages.revenues.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.revenues.allCategories')}</SelectItem>
              {REVENUE_CATEGORIES_CANONICAL.map(({ key }) => {
                const Icon = REVENUE_CATEGORY_ICONS[key];
                return (
                  <SelectItem
                    key={key}
                    value={key}
                    icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                  >
                    {translate('revenueCategories', key)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-36"
              startIcon={<CircleDot className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.revenues.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.revenues.allStatus')}</SelectItem>
              <SelectItem
                value="received"
                icon={<PAYMENT_STATUS_ICONS.received className="h-4 w-4" />}
              >
                {t('pages.revenues.stats.received')}
              </SelectItem>
              <SelectItem
                value="pending"
                icon={<PAYMENT_STATUS_ICONS.pending className="h-4 w-4" />}
              >
                {t('common.status.pending')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </FilterField>
      </FilterBar>

      <DataTable
        data={revenues}
        columns={columns}
        keyExtractor={(revenue) => revenue.id}
        isLoading={isLoading}
        rowClassName={(revenue) => (revenue.received ? 'opacity-60' : '')}
        emptyState={{
          icon: <TrendingUp className="text-muted-foreground h-12 w-12" />,
          title: t('pages.revenues.emptyState'),
        }}
        pagination={{
          page,
          pageSize,
          total: totalCount,
          onPageChange: setPage,
        }}
        mobileCard={(revenue) => (
          <div className="px-md py-3">
            <div className="gap-sm flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{revenue.description}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {formatDate(revenue.date)} ·{' '}
                  {translateCategory(revenue.category, 'revenue')}
                </p>
              </div>
              <div className="text-right">
                <p className="numeric text-success text-sm font-semibold">
                  {formatCurrency(parseFloat(revenue.value))}
                </p>
                <span
                  className={`px-xs text-2xs mt-0.5 inline-block rounded py-0.5 font-medium ${
                    revenue.received
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}
                >
                  {revenue.received
                    ? t('pages.revenues.stats.received')
                    : t('common.status.pending')}
                </span>
              </div>
            </div>
            <div className="mt-sm gap-xs flex items-center justify-center">
              {revenue.received && (
                <ReceiptButton
                  source={{ type: 'revenue', data: revenue }}
                  memberName={getMemberDisplayName(revenue.member_name, user)}
                />
              )}
              <Can action="change">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(revenue)}
                  aria-label={t('common.actions.edit')}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
              <Can action="delete">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(revenue.id)}
                  aria-label={t('common.actions.delete')}
                >
                  <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
                </Button>
              </Can>
            </div>
          </div>
        )}
        actions={(revenue) => (
          <div className="gap-sm flex items-center justify-center">
            {revenue.received && (
              <ReceiptButton
                source={{ type: 'revenue', data: revenue }}
                memberName={getMemberDisplayName(revenue.member_name, user)}
              />
            )}
            <Can action="change">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(revenue)}
                aria-label={t('common.actions.edit')}
                title={t('common.actions.edit')}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
            <Can action="delete">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(revenue.id)}
                aria-label={t('common.actions.delete')}
                title={t('common.actions.delete')}
              >
                <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        )}
      />

      <ExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        title={t('pages.revenues.exportTitle')}
        onExport={handleExport}
        initialDateFrom={startDate}
        initialDateTo={endDate}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle mode={selectedRevenue ? 'edit' : 'create'}>
              {selectedRevenue
                ? t('pages.revenues.editTitle')
                : t('pages.revenues.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedRevenue
                  ? t('pages.revenues.editDesc')
                  : t('pages.revenues.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <RevenueForm
            revenue={selectedRevenue}
            prefillData={!selectedRevenue ? prefillRevenueData : undefined}
            accounts={accounts}
            loans={loans}
            fixedRevenues={fixedRevenues}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
