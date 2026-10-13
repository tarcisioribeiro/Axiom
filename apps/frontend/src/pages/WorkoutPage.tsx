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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock,
  Dumbbell,
  Edit,
  FileText,
  Flame,
  GripVertical,
  ImagePlus,
  Layers,
  ListChecks,
  Loader2,
  NotebookPen,
  Plus,
  Save,
  Search,
  Shapes,
  Tag,
  Target,
  Timer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, {
  type ReactNode,
  useMemo,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { ExerciseDatasetPicker } from '@/components/workout/ExerciseDatasetPicker';
import { ExerciseThumbnail } from '@/components/workout/ExerciseThumbnail';
import { WorkoutCalendar } from '@/components/workout/WorkoutCalendar';
import { WorkoutDayForm } from '@/components/workout/WorkoutDayForm';
import { WorkoutExerciseModal } from '@/components/workout/WorkoutExerciseModal';
import { WorkoutPlanForm } from '@/components/workout/WorkoutPlanForm';
import { WorkoutSessionForm } from '@/components/workout/WorkoutSessionForm';
import { TASK_STATUS_ICONS, WORKOUT_CATEGORY_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useTabRoute } from '@/hooks/use-tab-route';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn, formatLocalDate } from '@/lib/utils';
import { membersService } from '@/services/members-service';
import {
  bodyMetricService,
  exerciseService,
  workoutDayService,
  workoutExerciseService,
  workoutPlanService,
  workoutSessionService,
  workoutSessionExerciseService,
  workoutSessionSetService,
} from '@/services/workout-service';
import { WORKOUT_CATEGORIES } from '@/types/workout';
import type {
  Exercise,
  SetTarget,
  WorkoutCategory,
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
  | { type: 'view-session'; session: WorkoutSession }
  | { type: 'new-catalog-exercise' }
  | { type: 'edit-catalog-exercise'; exercise: Exercise }
  | null;

interface ExerciseCatalogFormValues {
  name: string;
  category: WorkoutCategory;
  muscle_groups: string;
  description: string;
}

const SESSIONS_PAGE_SIZE = 5;
const CATALOG_ROWS_PER_PAGE = 2;
const PLANS_ROWS_PER_PAGE = 3;

/** Colunas atuais de um grid responsivo: [min-width em px, colunas], da maior
 * para a menor largura; abaixo de todas, 1 coluna. */
const gridColumns = (breakpoints: [number, number][]) =>
  breakpoints.find(([px]) => window.matchMedia(`(min-width: ${px}px)`).matches)?.[1] ??
  1;
// Espelham as classes sm:/lg:/xl:grid-cols-* dos grids correspondentes
const getCatalogColumns = () =>
  gridColumns([
    [1280, 4],
    [1024, 3],
    [640, 2],
  ]);
const getPlanColumns = () =>
  gridColumns([
    [1024, 3],
    [640, 2],
  ]);
const subscribeResize = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};

/** "Peso corporal", "20 kg" ou null — carga padrão de um exercício do plano. */
function formatExerciseLoad(
  ex: Pick<WorkoutExercise, 'load' | 'load_unit'>,
  t: (key: string) => string
): string | null {
  if (ex.load_unit === 'bw') return t('pages.workoutPlans.bodyweight');
  return ex.load ? `${ex.load} ${ex.load_unit}` : null;
}

