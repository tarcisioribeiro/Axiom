/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  CreditCard,
  List,
  CalendarRange,
  Tag,
  CircleDot,
} from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { IncreaseValueDialog } from '@/components/payables/IncreaseValueDialog';
import { PayableForm } from '@/components/payables/PayableForm';
import { PayableInstallmentsDialog } from '@/components/payables/PayableInstallmentsDialog';
import { PayablePaymentDialog } from '@/components/payables/PayablePaymentDialog';
import { PaymentPlanDialog } from '@/components/payables/PaymentPlanDialog';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
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
import { EXPENSE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { BILL_STATUS_ICONS, EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { usePayablesPage } from '@/hooks/use-payables-page';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { getMemberDisplayName } from '@/lib/receipt-utils';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Payable, PayableInstallment } from '@/types';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  paid: 'secondary',
  overdue: 'destructive',
  cancelled: 'outline',
};

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

interface PayablesProps {
  embedded?: boolean;
  /** Quando informado, o cabeçalho é renderizado nesse elemento (acima das abas do pai). */
  headerTarget?: HTMLElement | null;
}

export default function Payables({ embedded = false, headerTarget }: PayablesProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    payables,
    isLoading: payablesLoading,
    isDialogOpen,
    setIsDialogOpen,
    selectedPayable,
    isSubmitting,
    searchTerm,
    setSearchTerm,
    filteredPayables,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
  } = usePayablesPage();

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const isLoading = payablesLoading || accountsLoading;
  const queryClient = useQueryClient();
  const invalidatePayables = () =>
    void queryClient.invalidateQueries({ queryKey: ['payables'] });

  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dueStartDate, setDueStartDate] = useState<Date | undefined>(undefined);
  const [dueEndDate, setDueEndDate] = useState<Date | undefined>(undefined);

  const [paymentPayable, setPaymentPayable] = useState<Payable | null>(null);
  const [paymentPlanPayable, setPaymentPlanPayable] = useState<Payable | null>(null);
  const [increaseValuePayable, setIncreaseValuePayable] = useState<Payable | null>(
    null
  );

  const [installmentsPayable, setInstallmentsPayable] = useState<Payable | null>(null);
  const [installments, setInstallments] = useState<PayableInstallment[]>([]);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);

  const loadInstallments = async (payable: Payable) => {
    setIsLoadingInstallments(true);
    try {
      const data = await payableInstallmentsService.getByPayable(payable.id);
      setInstallments(data);
    } catch {
      setInstallments([]);
    } finally {
      setIsLoadingInstallments(false);
    }
  };

  // Versão atualizada do payable (valor muda após "Aumentar valor").
  const managedPayable = installmentsPayable
    ? (payables.find((p) => p.id === installmentsPayable.id) ?? installmentsPayable)
    : null;

  const handleOpenInstallments = async (payable: Payable) => {
    setInstallmentsPayable(payable);
    await loadInstallments(payable);
  };

  const displayedPayables = useMemo(() => {
    let result = filteredPayables;
    if (statusFilter !== 'all')
      result = result.filter((p) => p.status === statusFilter);
    if (categoryFilter !== 'all')
      result = result.filter((p) => p.category === categoryFilter);
    if (dueStartDate)
      result = result.filter((p) => p.due_date && new Date(p.due_date) >= dueStartDate);
    if (dueEndDate)
      result = result.filter((p) => p.due_date && new Date(p.due_date) <= dueEndDate);
    return result;
  }, [filteredPayables, statusFilter, categoryFilter, dueStartDate, dueEndDate]);

  const hasExtraFilters =
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    !!dueStartDate ||
    !!dueEndDate;

  const clearExtraFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setDueStartDate(undefined);
    setDueEndDate(undefined);
  };

  if (isLoading) return <LoadingState />;

  const header = (
    <PageHeader title={t('pages.payables.title')} icon={<Receipt />}>
      <Button onClick={handleCreate} className="gap-sm">
        <Plus className="h-4 w-4" />
        {t('pages.payables.newBtn')}
      </Button>
    </PageHeader>
  );

  return (
    <Wrapper embedded={embedded}>
      {headerTarget ? createPortal(header, headerTarget) : header}

      <FilterBar
        hasActiveFilters={!!searchTerm || hasExtraFilters}
        onClear={clearExtraFilters}
        activeFilters={[
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${translate('payableStatus', statusFilter)}`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
          ...(categoryFilter !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('common.fields.category')}: ${EXPENSE_CATEGORIES_CANONICAL.find((c) => c.key === categoryFilter)?.label ?? categoryFilter}`,
                  onRemove: () => setCategoryFilter('all'),
                },
              ]
            : []),
          ...(dueStartDate
            ? [
                {
                  key: 'dueStartDate',
                  label: `${t('common.fields.from')}: ${formatDate(dueStartDate)}`,
                  onRemove: () => setDueStartDate(undefined),
                },
              ]
            : []),
          ...(dueEndDate
            ? [
                {
                  key: 'dueEndDate',
                  label: `${t('common.fields.to')}: ${formatDate(dueEndDate)}`,
                  onRemove: () => setDueEndDate(undefined),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')}>
          <SearchInput
            placeholder={t('pages.payables.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.fields.status')}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.payables.allStatus')}
              startIcon={<CircleDot className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.payables.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.payables.allStatus')}</SelectItem>
              <SelectItem
                value="active"
                icon={<BILL_STATUS_ICONS.active className="h-4 w-4" />}
              >
                {translate('payableStatus', 'active')}
              </SelectItem>
              <SelectItem
                value="paid"
                icon={<BILL_STATUS_ICONS.paid className="h-4 w-4" />}
              >
                {translate('payableStatus', 'paid')}
              </SelectItem>
              <SelectItem
                value="overdue"
                icon={<BILL_STATUS_ICONS.overdue className="h-4 w-4" />}
              >
                {translate('payableStatus', 'overdue')}
              </SelectItem>
              <SelectItem
                value="cancelled"
                icon={<BILL_STATUS_ICONS.cancelled className="h-4 w-4" />}
              >
                {translate('payableStatus', 'cancelled')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.fields.category')}>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-44"
              aria-label={t('pages.payables.allCategories')}
              startIcon={<Tag className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.payables.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.payables.allCategories')}</SelectItem>
              {EXPENSE_CATEGORIES_CANONICAL.map(({ key, label }) => {
                const Icon = EXPENSE_CATEGORY_ICONS[key];
                return (
                  <SelectItem
                    key={key}
                    value={key}
                    icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
                  >
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.filterLabels.period')}>
          <DateRangeFilter
            startDate={dueStartDate}
            endDate={dueEndDate}
            onStartChange={setDueStartDate}
            onEndChange={setDueEndDate}
          />
        </FilterField>
      </FilterBar>

      {displayedPayables.length === 0 ? (
        <EmptyState
          icon={<Receipt className="text-muted-foreground h-12 w-12" />}
          title={
            searchTerm || hasExtraFilters
              ? t('pages.payables.emptySearch')
              : t('pages.payables.emptyState')
          }
        />
      ) : (
        <PaginatedSlide
          key={`${searchTerm}-${statusFilter}-${categoryFilter}-${dueStartDate?.getTime()}-${dueEndDate?.getTime()}`}
          items={displayedPayables}
          pageSize={GRID_PAGE_SIZE}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3"
        >
          {(pageItems) =>
            pageItems.map((payable) => {
              const getDueBadge = () => {
                if (payable.status === 'overdue') {
                  return {
                    label: 'Vencido',
                    cls: 'bg-destructive/10 text-destructive',
                  };
                }
                if (payable.status === 'paid') return null;
                if (!payable.due_date) return null;
                const days = Math.ceil(
                  (new Date(payable.due_date).getTime() - Date.now()) / 86400000
                );
                if (days < 0)
                  return {
                    label: 'Vencido',
                    cls: 'bg-destructive/10 text-destructive',
                  };
                if (days === 0)
                  return {
                    label: 'Vence hoje',
                    cls: 'bg-destructive/10 text-destructive',
                  };
                if (days <= 7)
                  return { label: `${days}d`, cls: 'bg-warning/10 text-warning' };
                return null;
              };
              const dueBadge = getDueBadge();
              return (
                <div
                  key={payable.id}
                  className="bg-card p-md space-y-3 rounded-lg border"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="gap-sm flex items-center">
                        <h3 className="font-semibold">{payable.description}</h3>
                        {dueBadge && (
                          <span
                            className={cn(
                              'px-xs rounded-full py-0.5 text-xs font-medium',
                              dueBadge.cls
                            )}
                          >
                            {dueBadge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {translate('expenseCategories', payable.category)}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANTS[payable.status] ?? 'default'}
                      className="gap-xs"
                    >
                      {(() => {
                        const StatusIcon = BILL_STATUS_ICONS[payable.status];
                        return StatusIcon ? (
                          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : null;
                      })()}
                      {translate('payableStatus', payable.status)}
                    </Badge>
                  </div>

                  {(() => {
                    const total = parseFloat(payable.value);
                    const paid = parseFloat(payable.paid_value);
                    const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
                    const barColor =
                      pct >= 100
                        ? 'bg-success'
                        : pct >= 50
                          ? 'bg-warning'
                          : 'bg-destructive';
                    return (
                      <div className="space-y-xs">
                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width]',
                              barColor
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>
                            {t('pages.payables.paidAmount', {
                              value: formatCurrency(paid),
                            })}
                          </span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-xs text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.payables.totalValue')}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(payable.value)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.payables.remainingBalance')}
                      </span>
                      <span className="text-destructive font-medium">
                        {formatCurrency(
                          parseFloat(payable.value) - parseFloat(payable.paid_value)
                        )}
                      </span>
                    </div>
                    {payable.due_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('pages.payables.dueDate')}
                        </span>
                        <span className="font-medium">
                          {formatDate(payable.due_date, 'dd/MM/yyyy')}
                        </span>
                      </div>
                    )}
                    {payable.member_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('pages.payables.responsible')}
                        </span>
                        <span className="font-medium">{payable.member_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t">
                    {payable.status !== 'paid' && payable.status !== 'cancelled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentPayable(payable)}
                        title={t('pages.payables.payment.title')}
                        className="gap-xs text-xs"
                      >
                        <CreditCard className="h-3 w-3" />
                        {t('pages.payables.payBtn')}
                      </Button>
                    )}
                    {(payable.installments ?? 0) > 1 || payable.is_cumulative ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleOpenInstallments(payable)}
                        title={t('pages.payables.manageDebtBtn')}
                        className="gap-xs text-xs"
                      >
                        <List className="h-3 w-3" />
                        {t('pages.payables.manageDebtBtn')}
                      </Button>
                    ) : (
                      payable.status !== 'paid' &&
                      payable.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentPlanPayable(payable)}
                          title={t('pages.payables.form.paymentPlanTitle')}
                          className="gap-xs text-xs"
                        >
                          <CalendarRange className="h-3 w-3" />
                          {t('pages.payables.form.createPaymentPlanBtn')}
                        </Button>
                      )
                    )}
                    <ReceiptButton
                      source={{ type: 'payable', data: payable }}
                      memberName={getMemberDisplayName(payable.member_name, user)}
                      variant="ghost"
                      size="icon"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(payable)}
                      title={t('common.actions.edit')}
                      aria-label={t('common.actions.edit')}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(payable)}
                      title={t('common.actions.delete')}
                      aria-label={t('common.actions.delete')}
                    >
                      <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })
          }
        </PaginatedSlide>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader sticky>
            <DialogTitle mode={selectedPayable ? 'edit' : 'create'}>
              {selectedPayable
                ? t('pages.payables.editTitle')
                : t('pages.payables.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedPayable
                  ? t('pages.payables.editDesc')
                  : t('pages.payables.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <PayableForm
            payable={selectedPayable}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <PayablePaymentDialog
        payable={paymentPayable}
        accounts={accounts}
        onClose={() => setPaymentPayable(null)}
      />

      <PayableInstallmentsDialog
        payable={managedPayable}
        installments={installments}
        isLoading={isLoadingInstallments}
        onClose={() => setInstallmentsPayable(null)}
        onUpdated={() => {
          invalidatePayables();
          if (installmentsPayable) void loadInstallments(installmentsPayable);
        }}
        onIncreaseValue={() => setIncreaseValuePayable(managedPayable)}
      />

      <PaymentPlanDialog
        payable={paymentPlanPayable}
        accounts={accounts}
        onClose={() => setPaymentPlanPayable(null)}
        onSuccess={invalidatePayables}
      />

      <IncreaseValueDialog
        payable={increaseValuePayable}
        onClose={() => setIncreaseValuePayable(null)}
        onSuccess={() => {
          invalidatePayables();
          if (installmentsPayable) void loadInstallments(installmentsPayable);
        }}
      />
    </Wrapper>
  );
}
