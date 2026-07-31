/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Link,
  Pencil,
  PiggyBank,
  Plus,
  Sliders,
  Tag,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { EXPENSE_CATEGORIES_CANONICAL } from '@/config/categories';
import { translate } from '@/config/constants';
import { FINANCIAL_GOAL_CATEGORY_ICONS, EXPENSE_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useNow } from '@/hooks/use-now';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { accountsService } from '@/services/accounts-service';
import { vaultsService, financialGoalsService } from '@/services/vaults-service';
import type {
  Account,
  FinancialGoal,
  FinancialGoalListItem,
  FinancialGoalFormData,
  Vault,
} from '@/types';
import { FINANCIAL_GOAL_CATEGORIES as CATEGORIES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function ProgressRing({
  pct,
  size = 80,
  color = 'hsl(var(--success))',
}: {
  pct: number;
  size?: number;
  color?: string;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}

interface GoalCardProps {
  goal: FinancialGoalListItem;
  todayTimestamp: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onEdit: (g: FinancialGoalListItem) => void;
  onDelete: (id: number) => void;
  onManageVaults: (g: FinancialGoalListItem) => void;
  onCheckCompletion: (g: FinancialGoalListItem) => void;
}

function GoalCard({
  goal,
  todayTimestamp,
  t,
  onEdit,
  onDelete,
  onManageVaults,
  onCheckCompletion,
}: GoalCardProps) {
  const cp = goal.computed_progress;
  const currentVal = parseFloat(cp.current_value);
  const targetVal = parseFloat(cp.target_value);
  const pct = parseFloat(cp.percentage);

  const categoryConfig: Record<
    string,
    { icon: React.ReactNode; color: string; ringColor: string }
  > = {
    reduce_expenses: {
      icon: <TrendingDown className="text-warning h-5 w-5" />,
      color: 'text-warning',
      ringColor: 'hsl(var(--warning))',
    },
    increase_revenue: {
      icon: <TrendingUp className="text-info h-5 w-5" />,
      color: 'text-info',
      ringColor: 'hsl(var(--info))',
    },
  };

  const config = categoryConfig[goal.category] ?? {
    icon: <PiggyBank className="text-success h-5 w-5" />,
    color: 'text-success',
    ringColor: 'hsl(var(--success))',
  };

  const daysLeft = goal.target_date
    ? Math.ceil(
        (new Date(goal.target_date).getTime() - todayTimestamp) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <Card
      className={`overflow-hidden transition-shadow hover:shadow-md ${
        goal.is_completed ? 'border-success/50 bg-success/[0.03]' : ''
      }`}
    >
      <CardContent className="p-md">
        <div className="flex items-start justify-between">
          <div className="gap-sm flex items-center">
            {config.icon}
            <div>
              <p className="leading-tight font-semibold">{goal.description}</p>
              <p className="text-muted-foreground text-xs">
                {t(`pages.financialGoals.categories.${goal.category}`, {
                  defaultValue: goal.category_display,
                })}
              </p>
            </div>
          </div>
          <div className="gap-xs flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onManageVaults(goal)}
              aria-label={t('pages.financialGoals.manageVaults')}
              title={t('pages.financialGoals.manageVaults')}
            >
              <Link className="text-info h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCheckCompletion(goal)}
              aria-label={t('pages.financialGoals.checkCompletion')}
              title={t('pages.financialGoals.checkCompletion')}
              disabled={goal.is_completed}
            >
              <CheckCircle2 className="text-success h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(goal)}
              aria-label={t('common.actions.edit')}
              title={t('common.actions.edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(goal.id)}
              aria-label={t('common.actions.delete')}
              title={t('common.actions.delete')}
            >
              <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Anel de progresso centralizado */}
        <div className="my-md relative flex justify-center">
          <ProgressRing pct={pct} size={80} color={config.ringColor} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold ${config.color}`}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Valores */}
        <div className="space-y-xs text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t('pages.financialGoals.columns.current')}
            </span>
            <span className={`font-semibold ${config.color}`}>
              {formatCurrency(currentVal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t('pages.financialGoals.columns.target')}
            </span>
            <span className="font-semibold">{formatCurrency(targetVal)}</span>
          </div>
          {goal.vaults_count > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('pages.financialGoals.columns.vaults')}
              </span>
              <Badge variant="outline" className="text-xs">
                {t('pages.financialGoals.vaultsCount', { count: goal.vaults_count })}
              </Badge>
            </div>
          )}
        </div>

        {/* Prazo */}
        {daysLeft !== null && (
          <div
            className={`mt-sm text-center text-xs font-medium ${
              daysLeft <= 0
                ? 'text-destructive'
                : daysLeft <= 30
                  ? 'text-warning'
                  : 'text-muted-foreground'
            }`}
          >
            {daysLeft > 0
              ? t('pages.financialGoals.daysLeft', { count: daysLeft })
              : t('pages.financialGoals.deadlinePassed')}
          </div>
        )}

        {/* Conquista */}
        {goal.is_completed && (
          <div className="mt-sm gap-xs text-success flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-semibold">
              {t('pages.financialGoals.goalCompletedLabel')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TRANSACTION_BASED_CATEGORIES = new Set(['reduce_expenses', 'increase_revenue']);

const EMPTY_GOALS: FinancialGoalListItem[] = [];
const EMPTY_VAULTS: Vault[] = [];
const EMPTY_ACCOUNTS: Account[] = [];

export default function FinancialGoals() {
  const { t } = useTranslation();
  const todayTimestamp = useNow();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVaultsDialogOpen, setIsVaultsDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FinancialGoal | undefined>();
  const [selectedGoalForVaults, setSelectedGoalForVaults] = useState<
    FinancialGoal | undefined
  >();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVaultIds, setSelectedVaultIds] = useState<number[]>([]);

  // Form state
  const [formData, setFormData] = useState<FinancialGoalFormData>({
    description: '',
    category: 'savings',
    target_value: 0,
    vaults: [],
    target_date: '',
    is_active: true,
    notes: '',
    linked_expense_category: '',
    linked_account: null,
  });

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['financial-goals'],
    queryFn: async () => {
      try {
        const [goalsData, vaultsData, accountsData] = await Promise.all([
          financialGoalsService.getAll(),
          vaultsService.getAll({ is_active: true }),
          accountsService.getAll(),
        ]);
        return { goals: goalsData, vaults: vaultsData, accounts: accountsData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return { goals: EMPTY_GOALS, vaults: EMPTY_VAULTS, accounts: EMPTY_ACCOUNTS };
      }
    },
  });
  const goals = pageData?.goals ?? EMPTY_GOALS;
  const vaults = pageData?.vaults ?? EMPTY_VAULTS;
  const accounts = pageData?.accounts ?? EMPTY_ACCOUNTS;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['financial-goals'] });

  const handleCreate = () => {
    setSelectedGoal(undefined);
    setFormData({
      description: '',
      category: 'savings',
      target_value: 0,
      vaults: [],
      target_date: '',
      is_active: true,
      notes: '',
      linked_expense_category: '',
      linked_account: null,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = async (goalItem: FinancialGoalListItem) => {
    try {
      const goal = await financialGoalsService.getById(goalItem.id);
      setSelectedGoal(goal);
      setFormData({
        description: goal.description,
        category: goal.category,
        target_value: parseFloat(goal.target_value),
        vaults: goal.vaults,
        target_date: goal.target_date || '',
        is_active: goal.is_active,
        notes: goal.notes || '',
        linked_expense_category: goal.linked_expense_category || '',
        linked_account: goal.linked_account ?? null,
      });
      setIsDialogOpen(true);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.financialGoals.deleteTitle'),
      description: t('pages.financialGoals.deleteDesc'),
    });

    if (confirmed) {
      try {
        await financialGoalsService.delete(id);
        toast({
          title: t('pages.financialGoals.deleted'),
          description: t('pages.financialGoals.deletedDesc'),
        });
        void refresh();
      } catch (error: unknown) {
        toast({
          title: t('common.messages.deleteError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.description || formData.target_value <= 0) {
      toast({
        title: t('common.messages.invalidData'),
        description: t('common.messages.fillRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedGoal) {
        await financialGoalsService.update(selectedGoal.id, formData);
        toast({
          title: t('pages.financialGoals.updated'),
          description: t('pages.financialGoals.updatedDesc'),
        });
      } else {
        await financialGoalsService.create(formData);
        toast({
          title: t('pages.financialGoals.created'),
          description: t('pages.financialGoals.createdDesc'),
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

  const handleManageVaults = async (goalItem: FinancialGoalListItem) => {
    try {
      const goal = await financialGoalsService.getById(goalItem.id);
      setSelectedGoalForVaults(goal);
      setSelectedVaultIds(goal.vaults);
      setIsVaultsDialogOpen(true);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSaveVaults = async () => {
    if (!selectedGoalForVaults) return;

    try {
      setIsSubmitting(true);

      // Find vaults to add and remove
      const currentVaults = selectedGoalForVaults.vaults;
      const vaultsToAdd = selectedVaultIds.filter((id) => !currentVaults.includes(id));
      const vaultsToRemove = currentVaults.filter(
        (id) => !selectedVaultIds.includes(id)
      );

      if (vaultsToAdd.length > 0) {
        await financialGoalsService.addVaults(selectedGoalForVaults.id, vaultsToAdd);
      }
      if (vaultsToRemove.length > 0) {
        await financialGoalsService.removeVaults(
          selectedGoalForVaults.id,
          vaultsToRemove
        );
      }

      toast({
        title: t('pages.financialGoals.vaultsUpdated'),
        description: t('pages.financialGoals.vaultsUpdatedDesc'),
      });
      setIsVaultsDialogOpen(false);
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

  const handleCheckCompletion = async (goal: FinancialGoalListItem) => {
    try {
      const response = await financialGoalsService.checkCompletion(goal.id);
      if (response.is_completed) {
        toast({
          title: t('pages.financialGoals.goalCompleted'),
          description: t('pages.financialGoals.goalCompletedDesc'),
        });
      } else {
        toast({
          title: t('pages.financialGoals.goalInProgress'),
          description: `${response.progress_percentage.toFixed(1)}% (${formatCurrency(response.current_value)} / ${formatCurrency(response.target_value)})`,
        });
      }
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const toggleVault = (vaultId: number) => {
    setSelectedVaultIds((prev) =>
      prev.includes(vaultId) ? prev.filter((id) => id !== vaultId) : [...prev, vaultId]
    );
  };

  // Calculate totals
  const activeGoals = goals.filter((g) => g.is_active && !g.is_completed);
  const completedGoals = goals.filter((g) => g.is_completed);
  const totalTargetValue = goals.reduce(
    (sum, g) => sum + parseFloat(g.target_value),
    0
  );
  const totalCurrentValue = goals.reduce(
    (sum, g) => sum + parseFloat(g.current_value),
    0
  );

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.financialGoals.title')}
        icon={<Target />}
        action={{
          label: t('pages.financialGoals.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      {/* Summary Cards */}
      <div className="mb-lg gap-md grid grid-cols-1 md:grid-cols-4">
        <Card className="border-t-primary border-t-2">
          <CardHeader className="pb-sm">
            <CardTitle className="gap-sm flex items-center text-sm font-medium">
              <Target className="text-primary h-4 w-4" />
              {t('pages.financialGoals.activeGoals')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGoals.length}</div>
          </CardContent>
        </Card>
        <Card className="border-t-success border-t-2">
          <CardHeader className="pb-sm">
            <CardTitle className="gap-sm flex items-center text-sm font-medium">
              <CheckCircle2 className="text-success h-4 w-4" />
              {t('pages.financialGoals.completedGoals')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-success text-2xl font-bold">
              {completedGoals.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-success border-t-2">
          <CardHeader className="pb-sm">
            <CardTitle className="gap-sm flex items-center text-sm font-medium">
              <PiggyBank className="text-success h-4 w-4" />
              {t('pages.financialGoals.accumulatedAmount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-success text-2xl font-bold">
              {formatCurrency(totalCurrentValue)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-muted-foreground border-t-2">
          <CardHeader className="pb-sm">
            <CardTitle className="gap-sm flex items-center text-sm font-medium">
              <TrendingUp className="text-muted-foreground h-4 w-4" />
              {t('pages.financialGoals.totalAmount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTargetValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Cards Grid */}
      {isLoading ? (
        <LoadingState />
      ) : goals.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
          <Target className="mb-md h-12 w-12" />
          <p>{t('pages.financialGoals.emptyState')}</p>
        </div>
      ) : (
        <div className="gap-md grid md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              todayTimestamp={todayTimestamp}
              t={t}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onManageVaults={handleManageVaults}
              onCheckCompletion={handleCheckCompletion}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedGoal
                ? t('pages.financialGoals.editTitle')
                : t('pages.financialGoals.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedGoal
                ? t('pages.financialGoals.editDesc')
                : t('pages.financialGoals.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-lg">
            {/* Seção: Identificação */}
            <FormSection title={t('common.form.sections.basicInfo')} icon={Target}>
              <div className="space-y-md">
                <div className="space-y-sm">
                  <Label htmlFor="description" className="gap-xs flex items-center">
                    <FileText className="text-muted-foreground h-3.5 w-3.5" />
                    {t('common.fields.description')} *
                  </Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder={t('pages.financialGoals.form.descriptionPlaceholder')}
                  />
                </div>

                {/* Grid visual de categorias */}
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <Tag className="text-muted-foreground h-3.5 w-3.5" />
                    {t('common.fields.category')} *
                  </Label>
                  <div className="gap-xs grid grid-cols-3">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: cat.value })
                        }
                        className={`gap-xs px-sm py-xs flex items-center rounded border text-xs font-medium transition-all ${
                          formData.category === cat.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {(() => {
                          const CatIcon =
                            FINANCIAL_GOAL_CATEGORY_ICONS[cat.value] ??
                            FINANCIAL_GOAL_CATEGORY_ICONS['other'];
                          return CatIcon ? (
                            <CatIcon className="h-3.5 w-3.5 shrink-0" />
                          ) : null;
                        })()}
                        <span className="truncate">
                          {t(`pages.financialGoals.categories.${cat.value}`)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.category === 'reduce_expenses' && (
                  <div className="space-y-sm">
                    <Label className="gap-xs flex items-center">
                      <Tag className="text-muted-foreground h-3.5 w-3.5" />
                      {t('pages.financialGoals.form.linkedExpenseCategoryLabel')}
                    </Label>
                    <Select
                      value={formData.linked_expense_category || ''}
                      onValueChange={(value) =>
                        setFormData({ ...formData, linked_expense_category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'pages.financialGoals.form.linkedExpenseCategoryPlaceholder'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES_CANONICAL.map((cat) => {
                          const CatIcon = EXPENSE_CATEGORY_ICONS[cat.key];
                          return (
                            <SelectItem key={cat.key} value={cat.key}>
                              <span className="gap-sm flex items-center">
                                {CatIcon && <CatIcon className="h-4 w-4" />}
                                {translate('expenseCategories', cat.key)}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {TRANSACTION_BASED_CATEGORIES.has(formData.category) && (
                  <div className="space-y-sm">
                    <Label className="gap-xs flex items-center">
                      <Link className="text-muted-foreground h-3.5 w-3.5" />
                      {t('pages.financialGoals.form.linkedAccountLabel')}
                    </Label>
                    <Select
                      value={formData.linked_account?.toString() ?? ''}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          linked_account: value ? parseInt(value, 10) : null,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            'pages.financialGoals.form.linkedAccountPlaceholder'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id.toString()}>
                            {acc.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </FormSection>

            {/* Seção: Valores e Prazo */}
            <FormSection title={t('common.form.sections.values')} icon={Wallet}>
              <div className="gap-md grid grid-cols-2">
                <div className="space-y-sm col-span-2">
                  <Label htmlFor="target_value" className="gap-xs flex items-center">
                    <Wallet className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.financialGoals.targetValueLabel')}
                  </Label>
                  <CurrencyInput
                    id="target_value"
                    accentColor="success"
                    value={formData.target_value}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        target_value: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-sm col-span-2">
                  <Label htmlFor="target_date" className="gap-xs flex items-center">
                    <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.financialGoals.targetDateLabel')}
                  </Label>
                  <DatePicker
                    value={formData.target_date || ''}
                    onChange={(date) =>
                      setFormData({
                        ...formData,
                        target_date: date ? formatLocalDate(date) : '',
                      })
                    }
                    placeholder={t('common.fields.selectDate')}
                    clearable
                  />
                </div>
              </div>
            </FormSection>

            {/* Seção: Configuração */}
            <FormSection title={t('common.form.sections.configuration')} icon={Sliders}>
              <div className="space-y-md">
                {/* Cofres associados */}
                <div className="space-y-sm">
                  <Label className="gap-xs flex items-center">
                    <PiggyBank className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.financialGoals.associatedVaults')}
                  </Label>
                  <div className="space-y-xs border-border/60 p-sm max-h-[140px] overflow-y-auto rounded-md border">
                    {vaults.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {t('pages.financialGoals.noVaults')}
                      </p>
                    ) : (
                      vaults.map((vault) => {
                        const isSelected = formData.vaults.includes(vault.id);
                        return (
                          <button
                            key={vault.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setFormData({
                                  ...formData,
                                  vaults: formData.vaults.filter(
                                    (id) => id !== vault.id
                                  ),
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  vaults: [...formData.vaults, vault.id],
                                });
                              }
                            }}
                            className={`px-sm py-xs flex w-full items-center justify-between rounded text-left text-sm transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <span>{vault.description}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatCurrency(parseFloat(vault.current_balance))}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-sm">
                  <Label htmlFor="notes" className="gap-xs flex items-center">
                    <FileText className="text-muted-foreground h-3.5 w-3.5" />
                    {t('common.fields.notes')}
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder={t('pages.financialGoals.form.notesPlaceholder')}
                    rows={2}
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, is_active: !formData.is_active })
                  }
                  className={`gap-sm p-sm flex w-full items-start rounded-lg border text-left transition-all ${
                    formData.is_active
                      ? 'border-success/50 bg-success/5 ring-success/20 ring-1'
                      : 'border-border/60 bg-muted/20 opacity-70'
                  }`}
                >
                  <div
                    className={`mt-0.5 rounded-full p-1 ${
                      formData.is_active
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {t('pages.financialGoals.activeGoal')}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formData.is_active
                        ? t('pages.financialGoals.activeGoalDesc')
                        : t('pages.financialGoals.inactiveGoalDesc')}
                    </p>
                  </div>
                </button>
              </div>
            </FormSection>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting || !formData.description || formData.target_value <= 0
              }
            >
              {isSubmitting
                ? t('common.actions.saving')
                : selectedGoal
                  ? t('common.actions.save')
                  : t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Vaults Dialog */}
      <Dialog open={isVaultsDialogOpen} onOpenChange={setIsVaultsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.financialGoals.manageVaults')}</DialogTitle>
            <DialogDescription>
              {selectedGoalForVaults &&
                t('pages.financialGoals.manageVaultsDesc', {
                  name: selectedGoalForVaults.description,
                })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-sm max-h-[300px] overflow-y-auto rounded-md border p-3">
            {vaults.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t('pages.financialGoals.noVaults')}
              </p>
            ) : (
              vaults.map((vault) => (
                <div
                  key={vault.id}
                  className="gap-sm p-sm hover:bg-muted/50 flex items-center rounded"
                >
                  <Checkbox
                    id={`manage-vault-${vault.id}`}
                    checked={selectedVaultIds.includes(vault.id)}
                    onCheckedChange={() => toggleVault(vault.id)}
                  />
                  <Label
                    htmlFor={`manage-vault-${vault.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{vault.description}</div>
                        <div className="text-muted-foreground text-xs">
                          {vault.account_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-success font-semibold">
                          {formatCurrency(parseFloat(vault.current_balance))}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          +{formatCurrency(parseFloat(vault.accumulated_yield))}{' '}
                          {t('pages.financialGoals.yields')}
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVaultsDialogOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={handleSaveVaults} disabled={isSubmitting}>
              {isSubmitting ? t('common.actions.saving') : t('common.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
