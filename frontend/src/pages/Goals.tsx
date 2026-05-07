import {
  Plus,
  Trophy,
  Edit,
  Trash2,
  RefreshCw,
  RotateCcw,
  Clock,
  Flame,
  Calendar,
  Ban,
  Star,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { GoalForm } from '@/components/personal-planning/GoalForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/circular-progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type goalSchema } from '@/lib/validations';
import { goalsService } from '@/services/goals-service';
import { routineTasksService } from '@/services/routine-tasks-service';
import type { Goal, RoutineTask, GoalFormData as GoalApiFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type GoalFormData = z.infer<typeof goalSchema>;

const GOAL_TYPE_META: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  consecutive_days: {
    icon: Flame,
    label: 'Dias Consecutivos',
    color: 'text-orange-500 bg-orange-500/15',
  },
  total_days: {
    icon: Calendar,
    label: 'Total de Dias',
    color: 'text-info bg-info/15',
  },
  avoid_habit: {
    icon: Ban,
    label: 'Evitar Hábito',
    color: 'text-destructive bg-destructive/15',
  },
  custom: {
    icon: Star,
    label: 'Personalizado',
    color: 'text-primary bg-primary/15',
  },
};

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onRecalculate,
  onReset,
}: {
  goal: Goal;
  onEdit: (g: Goal) => void;
  onDelete: (id: number) => void;
  onRecalculate: (g: Goal) => void;
  onReset: (g: Goal) => void;
}) {
  const { t } = useTranslation();
  const pct = goal.progress_percentage;
  const typeMeta = GOAL_TYPE_META[goal.goal_type] ?? GOAL_TYPE_META.custom;
  const TypeIcon = typeMeta.icon;

  const days = goal.days_until_deadline;
  const isUrgent = days !== null && days !== undefined && days <= 7 && days >= 0;
  const isOverdue = days !== null && days !== undefined && days < 0;

  const ringColor =
    goal.status === 'completed'
      ? 'hsl(var(--chart-2))'
      : isOverdue
        ? 'hsl(var(--destructive))'
        : isUrgent
          ? 'hsl(var(--warning))'
          : pct >= 80
            ? 'hsl(var(--chart-2))'
            : 'hsl(var(--primary))';

  const displayValue =
    goal.calculated_current_value !== undefined
      ? goal.calculated_current_value
      : goal.current_value;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-shadow hover:shadow-md',
        isUrgent && goal.status === 'active' && 'ring-1 ring-warning/50',
        isOverdue && goal.status === 'active' && 'ring-1 ring-destructive/50'
      )}
    >
      {isUrgent && goal.status === 'active' && (
        <div className="absolute right-3 top-3 h-2.5 w-2.5 animate-pulse rounded-full bg-warning" />
      )}
      {isOverdue && goal.status === 'active' && (
        <div className="absolute right-3 top-3 h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
      )}

      <CardContent className="p-5">
        {/* Header: ícone do tipo + título */}
        <div className="mb-4 flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              typeMeta.color
            )}
          >
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold leading-tight">{goal.title}</h3>
            <p className="text-xs text-muted-foreground">{goal.goal_type_display}</p>
          </div>
        </div>

        {/* Progresso circular + stats */}
        <div className="mb-4 flex items-center gap-4">
          <CircularProgress value={pct} size={72} strokeWidth={6} color={ringColor}>
            <span className="text-sm font-bold">{pct.toFixed(0)}%</span>
          </CircularProgress>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('pages.goals.columns.progress')}
              </span>
              <span className="font-medium">
                {displayValue} / {goal.target_value}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('pages.goals.columns.activeDays')}
              </span>
              <span className="font-medium">{goal.days_active}</span>
            </div>
            {goal.deadline && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('pages.goals.columns.deadline')}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1 font-medium',
                    isOverdue && 'text-destructive',
                    isUrgent && !isOverdue && 'text-warning'
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {isOverdue
                    ? t('pages.goals.deadlineOverdue', { days: Math.abs(days ?? 0) })
                    : days === 0
                      ? t('pages.goals.deadlineToday')
                      : t('pages.goals.deadlineDays', { days })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status + ações */}
        <div className="flex items-center justify-between border-t pt-3">
          <Badge
            className={cn(
              goal.status === 'active' && 'bg-info',
              goal.status === 'completed' && 'bg-success',
              goal.status === 'failed' && 'bg-destructive',
              goal.status === 'cancelled' && 'bg-muted'
            )}
          >
            {goal.status_display}
          </Badge>
          <div className="flex gap-1">
            {goal.goal_type === 'consecutive_days' && goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRecalculate(goal)}
                title={t('pages.goals.recalculateBtn')}
                aria-label={t('pages.goals.recalculateBtn')}
              >
                <RefreshCw className="h-4 w-4 text-primary" />
              </Button>
            )}
            {goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onReset(goal)}
                title={t('pages.goals.resetBtn2')}
                aria-label={t('pages.goals.resetBtn2')}
              >
                <RotateCcw className="h-4 w-4 text-warning" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(goal)}
              title={t('common.actions.edit')}
              aria-label={t('common.actions.edit')}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(goal.id)}
              title={t('common.actions.delete')}
              aria-label={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

  if (isLoading) return <LoadingState />;

  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');
  const otherGoals = goals.filter(
    (g) => g.status !== 'active' && g.status !== 'completed'
  );

  const cardProps = {
    onEdit: handleEdit,
    onDelete: (id: number) => void handleDelete(id),
    onRecalculate: (g: Goal) => void handleRecalculate(g),
    onReset: (g: Goal) => void handleReset(g),
  };

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

      {goals.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-12 w-12" />}
          title={t('pages.goals.emptyState')}
          message={t('pages.goals.emptyStateDesc')}
        />
      ) : (
        <div className="space-y-8">
          {activeGoals.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-info" />
                {t('pages.goals.sectionActive')} ({activeGoals.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} {...cardProps} />
                ))}
              </div>
            </section>
          )}

          {completedGoals.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                {t('pages.goals.sectionCompleted')} ({completedGoals.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} {...cardProps} />
                ))}
              </div>
            </section>
          )}

          {otherGoals.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                {t('pages.goals.sectionOther')} ({otherGoals.length})
              </h2>
              <div className="grid gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
                {otherGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} {...cardProps} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

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
