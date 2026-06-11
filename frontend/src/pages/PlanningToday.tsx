/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Dumbbell,
  Edit2,
  Flame,
  Loader2,
  Moon,
  Plus,
  Sun,
  Sunset,
  UtensilsCrossed,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { MealLogForm } from '@/components/nutrition/MealLogForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WorkoutSessionForm } from '@/components/workout/WorkoutSessionForm';
import { translate } from '@/config/constants';
import { MOOD_ICONS } from '@/config/icons';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { cn, formatLocalDate } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { appService } from '@/services/app-service';
import { dailyReflectionsService } from '@/services/daily-reflections-service';
import { membersService } from '@/services/members-service';
import { mealLogService, mealTypeService } from '@/services/nutrition-service';
import { taskInstancesService } from '@/services/task-instances-service';
import {
  workoutPlanService,
  workoutSessionExerciseService,
  workoutSessionService,
  workoutSessionSetService,
} from '@/services/workout-service';
import { MOOD_CHOICES } from '@/types';
import type { DailyReflectionFormData, TaskInstance } from '@/types';
import type { MealLogFormData } from '@/types/nutrition';
import type { WorkoutDay } from '@/types/workout';
import { getErrorMessage } from '@/utils/error-utils';

type WorkoutDialogMode = 'log-session';
type NutritionDialogMode = 'log-meal';
type Dialog =
  | { type: WorkoutDialogMode }
  | { type: NutritionDialogMode; prefillMealTypeId?: number }
  | null;

interface SessionFormData {
  workout_day: string;
  date: string;
  started_at: string;
  finished_at: string;
  notes: string;
  exercises: Array<{
    exercise_name: string;
    sets_target: number;
    reps_target_min: number;
    reps_target_max: number;
    order: number;
    sets: Array<{
      set_number: number;
      load: string;
      load_unit: string;
      reps_done: string;
      completed: boolean;
      notes: string;
    }>;
  }>;
}

function SectionCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-sm">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-sm text-base">
            <span className="text-muted-foreground">{icon}</span>
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function PlanningToday() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionMood, setReflectionMood] = useState('');
  const [isEditingReflection, setIsEditingReflection] = useState(false);
  const [isSavingReflection, setIsSavingReflection] = useState(false);

  const { data: today = formatLocalDate(new Date()) } = useQuery({
    queryKey: ['server-date'],
    queryFn: async () => {
      try {
        return await appService.getCurrentDate();
      } catch {
        return formatLocalDate(new Date());
      }
    },
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const ownerId = member?.id ?? 0;

  const { data: tasksResponse, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['today-tasks', today],
    queryFn: () => taskInstancesService.getForDate(today),
    enabled: !!today && ownerId > 0,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: workoutSessions = [], isLoading: isLoadingWorkout } = useQuery({
    queryKey: ['workout-sessions-today', today],
    queryFn: () => workoutSessionService.getByDateRange(today, today),
    enabled: !!today && ownerId > 0,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: workoutPlans = [], isLoading: isLoadingPlan } = useQuery({
    queryKey: ['workout-plans'],
    queryFn: () => workoutPlanService.getAll({ is_active: true }),
    enabled: ownerId > 0,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: mealLogs = [], isLoading: isLoadingMeals } = useQuery({
    queryKey: ['meal-logs-today', today],
    queryFn: () => mealLogService.getByDate(today),
    enabled: !!today && ownerId > 0,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: mealTypes = [] } = useQuery({
    queryKey: ['meal-types-active'],
    queryFn: () => mealTypeService.getActive(),
    enabled: ownerId > 0,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: reflections = [], refetch: refetchReflections } = useQuery({
    queryKey: ['reflections', today],
    queryFn: async () => {
      const all = await dailyReflectionsService.getAll({ date: today });
      return all;
    },
    enabled: !!today && ownerId > 0,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: gamification } = useQuery<{
    current_level: number;
    total_xp: number;
    current_streak: number;
    longest_streak: number;
    tasks_completed_total: number;
    badges_count: number;
  }>({
    queryKey: ['gamification-profile'],
    queryFn: () => apiClient.get('/api/v1/personal-planning/gamification/'),
    enabled: ownerId > 0,
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const tasks = tasksResponse?.instances ?? [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const tasksRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const activePlan = workoutPlans[0] ?? null;
  const todayDow = new Date().getDay();
  const todayWorkoutDay: WorkoutDay | null = useMemo(() => {
    if (!activePlan?.days?.length) return null;
    const match = activePlan.days.find((d) => d.day_of_week === todayDow);
    return match ?? null;
  }, [activePlan, todayDow]);

  const workoutLoggedToday = workoutSessions.length > 0;

  const todayReflection = reflections.find((r) => r.date === today);

  const dayProgress = useMemo(() => {
    const applicable: number[] = [];
    if (totalTasks > 0) applicable.push(tasksRate);
    applicable.push(workoutLoggedToday ? 100 : 0);
    applicable.push(mealLogs.length > 0 ? 100 : 0);
    applicable.push(todayReflection ? 100 : 0);
    if (applicable.length === 0) return 0;
    return Math.round(applicable.reduce((a, b) => a + b, 0) / applicable.length);
  }, [totalTasks, tasksRate, workoutLoggedToday, mealLogs.length, todayReflection]);

  const hour = new Date().getHours();
  const greeting = useMemo(() => {
    if (hour < 12)
      return { label: t('pages.planningToday.greetingMorning'), Icon: Sun };
    if (hour < 18)
      return { label: t('pages.planningToday.greetingAfternoon'), Icon: Sunset };
    return { label: t('pages.planningToday.greetingEvening'), Icon: Moon };
  }, [hour, t]);

  const dateLabel = today
    ? new Date(today + 'T00:00:00').toLocaleDateString(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  const toggleTaskComplete = async (task: TaskInstance) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    setUpdatingTaskId(task.id);
    try {
      await taskInstancesService.bulkUpdate([{ id: task.id, status: newStatus }]);
      await queryClient.invalidateQueries({ queryKey: ['today-tasks', today] });
    } catch (error) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const createSessionMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const session = await workoutSessionService.create({
        workout_day:
          data.workout_day && data.workout_day !== 'none'
            ? Number(data.workout_day)
            : undefined,
        date: data.date,
        started_at: data.started_at || undefined,
        finished_at: data.finished_at || undefined,
        notes: data.notes || undefined,
        owner: ownerId,
      });
      await Promise.all(
        data.exercises.map(async (ex, exIdx) => {
          const sessionEx = await workoutSessionExerciseService.create({
            session: session.id,
            exercise_name: ex.exercise_name,
            sets_target: ex.sets_target,
            reps_target_min: ex.reps_target_min,
            reps_target_max: ex.reps_target_max,
            order: exIdx,
            owner: ownerId,
          });
          await Promise.all(
            ex.sets.map((s, sIdx) =>
              workoutSessionSetService.create({
                session_exercise: sessionEx.id,
                set_number: sIdx + 1,
                load: s.load || undefined,
                load_unit: s.load_unit,
                reps_done: s.reps_done ? Number(s.reps_done) : undefined,
                completed: s.completed,
                notes: s.notes || undefined,
                owner: ownerId,
              })
            )
          );
        })
      );
      return session;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['workout-sessions-today', today],
      });
      toast({ title: t('pages.planningToday.workoutLogged') });
      setDialog(null);
    },
    onError: (error) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const createMealMutation = useMutation({
    mutationFn: (data: MealLogFormData) => mealLogService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meal-logs-today', today] });
      toast({ title: t('pages.planningToday.mealLogged') });
      setDialog(null);
    },
    onError: (error) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleSaveReflection = async () => {
    if (!reflectionText.trim() || reflectionText.trim().length < 10) {
      toast({
        title: t('pages.planningToday.reflectionMinLength'),
        variant: 'destructive',
      });
      return;
    }
    setIsSavingReflection(true);
    try {
      const data: DailyReflectionFormData = {
        date: today,
        reflection: reflectionText.trim(),
        mood: reflectionMood || undefined,
        owner: ownerId,
      };
      if (todayReflection) {
        await dailyReflectionsService.update(todayReflection.id, data);
      } else {
        await dailyReflectionsService.create(data);
      }
      await refetchReflections();
      toast({ title: t('pages.planningToday.reflectionSaved') });
      setIsEditingReflection(false);
    } catch (error) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSavingReflection(false);
    }
  };

  const startEditReflection = () => {
    setReflectionText(todayReflection?.reflection ?? '');
    setReflectionMood(todayReflection?.mood ?? '');
    setIsEditingReflection(true);
  };

  const isLoading =
    isLoadingTasks || isLoadingWorkout || isLoadingPlan || isLoadingMeals;

  if (isLoading && !today) return <LoadingState />;

  const GreetIcon = greeting.Icon;

  const progressColor =
    dayProgress >= 80
      ? 'hsl(var(--chart-2))'
      : dayProgress >= 40
        ? 'hsl(var(--warning))'
        : 'hsl(var(--primary))';

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader title={t('pages.planningToday.title')} icon={<Sun />} />

        {/* Header summary card */}
        <Card>
          <CardContent className="pt-lg">
            <div className="flex flex-wrap items-center gap-lg">
              <div className="flex items-center gap-sm">
                <GreetIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{greeting.label}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {dateLabel}
                  </p>
                </div>
              </div>

              {gamification && (
                <div className="flex items-center gap-sm">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">
                    {t('pages.planningToday.streak', {
                      count: gamification.current_streak,
                    })}
                  </span>
                </div>
              )}

              <div className="ml-auto flex min-w-[180px] flex-col gap-xs">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('pages.planningToday.progress')}
                  </span>
                  <span className="font-semibold" style={{ color: progressColor }}>
                    {dayProgress}%
                  </span>
                </div>
                <Progress value={dayProgress} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks section */}
        <SectionCard
          title={t('pages.planningToday.sectionTasks')}
          icon={<CheckCircle2 className="h-4 w-4" />}
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate('/planning/tasks-goals')}
            >
              {t('pages.planningToday.viewAll')}
            </Button>
          }
        >
          {isLoadingTasks ? (
            <LoadingState />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10 text-muted-foreground" />}
              message={t('pages.planningToday.noTasks')}
            />
          ) : (
            <div className="space-y-sm">
              <div className="mb-sm flex items-center gap-sm text-sm text-muted-foreground">
                <span>
                  {completedTasks}/{totalTasks} {t('pages.planningToday.tasksLabel')}
                </span>
                <span className="ml-auto font-medium" style={{ color: progressColor }}>
                  {tasksRate}%
                </span>
              </div>
              {tasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isUpdating = updatingTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center gap-md rounded-lg border p-sm transition-opacity',
                      isCompleted && 'opacity-60'
                    )}
                  >
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => void toggleTaskComplete(task)}
                      className="shrink-0 text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm font-medium',
                          isCompleted && 'line-through'
                        )}
                      >
                        {task.task_name}
                      </p>
                      {task.time_display && (
                        <p className="text-xs text-muted-foreground">
                          {task.time_display}
                        </p>
                      )}
                    </div>
                    {task.category && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {translate('taskCategories', task.category)}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Workout section */}
        <SectionCard
          title={t('pages.planningToday.sectionWorkout')}
          icon={<Dumbbell className="h-4 w-4" />}
          action={
            <Button
              size="sm"
              variant={workoutLoggedToday ? 'outline' : 'default'}
              onClick={() => setDialog({ type: 'log-session' })}
            >
              <Plus className="mr-xs h-3.5 w-3.5" />
              {t('pages.planningToday.logWorkout')}
            </Button>
          }
        >
          {isLoadingWorkout || isLoadingPlan ? (
            <LoadingState />
          ) : workoutLoggedToday ? (
            <div className="space-y-sm">
              {workoutSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-sm rounded-lg border border-success/30 bg-success/5 p-sm"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {session.workout_day_name ?? t('pages.planningToday.freeWorkout')}
                    </p>
                    {session.duration_minutes && (
                      <p className="text-xs text-muted-foreground">
                        {session.duration_minutes} min
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="border-success/30 text-success">
                    {t('pages.planningToday.done')}
                  </Badge>
                </div>
              ))}
            </div>
          ) : activePlan ? (
            <div className="space-y-sm">
              <p className="text-sm text-muted-foreground">
                {t('pages.planningToday.activePlan')}:{' '}
                <strong>{activePlan.name}</strong>
              </p>
              {todayWorkoutDay ? (
                <div className="rounded-lg border p-sm">
                  <p className="font-medium">{todayWorkoutDay.name}</p>
                  {todayWorkoutDay.muscle_groups && (
                    <p className="text-sm text-muted-foreground">
                      {todayWorkoutDay.muscle_groups}
                    </p>
                  )}
                  <p className="mt-xs text-xs text-muted-foreground">
                    {todayWorkoutDay.exercise_count}{' '}
                    {t('pages.planningToday.exercises')}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('pages.planningToday.restDay')}
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<Dumbbell className="h-10 w-10 text-muted-foreground" />}
              message={t('pages.planningToday.noWorkoutPlan')}
              action={{
                label: t('pages.planningToday.createPlan'),
                onClick: () => {
                  void navigate('/planning/workout');
                },
              }}
            />
          )}
        </SectionCard>

        {/* Nutrition section */}
        <SectionCard
          title={t('pages.planningToday.sectionNutrition')}
          icon={<UtensilsCrossed className="h-4 w-4" />}
          action={
            <Button size="sm" onClick={() => setDialog({ type: 'log-meal' })}>
              <Plus className="mr-xs h-3.5 w-3.5" />
              {t('pages.planningToday.logMeal')}
            </Button>
          }
        >
          {isLoadingMeals ? (
            <LoadingState />
          ) : mealLogs.length === 0 ? (
            <EmptyState
              icon={<UtensilsCrossed className="h-10 w-10 text-muted-foreground" />}
              message={t('pages.planningToday.noMeals')}
            />
          ) : (
            <div className="space-y-xs">
              {mealLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-sm rounded-lg border p-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{log.meal_type_name}</p>
                    {log.menu_option_name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {log.menu_option_name}
                      </p>
                    )}
                  </div>
                  {log.time && (
                    <span className="text-xs text-muted-foreground">
                      {log.time.substring(0, 5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Reflection section */}
        <SectionCard
          title={t('pages.planningToday.sectionReflection')}
          icon={<BookOpen className="h-4 w-4" />}
          action={
            todayReflection && !isEditingReflection ? (
              <Button variant="ghost" size="sm" onClick={startEditReflection}>
                <Edit2 className="mr-xs h-3.5 w-3.5" />
                {t('pages.planningToday.editReflection')}
              </Button>
            ) : undefined
          }
        >
          {todayReflection && !isEditingReflection ? (
            <div className="space-y-sm">
              {todayReflection.mood && (
                <div className="flex items-center gap-xs">
                  {(() => {
                    const MoodIcon = MOOD_ICONS[todayReflection.mood];
                    return MoodIcon ? <MoodIcon className="h-4 w-4" /> : null;
                  })()}
                  <span className="text-sm capitalize text-muted-foreground">
                    {MOOD_CHOICES.find((m) => m.value === todayReflection.mood)?.label}
                  </span>
                </div>
              )}
              <p className="text-sm leading-relaxed">{todayReflection.reflection}</p>
            </div>
          ) : (
            <div className="space-y-md">
              <div className="space-y-xs">
                <p className="text-sm text-muted-foreground">
                  {t('pages.planningToday.moodLabel')}
                </p>
                <Select
                  value={reflectionMood}
                  onValueChange={(v) => setReflectionMood(v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue
                      placeholder={t('pages.planningToday.moodPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t('pages.planningToday.noMood')}
                    </SelectItem>
                    {MOOD_CHOICES.map((choice) => {
                      const MoodIcon = MOOD_ICONS[choice.value];
                      return (
                        <SelectItem key={choice.value} value={choice.value}>
                          <span className="flex items-center gap-xs">
                            {MoodIcon && <MoodIcon className="h-4 w-4" />}
                            {choice.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder={t('pages.planningToday.reflectionPlaceholder')}
                rows={4}
                disabled={isSavingReflection}
              />

              <div className="flex justify-end gap-sm">
                {isEditingReflection && (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditingReflection(false)}
                    disabled={isSavingReflection}
                  >
                    {t('common.actions.cancel')}
                  </Button>
                )}
                <Button
                  onClick={() => void handleSaveReflection()}
                  disabled={isSavingReflection || reflectionText.trim().length < 10}
                >
                  {isSavingReflection ? (
                    <>
                      <Loader2 className="mr-xs h-4 w-4 animate-spin" />
                      {t('pages.planningToday.saving')}
                    </>
                  ) : (
                    t('pages.planningToday.saveReflection')
                  )}
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Log Workout Dialog */}
        <Dialog
          open={dialog?.type === 'log-session'}
          onOpenChange={(open) => !open && setDialog(null)}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('pages.planningToday.logWorkoutTitle')}</DialogTitle>
              <DialogDescription>
                {t('pages.planningToday.logWorkoutDesc')}
              </DialogDescription>
            </DialogHeader>
            <WorkoutSessionForm
              workoutDays={activePlan?.days ?? []}
              ownerId={ownerId}
              onSubmit={(data: SessionFormData) =>
                createSessionMutation.mutateAsync(data)
              }
              onCancel={() => setDialog(null)}
              isLoading={createSessionMutation.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Log Meal Dialog */}
        <Dialog
          open={dialog?.type === 'log-meal'}
          onOpenChange={(open) => !open && setDialog(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('pages.planningToday.logMealTitle')}</DialogTitle>
              <DialogDescription>
                {t('pages.planningToday.logMealDesc')}
              </DialogDescription>
            </DialogHeader>
            <MealLogForm
              mealTypes={mealTypes}
              ownerId={ownerId}
              prefillDate={today}
              prefillMealTypeId={
                dialog?.type === 'log-meal' ? dialog.prefillMealTypeId : undefined
              }
              onSubmit={(data: MealLogFormData) => createMealMutation.mutateAsync(data)}
              onCancel={() => setDialog(null)}
              isLoading={createMealMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}
