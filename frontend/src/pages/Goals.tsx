import { Plus, Trophy, Edit, Trash2, RefreshCw, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { type z } from 'zod';

import { DataTable, type Column } from '@/components/common/DataTable';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { GoalForm } from '@/components/personal-planning/GoalForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { type goalSchema } from '@/lib/validations';
import { goalsService } from '@/services/goals-service';
import { routineTasksService } from '@/services/routine-tasks-service';
import type { Goal, RoutineTask, GoalFormData as GoalApiFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type GoalFormData = z.infer<typeof goalSchema>;

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<Goal | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [goalsData, tasksData] = await Promise.all([
        goalsService.getAll(),
        routineTasksService.getAll(),
      ]);
      setGoals(goalsData);
      setTasks(tasksData);
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
    setIsDialogOpen(true);
  };

  const handleEdit = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir objetivo',
      description:
        'Tem certeza que deseja excluir este objetivo? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await goalsService.delete(id);
      toast({
        title: 'Objetivo excluído',
        description: 'O objetivo foi excluído com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir objetivo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleRecalculate = async (goal: Goal) => {
    if (goal.goal_type !== 'consecutive_days') {
      toast({
        title: 'Ação não disponível',
        description:
          'Recálculo automático só está disponível para objetivos de dias consecutivos.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await goalsService.recalculate(goal.id);
      toast({
        title: 'Progresso recalculado',
        description: `Progresso atualizado para ${goal.days_active} dias.`,
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao recalcular',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleReset = async (goal: Goal) => {
    const confirmed = await showConfirm({
      title: 'Resetar progresso',
      description: `Tem certeza que deseja resetar o progresso do objetivo "${goal.title}"? O contador será zerado e a data de início será atualizada para hoje.`,
      confirmText: 'Resetar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await goalsService.reset(goal.id);
      toast({
        title: 'Progresso resetado',
        description: 'O progresso foi resetado. Comece novamente!',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao resetar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: GoalFormData) => {
    try {
      setIsSubmitting(true);
      // Convert null to undefined for API compatibility
      const apiData = {
        ...data,
        related_task: data.related_task === null ? undefined : data.related_task,
      };

      if (selectedGoal) {
        await goalsService.update(selectedGoal.id, apiData as GoalApiFormData);
        toast({
          title: 'Objetivo atualizado',
          description: 'O objetivo foi atualizado com sucesso.',
        });
      } else {
        await goalsService.create(apiData as GoalApiFormData);
        toast({
          title: 'Objetivo criado',
          description: 'O objetivo foi criado com sucesso.',
        });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-info';
      case 'completed':
        return 'bg-success';
      case 'failed':
        return 'bg-destructive';
      case 'cancelled':
        return 'bg-muted';
      default:
        return 'bg-muted';
    }
  };

  // Define table columns
  const columns: Column<Goal>[] = [
    {
      key: 'title',
      label: 'Título',
      render: (goal) => <div className="font-medium">{goal.title}</div>,
    },
    {
      key: 'goal_type',
      label: 'Tipo',
      render: (goal) => <Badge variant="secondary">{goal.goal_type_display}</Badge>,
    },
    {
      key: 'related_task',
      label: 'Tarefa Relacionada',
      render: (goal) => (
        <span className="text-sm">{goal.related_task_name || '-'}</span>
      ),
    },
    {
      key: 'progress',
      label: 'Progresso',
      render: (goal) => {
        // Usar calculated_current_value quando disponível (para objetivos com tarefa relacionada)
        const displayValue =
          goal.calculated_current_value !== undefined
            ? goal.calculated_current_value
            : goal.current_value;
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>
                {displayValue} / {goal.target_value}
              </span>
              <span className="font-medium">
                {goal.progress_percentage.toFixed(0)}%
              </span>
            </div>
            <Progress value={goal.progress_percentage} className="h-2" />
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (goal) => (
        <Badge className={getStatusColor(goal.status)}>{goal.status_display}</Badge>
      ),
    },
    {
      key: 'days_active',
      label: 'Dias Ativos',
      align: 'center',
      render: (goal) => <span className="text-sm font-medium">{goal.days_active}</span>,
    },
    {
      key: 'actions',
      label: 'Ações',
      align: 'center',
      render: (goal) => (
        <div className="flex justify-center gap-1">
          {goal.goal_type === 'consecutive_days' && goal.status === 'active' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRecalculate(goal)}
              aria-label="Recalcular progresso"
            >
              <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
            </Button>
          )}
          {goal.status === 'active' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleReset(goal)}
              aria-label="Resetar progresso"
            >
              <RotateCcw className="h-4 w-4 text-warning" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(goal)}
            aria-label="Editar"
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
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

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Objetivos"
        icon={<Trophy />}
        action={{
          label: 'Novo Objetivo',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <DataTable
        data={goals}
        columns={columns}
        keyExtractor={(goal) => goal.id}
        isLoading={isLoading}
        emptyState={{
          icon: <Trophy className="h-12 w-12" />,
          title: 'Nenhum objetivo encontrado',
          message: 'Comece criando seu primeiro objetivo.',
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedGoal ? 'Editar Objetivo' : 'Novo Objetivo'}
            </DialogTitle>
            <DialogDescription>
              {selectedGoal
                ? 'Atualize as informações do objetivo.'
                : 'Crie um novo objetivo para acompanhar seu progresso.'}
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            goal={selectedGoal}
            routineTasks={tasks}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
