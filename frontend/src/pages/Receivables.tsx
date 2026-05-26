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
} from 'lucide-react';
import { useState, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
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
import { TRANSLATIONS } from '@/config/constants';
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

export default function Receivables({ embedded = false }: { embedded?: boolean }) {
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
        description: t('pages.receivables.createdDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
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
        description: t('pages.receivables.updatedDesc'),
      });
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
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
        description: t('pages.receivables.deletedDesc'),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
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
      receivables.filter((r) =>
        r.description.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [receivables, searchTerm]
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

  return (
    <Wrapper>
      <PageHeader title={t('pages.receivables.title')} icon={<TrendingUp />}>
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.receivables.newBtn')}
        </Button>
      </PageHeader>

      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <SearchInput
          placeholder={t('pages.receivables.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-52 sm:w-64"
        />
      </FilterBar>

      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        <Card className="overflow-hidden border-t-2 border-t-success/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.receivables.stats.total')}</p>
            <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
              <Banknote className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalValue)}
            </div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.receivables.stats.totalSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-warning/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">{t('pages.receivables.stats.active')}</p>
            <div className="rounded-lg bg-warning/10 p-sm ring-1 ring-warning/20">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{activeCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.receivables.stats.activeSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-destructive/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.receivables.stats.overdue')}
            </p>
            <div className="rounded-lg bg-destructive/10 p-sm ring-1 ring-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.receivables.stats.overdueSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-t-2 border-t-success/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-sm">
            <p className="text-sm font-medium">
              {t('pages.receivables.stats.received')}
            </p>
            <div className="rounded-lg bg-success/10 p-sm ring-1 ring-success/20">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{receivedCount}</div>
            <p className="mt-xs text-xs text-muted-foreground">
              {t('pages.receivables.stats.receivedSubtitle')}
            </p>
          </CardContent>
        </Card>
      </div>

      {filteredReceivables.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? t('pages.receivables.emptySearch')
              : t('pages.receivables.emptyState')
          }
        />
      ) : (
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {filteredReceivables.map((receivable) => {
            const getDueBadge = () => {
              if (receivable.status === 'overdue')
                return { label: 'Vencido', cls: 'bg-destructive/10 text-destructive' };
              if (receivable.status === 'received') return null;
              if (!receivable.due_date) return null;
              const days = Math.ceil(
                (new Date(receivable.due_date).getTime() - Date.now()) / 86400000
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
              receivable.status === 'overdue'
                ? 'border-l-4 border-l-destructive'
                : receivable.status === 'received'
                  ? 'border-l-4 border-l-success'
                  : receivable.status === 'cancelled'
                    ? 'border-l-4 border-l-muted-foreground'
                    : (() => {
                        if (!receivable.due_date) return 'border-l-4 border-l-warning';
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
                  'space-y-3 rounded-lg border bg-card p-md transition-shadow hover:shadow-md',
                  urgencyClass
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-sm">
                      <h3 className="font-semibold">{receivable.description}</h3>
                      {dueBadge && (
                        <span
                          className={cn(
                            'rounded-full px-xs py-0.5 text-xs font-medium',
                            dueBadge.cls
                          )}
                        >
                          {dueBadge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {TRANSLATIONS.revenueCategories[
                        receivable.category as keyof typeof TRANSLATIONS.revenueCategories
                      ] ?? receivable.category}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[receivable.status] ?? 'default'}>
                    {t(`pages.receivables.status.${receivable.status}`)}
                  </Badge>
                </div>

                <div className="space-y-xs">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
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
                    <span className="font-medium text-success">
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

                <div className="flex flex-wrap items-center justify-end gap-xs border-t pt-sm">
                  {receivable.status !== 'received' &&
                    receivable.status !== 'cancelled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReceiptReceivable(receivable)}
                        title={t('pages.receivables.receipt.title')}
                        className="gap-xs text-xs text-success"
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
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReceivable
                ? t('pages.receivables.editTitle')
                : t('pages.receivables.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedReceivable
                ? t('pages.receivables.editDesc')
                : t('pages.receivables.newDesc')}
            </DialogDescription>
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
