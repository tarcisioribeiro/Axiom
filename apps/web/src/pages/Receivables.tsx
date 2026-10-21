/* eslint-disable max-lines */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Plus,
  Search,
  Tag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { CardActions } from '@/components/common/CardActions';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { ReceivableDetailModal } from '@/components/receivables/ReceivableDetailModal';
import { ReceivableForm } from '@/components/receivables/ReceivableForm';
import { ReceivableReceiptDialog } from '@/components/receivables/ReceivableReceiptDialog';
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
import {
  REVENUE_CATEGORIES_CANONICAL,
  TRANSLATIONS,
  translate,
} from '@/config/constants';
import { BILL_STATUS_ICONS, REVENUE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
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
  const [detailReceivable, setDetailReceivable] = useState<Receivable | null>(null);
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

  if (isLoading) return <LoadingState />;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  const header = (
    <PageHeader title={t('pages.receivables.title')} icon={<TrendingUp />}>
      <Can action="add">
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.receivables.newBtn')}
        </Button>
      </Can>
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
      >
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.receivables.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.fields.category')} icon={Tag}>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-44"
              aria-label={t('pages.receivables.allCategories')}
              startIcon={<Tag className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.receivables.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.receivables.allCategories')}
              </SelectItem>
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
          pageSize={GRID_PAGE_SIZE}
          className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
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
              const total = parseFloat(receivable.value);
              const received = parseFloat(receivable.received_value);
              const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
              const barColor =
                pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-info';

              return (
                <div
                  key={receivable.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (e.currentTarget.contains(target) && !target.closest('button'))
                      setDetailReceivable(receivable);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      !(e.target as HTMLElement).closest('button')
                    ) {
                      e.preventDefault();
                      setDetailReceivable(receivable);
                    }
                  }}
                  className="bg-card px-md py-sm space-y-sm cursor-pointer rounded-lg border"
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

                  <div className="gap-sm text-muted-foreground flex items-center text-xs">
                    <span className="shrink-0">
                      {t('pages.receivables.receivedAmount', {
                        value: formatCurrency(received),
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

                  <div className="gap-xs pt-sm flex flex-wrap items-center justify-end border-t">
                    <CardActions
                      onEdit={() => handleEdit(receivable)}
                      onDelete={() => void handleDelete(receivable)}
                      menuActions={
                        receivable.status !== 'received' &&
                        receivable.status !== 'cancelled'
                          ? [
                              {
                                icon: Wallet,
                                label: t('pages.receivables.receiveBtn'),
                                action: 'receive',
                                onClick: () => setReceiptReceivable(receivable),
                                color: 'receive' as const,
                              },
                            ]
                          : []
                      }
                    />
                  </div>
                </div>
              );
            })
          }
        </PaginatedSlide>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
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

      <ReceivableDetailModal
        receivable={detailReceivable}
        onClose={() => setDetailReceivable(null)}
      />

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