/** Resumo por série ("12/10/8 · 20/25/30 kg") quando o plano define alvos. */
function formatSetTargets(ex: WorkoutExercise): string | null {
  const targets = ex.set_targets ?? [];
  if (targets.length === 0) return null;
  const reps = targets.map((st) => st.reps ?? ex.reps_min).join('/');
  if (ex.load_unit === 'bw') return reps;
  const loads = targets.map((st) => st.load ?? ex.load ?? '–').join('/');
  return `${reps} · ${loads} ${ex.load_unit}`;
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

const TABS = ['today', 'sessions', 'calendar', 'plans', 'exercises'] as const;

const TAB_HEADERS: Record<
  (typeof TABS)[number],
  { titleKey: string; icon: ReactNode }
> = {
  today: { titleKey: 'pages.workoutHub.todayPlan', icon: <Flame /> },
  sessions: { titleKey: 'pages.workoutPlans.tabSessions', icon: <Zap /> },
  calendar: { titleKey: 'pages.workoutPlans.tabCalendar', icon: <CalendarDays /> },
  plans: { titleKey: 'pages.workoutPlans.tabPlans', icon: <ClipboardList /> },
  exercises: { titleKey: 'pages.workoutPlans.tabExercises', icon: <Dumbbell /> },
};

export default function WorkoutPage() {
  const catalogColumns = useSyncExternalStore(subscribeResize, getCatalogColumns);
  const planColumns = useSyncExternalStore(subscribeResize, getPlanColumns);
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [activeTab, setActiveTab] = useTabRoute('/planning/workout', TABS, 'today');
  const [viewPlanId, setViewPlanId] = useState<number | null>(null);
  const [viewDayId, setViewDayId] = useState<number | null>(null);
  const [imagePickerExercise, setImagePickerExercise] = useState<Exercise | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState('all');
  const [exerciseMuscleFilter, setExerciseMuscleFilter] = useState('all');
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState('all');
  const [sessionStartDate, setSessionStartDate] = useState<Date | undefined>(undefined);
  const [sessionEndDate, setSessionEndDate] = useState<Date | undefined>(undefined);
  const [planCategoryFilter, setPlanCategoryFilter] = useState<WorkoutCategory | 'all'>(
    'all'
  );
  const [planStatusFilter, setPlanStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const ownerId = member?.id ?? 0;

  // Mesma query da tela de Medidas; API ordena por -measured_at
  const { data: bodyMetrics = [] } = useQuery({
    queryKey: ['body-metrics'],
    queryFn: () => bodyMetricService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const latestBodyWeightKg = bodyMetrics.find((m) => m.weight_kg)?.weight_kg ?? null;
  const isSessionDialog =
    dialog?.type === 'new-session' || dialog?.type === 'edit-session';
  const isExerciseDialog =
    dialog?.type === 'add-exercise' || dialog?.type === 'edit-exercise';

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['workout-plans'],
    queryFn: () => workoutPlanService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  // ponytail: carrega todas as sessões e pagina no cliente (PaginatedSlide);
  // trocar por paginação no servidor se o histórico ficar grande demais
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['workout-sessions', 'all'],
    queryFn: () => workoutSessionService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: allDays } = useQuery({
    queryKey: ['workout-days'],
    queryFn: () => workoutDayService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: catalogExercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const plans = plansData ?? [];
  const sessions = sessionsData ?? [];
  const allDaysList = allDays ?? [];

  const filteredCatalogExercises = useMemo(() => {
    const term = exerciseSearch.trim().toLowerCase();
    const typeLabel =
      exerciseTypeFilter !== 'all'
        ? t(`pages.workoutPlans.muscleChips.${exerciseTypeFilter}`).toLowerCase()
        : null;
    const muscleLabel =
      exerciseMuscleFilter !== 'all'
        ? t(`pages.workoutPlans.muscleChips.${exerciseMuscleFilter}`).toLowerCase()
        : null;
    return catalogExercises.filter((exercise) => {
      if (term && !exercise.name.toLowerCase().includes(term)) return false;
      if (
        exerciseCategoryFilter !== 'all' &&
        exercise.category !== exerciseCategoryFilter
      )
        return false;
      const tags = (exercise.muscle_groups ?? '').toLowerCase();
      if (typeLabel && !tags.includes(typeLabel)) return false;
      if (muscleLabel && !tags.includes(muscleLabel)) return false;
      return true;
    });
  }, [
    catalogExercises,
    exerciseSearch,
    exerciseTypeFilter,
    exerciseMuscleFilter,
    exerciseCategoryFilter,
    t,
  ]);

  const activePlans = plans.filter((p) => p.is_active);
  const inactivePlans = plans.filter((p) => !p.is_active);

  const hasSessionFilters = !!sessionStartDate || !!sessionEndDate;
  const clearSessionFilters = () => {
    setSessionStartDate(undefined);
    setSessionEndDate(undefined);
  };
  const filteredSessions = useMemo(() => {
    return (sessionsData ?? []).filter((s) => {
      const d = s.date.slice(0, 10);
      if (sessionStartDate && d < formatLocalDate(sessionStartDate)) return false;
      if (sessionEndDate && d > formatLocalDate(sessionEndDate)) return false;
      return true;
    });
  }, [sessionsData, sessionStartDate, sessionEndDate]);

  const hasPlanFilters = planCategoryFilter !== 'all' || planStatusFilter !== 'all';
  const clearPlanFilters = () => {
    setPlanCategoryFilter('all');
    setPlanStatusFilter('all');
  };
  const filteredPlans = useMemo(() => {
    return [...activePlans, ...inactivePlans].filter((plan) => {
      if (planCategoryFilter !== 'all' && plan.category !== planCategoryFilter)
        return false;
      if (
        planStatusFilter !== 'all' &&
        plan.is_active !== (planStatusFilter === 'active')
      )
        return false;
      return true;
    });
  }, [activePlans, inactivePlans, planCategoryFilter, planStatusFilter]);
  // Lido da query (não guardado no estado) para refletir edições de divisões/exercícios
  const viewedPlan = plans.find((p) => p.id === viewPlanId);
  // Também lido da query: some (e o modal fecha) quando a divisão é excluída
  const viewedDay = viewedPlan?.days?.find((d) => d.id === viewDayId);

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
      set_targets: SetTarget[];
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
    onError: (err: unknown) =>
      toast({
        title: t('pages.workoutPlans.saveError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      }),
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
        set_targets: SetTarget[];
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
    onError: (err: unknown) =>
      toast({
        title: t('pages.workoutPlans.saveError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      }),
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
      exercise?: number | null;
      exercise_name: string;
      sets_target: number;
      reps_target_min: number;
      reps_target_max: number;
      load_target: string;
      load_target_unit: string;
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
          exercise: ex.exercise ?? undefined,
          exercise_name: ex.exercise_name,
          sets_target: ex.sets_target,
          reps_target_min: ex.reps_target_min,
          reps_target_max: ex.reps_target_max,
          load_target: ex.load_target || undefined,
          load_target_unit: ex.load_target_unit,
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
              // null (não undefined): PUT sem o campo manteria a carga antiga
              load: s.load || null,
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
            exercise: ex.exercise ?? undefined,
            exercise_name: ex.exercise_name,
            sets_target: ex.sets_target,
            reps_target_min: ex.reps_target_min,
            reps_target_max: ex.reps_target_max,
            load_target: ex.load_target || undefined,
            load_target_unit: ex.load_target_unit,
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
      });
      setDialog(null);
    },
    onError: (err: unknown) => {
      toast({
        title: t('pages.workoutSessions.saveError', { reason: getErrorMessage(err) }),
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
      });
      setDialog(null);
    },
    onError: (err: unknown) => {
      toast({
        title: t('pages.workoutSessions.saveError', { reason: getErrorMessage(err) }),
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
    onError: (err: unknown) =>
      toast({
        title: t('pages.exercises.saveError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      }),
  });

  const updateCatalogExerciseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExerciseCatalogFormValues }) =>
      exerciseService.update(id, { ...data, owner: ownerId }),
    onSuccess: () => {
      void invalidateCatalog();
      toast({ title: t('pages.exercises.updated') });
      setDialog(null);
    },
    onError: (err: unknown) =>
      toast({
        title: t('pages.exercises.saveError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      }),
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

  const setExerciseImageMutation = useMutation({
    mutationFn: ({ id, datasetEntryId }: { id: number; datasetEntryId: number }) =>
      exerciseService.patch(id, { dataset_entry: datasetEntryId }),
    onSuccess: () => {
      void invalidateCatalog();
      setImagePickerExercise(null);
    },
    onError: () =>
      toast({
        title: t('pages.exercises.picker.selectError'),
        variant: 'destructive',
      }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

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
      confirmText: t('common.actions.delete'),
      variant: 'destructive',
      animation: 'shake',
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
      case 'view-session':
        return (
          dialog.session.workout_day_name ?? t('pages.workoutSessions.noWorkoutDay')
        );
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
      case 'view-session':
        return dialog.session.workout_day_muscle_groups ?? '';
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
          title={t(TAB_HEADERS[activeTab].titleKey)}
          icon={TAB_HEADERS[activeTab].icon}
          actions={
            activeTab === 'sessions' ? (
              <Button onClick={() => setDialog({ type: 'new-session' })}>
                <Plus className="h-4 w-4" />
                {t('pages.workoutSessions.newSessionBtn')}
              </Button>
            ) : activeTab === 'plans' ? (
              <Button onClick={() => setDialog({ type: 'new-plan' })}>
                <Plus className="h-4 w-4" />
                {t('pages.workoutPlans.newPlanBtn')}
              </Button>
            ) : activeTab === 'exercises' ? (
              <Button onClick={() => setDialog({ type: 'new-catalog-exercise' })}>
                <Plus className="h-4 w-4" />
                {t('pages.exercises.newBtn')}
              </Button>
            ) : undefined
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
          className="flex flex-1 flex-col"
        >
          <TabsList className="mb-lg w-full">
            <TabsTrigger value="today" className="gap-xs flex-1">
              <Flame className="h-4 w-4" />
              {t('pages.workoutHub.todayPlan')}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-xs flex-1">
              <Zap className="h-4 w-4" />
              {t('pages.workoutPlans.tabSessions')}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-xs flex-1">
              <CalendarDays className="h-4 w-4" />
              {t('pages.workoutPlans.tabCalendar')}
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-xs flex-1">
              <ClipboardList className="h-4 w-4" />
              {t('pages.workoutPlans.tabPlans')}
            </TabsTrigger>
            <TabsTrigger value="exercises" className="gap-xs flex-1">
              <Dumbbell className="h-4 w-4" />
              {t('pages.workoutPlans.tabExercises')}
            </TabsTrigger>
          </TabsList>

          {/* ── Hoje ──────────────────────────────────────────────────── */}
          <TabsContent value="today" className="mt-0 flex-1">
            <TodayPlanTab activePlans={activePlans} plansLoading={plansLoading} t={t} />
          </TabsContent>

          {/* ── Sessões ─────────────────────────────────────────────────── */}
          <TabsContent value="sessions" className="mt-0 flex-1">
            {sessionsLoading ? (
              <LoadingState />
            ) : sessions.length === 0 ? (
              <EmptyState
                title={t('pages.workoutSessions.emptySessions')}
                icon={<Dumbbell className="h-8 w-8" />}
              />
            ) : (
              <>
                <FilterBar
                  className="mb-md"
                  hasActiveFilters={hasSessionFilters}
                  onClear={clearSessionFilters}
                  activeFilters={[
                    ...(sessionStartDate
                      ? [
                          {
                            key: 'startDate',
                            label: `${t('pages.workoutSessions.filterDateFrom')}: ${formatDate(sessionStartDate)}`,
                            onRemove: () => setSessionStartDate(undefined),
                          },
                        ]
                      : []),
                    ...(sessionEndDate
                      ? [
                          {
                            key: 'endDate',
                            label: `${t('pages.workoutSessions.filterDateTo')}: ${formatDate(sessionEndDate)}`,
                            onRemove: () => setSessionEndDate(undefined),
                          },
                        ]
                      : []),
                  ]}
                >
                  <FilterField
                    label={t('common.filterLabels.period')}
                    icon={CalendarDays}
                  >
                    <DateRangeFilter
                      startDate={sessionStartDate}
                      endDate={sessionEndDate}
                      onStartChange={setSessionStartDate}
                      onEndChange={setSessionEndDate}
                    />
                  </FilterField>
                </FilterBar>

                {filteredSessions.length === 0 ? (
                  <EmptyState
                    title={t('pages.workoutSessions.emptySessions')}
                    icon={<Dumbbell className="h-8 w-8" />}
                  />
                ) : (
                  <PaginatedSlide
                    key={`${sessionStartDate ? formatLocalDate(sessionStartDate) : ''}|${sessionEndDate ? formatLocalDate(sessionEndDate) : ''}`}
                    items={filteredSessions}
                    pageSize={SESSIONS_PAGE_SIZE}
                    centerList
                    className="space-y-sm"
                  >
                    {(pageSessions) =>
                      pageSessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onView={() => setDialog({ type: 'view-session', session })}
                          onEdit={() => setDialog({ type: 'edit-session', session })}
                          onDelete={() => void handleDeleteSession(session)}
                          t={t}
                        />
                      ))
                    }
                  </PaginatedSlide>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Calendário ──────────────────────────────────────────────── */}
          <TabsContent value="calendar" className="mt-0 flex-1">
            {/* Calendário + detalhe do dia centralizados na altura livre */}
            <div className="page-fill flex flex-1 flex-col justify-center">
              {plansLoading ? <LoadingState /> : <WorkoutCalendar plans={plans} />}
            </div>
          </TabsContent>

          {/* ── Planos ──────────────────────────────────────────────────── */}
          <TabsContent value="plans" className="mt-0 flex-1">
            {plansLoading ? (
              <LoadingState />
            ) : plans.length === 0 ? (
              <EmptyState
                title={t('pages.workoutPlans.emptyPlans')}
                icon={<Dumbbell className="h-8 w-8" />}
              />
            ) : (
              <>
                <FilterBar
                  className="mb-md"
                  hasActiveFilters={hasPlanFilters}
                  onClear={clearPlanFilters}
                  activeFilters={[
                    ...(planCategoryFilter !== 'all'
                      ? [
                          {
                            key: 'category',
                            label: `${t('pages.workoutPlans.category')}: ${t(`pages.workoutPlans.categories.${planCategoryFilter}`)}`,
                            onRemove: () => setPlanCategoryFilter('all'),
                          },
                        ]
                      : []),
                    ...(planStatusFilter !== 'all'
                      ? [
                          {
                            key: 'status',
                            label: `${t('common.fields.status')}: ${
                              planStatusFilter === 'active'
                                ? t('pages.workoutPlans.active')
                                : t('pages.workoutPlans.inactive')
                            }`,
                            onRemove: () => setPlanStatusFilter('all'),
                          },
                        ]
                      : []),
                  ]}
                >
                  <FilterField label={t('common.fields.category')} icon={Tag}>
                    <Select
                      value={planCategoryFilter}
                      onValueChange={(v) =>
                        setPlanCategoryFilter(v as WorkoutCategory | 'all')
                      }
                    >
                      <SelectTrigger
                        className="w-44"
                        aria-label={t('pages.workoutPlans.allCategories')}
                        startIcon={<Activity className="h-3.5 w-3.5" />}
                      >
                        <SelectValue
                          placeholder={t('pages.workoutPlans.allCategories')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('pages.workoutPlans.allCategories')}
                        </SelectItem>
                        {WORKOUT_CATEGORIES.map((key) => {
                          const CatIcon = WORKOUT_CATEGORY_ICONS[key];
                          return (
                            <SelectItem
                              key={key}
                              value={key}
                              icon={
                                CatIcon ? <CatIcon className="h-4 w-4" /> : undefined
                              }
                            >
                              {t(`pages.workoutPlans.categories.${key}`)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </FilterField>
                  <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
                    <Select
                      value={planStatusFilter}
                      onValueChange={(v) =>
                        setPlanStatusFilter(v as 'all' | 'active' | 'inactive')
                      }
                    >
                      <SelectTrigger
                        className="w-36"
                        aria-label={t('pages.workoutPlans.allStatus')}
                        startIcon={<CircleDot className="h-3.5 w-3.5" />}
                      >
                        <SelectValue placeholder={t('pages.workoutPlans.allStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('pages.workoutPlans.allStatus')}
                        </SelectItem>
                        <SelectItem
                          value="active"
                          icon={<TASK_STATUS_ICONS.active className="h-4 w-4" />}
                        >
                          {t('pages.workoutPlans.active')}
                        </SelectItem>
                        <SelectItem
                          value="inactive"
                          icon={<TASK_STATUS_ICONS.inactive className="h-4 w-4" />}
                        >
                          {t('pages.workoutPlans.inactive')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterField>
                </FilterBar>

                {filteredPlans.length === 0 ? (
                  <EmptyState
                    title={t('pages.workoutPlans.emptyPlans')}
                    icon={<Dumbbell className="h-8 w-8" />}
                  />
                ) : (
                  <PaginatedSlide
                    key={`${planCategoryFilter}|${planStatusFilter}`}
                    items={filteredPlans}
                    pageSize={planColumns * PLANS_ROWS_PER_PAGE}
                    centerList
                    className="gap-md grid sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {(pagePlans) =>
                      pagePlans.map((plan) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          onOpen={() => setViewPlanId(plan.id)}
                          onEdit={() => setDialog({ type: 'edit-plan', plan })}
                          onDelete={() => handleDeletePlan(plan)}
                          t={t}
                        />
                      ))
                    }
                  </PaginatedSlide>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Exercícios (catálogo) ────────────────────────────────────── */}
          <TabsContent value="exercises" className="mt-0 flex-1">
            {catalogExercises.length === 0 ? (
              <EmptyState
                title={t('pages.exercises.empty')}
                icon={<Dumbbell className="h-8 w-8" />}
              />
            ) : (
              <>
                <FilterBar
                  className="mb-md"
                  hasActiveFilters={
                    !!exerciseSearch ||
                    exerciseTypeFilter !== 'all' ||
                    exerciseMuscleFilter !== 'all' ||
                    exerciseCategoryFilter !== 'all'
                  }
                  onClear={() => {
                    setExerciseSearch('');
                    setExerciseTypeFilter('all');
                    setExerciseMuscleFilter('all');
                    setExerciseCategoryFilter('all');
                  }}
                  activeFilters={[
                    ...(exerciseCategoryFilter !== 'all'
                      ? [
                          {
                            key: 'category',
                            label: `${t('pages.exercises.fieldCategory')}: ${t(`pages.workoutPlans.categories.${exerciseCategoryFilter}`)}`,
                            onRemove: () => setExerciseCategoryFilter('all'),
                          },
                        ]
                      : []),
                    ...(exerciseTypeFilter !== 'all'
                      ? [
                          {
                            key: 'type',
                            label: `${t('pages.exercises.allTypes')}: ${t(`pages.workoutPlans.muscleChips.${exerciseTypeFilter}`)}`,
                            onRemove: () => setExerciseTypeFilter('all'),
                          },
                        ]
                      : []),
                    ...(exerciseMuscleFilter !== 'all'
                      ? [
                          {
                            key: 'muscle',
                            label: `${t('pages.exercises.allMuscles')}: ${t(`pages.workoutPlans.muscleChips.${exerciseMuscleFilter}`)}`,
                            onRemove: () => setExerciseMuscleFilter('all'),
                          },
                        ]
                      : []),
                  ]}
                >
                  <FilterField label={t('common.filterLabels.search')} icon={Search}>
                    <SearchInput
                      placeholder={t('pages.exercises.searchPlaceholder')}
                      value={exerciseSearch}
                      onValueChange={setExerciseSearch}
                      className="w-44"
                    />
                  </FilterField>
                  <FilterField label={t('common.fields.category')} icon={Tag}>
                    <Select
                      value={exerciseCategoryFilter}
                      onValueChange={setExerciseCategoryFilter}
                    >
                      <SelectTrigger
                        className="w-44"
                        aria-label={t('pages.exercises.allCategories')}
                        startIcon={<Activity className="h-3.5 w-3.5" />}
                      >
                        <SelectValue placeholder={t('pages.exercises.allCategories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('pages.exercises.allCategories')}
                        </SelectItem>
                        {WORKOUT_CATEGORIES.map((key) => {
                          const CatIcon = WORKOUT_CATEGORY_ICONS[key];
                          return (
                            <SelectItem
                              key={key}
                              value={key}
                              icon={
                                CatIcon ? <CatIcon className="h-4 w-4" /> : undefined
                              }
                            >
                              {t(`pages.workoutPlans.categories.${key}`)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </FilterField>
                  <FilterField label={t('common.fields.type')} icon={Shapes}>
                    <Select
                      value={exerciseTypeFilter}
                      onValueChange={setExerciseTypeFilter}
                    >
                      <SelectTrigger
                        className="w-44"
                        aria-label={t('pages.exercises.allTypes')}
                        startIcon={<Dumbbell className="h-3.5 w-3.5" />}
                      >
                        <SelectValue placeholder={t('pages.exercises.allTypes')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('pages.exercises.allTypes')}
                        </SelectItem>
                        {EXERCISE_TYPE_FILTER_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {t(`pages.workoutPlans.muscleChips.${key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>
                  <FilterField label={t('common.filterLabels.muscle')} icon={Dumbbell}>
                    <Select
                      value={exerciseMuscleFilter}
                      onValueChange={setExerciseMuscleFilter}
                    >
                      <SelectTrigger
                        className="w-44"
                        aria-label={t('pages.exercises.allMuscles')}
                        startIcon={<Layers className="h-3.5 w-3.5" />}
                      >
                        <SelectValue placeholder={t('pages.exercises.allMuscles')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('pages.exercises.allMuscles')}
                        </SelectItem>
                        {EXERCISE_MUSCLE_FILTER_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {t(`pages.workoutPlans.muscleChips.${key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterField>
                </FilterBar>

                {filteredCatalogExercises.length === 0 ? (
                  <EmptyState
                    title={t('pages.exercises.noResults')}
                    icon={<Dumbbell className="h-8 w-8" />}
                  />
                ) : (
                  <PaginatedSlide
                    // Filtro novo → remonta e volta à página 1
                    key={`${exerciseSearch}|${exerciseCategoryFilter}|${exerciseTypeFilter}|${exerciseMuscleFilter}`}
                    items={filteredCatalogExercises}
                    pageSize={catalogColumns * CATALOG_ROWS_PER_PAGE}
                    centerList
                    className="gap-sm grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  >
                    {(pageExercises) =>
                      pageExercises.map((exercise) => (
                        <ExerciseCatalogCard
                          key={exercise.id}
                          exercise={exercise}
                          onEdit={() =>
                            setDialog({ type: 'edit-catalog-exercise', exercise })
                          }
                          onDelete={() => handleDeleteCatalogExercise(exercise)}
                          onChangeImage={() => setImagePickerExercise(exercise)}
                        />
                      ))
                    }
                  </PaginatedSlide>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Divisões do plano ─────────────────────────────────────────── */}
        {/* Antes do Dialog principal: os formulários abertos daqui empilham por cima */}
        <Dialog
          open={!!viewedPlan}
          onOpenChange={(open) => {
            if (open) return;
            setViewPlanId(null);
            setViewDayId(null);
          }}
        >
          <DialogContent className="max-w-5xl">
            {viewedPlan && (
              <>
                <DialogHeader>
                  <DialogTitle className="gap-sm flex items-center">
                    <ClipboardList
                      className="text-primary h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    {viewedPlan.name}
                  </DialogTitle>
                  <DialogDescription>
                    {viewedPlan.day_count} {t('pages.workoutPlans.days')} ·{' '}
                    {viewedPlan.exercise_count} {t('pages.workoutPlans.exercises')}
                  </DialogDescription>
                </DialogHeader>
                <div className="px-xs py-xs">
                  <PlanDaysList
                    plan={viewedPlan}
                    onOpenDay={(day) => setViewDayId(day.id)}
                    t={t}
                  />
                </div>
                <DialogCloseFooter>
                  <Button
                    onClick={() =>
                      setDialog({ type: 'new-day', planId: viewedPlan.id })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    {t('pages.workoutPlans.newDayBtn')}
                  </Button>
                </DialogCloseFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Exercícios da divisão (por cima do modal do plano) ──────────── */}
        <Dialog open={!!viewedDay} onOpenChange={(open) => !open && setViewDayId(null)}>
          <DialogContent className="max-w-5xl">
            {viewedDay && (
              <>
                <DialogHeader>
                  <div className="gap-sm flex items-start justify-between">
                    <div className="min-w-0">
                      <DialogTitle className="gap-sm flex items-center">
                        <span className="text-primary">
                          {getMuscleIcon(viewedDay.muscle_groups)}
                        </span>
                        {viewedDay.name}
                      </DialogTitle>
                      <DialogDescription>
                        {viewedDay.muscle_groups && `${viewedDay.muscle_groups} · `}
                        {viewedDay.exercise_count} {t('pages.workoutPlans.exercises')}
                      </DialogDescription>
                    </div>
                    <div className="gap-xs flex shrink-0">
                      <Button
                        aria-label={t('common.actions.edit')}
                        variant="ghost"
                        size="icon"
                        onClick={() => setDialog({ type: 'edit-day', day: viewedDay })}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={t('common.actions.delete')}
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteDay(viewedDay)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                <div className="pr-xs">
                  <div>
                    {viewedDay.exercises && viewedDay.exercises.length > 0 ? (
                      <ExerciseList
                        exercises={viewedDay.exercises}
                        onEdit={(ex) =>
                          setDialog({
                            type: 'edit-exercise',
                            exercise: ex,
                            day: viewedDay,
                          })
                        }
                        onDelete={handleDeleteExercise}
                      />
                    ) : (
                      <p className="py-lg text-muted-foreground text-center text-sm">
                        {t('pages.workoutPlans.noExercises')}
                      </p>
                    )}
                  </div>
                </div>
                <DialogCloseFooter>
                  <Button
                    onClick={() => setDialog({ type: 'add-exercise', day: viewedDay })}
                  >
                    <Plus className="h-4 w-4" />
                    {t('pages.workoutPlans.addExerciseBtn')}
                  </Button>
                </DialogCloseFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Dialog ──────────────────────────────────────────────────────── */}
        <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent
            className={
              isExerciseDialog || dialog?.type === 'view-session'
                ? 'max-w-5xl'
                : isSessionDialog
                  ? 'max-w-4xl'
                  : dialog?.type === 'new-day' || dialog?.type === 'edit-day'
                    ? 'max-w-2xl'
                    : 'max-w-xl'
            }
          >
            <DialogHeader>
              <DialogTitle
                mode={
                  dialog?.type.startsWith('edit')
                    ? 'edit'
                    : dialog?.type.startsWith('new') || dialog?.type === 'add-exercise'
                      ? 'create'
                      : undefined
                }
                className={cn(
                  dialog?.type === 'view-session' && 'gap-sm flex items-center'
                )}
              >
                {dialog?.type === 'view-session' && (
                  <Dumbbell className="text-primary h-5 w-5" />
                )}
                {dialogTitle()}
              </DialogTitle>
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
                bodyWeightKg={latestBodyWeightKg}
                exercises={catalogExercises.filter(
                  (ex) =>
                    ex.category ===
                      plans.find((p) => p.id === dialog.day.plan)?.category ||
                    (dialog.type === 'edit-exercise' &&
                      ex.id === dialog.exercise.exercise)
                )}
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

            {dialog?.type === 'view-session' && (
              <SessionDetails session={dialog.session} t={t} />
            )}

            {(dialog?.type === 'new-session' || dialog?.type === 'edit-session') && (
              <WorkoutSessionForm
                workoutDays={allDaysList}
                ownerId={ownerId}
                session={dialog.type === 'edit-session' ? dialog.session : undefined}
                bodyWeightKg={latestBodyWeightKg}
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
          </DialogContent>
        </Dialog>

        <ExerciseDatasetPicker
          open={!!imagePickerExercise}
          onOpenChange={(open) => !open && setImagePickerExercise(null)}
          onSelect={(entry) => {
            if (!imagePickerExercise) return;
            setExerciseImageMutation.mutate({
              id: imagePickerExercise.id,
              datasetEntryId: entry.id,
            });
          }}
        />
      </PageContainer>
    </AnimatedPage>
  );
}

// ── Catalog exercise sub-components ────────────────────────────────────────

function ExerciseCatalogCard({
  exercise,
  onEdit,
  onDelete,
  onChangeImage,
}: {
  exercise: Exercise;
  onEdit: () => void;
  onDelete: () => void;
  onChangeImage: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="group border-border bg-card p-md relative flex flex-col rounded-lg border transition-colors">
      <div className="mb-sm gap-sm flex items-start justify-between">
        <ExerciseThumbnail
          gifUrl={exercise.gif_url}
          thumbnailUrl={exercise.thumbnail_url}
          size="lg"
        />
        <div className="gap-xs flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onChangeImage}
            aria-label={t('pages.exercises.changeImage')}
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            aria-label={t('common.actions.edit')}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            aria-label={t('common.actions.delete')}
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive h-7 w-7"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-foreground leading-tight font-semibold">{exercise.name}</p>
      <Badge variant="secondary" className="mt-xs w-fit text-xs">
        {t(`pages.workoutPlans.categories.${exercise.category}`)}
      </Badge>
      {exercise.muscle_groups && (
        <p className="mt-xs text-muted-foreground text-xs">{exercise.muscle_groups}</p>
      )}
      {exercise.description && (
        <p className="mt-sm text-muted-foreground/70 line-clamp-2 text-xs">
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

// Subconjuntos de CATALOG_MUSCLE_CHIP_KEYS usados nos filtros da aba de
// exercícios: categoria de treino (tipo de estímulo) vs. categoria muscular
// (grupo muscular alvo).
const EXERCISE_TYPE_FILTER_KEYS = [
  'push',
  'pull',
  'cardio',
  'hiit',
  'running',
  'cycling',
  'swimming',
  'fullBody',
] as const;

const EXERCISE_MUSCLE_FILTER_KEYS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'forearms',
  'lowerBack',
  'traps',
  'adductors',
  'abductors',
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
    category: exercise?.category ?? 'resistance',
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
    <form onSubmit={handleSubmit} className="gap-md flex min-h-0 flex-1 flex-col">
      {/* Só os campos rolam; título (DialogHeader) e rodapé ficam fixos */}
      <div className="space-y-lg px-xs">
        {/* Nome */}
        <FormSection title={t('pages.exercises.fieldName')} icon={Dumbbell}>
          <Input
            placeholder={t('pages.exercises.fieldNamePlaceholder')}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </FormSection>

        {/* Categoria */}
        <FormSection title={t('pages.exercises.fieldCategory')} icon={Activity}>
          <div className="gap-sm grid grid-cols-3">
            {WORKOUT_CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={values.category === key}
                onClick={() => setValues((v) => ({ ...v, category: key }))}
                className={cn(
                  'px-sm py-sm rounded-lg border-2 text-sm font-medium transition',
                  values.category === key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                )}
              >
                {t(`pages.workoutPlans.categories.${key}`)}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Grupos musculares */}
        <FormSection title={t('pages.exercises.fieldMuscles')} icon={Layers}>
          <div className="space-y-sm">
            <div className="gap-xs flex flex-wrap">
              {CATALOG_MUSCLE_CHIP_KEYS.map((key) => {
                const label = t(`pages.workoutPlans.muscleChips.${key}`);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleChip(label)}
                    className={cn(
                      'px-sm py-xs rounded-full border text-xs font-medium transition',
                      selectedChips.includes(label)
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary'
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
      </div>

      <div className="dialog-footer gap-sm pt-sm flex justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
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
      className="group gap-sm bg-background px-sm py-xs flex items-center rounded-lg"
    >
      <PlainButton
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </PlainButton>
      <span className="bg-primary/20 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
        {idx + 1}
      </span>
      <ExerciseThumbnail thumbnailUrl={ex.thumbnail_url} size="sm" />
      {/* Nome em cima, badges embaixo quebrando linha: cabe em colunas estreitas */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={ex.name}>
          {ex.name}
        </p>
        <div className="gap-xs mt-0.5 flex flex-wrap items-center">
          {formatSetTargets(ex) ? (
            <span className="bg-muted px-xs text-muted-foreground rounded-full py-px text-xs">
              {formatSetTargets(ex)}
            </span>
          ) : (
            formatExerciseLoad(ex, t) && (
              <span className="bg-muted px-xs text-muted-foreground rounded-full py-px text-xs">
                {formatExerciseLoad(ex, t)}
              </span>
            )
          )}
          {ex.sets > 0 ? (
            <>
              <span className="bg-primary/15 px-xs text-primary rounded-full py-px text-xs font-semibold">
                {ex.sets}×
              </span>
              <span className="bg-muted px-xs text-muted-foreground rounded-full py-px text-xs">
                {ex.reps_min}–{ex.reps_max}
              </span>
            </>
          ) : (
            <span className="bg-muted px-xs text-muted-foreground rounded-full py-px text-xs">
              {t('pages.workoutPlans.noSets')}
            </span>
          )}
          {ex.rest_seconds != null && ex.rest_seconds > 0 && (
            <span className="bg-muted px-xs text-muted-foreground flex items-center gap-0.5 rounded-full py-px text-xs">
              <Clock className="h-2.5 w-2.5" />
              {ex.rest_seconds}s
            </span>
          )}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="gap-xs flex shrink-0">
          {onEdit && (
            <PlainButton
              aria-label={t('common.actions.edit')}
              type="button"
              onClick={() => onEdit(ex)}
              className="p-xs hover:bg-muted rounded"
            >
              <Edit className="h-3 w-3" />
            </PlainButton>
          )}
          {onDelete && (
            <PlainButton
              aria-label={t('common.actions.delete')}
              type="button"
              onClick={() => onDelete(ex)}
              className="p-xs text-destructive hover:bg-destructive/10 rounded"
            >
              <Trash2 className="h-3 w-3" />
            </PlainButton>
          )}
        </div>
      )}
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
      <SortableContext items={items.map((e) => e.id)} strategy={rectSortingStrategy}>
        {/* 2 por linha: 1º, 3º, 5º… à esquerda; 2º, 4º… à direita */}
        <div className="gap-xs grid sm:grid-cols-2">
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

interface PlanCardProps {
  plan: WorkoutPlan;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

function PlanCard({ plan, onOpen, onEdit, onDelete, t }: PlanCardProps) {
  return (
    <div className="bg-card border-border flex flex-col overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={onOpen}
        className="gap-sm p-md flex flex-1 items-start text-left"
      >
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            plan.is_active
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate font-semibold">{plan.name}</p>
          <p className="text-muted-foreground text-xs">
            {t(`pages.workoutPlans.categories.${plan.category}`)}
          </p>
          {plan.description && (
            <p className="mt-xs text-muted-foreground line-clamp-2 text-xs">
              {plan.description}
            </p>
          )}
          <p className="mt-sm text-muted-foreground text-xs">
            {plan.day_count} {t('pages.workoutPlans.days')} · {plan.exercise_count}{' '}
            {t('pages.workoutPlans.exercises')}
          </p>
        </div>
      </button>
      <div className="border-border px-md py-xs flex items-center justify-between border-t">
        <Badge
          variant={plan.is_active ? 'success' : 'secondary'}
          className="gap-xs text-xs"
        >
          {(() => {
            const StatusIcon =
              TASK_STATUS_ICONS[plan.is_active ? 'active' : 'inactive'];
            return <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />;
          })()}
          {plan.is_active
            ? t('pages.workoutPlans.active')
            : t('pages.workoutPlans.inactive')}
        </Badge>
        <div className="gap-xs flex">
          <Button
            aria-label={t('common.actions.edit')}
            variant="ghost"
            size="icon"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            aria-label={t('common.actions.delete')}
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PlanDaysListProps {
  plan: WorkoutPlan;
  onOpenDay: (day: WorkoutDay) => void;
  t: (key: string) => string;
}

/** Cards das divisões pela ordem; quebram linha em vez de rolar para o lado. */
function PlanDaysList({ plan, onOpenDay, t }: PlanDaysListProps) {
  const days = [...(plan.days ?? [])].sort((a, b) => a.order - b.order || a.id - b.id);

  if (days.length === 0) {
    return <EmptyState title={t('pages.workoutHub.emptyDays')} />;
  }

  return (
    <div className="gap-sm flex flex-wrap justify-center">
      {days.map((day) => (
        <button
          key={day.id}
          type="button"
          onClick={() => onOpenDay(day)}
          // Larguras = colunas do antigo grid (2/3/5), descontando o gap; flex centraliza a última linha
          className="p-sm border-border bg-background flex w-[calc((100%-var(--spacing-sm))/2)] flex-col items-start rounded-lg border-2 text-left sm:w-[calc((100%-2*var(--spacing-sm))/3)] lg:w-[calc((100%-4*var(--spacing-sm))/5)]"
        >
          <div className="mb-sm bg-primary/15 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
            {getMuscleIcon(day.muscle_groups)}
          </div>
          <span className="text-foreground text-sm leading-tight font-semibold">
            {day.name}
          </span>
          {day.muscle_groups && (
            <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
              {day.muscle_groups}
            </span>
          )}
          <span className="mt-sm text-muted-foreground text-xs">
            {day.exercise_count} {t('pages.workoutPlans.exercises')}
          </span>
        </button>
      ))}
    </div>
  );
}

interface SessionCardProps {
  session: WorkoutSession;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function SessionCard({ session, onView, onEdit, onDelete, t }: SessionCardProps) {
  const exerciseCount = session.session_exercises?.length ?? 0;
  const date = new Date(session.date + 'T12:00:00');
  const dayNum = date.getDate();
  const monthLabel = t(
    `pages.planningDashboard.monthShort.${date.getMonth()}`
  ).toUpperCase();

  return (
    // Card inteiro abre os detalhes; editar/excluir param a propagação
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onView();
        }
      }}
      className="group gap-md border-border bg-card p-md focus-visible:ring-ring flex cursor-pointer rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* Date block */}
      <div className="bg-primary/10 py-sm flex w-14 shrink-0 flex-col items-center justify-center rounded-lg text-center">
        <span className="text-primary text-2xl leading-none font-bold">{dayNum}</span>
        <span className="text-primary/70 text-2xs mt-0.5 font-semibold tracking-wide uppercase">
          {monthLabel}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="gap-sm flex items-start justify-between">
          <div className="min-w-0">
            <p className="leading-snug font-semibold">
              {session.workout_day_name ?? t('pages.workoutSessions.noWorkoutDay')}
            </p>
            {session.workout_day_muscle_groups && (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {session.workout_day_muscle_groups}
              </p>
            )}
          </div>
          <div className="gap-xs flex shrink-0">
            <Button
              aria-label={t('common.actions.edit')}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              aria-label={t('common.actions.delete')}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="mt-sm gap-xs flex flex-wrap items-center">
          {session.session_exercises && session.session_exercises.length > 0 && (
            <div className="-space-x-sm flex">
              {session.session_exercises.slice(0, 4).map((se) => (
                <div
                  key={se.id}
                  className="border-card bg-muted h-6 w-6 overflow-hidden rounded-full border-2"
                >
                  {se.thumbnail_url ? (
                    <img
                      src={se.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Dumbbell className="text-muted-foreground h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}
              {session.session_exercises.length > 4 && (
                <div className="border-card bg-muted text-muted-foreground text-2xs flex h-6 w-6 items-center justify-center rounded-full border-2 font-semibold">
                  +{session.session_exercises.length - 4}
                </div>
              )}
            </div>
          )}
          {session.duration_minutes != null && (
            <span className="gap-xs border-border bg-background px-sm text-muted-foreground flex items-center rounded-full border py-0.5 text-xs">
              <Clock className="h-3 w-3" />
              {formatDuration(session.duration_minutes)}
            </span>
          )}
          {exerciseCount > 0 && (
            <span className="gap-xs border-border bg-background px-sm text-muted-foreground flex items-center rounded-full border py-0.5 text-xs">
              <Dumbbell className="h-3 w-3" />
              {exerciseCount} {t('pages.workoutPlans.exercises')}
            </span>
          )}
          {session.notes && (
            <span className="text-muted-foreground line-clamp-1 text-xs">
              {session.notes}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionDetails({
  session,
  t,
}: {
  session: WorkoutSession;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { i18n } = useTranslation();
  const date = new Date(session.date + 'T12:00:00').toLocaleDateString(i18n.language);
  const time = (v?: string | null) => (v ? v.slice(0, 5) : '—');
  const fmtLoad = (v: string) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
      Number(v)
    );
  const exercises = [...(session.session_exercises ?? [])].sort(
    (a, b) => a.order - b.order
  );
  const info = [
    { icon: CalendarDays, label: t('pages.workoutSessions.date'), value: date },
    {
      icon: Clock,
      label: `${t('pages.workoutSessions.startTime')} – ${t('pages.workoutSessions.endTime')}`,
      value: `${time(session.started_at)} – ${time(session.finished_at)}`,
    },
    {
      icon: Timer,
      label: t('pages.workoutSessions.duration'),
      value:
        session.duration_minutes != null
          ? formatDuration(session.duration_minutes)
          : '—',
    },
  ];

  return (
    <div className="space-y-md">
      <div className="gap-sm grid grid-cols-1 sm:grid-cols-3">
        {info.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-muted/40 p-sm rounded-md">
            <p className="gap-xs text-muted-foreground flex items-center text-xs">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-sm">
        <p className="gap-xs flex items-center text-sm font-medium">
          <ListChecks className="text-muted-foreground h-4 w-4" />
          {t('pages.workoutSessions.exercisesSection')}
        </p>
        <div className="gap-sm grid grid-cols-1 items-start md:grid-cols-2 xl:grid-cols-3">
          {exercises.map((se) => (
            <div key={se.id} className="border-border/60 rounded-md border">
              <p className="bg-muted/30 px-sm py-xs text-sm font-medium">
                {se.exercise_name}
              </p>
              {se.sets.length === 0 ? (
                <p className="px-sm py-xs text-muted-foreground text-xs">
                  {t('pages.workoutPlans.noSets')}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="px-sm py-xs text-left font-medium">
                        {t('pages.workoutSessions.setNumber')}
                      </th>
                      <th className="px-sm py-xs text-left font-medium">
                        {t('pages.workoutSessions.load')}
                      </th>
                      <th className="px-sm py-xs text-left font-medium">
                        {t('pages.workoutSessions.repsDone')}
                      </th>
                      <th className="px-sm py-xs w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-border/40 divide-y">
                    {[...se.sets]
                      .sort((a, b) => a.set_number - b.set_number)
                      .map((set) => (
                        <tr key={set.id}>
                          <td className="px-sm py-xs">{set.set_number}</td>
                          <td className="px-sm py-xs">
                            {set.load != null
                              ? `${fmtLoad(set.load)} ${set.load_unit_display}`
                              : t('pages.workoutSessions.bodyweight')}
                          </td>
                          <td className="px-sm py-xs">{set.reps_done ?? '—'}</td>
                          <td className="px-sm py-xs">
                            {set.completed && (
                              <Check className="text-success h-3.5 w-3.5" />
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </div>

      {session.notes && (
        <div className="space-y-xs">
          <p className="gap-xs flex items-center text-sm font-medium">
            <NotebookPen className="text-muted-foreground h-4 w-4" />
            {t('pages.workoutSessions.sessionNotes')}
          </p>
          <p className="text-muted-foreground text-sm whitespace-pre-line">
            {session.notes}
          </p>
        </div>
      )}

      <DialogCloseFooter />
    </div>
  );
}

// ── Today Plan Tab ──────────────────────────────────────────────────────────

interface TodayPlanTabProps {
  activePlans: WorkoutPlan[];
  plansLoading: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function TodayPlanTab({ activePlans, plansLoading, t }: TodayPlanTabProps) {
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat → convert to Python convention 0=Mon,6=Sun
  const jsDay = new Date().getDay();
  const todayWeekday = jsDay === 0 ? 6 : jsDay - 1;
  const [openDay, setOpenDay] = useState<WorkoutDay | null>(null);

  if (plansLoading) return <LoadingState />;

  return (
    <div className="page-fill space-y-lg flex flex-1 flex-col justify-center">
      {/* Plano ativo */}
      {(() => {
        const plansForToday = activePlans.filter((plan) =>
          plan.days.some(
            (day) =>
              day.days_of_week.length === 0 || day.days_of_week.includes(todayWeekday)
          )
        );

        if (activePlans.length === 0) {
          return (
            <EmptyState
              title={t('pages.workoutHub.noActivePlan')}
              icon={<Dumbbell className="h-8 w-8" />}
            />
          );
        }

        if (plansForToday.length === 0) {
          return (
            <EmptyState
              title={t('pages.workoutHub.noTrainingToday')}
              icon={<Dumbbell className="h-8 w-8" />}
            />
          );
        }

        return plansForToday.map((plan) => (
          <div key={plan.id} className="space-y-sm">
            <div className="gap-sm flex items-center">
              <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <ClipboardList className="text-primary h-4 w-4" />
              </div>
              <p className="text-foreground text-sm font-semibold">{plan.name}</p>
            </div>

            {plan.days.length === 0 ? (
              <EmptyState title={t('pages.workoutPlans.emptyDays')} />
            ) : (
              <div className="space-y-sm">
                {plan.days
                  .filter(
                    (day) =>
                      day.days_of_week.length === 0 ||
                      day.days_of_week.includes(todayWeekday)
                  )
                  .map((day) => (
                    <button
                      type="button"
                      key={day.id}
                      onClick={() => setOpenDay(day)}
                      className="border-border bg-card w-full overflow-hidden rounded-lg border text-left"
                    >
                      <div className="px-md py-sm flex items-center justify-between">
                        <div className="gap-sm flex items-center">
                          <span className="text-primary">
                            {getMuscleIcon(day.muscle_groups)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{day.name}</p>
                            {day.muscle_groups && (
                              <p className="text-muted-foreground text-xs">
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
                    </button>
                  ))}
              </div>
            )}
          </div>
        ));
      })()}

      {/* Modal exercícios da divisão */}
      <Dialog open={!!openDay} onOpenChange={(open) => !open && setOpenDay(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <span className="text-primary shrink-0" aria-hidden="true">
                {getMuscleIcon(openDay?.muscle_groups)}
              </span>
              {openDay?.name}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>{openDay?.muscle_groups}</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {openDay?.exercises.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('pages.workoutPlans.noExercises')}
            </p>
          ) : (
            <div className="divide-border/40 divide-y rounded-lg border">
              {openDay?.exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="gap-sm px-md py-xs flex items-center justify-between"
                >
                  <div className="gap-sm flex items-center">
                    <Dumbbell className="text-primary h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">{ex.name}</span>
                  </div>
                  <div className="gap-sm text-muted-foreground flex items-center text-xs">
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
                    {(formatSetTargets(ex) ?? formatExerciseLoad(ex, t)) && (
                      <span className="text-foreground font-medium">
                        {formatSetTargets(ex) ?? formatExerciseLoad(ex, t)}
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
          <DialogCloseFooter />
        </DialogContent>
      </Dialog>
    </div>
  );
}
