import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Target, CheckCircle2, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { vaultsService, financialGoalsService } from '@/services/vaults-service';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getErrorMessage } from '@/utils/error-utils';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import type {
  FinancialGoal,
  FinancialGoalListItem,
  FinancialGoalFormData,
  Vault,
} from '@/types';
import { FINANCIAL_GOAL_CATEGORIES as CATEGORIES } from '@/types';
import { PageContainer } from '@/components/common/PageContainer';

export default function FinancialGoals() {
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
        title: 'Erro ao carregar dados',
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
        title: 'Erro ao carregar meta',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir meta',
      description:
        'Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.',
    });

    if (confirmed) {
      try {
        await financialGoalsService.delete(id);
        toast({
          title: 'Meta excluída',
          description: 'A meta foi excluída com sucesso.',
        });
        void loadData();
      } catch (error: unknown) {
        toast({
          title: 'Erro ao excluir',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.description || formData.target_value <= 0) {
      toast({
        title: 'Dados inválidos',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedGoal) {
        await financialGoalsService.update(selectedGoal.id, formData);
        toast({
          title: 'Meta atualizada',
          description: 'A meta foi atualizada com sucesso.',
        });
      } else {
        await financialGoalsService.create(formData);
        toast({ title: 'Meta criada', description: 'A meta foi criada com sucesso.' });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
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
        title: 'Erro ao carregar meta',
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
        title: 'Cofres atualizados',
        description: 'Os cofres da meta foram atualizados.',
      });
      setIsVaultsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar cofres',
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
          title: 'Meta concluída!',
          description: 'Parabéns! Você atingiu sua meta.',
        });
      } else {
        toast({
          title: 'Meta em andamento',
          description: `Progresso: ${response.progress_percentage.toFixed(1)}% (${formatCurrency(response.current_value)} / ${formatCurrency(response.target_value)})`,
        });
      }
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro',
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
      label: 'Descrição',
      render: (goal) => (
        <div>
          <div className="font-medium">{goal.description}</div>
          <div className="text-xs text-muted-foreground">{goal.category_display}</div>
        </div>
      ),
    },
    {
      key: 'progress',
      label: 'Progresso',
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
      label: 'Cofres',
      render: (goal) => <Badge variant="outline">{goal.vaults_count} cofre(s)</Badge>,
    },
    {
      key: 'target_date',
      label: 'Data Alvo',
      render: (goal) => (goal.target_date ? formatDate(goal.target_date) : '-'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (goal) => (
        <Badge
          variant={
            goal.is_completed ? 'default' : goal.is_active ? 'secondary' : 'outline'
          }
        >
          {goal.is_completed ? 'Concluída' : goal.is_active ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (goal) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleManageVaults(goal)}
            aria-label="Gerenciar Cofres"
          >
            <Link className="h-4 w-4 text-info" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCheckCompletion(goal)}
            aria-label="Verificar Conclusão"
            disabled={goal.is_completed}
          >
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(goal)}
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(goal.id)}
            aria-label="Excluir"
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
        title="Metas Financeiras"
        icon={<Target />}
        action={{
          label: 'Nova Meta',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Metas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGoals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Metas Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {completedGoals.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalCurrentValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor Total das Metas</CardTitle>
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
        emptyState={{ message: 'Nenhuma meta cadastrada' }}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
            <DialogDescription>
              {selectedGoal
                ? 'Altere os dados da meta abaixo.'
                : 'Preencha os dados para criar uma nova meta financeira.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Descrição *</Label>
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
              <Label htmlFor="category">Categoria *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
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
              <Label htmlFor="target_value">Valor Alvo *</Label>
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
              <Label htmlFor="target_date">Data Alvo</Label>
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
              <Label>Cofres Associados</Label>
              <div className="mt-1 max-h-[150px] space-y-2 overflow-y-auto rounded-md border p-3">
                {vaults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum cofre disponível
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
              <Label htmlFor="notes">Observações</Label>
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
              <Label htmlFor="is_active">Meta ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting || !formData.description || formData.target_value <= 0
              }
            >
              {isSubmitting ? 'Salvando...' : selectedGoal ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Vaults Dialog */}
      <Dialog open={isVaultsDialogOpen} onOpenChange={setIsVaultsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Cofres</DialogTitle>
            <DialogDescription>
              {selectedGoalForVaults && (
                <>
                  Selecione os cofres que contribuem para a meta "
                  {selectedGoalForVaults.description}".
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-md border p-3">
            {vaults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cofre disponível</p>
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
                          rendimentos
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
              Cancelar
            </Button>
            <Button onClick={handleSaveVaults} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
