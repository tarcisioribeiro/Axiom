/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  ClipboardList,
  Clock,
  Dumbbell,
  Edit,
  FileText,
  Flame,
  Layers,
  Loader2,
  Plus,
  Target,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { WorkoutDayForm } from '@/components/workout/WorkoutDayForm';
import { WorkoutExerciseModal } from '@/components/workout/WorkoutExerciseModal';
import { WorkoutPlanForm } from '@/components/workout/WorkoutPlanForm';
import { WorkoutSessionForm } from '@/components/workout/WorkoutSessionForm';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import {
  exerciseService,
  workoutDayService,
  workoutExerciseService,
  workoutPlanService,
  workoutSessionService,
  workoutSessionExerciseService,
  workoutSessionSetService,
} from '@/services/workout-service';
import type {
  Exercise,
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
  | { type: 'add-exercise'; day: WorkoutDay }
  | { type: 'edit-exercise'; exercise: WorkoutExercise; day: WorkoutDay }
  | { type: 'new-session' }
  | { type: 'edit-session'; session: WorkoutSession }
  | { type: 'new-catalog-exercise' }
  | { type: 'edit-catalog-exercise'; exercise: Exercise }
  | null;

interface ExerciseCatalogFormValues {
  name: string;
  muscle_groups: string;
  description: string;
}

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

function getMuscleIcon(muscleGroups?: string | null): ReactNode {
  if (!muscleGroups) return <Dumbbell className="h-4 w-4" />;
  const mg = muscleGroups.toLowerCase();
  if (
    mg.includes('perna') ||
    mg.includes('quad') ||
    mg.includes('glút') ||
    mg.includes('glut') ||
    mg.includes('panturril')
  )
    return <Flame className="h-4 w-4" />;
  if (mg.includes('abdômen') || mg.includes('abdome') || mg.includes('core'))
    return <Target className="h-4 w-4" />;
  if (mg.includes('cardio') || mg.includes('aerób'))
    return <Activity className="h-4 w-4" />;
  return <Dumbbell className="h-4 w-4" />;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function WorkoutPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [selectedDayByPlan, setSelectedDayByPlan] = useState<
    Record<number, number | null>
  >({});
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

  const { data: catalogExercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const plans = plansData ?? [];
  const sessions = sessionsData ?? [];
  const allDaysList = allDays ?? [];

  const activePlans = plans.filter((p) => p.is_active);
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
    mutationFn: (dayData: WorkoutDayFormData) => workoutDayService.create(dayData),
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
    mutationFn: ({ id, dayData }: { id: number; dayData: WorkoutDayFormData }) =>
      workoutDayService.update(id, dayData),
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

  const addExerciseMutation = useMutation({
    mutationFn: (data: {
      workout_day: number;
      exercise: number;
      name: string;
      sets: number;
      reps_min: number;
      reps_max: number;
      load: string | null;
      load_unit: string;
      order: number;
      notes: string | null;
    }) =>
      workoutExerciseService.create({
        ...data,
        load: data.load ?? undefined,
        notes: data.notes ?? undefined,
        owner: ownerId,
      }),
    onSuccess: () => {
      void invalidatePlans();
      void invalidateDays();
      toast({ title: t('pages.workoutPlans.exerciseAdded') });
      setDialog(null);
    },
    onError: () =>
      toast({ title: t('pages.workoutPlans.saveError'), variant: 'destructive' }),
  });

  const editExerciseMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        workout_day: number;
        exercise: number;
        name: string;
        sets: number;
        reps_min: number;
        reps_max: number;
        load: string | null;
        load_unit: string;
        order: number;
        notes: string | null;
      };
    }) =>
      workoutExerciseService.update(id, {
        ...data,
        load: data.load ?? undefined,
        notes: data.notes ?? undefined,
        owner: ownerId,
      }),
    onSuccess: () => {
      void invalidatePlans();
      void invalidateDays();
      toast({ title: t('pages.workoutPlans.exerciseUpdated') });
      setDialog(null);
    },
    onError: () =>
      toast({ title: t('pages.workoutPlans.saveError'), variant: 'destructive' }),
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: (id: number) => workoutExerciseService.delete(id),
    onSuccess: () => {
      void invalidatePlans();
      void invalidateDays();
      toast({ title: t('pages.workoutPlans.exerciseDeleted') });
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

  const invalidateCatalog = () =>
    queryClient.invalidateQueries({ queryKey: ['exercises'] });

  const createCatalogExerciseMutation = useMutation({
    mutationFn: (data: ExerciseCatalogFormValues) =>
      exerciseService.create({ ...data, owner: ownerId }),
    onSuccess: () => {
      void invalidateCatalog();
      toast({ title: t('pages.exercises.created') });
      setDialog(null);
    },
    onError: () =>
      toast({ title: t('pages.exercises.saveError'), variant: 'destructive' }),
  });

  const updateCatalogExerciseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExerciseCatalogFormValues }) =>
      exerciseService.update(id, { ...data, owner: ownerId }),
    onSuccess: () => {
      void invalidateCatalog();
      toast({ title: t('pages.exercises.updated') });
      setDialog(null);
    },
    onError: () =>
      toast({ title: t('pages.exercises.saveError'), variant: 'destructive' }),
  });

  const deleteCatalogExerciseMutation = useMutation({
    mutationFn: (id: number) => exerciseService.delete(id),
    onSuccess: () => {
      void invalidateCatalog();
      toast({ title: t('pages.exercises.deleted') });
    },
  });

  const handleDeleteCatalogExercise = async (exercise: Exercise) => {
    const confirmed = await showConfirm({
      title: t('pages.exercises.deleteTitle'),
      description: t('pages.exercises.deleteDesc', { name: exercise.name }),
    });
    if (confirmed) deleteCatalogExerciseMutation.mutate(exercise.id);
  };

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

  const handleDeleteExercise = async (exercise: WorkoutExercise) => {
    const confirmed = await showConfirm({
      title: t('pages.workoutPlans.deleteExerciseTitle'),
      description: t('pages.workoutPlans.deleteExerciseDesc'),
    });
    if (confirmed) deleteExerciseMutation.mutate(exercise.id);
  };

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
      case 'add-exercise':
        return t('pages.workoutPlans.addExerciseTitle');
      case 'edit-exercise':
        return t('pages.workoutPlans.editExerciseTitle');
      case 'new-session':
        return t('pages.workoutSessions.newSessionTitle');
      case 'edit-session':
        return t('pages.workoutSessions.editSessionTitle');
      case 'new-catalog-exercise':
        return t('pages.exercises.newTitle');
      case 'edit-catalog-exercise':
        return t('pages.exercises.editTitle');
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
      case 'add-exercise':
        return t('pages.workoutPlans.addExerciseDesc');
      case 'edit-exercise':
        return t('pages.workoutPlans.editExerciseDesc');
      case 'new-session':
        return t('pages.workoutSessions.newSessionDesc');
      case 'edit-session':
        return t('pages.workoutSessions.editSessionDesc');
      case 'new-catalog-exercise':
        return t('pages.exercises.newDesc');
      case 'edit-catalog-exercise':
        return t('pages.exercises.editDesc');
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

        <Tabs defaultValue="sessions" className="flex flex-1 flex-col">
          <TabsList className="mb-lg w-full">
            <TabsTrigger value="sessions" className="flex-1 gap-xs">
              <Zap className="h-4 w-4" />
              {t('pages.workoutPlans.tabSessions')}
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex-1 gap-xs">
              <ClipboardList className="h-4 w-4" />
              {t('pages.workoutPlans.tabPlans')}
            </TabsTrigger>
            <TabsTrigger value="exercises" className="flex-1 gap-xs">
              <Dumbbell className="h-4 w-4" />
              {t('pages.workoutPlans.tabExercises')}
            </TabsTrigger>
          </TabsList>

          {/* ── Sessões ─────────────────────────────────────────────────── */}
          <TabsContent value="sessions" className="mt-0 flex-1">
            <div className="mb-md flex justify-end">
              <Button onClick={() => setDialog({ type: 'new-session' })}>
                <Plus className="mr-sm h-4 w-4" />
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

          {/* ── Planos ──────────────────────────────────────────────────── */}
          <TabsContent value="plans" className="mt-0 flex-1">
            <div className="mb-md flex justify-end">
              <Button onClick={() => setDialog({ type: 'new-plan' })}>
                <Plus className="mr-sm h-4 w-4" />
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
              <div className="space-y-xl">
                {/* Planos ativos — hero cards */}
                {activePlans.map((activePlan) => {
                  const activePlanSelectedDay =
                    selectedDayByPlan[activePlan.id] ?? null;
                  const setActivePlanSelectedDay = (dayId: number | null) =>
                    setSelectedDayByPlan((prev) => ({
                      ...prev,
                      [activePlan.id]: dayId,
                    }));
                  return (
                    <div key={activePlan.id} className="space-y-sm">
                      <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-category-exercise/30">
                        {/* Gradient header */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-category-exercise to-category-exercise/60 px-lg pb-md pt-lg">
                          <Dumbbell className="absolute -right-6 -top-6 h-36 w-36 rotate-12 text-white/10" />
                          <div className="relative flex items-start justify-between">
                            <div className="min-w-0">
                              <div className="mb-sm inline-flex items-center gap-xs rounded-full bg-white/20 px-sm py-xs text-xs font-bold uppercase tracking-widest text-white">
                                <Zap className="h-3 w-3" />
                                {t('pages.workoutPlans.activePlan')}
                              </div>
                              <h2 className="text-2xl font-bold text-white">
                                {activePlan.name}
                              </h2>
                              {activePlan.description && (
                                <p className="mt-xs text-sm text-white/70">
                                  {activePlan.description}
                                </p>
                              )}
                              <div className="mt-sm flex flex-wrap gap-md text-sm text-white/80">
                                <span className="flex items-center gap-xs">
                                  <ClipboardList className="h-3.5 w-3.5" />
                                  {activePlan.day_count} {t('pages.workoutPlans.days')}
                                </span>
                                <span className="flex items-center gap-xs">
                                  <Dumbbell className="h-3.5 w-3.5" />
                                  {activePlan.exercise_count}{' '}
                                  {t('pages.workoutPlans.exercises')}
                                </span>
                              </div>
                            </div>
                            <div className="ml-md flex shrink-0 gap-xs">
                              <button
                                type="button"
                                onClick={() =>
                                  setDialog({ type: 'edit-plan', plan: activePlan })
                                }
                                className="rounded-lg p-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePlan(activePlan)}
                                className="rounded-lg p-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Day cards */}
                        <div className="bg-card p-md">
                          <p className="mb-sm text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t('pages.workoutPlans.days')}
                          </p>
                          <div className="flex gap-sm overflow-x-auto pb-xs">
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
                                  'flex min-w-[130px] flex-col items-start rounded-lg border-2 p-sm text-left transition-all',
                                  activePlanSelectedDay === day.id
                                    ? 'border-category-exercise bg-category-exercise/10 shadow-sm'
                                    : 'border-border bg-background hover:border-category-exercise/40 hover:bg-category-exercise/5'
                                )}
                              >
                                <div
                                  className={cn(
                                    'mb-sm flex h-8 w-8 items-center justify-center rounded-lg',
                                    activePlanSelectedDay === day.id
                                      ? 'bg-category-exercise/20 text-category-exercise'
                                      : 'bg-muted text-muted-foreground'
                                  )}
                                >
                                  {getMuscleIcon(day.muscle_groups)}
                                </div>
                                <span
                                  className={cn(
                                    'text-sm font-semibold leading-tight',
                                    activePlanSelectedDay === day.id
                                      ? 'text-category-exercise'
                                      : 'text-foreground'
                                  )}
                                >
                                  {day.name}
                                </span>
                                {day.muscle_groups && (
                                  <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                    {day.muscle_groups}
                                  </span>
                                )}
                                <span className="mt-sm text-xs text-muted-foreground">
                                  {day.exercise_count}{' '}
                                  {t('pages.workoutPlans.exercises')}
                                </span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setDialog({ type: 'new-day', planId: activePlan.id })
                              }
                              className="flex min-w-[100px] flex-col items-center justify-center gap-sm rounded-lg border-2 border-dashed border-border p-sm text-center transition-colors hover:border-category-exercise/40 hover:bg-category-exercise/5"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {t('pages.workoutPlans.newDayBtn')}
                              </span>
                            </button>
                          </div>

                          {/* Exercícios da divisão selecionada */}
                          {activePlanSelectedDay !== null &&
                            (() => {
                              const day = activePlan.days?.find(
                                (d) => d.id === activePlanSelectedDay
                              );
                              if (!day) return null;
                              return (
                                <div className="mt-md rounded-lg border border-category-exercise/25 bg-category-exercise/5 p-md">
                                  <div className="mb-sm flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold text-foreground">
                                        {day.name}
                                      </p>
                                      {day.muscle_groups && (
                                        <p className="text-xs text-muted-foreground">
                                          {day.muscle_groups}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-xs">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() =>
                                          setDialog({ type: 'edit-day', day })
                                        }
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
                                    <ExerciseList
                                      exercises={day.exercises}
                                      onEdit={(ex) =>
                                        setDialog({
                                          type: 'edit-exercise',
                                          exercise: ex,
                                          day,
                                        })
                                      }
                                      onDelete={handleDeleteExercise}
                                    />
                                  ) : (
                                    <p className="py-sm text-center text-xs text-muted-foreground">
                                      {t('pages.workoutPlans.noExercises')}
                                    </p>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDialog({ type: 'add-exercise', day })
                                    }
                                    className="mt-sm flex w-full items-center justify-center gap-sm rounded-lg border-2 border-dashed border-category-exercise/30 py-sm text-xs text-category-exercise transition-colors hover:border-category-exercise/60 hover:bg-category-exercise/5"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    {t('pages.workoutPlans.addExerciseBtn')}
                                  </button>
                                </div>
                              );
                            })()}
                        </div>
                      </div>
                    </div>
                  );
                })}

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
                        onNewDay={() => setDialog({ type: 'new-day', planId: plan.id })}
                        onEditDay={(day) => setDialog({ type: 'edit-day', day })}
                        onDeleteDay={handleDeleteDay}
                        onAddExercise={(day) =>
                          setDialog({ type: 'add-exercise', day })
                        }
                        onEditExercise={(ex, day) =>
                          setDialog({ type: 'edit-exercise', exercise: ex, day })
                        }
                        onDeleteExercise={handleDeleteExercise}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Exercícios (catálogo) ────────────────────────────────────── */}
          <TabsContent value="exercises" className="mt-0 flex-1">
            <div className="mb-md flex justify-end">
              <Button onClick={() => setDialog({ type: 'new-catalog-exercise' })}>
                <Plus className="mr-sm h-4 w-4" />
                {t('pages.exercises.newBtn')}
              </Button>
            </div>

            {catalogExercises.length === 0 ? (
              <EmptyState
                title={t('pages.exercises.empty')}
                description={t('pages.exercises.emptyDesc')}
                icon={<Dumbbell className="h-8 w-8" />}
              />
            ) : (
              <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {catalogExercises.map((exercise) => (
                  <ExerciseCatalogCard
                    key={exercise.id}
                    exercise={exercise}
                    onEdit={() =>
                      setDialog({ type: 'edit-catalog-exercise', exercise })
                    }
                    onDelete={() => handleDeleteCatalogExercise(exercise)}
                  />
                ))}
              </div>
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
                day={dialog.type === 'edit-day' ? dialog.day : undefined}
                planId={dialog.type === 'new-day' ? dialog.planId : dialog.day.plan}
                ownerId={ownerId}
                onSubmit={async (dayData) => {
                  if (dialog.type === 'edit-day') {
                    await updateDayMutation.mutateAsync({
                      id: dialog.day.id,
                      dayData: dayData as WorkoutDayFormData,
                    });
                  } else {
                    await createDayMutation.mutateAsync(dayData as WorkoutDayFormData);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={createDayMutation.isPending || updateDayMutation.isPending}
              />
            )}

            {(dialog?.type === 'add-exercise' || dialog?.type === 'edit-exercise') && (
              <WorkoutExerciseModal
                exercises={catalogExercises}
                existing={dialog.type === 'edit-exercise' ? dialog.exercise : undefined}
                nextOrder={dialog.day.exercises?.length ?? 0}
                onSubmit={async (data) => {
                  if (dialog.type === 'edit-exercise') {
                    await editExerciseMutation.mutateAsync({
                      id: dialog.exercise.id,
                      data: { ...data, workout_day: dialog.day.id },
                    });
                  } else {
                    await addExerciseMutation.mutateAsync({
                      ...data,
                      workout_day: dialog.day.id,
                    });
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={
                  addExerciseMutation.isPending || editExerciseMutation.isPending
                }
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

            {(dialog?.type === 'new-catalog-exercise' ||
              dialog?.type === 'edit-catalog-exercise') && (
              <ExerciseCatalogForm
                exercise={
                  dialog.type === 'edit-catalog-exercise' ? dialog.exercise : undefined
                }
                onSubmit={async (data) => {
                  if (dialog.type === 'edit-catalog-exercise') {
                    await updateCatalogExerciseMutation.mutateAsync({
                      id: dialog.exercise.id,
                      data,
                    });
                  } else {
                    await createCatalogExerciseMutation.mutateAsync(data);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={
                  createCatalogExerciseMutation.isPending ||
                  updateCatalogExerciseMutation.isPending
                }
              />
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}

// ── Catalog exercise sub-components ────────────────────────────────────────

function ExerciseCatalogCard({
  exercise,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-card p-md transition-shadow hover:shadow-md">
      <div className="mb-sm flex items-start justify-between gap-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-exercise/10">
          <Dumbbell className="h-5 w-5 text-category-exercise" />
        </div>
        <div className="flex gap-xs opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="font-semibold leading-tight text-foreground">{exercise.name}</p>
      {exercise.muscle_groups && (
        <p className="mt-xs text-xs text-muted-foreground">{exercise.muscle_groups}</p>
      )}
      {exercise.description && (
        <p className="mt-sm line-clamp-2 text-xs text-muted-foreground/70">
          {exercise.description}
        </p>
      )}
    </div>
  );
}

const CATALOG_MUSCLE_CHIPS = [
  'Peito',
  'Costas',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Abdômen',
  'Quadríceps',
  'Posteriores',
  'Glúteos',
  'Panturrilha',
  'Cardio',
  'Full Body',
];

function ExerciseCatalogForm({
  exercise,
  onSubmit,
  onCancel,
  isLoading,
}: {
  exercise?: Exercise;
  onSubmit: (data: ExerciseCatalogFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ExerciseCatalogFormValues>({
    name: exercise?.name ?? '',
    muscle_groups: exercise?.muscle_groups ?? '',
    description: exercise?.description ?? '',
  });
  const [selectedChips, setSelectedChips] = useState<string[]>(() =>
    exercise?.muscle_groups
      ? exercise.muscle_groups
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  );

  const toggleChip = (label: string) => {
    setSelectedChips((prev) => {
      const next = prev.includes(label)
        ? prev.filter((c) => c !== label)
        : [...prev, label];
      setValues((v) => ({ ...v, muscle_groups: next.join(', ') }));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) return;
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-lg">
      {/* Header */}
      <div className="flex items-center gap-md rounded-lg bg-category-exercise/10 px-md py-sm ring-1 ring-category-exercise/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-category-exercise/20">
          <Dumbbell className="h-5 w-5 text-category-exercise" />
        </div>
        <div>
          <p className="text-sm font-semibold text-category-exercise">
            {exercise
              ? t('pages.exercises.editTitle', 'Editar Exercício')
              : t('pages.exercises.newTitle', 'Novo Exercício')}
          </p>
          <p className="text-xs text-muted-foreground">
            {values.name ||
              t('pages.exercises.newDesc', 'Cadastre um exercício no catálogo')}
          </p>
        </div>
      </div>

      {/* Nome */}
      <FormSection title={t('pages.exercises.fieldName')} icon={Dumbbell}>
        <Input
          placeholder={t('pages.exercises.fieldNamePlaceholder')}
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          required
        />
      </FormSection>

      {/* Grupos musculares */}
      <FormSection title={t('pages.exercises.fieldMuscles')} icon={Layers}>
        <div className="space-y-sm">
          <div className="flex flex-wrap gap-xs">
            {CATALOG_MUSCLE_CHIPS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleChip(label)}
                className={cn(
                  'rounded-full border px-sm py-xs text-xs font-medium transition-all',
                  selectedChips.includes(label)
                    ? 'border-category-exercise bg-category-exercise/15 text-category-exercise'
                    : 'border-border bg-background text-muted-foreground hover:border-category-exercise/40 hover:bg-category-exercise/5 hover:text-category-exercise'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            placeholder={t('pages.exercises.fieldMusclesPlaceholder')}
            value={values.muscle_groups}
            onChange={(e) => {
              setValues((v) => ({ ...v, muscle_groups: e.target.value }));
              setSelectedChips(
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              );
            }}
          />
        </div>
      </FormSection>

      {/* Descrição */}
      <FormSection title={t('pages.exercises.fieldDescription')} icon={FileText}>
        <Textarea
          placeholder={t('pages.exercises.fieldDescriptionPlaceholder')}
          rows={3}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          className="resize-none"
        />
      </FormSection>

      <div className="flex justify-end gap-sm border-t border-border pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-category-exercise hover:bg-category-exercise/90"
        >
          {isLoading && <Loader2 className="mr-sm h-4 w-4 animate-spin" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ExerciseList({
  exercises,
  onEdit,
  onDelete,
}: {
  exercises: WorkoutExercise[];
  onEdit?: (ex: WorkoutExercise) => void;
  onDelete?: (ex: WorkoutExercise) => void;
}) {
  return (
    <div className="space-y-xs">
      {exercises.map((ex, idx) => (
        <div
          key={ex.id}
          className="group flex items-center gap-sm rounded-lg bg-background px-sm py-xs"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-category-exercise/20 text-xs font-bold text-category-exercise">
            {idx + 1}
          </span>
          <span className="flex-1 text-sm font-medium">{ex.name}</span>
          <div className="flex shrink-0 items-center gap-xs">
            {ex.load && (
              <span className="rounded-full bg-muted px-xs py-px text-xs text-muted-foreground">
                {ex.load} {ex.load_unit}
              </span>
            )}
            <span className="rounded-full bg-category-exercise/15 px-xs py-px text-xs font-semibold text-category-exercise">
              {ex.sets}×
            </span>
            <span className="rounded-full bg-muted px-xs py-px text-xs text-muted-foreground">
              {ex.reps_min}–{ex.reps_max}
            </span>
            {(onEdit || onDelete) && (
              <div className="flex gap-xs opacity-0 transition-opacity group-hover:opacity-100">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(ex)}
                    className="rounded p-xs text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(ex)}
                    className="rounded p-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
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
  onAddExercise: (day: WorkoutDay) => void;
  onEditExercise: (ex: WorkoutExercise, day: WorkoutDay) => void;
  onDeleteExercise: (ex: WorkoutExercise) => void;
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
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  t,
}: InactivePlanRowProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-sm bg-card px-md py-sm">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-sm text-left"
          onClick={onToggle}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{plan.name}</p>
            <p className="text-xs text-muted-foreground">
              {plan.day_count} {t('pages.workoutPlans.days')} · {plan.exercise_count}{' '}
              {t('pages.workoutPlans.exercises')}
            </p>
          </div>
          <div
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-transform',
              expanded && 'rotate-90'
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
        <div className="ml-sm flex shrink-0 items-center gap-xs">
          <Badge variant="secondary" className="text-xs">
            {t('pages.workoutPlans.inactive')}
          </Badge>
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

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="inactive-plan-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-sm border-t border-border bg-background p-md">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={onNewDay}>
                  <Plus className="mr-xs h-3 w-3" />
                  {t('pages.workoutPlans.newDayBtn')}
                </Button>
              </div>
              {plan.days?.map((day) => (
                <div
                  key={day.id}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between bg-muted/30 px-sm py-xs">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-xs text-left"
                      onClick={() => onToggleDay(day.id)}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
                        {getMuscleIcon(day.muscle_groups)}
                      </div>
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
                  {expandedDays.has(day.id) && (
                    <div className="space-y-xs px-sm pb-sm pt-xs">
                      {day.exercises && day.exercises.length > 0 && (
                        <ExerciseList
                          exercises={day.exercises}
                          onEdit={(ex) => onEditExercise(ex, day)}
                          onDelete={onDeleteExercise}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => onAddExercise(day)}
                        className="flex w-full items-center justify-center gap-sm rounded-lg border-2 border-dashed border-category-exercise/30 py-xs text-xs text-category-exercise transition-colors hover:border-category-exercise/60 hover:bg-category-exercise/5"
                      >
                        <Plus className="h-3 w-3" />
                        {t('pages.workoutPlans.addExerciseBtn')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
        <div key={group.key}>
          <div className="mb-sm flex items-center gap-sm">
            <div className="h-px flex-1 bg-border" />
            <span className="flex items-center gap-xs rounded-full bg-muted px-sm py-0.5 text-xs font-semibold text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {group.label}
              <span className="font-normal opacity-70">· {group.items.length}</span>
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-sm">
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
  const date = new Date(session.date + 'T12:00:00');
  const dayNum = date.getDate();
  const monthLabel = date
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
    .toUpperCase();

  return (
    <div className="group flex gap-md rounded-lg border border-border bg-card p-md transition-all hover:border-category-exercise/30 hover:shadow-sm">
      {/* Date block */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-category-exercise/10 py-sm text-center">
        <span className="text-2xl font-bold leading-none text-category-exercise">
          {dayNum}
        </span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-category-exercise/70">
          {monthLabel}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <p className="font-semibold leading-snug">
              {session.workout_day_name ?? t('pages.workoutSessions.noWorkoutDay')}
            </p>
            {session.workout_day_muscle_groups && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {session.workout_day_muscle_groups}
              </p>
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

        <div className="mt-sm flex flex-wrap items-center gap-xs">
          {session.duration_minutes != null && (
            <span className="flex items-center gap-xs rounded-full border border-border bg-background px-sm py-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDuration(session.duration_minutes)}
            </span>
          )}
          {exerciseCount > 0 && (
            <span className="flex items-center gap-xs rounded-full border border-border bg-background px-sm py-0.5 text-xs text-muted-foreground">
              <Dumbbell className="h-3 w-3" />
              {exerciseCount} {t('pages.workoutPlans.exercises')}
            </span>
          )}
          {session.notes && (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {session.notes}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
