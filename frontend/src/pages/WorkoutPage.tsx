import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ChevronRight,
  ClipboardList,
  Clock,
  Dumbbell,
  Edit,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkoutDayForm } from '@/components/workout/WorkoutDayForm';
import { WorkoutPlanForm } from '@/components/workout/WorkoutPlanForm';
import { WorkoutSessionForm } from '@/components/workout/WorkoutSessionForm';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import {
  workoutDayService,
  workoutExerciseService,
  workoutPlanService,
  workoutSessionService,
  workoutSessionExerciseService,
  workoutSessionSetService,
} from '@/services/workout-service';
import type {
  WorkoutDay,
  WorkoutDayFormData,
  WorkoutExercise,
  WorkoutPlan,
  WorkoutPlanFormData,
  WorkoutSession,
} from '@/types/workout';
import { getErrorMessage } from '@/utils/error-utils';

type DialogMode =
  | { type: 'new-plan' }
  | { type: 'edit-plan'; plan: WorkoutPlan }
  | { type: 'new-day'; planId: number }
  | { type: 'edit-day'; day: WorkoutDay }
  | { type: 'new-session' }
  | { type: 'edit-session'; session: WorkoutSession }
  | null;

function groupSessionsByWeek(sessions: WorkoutSession[]) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() + diffToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const thisWeek: WorkoutSession[] = [];
  const lastWeek: WorkoutSession[] = [];
  const older: WorkoutSession[] = [];

  for (const s of sessions) {
    const d = new Date(s.date + 'T12:00:00');
    if (d >= startOfThisWeek) thisWeek.push(s);
    else if (d >= startOfLastWeek) lastWeek.push(s);
    else older.push(s);
  }

  return { thisWeek, lastWeek, older };
}

