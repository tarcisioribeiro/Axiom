/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  CreditCard,
  List,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Clock,
  CalendarRange,
  TrendingUp,
} from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { IncreaseValueDialog } from '@/components/payables/IncreaseValueDialog';
import { PayableForm } from '@/components/payables/PayableForm';
import { PayableInstallmentsDialog } from '@/components/payables/PayableInstallmentsDialog';
import { PayablePaymentDialog } from '@/components/payables/PayablePaymentDialog';
import { PaymentPlanDialog } from '@/components/payables/PaymentPlanDialog';
import { ReceiptButton } from '@/components/receipts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { translate } from '@/config/constants';
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

export default function Payables({ embedded = false }: { embedded?: boolean }) {
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

  const [paymentPayable, setPaymentPayable] = useState<Payable | null>(null);
  const [paymentPlanPayable, setPaymentPlanPayable] = useState<Payable | null>(null);
  const [increaseValuePayable, setIncreaseValuePayable] = useState<Payable | null>(
    null
  );

  const [installmentsPayable, setInstallmentsPayable] = useState<Payable | null>(null);
  const [installments, setInstallments] = useState<PayableInstallment[]>([]);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);

  const handleOpenInstallments = async (payable: Payable) => {
    setInstallmentsPayable(payable);
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

  const { activeCount, overdueCount, paidCount, totalValue } = useMemo(() => {
    const active = payables.filter((p) => p.status === 'active');
    const overdue = payables.filter((p) => p.status === 'overdue');
    const paid = payables.filter((p) => p.status === 'paid');
    const total = payables.reduce((s, p) => s + parseFloat(p.value), 0);
    return {
      activeCount: active.length,
      overdueCount: overdue.length,
      paidCount: paid.length,
      totalValue: total,
    };
  }, [payables]);

  if (isLoading) return <LoadingState />;

  return (
    <Wrapper embedded={embedded}>
      <PageHeader title={t('pages.payables.title')} icon={<Receipt />}>
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.payables.newBtn')}
        </Button>
      </PageHeader>

      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <SearchInput
          placeholder={t('pages.payables.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
      </FilterBar>

      <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-destructive/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.payables.stats.total')}</p>
            <div className="bg-destructive/10 p-sm ring-destructive/20 rounded-lg ring-1">
              <Banknote className="text-destructive h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">
              {formatCurrency(totalValue)}
            </div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.payables.stats.totalSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-warning/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.payables.stats.active')}</p>
            <div className="bg-warning/10 p-sm ring-warning/20 rounded-lg ring-1">
              <Clock className="text-warning h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-warning text-2xl font-bold">{activeCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.payables.stats.activeSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-destructive/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.payables.stats.overdue')}</p>
            <div className="bg-destructive/10 p-sm ring-destructive/20 rounded-lg ring-1">
              <AlertTriangle className="text-destructive h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">{overdueCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.payables.stats.overdueSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-success/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.payables.stats.paid')}</p>
            <div className="bg-success/10 p-sm ring-success/20 rounded-lg ring-1">
              <CheckCircle2 className="text-success h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-success text-2xl font-bold">{paidCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.payables.stats.paidSubtitle')}
            </p>
          </CardContent>
        </Card>
      </div>

      {filteredPayables.length === 0 ? (
        <EmptyState
          icon={<Receipt className="text-muted-foreground h-12 w-12" />}
          message={
            searchTerm
              ? t('pages.payables.emptySearch')
              : t('pages.payables.emptyState')
          }
        />
      ) : (
        <div className="gap-md grid md:grid-cols-2 lg:grid-cols-3">
          {filteredPayables.map((payable) => {
            const getDueBadge = () => {
              if (payable.status === 'overdue') {
                return { label: 'Vencido', cls: 'bg-destructive/10 text-destructive' };
              }
              if (payable.status === 'paid') return null;
              if (!payable.due_date) return null;
              const days = Math.ceil(
                (new Date(payable.due_date).getTime() - Date.now()) / 86400000
              );
              if (days < 0)
                return { label: 'Vencido', cls: 'bg-destructive/10 text-destructive' };
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
            const urgencyClass =
              payable.status === 'overdue'
                ? 'border-l-4 border-l-destructive'
                : payable.status === 'paid'
                  ? 'border-l-4 border-l-success'
                  : payable.status === 'cancelled'
                    ? 'border-l-4 border-l-muted-foreground'
                    : (() => {
                        if (!payable.due_date) return 'border-l-4 border-l-warning';
                        const d = Math.ceil(
                          (new Date(payable.due_date).getTime() - Date.now()) / 86400000
                        );
                        if (d <= 0) return 'border-l-4 border-l-destructive';
                        if (d <= 7) return 'border-l-4 border-l-warning';
                        return 'border-l-4 border-l-info';
                      })();
            return (
              <div
                key={payable.id}
                className={cn(
                  'bg-card p-md space-y-3 rounded-lg border transition-shadow hover:shadow-md',
                  urgencyClass
                )}
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
                  <Badge variant={STATUS_VARIANTS[payable.status] ?? 'default'}>
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
                          className={cn('h-full rounded-full transition-all', barColor)}
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
                    <span className="font-medium">{formatCurrency(payable.value)}</span>
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
                  {(payable.installments ?? 0) > 1 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleOpenInstallments(payable)}
                      title={t('pages.payables.installments.title')}
                      className="gap-xs text-xs"
                    >
                      <List className="h-3 w-3" />
                      {t('pages.payables.installmentsBtn')}
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
                  {payable.is_cumulative && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIncreaseValuePayable(payable)}
                      title={t('pages.payables.form.increaseValueTitle')}
                      className="gap-xs text-xs"
                    >
                      <TrendingUp className="h-3 w-3" />
                      {t('pages.payables.form.increaseValueBtn')}
                    </Button>
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
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPayable
                ? t('pages.payables.editTitle')
                : t('pages.payables.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedPayable
                ? t('pages.payables.editDesc')
                : t('pages.payables.newDesc')}
            </DialogDescription>
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
        payable={installmentsPayable}
        installments={installments}
        isLoading={isLoadingInstallments}
        onClose={() => setInstallmentsPayable(null)}
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
        onSuccess={invalidatePayables}
      />
    </Wrapper>
  );
}
