/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/categories';
import { API_CONFIG } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtraItem {
  description: string;
  value: string;
  category: string;
}

interface PlanPayload {
  extra_revenues: ExtraItem[];
  extra_expenses: ExtraItem[];
  budget_overrides: Record<string, string>;
  fixed_revenue_overrides: Record<string, FixedItemOverride>;
  fixed_expense_overrides: Record<string, FixedItemOverride>;
}

interface MonthlyPlan {
  id: number;
  month: number;
  year: number;
  extra_revenues: ExtraItem[];
  extra_expenses: ExtraItem[];
  budget_overrides: Record<string, string>;
  fixed_revenue_overrides: Record<string, FixedItemOverride>;
  fixed_expense_overrides: Record<string, FixedItemOverride>;
  applied_at: string | null;
}

interface FixedRevenueItem {
  id: number;
  description: string;
  default_value: string;
  category: string;
  due_day: number;
  account_name: string;
  allow_value_edit: boolean;
}

interface FixedExpenseItem {
  id: number;
  description: string;
  default_value: string;
  category: string;
  due_day: number;
  account_name: string;
  credit_card_name: string;
  allow_value_edit: boolean;
}

interface FixedItemOverride {
  enabled: boolean;
  value: string | null;
}

interface CreditCardBillItem {
  id: number;
  credit_card_name: string;
  total_amount: string;
  due_date: string | null;
  status: string;
}

interface BudgetSuggestion {
  category: string;
  avg_monthly_spent: number;
  suggested_limit: number;
}

interface ExistingBudget {
  id: number;
  category: string;
  limit_amount: string;
}

