/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trophy,
  Edit,
  Trash2,
  RefreshCw,
  RotateCcw,
  Ban,
  Star,
  Flame,
  Award,
  History,
  Calendar,
  AlertTriangle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Download,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import React, { useState } from 'react';
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
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { cn, formatLocalDate } from '@/lib/utils';
import { type goalSchema } from '@/lib/validations';
import { goalsService } from '@/services/goals-service';
import { routineTasksService } from '@/services/routine-tasks-service';
import type { Goal, RoutineTask, GoalFormData as GoalApiFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type GoalFormData = z.infer<typeof goalSchema>;

const AUTO_GOAL_TYPES = ['consecutive_days', 'total_days', 'avoid_habit'];

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
  onRegisterFailure,
  onRestart,
  onViewFailures,
}: {
  goal: Goal;
  onEdit: (g: Goal) => void;
  onDelete: (id: number) => void;
  onRecalculate: (g: Goal) => void;
  onRegisterFailure: (g: Goal) => void;
  onRestart: (g: Goal) => void;
  onViewFailures: (g: Goal) => void;
}) {
  const { t } = useTranslation();
  const pct = goal.progress_percentage;
  const typeMeta = GOAL_TYPE_META[goal.goal_type] ?? GOAL_TYPE_META.custom;
  const TypeIcon = typeMeta.icon;
  const isAutoType = AUTO_GOAL_TYPES.includes(goal.goal_type);
  const isCompleted = goal.status === 'completed';

  const ringColor = isCompleted
    ? 'hsl(var(--chart-2))'
    : pct >= 80
      ? 'hsl(var(--chart-2))'
      : 'hsl(var(--primary))';

  const displayValue =
    goal.calculated_current_value !== undefined
      ? goal.calculated_current_value
      : goal.current_value;

  // Pace indicator and days remaining
  const today = new Date();
  let paceStatus: 'on_track' | 'at_risk' | 'late' | null = null;
  let daysRemaining: number | null = null;

  if (goal.end_date && goal.status === 'active') {
    const endDate = parseISO(goal.end_date);
    const startDate = parseISO(goal.start_date);
    const totalDays = differenceInDays(endDate, startDate);
    const daysElapsed = differenceInDays(today, startDate);
    daysRemaining = differenceInDays(endDate, today);

    if (totalDays > 0) {
      const expectedPct = Math.min((daysElapsed / totalDays) * 100, 100);
      if (pct >= expectedPct * 0.9) paceStatus = 'on_track';
      else if (pct >= expectedPct * 0.7) paceStatus = 'at_risk';
      else paceStatus = 'late';
    }
  }

  const paceConfig = {
    on_track: {
      label: t('pages.goals.pace.onTrack'),
      className: 'text-success bg-success/10',
    },
    at_risk: {
      label: t('pages.goals.pace.atRisk'),
      className: 'text-warning bg-warning/10',
    },
    late: {
      label: t('pages.goals.pace.late'),
      className: 'text-destructive bg-destructive/10',
    },
  };

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      {/* Completion glow animation */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            key="completion-glow"
            className="bg-success/8 pointer-events-none absolute inset-0 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>
      <CardContent className="p-5">
        <div className="mb-md flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              typeMeta.color
            )}
          >
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate leading-tight font-semibold">{goal.title}</h3>
            <p className="text-muted-foreground text-xs">
              {t(`pages.goals.goalTypes.${goal.goal_type}`, {
                defaultValue: goal.goal_type_display,
              })}
            </p>
          </div>
        </div>

        <div className="mb-md gap-md flex items-center">
          <CircularProgress value={pct} size={72} strokeWidth={6} color={ringColor}>
            <span className="text-sm font-bold">{pct.toFixed(0)}%</span>
          </CircularProgress>
          <div className="space-y-xs flex-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('pages.goals.columns.progress')}
              </span>
              <div className="gap-xs flex items-center font-medium">
                {pct >= 80 ? (
                  <TrendingUp className="text-success h-3.5 w-3.5" />
                ) : pct < 30 ? (
                  <TrendingDown className="text-destructive h-3.5 w-3.5" />
                ) : null}
                <span>
                  {displayValue} / {goal.target_value}
                </span>
              </div>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  pct >= 80 ? 'bg-success' : pct < 30 ? 'bg-destructive' : 'bg-primary'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('pages.goals.columns.activeDays')}
              </span>
              <span className="font-medium">{goal.days_active}</span>
            </div>
          </div>
        </div>

        {/* Pace indicator + days remaining */}
        {(paceStatus || daysRemaining !== null) && (
          <div className="gap-xs mb-3 flex flex-wrap items-center">
            {paceStatus && (
              <span
                className={cn(
                  'gap-xs px-sm flex items-center rounded py-0.5 text-xs font-medium',
                  paceConfig[paceStatus].className
                )}
              >
                {paceStatus === 'on_track' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {paceConfig[paceStatus].label}
              </span>
            )}
            {daysRemaining !== null && (
              <span
                className={cn(
                  'gap-xs px-sm flex items-center rounded py-0.5 text-xs font-medium',
                  daysRemaining < 7
                    ? 'bg-destructive/10 text-destructive'
                    : daysRemaining < 14
                      ? 'bg-warning/10 text-warning'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                <Clock className="h-3 w-3" />
                {daysRemaining > 0
                  ? t('pages.goals.daysRemaining', { count: daysRemaining })
                  : t('pages.goals.overdue')}
              </span>
            )}
          </div>
        )}

        {/* Sequência atual / melhor sequência / histórico de falhas */}
        {isAutoType && (
          <div className="gap-xs mb-3 flex flex-wrap items-center text-xs">
            <span className="gap-xs px-sm flex items-center rounded bg-orange-500/10 py-0.5 font-medium text-orange-500">
              <Flame className="h-3 w-3" />
              {t('pages.goals.currentStreakLabel')}: {displayValue}
            </span>
            <span className="bg-primary/10 gap-xs px-sm text-primary flex items-center rounded py-0.5 font-medium">
              <Award className="h-3 w-3" />
              {t('pages.goals.bestStreakLabel')}: {goal.best_streak}
            </span>
            {goal.end_date && (
              <span className="text-muted-foreground gap-xs px-sm bg-muted/60 flex items-center rounded py-0.5 font-medium">
                <Calendar className="h-3 w-3" />
                {t('pages.goals.endDateLabelShort')}: {formatDate(goal.end_date)}
              </span>
            )}
            {goal.failures.length > 0 && (
              <button
                type="button"
                onClick={() => onViewFailures(goal)}
                className="gap-xs px-sm bg-muted/60 text-muted-foreground hover:bg-muted flex items-center rounded py-0.5 font-medium transition-colors"
              >
                <History className="h-3 w-3" />
                {t('pages.goals.failuresCount', { count: goal.failures.length })}
              </button>
            )}
          </div>
        )}

        {/* Completion badge */}
        {isCompleted && (
          <motion.div
            className="gap-sm text-success mb-3 flex items-center"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Trophy className="h-4 w-4" />
            <span className="text-sm font-semibold">{t('pages.goals.completed')}</span>
          </motion.div>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <Badge
            className={cn(
              goal.status === 'active' && 'bg-info',
              goal.status === 'completed' && 'bg-success',
              goal.status === 'failed' && 'bg-destructive',
              goal.status === 'cancelled' && 'bg-muted'
            )}
          >
            {t(`pages.goals.form.statusOptions.${goal.status}`)}
          </Badge>
          <div className="gap-xs flex">
            {isAutoType && goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRecalculate(goal)}
                title={t('pages.goals.recalculateBtn')}
                aria-label={t('pages.goals.recalculateBtn')}
              >
                <RefreshCw className="text-primary h-4 w-4" />
              </Button>
            )}
            {isAutoType && goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRegisterFailure(goal)}
                title={t('pages.goals.registerFailureBtn')}
                aria-label={t('pages.goals.registerFailureBtn')}
              >
                <AlertTriangle className="text-warning h-4 w-4" />
              </Button>
            )}
            {goal.status === 'active' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRestart(goal)}
                title={t('pages.goals.restartBtn')}
                aria-label={t('pages.goals.restartBtn')}
              >
                <RotateCcw className="text-muted-foreground h-4 w-4" />
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
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface GoalsProps {
  embedded?: boolean;
}

const EMPTY_GOALS: Goal[] = [];
const EMPTY_TASKS: RoutineTask[] = [];

function Wrapper({
  embedded,
  children,
}: {
  embedded: boolean;
  children: React.ReactNode;
}) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function Goals({ embedded = false }: GoalsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedGoal, setSelectedGoal] = useState<Goal | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failureGoal, setFailureGoal] = useState<Goal | undefined>();
  const [failureDate, setFailureDate] = useState<string>('');
  const [isRegisteringFailure, setIsRegisteringFailure] = useState(false);
  const [viewingFailuresGoal, setViewingFailuresGoal] = useState<Goal | undefined>();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      try {
        const [goalsData, tasksData] = await Promise.all([
          goalsService.getAll(),
          routineTasksService.getAll(),
        ]);
        return { goals: goalsData, tasks: tasksData };
      } catch (error: unknown) {
        toast({
          title: t('pages.goals.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return { goals: EMPTY_GOALS, tasks: EMPTY_TASKS };
      }
    },
  });
  const goals = pageData?.goals ?? EMPTY_GOALS;
  const tasks = pageData?.tasks ?? EMPTY_TASKS;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['goals'] });

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
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleRecalculate = async (goal: Goal) => {
    try {
      await goalsService.recalculate(goal.id);
      toast({
        title: t('pages.goals.recalculated'),
        description: t('pages.goals.recalculatedDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.recalculateError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleRegisterFailure = (goal: Goal) => {
    setFailureGoal(goal);
    setFailureDate(formatLocalDate(new Date()));
  };

  const handleConfirmFailure = async () => {
    if (!failureGoal || !failureDate) return;
    try {
      setIsRegisteringFailure(true);
      await goalsService.registerFailure(failureGoal.id, failureDate);
      toast({
        title: t('pages.goals.failureRegistered'),
        description: t('pages.goals.failureRegisteredDesc'),
      });
      setFailureGoal(undefined);
      setFailureDate('');
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.failureError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsRegisteringFailure(false);
    }
  };

  const handleRestart = async (goal: Goal) => {
    const confirmed = await showConfirm({
      title: t('pages.goals.restartTitle'),
      description: t('pages.goals.restartDesc', { name: goal.title }),
      confirmText: t('pages.goals.restartConfirmBtn'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await goalsService.restart(goal.id);
      toast({
        title: t('pages.goals.restartSuccess'),
        description: t('pages.goals.restartSuccessDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.restartError'),
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
        end_date: data.end_date === '' ? null : data.end_date,
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
      void refresh();
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

  const exportGoalsCSV = () => {
    const headers = [
      'Nome',
      'Tipo',
      'Status',
      'Progresso (%)',
      'Dias Ativos',
      'Data Início',
      'Data Fim',
    ];
    const rows: string[][] = goals.map((g): string[] => [
      g.title,
      g.goal_type,
      g.status,
      String(g.progress_percentage),
      String(g.days_active),
      g.start_date,
      g.end_date ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `objetivos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    onRegisterFailure: handleRegisterFailure,
    onRestart: (g: Goal) => void handleRestart(g),
    onViewFailures: setViewingFailuresGoal,
  };

  return (
    <Wrapper embedded={embedded}>
      <PageHeader
        title={t('pages.goals.title')}
        icon={<Trophy />}
        action={{
          label: t('pages.goals.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      >
        {goals.length > 0 && (
          <button
            onClick={exportGoalsCSV}
            className="gap-xs border-border px-sm py-xs text-muted-foreground hover:bg-muted flex items-center rounded-md border text-xs transition-colors"
            title={t('common.actions.exportCSV')}
          >
            <Download className="h-3.5 w-3.5" />
            {t('common.actions.exportCSV')}
          </button>
        )}
      </PageHeader>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-12 w-12" />}
          title={t('pages.goals.emptyState')}
          message={t('pages.goals.emptyStateDesc')}
          action={{
            label: t('pages.goals.emptyStateAction'),
            icon: <Plus className="mr-xs h-4 w-4" />,
            onClick: handleCreate,
          }}
        />
      ) : (
        <div className="space-y-xl">
          {activeGoals.length > 0 && (
            <section>
              <h2 className="gap-sm text-muted-foreground mb-3 flex items-center text-sm font-semibold tracking-wide uppercase">
                <span className="bg-info h-2 w-2 rounded-full" />
                {t('pages.goals.sectionActive')} ({activeGoals.length})
              </h2>
              <div className="gap-md grid sm:grid-cols-2 lg:grid-cols-3">
                {activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} {...cardProps} />
                ))}
              </div>
            </section>
          )}

          {completedGoals.length > 0 && (
            <section>
              <h2 className="gap-sm text-muted-foreground mb-3 flex items-center text-sm font-semibold tracking-wide uppercase">
                <span className="bg-success h-2 w-2 rounded-full" />
                {t('pages.goals.sectionCompleted')} ({completedGoals.length})
              </h2>
              <div className="gap-md grid sm:grid-cols-2 lg:grid-cols-3">
                {completedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} {...cardProps} />
                ))}
              </div>
            </section>
          )}

          {otherGoals.length > 0 && (
            <section>
              <h2 className="gap-sm text-muted-foreground mb-3 flex items-center text-sm font-semibold tracking-wide uppercase">
                <span className="bg-muted-foreground h-2 w-2 rounded-full" />
                {t('pages.goals.sectionOther')} ({otherGoals.length})
              </h2>
              <div className="gap-md grid opacity-70 sm:grid-cols-2 lg:grid-cols-3">
                {otherGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} {...cardProps} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal edição/criação */}
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

      {/* Modal registrar falha */}
      <Dialog
        open={!!failureGoal}
        onOpenChange={(open) => {
          if (!open) {
            setFailureGoal(undefined);
            setFailureDate('');
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('pages.goals.registerFailureTitle')}</DialogTitle>
            <DialogDescription>
              {t('pages.goals.registerFailureDesc', { name: failureGoal?.title })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-sm">
            <Label>{t('pages.goals.failureDateLabel')}</Label>
            <DatePicker
              value={failureDate}
              onChange={(date) => setFailureDate(date ? formatLocalDate(date) : '')}
              placeholder={t('pages.goals.failureDatePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFailureGoal(undefined);
                setFailureDate('');
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmFailure()}
              disabled={!failureDate || isRegisteringFailure}
            >
              {isRegisteringFailure ? (
                <>
                  <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                  {t('common.actions.saving')}
                </>
              ) : (
                t('pages.goals.registerFailureConfirmBtn')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal histórico de falhas */}
      <Dialog
        open={!!viewingFailuresGoal}
        onOpenChange={(open) => {
          if (!open) setViewingFailuresGoal(undefined);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('pages.goals.failuresHistoryTitle')}</DialogTitle>
            <DialogDescription>{viewingFailuresGoal?.title}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-sm max-h-80 overflow-y-auto">
            {viewingFailuresGoal?.failures.map((failure) => (
              <li
                key={failure.id}
                className="gap-sm p-sm flex items-center justify-between rounded-md border text-sm"
              >
                <span className="text-muted-foreground">
                  {formatDate(failure.failure_date)}
                </span>
                <span className="font-medium">
                  {t('pages.goals.failureStreakReached', {
                    count: failure.streak_at_failure,
                  })}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingFailuresGoal(undefined)}>
              {t('common.actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