export default function WorkoutPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [activePlanSelectedDay, setActivePlanSelectedDay] = useState<number | null>(null);
  const [expandedInactivePlans, setExpandedInactivePlans] = useState<Set<number>>(
    new Set()
  );
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const ownerId = member?.id ?? 0;

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['workout-plans'],
    queryFn: () => workoutPlanService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['workout-sessions'],
    queryFn: () => workoutSessionService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: allDays } = useQuery({
    queryKey: ['workout-days'],
    queryFn: () => workoutDayService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const plans = plansData ?? [];
  const sessions = sessionsData ?? [];
  const allDaysList = allDays ?? [];

  const activePlan = plans.find((p) => p.is_active) ?? null;
  const inactivePlans = plans.filter((p) => !p.is_active);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidatePlans = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-plans'] });
  const invalidateDays = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-days'] });
  const invalidateSessions = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-sessions'] });

  const createPlanMutation = useMutation({
    mutationFn: (data: WorkoutPlanFormData) => workoutPlanService.create(data),
    onSuccess: () => {
      void invalidatePlans();
      toast({
        title: t('pages.workoutPlans.planCreated'),
        description: t('pages.workoutPlans.planCreatedDesc'),
      });
      setDialog(null);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: WorkoutPlanFormData }) =>
      workoutPlanService.update(id, data),
    onSuccess: () => {
      void invalidatePlans();
      toast({
        title: t('pages.workoutPlans.planUpdated'),
        description: t('pages.workoutPlans.planUpdatedDesc'),
      });
      setDialog(null);
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: number) => workoutPlanService.delete(id),
    onSuccess: () => {
      void invalidatePlans();
      toast({
        title: t('pages.workoutPlans.planDeleted'),
        description: t('pages.workoutPlans.planDeletedDesc'),
      });
    },
  });

  const createDayMutation = useMutation({
    mutationFn: async ({
      dayData,
      exercises,
    }: {
      dayData: WorkoutDayFormData;
      exercises: {
        name: string;
        sets: number;
        reps_min: number;
        reps_max: number;
        order: number;
        notes: string;
      }[];
    }) => {
      const day = await workoutDayService.create(dayData);
      await Promise.all(
        exercises.map((ex) =>
          workoutExerciseService.create({
            workout_day: day.id,
            name: ex.name,
            sets: ex.sets,
            reps_min: ex.reps_min,
            reps_max: ex.reps_max,
            order: ex.order,
            notes: ex.notes || undefined,
            owner: ownerId,
          })
        )
      );
      return day;
    },
    onSuccess: () => {
      void invalidatePlans();
      void invalidateDays();
      toast({
        title: t('pages.workoutPlans.dayCreated'),
        description: t('pages.workoutPlans.dayCreatedDesc'),
      });
      setDialog(null);
    },
  });

  const updateDayMutation = useMutation({
    mutationFn: async ({
      id,
      dayData,
      exercises,
    }: {
      id: number;
      dayData: WorkoutDayFormData;
      exercises: {
        id?: number;
        name: string;
        sets: number;
        reps_min: number;
        reps_max: number;
        order: number;
        notes: string;
      }[];
    }) => {
      await workoutDayService.update(id, dayData);
      const existing = await workoutExerciseService.getByDay(id);
      const existingIds = new Set(existing.map((e) => e.id));
      const incomingIds = new Set(exercises.filter((e) => e.id).map((e) => e.id!));
      const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid));
      await Promise.all(toDelete.map((eid) => workoutExerciseService.delete(eid)));
      await Promise.all(
        exercises.map((ex) =>
          ex.id
            ? workoutExerciseService.update(ex.id, {
                workout_day: id,
                name: ex.name,
                sets: ex.sets,
                reps_min: ex.reps_min,
                reps_max: ex.reps_max,
                order: ex.order,
                notes: ex.notes || undefined,
                owner: ownerId,
              })
            : workoutExerciseService.create({
                workout_day: id,
                name: ex.name,
                sets: ex.sets,
                reps_min: ex.reps_min,
                reps_max: ex.reps_max,
                order: ex.order,
                notes: ex.notes || undefined,
                owner: ownerId,
              })
        )
      );
    },
    onSuccess: () => {
      void invalidatePlans();
      void invalidateDays();
      toast({
        title: t('pages.workoutPlans.dayUpdated'),
        description: t('pages.workoutPlans.dayUpdatedDesc'),
      });
      setDialog(null);
    },
  });

  const deleteDayMutation = useMutation({
    mutationFn: (id: number) => workoutDayService.delete(id),
    onSuccess: () => {
      void invalidatePlans();
      void invalidateDays();
      toast({
        title: t('pages.workoutPlans.dayDeleted'),
        description: t('pages.workoutPlans.dayDeletedDesc'),
      });
    },
  });

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
      void invalidateSessions();
      toast({
        title: t('pages.workoutSessions.sessionCreated'),
        description: t('pages.workoutSessions.sessionCreatedDesc'),
      });
      setDialog(null);
    },
    onError: (err: unknown) => {
      toast({
        title: t('pages.workoutSessions.saveError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: number) => workoutSessionService.delete(id),
    onSuccess: () => {
      void invalidateSessions();
      toast({
        title: t('pages.workoutSessions.sessionDeleted'),
        description: t('pages.workoutSessions.sessionDeletedDesc'),
      });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleInactivePlan = (id: number) => {
    setExpandedInactivePlans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDay = (id: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeletePlan = async (plan: WorkoutPlan) => {
    const confirmed = await showConfirm({
      title: t('pages.workoutPlans.deletePlanTitle'),
      description: t('pages.workoutPlans.deletePlanDesc'),
    });
    if (confirmed) deletePlanMutation.mutate(plan.id);
  };

  const handleDeleteDay = async (day: WorkoutDay) => {
    const confirmed = await showConfirm({
      title: t('pages.workoutPlans.deleteDayTitle'),
      description: t('pages.workoutPlans.deleteDayDesc'),
    });
    if (confirmed) deleteDayMutation.mutate(day.id);
  };

  const handleDeleteSession = async (session: WorkoutSession) => {
    const confirmed = await showConfirm({
      title: t('pages.workoutSessions.deleteSessionTitle'),
      description: t('pages.workoutSessions.deleteSessionDesc'),
    });
    if (confirmed) deleteSessionMutation.mutate(session.id);
  };

  // ── Dialog title/desc ──────────────────────────────────────────────────────

  const dialogTitle = () => {
    if (!dialog) return '';
    switch (dialog.type) {
      case 'new-plan':
        return t('pages.workoutPlans.newPlanTitle');
      case 'edit-plan':
        return t('pages.workoutPlans.editPlanTitle');
      case 'new-day':
        return t('pages.workoutPlans.newDayTitle');
      case 'edit-day':
        return t('pages.workoutPlans.editDayTitle');
      case 'new-session':
        return t('pages.workoutSessions.newSessionTitle');
      case 'edit-session':
        return t('pages.workoutSessions.editSessionTitle');
    }
  };

  const dialogDesc = () => {
    if (!dialog) return '';
    switch (dialog.type) {
      case 'new-plan':
        return t('pages.workoutPlans.newPlanDesc');
      case 'edit-plan':
        return t('pages.workoutPlans.editPlanDesc');
      case 'new-day':
        return t('pages.workoutPlans.newDayDesc');
      case 'edit-day':
        return t('pages.workoutPlans.editDayDesc');
      case 'new-session':
        return t('pages.workoutSessions.newSessionDesc');
      case 'edit-session':
        return t('pages.workoutSessions.editSessionDesc');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.workoutPlans.title')}
          icon={<Dumbbell className="h-6 w-6 text-category-exercise" />}
        />

        <Tabs defaultValue="plans" className="w-full">
          <TabsList className="mb-lg">
            <TabsTrigger value="plans" className="gap-xs">
              <ClipboardList className="h-4 w-4" />
              {t('pages.workoutPlans.tabPlans')}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-xs">
              <Zap className="h-4 w-4" />
              {t('pages.workoutPlans.tabSessions')}
            </TabsTrigger>
          </TabsList>

          {/* ── Planos ──────────────────────────────────────────────────── */}
          <TabsContent value="plans">
            <div className="mb-md flex justify-end">
              <Button onClick={() => setDialog({ type: 'new-plan' })}>
                <Plus className="mr-2 h-4 w-4" />
                {t('pages.workoutPlans.newPlanBtn')}
              </Button>
            </div>

            {plansLoading ? (
              <LoadingState />
            ) : plans.length === 0 ? (
              <EmptyState
                title={t('pages.workoutPlans.emptyPlans')}
                description={t('pages.workoutPlans.emptyPlansDesc')}
                icon={<Dumbbell className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-lg">
                {/* Plano ativo */}
                {activePlan && (
                  <div className="space-y-sm">
                    <div className="flex items-center gap-sm">
                      <div className="h-px flex-1 bg-border" />
                      <span className="flex items-center gap-xs text-xs font-semibold uppercase tracking-wider text-category-exercise">
                        <Activity className="h-3 w-3" />
                        {t('pages.workoutPlans.activePlan')}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <Card className="border-category-exercise/30 bg-category-exercise/5">
                      <CardHeader className="pb-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-sm text-base">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-category-exercise/20">
                                <Dumbbell className="h-4 w-4 text-category-exercise" />
                              </div>
                              {activePlan.name}
                            </CardTitle>
                            {activePlan.description && (
                              <p className="mt-1 pl-10 text-sm text-muted-foreground">
                                {activePlan.description}
                              </p>
                            )}
                            <p className="mt-1 pl-10 text-xs text-muted-foreground">
                              {activePlan.day_count} {t('pages.workoutPlans.days')} ·{' '}
                              {activePlan.exercise_count}{' '}
                              {t('pages.workoutPlans.exercises')}
                            </p>
                          </div>
                          <div className="flex items-center gap-xs">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setDialog({ type: 'edit-plan', plan: activePlan })
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeletePlan(activePlan)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-sm pt-0">
                        {/* Chips de divisão */}
                        <div className="flex flex-wrap gap-xs">
                          {activePlan.days?.map((day) => (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() =>
                                setActivePlanSelectedDay(
                                  activePlanSelectedDay === day.id ? null : day.id
                                )
                              }
                              className={cn(
                                'rounded-full border px-sm py-1 text-sm font-medium transition-colors',
                                activePlanSelectedDay === day.id
                                  ? 'border-category-exercise bg-category-exercise text-white'
                                  : 'border-border bg-card hover:border-category-exercise/60 hover:bg-category-exercise/10'
                              )}
                            >
                              {day.name}
                              {day.muscle_groups && (
                                <span className="ml-xs text-xs opacity-70">
                                  · {day.muscle_groups}
                                </span>
                              )}
                            </button>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full"
                            onClick={() =>
                              setDialog({
                                type: 'new-day',
                                planId: activePlan.id,
                              })
                            }
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {t('pages.workoutPlans.newDayBtn')}
                          </Button>
                        </div>

                        {/* Exercícios da divisão selecionada */}
                        {activePlanSelectedDay !== null && (() => {
                          const day = activePlan.days?.find(
                            (d) => d.id === activePlanSelectedDay
                          );
                          if (!day) return null;
                          return (
                            <div className="rounded-lg border border-category-exercise/20 bg-background p-sm">
                              <div className="mb-sm flex items-center justify-between">
                                <p className="text-sm font-semibold">
                                  {day.name}
                                  {day.muscle_groups && (
                                    <span className="ml-xs font-normal text-muted-foreground">
                                      — {day.muscle_groups}
                                    </span>
                                  )}
                                </p>
                                <div className="flex gap-xs">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setDialog({ type: 'edit-day', day })}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteDay(day)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {day.exercises && day.exercises.length > 0 ? (
                                <ExercisesTable exercises={day.exercises} t={t} />
                              ) : (
                                <p className="py-sm text-center text-xs text-muted-foreground">
                                  {t('pages.workoutPlans.noExercises')}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Outros planos */}
                {inactivePlans.length > 0 && (
                  <div className="space-y-sm">
                    <div className="flex items-center gap-sm">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {t('pages.workoutPlans.otherPlans')}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    {inactivePlans.map((plan) => (
                      <InactivePlanRow
                        key={plan.id}
                        plan={plan}
                        expanded={expandedInactivePlans.has(plan.id)}
                        expandedDays={expandedDays}
                        onToggle={() => toggleInactivePlan(plan.id)}
                        onToggleDay={toggleDay}
                        onEdit={() => setDialog({ type: 'edit-plan', plan })}
                        onDelete={() => handleDeletePlan(plan)}
                        onNewDay={() =>
                          setDialog({ type: 'new-day', planId: plan.id })
                        }
                        onEditDay={(day) => setDialog({ type: 'edit-day', day })}
                        onDeleteDay={handleDeleteDay}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Sessões ─────────────────────────────────────────────────── */}
          <TabsContent value="sessions">
            <div className="mb-md flex justify-end">
              <Button onClick={() => setDialog({ type: 'new-session' })}>
                <Plus className="mr-2 h-4 w-4" />
                {t('pages.workoutSessions.newSessionBtn')}
              </Button>
            </div>

            {sessionsLoading ? (
              <LoadingState />
            ) : sessions.length === 0 ? (
              <EmptyState
                title={t('pages.workoutSessions.emptySessions')}
                description={t('pages.workoutSessions.emptySessionsDesc')}
                icon={<Dumbbell className="h-8 w-8" />}
              />
            ) : (
              <SessionsGrouped
                sessions={sessions}
                onEdit={(s) => setDialog({ type: 'edit-session', session: s })}
                onDelete={handleDeleteSession}
                t={t}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* ── Dialog ──────────────────────────────────────────────────────── */}
        <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent
            className={cn(
              dialog?.type === 'new-session' || dialog?.type === 'edit-session'
                ? 'max-h-[90vh] max-w-2xl overflow-y-auto'
                : 'max-h-[85vh] max-w-xl overflow-y-auto'
            )}
          >
            <DialogHeader>
              <DialogTitle>{dialogTitle()}</DialogTitle>
              <DialogDescription>{dialogDesc()}</DialogDescription>
            </DialogHeader>

            {(dialog?.type === 'new-plan' || dialog?.type === 'edit-plan') && (
              <WorkoutPlanForm
                plan={dialog.type === 'edit-plan' ? dialog.plan : undefined}
                ownerId={ownerId}
                onSubmit={async (data) => {
                  if (dialog.type === 'edit-plan') {
                    await updatePlanMutation.mutateAsync({ id: dialog.plan.id, data });
                  } else {
                    await createPlanMutation.mutateAsync(data);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={createPlanMutation.isPending || updatePlanMutation.isPending}
              />
            )}

            {(dialog?.type === 'new-day' || dialog?.type === 'edit-day') && (
              <WorkoutDayForm
                day={
                  dialog.type === 'edit-day'
                    ? (dialog.day as WorkoutDay & { exercises: WorkoutExercise[] })
                    : undefined
                }
                planId={dialog.type === 'new-day' ? dialog.planId : dialog.day.plan}
                ownerId={ownerId}
                onSubmit={async (dayData, exercises) => {
                  if (dialog.type === 'edit-day') {
                    await updateDayMutation.mutateAsync({
                      id: dialog.day.id,
                      dayData: dayData as WorkoutDayFormData,
                      exercises,
                    });
                  } else {
                    await createDayMutation.mutateAsync({
                      dayData: dayData as WorkoutDayFormData,
                      exercises,
                    });
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={createDayMutation.isPending || updateDayMutation.isPending}
              />
            )}

            {(dialog?.type === 'new-session' || dialog?.type === 'edit-session') && (
              <WorkoutSessionForm
                workoutDays={allDaysList}
                ownerId={ownerId}
                onSubmit={async (data) => {
                  await createSessionMutation.mutateAsync(data);
                }}
                onCancel={() => setDialog(null)}
                isLoading={createSessionMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ExercisesTable({
  exercises,
  t,
}: {
  exercises: WorkoutExercise[];
  t: (key: string) => string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-xs text-muted-foreground">
          <th className="py-xs text-left font-medium">
            {t('pages.workoutPlans.exerciseName')}
          </th>
          <th className="w-16 py-xs text-center font-medium">
            {t('pages.workoutPlans.sets')}
          </th>
          <th className="w-20 py-xs text-center font-medium">Reps</th>
        </tr>
      </thead>
      <tbody>
        {exercises.map((ex) => (
          <tr key={ex.id} className="border-b border-border/50 last:border-0">
            <td className="py-xs">{ex.name}</td>
            <td className="py-xs text-center text-muted-foreground">{ex.sets}×</td>
            <td className="py-xs text-center text-muted-foreground">
              {ex.reps_min}–{ex.reps_max}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface InactivePlanRowProps {
  plan: WorkoutPlan;
  expanded: boolean;
  expandedDays: Set<number>;
  onToggle: () => void;
  onToggleDay: (id: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewDay: () => void;
  onEditDay: (day: WorkoutDay) => void;
  onDeleteDay: (day: WorkoutDay) => void;
  t: (key: string) => string;
}

function InactivePlanRow({
  plan,
  expanded,
  expandedDays,
  onToggle,
  onToggleDay,
  onEdit,
  onDelete,
  onNewDay,
  onEditDay,
  onDeleteDay,
  t,
}: InactivePlanRowProps) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-sm text-left"
            onClick={onToggle}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                expanded && 'rotate-90'
              )}
            />
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{plan.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {plan.day_count} {t('pages.workoutPlans.days')} · {plan.exercise_count}{' '}
                {t('pages.workoutPlans.exercises')}
              </p>
            </div>
          </button>
          <div className="ml-sm flex shrink-0 items-center gap-xs">
            <Badge variant="secondary">{t('pages.workoutPlans.inactive')}</Badge>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-sm pt-0">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onNewDay}>
              <Plus className="mr-1 h-3 w-3" />
              {t('pages.workoutPlans.newDayBtn')}
            </Button>
          </div>
          {plan.days?.map((day) => (
            <div key={day.id} className="rounded-md border border-border bg-muted/30">
              <div className="flex items-center justify-between px-sm py-xs">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-xs text-left"
                  onClick={() => onToggleDay(day.id)}
                >
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                      expandedDays.has(day.id) && 'rotate-90'
                    )}
                  />
                  <span className="text-sm font-medium">{day.name}</span>
                  {day.muscle_groups && (
                    <span className="truncate text-xs text-muted-foreground">
                      — {day.muscle_groups}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-xs">
                  <span className="text-xs text-muted-foreground">
                    {day.exercise_count} {t('pages.workoutPlans.exercises')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEditDay(day)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDeleteDay(day)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {expandedDays.has(day.id) && day.exercises && day.exercises.length > 0 && (
                <div className="px-sm pb-sm">
                  <ExercisesTable exercises={day.exercises} t={t} />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

interface SessionsGroupedProps {
  sessions: WorkoutSession[];
  onEdit: (s: WorkoutSession) => void;
  onDelete: (s: WorkoutSession) => Promise<void>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function SessionsGrouped({ sessions, onEdit, onDelete, t }: SessionsGroupedProps) {
  const { thisWeek, lastWeek, older } = groupSessionsByWeek(sessions);

  const groups = [
    { key: 'thisWeek', label: t('pages.workoutSessions.thisWeek'), items: thisWeek },
    { key: 'lastWeek', label: t('pages.workoutSessions.lastWeek'), items: lastWeek },
    { key: 'older', label: t('pages.workoutSessions.older'), items: older },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-lg">
      {groups.map((group) => (
        <div key={group.key} className="space-y-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onEdit={() => onEdit(session)}
              onDelete={() => onDelete(session)}
              t={t}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SessionCardProps {
  session: WorkoutSession;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function SessionCard({ session, onEdit, onDelete, t }: SessionCardProps) {
  const exerciseCount = session.session_exercises?.length ?? 0;

  return (
    <div className="group flex items-center gap-md rounded-lg border border-border bg-card px-md py-sm transition-colors hover:border-category-exercise/30 hover:bg-category-exercise/5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-category-exercise/10">
        <Dumbbell className="h-4 w-4 text-category-exercise" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {session.workout_day_name ?? t('pages.workoutSessions.noWorkoutDay')}
        </p>
        {session.workout_day_muscle_groups && (
          <p className="truncate text-xs text-muted-foreground">
            {session.workout_day_muscle_groups}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-md text-xs text-muted-foreground">
        <span className="font-medium">{formatDate(session.date)}</span>
        {session.duration_minutes != null && (
          <span className="flex items-center gap-xs">
            <Clock className="h-3 w-3" />
            {t('pages.workoutSessions.durationMinutes', {
              minutes: session.duration_minutes,
            })}
          </span>
        )}
        {exerciseCount > 0 && (
          <span className="flex items-center gap-xs">
            <Activity className="h-3 w-3" />
            {exerciseCount} {t('pages.workoutPlans.exercises')}
          </span>
        )}
      </div>

      <div className="flex shrink-0 gap-xs opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
