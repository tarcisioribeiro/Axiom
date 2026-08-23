/* eslint-disable max-lines */
import {
  PlusIcon as Plus,
  PencilIcon as Pencil,
  TrashIcon as Trash2,
  CalendarIcon as Calendar,
  ArrowTrendingUpIcon as TrendingUp,
  ArrowTrendingDownIcon as TrendingDown,
  CurrencyDollarIcon as DollarSign,
  BuildingStorefrontIcon as Store,
  TagIcon as Tag,
  WalletIcon as Wallet,
  CalendarDaysIcon as CalendarDays,
} from '@heroicons/react/24/solid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { REVENUE_CATEGORIES_CANONICAL, translate } from '@/config/constants';
import { REVENUE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { fixedRevenuesService } from '@/services/fixed-revenues-service';
import type {
  FixedRevenue,
  FixedRevenueFormData,
  Account,
  FixedRevenueStats,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const MONTHS = [
  { value: '01' },
  { value: '02' },
  { value: '03' },
  { value: '04' },
  { value: '05' },
  { value: '06' },
  { value: '07' },
  { value: '08' },
  { value: '09' },
  { value: '10' },
  { value: '11' },
  { value: '12' },
];

function getDefaultMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const EMPTY_REVENUES: FixedRevenue[] = [];
const EMPTY_ACCOUNTS: Account[] = [];

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function FixedRevenues({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<FixedRevenue | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const [formData, setFormData] = useState<FixedRevenueFormData>({
    description: '',
    default_value: 0,
    category: 'salary',
    account: 0,
    due_day: 1,
    is_active: true,
    allow_value_edit: true,
    member: null,
    notes: '',
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['fixed-revenues'],
    queryFn: async () => {
      try {
        const [revenuesData, accountsData, statsData] = await Promise.all([
          fixedRevenuesService.getAll(),
          accountsService.getAll(),
          fixedRevenuesService.getStats(),
        ]);
        const revenues: FixedRevenue[] = Array.isArray(revenuesData)
          ? (revenuesData as FixedRevenue[])
          : (revenuesData.results ?? []);
        return {
          fixedRevenues: revenues,
          accounts: accountsData,
          stats: statsData as FixedRevenueStats,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return {
          fixedRevenues: EMPTY_REVENUES,
          accounts: EMPTY_ACCOUNTS,
          stats: null as FixedRevenueStats | null,
        };
      }
    },
  });
  const fixedRevenues = pageData?.fixedRevenues ?? EMPTY_REVENUES;
  const accounts = pageData?.accounts ?? EMPTY_ACCOUNTS;
  const stats = pageData?.stats ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fixed-revenues'] });

  const openCreate = () => {
    setSelectedRevenue(undefined);
    setFormData({
      description: '',
      default_value: 0,
      category: 'salary',
      account: accounts[0]?.id ?? 0,
      due_day: 1,
      is_active: true,
      allow_value_edit: true,
      member: null,
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const openEdit = (item: FixedRevenue) => {
    setSelectedRevenue(item);
    setFormData({
      description: item.description,
      default_value: parseFloat(item.default_value),
      category: item.category,
      account: item.account,
      due_day: item.due_day,
      is_active: item.is_active,
      allow_value_edit: item.allow_value_edit,
      member: item.member ?? null,
      notes: item.notes ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (selectedRevenue) {
        await fixedRevenuesService.update(selectedRevenue.id, formData);
        toast({
          title: t('pages.fixedRevenues.updated'),
          description: t('pages.fixedRevenues.updatedDesc'),
        });
      } else {
        await fixedRevenuesService.create(formData);
        toast({
          title: t('pages.fixedRevenues.created'),
          description: t('pages.fixedRevenues.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.fixedRevenues.deleteTitle'),
      description: t('pages.fixedRevenues.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await fixedRevenuesService.delete(id);
      toast({
        title: t('pages.fixedRevenues.deleted'),
        description: t('pages.fixedRevenues.deletedDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const columns: Column<FixedRevenue>[] = [
    {
      key: 'description',
      label: t('pages.fixedRevenues.columns.description'),
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="bg-success/10 text-success flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
            {item.due_day}
          </div>
          <div>
            <div className="font-medium">{item.description}</div>
            <div className="text-muted-foreground text-xs">
              {t('pages.fixedRevenues.dueDayDesc', { day: item.due_day })}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'default_value',
      label: t('pages.fixedRevenues.columns.defaultAmount'),
      align: 'right',
      render: (item) => (
        <span className="text-success font-semibold">
          {formatCurrency(item.default_value)}
        </span>
      ),
    },
    {
      key: 'due_day',
      label: t('pages.fixedRevenues.columns.dueDay'),
      align: 'center',
      render: (item) => (
        <Badge variant="outline">
          {t('pages.fixedRevenues.dueDayBadge', { day: item.due_day })}
        </Badge>
      ),
    },
    {
      key: 'account_name',
      label: t('pages.fixedRevenues.columns.account'),
      render: (item) => <Badge variant="outline">{item.account_name || 'N/A'}</Badge>,
    },
    {
      key: 'category',
      label: t('pages.fixedRevenues.columns.category'),
      render: (item) => (
        <Badge variant="secondary">
          {translate('revenueCategories', item.category)}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: t('pages.fixedRevenues.columns.status'),
      render: (item) => (
        <Badge variant={item.is_active ? 'default' : 'secondary'}>
          {item.is_active
            ? t('pages.fixedRevenues.form.isActiveLabel')
            : t('pages.fixedRevenues.form.isInactiveLabel')}
        </Badge>
      ),
    },
    {
      key: 'total_generated',
      label: t('pages.fixedRevenues.columns.generated'),
      align: 'center',
      render: (item) => <span className="text-sm">{item.total_generated ?? 0}x</span>,
    },
  ];

  const activeRevenues = fixedRevenues.filter((r) => r.is_active);
  const totalMonthlyFixed = activeRevenues.reduce(
    (sum, r) => sum + parseFloat(r.default_value || '0'),
    0
  );

  return (
    <Wrapper embedded={embedded}>
      <PageHeader
        title={t('pages.fixedRevenues.title')}
        icon={<Calendar className="h-6 w-6" />}
        action={{
          label: t('pages.fixedRevenues.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: openCreate,
        }}
      />

      {/* 4 stat cards: modelos ativos | total mês | recebidas/pendentes | vs mês anterior */}
      {stats && (
        <div className="gap-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('pages.fixedRevenues.stats.activeModels')}
            value={stats.active_templates}
            icon={<Calendar className="h-5 w-5" />}
            variant="default"
          />
          <StatCard
            title={t('pages.fixedRevenues.stats.monthTotal')}
            value={formatCurrency(stats.current_month.total_amount)}
            icon={<DollarSign className="h-5 w-5" />}
            variant="success"
          />
          <StatCard
            title={t('pages.fixedRevenues.stats.receivedPending')}
            value={`${stats.current_month.received_count} / ${stats.current_month.pending_count}`}
            icon={<TrendingUp className="h-5 w-5" />}
            variant={stats.current_month.pending_count > 0 ? 'warning' : 'success'}
          />
          <StatCard
            title={t('pages.fixedRevenues.stats.vsPreviousMonth')}
            value={formatCurrency(
              Math.abs(
                stats.current_month.total_amount - stats.previous_month.total_amount
              )
            )}
            icon={
              stats.current_month.total_amount >= stats.previous_month.total_amount ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )
            }
            variant={
              stats.current_month.total_amount >= stats.previous_month.total_amount
                ? 'success'
                : 'warning'
            }
          />
        </div>
      )}

      {/* 3 cards horizontais: lançamento | comprometimento | calendário */}
      <div
        className={cn(
          'gap-md grid',
          activeRevenues.length > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'
        )}
      >
        {/* Card 1: Lançamento */}
        <div className="bg-card p-md flex flex-col justify-between rounded-lg border">
          <div>
            <h3 className="text-base font-semibold">
              {t('pages.fixedRevenues.launchSection')}
            </h3>
            <p className="mt-xs text-muted-foreground text-sm">
              {t('pages.fixedRevenues.launchDesc')}
            </p>
          </div>
          <Button
            onClick={() => setIsLaunchDialogOpen(true)}
            className="mt-md bg-success hover:bg-success/90 w-full"
          >
            <TrendingUp className="mr-sm h-4 w-4" />
            {t('pages.fixedRevenues.launchBtn')}
          </Button>
        </div>

        {activeRevenues.length > 0 && (
          <>
            {/* Card 2: Comprometimento */}
            <div className="bg-card p-md rounded-lg border">
              <p className="text-sm font-medium">
                {t('pages.fixedRevenues.stats.monthlyDesc')}
              </p>
              <p className="mt-xs text-success text-2xl font-bold">
                {formatCurrency(totalMonthlyFixed)}
              </p>
              <p className="mt-sm text-muted-foreground text-xs">
                {activeRevenues.length} {t('pages.fixedRevenues.stats.activeCount')}
              </p>
            </div>

            {/* Card 3: Calendário */}
            <div className="bg-card p-md rounded-lg border">
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                {t('pages.fixedRevenues.stats.scheduleTitle')}
              </p>
              <div className="gap-sm flex flex-wrap">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                  const revsOnDay = activeRevenues.filter((r) => r.due_day === day);
                  const hasRevenue = revsOnDay.length > 0;
                  return (
                    <div
                      key={day}
                      title={
                        hasRevenue
                          ? revsOnDay.map((r) => r.description).join(', ')
                          : undefined
                      }
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                        hasRevenue
                          ? 'bg-success/15 text-success ring-success/30 ring-1'
                          : 'text-muted-foreground'
                      )}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <DataTable
        data={fixedRevenues}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyState={{
          icon: <TrendingUp className="text-muted-foreground h-12 w-12" />,
          message: t('pages.fixedRevenues.emptyState'),
        }}
        rowClassName={(item) =>
          item.is_active
            ? 'border-l-4 border-l-success/50'
            : 'border-l-4 border-l-muted opacity-60'
        }
        actions={(item) => (
          <div className="gap-sm flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEdit(item)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleDelete(item.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedRevenue
                ? t('pages.fixedRevenues.editTitle')
                : t('pages.fixedRevenues.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedRevenue
                ? t('pages.fixedRevenues.editDesc')
                : t('pages.fixedRevenues.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-lg">
            {/* Seção: Informações Básicas */}
            <FormSection title={t('common.form.sections.basicInfo')} icon={Store}>
              <div className="space-y-sm">
                <Label htmlFor="description" className="gap-xs flex items-center">
                  <Store className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.fixedRevenues.form.descriptionLabel')}
                </Label>
                <Input
                  id="description"
                  required
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder={t('pages.fixedRevenues.form.descriptionPlaceholder')}
                />
              </div>
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <Tag className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.fixedRevenues.form.categoryLabel')}
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.actions.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_CATEGORIES_CANONICAL.map(({ key }) => {
                      const Icon = REVENUE_CATEGORY_ICONS[key];
                      return (
                        <SelectItem key={key} value={key}>
                          <span className="gap-sm flex items-center">
                            {Icon && (
                              <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
                            {translate('revenueCategories', key)}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </FormSection>

            {/* Seção: Valores & Vencimento */}
            <FormSection title={t('common.form.sections.values')} icon={Wallet}>
              <div className="gap-md grid grid-cols-2">
                <div className="space-y-sm">
                  <Label htmlFor="default_value" className="gap-xs flex items-center">
                    <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.fixedRevenues.form.defaultAmountLabel')}
                  </Label>
                  <CurrencyInput
                    id="default_value"
                    accentColor="success"
                    value={formData.default_value}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        default_value: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-sm">
                  <Label htmlFor="due_day" className="gap-xs flex items-center">
                    <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.fixedRevenues.form.dueDayLabel')}
                  </Label>
                  <Input
                    id="due_day"
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={formData.due_day}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        due_day: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
            </FormSection>

            {/* Seção: Conta */}
            <FormSection title={t('common.form.sections.paymentType')} icon={Wallet}>
              <div className="space-y-sm">
                <Label className="gap-xs flex items-center">
                  <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                  {t('pages.fixedRevenues.form.accountLabel')}
                </Label>
                <Select
                  value={formData.account ? String(formData.account) : ''}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, account: parseInt(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('pages.fixedRevenues.form.accountPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormSection>

            {/* Seção: Configuração */}
            <FormSection title={t('common.form.sections.paymentConfig')} icon={Tag}>
              <div className="space-y-md">
                <div className="space-y-sm">
                  <Label htmlFor="notes" className="gap-xs flex items-center">
                    <Tag className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.fixedRevenues.form.notesLabel')}
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes ?? ''}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, notes: e.target.value }))
                    }
                    placeholder={t('pages.fixedRevenues.form.notesPlaceholder')}
                    rows={3}
                  />
                </div>
                <div className="gap-sm flex items-center">
                  <Checkbox
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData((p) => ({ ...p, is_active: !!checked }))
                    }
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    {t('pages.fixedRevenues.form.isActiveLabel')}
                  </Label>
                </div>
                <div className="gap-sm flex items-center">
                  <Checkbox
                    id="allow_value_edit"
                    checked={formData.allow_value_edit}
                    onCheckedChange={(checked) =>
                      setFormData((p) => ({ ...p, allow_value_edit: !!checked }))
                    }
                  />
                  <Label htmlFor="allow_value_edit" className="cursor-pointer">
                    {t('pages.fixedRevenues.form.allowValueEditLabel')}
                  </Label>
                </div>
              </div>
            </FormSection>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t('common.actions.saving')
                  : selectedRevenue
                    ? t('common.actions.save')
                    : t('common.actions.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Launch Dialog */}
      <LaunchRevenuesDialog
        isOpen={isLaunchDialogOpen}
        onClose={() => setIsLaunchDialogOpen(false)}
        fixedRevenues={activeRevenues}
        onSuccess={refresh}
      />
    </Wrapper>
  );
}

interface LaunchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fixedRevenues: FixedRevenue[];
  onSuccess: () => void;
}

function LaunchRevenuesDialog({
  isOpen,
  onClose,
  fixedRevenues,
  onSuccess,
}: LaunchDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [revenueValues, setRevenueValues] = useState<Record<number, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);
  const [monthPart, yearPart] = selectedMonth.split('-');

  // Reinicia os valores/seleção sempre que o dialog abre (derivado durante o
  // render — sem efeito — comparando com a última transição de `isOpen`).
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  if (isOpen !== lastIsOpen) {
    setLastIsOpen(isOpen);
    if (isOpen) {
      const defaults: Record<number, number> = {};
      const ids = new Set<number>();
      fixedRevenues.forEach((r) => {
        defaults[r.id] = parseFloat(r.default_value);
        ids.add(r.id);
      });
      setRevenueValues(defaults);
      setSelectedIds(ids);
    }
  }

  const handleSubmit = async () => {
    if (!selectedMonth || selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      await fixedRevenuesService.bulkGenerate({
        month: selectedMonth,
        revenue_values: Array.from(selectedIds).map((id) => ({
          fixed_revenue_id: id,
          value: revenueValues[id] ?? 0,
        })),
      });
      toast({ title: t('pages.fixedRevenues.created') });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pages.fixedRevenues.launchBtn')}</DialogTitle>
          <DialogDescription>{t('pages.fixedRevenues.launchDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <div className="space-y-xs flex-1">
            <Label>{t('pages.fixedRevenues.form.monthLabel')}</Label>
            <Select
              value={monthPart}
              onValueChange={(m) => setSelectedMonth(`${yearPart}-${m}`)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m.value} value={m.value}>
                    {t(`pages.budgets.months.${i}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-xs w-28">
            <Label>{t('pages.fixedRevenues.form.yearLabel')}</Label>
            <Select
              value={yearPart}
              onValueChange={(y) => setSelectedMonth(`${y}-${monthPart}`)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto">
          {fixedRevenues.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <Checkbox
                id={`rev-${r.id}`}
                checked={selectedIds.has(r.id)}
                onCheckedChange={(checked) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(r.id);
                    else next.delete(r.id);
                    return next;
                  });
                }}
              />
              <Label htmlFor={`rev-${r.id}`} className="flex-1 cursor-pointer text-sm">
                {r.description}
                <span className="ml-xs text-muted-foreground text-xs">
                  (Dia {r.due_day})
                </span>
              </Label>
              {r.allow_value_edit ? (
                <Input
                  type="number"
                  step="0.01"
                  className="w-28"
                  value={revenueValues[r.id] ?? ''}
                  onChange={(e) =>
                    setRevenueValues((p) => ({
                      ...p,
                      [r.id]: parseFloat(e.target.value) || 0,
                    }))
                  }
                  disabled={!selectedIds.has(r.id)}
                />
              ) : (
                <span className="text-success w-28 text-right text-sm font-medium">
                  {formatCurrency(parseFloat(r.default_value))}
                </span>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || selectedIds.size === 0}
          >
            {isSubmitting
              ? t('common.actions.saving')
              : t('pages.fixedRevenues.launchBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
