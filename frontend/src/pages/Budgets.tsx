/* eslint-disable max-lines */
import {
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  Tag,
  Wallet,
  CalendarDays,
  RotateCcw,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_CONFIG } from '@/config/api-config';
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/categories';
import { translate } from '@/config/constants';
import { EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { budgetsService } from '@/services/budgets-service';
import type { Budget, BudgetFormData, BudgetStatus } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

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
  const MONTHS = useMemo(
    () =>
      (t('pages.budgets.months', { returnObjects: true }) as string[]).map(
        (label, i) => ({ value: i + 1, label })
      ),
    [t]
  );
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
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<{
      category: string;
      avg_monthly_spent: number;
      suggested_limit: number;
      reasoning: string | null;
    }>
  >([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);

  const handleSuggest = async () => {
    setIsSuggestOpen(true);
    if (suggestions.length > 0) return;
    try {
      setIsSuggestLoading(true);
      type SuggestResp = {
        suggestions?: {
          category: string;
          avg_monthly_spent: number;
          suggested_limit: number;
          reasoning: string | null;
        }[];
      };
      const resp = await apiClient.post<SuggestResp>(
        API_CONFIG.ENDPOINTS.BUDGET_SUGGEST,
        {
          include_llm_reasoning: true,
        }
      );
      setSuggestions(resp.suggestions ?? []);
    } catch {
      toast({
        title: 'Sem histórico suficiente para sugerir orçamentos.',
        variant: 'destructive',
      });
      setIsSuggestOpen(false);
    } finally {
      setIsSuggestLoading(false);
    }
  };

  const handleApplySuggestion = async (s: {
    category: string;
    suggested_limit: number;
  }) => {
    const now = new Date();
    try {
      await budgetsService.create({
        category: s.category,
        limit_amount: s.suggested_limit,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        member: null,
        rollover_enabled: false,
        rollover_amount: 0,
      });
      toast({
        title: `Orçamento de ${translate('expenseCategories', s.category)} criado.`,
      });
      void loadData();
    } catch {
      toast({ title: 'Erro ao criar orçamento.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <PageHeader title={t('pages.budgets.title')} icon={<PiggyBank />}>
        <Button
          variant="outline"
          onClick={() => void handleSuggest()}
          className="gap-sm"
        >
          <Sparkles className="h-4 w-4" />
          Sugerir com IA
        </Button>
        <Button onClick={handleCreate} className="gap-sm">
          <Plus className="h-4 w-4" />
          {t('pages.budgets.newBtn')}
        </Button>
      </PageHeader>

      {/* Dialog de sugestões LLM */}
      <Dialog open={isSuggestOpen} onOpenChange={setIsSuggestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestões de Orçamento com IA
            </DialogTitle>
            <DialogDescription>
              Baseado nos seus últimos 3 meses de despesas. Clique em
              &quot;Aplicar&quot; para criar o orçamento do mês atual.
            </DialogDescription>
          </DialogHeader>
          {isSuggestLoading ? (
            <div className="flex items-center justify-center gap-sm py-xl text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando histórico...
            </div>
          ) : (
            <div className="max-h-96 space-y-sm overflow-y-auto pr-xs">
              {suggestions.map((s) => (
                <div
                  key={s.category}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-xs text-sm font-medium">
                      {(() => {
                        const CatIcon =
                          EXPENSE_CATEGORY_ICONS[s.category] ??
                          EXPENSE_CATEGORY_ICONS['others'];
                        return CatIcon ? (
                          <CatIcon className="h-4 w-4 shrink-0" />
                        ) : null;
                      })()}
                      {translate('expenseCategories', s.category)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Média: {formatCurrency(s.avg_monthly_spent)} · Sugestão:{' '}
                      {formatCurrency(s.suggested_limit)}
                    </p>
                    {s.reasoning && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">
                        {s.reasoning}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleApplySuggestion(s)}
                  >
                    Aplicar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FilterBar hasActiveFilters={!!searchTerm} onClear={() => setSearchTerm('')}>
        <SearchInput
          placeholder={t('pages.budgets.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="w-44 flex-none"
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
      </FilterBar>

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
                <div className="rounded-lg border bg-card p-md">
                  <p className="mb-sm text-sm font-medium">
                    {t('pages.budgets.health.title')}
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
                  <div className="mt-sm flex gap-md text-xs text-muted-foreground">
                    <span>
                      <span className="font-semibold text-success">{okCount}</span>{' '}
                      {t('pages.budgets.health.withinLimit')}
                    </span>
                    <span>
                      <span className="font-semibold text-warning">{warningCount}</span>{' '}
                      {t('pages.budgets.health.warning')}
                    </span>
                    <span>
                      <span className="font-semibold text-destructive">
                        {exceededCount}
                      </span>{' '}
                      {t('pages.budgets.health.exceeded')}
                    </span>
                  </div>
                </div>

                <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
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
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-lg">
            {/* Seção: Classificação */}
            <FormSection title={t('common.form.sections.classification')} icon={Tag}>
              <div className="space-y-sm">
                <Label htmlFor="category" className="flex items-center gap-xs">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('common.fields.category')}
                </Label>
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
                    {EXPENSE_CATEGORIES_CANONICAL.map((cat) => {
                      const CatIcon = EXPENSE_CATEGORY_ICONS[cat.key];
                      return (
                        <SelectItem key={cat.key} value={cat.key}>
                          <span className="flex items-center gap-sm">
                            {CatIcon && <CatIcon className="h-4 w-4" />}
                            {translate('expenseCategories', cat.key)}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </FormSection>

            {/* Seção: Valores */}
            <FormSection title={t('common.form.sections.values')} icon={Wallet}>
              <div className="space-y-sm">
                <Label htmlFor="limit_amount" className="flex items-center gap-xs">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('pages.budgets.columns.limitAmount')}
                </Label>
                <CurrencyInput
                  id="limit_amount"
                  accentColor="destructive"
                  value={formData.limit_amount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limit_amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </FormSection>

            {/* Seção: Período */}
            <FormSection title={t('common.form.sections.schedule')} icon={CalendarDays}>
              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-sm">
                  <Label htmlFor="month" className="flex items-center gap-xs">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('pages.budgets.month')}
                  </Label>
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

                <div className="space-y-sm">
                  <Label htmlFor="year" className="flex items-center gap-xs">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('pages.budgets.year')}
                  </Label>
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
            </FormSection>

            {/* Seção: Rollover */}
            <FormSection title={t('pages.budgets.rollover.enabled')} icon={RotateCcw}>
              <div className="space-y-md">
                <div className="flex items-start gap-sm rounded-lg border border-border/60 bg-muted/20 p-sm">
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
                  <div className="space-y-sm">
                    <Label
                      htmlFor="rollover_amount"
                      className="flex items-center gap-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('pages.budgets.rollover.amount')}
                    </Label>
                    <CurrencyInput
                      id="rollover_amount"
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
  const months = t('pages.budgets.months', { returnObjects: true }) as string[];
  const monthLabel = months[budget.month - 1] ?? String(budget.month);
  const categoryLabel = translate('expenseCategories', budget.category);

  const pct = status ? status.percentage : 0;
  const actualSpent = status ? parseFloat(status.actual_spent) : null;
  const limitAmount = parseFloat(budget.limit_amount);

  const barColor =
    pct > 100 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';

  const CategoryIcon =
    EXPENSE_CATEGORY_ICONS[budget.category] ?? EXPENSE_CATEGORY_ICONS['others'];

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
      <div className="p-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
              {CategoryIcon && (
                <CategoryIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold leading-tight">{categoryLabel}</p>
              <p className="text-xs text-muted-foreground">
                {monthLabel}/{budget.year}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-xs">
            {status && (
              <span
                className={cn(
                  'rounded px-sm py-0.5 text-xs font-bold',
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
          <div className="mt-3 space-y-xs">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(actualSpent ?? 0)}</span>
              <span>
                {t('pages.budgets.ofLimit', { value: formatCurrency(limitAmount) })}
              </span>
            </div>
          </div>
        )}

        {!status && (
          <div className="mt-3 space-y-xs text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('pages.budgets.limit')}</span>
              <span className="font-medium">{formatCurrency(budget.limit_amount)}</span>
            </div>
          </div>
        )}

        {budget.rollover_enabled && parseFloat(budget.rollover_amount) > 0 && (
          <div className="mt-sm flex items-center gap-xs text-xs text-info">
            <span>↩</span>
            <span>Rollover: {formatCurrency(parseFloat(budget.rollover_amount))}</span>
          </div>
        )}

        {budget.member_name && (
          <p className="mt-xs text-xs text-muted-foreground">
            {t('pages.budgets.member')}: {budget.member_name}
          </p>
        )}

        <div className="mt-3 flex gap-sm border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(budget)}
          >
            <Pencil className="mr-xs h-3 w-3" />
            {t('common.actions.edit')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => void onDelete(budget)}
          >
            <Trash2 className="mr-xs h-3 w-3" />
            {t('common.actions.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
