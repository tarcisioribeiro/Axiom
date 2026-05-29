/* eslint-disable max-lines */
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
import { useState, useEffect, useMemo } from 'react';
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
      icon: <TrendingDown className="h-5 w-5 text-warning" />,
      color: 'text-warning',
      ringColor: 'hsl(var(--warning))',
    },
    increase_revenue: {
      icon: <TrendingUp className="h-5 w-5 text-info" />,
      color: 'text-info',
      ringColor: 'hsl(var(--info))',
    },
  };

  const config = categoryConfig[goal.category] ?? {
    icon: <PiggyBank className="h-5 w-5 text-success" />,
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
          <div className="flex items-center gap-sm">
            {config.icon}
            <div>
              <p className="font-semibold leading-tight">{goal.description}</p>
              <p className="text-xs text-muted-foreground">
                {t(`pages.financialGoals.categories.${goal.category}`, {
                  defaultValue: goal.category_display,
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onManageVaults(goal)}
              aria-label={t('pages.financialGoals.manageVaults')}
              title={t('pages.financialGoals.manageVaults')}
            >
              <Link className="h-4 w-4 text-info" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCheckCompletion(goal)}
              aria-label={t('pages.financialGoals.checkCompletion')}
              title={t('pages.financialGoals.checkCompletion')}
              disabled={goal.is_completed}
            >
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
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
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Anel de progresso centralizado */}
        <div className="relative my-md flex justify-center">
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
          <div className="mt-sm flex items-center justify-center gap-xs text-success">
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

export default function FinancialGoals() {
  const { t } = useTranslation();
  const todayTimestamp = useMemo(() => Date.now(), []);
  const [goals, setGoals] = useState<FinancialGoalListItem[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [goalsData, vaultsData, accountsData] = await Promise.all([
        financialGoalsService.getAll(),
        vaultsService.getAll({ is_active: true }),
        accountsService.getAll(),
      ]);
      setGoals(goalsData);
      setVaults(vaultsData);
      setAccounts(accountsData);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      void loadData();
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
      <div className="mb-lg grid grid-cols-1 gap-md md:grid-cols-4">
        <Card className="border-t-2 border-t-primary">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <Target className="h-4 w-4 text-primary" />
              {t('pages.financialGoals.activeGoals')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGoals.length}</div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-success">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {t('pages.financialGoals.completedGoals')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {completedGoals.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-success">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <PiggyBank className="h-4 w-4 text-success" />
              {t('pages.financialGoals.accumulatedAmount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalCurrentValue)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-muted-foreground">
          <CardHeader className="pb-sm">
            <CardTitle className="flex items-center gap-sm text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
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
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Target className="mb-md h-12 w-12" />
          <p>{t('pages.financialGoals.emptyState')}</p>
        </div>
      ) : (
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
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
                  <Label htmlFor="description" className="flex items-center gap-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
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
                  <Label className="flex items-center gap-xs">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('common.fields.category')} *
                  </Label>
                  <div className="grid grid-cols-3 gap-xs">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: cat.value })
                        }
                        className={`flex items-center gap-xs rounded border px-sm py-xs text-xs font-medium transition-all ${
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
                    <Label className="flex items-center gap-xs">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
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
                )}

                {TRANSACTION_BASED_CATEGORIES.has(formData.category) && (
                  <div className="space-y-sm">
                    <Label className="flex items-center gap-xs">
                      <Link className="h-3.5 w-3.5 text-muted-foreground" />
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
              <div className="grid grid-cols-2 gap-md">
                <div className="col-span-2 space-y-sm">
                  <Label htmlFor="target_value" className="flex items-center gap-xs">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
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

                <div className="col-span-2 space-y-sm">
                  <Label htmlFor="target_date" className="flex items-center gap-xs">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
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
                  <Label className="flex items-center gap-xs">
                    <PiggyBank className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('pages.financialGoals.associatedVaults')}
                  </Label>
                  <div className="max-h-[140px] space-y-xs overflow-y-auto rounded-md border border-border/60 p-sm">
                    {vaults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
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
                            className={`flex w-full items-center justify-between rounded px-sm py-xs text-left text-sm transition-colors ${
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <span>{vault.description}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(parseFloat(vault.current_balance))}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-sm">
                  <Label htmlFor="notes" className="flex items-center gap-xs">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
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
                  className={`flex w-full items-start gap-sm rounded-lg border p-sm text-left transition-all ${
                    formData.is_active
                      ? 'border-success/50 bg-success/5 ring-1 ring-success/20'
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
                    <p className="mt-0.5 text-xs text-muted-foreground">
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
          <div className="max-h-[300px] space-y-sm overflow-y-auto rounded-md border p-3">
            {vaults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('pages.financialGoals.noVaults')}
              </p>
            ) : (
              vaults.map((vault) => (
                <div
                  key={vault.id}
                  className="flex items-center gap-sm rounded p-sm hover:bg-muted/50"
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
                        <div className="text-xs text-muted-foreground">
                          {vault.account_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-success">
                          {formatCurrency(parseFloat(vault.current_balance))}
                        </div>
                        <div className="text-xs text-muted-foreground">
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
