import { Plus, Trophy, Edit, Trash2, RefreshCw, RotateCcw, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        title: t('pages.goals.loadError'),
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
      title: t('pages.goals.deleteTitle'),
      description: t('pages.goals.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await goalsService.delete(id);
      toast({
        title: t('pages.goals.deleted'),
        description: t('pages.goals.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleRecalculate = async (goal: Goal) => {
    if (goal.goal_type !== 'consecutive_days') {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.goals.recalculateNotAvailable'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await goalsService.recalculate(goal.id);
      toast({
        title: t('pages.goals.recalculated'),
        description: t('pages.goals.recalculatedDesc', { days: goal.days_active }),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.recalculateError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleReset = async (goal: Goal) => {
    const confirmed = await showConfirm({
      title: t('pages.goals.resetTitle'),
      description: t('pages.goals.resetDesc', { name: goal.title }),
      confirmText: t('pages.goals.resetBtn'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await goalsService.reset(goal.id);
      toast({
        title: t('pages.goals.resetSuccess'),
        description: t('pages.goals.resetSuccessDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.resetError'),
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
          title: t('pages.goals.updated'),
          description: t('pages.goals.updatedDesc'),
        });
      } else {
        await goalsService.create(apiData as GoalApiFormData);
        toast({
          title: t('pages.goals.created'),
          description: t('pages.goals.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.saveError'),
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
      label: t('pages.goals.columns.title'),
      render: (goal) => <div className="font-medium">{goal.title}</div>,
    },
    {
      key: 'goal_type',
      label: t('pages.goals.columns.type'),
      render: (goal) => <Badge variant="secondary">{goal.goal_type_display}</Badge>,
    },
    {
      key: 'related_task',
      label: t('pages.goals.columns.relatedTask'),
      render: (goal) => (
        <span className="text-sm">{goal.related_task_name || '-'}</span>
      ),
    },
    {
      key: 'progress',
      label: t('pages.goals.columns.progress'),
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
      label: t('pages.goals.columns.status'),
      render: (goal) => (
        <Badge className={getStatusColor(goal.status)}>{goal.status_display}</Badge>
      ),
    },
    {
      key: 'deadline',
      label: t('pages.goals.columns.deadline'),
      render: (goal) => {
        if (!goal.deadline) return <span className="text-muted-foreground">-</span>;
        const days = goal.days_until_deadline;
        const urgent = days !== null && days !== undefined && days <= 7 && days >= 0;
        const overdue = days !== null && days !== undefined && days < 0;
        return (
          <div className="flex items-center gap-1">
            <Clock className={`h-3 w-3 ${overdue ? 'text-destructive' : urgent ? 'text-warning' : 'text-muted-foreground'}`} />
            <span className={`text-sm ${overdue ? 'text-destructive font-medium' : urgent ? 'text-warning font-medium' : ''}`}>
              {overdue
                ? t('pages.goals.deadlineOverdue', { days: Math.abs(days ?? 0) })
                : days === 0
                ? t('pages.goals.deadlineToday')
                : t('pages.goals.deadlineDays', { days })}
            </span>
          </div>
        );
      },
    },
    {
      key: 'days_active',
      label: t('pages.goals.columns.activeDays'),
      align: 'center',
      render: (goal) => <span className="text-sm font-medium">{goal.days_active}</span>,
    },
    {
      key: 'actions',
      label: t('common.table.actions'),
      align: 'center',
      render: (goal) => (
        <div className="flex justify-center gap-1">
          {goal.goal_type === 'consecutive_days' && goal.status === 'active' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRecalculate(goal)}
              aria-label={t('pages.goals.recalculateBtn')}
              title={t('pages.goals.recalculateBtn')}
            >
              <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
            </Button>
          )}
          {goal.status === 'active' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleReset(goal)}
              aria-label={t('pages.goals.resetBtn2')}
              title={t('pages.goals.resetBtn2')}
            >
              <RotateCcw className="h-4 w-4 text-warning" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(goal)}
            aria-label={t('common.actions.edit')}
            title={t('common.actions.edit')}
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
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

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.goals.title')}
        icon={<Trophy />}
        action={{
          label: t('pages.goals.newBtn'),
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
          title: t('pages.goals.emptyState'),
          message: t('pages.goals.emptyStateDesc'),
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedGoal ? t('pages.goals.editTitle') : t('pages.goals.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedGoal ? t('pages.goals.editDesc') : t('pages.goals.newDesc')}
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
