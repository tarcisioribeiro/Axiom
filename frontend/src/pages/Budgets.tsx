import { PiggyBank, Plus, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/categories';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { budgetsService } from '@/services/budgets-service';
import type { Budget, BudgetFormData, BudgetStatus } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const CATEGORY_ICONS: Record<string, string> = {
  'food and drink': '🍽️',
  supermarket: '🛒',
  transport: '🚗',
  'bills and services': '⚡',
  entertainment: '🎬',
  education: '📚',
  health: '❤️',
  'health and care': '❤️',
  house: '🏠',
  vestuary: '👔',
  travels: '✈️',
  investments: '📈',
  others: '📦',
};

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

function getDefaultFormData(): BudgetFormData {
  const now = new Date();
  return {
    category: 'others',
    limit_amount: 0,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    member: null,
    rollover_enabled: false,
    rollover_amount: 0,
  };
}

export default function Budgets() {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>(
    String(new Date().getMonth() + 1)
  );
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const [formData, setFormData] = useState<BudgetFormData>(getDefaultFormData());
  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [data, statuses] = await Promise.all([
        budgetsService.getAll(),
        budgetsService.getStatus().catch(() => [] as BudgetStatus[]),
      ]);
      setBudgets(Array.isArray(data) ? data : []);
      setBudgetStatuses(Array.isArray(statuses) ? statuses : []);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      setBudgets([]);
      setBudgetStatuses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedBudget(undefined);
    setFormData(getDefaultFormData());
    setIsDialogOpen(true);
  };

  const handleEdit = (budget: Budget) => {
    setSelectedBudget(budget);
    setFormData({
      category: budget.category,
      limit_amount: parseFloat(budget.limit_amount),
      month: budget.month,
      year: budget.year,
      member: budget.member,
      rollover_enabled: budget.rollover_enabled,
      rollover_amount: parseFloat(budget.rollover_amount),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (budget: Budget) => {
    const categoryLabel = translate('expenseCategories', budget.category);
    const monthLabel =
      MONTHS.find((m) => m.value === budget.month)?.label ?? budget.month;

    const confirmed = await showConfirm({
      title: t('pages.budgets.deleteTitle'),
      description: `Tem certeza que deseja excluir o orçamento de "${categoryLabel}" para ${monthLabel}/${budget.year}?`,
    });

    if (confirmed) {
      try {
        await budgetsService.delete(budget.id);
        toast({
          title: t('pages.budgets.deleted'),
          description: t('pages.budgets.deletedDesc'),
        });
        void loadData();
      } catch (error: unknown) {
        toast({
          title: t('common.messages.deleteError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedBudget) {
        await budgetsService.update(selectedBudget.id, formData);
        toast({
          title: t('pages.budgets.updated'),
          description: t('pages.budgets.updatedDesc'),
        });
      } else {
        await budgetsService.create(formData);
        toast({
          title: t('pages.budgets.created'),
          description: t('pages.budgets.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
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

  const filteredBudgets = budgets.filter((budget) => {
    const categoryLabel = translate('expenseCategories', budget.category).toLowerCase();
    const matchesSearch =
      !searchTerm ||
      categoryLabel.includes(searchTerm.toLowerCase()) ||
      budget.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = !filterMonth || budget.month === parseInt(filterMonth);
    const matchesYear = !filterYear || budget.year === parseInt(filterYear);
    return matchesSearch && matchesMonth && matchesYear;
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.budgets.title')}
        icon={<PiggyBank />}
        action={{
          label: t('pages.budgets.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex flex-wrap gap-4">
        <SearchInput
          placeholder={t('pages.budgets.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-xs"
        />
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('pages.budgets.month')} />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={String(m.value)}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder={t('pages.budgets.year')} />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredBudgets.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm ? t('pages.budgets.emptySearch') : t('pages.budgets.emptyState')
          }
        />
      ) : (
        <>
          {(() => {
            const statusMap = new Map(
              budgetStatuses.map((s) => [`${s.month}-${s.year}-${s.category}`, s])
            );
            const enriched = filteredBudgets.map((b) => ({
              budget: b,
              status: statusMap.get(`${b.month}-${b.year}-${b.category}`),
            }));
            const exceededCount = enriched.filter(({ status }) => {
              const pct = status ? status.percentage : 0;
              return pct > 100;
            }).length;
            const warningCount = enriched.filter(({ status }) => {
              const pct = status ? status.percentage : 0;
              return pct >= 70 && pct <= 100;
            }).length;
            const okCount = filteredBudgets.length - exceededCount - warningCount;
            return (
              <>
                <div className="rounded-lg border bg-card p-4">
                  <p className="mb-2 text-sm font-medium">
                    Saúde dos orçamentos este mês
                  </p>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    {exceededCount > 0 && (
                      <div
                        className="bg-destructive"
                        style={{
                          width: `${(exceededCount / filteredBudgets.length) * 100}%`,
                        }}
                      />
                    )}
                    {warningCount > 0 && (
                      <div
                        className="bg-warning"
                        style={{
                          width: `${(warningCount / filteredBudgets.length) * 100}%`,
                        }}
                      />
                    )}
                    {okCount > 0 && (
                      <div
                        className="bg-success"
                        style={{
                          width: `${(okCount / filteredBudgets.length) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>
                      <span className="font-semibold text-success">{okCount}</span>{' '}
                      dentro do limite
                    </span>
                    <span>
                      <span className="font-semibold text-warning">{warningCount}</span>{' '}
                      em alerta
                    </span>
                    <span>
                      <span className="font-semibold text-destructive">
                        {exceededCount}
                      </span>{' '}
                      excedidos
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {enriched.map(({ budget, status }) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      status={status}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </>
            );
          })()}
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedBudget
                ? t('pages.budgets.editTitle')
                : t('pages.budgets.newTitle')}
            </DialogTitle>
            <DialogDescription>{t('pages.budgets.formDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">{t('common.fields.category')}</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder={t('common.fields.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES_CANONICAL.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit_amount">
                {t('pages.budgets.columns.limitAmount')}
              </Label>
              <Input
                id="limit_amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.limit_amount || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    limit_amount: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">{t('pages.budgets.month')}</Label>
                <Select
                  value={String(formData.month)}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, month: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">{t('pages.budgets.year')}</Label>
                <Select
                  value={String(formData.year)}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, year: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="rollover_enabled"
                checked={formData.rollover_enabled ?? false}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, rollover_enabled: !!checked }))
                }
                className="mt-0.5"
              />
              <div>
                <Label
                  htmlFor="rollover_enabled"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t('pages.budgets.rollover.enabled')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('pages.budgets.rollover.description')}
                </p>
              </div>
            </div>

            {formData.rollover_enabled && (
              <div className="space-y-2">
                <Label htmlFor="rollover_amount">
                  {t('pages.budgets.rollover.amount')}
                </Label>
                <Input
                  id="rollover_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rollover_amount ?? 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      rollover_amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            )}

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
                  : selectedBudget
                    ? t('common.actions.save')
                    : t('common.actions.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function BudgetCard({
  budget,
  status,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  status?: BudgetStatus;
  onEdit: (b: Budget) => void;
  onDelete: (b: Budget) => Promise<void>;
}) {
  const { t } = useTranslation();
  const monthLabel =
    MONTHS.find((m) => m.value === budget.month)?.label ?? String(budget.month);
  const categoryLabel = translate('expenseCategories', budget.category);

  const pct = status ? status.percentage : 0;
  const actualSpent = status ? parseFloat(status.actual_spent) : null;
  const limitAmount = parseFloat(budget.limit_amount);

  const barColor =
    pct > 100 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';

  const categoryIcon = CATEGORY_ICONS[budget.category] ?? '📦';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border-l-4 bg-card transition-shadow hover:shadow-md',
        pct > 100
          ? 'border-l-destructive shadow-sm shadow-destructive/20'
          : pct >= 70
            ? 'border-l-warning'
            : 'border-l-success'
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-hidden="true">
              {categoryIcon}
            </span>
            <div>
              <p className="font-semibold leading-tight">{categoryLabel}</p>
              <p className="text-xs text-muted-foreground">
                {monthLabel}/{budget.year}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {status && (
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-bold',
                  pct > 100
                    ? 'bg-destructive/10 text-destructive'
                    : pct >= 70
                      ? 'bg-warning/10 text-warning'
                      : 'bg-success/10 text-success'
                )}
              >
                {pct.toFixed(0)}%
              </span>
            )}
            {!status && (
              <Badge variant="outline">{t('pages.budgets.badgeLabel')}</Badge>
            )}
          </div>
        </div>

        {status && (
          <div className="mt-3 space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(actualSpent ?? 0)}</span>
              <span>de {formatCurrency(limitAmount)}</span>
            </div>
          </div>
        )}

        {!status && (
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('pages.budgets.limit')}</span>
              <span className="font-medium">{formatCurrency(budget.limit_amount)}</span>
            </div>
          </div>
        )}

        {budget.rollover_enabled && parseFloat(budget.rollover_amount) > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-info">
            <span>↩</span>
            <span>Rollover: {formatCurrency(parseFloat(budget.rollover_amount))}</span>
          </div>
        )}

        {budget.member_name && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('pages.budgets.member')}: {budget.member_name}
          </p>
        )}

        <div className="mt-3 flex gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(budget)}
          >
            <Pencil className="mr-1 h-3 w-3" />
            {t('common.actions.edit')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => void onDelete(budget)}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {t('common.actions.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
