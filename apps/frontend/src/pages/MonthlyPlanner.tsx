/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { API_CONFIG } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { translateCategory } from '@/lib/helpers';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { apiClient } from '@/services/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtraItem {
  description: string;
  value: string;
  category: string;
  enabled?: boolean;
}

interface PlanPayload {
  extra_revenues: ExtraItem[];
  extra_expenses: ExtraItem[];
  budget_overrides: Record<string, string>;
  fixed_revenue_overrides: Record<string, FixedItemOverride>;
  fixed_expense_overrides: Record<string, FixedItemOverride>;
  bill_overrides: Record<string, boolean>;
  budget_disabled_categories: string[];
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
  bill_overrides: Record<string, boolean>;
  budget_disabled_categories: string[];
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
  already_posted: boolean;
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
  already_posted: boolean;
  related_loan_name: string | null;
  related_payable_name: string | null;
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
  paid_amount: string;
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

interface ActualRevenueItem {
  id: number;
  description: string;
  value: string;
  category: string;
  date: string;
}

interface ActualExpenseItem {
  id: number;
  description: string;
  value: string;
  category: string;
  date: string;
  payed: boolean;
}

interface MonthlyPlanSummary {
  plan: MonthlyPlan;
  fixed_revenues: FixedRevenueItem[];
  fixed_expenses: FixedExpenseItem[];
  credit_card_bills: CreditCardBillItem[];
  existing_budgets: ExistingBudget[];
  budget_suggestions: BudgetSuggestion[];
  actual: { revenues: string; expenses: string };
  actual_revenue_items: ActualRevenueItem[];
  actual_expense_items: ActualExpenseItem[];
  total_account_balance: string;
  total_overdraft_limit: string;
  opening_balance: string;
  registered_expenses_net: string;
  actual_expenses_by_category: Record<string, string>;
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

function sumValues(
  items: Array<{ value?: string; default_value?: string; enabled?: boolean }>
): number {
  return items.reduce((acc, item) => {
    if (item.enabled === false) return acc;
    const v = parseFloat(item.value ?? item.default_value ?? '0');
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
}

function formatDueDate(isoDate: string | null | undefined): string | undefined {
  if (!isoDate) return undefined;
  const [, month, day] = isoDate.split('-');
  return `Vence ${day}/${month}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A visually distinct block (accent border + divider header) nested inside
 * a shared parent Card, used to group related items without a separate
 * Card per group. */
function CardSubSection({
  title,
  icon: Icon,
  total,
  variant = 'default',
  children,
}: {
  title: string;
  icon: React.ElementType;
  total: number;
  variant?: 'revenue' | 'expense' | 'bill' | 'default';
  children: React.ReactNode;
}) {
  const accent = {
    revenue: 'border-l-success/60',
    expense: 'border-l-destructive/60',
    bill: 'border-l-warning/60',
    default: 'border-l-border',
  }[variant];

  return (
    <div className={cn('space-y-sm pl-sm border-l-2', accent)}>
      <div className="gap-xs flex items-center">
        <Icon className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {title}
        </span>
        <div className="bg-border/50 h-px flex-1" />
        <span className="text-sm font-semibold">{formatCurrency(total)}</span>
      </div>
      <div className="space-y-xs">{children}</div>
    </div>
  );
}

function EditableFixedItem({
  id,
  label,
  defaultValue,
  sub,
  override,
  alreadyPosted,
  forceDisabled,
  debtName,
  onToggle,
  onValueChange,
}: {
  id: number;
  label: string;
  defaultValue: string;
  sub?: string;
  override?: FixedItemOverride;
  /** Shows the informational "already posted" badge. Does not affect the total. */
  alreadyPosted?: boolean;
  /** Forces the checkbox off — used when the value is already counted
   * elsewhere (e.g. a card-linked fixed expense already inside a bill
   * total), so including it here would double-count it. */
  forceDisabled?: boolean;
  /** Name of the Loan/Payable this fixed expense is the installment of,
   * when it comes from a debt payment plan. */
  debtName?: string | null;
  onToggle: (id: number, enabled: boolean) => void;
  onValueChange: (id: number, value: string) => void;
}) {
  const { t } = useTranslation();
  const enabled = !forceDisabled && override?.enabled !== false;
  const displayValue = override?.value ?? defaultValue;

  return (
    <div
      className={cn(
        'gap-sm bg-muted/40 px-sm py-xs flex items-center rounded-lg text-sm transition-opacity',
        !enabled && 'opacity-40'
      )}
    >
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggle(id, !!checked)}
        disabled={forceDisabled}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        {sub && <span className="ml-xs text-muted-foreground text-xs">{sub}</span>}
      </div>
      {debtName && (
        <Badge variant="outline" className="gap-xs shrink-0 text-xs" title={debtName}>
          <Landmark className="h-3 w-3" />
          {debtName}
        </Badge>
      )}
      {alreadyPosted && (
        <Badge
          variant="outline"
          className="border-success text-success shrink-0 text-xs"
        >
          {t('monthlyPlanner.alreadyPosted')}
        </Badge>
      )}
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

function BillItem({
  bill,
  enabled,
  onToggle,
  isInsufficient,
}: {
  bill: CreditCardBillItem;
  enabled: boolean;
  onToggle: (id: number, enabled: boolean) => void;
  isInsufficient?: boolean;
}) {
  const isPaid = bill.status === 'paid';

  return (
    <div
      className={cn(
        'gap-sm bg-muted/40 px-sm py-xs flex items-center rounded-lg text-sm transition-opacity',
        !enabled && 'opacity-40'
      )}
    >
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggle(bill.id, !!checked)}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{bill.credit_card_name}</span>
        {bill.due_date && (
          <span className="ml-xs text-muted-foreground text-xs">
            {formatDueDate(bill.due_date)}
          </span>
        )}
      </div>
      {isPaid && (
        <Badge
          variant="outline"
          className="border-success text-success shrink-0 text-xs"
        >
          Pago
        </Badge>
      )}
      {isInsufficient && enabled && !isPaid && (
        <Badge
          variant="outline"
          className="border-destructive text-destructive shrink-0 text-xs"
        >
          <AlertTriangle className="mr-xs h-3 w-3" />
          Saldo insuficiente
        </Badge>
      )}
      <span className="text-muted-foreground shrink-0">
        {formatCurrency(bill.total_amount)}
      </span>
    </div>
  );
}

function ExtraItemRow({
  item,
  index,
  onChange,
  onToggle,
  onRemove,
  removeLabel,
}: {
  item: ExtraItem;
  index: number;
  onChange: (idx: number, field: keyof ExtraItem, val: string) => void;
  onToggle: (idx: number, enabled: boolean) => void;
  onRemove: (idx: number) => void;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  const enabled = item.enabled !== false;

  return (
    <div
      className={cn(
        'gap-xs flex items-center transition-opacity',
        !enabled && 'opacity-40'
      )}
    >
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggle(index, !!checked)}
        className="shrink-0"
      />
      <Input
        value={item.description}
        onChange={(e) => onChange(index, 'description', e.target.value)}
        placeholder={t('monthlyPlanner.descriptionPlaceholder')}
        disabled={!enabled}
        className="h-8 flex-1 text-sm"
      />
      <Input
        value={item.value}
        onChange={(e) => onChange(index, 'value', e.target.value)}
        placeholder="0,00"
        type="number"
        min="0"
        step="0.01"
        disabled={!enabled}
        className="h-8 w-28 text-sm"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(index)}
        className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
        aria-label={removeLabel}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Collapsible sub-section (same visual language as CardSubSection) that
 * lists real, already-posted records for context/transparency. Collapsed
 * by default since the list can be long. */
function ActualItemsSection({
  title,
  icon: Icon,
  variant,
  items,
  emptyText,
  renderItem,
}: {
  title: string;
  icon: React.ElementType;
  variant: 'revenue' | 'expense';
  items: unknown[];
  emptyText: string;
  renderItem: (item: unknown, idx: number) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent =
    variant === 'revenue' ? 'border-l-success/60' : 'border-l-destructive/60';

  return (
    <div className={cn('space-y-sm pl-sm border-l-2', accent)}>
      <button
        className="gap-xs flex w-full items-center"
        onClick={() => setExpanded((v) => !v)}
      >
        <Icon className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {title}
        </span>
        <Badge variant="secondary" className="text-xs">
          {items.length}
        </Badge>
        <div className="bg-border/50 h-px flex-1" />
        {expanded ? (
          <ChevronUp className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        )}
      </button>
      {expanded && (
        <div className="space-y-xs">
          {items.length === 0 ? (
            <p className="py-sm text-muted-foreground text-center text-xs">
              {emptyText}
            </p>
          ) : (
            items.map((item, idx) => renderItem(item, idx))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function MonthlyPlanner({ embedded = false }: { embedded?: boolean }) {
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
  const [billOverrides, setBillOverrides] = useState<Record<string, boolean>>({});
  const [budgetDisabledCategories, setBudgetDisabledCategories] = useState<string[]>(
    []
  );
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

  const currentKey = `${month}-${year}`;
  if (summaryQuery.data && initializedKey !== currentKey) {
    const { plan } = summaryQuery.data;
    setInitializedKey(currentKey);
    setExtraRevenues(plan.extra_revenues ?? []);
    setExtraExpenses(plan.extra_expenses ?? []);
    setBudgetOverrides(plan.budget_overrides ?? {});
    setFixedRevenueOverrides(plan.fixed_revenue_overrides ?? {});
    setFixedExpenseOverrides(plan.fixed_expense_overrides ?? {});
    setBillOverrides(plan.bill_overrides ?? {});
    setBudgetDisabledCategories(plan.budget_disabled_categories ?? []);
  }

  const planId = summaryQuery.data?.plan.id ?? null;

  const saveMutation = useMutation({
    mutationFn: (data: { id: number; payload: PlanPayload }) =>
      apiClient.patch(`${API_CONFIG.ENDPOINTS.MONTHLY_PLAN}${data.id}/`, data.payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monthlyPlan', month, year] });
    },
  });

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
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['revenues'] });
      void queryClient.invalidateQueries({ queryKey: ['budgets'] });
      void queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['fixed-revenues'] });
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
      title: isApplied
        ? t('monthlyPlanner.reapplyConfirmTitle')
        : t('monthlyPlanner.applyConfirmTitle'),
      description: isApplied
        ? t('monthlyPlanner.reapplyConfirmDescription', {
            month: `${monthName} ${year}`,
          })
        : t('monthlyPlanner.applyConfirmDescription', {
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
    bill_overrides: billOverrides,
    budget_disabled_categories: budgetDisabledCategories,
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

  const toggleExtraRevenue = (idx: number, enabled: boolean) => {
    if (!planId) return;
    const updated = extraRevenues.map((r, i) => (i === idx ? { ...r, enabled } : r));
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

  const toggleExtraExpense = (idx: number, enabled: boolean) => {
    if (!planId) return;
    const updated = extraExpenses.map((e, i) => (i === idx ? { ...e, enabled } : e));
    setExtraExpenses(updated);
    scheduleSave(planId, buildPayload({ extra_expenses: updated }));
  };

  const removeExtraExpense = (idx: number) => {
    if (!planId) return;
    const updated = extraExpenses.filter((_, i) => i !== idx);
    setExtraExpenses(updated);
    scheduleSave(planId, buildPayload({ extra_expenses: updated }));
  };

  const updateBudgetOverride = (category: string, value: string, minAllowed = 0) => {
    if (!planId) return;
    const updated = { ...budgetOverrides, [category]: value };
    setBudgetOverrides(updated);
    // Só persiste valores válidos (>= 0 e >= o já gasto na categoria); o
    // valor digitado continua aparecendo no campo para o usuário terminar
    // de editar, mas não é salvo enquanto estiver abaixo do mínimo.
    const parsed = parseFloat(value);
    const isValid =
      value === '' || (!isNaN(parsed) && parsed >= 0 && parsed >= minAllowed);
    if (!isValid) return;
    scheduleSave(planId, buildPayload({ budget_overrides: updated }));
  };

  const toggleBudgetCategory = (category: string, enabled: boolean) => {
    if (!planId) return;
    const updated = enabled
      ? budgetDisabledCategories.filter((c) => c !== category)
      : [...budgetDisabledCategories.filter((c) => c !== category), category];
    setBudgetDisabledCategories(updated);
    scheduleSave(planId, buildPayload({ budget_disabled_categories: updated }));
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

  const toggleBill = (id: number, enabled: boolean) => {
    if (!planId) return;
    const updated = { ...billOverrides, [String(id)]: enabled };
    setBillOverrides(updated);
    scheduleSave(planId, buildPayload({ bill_overrides: updated }));
  };

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  if (summaryQuery.isLoading) {
    return (
      <Wrapper>
        <LoadingState />
      </Wrapper>
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
  const openingBalance = parseFloat(data?.opening_balance ?? '0');
  const totalRevenues = totalFixed + totalExtra + openingBalance;

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
    // Card-linked fixed expenses that are already posted are already inside
    // totalBills (the bill's total_amount already contains that
    // installment) — skip those to avoid double-counting. Account-linked
    // ones stay counted here even once posted: their registered Expense is
    // excluded from registeredExpensesNet instead, so the value is still
    // counted exactly once.
    if (e.already_posted && e.credit_card_name) return acc;
    const ov = fixedExpenseOverrides[String(e.id)];
    if (ov?.enabled === false) return acc;
    const v = parseFloat(ov?.value ?? e.default_value ?? '0');
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  const totalBills = (data?.credit_card_bills ?? []).reduce((acc, b) => {
    if (billOverrides[String(b.id)] === false) return acc;
    return acc + parseFloat(b.total_amount || '0');
  }, 0);

  const totalExtraExp = sumValues(extraExpenses);
  const totalBudgets = allCategories.reduce((acc, cat) => {
    if (budgetDisabledCategories.includes(cat)) return acc;
    const override = budgetOverrides[cat] ?? existingBudgetMap[cat];
    const v = parseFloat(override ?? '0');
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const registeredExpensesNet = parseFloat(data?.registered_expenses_net ?? '0');
  const totalExpenses =
    totalFixedExp + totalBills + totalExtraExp + totalBudgets + registeredExpensesNet;

  const projectedBalance = totalRevenues - totalExpenses;
  const totalOverdraft = parseFloat(data?.total_overdraft_limit ?? '0');
  const projectedBalanceWithOverdraft = projectedBalance + totalOverdraft;

  const actualRevenues = parseFloat(data?.actual.revenues ?? '0');
  const actualExpenses = parseFloat(data?.actual.expenses ?? '0');
  const actualBalance = actualRevenues - actualExpenses;
  const hasActualData = actualRevenues > 0 || actualExpenses > 0;

  const totalAccountBalance = parseFloat(data?.total_account_balance ?? '0');
  const totalAvailable = totalAccountBalance + totalOverdraft;

  const actualExpensesByCategory = data?.actual_expenses_by_category ?? {};

  // Compute per-bill sufficiency: sort enabled bills by due date, flag when
  // the running cumulative total exceeds the available balance.
  const billInsufficientMap: Record<number, boolean> = (() => {
    const enabledBills = (data?.credit_card_bills ?? [])
      .filter((b) => billOverrides[String(b.id)] !== false && b.status !== 'paid')
      .sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    const map: Record<number, boolean> = {};
    let running = 0;
    for (const b of enabledBills) {
      running += parseFloat(b.total_amount || '0');
      if (running > totalAvailable) map[b.id] = true;
    }
    return map;
  })();

  const actualRevenueItems = data?.actual_revenue_items ?? [];
  const actualExpenseItems = data?.actual_expense_items ?? [];

  return (
    <Wrapper>
      <PageHeader
        title={t('monthlyPlanner.title')}
        description={t('monthlyPlanner.description')}
        icon={<CalendarCheck className="h-5 w-5" />}
      />

      {/* Month navigation */}
      <div className="mb-lg flex items-center justify-between">
        <div className="gap-sm flex items-center">
          <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 text-center text-2xl font-bold tracking-tight">
            {monthNames[month - 1]} {year}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={() => void handleApply()}
          disabled={applyMutation.isPending || !planId}
          size="sm"
          variant={isApplied ? 'outline' : 'default'}
        >
          <CalendarCheck className="mr-xs h-4 w-4" />
          {applyMutation.isPending
            ? t('monthlyPlanner.applyingPlan')
            : isApplied
              ? t('monthlyPlanner.reapplyPlan')
              : t('monthlyPlanner.applyPlan')}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="mb-lg gap-md grid grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-md">
            <div className="gap-sm flex items-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground text-xs">
                {t('monthlyPlanner.totalRevenues')}
              </span>
            </div>
            <p className="mt-xs text-lg font-bold text-emerald-600">
              {formatCurrency(totalRevenues)}
            </p>
            {hasActualData && (
              <p className="text-muted-foreground text-xs">
                {t('monthlyPlanner.actual')}: {formatCurrency(actualRevenues)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-md">
            <div className="gap-sm flex items-center">
              <TrendingDown className="text-destructive h-4 w-4" />
              <span className="text-muted-foreground text-xs">
                {t('monthlyPlanner.totalExpenses')}
              </span>
            </div>
            <p className="mt-xs text-destructive text-lg font-bold">
              {formatCurrency(totalExpenses)}
            </p>
            {totalBudgets > 0 && (
              <p className="text-muted-foreground text-xs">
                {t('monthlyPlanner.budgets')}: {formatCurrency(totalBudgets)}
              </p>
            )}
            {hasActualData && (
              <p className="text-muted-foreground text-xs">
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
            <div className="gap-sm flex items-center">
              <Wallet className="text-primary h-4 w-4" />
              <span className="text-muted-foreground text-xs">
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
            {hasActualData && (
              <p className="text-muted-foreground text-xs">
                {t('monthlyPlanner.actual')}: {formatCurrency(actualBalance)}
              </p>
            )}
            {totalOverdraft > 0 && (
              <div className="mt-xs gap-xs px-xs py-xs flex items-center rounded-md border border-yellow-500/30 bg-yellow-500/10">
                <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-500" />
                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                  {t('monthlyPlanner.withOverdraft')}:{' '}
                  {formatCurrency(projectedBalanceWithOverdraft)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-md">
            <div className="gap-sm flex items-center">
              <Landmark className="text-primary h-4 w-4" />
              <span className="text-muted-foreground text-xs">
                {t('monthlyPlanner.accountBalance')}
              </span>
            </div>
            <p className="mt-xs text-primary text-lg font-bold">
              {formatCurrency(totalAccountBalance)}
            </p>
            {totalOverdraft > 0 && (
              <p className="text-muted-foreground text-xs">
                {t('monthlyPlanner.overdraftLimit')}: {formatCurrency(totalOverdraft)}
              </p>
            )}
            <p className="text-primary text-xs font-medium">
              {t('monthlyPlanner.totalAvailable')}: {formatCurrency(totalAvailable)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenues + Expenses */}
      <div className="gap-md grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Revenues + Budgets */}
        <div className="space-y-sm">
          <Card className="border-l-success border-l-4">
            <CardHeader className="pb-sm">
              <div className="flex items-center justify-between">
                <div className="gap-sm flex items-center">
                  <CircleDollarSign className="text-muted-foreground h-4 w-4" />
                  <CardTitle className="text-sm font-semibold">
                    {t('monthlyPlanner.totalRevenues')}
                  </CardTitle>
                </div>
                <span className="text-success text-sm font-semibold">
                  {formatCurrency(totalRevenues)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-lg">
              <CardSubSection
                title={t('monthlyPlanner.fixedRevenues')}
                icon={CircleDollarSign}
                total={totalFixed}
                variant="revenue"
              >
                {(data?.fixed_revenues.length ?? 0) === 0 && (
                  <p className="py-sm text-muted-foreground text-center text-xs">
                    {t('monthlyPlanner.noFixedRevenues')}
                  </p>
                )}
                {data?.fixed_revenues.map((r) => (
                  <EditableFixedItem
                    key={r.id}
                    id={r.id}
                    label={r.description}
                    defaultValue={r.default_value}
                    sub={
                      r.account_name || t('monthlyPlanner.dueDay', { day: r.due_day })
                    }
                    override={fixedRevenueOverrides[String(r.id)]}
                    alreadyPosted={r.already_posted}
                    onToggle={toggleFixedRevenue}
                    onValueChange={updateFixedRevenueValue}
                  />
                ))}
              </CardSubSection>

              <CardSubSection
                title={t('monthlyPlanner.extraRevenues')}
                icon={CircleDollarSign}
                total={totalExtra}
                variant="revenue"
              >
                {extraRevenues.map((r, i) => (
                  <ExtraItemRow
                    key={i}
                    item={r}
                    index={i}
                    onChange={updateExtraRevenue}
                    onToggle={toggleExtraRevenue}
                    onRemove={removeExtraRevenue}
                    removeLabel={t('monthlyPlanner.removeItem')}
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addExtraRevenue}
                  className="gap-xs w-full text-xs"
                >
                  <Plus className="h-3 w-3" />
                  {t('monthlyPlanner.addItem')}
                </Button>
              </CardSubSection>

              <ActualItemsSection
                title={t('monthlyPlanner.registeredRevenues')}
                icon={TrendingUp}
                variant="revenue"
                items={actualRevenueItems}
                emptyText={t('monthlyPlanner.noRegisteredRevenues')}
                renderItem={(item, idx) => {
                  const r = item as ActualRevenueItem;
                  return (
                    <div
                      key={idx}
                      className="bg-muted/30 px-sm py-xs flex items-center justify-between rounded-lg text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {r.description}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {translateCategory(r.category, 'revenue')} ·{' '}
                          {formatDate(r.date)}
                        </span>
                      </div>
                      <span className="ml-sm text-success shrink-0 font-semibold">
                        {formatCurrency(r.value)}
                      </span>
                    </div>
                  );
                }}
              />
            </CardContent>
          </Card>

          {/* Budget by category */}
          <Card className="border-l-primary border-l-4">
            <CardHeader className="pb-sm">
              <div className="flex items-center justify-between">
                <div className="gap-sm flex items-center">
                  <Target className="text-muted-foreground h-4 w-4" />
                  <CardTitle className="text-sm font-semibold">
                    {t('monthlyPlanner.budgetByCategory')}
                  </CardTitle>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(totalBudgets)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {allCategories.length === 0 && (
                <p className="py-sm text-muted-foreground text-center text-xs">
                  {t('monthlyPlanner.noBudgetSuggestions')}
                </p>
              )}
              <div className="gap-sm grid grid-cols-1 sm:grid-cols-2">
                {allCategories.map((cat) => {
                  const suggested = budgetSuggestionMap[cat];
                  const existing = existingBudgetMap[cat];
                  const currentOverride = budgetOverrides[cat] ?? existing ?? '';
                  const isDisabled = budgetDisabledCategories.includes(cat);
                  const limitAmount = parseFloat(
                    currentOverride || String(suggested ?? 0)
                  );
                  const catActual = parseFloat(actualExpensesByCategory[cat] ?? '0');
                  const executionPct =
                    limitAmount > 0 && catActual > 0
                      ? Math.min(100, Math.round((catActual / limitAmount) * 100))
                      : null;

                  return (
                    <div
                      key={cat}
                      className={cn(
                        'space-y-xs bg-muted/20 p-sm rounded-lg border transition-opacity',
                        isDisabled && 'opacity-40'
                      )}
                    >
                      <div className="gap-xs flex items-center justify-between">
                        <div className="gap-xs flex min-w-0 items-center">
                          <Checkbox
                            checked={!isDisabled}
                            onCheckedChange={(checked) =>
                              toggleBudgetCategory(cat, !!checked)
                            }
                            className="shrink-0"
                          />
                          <span className="truncate text-xs font-medium">
                            {translateCategory(cat, 'expense')}
                          </span>
                        </div>
                        {suggested !== undefined && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {t('monthlyPlanner.overrideHint', {
                              value: formatCurrency(suggested),
                            })}
                          </span>
                        )}
                      </div>
                      <Input
                        type="number"
                        min={catActual}
                        step="0.01"
                        value={currentOverride}
                        onChange={(e) =>
                          updateBudgetOverride(cat, e.target.value, catActual)
                        }
                        placeholder={suggested ? suggested.toFixed(2) : '0.00'}
                        className="h-7 text-sm"
                        disabled={isDisabled}
                      />
                      {currentOverride !== '' &&
                        !isNaN(parseFloat(currentOverride)) &&
                        parseFloat(currentOverride) < catActual && (
                          <p className="text-destructive text-xs">
                            {t('monthlyPlanner.budgetMinValueWarning', {
                              value: formatCurrency(catActual),
                            })}
                          </p>
                        )}
                      {executionPct !== null && !isDisabled && (
                        <div>
                          <p className="mb-xs text-muted-foreground text-xs">
                            {t('monthlyPlanner.executionPercent', {
                              percent: executionPct,
                            })}
                          </p>
                          <div className="bg-muted h-1.5 w-full rounded-full">
                            <div
                              className={cn(
                                'h-1.5 rounded-full transition',
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
        </div>

        {/* Right: Expenses */}
        <div className="space-y-sm">
          <Card className="border-l-destructive border-l-4">
            <CardHeader className="pb-sm">
              <div className="flex items-center justify-between">
                <div className="gap-sm flex items-center">
                  <TrendingDown className="text-muted-foreground h-4 w-4" />
                  <CardTitle className="text-sm font-semibold">
                    {t('monthlyPlanner.totalExpenses')}
                  </CardTitle>
                </div>
                <span className="text-destructive text-sm font-semibold">
                  {formatCurrency(totalExpenses)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-lg">
              <CardSubSection
                title={t('monthlyPlanner.fixedExpenses')}
                icon={TrendingDown}
                total={totalFixedExp}
                variant="expense"
              >
                {(data?.fixed_expenses.length ?? 0) === 0 && (
                  <p className="py-sm text-muted-foreground text-center text-xs">
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
                    alreadyPosted={e.already_posted}
                    forceDisabled={e.already_posted && Boolean(e.credit_card_name)}
                    debtName={e.related_loan_name ?? e.related_payable_name}
                    onToggle={toggleFixedExpense}
                    onValueChange={updateFixedExpenseValue}
                  />
                ))}
              </CardSubSection>

              <CardSubSection
                title={t('monthlyPlanner.creditCardBills')}
                icon={CreditCard}
                total={totalBills}
                variant="bill"
              >
                {(data?.credit_card_bills.length ?? 0) === 0 && (
                  <p className="py-sm text-muted-foreground text-center text-xs">
                    {t('monthlyPlanner.noBills')}
                  </p>
                )}
                {data?.credit_card_bills.map((b) => (
                  <BillItem
                    key={b.id}
                    bill={b}
                    enabled={billOverrides[String(b.id)] !== false}
                    onToggle={toggleBill}
                    isInsufficient={billInsufficientMap[b.id] === true}
                  />
                ))}
              </CardSubSection>

              <CardSubSection
                title={t('monthlyPlanner.extraExpenses')}
                icon={TrendingDown}
                total={totalExtraExp}
                variant="expense"
              >
                {extraExpenses.map((e, i) => (
                  <ExtraItemRow
                    key={i}
                    item={e}
                    index={i}
                    onChange={updateExtraExpense}
                    onToggle={toggleExtraExpense}
                    onRemove={removeExtraExpense}
                    removeLabel={t('monthlyPlanner.removeItem')}
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addExtraExpense}
                  className="gap-xs w-full text-xs"
                >
                  <Plus className="h-3 w-3" />
                  {t('monthlyPlanner.addItem')}
                </Button>
              </CardSubSection>

              <ActualItemsSection
                title={t('monthlyPlanner.registeredExpenses')}
                icon={TrendingDown}
                variant="expense"
                items={actualExpenseItems}
                emptyText={t('monthlyPlanner.noRegisteredExpenses')}
                renderItem={(item, idx) => {
                  const e = item as ActualExpenseItem;
                  return (
                    <div
                      key={idx}
                      className="bg-muted/30 px-sm py-xs flex items-center justify-between rounded-lg text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="gap-xs flex items-center">
                          <span className="block truncate font-medium">
                            {e.description}
                          </span>
                          {!e.payed && (
                            <Badge
                              variant="outline"
                              className="text-warning shrink-0 text-xs"
                            >
                              {t('monthlyPlanner.pending')}
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {translateCategory(e.category, 'expense')} ·{' '}
                          {formatDate(e.date)}
                        </span>
                      </div>
                      <span className="ml-sm text-destructive shrink-0 font-semibold">
                        {formatCurrency(e.value)}
                      </span>
                    </div>
                  );
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Wrapper>
  );
}