interface MonthlyPlanSummary {
  plan: MonthlyPlan;
  fixed_revenues: FixedRevenueItem[];
  fixed_expenses: FixedExpenseItem[];
  credit_card_bills: CreditCardBillItem[];
  existing_budgets: ExistingBudget[];
  budget_suggestions: BudgetSuggestion[];
  actual: { revenues: string; expenses: string };
  total_overdraft_limit: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function sumValues(items: Array<{ value?: string; default_value?: string }>): number {
  return items.reduce((acc, item) => {
    const v = parseFloat(item.value ?? item.default_value ?? '0');
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
}

function categoryLabel(key: string): string {
  const found = EXPENSE_CATEGORIES_CANONICAL.find((c) => c.key === key);
  return found ? found.label : key;
}

function formatDueDate(isoDate: string | null | undefined): string | undefined {
  if (!isoDate) return undefined;
  const [, month, day] = isoDate.split('-');
  return `Vence ${day}/${month}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  total,
  children,
}: {
  title: string;
  icon: React.ElementType;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
          <span className="text-sm font-semibold">{formatCurrency(total)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-xs">{children}</CardContent>
    </Card>
  );
}

function FixedItem({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-sm py-xs text-sm">
      <div>
        <span className="font-medium">{label}</span>
        {sub && <span className="ml-xs text-xs text-muted-foreground">{sub}</span>}
      </div>
      <span className="text-muted-foreground">{formatCurrency(value)}</span>
    </div>
  );
}

function EditableFixedItem({
  id,
  label,
  defaultValue,
  sub,
  override,
  onToggle,
  onValueChange,
}: {
  id: number;
  label: string;
  defaultValue: string;
  sub?: string;
  override?: FixedItemOverride;
  onToggle: (id: number, enabled: boolean) => void;
  onValueChange: (id: number, value: string) => void;
}) {
  const enabled = override?.enabled !== false;
  const displayValue = override?.value ?? defaultValue;

  return (
    <div
      className={cn(
        'flex items-center gap-sm rounded-lg bg-muted/40 px-sm py-xs text-sm transition-opacity',
        !enabled && 'opacity-40'
      )}
    >
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggle(id, !!checked)}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        {sub && <span className="ml-xs text-xs text-muted-foreground">{sub}</span>}
      </div>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={displayValue}
        onChange={(e) => onValueChange(id, e.target.value)}
        disabled={!enabled}
        className="h-7 w-28 shrink-0 text-right text-sm"
      />
    </div>
  );
}

function ExtraItemRow({
  item,
  index,
  onChange,
  onRemove,
  removeLabel,
}: {
  item: ExtraItem;
  index: number;
  onChange: (idx: number, field: keyof ExtraItem, val: string) => void;
  onRemove: (idx: number) => void;
  removeLabel: string;
}) {
  return (
    <div className="flex items-center gap-xs">
      <Input
        value={item.description}
        onChange={(e) => onChange(index, 'description', e.target.value)}
        placeholder="Descrição"
        className="h-8 flex-1 text-sm"
      />
      <Input
        value={item.value}
        onChange={(e) => onChange(index, 'value', e.target.value)}
        placeholder="0,00"
        type="number"
        min="0"
        step="0.01"
        className="h-8 w-28 text-sm"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(index)}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        aria-label={removeLabel}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyPlanner() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { showConfirm } = useAlertDialog();
  const { toast } = useToast();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [extraRevenues, setExtraRevenues] = useState<ExtraItem[]>([]);
  const [extraExpenses, setExtraExpenses] = useState<ExtraItem[]>([]);
  const [budgetOverrides, setBudgetOverrides] = useState<Record<string, string>>({});
  const [fixedRevenueOverrides, setFixedRevenueOverrides] = useState<
    Record<string, FixedItemOverride>
  >({});
  const [fixedExpenseOverrides, setFixedExpenseOverrides] = useState<
    Record<string, FixedItemOverride>
  >({});
  // Track which month/year combo has been initialized to avoid resetting on refetch
  const [initializedKey, setInitializedKey] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monthNames = i18n.language.startsWith('pt') ? MONTH_NAMES_PT : MONTH_NAMES_EN;

  const summaryQuery = useQuery({
    queryKey: ['monthlyPlan', month, year],
    queryFn: () =>
      apiClient.get<MonthlyPlanSummary>(API_CONFIG.ENDPOINTS.MONTHLY_PLAN_SUMMARY, {
        month,
        year,
      }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  // Derived state: initialize local edits when a new month/year loads (not on refetch)
  const currentKey = `${month}-${year}`;
  if (summaryQuery.data && initializedKey !== currentKey) {
    const { plan } = summaryQuery.data;
    setInitializedKey(currentKey);
    setExtraRevenues(plan.extra_revenues ?? []);
    setExtraExpenses(plan.extra_expenses ?? []);
    setBudgetOverrides(plan.budget_overrides ?? {});
    setFixedRevenueOverrides(plan.fixed_revenue_overrides ?? {});
    setFixedExpenseOverrides(plan.fixed_expense_overrides ?? {});
  }

  // planId is derived from query data (stable once loaded for a month/year)
  const planId = summaryQuery.data?.plan.id ?? null;

  const saveMutation = useMutation({
    mutationFn: (data: { id: number; payload: PlanPayload }) =>
      apiClient.patch(`${API_CONFIG.ENDPOINTS.MONTHLY_PLAN}${data.id}/`, data.payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monthlyPlan', month, year] });
    },
  });

  // scheduleSave takes id as argument to avoid stale closures in the debounce
  const scheduleSave = useCallback(
    (id: number, payload: PlanPayload) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveMutation.mutate({ id, payload });
      }, 800);
    },
    [saveMutation]
  );

  const applyMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.post(`${API_CONFIG.ENDPOINTS.MONTHLY_PLAN}${id}/apply/`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monthlyPlan', month, year] });
      toast({ title: t('monthlyPlanner.applySuccess') });
    },
    onError: () => {
      toast({ title: t('monthlyPlanner.applyError'), variant: 'destructive' });
    },
  });

  const handleApply = async () => {
    if (!planId) return;
    const monthName = monthNames[month - 1];
    const confirmed = await showConfirm({
      title: t('monthlyPlanner.applyConfirmTitle'),
      description: t('monthlyPlanner.applyConfirmDescription', {
        month: `${monthName} ${year}`,
      }),
      variant: 'warning',
    });
    if (confirmed) applyMutation.mutate(planId);
  };

  const navigateMonth = (delta: number) => {
    setMonth((prev) => {
      const next = prev + delta;
      if (next < 1) {
        setYear((y) => y - 1);
        return 12;
      }
      if (next > 12) {
        setYear((y) => y + 1);
        return 1;
      }
      return next;
    });
  };

  const buildPayload = (overrides?: Partial<PlanPayload>): PlanPayload => ({
    extra_revenues: extraRevenues,
    extra_expenses: extraExpenses,
    budget_overrides: budgetOverrides,
    fixed_revenue_overrides: fixedRevenueOverrides,
    fixed_expense_overrides: fixedExpenseOverrides,
    ...overrides,
  });

  const addExtraRevenue = () => {
    if (!planId) return;
    const updated = [
      ...extraRevenues,
      { description: '', value: '', category: 'income' },
    ];
    setExtraRevenues(updated);
    scheduleSave(planId, buildPayload({ extra_revenues: updated }));
  };

  const updateExtraRevenue = (idx: number, field: keyof ExtraItem, val: string) => {
    if (!planId) return;
    const updated = extraRevenues.map((r, i) =>
      i === idx ? { ...r, [field]: val } : r
    );
    setExtraRevenues(updated);
    scheduleSave(planId, buildPayload({ extra_revenues: updated }));
  };

  const removeExtraRevenue = (idx: number) => {
    if (!planId) return;
    const updated = extraRevenues.filter((_, i) => i !== idx);
    setExtraRevenues(updated);
    scheduleSave(planId, buildPayload({ extra_revenues: updated }));
  };

  const addExtraExpense = () => {
    if (!planId) return;
    const updated = [
      ...extraExpenses,
      { description: '', value: '', category: 'others' },
    ];
    setExtraExpenses(updated);
    scheduleSave(planId, buildPayload({ extra_expenses: updated }));
  };

  const updateExtraExpense = (idx: number, field: keyof ExtraItem, val: string) => {
    if (!planId) return;
    const updated = extraExpenses.map((e, i) =>
      i === idx ? { ...e, [field]: val } : e
    );
    setExtraExpenses(updated);
    scheduleSave(planId, buildPayload({ extra_expenses: updated }));
  };

  const removeExtraExpense = (idx: number) => {
    if (!planId) return;
    const updated = extraExpenses.filter((_, i) => i !== idx);
    setExtraExpenses(updated);
    scheduleSave(planId, buildPayload({ extra_expenses: updated }));
  };

  const updateBudgetOverride = (category: string, value: string) => {
    if (!planId) return;
    const updated = { ...budgetOverrides, [category]: value };
    setBudgetOverrides(updated);
    scheduleSave(planId, buildPayload({ budget_overrides: updated }));
  };

  const toggleFixedRevenue = (id: number, enabled: boolean) => {
    if (!planId) return;
    const updated = {
      ...fixedRevenueOverrides,
      [String(id)]: { ...fixedRevenueOverrides[String(id)], enabled },
    };
    setFixedRevenueOverrides(updated);
    scheduleSave(planId, buildPayload({ fixed_revenue_overrides: updated }));
  };

  const updateFixedRevenueValue = (id: number, value: string) => {
    if (!planId) return;
    const updated = {
      ...fixedRevenueOverrides,
      [String(id)]: {
        enabled: fixedRevenueOverrides[String(id)]?.enabled ?? true,
        value,
      },
    };
    setFixedRevenueOverrides(updated);
    scheduleSave(planId, buildPayload({ fixed_revenue_overrides: updated }));
  };

  const toggleFixedExpense = (id: number, enabled: boolean) => {
    if (!planId) return;
    const updated = {
      ...fixedExpenseOverrides,
      [String(id)]: { ...fixedExpenseOverrides[String(id)], enabled },
    };
    setFixedExpenseOverrides(updated);
    scheduleSave(planId, buildPayload({ fixed_expense_overrides: updated }));
  };

  const updateFixedExpenseValue = (id: number, value: string) => {
    if (!planId) return;
    const updated = {
      ...fixedExpenseOverrides,
      [String(id)]: {
        enabled: fixedExpenseOverrides[String(id)]?.enabled ?? true,
        value,
      },
    };
    setFixedExpenseOverrides(updated);
    scheduleSave(planId, buildPayload({ fixed_expense_overrides: updated }));
  };

  if (summaryQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  const data = summaryQuery.data;
  const isApplied = Boolean(data?.plan.applied_at);

  const totalFixed = (data?.fixed_revenues ?? []).reduce((acc, r) => {
    const ov = fixedRevenueOverrides[String(r.id)];
    if (ov?.enabled === false) return acc;
    const v = parseFloat(ov?.value ?? r.default_value ?? '0');
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const totalExtra = sumValues(extraRevenues);
  const totalRevenues = totalFixed + totalExtra;

  const allCategories = [
    ...new Set([
      ...(data?.budget_suggestions.map((s) => s.category) ?? []),
      ...(data?.existing_budgets.map((b) => b.category) ?? []),
    ]),
  ];

  const budgetSuggestionMap = Object.fromEntries(
    (data?.budget_suggestions ?? []).map((s) => [s.category, s.suggested_limit])
  );
  const existingBudgetMap = Object.fromEntries(
    (data?.existing_budgets ?? []).map((b) => [b.category, b.limit_amount])
  );

  const totalFixedExp = (data?.fixed_expenses ?? []).reduce((acc, e) => {
    const ov = fixedExpenseOverrides[String(e.id)];
    if (ov?.enabled === false) return acc;
    const v = parseFloat(ov?.value ?? e.default_value ?? '0');
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const totalBills = (data?.credit_card_bills ?? []).reduce(
    (acc, b) => acc + parseFloat(b.total_amount || '0'),
    0
  );
  const totalExtraExp = sumValues(extraExpenses);
  const totalBudgets = allCategories.reduce((acc, cat) => {
    const override = budgetOverrides[cat] ?? existingBudgetMap[cat];
    const v = parseFloat(override ?? '0');
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const totalExpenses = totalFixedExp + totalBills + totalExtraExp + totalBudgets;

  const projectedBalance = totalRevenues - totalExpenses;
  const totalOverdraft = parseFloat(data?.total_overdraft_limit ?? '0');
  const projectedBalanceWithOverdraft = projectedBalance + totalOverdraft;

  const actualRevenues = parseFloat(data?.actual.revenues ?? '0');
  const actualExpenses = parseFloat(data?.actual.expenses ?? '0');
  const actualBalance = actualRevenues - actualExpenses;

  return (
    <PageContainer>
      <AnimatedPage>
        <PageHeader
          title={t('monthlyPlanner.title')}
          description={t('monthlyPlanner.description')}
          icon={<CalendarCheck className="h-5 w-5" />}
        />

        {/* Month navigation */}
        <div className="mb-lg flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-base font-semibold">
              {monthNames[month - 1]} {year}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isApplied ? (
            <div className="flex items-center gap-xs rounded-lg bg-primary/10 px-sm py-xs text-xs text-primary">
              <CalendarCheck className="h-3.5 w-3.5" />
              {t('monthlyPlanner.planApplied')}
            </div>
          ) : (
            <Button
              onClick={() => void handleApply()}
              disabled={applyMutation.isPending || !planId}
              size="sm"
            >
              <CalendarCheck className="mr-xs h-4 w-4" />
              {applyMutation.isPending
                ? t('monthlyPlanner.applyingPlan')
                : t('monthlyPlanner.applyPlan')}
            </Button>
          )}
        </div>

        {/* Summary stats */}
        <div className="mb-lg grid grid-cols-3 gap-md">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-md">
              <div className="flex items-center gap-sm">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">
                  {t('monthlyPlanner.totalRevenues')}
                </span>
              </div>
              <p className="mt-xs text-lg font-bold text-emerald-600">
                {formatCurrency(totalRevenues)}
              </p>
              {isApplied && (
                <p className="text-xs text-muted-foreground">
                  {t('monthlyPlanner.actual')}: {formatCurrency(actualRevenues)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="pt-md">
              <div className="flex items-center gap-sm">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground">
                  {t('monthlyPlanner.totalExpenses')}
                </span>
              </div>
              <p className="mt-xs text-lg font-bold text-destructive">
                {formatCurrency(totalExpenses)}
              </p>
              {totalBudgets > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('monthlyPlanner.budgets')}: {formatCurrency(totalBudgets)}
                </p>
              )}
              {isApplied && (
                <p className="text-xs text-muted-foreground">
                  {t('monthlyPlanner.actual')}: {formatCurrency(actualExpenses)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card
            className={cn(
              projectedBalance >= 0
                ? 'border-primary/20 bg-primary/5'
                : 'border-destructive/20 bg-destructive/5'
            )}
          >
            <CardContent className="pt-md">
              <div className="flex items-center gap-sm">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  {t('monthlyPlanner.projectedBalance')}
                </span>
              </div>
              <p
                className={cn(
                  'mt-xs text-lg font-bold',
                  projectedBalance >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {formatCurrency(projectedBalance)}
              </p>
              {isApplied && (
                <p className="text-xs text-muted-foreground">
                  {t('monthlyPlanner.actual')}: {formatCurrency(actualBalance)}
                </p>
              )}
              {totalOverdraft > 0 && (
                <div className="mt-xs flex items-center gap-xs rounded-md border border-yellow-500/30 bg-yellow-500/10 px-xs py-xs">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-500" />
                  <span className="text-xs text-yellow-600 dark:text-yellow-400">
                    {t('monthlyPlanner.withOverdraft')}:{' '}
                    {formatCurrency(projectedBalanceWithOverdraft)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Revenues + Expenses */}
        <div className="mb-lg grid grid-cols-1 gap-md lg:grid-cols-2">
          {/* Revenues */}
          <div className="space-y-sm">
            <SectionCard
              title={t('monthlyPlanner.fixedRevenues')}
              icon={CircleDollarSign}
              total={totalFixed}
            >
              {(data?.fixed_revenues.length ?? 0) === 0 && (
                <p className="py-sm text-center text-xs text-muted-foreground">
                  {t('monthlyPlanner.noFixedRevenues')}
                </p>
              )}
              {data?.fixed_revenues.map((r) => (
                <EditableFixedItem
                  key={r.id}
                  id={r.id}
                  label={r.description}
                  defaultValue={r.default_value}
                  sub={r.account_name || t('monthlyPlanner.dueDay', { day: r.due_day })}
                  override={fixedRevenueOverrides[String(r.id)]}
                  onToggle={toggleFixedRevenue}
                  onValueChange={updateFixedRevenueValue}
                />
              ))}
            </SectionCard>

            <SectionCard
              title={t('monthlyPlanner.extraRevenues')}
              icon={CircleDollarSign}
              total={totalExtra}
            >
              {extraRevenues.map((r, i) => (
                <ExtraItemRow
                  key={i}
                  item={r}
                  index={i}
                  onChange={updateExtraRevenue}
                  onRemove={removeExtraRevenue}
                  removeLabel={t('monthlyPlanner.removeItem')}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addExtraRevenue}
                className="w-full gap-xs text-xs"
              >
                <Plus className="h-3 w-3" />
                {t('monthlyPlanner.addItem')}
              </Button>
            </SectionCard>
          </div>

          {/* Expenses */}
          <div className="space-y-sm">
            <SectionCard
              title={t('monthlyPlanner.fixedExpenses')}
              icon={TrendingDown}
              total={totalFixedExp}
            >
              {(data?.fixed_expenses.length ?? 0) === 0 && (
                <p className="py-sm text-center text-xs text-muted-foreground">
                  {t('monthlyPlanner.noFixedExpenses')}
                </p>
              )}
              {data?.fixed_expenses.map((e) => (
                <EditableFixedItem
                  key={e.id}
                  id={e.id}
                  label={e.description}
                  defaultValue={e.default_value}
                  sub={e.credit_card_name || e.account_name}
                  override={fixedExpenseOverrides[String(e.id)]}
                  onToggle={toggleFixedExpense}
                  onValueChange={updateFixedExpenseValue}
                />
              ))}
            </SectionCard>

            <SectionCard
              title={t('monthlyPlanner.creditCardBills')}
              icon={CreditCard}
              total={totalBills}
            >
              {(data?.credit_card_bills.length ?? 0) === 0 && (
                <p className="py-sm text-center text-xs text-muted-foreground">
                  {t('monthlyPlanner.noBills')}
                </p>
              )}
              {data?.credit_card_bills.map((b) => (
                <FixedItem
                  key={b.id}
                  label={b.credit_card_name}
                  value={b.total_amount}
                  sub={formatDueDate(b.due_date)}
                />
              ))}
            </SectionCard>

            <SectionCard
              title={t('monthlyPlanner.extraExpenses')}
              icon={TrendingDown}
              total={totalExtraExp}
            >
              {extraExpenses.map((e, i) => (
                <ExtraItemRow
                  key={i}
                  item={e}
                  index={i}
                  onChange={updateExtraExpense}
                  onRemove={removeExtraExpense}
                  removeLabel={t('monthlyPlanner.removeItem')}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addExtraExpense}
                className="w-full gap-xs text-xs"
              >
                <Plus className="h-3 w-3" />
                {t('monthlyPlanner.addItem')}
              </Button>
            </SectionCard>
          </div>
        </div>

        {/* Budget by category */}
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-semibold">
              {t('monthlyPlanner.budgetByCategory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allCategories.length === 0 && (
              <p className="py-sm text-center text-xs text-muted-foreground">
                {t('monthlyPlanner.noBudgetSuggestions')}
              </p>
            )}
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {allCategories.map((cat) => {
                const suggested = budgetSuggestionMap[cat];
                const existing = existingBudgetMap[cat];
                const currentOverride = budgetOverrides[cat] ?? existing ?? '';
                const limitAmount = parseFloat(
                  currentOverride || String(suggested ?? 0)
                );
                const executionPct =
                  isApplied && limitAmount > 0
                    ? Math.min(100, Math.round((actualExpenses / limitAmount) * 100))
                    : null;

                return (
                  <div
                    key={cat}
                    className="space-y-xs rounded-lg border bg-muted/20 p-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{categoryLabel(cat)}</span>
                      {suggested !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {t('monthlyPlanner.overrideHint', {
                            value: formatCurrency(suggested),
                          })}
                        </span>
                      )}
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentOverride}
                      onChange={(e) => updateBudgetOverride(cat, e.target.value)}
                      placeholder={suggested ? suggested.toFixed(2) : '0.00'}
                      className="h-7 text-sm"
                      disabled={isApplied}
                    />
                    {executionPct !== null && (
                      <div>
                        <p className="mb-xs text-xs text-muted-foreground">
                          {t('monthlyPlanner.executionPercent', {
                            percent: executionPct,
                          })}
                        </p>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-1.5 rounded-full transition-all',
                              executionPct >= 100
                                ? 'bg-destructive'
                                : executionPct >= 80
                                  ? 'bg-yellow-500'
                                  : 'bg-primary'
                            )}
                            style={{ width: `${executionPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </AnimatedPage>
    </PageContainer>
  );
}
