/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Trash2,
  TrendingUp,
  Store,
  Tag,
  Wallet,
  CalendarDays,
  History,
  Loader2,
  Save,
  X,
  CircleDot,
} from 'lucide-react';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { PageContainer } from '@/components/common/PageContainer';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { LaunchRevenuesDialog } from '@/components/revenues/LaunchRevenuesDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusToggle } from '@/components/ui/status-toggle';
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  isRevenueCategoryAllowed,
  REVENUE_CATEGORIES_CANONICAL,
  translate,
} from '@/config/constants';
import { REVENUE_CATEGORY_ICONS, TASK_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { fixedRevenuesService } from '@/services/fixed-revenues-service';
import { revenuesService } from '@/services/revenues-service';
import type { FixedRevenue, FixedRevenueFormData, Account, Revenue } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const EMPTY_REVENUES: FixedRevenue[] = [];
const EMPTY_ACCOUNTS: Account[] = [];

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function FixedRevenues({
  embedded = false,
  newRevenueRef,
  launchRevenuesRef,
}: {
  embedded?: boolean;
  newRevenueRef?: RefObject<(() => void) | undefined>;
  launchRevenuesRef?: RefObject<(() => void) | undefined>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<FixedRevenue | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyItem, setHistoryItem] = useState<FixedRevenue | null>(null);
  const [historyRevenues, setHistoryRevenues] = useState<Revenue[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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

  useEffect(() => {
    if (newRevenueRef) newRevenueRef.current = openCreate;
    if (launchRevenuesRef)
      launchRevenuesRef.current = () => setIsLaunchDialogOpen(true);
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['fixed-revenues'],
    queryFn: async () => {
      try {
        const [revenuesData, accountsData] = await Promise.all([
          fixedRevenuesService.getAll(),
          accountsService.getAll(),
        ]);
        const revenues: FixedRevenue[] = Array.isArray(revenuesData)
          ? (revenuesData as FixedRevenue[])
          : (revenuesData.results ?? []);
        return {
          fixedRevenues: revenues,
          accounts: accountsData,
        };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
          variant: 'destructive',
        });
        return {
          fixedRevenues: EMPTY_REVENUES,
          accounts: EMPTY_ACCOUNTS,
        };
      }
    },
  });
  const fixedRevenues = pageData?.fixedRevenues ?? EMPTY_REVENUES;
  const accounts = pageData?.accounts ?? EMPTY_ACCOUNTS;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fixed-revenues'] });

  const openHistory = async (item: FixedRevenue) => {
    setHistoryItem(item);
    setHistoryRevenues([]);
    setHistoryLoading(true);
    try {
      const results = await revenuesService.getAll({ fixed_revenue_template: item.id });
      setHistoryRevenues(Array.isArray(results) ? results : []);
    } catch {
      setHistoryRevenues([]);
    } finally {
      setHistoryLoading(false);
    }
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
        });
      } else {
        await fixedRevenuesService.create(formData);
        toast({
          title: t('pages.fixedRevenues.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const columns: Column<FixedRevenue>[] = [
    {
      key: 'description',
      label: t('pages.fixedRevenues.columns.description'),
      render: (item) => <span className="font-medium">{item.description}</span>,
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
      render: (item) => {
        const StatusIcon = TASK_STATUS_ICONS[item.is_active ? 'active' : 'inactive'];
        return (
          <Badge variant={item.is_active ? 'default' : 'secondary'} className="gap-xs">
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {item.is_active
              ? t('pages.fixedRevenues.form.isActiveLabel')
              : t('pages.fixedRevenues.form.isInactiveLabel')}
          </Badge>
        );
      },
    },
  ];

  const activeRevenues = fixedRevenues.filter((r) => r.is_active);

  const filteredRevenues = fixedRevenues.filter((item) => {
    if (
      searchTerm &&
      !item.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (accountFilter !== 'all' && String(item.account) !== accountFilter) return false;
    if (statusFilter !== 'all' && (statusFilter === 'active') !== item.is_active)
      return false;
    return true;
  });

  const hasActiveFilters =
    searchTerm !== '' ||
    categoryFilter !== 'all' ||
    accountFilter !== 'all' ||
    statusFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setAccountFilter('all');
    setStatusFilter('all');
  };

  return (
    <Wrapper embedded={embedded}>
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        activeFilters={[
          ...(categoryFilter !== 'all'
            ? [
                {
                  key: 'category',
                  label: `${t('pages.fixedRevenues.allCategories')}: ${REVENUE_CATEGORIES_CANONICAL.find((c) => c.key === categoryFilter)?.label ?? categoryFilter}`,
                  onRemove: () => setCategoryFilter('all'),
                },
              ]
            : []),
          ...(accountFilter !== 'all'
            ? [
                {
                  key: 'account',
                  label: `${t('pages.fixedRevenues.allAccounts')}: ${accounts.find((a) => String(a.id) === accountFilter)?.account_name ?? accountFilter}`,
                  onRemove: () => setAccountFilter('all'),
                },
              ]
            : []),
          ...(statusFilter !== 'all'
            ? [
                {
                  key: 'status',
                  label: `${t('common.fields.status')}: ${statusFilter === 'active' ? t('common.status.active') : t('common.status.inactive')}`,
                  onRemove: () => setStatusFilter('all'),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')}>
          <SearchInput
            placeholder={t('pages.fixedRevenues.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-44"
          />
        </FilterField>
        <FilterField label={t('common.fields.category')}>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.fixedRevenues.allCategories')}
              startIcon={<Tag className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.fixedRevenues.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.fixedRevenues.allCategories')}
              </SelectItem>
              {REVENUE_CATEGORIES_CANONICAL.map(({ key, label }) => {
                const Icon = REVENUE_CATEGORY_ICONS[key];
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
        <FilterField label={t('common.fields.account')}>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger
              className="w-40"
              aria-label={t('pages.fixedRevenues.allAccounts')}
              startIcon={<Wallet className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.fixedRevenues.allAccounts')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.fixedRevenues.allAccounts')}
              </SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.fields.status')}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-36"
              aria-label={t('pages.fixedRevenues.allStatus')}
              startIcon={<CircleDot className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.fixedRevenues.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.fixedRevenues.allStatus')}</SelectItem>
              <SelectItem
                value="active"
                icon={<TASK_STATUS_ICONS.active className="h-4 w-4" />}
              >
                {t('common.status.active')}
              </SelectItem>
              <SelectItem
                value="inactive"
                icon={<TASK_STATUS_ICONS.inactive className="h-4 w-4" />}
              >
                {t('common.status.inactive')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {/* Table */}
      <DataTable
        centerList
        pageSize={LIST_PAGE_SIZE}
        data={filteredRevenues}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyState={{
          icon: <TrendingUp className="text-muted-foreground h-12 w-12" />,
          title: t('pages.fixedRevenues.emptyState'),
        }}
        rowClassName={(item) => (item.is_active ? '' : 'opacity-60')}
        actions={(item) => (
          <div className="gap-sm flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void openHistory(item)}
              aria-label={t('pages.fixedRevenues.historyBtn')}
              title={t('pages.fixedRevenues.historyBtn')}
            >
              <History className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            </Button>
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
            <DialogTitle mode={selectedRevenue ? 'edit' : 'create'}>
              {selectedRevenue
                ? t('pages.fixedRevenues.editTitle')
                : t('pages.fixedRevenues.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedRevenue
                  ? t('pages.fixedRevenues.editDesc')
                  : t('pages.fixedRevenues.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
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
                    {REVENUE_CATEGORIES_CANONICAL.filter(({ key }) =>
                      isRevenueCategoryAllowed(
                        key,
                        accounts.find((a) => a.id === formData.account)?.account_type
                      )
                    ).map(({ key }) => {
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
                <div className="space-y-sm flex flex-col items-center">
                  <Label
                    htmlFor="due_day"
                    className="gap-xs flex items-center justify-center"
                  >
                    <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.fixedRevenues.form.dueDayLabel')}
                  </Label>
                  <NumberStepper
                    id="due_day"
                    min={1}
                    max={31}
                    value={formData.due_day}
                    onChange={(v) => setFormData((p) => ({ ...p, due_day: v ?? 1 }))}
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
              <div className="gap-md grid grid-cols-1 items-start md:grid-cols-2">
                <div className="space-y-sm md:order-last md:col-span-2">
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
                    rows={1}
                  />
                </div>

                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <Tag className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.fixedRevenues.form.isActiveLabel')}
                  </Label>
                  <StatusToggle
                    value={formData.is_active ? 'true' : 'false'}
                    options={[
                      {
                        value: 'true',
                        label: t('common.status.active'),
                        accentColor: 'success',
                      },
                      { value: 'false', label: t('common.status.inactive') },
                    ]}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, is_active: v === 'true' }))
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <Tag className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.fixedRevenues.form.allowValueEditLabel')}
                  </Label>
                  <StatusToggle
                    value={formData.allow_value_edit ? 'true' : 'false'}
                    options={[
                      { value: 'true', label: t('common.actions.yes') },
                      { value: 'false', label: t('common.actions.no') },
                    ]}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, allow_value_edit: v === 'true' }))
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </FormSection>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                <X className="h-4 w-4" />
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
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

      {/* History Dialog */}
      <Dialog
        open={!!historyItem}
        onOpenChange={(v) => {
          if (!v) setHistoryItem(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <History className="h-4 w-4" />
              {t('pages.fixedRevenues.historyTitle')}: {historyItem?.description}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.fixedRevenues.historyDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {historyLoading ? (
            <p className="py-md text-muted-foreground text-center text-sm">
              {t('common.actions.loading')}
            </p>
          ) : historyRevenues.length === 0 ? (
            <p className="py-md text-muted-foreground text-center text-sm">
              {t('pages.fixedRevenues.historyEmpty')}
            </p>
          ) : (
            <PaginatedSlide items={historyRevenues} pageSize={5} pinNav={false}>
              {(pageItems) => (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                      <th className="pb-xs pr-md">{t('common.fields.date')}</th>
                      <th className="pb-xs pr-md">{t('common.fields.description')}</th>
                      <th className="pb-xs text-right">{t('common.fields.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pageItems.map((rev) => (
                      <tr key={rev.id}>
                        <td className="py-xs pr-md text-muted-foreground">
                          {formatDate(rev.date)}
                        </td>
                        <td className="py-xs pr-md">{rev.description}</td>
                        <td
                          className={cn(
                            'py-xs text-right font-medium',
                            rev.received ? 'text-success' : 'text-muted-foreground'
                          )}
                        >
                          {formatCurrency(rev.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </PaginatedSlide>
          )}
          <DialogCloseFooter />
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
