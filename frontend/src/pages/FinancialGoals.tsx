import { Plus, Pencil, Trash2, Target, CheckCircle2, Link } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { vaultsService, financialGoalsService } from '@/services/vaults-service';
import type {
  FinancialGoal,
  FinancialGoalListItem,
  FinancialGoalFormData,
  Vault,
} from '@/types';
import { FINANCIAL_GOAL_CATEGORIES as CATEGORIES } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function FinancialGoals() {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<FinancialGoalListItem[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
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
  });

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [goalsData, vaultsData] = await Promise.all([
        financialGoalsService.getAll(),
        vaultsService.getAll({ is_active: true }),
      ]);
      setGoals(goalsData);
      setVaults(vaultsData);
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

  const columns: Column<FinancialGoalListItem>[] = [
    {
      key: 'description',
      label: t('pages.financialGoals.columns.description'),
      render: (goal) => (
        <div>
          <div className="font-medium">{goal.description}</div>
          <div className="text-xs text-muted-foreground">{goal.category_display}</div>
        </div>
      ),
    },
    {
      key: 'progress',
      label: t('pages.financialGoals.columns.progress'),
      render: (goal) => (
        <div className="min-w-[200px]">
          <div className="mb-1 flex justify-between text-sm">
            <span>{formatCurrency(parseFloat(goal.current_value))}</span>
            <span className="text-muted-foreground">
              {formatCurrency(parseFloat(goal.target_value))}
            </span>
          </div>
          <Progress value={parseFloat(goal.progress_percentage)} className="h-2" />
          <div className="mt-1 text-center text-xs text-muted-foreground">
            {parseFloat(goal.progress_percentage).toFixed(1)}%
          </div>
        </div>
      ),
    },
    {
      key: 'vaults_count',
      label: t('pages.financialGoals.columns.vaults'),
      render: (goal) => (
        <Badge variant="outline">
          {t('pages.financialGoals.vaultsCount', { count: goal.vaults_count })}
        </Badge>
      ),
    },
    {
      key: 'target_date',
      label: t('pages.financialGoals.columns.targetDate'),
      render: (goal) => (goal.target_date ? formatDate(goal.target_date) : '-'),
    },
    {
      key: 'status',
      label: t('pages.financialGoals.columns.status'),
      render: (goal) => (
        <Badge
          variant={
            goal.is_completed ? 'default' : goal.is_active ? 'secondary' : 'outline'
          }
        >
          {goal.is_completed
            ? t('common.status.paid')
            : goal.is_active
              ? t('common.status.active')
              : t('common.status.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('common.table.actions'),
      render: (goal) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleManageVaults(goal)}
            aria-label={t('pages.financialGoals.manageVaults')}
            title={t('pages.financialGoals.manageVaults')}
          >
            <Link className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCheckCompletion(goal)}
            aria-label={t('pages.financialGoals.checkCompletion')}
            title={t('pages.financialGoals.checkCompletion')}
            disabled={goal.is_completed}
          >
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(goal)}
            aria-label={t('common.actions.edit')}
            title={t('common.actions.edit')}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(goal.id)}
            aria-label={t('common.actions.delete')}
            title={t('common.actions.delete')}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

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
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.financialGoals.activeGoals')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGoals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.financialGoals.completedGoals')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {completedGoals.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.financialGoals.accumulatedAmount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalCurrentValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.financialGoals.totalAmount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTargetValue)}</div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={goals}
        columns={columns}
        keyExtractor={(goal) => goal.id}
        isLoading={isLoading}
        emptyState={{ message: t('pages.financialGoals.emptyState') }}
      />

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
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">{t('common.fields.description')} *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Ex: Viagem para Europa"
              />
            </div>
            <div>
              <Label htmlFor="category">{t('common.fields.category')} *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.fields.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="target_value">
                {t('pages.financialGoals.targetValueLabel')}
              </Label>
              <Input
                id="target_value"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.target_value || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target_value: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="target_date">
                {t('pages.financialGoals.targetDateLabel')}
              </Label>
              <Input
                id="target_date"
                type="date"
                value={formData.target_date || ''}
                onChange={(e) =>
                  setFormData({ ...formData, target_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t('pages.financialGoals.associatedVaults')}</Label>
              <div className="mt-1 max-h-[150px] space-y-2 overflow-y-auto rounded-md border p-3">
                {vaults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('pages.financialGoals.noVaults')}
                  </p>
                ) : (
                  vaults.map((vault) => (
                    <div key={vault.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`vault-${vault.id}`}
                        checked={formData.vaults.includes(vault.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              vaults: [...formData.vaults, vault.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              vaults: formData.vaults.filter((id) => id !== vault.id),
                            });
                          }
                        }}
                      />
                      <Label
                        htmlFor={`vault-${vault.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <span>{vault.description}</span>
                        <span className="ml-2 text-muted-foreground">
                          ({formatCurrency(parseFloat(vault.current_balance))})
                        </span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="notes">{t('common.fields.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre a meta..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: !!checked })
                }
              />
              <Label htmlFor="is_active">{t('pages.financialGoals.activeGoal')}</Label>
            </div>
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
          <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-md border p-3">
            {vaults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('pages.financialGoals.noVaults')}
              </p>
            ) : (
              vaults.map((vault) => (
                <div
                  key={vault.id}
                  className="flex items-center gap-2 rounded p-2 hover:bg-muted/50"
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
