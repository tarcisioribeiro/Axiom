/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Ban,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock,
  Edit,
  Flame,
  History,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shapes,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { GoalForm } from '@/components/personal-planning/GoalForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CircularProgress } from '@/components/ui/circular-progress';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { GOAL_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DURATION } from '@/lib/animations';
import { formatDate } from '@/lib/formatters';
import { cn, formatLocalDate } from '@/lib/utils';
import { type goalSchema } from '@/lib/validations';
import { goalsService } from '@/services/goals-service';
import { routineTasksService } from '@/services/routine-tasks-service';
import type { Goal, RoutineTask, GoalFormData as GoalApiFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type GoalFormData = z.infer<typeof goalSchema>;

const AUTO_GOAL_TYPES = ['consecutive_days', 'total_days', 'avoid_habit'];

const GOAL_STATUS_BADGE: Partial<Record<string, 'info' | 'success' | 'destructive'>> = {
  active: 'info',
  completed: 'success',
  failed: 'destructive',
};

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

const getDisplayValue = (goal: Goal) =>
  goal.calculated_current_value !== undefined
    ? goal.calculated_current_value
    : goal.current_value;

const BADGE_CLASS = 'gap-xs px-sm flex items-center rounded py-0.5 text-xs font-medium';

/** Badges de ritmo, prazo, sequência e datas — exibidos no modal de detalhes. */
function GoalDetails({
  goal,
  onViewFailures,
}: {
  goal: Goal;
  onViewFailures: (g: Goal) => void;
}) {
  const { t } = useTranslation();
  const pct = goal.progress_percentage;
  const isAutoType = AUTO_GOAL_TYPES.includes(goal.goal_type);

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
    <div className="gap-xs flex flex-col items-start">
      {paceStatus && (
        <span className={cn(BADGE_CLASS, paceConfig[paceStatus].className)}>
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
            BADGE_CLASS,
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
      {isAutoType && (
        <>
          <span className={cn(BADGE_CLASS, 'bg-orange-500/10 text-orange-500')}>
            <Flame className="h-3 w-3" />
            {t('pages.goals.currentStreakLabel')}: {getDisplayValue(goal)}
          </span>
          <span className={cn(BADGE_CLASS, 'bg-primary/10 text-primary')}>
            <Award className="h-3 w-3" />
            {t('pages.goals.bestStreakLabel')}: {goal.best_streak}
          </span>
        </>
      )}
      <span className={cn(BADGE_CLASS, 'text-muted-foreground bg-muted/60')}>
        <Calendar className="h-3 w-3" />
        {t('pages.goals.startDateLabelShort')}: {formatDate(goal.start_date)}
      </span>
      {goal.end_date && (
        <span className={cn(BADGE_CLASS, 'text-muted-foreground bg-muted/60')}>
          <Calendar className="h-3 w-3" />
          {t('pages.goals.endDateLabelShort')}: {formatDate(goal.end_date)}
        </span>
      )}
      {isAutoType && goal.failures.length > 0 && (
        <button
          type="button"
          onClick={() => onViewFailures(goal)}
          className={cn(
            BADGE_CLASS,
            'bg-muted/60 text-muted-foreground hover:bg-muted transition-colors'
          )}
        >
          <History className="h-3 w-3" />
          {t('pages.goals.failuresCount', { count: goal.failures.length })}
        </button>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onRecalculate,
  onRegisterFailure,
  onRestart,
  onOpenDetails,
}: {
  goal: Goal;
  onEdit: (g: Goal) => void;
  onDelete: (id: number) => void;
  onRecalculate: (g: Goal) => void;
  onRegisterFailure: (g: Goal) => void;
  onRestart: (g: Goal) => void;
  onOpenDetails: (g: Goal) => void;
}) {
  const { t } = useTranslation();
  const pct = goal.progress_percentage;
  const typeMeta = GOAL_TYPE_META[goal.goal_type] ?? GOAL_TYPE_META.custom;
  const TypeIcon = typeMeta.icon;
  const isAutoType = AUTO_GOAL_TYPES.includes(goal.goal_type);
  const isCompleted = goal.status === 'completed';
  const StatusIcon = GOAL_STATUS_ICONS[goal.status];

  const ringColor = isCompleted
    ? 'hsl(var(--chart-2))'
    : pct >= 80
      ? 'hsl(var(--chart-2))'
      : 'hsl(var(--primary))';

  const displayValue = getDisplayValue(goal);

  return (
    <Card
      role="button"
      tabIndex={0}
      // Cliques/teclas vindos dos botões de ação não abrem os detalhes.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) onOpenDetails(goal);
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpenDetails(goal);
        }
      }}
      className="focus-visible:ring-ring relative cursor-pointer overflow-hidden focus-visible:ring-2 focus-visible:outline-none"
    >
      <CardContent className="p-5 pt-5">
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
                transition={{ duration: DURATION.slow, ease: 'easeOut' }}
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

        <div className="flex items-center justify-between border-t pt-3">
          <Badge
            variant={GOAL_STATUS_BADGE[goal.status] ?? 'secondary'}
            className="gap-xs"
          >
            {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
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
  /** Quando informado, o cabeçalho é renderizado nesse elemento (acima das abas do pai). */
  headerTarget?: HTMLElement | null;
}

const EMPTY_GOALS: Goal[] = [];
// Duas linhas do grid (3 colunas em lg+).
const GOALS_PAGE_SIZE = 6;
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

export default function Goals({ embedded = false, headerTarget }: GoalsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedGoal, setSelectedGoal] = useState<Goal | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failureGoal, setFailureGoal] = useState<Goal | undefined>();
  const [failureDate, setFailureDate] = useState<string>('');
  const [isRegisteringFailure, setIsRegisteringFailure] = useState(false);
  const [viewingFailuresGoal, setViewingFailuresGoal] = useState<Goal | undefined>();
  const [detailsGoal, setDetailsGoal] = useState<Goal | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const detailsTypeMeta = detailsGoal
    ? (GOAL_TYPE_META[detailsGoal.goal_type] ?? GOAL_TYPE_META.custom)
    : undefined;
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
          title: t('pages.goals.loadError', { reason: getErrorMessage(error) }),
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
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleRecalculate = async (goal: Goal) => {
    try {
      await goalsService.recalculate(goal.id);
      toast({
        title: t('pages.goals.recalculatedDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.recalculateError', { reason: getErrorMessage(error) }),
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
        title: t('pages.goals.failureRegisteredDesc'),
      });
      setFailureGoal(undefined);
      setFailureDate('');
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.failureError', { reason: getErrorMessage(error) }),
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
        title: t('pages.goals.restartSuccessDesc'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.restartError', { reason: getErrorMessage(error) }),
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
        });
      } else {
        await goalsService.create(apiData as GoalApiFormData);
        toast({
          title: t('pages.goals.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.goals.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState />;

  // Ativos primeiro, depois concluídos, depois os demais (ordem estável).
  const statusRank = (g: Goal) =>
    g.status === 'active' ? 0 : g.status === 'completed' ? 1 : 2;
  const sortedGoals = [...goals].sort((a, b) => statusRank(a) - statusRank(b));

  const filteredGoals = sortedGoals.filter((g) => {
    if (searchTerm && !g.title.toLowerCase().includes(searchTerm.toLowerCase()))
      return false;
    if (statusFilter !== 'all' && g.status !== statusFilter) return false;
    if (typeFilter !== 'all' && g.goal_type !== typeFilter) return false;
    return true;
  });

  const hasActiveFilters =
    searchTerm !== '' || statusFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const cardProps = {
    onEdit: handleEdit,
    onDelete: (id: number) => void handleDelete(id),
    onRecalculate: (g: Goal) => void handleRecalculate(g),
    onRegisterFailure: handleRegisterFailure,
    onRestart: (g: Goal) => void handleRestart(g),
    onOpenDetails: setDetailsGoal,
  };

  const header = (
    <PageHeader
      title={t('pages.goals.title')}
      icon={<Trophy />}
      action={{
        label: t('pages.goals.newBtn'),
        icon: <Plus className="h-4 w-4" />,
        onClick: handleCreate,
      }}
    />
  );

  return (
    <Wrapper embedded={embedded}>
      {headerTarget ? createPortal(header, headerTarget) : header}

      {goals.length > 0 && (
        <FilterBar
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
          activeFilters={[
            ...(statusFilter !== 'all'
              ? [
                  {
                    key: 'status',
                    label: `${t('common.fields.status')}: ${t(`pages.goals.form.statusOptions.${statusFilter}`)}`,
                    onRemove: () => setStatusFilter('all'),
                  },
                ]
              : []),
            ...(typeFilter !== 'all'
              ? [
                  {
                    key: 'type',
                    label: `${t('pages.goals.allTypes')}: ${t(`pages.goals.goalTypes.${typeFilter}`)}`,
                    onRemove: () => setTypeFilter('all'),
                  },
                ]
              : []),
          ]}
        >
          <FilterField label={t('common.filterLabels.search')} icon={Search}>
            <SearchInput
              placeholder={t('pages.goals.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-44"
            />
          </FilterField>
          <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-40"
                aria-label={t('pages.goals.allStatus')}
                startIcon={<CircleDot className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.goals.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.goals.allStatus')}</SelectItem>
                <SelectItem
                  value="active"
                  icon={<GOAL_STATUS_ICONS.active className="h-4 w-4" />}
                >
                  {t('pages.goals.form.statusOptions.active')}
                </SelectItem>
                <SelectItem
                  value="completed"
                  icon={<GOAL_STATUS_ICONS.completed className="h-4 w-4" />}
                >
                  {t('pages.goals.form.statusOptions.completed')}
                </SelectItem>
                <SelectItem
                  value="failed"
                  icon={<GOAL_STATUS_ICONS.failed className="h-4 w-4" />}
                >
                  {t('pages.goals.form.statusOptions.failed')}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('common.fields.type')} icon={Shapes}>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="w-44"
                aria-label={t('pages.goals.allTypes')}
                startIcon={<Layers className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.goals.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.goals.allTypes')}</SelectItem>
                {Object.entries(GOAL_TYPE_META).map(([key, meta]) => (
                  <SelectItem
                    key={key}
                    value={key}
                    icon={<meta.icon className="h-4 w-4" />}
                  >
                    {t(`pages.goals.goalTypes.${key}`, { defaultValue: meta.label })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
      )}

      {goals.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-12 w-12" />}
          title={t('pages.goals.emptyState')}
        />
      ) : filteredGoals.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-12 w-12" />}
          title={t('pages.goals.emptyState')}
        />
      ) : (
        <PaginatedSlide
          items={filteredGoals}
          pageSize={GOALS_PAGE_SIZE}
          centerList
          className="gap-md grid sm:grid-cols-2 lg:grid-cols-3"
        >
          {(pageGoals) =>
            pageGoals.map((goal) => (
              <div
                key={goal.id}
                className={cn(
                  goal.status !== 'active' &&
                    goal.status !== 'completed' &&
                    'opacity-70'
                )}
              >
                <GoalCard goal={goal} {...cardProps} />
              </div>
            ))
          }
        </PaginatedSlide>
      )}

      {/* Modal edição/criação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle mode={selectedGoal ? 'edit' : 'create'}>
              {selectedGoal ? t('pages.goals.editTitle') : t('pages.goals.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedGoal ? t('pages.goals.editDesc') : t('pages.goals.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <AlertTriangle className="text-warning h-5 w-5" />
              {t('pages.goals.registerFailureTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-sm min-h-[340px]">
            <Label className="gap-xs flex items-center">
              <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.goals.failureDateLabel')}
            </Label>
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
              <X className="h-4 w-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmFailure()}
              disabled={!failureDate || isRegisteringFailure}
            >
              {isRegisteringFailure ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isRegisteringFailure
                ? t('common.actions.saving')
                : t('pages.goals.registerFailureConfirmBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal detalhes do objetivo */}
      <Dialog
        open={!!detailsGoal}
        onOpenChange={(open) => {
          if (!open) setDetailsGoal(undefined);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              {detailsTypeMeta && (
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    detailsTypeMeta.color
                  )}
                >
                  <detailsTypeMeta.icon className="h-4 w-4" />
                </span>
              )}
              {detailsGoal?.title}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {detailsGoal &&
                  t(`pages.goals.goalTypes.${detailsGoal.goal_type}`, {
                    defaultValue: detailsGoal.goal_type_display,
                  })}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {detailsGoal && (
            <GoalDetails goal={detailsGoal} onViewFailures={setViewingFailuresGoal} />
          )}
          <DialogFooter className="sm:justify-start">
            <Button variant="outline" onClick={() => setDetailsGoal(undefined)}>
              <X className="h-4 w-4" />
              {t('common.actions.close')}
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
            <DialogTitle className="gap-sm flex items-center">
              <History className="h-4 w-4" aria-hidden="true" />
              {t('pages.goals.failuresHistoryTitle')}
            </DialogTitle>
            <DialogDescription>{viewingFailuresGoal?.title}</DialogDescription>
          </DialogHeader>
          <PaginatedSlide
            items={viewingFailuresGoal?.failures ?? []}
            pageSize={LIST_PAGE_SIZE}
            pinNav={false}
            className="space-y-sm"
          >
            {(pageFailures) =>
              pageFailures.map((failure) => (
                <div
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
                </div>
              ))
            }
          </PaginatedSlide>
          <DialogCloseFooter />
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
