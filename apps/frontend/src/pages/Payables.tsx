/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  CreditCard,
  List,
  Plus,
  Receipt,
  Search,
  Tag,
} from 'lucide-react';
import { useState, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { CardActions } from '@/components/common/CardActions';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { IncreaseValueDialog } from '@/components/payables/IncreaseValueDialog';
import { PayableDetailModal } from '@/components/payables/PayableDetailModal';
import { PayableForm } from '@/components/payables/PayableForm';
import { PayableInstallmentsDialog } from '@/components/payables/PayableInstallmentsDialog';
import { PayablePaymentDialog } from '@/components/payables/PayablePaymentDialog';
import { PaymentPlanDialog } from '@/components/payables/PaymentPlanDialog';
import { ReceiptPreviewDialog } from '@/components/receipts';
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
import { getMemberDisplayName, mapPayableToReceipt } from '@/lib/receipt-utils';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { payableInstallmentsService } from '@/services/payable-installments-service';
import { useAuthStore } from '@/stores/auth-store';
import type { Payable, PayableInstallment } from '@/types';
import type { ReceiptData } from '@/types/receipt';

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
  const [detailPayable, setDetailPayable] = useState<Payable | null>(null);
  // Radix portals the "..." menu outside the card's DOM subtree, so a click
  // on one of its items can still resolve onto the card underneath once the
  // menu closes. Marked on pointerdown (before Radix unmounts the portal),
  // checked once by the card's own click handler. Only one menu can be open
  // at a time, so a single shared ref (not one per card) is enough.
  const suppressDetailRef = useRef(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const loadInstallments = async (payable: Payable) => {
    try {
      const data = await payableInstallmentsService.getByPayable(payable.id);
      setInstallments(data);
    } catch {
      setInstallments([]);
    }
  };

  // Versão atualizada do payable (valor muda após "Aumentar valor").
  const managedPayable = installmentsPayable
    ? (payables.find((p) => p.id === installmentsPayable.id) ?? installmentsPayable)
    : null;

  // Abre só com os dados prontos: abrir em "Carregando…" e depois crescer até a
  // tabela faz o modal saltar de tamanho (efeito de "modal fantasma").
  const handleOpenInstallments = async (payable: Payable) => {
    await loadInstallments(payable);
    setInstallmentsPayable(payable);
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
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.payables.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
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
        <FilterField label={t('common.fields.category')} icon={Tag}>
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
        <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
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
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
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
              const isOpen =
                payable.status !== 'paid' && payable.status !== 'cancelled';
              const hasInstallments =
                (payable.installments ?? 0) > 1 || payable.is_cumulative;
              return (
                <div
                  key={payable.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if (suppressDetailRef.current) {
                      suppressDetailRef.current = false;
                      return;
                    }
                    if (!(e.target as HTMLElement).closest('button'))
                      setDetailPayable(payable);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      !(e.target as HTMLElement).closest('button')
                    ) {
                      e.preventDefault();
                      setDetailPayable(payable);
                    }
                  }}
                  className="bg-card px-md py-sm space-y-sm cursor-pointer rounded-lg border"
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
                      <div className="gap-sm text-muted-foreground flex items-center text-xs">
                        <span className="shrink-0">
                          {t('pages.payables.paidAmount', {
                            value: formatCurrency(paid),
                          })}
                        </span>
                        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              'h-full w-full origin-left rounded-full transition-transform',
                              barColor
                            )}
                            style={{ transform: `scaleX(${pct / 100})` }}
                          />
                        </div>
                        <span className="shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })()}

                  <div
                    role="presentation"
                    className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <CardActions
                      onEdit={() => handleEdit(payable)}
                      onDelete={() => handleDelete(payable)}
                      onMenuPointerDown={() => {
                        suppressDetailRef.current = true;
                      }}
                      menuActions={[
                        ...(isOpen
                          ? [
                              {
                                icon: CreditCard,
                                label: t('pages.payables.payBtn'),
                                onClick: () => setPaymentPayable(payable),
                                color: 'pay' as const,
                              },
                            ]
                          : []),
                        {
                          icon: Receipt,
                          label: t('receipt.button.tooltip'),
                          onClick: () =>
                            setReceiptData(
                              mapPayableToReceipt(
                                payable,
                                getMemberDisplayName(payable.member_name, user)
                              )
                            ),
                          color: 'receipt' as const,
                        },
                        hasInstallments
                          ? {
                              icon: List,
                              label: t('pages.payables.manageDebtBtn'),
                              onClick: () => void handleOpenInstallments(payable),
                              color: 'installments' as const,
                            }
                          : {
                              icon: CalendarRange,
                              label: t('pages.payables.form.createPaymentPlanBtn'),
                              onClick: () => setPaymentPlanPayable(payable),
                              color: 'plan' as const,
                            },
                      ]}
                    />
                  </div>
                </div>
              );
            })
          }
        </PaginatedSlide>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
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

      <ReceiptPreviewDialog
        open={!!receiptData}
        onOpenChange={(open) => !open && setReceiptData(null)}
        data={receiptData}
      />

      <PayableDetailModal
        payable={detailPayable}
        onClose={() => setDetailPayable(null)}
      />

      <PayablePaymentDialog
        payable={paymentPayable}
        accounts={accounts}
        onClose={() => setPaymentPayable(null)}
      />

      <PayableInstallmentsDialog
        payable={managedPayable}
        installments={installments}
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
