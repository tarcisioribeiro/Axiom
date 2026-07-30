/* eslint-disable max-lines */
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { type ReactNode, useState, useCallback } from 'react';
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
import { Label } from '@/components/ui/label';
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
import { apiClient } from '@/services/api-client';
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
  | { type: 'quick-log' }
  | { type: 'ai-generate-plan' }
  | null;

interface AIWorkoutFormValues {
  goal: string;
  level: 'iniciante' | 'intermediário' | 'avançado';
  equipment: string;
  days_per_week: number;
}

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
  const [aiForm, setAiForm] = useState<AIWorkoutFormValues>({
    goal: '',
    level: 'iniciante',
    equipment: 'academia completa',
    days_per_week: 3,
  });
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

  const aiGeneratePlanMutation = useMutation({
    mutationFn: (data: AIWorkoutFormValues) =>
      apiClient.post<{ plan_id: number; name: string; days_created: number }>(
        '/api/v1/personal-planning/ai-workout-plan/',
        data
      ),
    onSuccess: (result) => {
      void invalidatePlans();
      void invalidateDays();
      toast({
        title: 'Plano gerado com sucesso!',
        description: `"${result.name}" com ${result.days_created} dias de treino foi criado.`,
      });
      setAiForm({
        goal: '',
        level: 'iniciante',
        equipment: 'academia completa',
        days_per_week: 3,
      });
      setDialog(null);
    },
    onError: () => {
      toast({
        title: 'Erro ao gerar plano',
        description: 'Não foi possível gerar o plano. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

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
      rest_seconds: number | null;
      load: string | null;
      load_unit: string;
      order: number;
      notes: string | null;
    }) =>
      workoutExerciseService.create({
        ...data,
        rest_seconds: data.rest_seconds ?? undefined,
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
        rest_seconds: number | null;
        load: string | null;
        load_unit: string;
        order: number;
        notes: string | null;
      };
    }) =>
      workoutExerciseService.update(id, {
        ...data,
        rest_seconds: data.rest_seconds ?? undefined,
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
      id?: number;
      exercise_name: string;
      sets_target: number;
      reps_target_min: number;
      reps_target_max: number;
      order: number;
      sets: Array<{
        id?: number;
        set_number: number;
        load: string;
        load_unit: string;
        reps_done: string;
        completed: boolean;
        notes: string;
      }>;
    }>;
  }

  /**
   * Reconciles the nested exercises/sets submitted from the session edit form
   * against what the session originally had, issuing create/update/delete
   * calls only for what actually changed instead of always recreating.
   */
  const reconcileSessionExercises = async (
    sessionId: number,
    originalExercises: WorkoutSession['session_exercises'],
    submittedExercises: SessionFormData['exercises']
  ) => {
    const originalById = new Map(originalExercises.map((ex) => [ex.id, ex]));
    const submittedIds = new Set(
      submittedExercises.filter((ex) => ex.id != null).map((ex) => ex.id)
    );
    const exerciseIdsToDelete = originalExercises
      .filter((ex) => !submittedIds.has(ex.id))
      .map((ex) => ex.id);

    await Promise.all([
      ...exerciseIdsToDelete.map((id) => workoutSessionExerciseService.delete(id)),
      ...submittedExercises.map(async (ex, exIdx) => {
        const payload = {
          session: sessionId,
          exercise_name: ex.exercise_name,
          sets_target: ex.sets_target,
          reps_target_min: ex.reps_target_min,
          reps_target_max: ex.reps_target_max,
          order: exIdx,
          owner: ownerId,
        };

        const exerciseId =
          ex.id != null
            ? await workoutSessionExerciseService
                .update(ex.id, payload)
                .then(() => ex.id as number)
            : await workoutSessionExerciseService.create(payload).then((r) => r.id);

        const originalSets = ex.id != null ? (originalById.get(ex.id)?.sets ?? []) : [];
        const submittedSetIds = new Set(
          ex.sets.filter((s) => s.id != null).map((s) => s.id)
        );
        const setIdsToDelete = originalSets
          .filter((s) => !submittedSetIds.has(s.id))
          .map((s) => s.id);

        await Promise.all([
          ...setIdsToDelete.map((id) => workoutSessionSetService.delete(id)),
          ...ex.sets.map((s, sIdx) => {
            const setPayload = {
              session_exercise: exerciseId,
              set_number: sIdx + 1,
              load: s.load || undefined,
              load_unit: s.load_unit,
              reps_done: s.reps_done ? Number(s.reps_done) : undefined,
              completed: s.completed,
              notes: s.notes || undefined,
              owner: ownerId,
            };
            return s.id != null
              ? workoutSessionSetService.update(s.id, setPayload)
              : workoutSessionSetService.create(setPayload);
          }),
        ]);
      }),
    ]);
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

  const updateSessionMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      original,
    }: {
      id: number;
      data: SessionFormData;
      original: WorkoutSession;
    }) => {
      const session = await workoutSessionService.update(id, {
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
      await reconcileSessionExercises(id, original.session_exercises, data.exercises);
      return session;
    },
    onSuccess: () => {
      void invalidateSessions();
      toast({
        title: t('pages.workoutSessions.sessionUpdated'),
        description: t('pages.workoutSessions.sessionUpdatedDesc'),
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
      case 'quick-log':
        return t('pages.workoutSessions.quickLogTitle');
      case 'ai-generate-plan':
        return 'Gerar Plano com IA';
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
      case 'quick-log':
        return t('pages.workoutSessions.quickLogDesc');
      case 'ai-generate-plan':
        return 'Descreva seu objetivo e a IA criará um plano completo com divisões e exercícios.';
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

        <Tabs defaultValue="today" className="flex flex-1 flex-col">
          <TabsList className="mb-lg w-full">
            <TabsTrigger value="today" className="flex-1 gap-xs">
              <Flame className="h-4 w-4" />
              {t('pages.workoutHub.todayPlan')}
            </TabsTrigger>
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

          {/* ── Hoje ──────────────────────────────────────────────────── */}
          <TabsContent value="today" className="mt-0 flex-1">
            <TodayPlanTab
              activePlans={activePlans}
              sessions={sessions}
              plansLoading={plansLoading}
              sessionsLoading={sessionsLoading}
              onStartSession={() => setDialog({ type: 'new-session' })}
              onEditSession={(s) => setDialog({ type: 'edit-session', session: s })}
              onDeleteSession={handleDeleteSession}
              t={t}
            />
          </TabsContent>

          {/* ── Sessões ─────────────────────────────────────────────────── */}
          <TabsContent value="sessions" className="mt-0 flex-1">
            <div className="mb-md flex justify-end gap-sm">
              <Button
                variant="outline"
                onClick={() => setDialog({ type: 'quick-log' })}
              >
                <Zap className="mr-sm h-4 w-4" />
                {t('pages.workoutSessions.quickLogBtn')}
              </Button>
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
                action={{
                  label: t('pages.workoutSessions.emptyAction'),
                  icon: <Plus className="mr-xs h-4 w-4" />,
                  onClick: () => setDialog({ type: 'new-session' }),
                }}
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
            <div className="mb-md flex justify-end gap-sm">
              <Button
                variant="outline"
                onClick={() => setDialog({ type: 'ai-generate-plan' })}
              >
                <Sparkles className="mr-sm h-4 w-4 text-primary" />
                Gerar com IA
              </Button>
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
                action={{
                  label: t('pages.workoutPlans.emptyPlansAction'),
                  icon: <Plus className="mr-xs h-4 w-4" />,
                  onClick: () => setDialog({ type: 'new-plan' }),
                }}
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
                action={{
                  label: t('pages.exercises.emptyAction'),
                  icon: <Plus className="mr-xs h-4 w-4" />,
                  onClick: () => setDialog({ type: 'new-catalog-exercise' }),
                }}
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
                      dayData: dayData,
                    });
                  } else {
                    await createDayMutation.mutateAsync(dayData);
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
                session={dialog.type === 'edit-session' ? dialog.session : undefined}
                onSubmit={async (data) => {
                  if (dialog.type === 'edit-session') {
                    await updateSessionMutation.mutateAsync({
                      id: dialog.session.id,
                      data,
                      original: dialog.session,
                    });
                  } else {
                    await createSessionMutation.mutateAsync(data);
                  }
                }}
                onCancel={() => setDialog(null)}
                isLoading={
                  createSessionMutation.isPending || updateSessionMutation.isPending
                }
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

            {dialog?.type === 'quick-log' && (
              <QuickLogForm
                plans={plans}
                days={allDaysList}
                ownerId={ownerId}
                onSuccess={() => {
                  void invalidateSessions();
                  setDialog(null);
                }}
                onCancel={() => setDialog(null)}
                t={t}
              />
            )}

            {dialog?.type === 'ai-generate-plan' && (
              <div className="space-y-md">
                <div className="space-y-sm">
                  <Label htmlFor="ai-goal">Objetivo *</Label>
                  <Input
                    id="ai-goal"
                    placeholder="Ex: hipertrofia muscular, perda de gordura, resistência…"
                    value={aiForm.goal}
                    onChange={(e) => setAiForm((f) => ({ ...f, goal: e.target.value }))}
                  />
                </div>

                <div className="space-y-sm">
                  <Label>Nível</Label>
                  <div className="flex gap-sm">
                    {(['iniciante', 'intermediário', 'avançado'] as const).map(
                      (lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setAiForm((f) => ({ ...f, level: lvl }))}
                          className={cn(
                            // eslint-disable-next-line no-restricted-syntax
                            'flex-1 rounded-md border py-1.5 text-xs font-medium capitalize transition-colors',
                            aiForm.level === lvl
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-input bg-background text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="space-y-sm">
                  <Label htmlFor="ai-equipment">Equipamentos disponíveis</Label>
                  <Input
                    id="ai-equipment"
                    placeholder="Ex: academia completa, halteres em casa, barra fixa…"
                    value={aiForm.equipment}
                    onChange={(e) =>
                      setAiForm((f) => ({ ...f, equipment: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-sm">
                  <Label>Dias por semana: {aiForm.days_per_week}</Label>
                  <div className="flex gap-xs">
                    {[2, 3, 4, 5, 6].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setAiForm((f) => ({ ...f, days_per_week: d }))}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold transition-colors',
                          aiForm.days_per_week === d
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input bg-background text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-sm pt-sm">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialog(null)}
                    disabled={aiGeneratePlanMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!aiForm.goal.trim() || aiGeneratePlanMutation.isPending}
                    onClick={() => aiGeneratePlanMutation.mutate(aiForm)}
                  >
                    {aiGeneratePlanMutation.isPending ? (
                      <>
                        <Loader2 className="mr-sm h-4 w-4 animate-spin" />
                        Gerando…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-sm h-4 w-4" />
                        Gerar Plano
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}

// ── Quick Log Form ──────────────────────────────────────────────────────────

interface QuickLogFormProps {
  plans: WorkoutPlan[];
  days: WorkoutDay[];
  ownerId: number;
  onSuccess: () => void;
  onCancel: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function QuickLogForm({
  plans,
  days,
  ownerId,
  onSuccess,
  onCancel,
  t,
}: QuickLogFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedDayId, setSelectedDayId] = useState<string>('none');
  const [duration, setDuration] = useState<number>(45);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePlans = plans.filter((p) => p.is_active);
  const relevantDays =
    activePlans.length > 0
      ? days.filter((d) => activePlans.some((p) => p.id === d.plan))
      : days;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      const now = new Date();
      const finished = new Date(now.getTime() + duration * 60 * 1000);
      const toTimeStr = (d: Date) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      const selectedDay =
        selectedDayId && selectedDayId !== 'none'
          ? days.find((d) => d.id === Number(selectedDayId))
          : undefined;

      const session = await workoutSessionService.create({
        date: format(now, 'yyyy-MM-dd'),
        started_at: toTimeStr(now),
        finished_at: toTimeStr(finished),
        owner: ownerId,
        workout_day: selectedDay?.id,
      });

      // auto-populate session exercises from the plan day
      if (selectedDay && selectedDay.exercises.length > 0) {
        await Promise.all(
          selectedDay.exercises.map((ex, idx) =>
            workoutSessionExerciseService.create({
              session: session.id,
              exercise_name: ex.name,
              sets_target: ex.sets,
              reps_target_min: ex.reps_min,
              reps_target_max: ex.reps_max,
              order: idx,
              owner: ownerId,
            })
          )
        );
      }

      toast({ title: t('pages.workoutSessions.quickLogSuccess') });
      onSuccess();
    } catch {
      toast({
        title: t('pages.workoutSessions.saveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-lg">
      {step === 1 && (
        <div className="space-y-md">
          <FormSection
            title={t('pages.workoutSessions.quickLogStep1')}
            icon={ClipboardList}
          >
            <div className="space-y-sm">
              <Label>{t('pages.workoutSessions.quickLogPlanLabel')}</Label>
              <select
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-sm py-xs text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="none">
                  {t('pages.workoutSessions.quickLogNoPlan')}
                </option>
                {relevantDays.map((day) => (
                  <option key={day.id} value={day.id.toString()}>
                    {day.name}
                    {day.muscle_groups ? ` — ${day.muscle_groups}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </FormSection>
          <div className="flex justify-end gap-sm border-t pt-md">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="button" onClick={() => setStep(2)}>
              {t('pages.workoutSessions.quickLogNext')}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-md">
          <FormSection title={t('pages.workoutSessions.quickLogStep2')} icon={Clock}>
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                <Label>{t('pages.workoutSessions.quickLogDuration')}</Label>
                <span className="text-sm font-bold text-primary">
                  {duration} {t('pages.workoutSessions.quickLogMin')}
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={180}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15 min</span>
                <span>180 min</span>
              </div>
            </div>
          </FormSection>
          <div className="flex justify-end gap-sm border-t pt-md">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              {t('common.actions.back')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-sm h-4 w-4 animate-spin" />}
              {t('pages.workoutSessions.quickLogConfirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
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

const CATALOG_MUSCLE_CHIP_KEYS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'forearms',
  'lowerBack',
  'traps',
  'adductors',
  'abductors',
  'core',
  'push',
  'pull',
  'cardio',
  'hiit',
  'running',
  'cycling',
  'swimming',
  'fullBody',
] as const;

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
            {CATALOG_MUSCLE_CHIP_KEYS.map((key) => {
              const label = t(`pages.workoutPlans.muscleChips.${key}`);
              return (
                <button
                  key={key}
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
              );
            })}
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

function SortableExerciseItem({
  ex,
  idx,
  onEdit,
  onDelete,
}: {
  ex: WorkoutExercise;
  idx: number;
  onEdit?: (ex: WorkoutExercise) => void;
  onDelete?: (ex: WorkoutExercise) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-sm rounded-lg bg-background px-sm py-xs"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
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
        {ex.sets > 0 ? (
          <>
            <span className="rounded-full bg-category-exercise/15 px-xs py-px text-xs font-semibold text-category-exercise">
              {ex.sets}×
            </span>
            <span className="rounded-full bg-muted px-xs py-px text-xs text-muted-foreground">
              {ex.reps_min}–{ex.reps_max}
            </span>
          </>
        ) : (
          <span className="rounded-full bg-muted px-xs py-px text-xs text-muted-foreground">
            {t('pages.workoutPlans.noSets')}
          </span>
        )}
        {ex.rest_seconds != null && ex.rest_seconds > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-muted px-xs py-px text-xs text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {ex.rest_seconds}s
          </span>
        )}
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
  );
}

function ExerciseList({
  exercises,
  onEdit,
  onDelete,
}: {
  exercises: WorkoutExercise[];
  onEdit?: (ex: WorkoutExercise) => void;
  onDelete?: (ex: WorkoutExercise) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<WorkoutExercise[]>(exercises);

  // Sincroniza `items` com a prop `exercises` (derivado durante o render —
  // sem efeito), preservando a reordenação otimista local via drag-and-drop.
  const [lastExercises, setLastExercises] = useState(exercises);
  if (exercises !== lastExercises) {
    setLastExercises(exercises);
    setItems(exercises);
  }

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((e) => e.id === active.id);
      const newIndex = items.findIndex((e) => e.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered);

      try {
        await Promise.all(
          reordered.map((ex, idx) =>
            workoutExerciseService.patch(ex.id, { order: idx })
          )
        );
        void queryClient.invalidateQueries({ queryKey: ['workout-plans'] });
        void queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      } catch {
        toast({ title: t('pages.workoutPlans.reorderError'), variant: 'destructive' });
        setItems(exercises);
      }
    },
    [items, exercises, queryClient, t, toast]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <SortableContext
        items={items.map((e) => e.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-xs">
          {items.map((ex, idx) => (
            <SortableExerciseItem
              key={ex.id}
              ex={ex}
              idx={idx}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
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
  const monthLabel = t(
    `pages.planningDashboard.monthShort.${date.getMonth()}`
  ).toUpperCase();

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

// ── Today Plan Tab ──────────────────────────────────────────────────────────

interface TodayPlanTabProps {
  activePlans: WorkoutPlan[];
  sessions: WorkoutSession[];
  plansLoading: boolean;
  sessionsLoading: boolean;
  onStartSession: () => void;
  onEditSession: (s: WorkoutSession) => void;
  onDeleteSession: (s: WorkoutSession) => Promise<void>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function TodayPlanTab({
  activePlans,
  sessions,
  plansLoading,
  sessionsLoading,
  onStartSession,
  onEditSession,
  onDeleteSession,
  t,
}: TodayPlanTabProps) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((s) => s.date === today);
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat → convert to Python convention 0=Mon,6=Sun
  const jsDay = new Date().getDay();
  const todayWeekday = jsDay === 0 ? 6 : jsDay - 1;

  if (plansLoading || sessionsLoading) return <LoadingState />;

  return (
    <div className="space-y-lg">
      {/* Sessões de hoje */}
      {todaySessions.length > 0 && (
        <div>
          <p className="mb-sm text-sm font-semibold text-foreground">
            {t('pages.workoutHub.todaySessions')}
          </p>
          <SessionsGrouped
            sessions={todaySessions}
            onEdit={onEditSession}
            onDelete={onDeleteSession}
            t={t}
          />
        </div>
      )}

      {/* Plano ativo */}
      {(() => {
        const plansForToday = activePlans.filter((plan) =>
          plan.days.some(
            (day) => day.day_of_week == null || day.day_of_week === todayWeekday
          )
        );

        if (activePlans.length === 0) {
          return (
            <EmptyState
              title={t('pages.workoutHub.noActivePlan')}
              description={t('pages.workoutHub.createPlan')}
              icon={<Dumbbell className="h-8 w-8" />}
              action={{
                label: t('pages.workoutSessions.newSessionBtn'),
                icon: <Plus className="mr-xs h-4 w-4" />,
                onClick: onStartSession,
              }}
            />
          );
        }

        if (plansForToday.length === 0) {
          return (
            <EmptyState
              title={t('pages.workoutHub.noTrainingToday')}
              description={t('pages.workoutHub.noTrainingTodayDesc')}
              icon={<Dumbbell className="h-8 w-8" />}
            />
          );
        }

        return plansForToday.map((plan) => (
          <div key={plan.id} className="space-y-sm">
            <div className="flex items-center gap-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-category-exercise/10">
                <ClipboardList className="h-4 w-4 text-category-exercise" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                {plan.description && (
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                )}
              </div>
            </div>

            {plan.days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('pages.workoutPlans.emptyDays')}
              </p>
            ) : (
              <div className="space-y-sm">
                {plan.days
                  .filter(
                    (day) => day.day_of_week == null || day.day_of_week === todayWeekday
                  )
                  .map((day) => (
                    <div
                      key={day.id}
                      className="overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-md py-sm">
                        <div className="flex items-center gap-sm">
                          {getMuscleIcon(day.muscle_groups)}
                          <div>
                            <p className="text-sm font-semibold">{day.name}</p>
                            {day.muscle_groups && (
                              <p className="text-xs text-muted-foreground">
                                {day.muscle_groups}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {day.exercises.length}{' '}
                          {day.exercises.length === 1
                            ? t('pages.workoutPlans.exerciseSingular')
                            : t('pages.workoutPlans.exercisePlural')}
                        </Badge>
                      </div>
                      {day.exercises.length > 0 && (
                        <div className="divide-y divide-border/40">
                          {day.exercises.map((ex) => (
                            <div
                              key={ex.id}
                              className="flex items-center justify-between px-md py-xs"
                            >
                              <div className="flex items-center gap-sm">
                                <Dumbbell className="h-3.5 w-3.5 shrink-0 text-category-exercise/60" />
                                <span className="text-sm">{ex.name}</span>
                              </div>
                              <div className="flex items-center gap-sm text-xs text-muted-foreground">
                                {ex.sets > 0 ? (
                                  <span>
                                    {ex.sets}×
                                    {ex.reps_min === ex.reps_max
                                      ? ex.reps_min
                                      : `${ex.reps_min}–${ex.reps_max}`}
                                  </span>
                                ) : (
                                  <span>{t('pages.workoutPlans.noSets')}</span>
                                )}
                                {ex.load && (
                                  <span className="font-medium text-foreground">
                                    {ex.load} {ex.load_unit}
                                  </span>
                                )}
                                {ex.rest_seconds != null && ex.rest_seconds > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    {ex.rest_seconds}s
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ));
      })()}
    </div>
  );
}
