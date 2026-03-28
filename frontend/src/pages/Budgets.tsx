import { useQuery } from '@tanstack/react-query';
import {
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useSemanticColors } from '@/lib/chart-colors';
import { axisFormatCurrency, formatCurrencyBR } from '@/lib/chart-formatters';
import { formatCurrency } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { budgetsService } from '@/services/budgets-service';
import type { Budget, BudgetFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

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
  };
}

export default function Budgets() {
  const { t } = useTranslation();
  const [budgets, setBudgets] = useState<Budget[]>([]);
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
  const [showTrend, setShowTrend] = useState(false);
  const [trendCategory, setTrendCategory] = useState<string>(
    EXPENSE_CATEGORIES_CANONICAL[0]?.key ?? 'others'
  );
  const [trendMonths, setTrendMonths] = useState(6);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await budgetsService.getAll();
      setBudgets(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      setBudgets([]);
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBudgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between p-4 text-left"
          onClick={() => setShowTrend((v) => !v)}
        >
          <div className="flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4" />
            {t('pages.budgets.trend.title')}
          </div>
          {showTrend ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showTrend && (
          <div className="border-t p-4">
            <div className="mb-4 flex flex-wrap gap-4">
              <Select value={trendCategory} onValueChange={setTrendCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('common.fields.category')} />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES_CANONICAL.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(trendMonths)}
                onValueChange={(v) => setTrendMonths(parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <BudgetTrendChart category={trendCategory} months={trendMonths} />
          </div>
        )}
      </div>

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
                  <SelectValue placeholder="Selecione a categoria" />
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

            <div className="flex justify-end gap-2 pt-2">
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
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function BudgetTrendChart({ category, months }: { category: string; months: number }) {
  const colors = useSemanticColors();
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['budgets', 'history', category, months],
    queryFn: () => budgetsService.getHistory({ category, months }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
    enabled: !!category,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const chartData = history.map((h) => ({
    label: `${MONTH_SHORT[h.month - 1]}/${String(h.year).slice(2)}`,
    actual_spent: parseFloat(h.actual_spent),
    limit_amount: h.limit_amount !== null ? parseFloat(h.limit_amount) : null,
  }));

  const hasAnyData = chartData.some(
    (d) => d.actual_spent > 0 || d.limit_amount !== null
  );

  if (!hasAnyData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nenhum dado encontrado para esta categoria no período selecionado.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={chartData}
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={axisFormatCurrency} tick={{ fontSize: 12 }} width={64} />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrencyBR(value),
            name === 'actual_spent' ? 'Gasto real' : 'Limite',
          ]}
        />
        <Legend
          formatter={(value) => (value === 'actual_spent' ? 'Gasto real' : 'Limite')}
        />
        <Bar dataKey="actual_spent" fill={colors.info} radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="limit_amount"
          stroke={colors.danger}
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  onEdit: (b: Budget) => void;
  onDelete: (b: Budget) => Promise<void>;
}) {
  const { t } = useTranslation();
  const monthLabel =
    MONTHS.find((m) => m.value === budget.month)?.label ?? String(budget.month);
  const categoryLabel = translate('expenseCategories', budget.category);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{categoryLabel}</h3>
          <p className="text-sm text-muted-foreground">
            {monthLabel}/{budget.year}
          </p>
        </div>
        <Badge variant="outline">Orçamento</Badge>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('pages.budgets.limit')}</span>
          <span className="font-medium">{formatCurrency(budget.limit_amount)}</span>
        </div>
        {budget.member_name && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('pages.budgets.member')}</span>
            <span className="font-medium">{budget.member_name}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t pt-2">
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
  );
}
