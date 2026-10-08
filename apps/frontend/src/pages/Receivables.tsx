/* eslint-disable max-lines */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Clock,
  Wallet,
  CircleDot,
  Tag,
} from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { ReceivableForm } from '@/components/receivables/ReceivableForm';
import { ReceivableReceiptDialog } from '@/components/receivables/ReceivableReceiptDialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  REVENUE_CATEGORIES_CANONICAL,
  TRANSLATIONS,
  translate,
} from '@/config/constants';
import { BILL_STATUS_ICONS, REVENUE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { receivablesService } from '@/services/receivables-service';
import type { Receivable, ReceivableFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  received: 'secondary',
  overdue: 'destructive',
  cancelled: 'outline',
};

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

interface ReceivablesProps {
  embedded?: boolean;
  /** Quando informado, o cabeçalho é renderizado nesse elemento (acima das abas do pai). */
  headerTarget?: HTMLElement | null;
}

export default function Receivables({
  embedded = false,
  headerTarget,
}: ReceivablesProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<
    Receivable | undefined
  >();
  const [receiptReceivable, setReceiptReceivable] = useState<Receivable | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const { data: receivables = [], isLoading: receivablesLoading } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => receivablesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const isLoading = receivablesLoading || accountsLoading;

  const createMutation = useMutation({
    mutationFn: (data: ReceivableFormData) => receivablesService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast({
        title: t('pages.receivables.created'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReceivableFormData }) =>
      receivablesService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast({
        title: t('pages.receivables.updated'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => receivablesService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast({
        title: t('pages.receivables.deleted'),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    setSelectedReceivable(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setIsDialogOpen(true);
  };

  const handleDelete = async (receivable: Receivable) => {
    const confirmed = await showConfirm({
      title: t('pages.receivables.deleteTitle'),
      description: t('pages.receivables.deleteDesc', { name: receivable.description }),
    });
    if (!confirmed) return;
    deleteMutation.mutate(receivable.id);
  };

  const handleSubmit = (data: ReceivableFormData) => {
    if (selectedReceivable) {
      updateMutation.mutate({ id: selectedReceivable.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredReceivables = useMemo(
    () =>
      receivables.filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
        if (startDate && (!r.due_date || new Date(r.due_date) < new Date(startDate)))
          return false;
        if (endDate && (!r.due_date || new Date(r.due_date) > new Date(endDate)))
          return false;
        return r.description.toLowerCase().includes(searchTerm.toLowerCase());
      }),
    [receivables, searchTerm, statusFilter, categoryFilter, startDate, endDate]
  );

  const { activeCount, overdueCount, receivedCount, totalValue } = useMemo(() => {
    return {
      activeCount: receivables.filter((r) => r.status === 'active').length,
      overdueCount: receivables.filter((r) => r.status === 'overdue').length,
      receivedCount: receivables.filter((r) => r.status === 'received').length,
      totalValue: receivables.reduce((s, r) => s + parseFloat(r.value), 0),
    };
  }, [receivables]);

  if (isLoading) return <LoadingState />;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  const header = (
    <PageHeader title={t('pages.receivables.title')} icon={<TrendingUp />}>
      <Button onClick={handleCreate} className="gap-sm">
        <Plus className="h-4 w-4" />
        {t('pages.receivables.newBtn')}
      </Button>
    </PageHeader>
  );

  return (
    <Wrapper>
      {headerTarget ? createPortal(header, headerTarget) : header}

      <FilterBar
        hasActiveFilters={
          !!searchTerm ||
          statusFilter !== 'all' ||
          categoryFilter !== 'all' ||
          !!startDate ||
          !!endDate
        }
        onClear={() => {
          setSearchTerm('');
          setStatusFilter('all');
          setCategoryFilter('all');
          setStartDate(undefined);
          setEndDate(undefined);
        }}
        activeFilters={[
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${t(`pages.receivables.status.${statusFilter}`)}`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
          ...(categoryFilter !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('pages.receivables.allCategories')}: ${translate('revenueCategories', categoryFilter)}`,
                  onRemove: () => setCategoryFilter('all'),
                },
              ]
            : []),
          ...(startDate
            ? [
                {
                  key: 'startDate',
                  label: `${t('common.fields.from')}: ${formatDate(startDate)}`,
                  onRemove: () => setStartDate(undefined),
                },
              ]
            : []),
          ...(endDate
            ? [
                {
                  key: 'endDate',
                  label: `${t('common.fields.to')}: ${formatDate(endDate)}`,
                  onRemove: () => setEndDate(undefined),
                },
              ]
            : []),
        ]}
      >
        <SearchInput
          placeholder={t('pages.receivables.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger
            className="w-44"
            aria-label={t('pages.receivables.allCategories')}
            startIcon={<Tag className="h-3.5 w-3.5" />}
          >
            <SelectValue placeholder={t('pages.receivables.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.receivables.allCategories')}</SelectItem>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-40"
            aria-label={t('pages.receivables.allStatus')}
            startIcon={<CircleDot className="h-3.5 w-3.5" />}
          >
            <SelectValue placeholder={t('pages.receivables.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.receivables.allStatus')}</SelectItem>
            <SelectItem
              value="active"
              icon={<BILL_STATUS_ICONS.active className="h-4 w-4" />}
            >
              {t('pages.receivables.status.active')}
            </SelectItem>
            <SelectItem
              value="received"
              icon={<BILL_STATUS_ICONS.received className="h-4 w-4" />}
            >
              {t('pages.receivables.status.received')}
            </SelectItem>
            <SelectItem
              value="overdue"
              icon={<BILL_STATUS_ICONS.overdue className="h-4 w-4" />}
            >
              {t('pages.receivables.status.overdue')}
            </SelectItem>
            <SelectItem
              value="cancelled"
              icon={<BILL_STATUS_ICONS.cancelled className="h-4 w-4" />}
            >
              {t('pages.receivables.status.cancelled')}
            </SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </FilterBar>

      <div className="gap-md grid grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-success/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.receivables.stats.total')}</p>
            <div className="bg-success/10 p-sm ring-success/20 rounded-lg ring-1">
              <Banknote className="text-success h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-success text-2xl font-bold">
              {formatCurrency(totalValue)}
            </div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.receivables.stats.totalSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-warning/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">{t('pages.receivables.stats.active')}</p>
            <div className="bg-warning/10 p-sm ring-warning/20 rounded-lg ring-1">
              <Clock className="text-warning h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-warning text-2xl font-bold">{activeCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.receivables.stats.activeSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-destructive/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">
              {t('pages.receivables.stats.overdue')}
            </p>
            <div className="bg-destructive/10 p-sm ring-destructive/20 rounded-lg ring-1">
              <AlertTriangle className="text-destructive h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-2xl font-bold">{overdueCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.receivables.stats.overdueSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-success/60 overflow-hidden border-t-2">
          <CardHeader className="pb-sm flex flex-row items-center justify-between space-y-0">
            <p className="text-sm font-medium">
              {t('pages.receivables.stats.received')}
            </p>
            <div className="bg-success/10 p-sm ring-success/20 rounded-lg ring-1">
              <CheckCircle2 className="text-success h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-success text-2xl font-bold">{receivedCount}</div>
            <p className="mt-xs text-muted-foreground text-xs">
              {t('pages.receivables.stats.receivedSubtitle')}
            </p>
          </CardContent>
        </Card>
      </div>

      {filteredReceivables.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="text-muted-foreground h-12 w-12" />}
          title={
            searchTerm
              ? t('pages.receivables.emptySearch')
              : t('pages.receivables.emptyState')
          }
        />
      ) : (
        <PaginatedSlide
          key={`${searchTerm}-${statusFilter}-${categoryFilter}-${String(startDate)}-${String(endDate)}`}
          items={filteredReceivables}
          pageSize={LIST_PAGE_SIZE}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3"
        >
          {(pageItems) =>
            pageItems.map((receivable) => {
              const getDueBadge = () => {
                if (receivable.status === 'overdue')
                  return {
                    label: 'Vencido',
                    cls: 'bg-destructive/10 text-destructive',
                  };
                if (receivable.status === 'received') return null;
                if (!receivable.due_date) return null;
                const days = Math.ceil(
                  (new Date(receivable.due_date).getTime() - Date.now()) / 86400000
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
              const urgencyClass =
                receivable.status === 'overdue'
                  ? 'border-l-4 border-l-destructive'
                  : receivable.status === 'received'
                    ? 'border-l-4 border-l-success'
                    : receivable.status === 'cancelled'
                      ? 'border-l-4 border-l-muted-foreground'
                      : (() => {
                          if (!receivable.due_date)
                            return 'border-l-4 border-l-warning';
                          const d = Math.ceil(
                            (new Date(receivable.due_date).getTime() - Date.now()) /
                              86400000
                          );
                          if (d <= 0) return 'border-l-4 border-l-destructive';
                          if (d <= 7) return 'border-l-4 border-l-warning';
                          return 'border-l-4 border-l-info';
                        })();

              const total = parseFloat(receivable.value);
              const received = parseFloat(receivable.received_value);
              const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
              const barColor =
                pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-info';

              return (
                <div
                  key={receivable.id}
                  className={cn(
                    'bg-card p-md space-y-3 rounded-lg border transition-colors',
                    urgencyClass
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="gap-sm flex items-center">
                        <h3 className="font-semibold">{receivable.description}</h3>
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
                        {TRANSLATIONS.revenueCategories[
                          receivable.category as keyof typeof TRANSLATIONS.revenueCategories
                        ] ?? receivable.category}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANTS[receivable.status] ?? 'default'}
                      className="gap-xs"
                    >
                      {(() => {
                        const StatusIcon = BILL_STATUS_ICONS[receivable.status];
                        return StatusIcon ? (
                          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : null;
                      })()}
                      {t(`pages.receivables.status.${receivable.status}`)}
                    </Badge>
                  </div>

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
                        {t('pages.receivables.receivedAmount', {
                          value: formatCurrency(received),
                        })}
                      </span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="space-y-xs text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.receivables.totalValue')}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(receivable.value)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('pages.receivables.remainingBalance')}
                      </span>
                      <span className="text-success font-medium">
                        {formatCurrency(total - received)}
                      </span>
                    </div>
                    {receivable.due_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('pages.receivables.dueDate')}
                        </span>
                        <span className="font-medium">
                          {formatDate(receivable.due_date, 'dd/MM/yyyy')}
                        </span>
                      </div>
                    )}
                    {receivable.member_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {t('pages.receivables.debtor')}
                        </span>
                        <span className="font-medium">{receivable.member_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t">
                    {receivable.status !== 'received' &&
                      receivable.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceiptReceivable(receivable)}
                          title={t('pages.receivables.receipt.title')}
                          className="gap-xs text-success text-xs"
                        >
                          <Wallet className="h-3 w-3" />
                          {t('pages.receivables.receiveBtn')}
                        </Button>
                      )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(receivable)}
                      title={t('common.actions.edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(receivable)}
                      title={t('common.actions.delete')}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          }
        </PaginatedSlide>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader sticky>
            <DialogTitle mode={selectedReceivable ? 'edit' : 'create'}>
              {selectedReceivable
                ? t('pages.receivables.editTitle')
                : t('pages.receivables.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedReceivable
                  ? t('pages.receivables.editDesc')
                  : t('pages.receivables.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <ReceivableForm
            receivable={selectedReceivable}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <ReceivableReceiptDialog
        receivable={receiptReceivable}
        accounts={accounts}
        onClose={() => setReceiptReceivable(null)}
        onSuccess={() =>
          void queryClient.invalidateQueries({ queryKey: ['receivables'] })
        }
      />
    </Wrapper>
  );
}
