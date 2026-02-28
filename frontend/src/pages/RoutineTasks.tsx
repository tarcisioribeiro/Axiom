import { Plus, CheckSquare, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { type z } from 'zod';

import { DataTable, type Column } from '@/components/common/DataTable';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { RoutineTaskForm } from '@/components/personal-planning/RoutineTaskForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getIconByName } from '@/components/ui/icon-picker';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { type routineTaskSchema } from '@/lib/validations';
import { routineTasksService } from '@/services/routine-tasks-service';
import type {
  RoutineTask,
  RoutineTaskFormData as RoutineTaskApiFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type RoutineTaskFormData = z.infer<typeof routineTaskSchema>;

export default function RoutineTasks() {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<RoutineTask | undefined>();
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
      const tasksData = await routineTasksService.getAll();
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
    setSelectedTask(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (task: RoutineTask) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir tarefa',
      description:
        'Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await routineTasksService.delete(id);
      toast({
        title: 'Tarefa excluída',
        description: 'A tarefa foi excluída com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir tarefa',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: RoutineTaskFormData) => {
    try {
      setIsSubmitting(true);
      // Convert null to undefined for API compatibility
      const apiData = {
        ...data,
        weekday: data.weekday === null ? undefined : data.weekday,
        day_of_month: data.day_of_month === null ? undefined : data.day_of_month,
      };

      if (selectedTask) {
        await routineTasksService.update(
          selectedTask.id,
          apiData as RoutineTaskApiFormData
        );
        toast({
          title: 'Tarefa atualizada',
          description: 'A tarefa foi atualizada com sucesso.',
        });
      } else {
        await routineTasksService.create(apiData as RoutineTaskApiFormData);
        toast({
          title: 'Tarefa criada',
          description: 'A tarefa foi criada com sucesso.',
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

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return 'bg-success';
    if (rate >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      health: 'bg-category-health',
      studies: 'bg-category-studies',
      spiritual: 'bg-category-spiritual',
      exercise: 'bg-category-exercise',
      nutrition: 'bg-category-nutrition',
      meditation: 'bg-category-spiritual',
      reading: 'bg-category-studies',
      writing: 'bg-category-work',
      work: 'bg-category-work',
      leisure: 'bg-category-leisure',
      family: 'bg-accent',
      social: 'bg-category-leisure',
      finance: 'bg-category-finance',
      household: 'bg-category-nutrition',
      personal_care: 'bg-category-health',
      other: 'bg-muted',
    };
    return colors[category] || 'bg-muted';
  };

  // Define table columns
  const columns: Column<RoutineTask>[] = [
    {
      key: 'name',
      label: 'Nome',
      render: (task) => {
        const TaskIcon = getIconByName(task.icon);
        return (
          <div className="flex items-center gap-2 font-medium">
            {TaskIcon && (
              <TaskIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span>{task.name}</span>
          </div>
        );
      },
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (task) => (
        <Badge className={getCategoryColor(task.category)}>
          {task.category_display}
        </Badge>
      ),
    },
    {
      key: 'periodicity',
      label: 'Periodicidade',
      render: (task) => (
        <div className="text-sm">
          <div>{task.periodicity_display}</div>
          {task.weekday_display && (
            <div className="text-xs">{task.weekday_display}</div>
          )}
          {task.day_of_month && <div className="text-xs">Dia {task.day_of_month}</div>}
        </div>
      ),
    },
    {
      key: 'target',
      label: 'Meta',
      render: (task) => (
        <span className="text-sm">
          {task.target_quantity} {task.unit}
        </span>
      ),
    },
    {
      key: 'completion_rate',
      label: 'Taxa de Cumprimento',
      align: 'center',
      render: (task) => (
        <Badge className={getCompletionRateColor(task.completion_rate)}>
          {task.completion_rate.toFixed(0)}%
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (task) => (
        <Badge variant={task.is_active ? 'success' : 'secondary'}>
          {task.is_active ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Ações',
      align: 'center',
      render: (task) => (
        <div className="flex justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(task)}
            aria-label="Editar"
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(task.id)}
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
        title="Tarefas Rotineiras"
        icon={<CheckSquare />}
        action={{
          label: 'Nova Tarefa',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <DataTable
        data={tasks}
        columns={columns}
        keyExtractor={(task) => task.id}
        isLoading={isLoading}
        emptyState={{
          icon: <CheckSquare className="h-12 w-12" />,
          title: 'Nenhuma tarefa encontrada',
          message: 'Comece criando sua primeira tarefa rotineira.',
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            <DialogDescription>
              {selectedTask
                ? 'Atualize as informações da tarefa rotineira.'
                : 'Crie uma nova tarefa para acompanhar seus hábitos diários.'}
            </DialogDescription>
          </DialogHeader>
          <RoutineTaskForm
            task={selectedTask}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
