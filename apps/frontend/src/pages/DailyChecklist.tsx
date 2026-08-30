/* eslint-disable max-lines */
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  CheckCircle2,
  Circle,
  StickyNote,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Flame,
  Zap,
  Moon,
  Sun,
  Sunset,
  Timer,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { FocusBlocksSection } from '@/components/personal-planning/FocusBlocksSection';
import { KanbanCard } from '@/components/personal-planning/KanbanCard';
import { KanbanColumn } from '@/components/personal-planning/KanbanColumn';
import { XPFloating, useXPTrigger } from '@/components/personal-planning/XPFloating';
import { TaskCategoryBadge } from '@/components/today-tasks/TaskCategoryBadge';
import { Button } from '@/components/ui/button';
import { CircularProgress } from '@/components/ui/circular-progress';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SuccessAnimation } from '@/components/ui/success-animation';
import { Textarea } from '@/components/ui/textarea';
import { translate } from '@/config/constants';
import { useTaskReminders } from '@/hooks/use-task-reminders';
import { useToast } from '@/hooks/use-toast';
import { cn, formatLocalDate, parseLocalDate } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { appService } from '@/services/app-service';
import { dailyReflectionsService } from '@/services/daily-reflections-service';
import { membersService } from '@/services/members-service';
import { taskInstancesService } from '@/services/task-instances-service';
import { useNotificationsStore } from '@/stores/notifications-store';
import {
  MOOD_CHOICES,
  type TaskInstance,
  type TaskCard,
  type KanbanStatus,
  type InstanceStatus,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type ViewMode = 'list' | 'kanban';
const VIEW_MODE_KEY = 'dailyChecklist.viewMode';
const POMODORO_CYCLES_KEY = 'dailyChecklist.pomodoroCycles';

type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';
const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

function PomodoroBar() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [secondsLeft, setSecondsLeft] = useState(POMODORO_DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState<number>(() => {
    const stored = localStorage.getItem(POMODORO_CYCLES_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = POMODORO_DURATIONS[mode];
  const progress = ((total - secondsLeft) / total) * 100;
  const timeString = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  const handleComplete = useCallback(() => {
    setRunning(false);
    if (mode === 'focus') {
      const next = cycles + 1;
      setCycles(next);
      localStorage.setItem(POMODORO_CYCLES_KEY, String(next));
      toast({ title: t('pages.todayTasks.pomodoroFocusDone') });
    } else {
      toast({ title: t('pages.todayTasks.pomodoroBreakDone') });
    }
  }, [mode, cycles, toast, t]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, handleComplete]);

  const switchMode = (m: PomodoroMode) => {
    setRunning(false);
    setMode(m);
    setSecondsLeft(POMODORO_DURATIONS[m]);
  };

  const ringColor =
    mode === 'focus'
      ? 'hsl(var(--primary))'
      : mode === 'shortBreak'
        ? 'hsl(var(--chart-2))'
        : 'hsl(var(--warning))';

  return (
    <div className="gap-md bg-card px-lg py-md flex items-center rounded-lg border">
      <div className="gap-sm flex items-center">
        <Timer className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground text-sm font-medium">
          {t('pages.todayTasks.pomodoroTitle')}
        </span>
      </div>
      <div className="gap-xs flex items-center rounded-md border p-0.5">
        {(['focus', 'shortBreak', 'longBreak'] as PomodoroMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={cn(
              'px-sm py-xs rounded text-xs transition-colors',
              mode === m
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`pages.todayTasks.pomodoroMode.${m}`)}
          </button>
        ))}
      </div>
      <CircularProgress value={progress} size={52} strokeWidth={4} color={ringColor}>
        <span className="text-xs font-bold tabular-nums">{timeString}</span>
      </CircularProgress>
      <div className="gap-xs flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setRunning((r) => !r)}
          aria-label={
            running
              ? t('pages.todayTasks.pomodoroPause')
              : t('pages.todayTasks.pomodoroStart')
          }
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            setRunning(false);
            setSecondsLeft(POMODORO_DURATIONS[mode]);
          }}
          aria-label={t('pages.todayTasks.pomodoroReset')}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      {cycles > 0 && (
        <span className="text-muted-foreground ml-auto text-xs">
          {t('pages.todayTasks.pomodoroCycles', { count: cycles })}
        </span>
      )}
    </div>
  );
}

// Mapeia status de instância para status do Kanban
const mapInstanceToKanban = (status: InstanceStatus): KanbanStatus => {
  switch (status) {
    case 'completed':
      return 'done';
    case 'in_progress':
      return 'doing';
    default:
      return 'todo';
  }
};

// Mapeia status do Kanban para status de instância
const mapKanbanToInstance = (status: KanbanStatus): InstanceStatus => {
  switch (status) {
    case 'done':
      return 'completed';
    case 'doing':
      return 'in_progress';
    default:
      return 'pending';
  }
};

interface DailyChecklistProps {
  embedded?: boolean;
}

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function DailyChecklist({ embedded = false }: DailyChecklistProps) {
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [blockedTaskIds, setBlockedTaskIds] = useState<Set<number>>(new Set());
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [activeCard, setActiveCard] = useState<TaskCard | null>(null);
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState<string>('');
  const [reflectionId, setReflectionId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [ownerId, setOwnerId] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'kanban'
  );
  const [showCelebration, setShowCelebration] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const prevDayRateRef = useRef<number>(0);
  const xp = useXPTrigger();
  useTaskReminders(cards);
  const [summary, setSummary] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    completion_rate: 0,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const measuringConfig = { droppable: { strategy: MeasuringStrategy.Always } };

  const convertInstancesToCards = (list: TaskInstance[]): TaskCard[] =>
    list.map((instance) => ({
      id: `instance-${instance.id}`,
      task_id: instance.id,
      task_name: instance.task_name,
      description: instance.task_description || undefined,
      category: instance.category,
      category_display: instance.category_display,
      icon: instance.icon || undefined,
      unit: instance.unit,
      index: instance.occurrence_index,
      total_instances: list.filter((i) => i.template === instance.template).length,
      status: mapInstanceToKanban(instance.status),
      notes: instance.notes || undefined,
      record_id: instance.id,
      scheduled_time: instance.time_display || undefined,
    }));

  const cardsByStatus = useMemo(
    () => ({
      todo: cards.filter((c) => c.status === 'todo'),
      doing: cards.filter((c) => c.status === 'doing'),
      done: cards.filter((c) => c.status === 'done'),
    }),
    [cards]
  );

  const looseCardsByStatus = useMemo(
    () => ({
      todo: cards.filter((c) => c.status === 'todo' && !blockedTaskIds.has(c.task_id)),
      doing: cards.filter(
        (c) => c.status === 'doing' && !blockedTaskIds.has(c.task_id)
      ),
      done: cards.filter((c) => c.status === 'done' && !blockedTaskIds.has(c.task_id)),
    }),
    [cards, blockedTaskIds]
  );

  const looseInstances = useMemo(
    () => instances.filter((i) => !blockedTaskIds.has(i.id)),
    [instances, blockedTaskIds]
  );

  const dayRate =
    cards.length > 0 ? (cardsByStatus.done.length / cards.length) * 100 : 0;
  const dayRingColor =
    dayRate >= 80
      ? 'hsl(var(--chart-2))'
      : dayRate >= 40
        ? 'hsl(var(--warning))'
        : 'hsl(var(--primary))';

  const hour = new Date().getHours();
  const greeting = useMemo(() => {
    if (hour < 12) return { label: t('pages.todayTasks.greetingMorning'), Icon: Sun };
    if (hour < 18)
      return { label: t('pages.todayTasks.greetingAfternoon'), Icon: Sunset };
    return { label: t('pages.todayTasks.greetingEvening'), Icon: Moon };
  }, [hour, t]);

  useQuery({
    queryKey: ['daily-checklist', 'data', selectedDate, ownerId],
    queryFn: async () => {
      await loadData();
      return true;
    },
    enabled: ownerId > 0 && !!selectedDate,
  });

  // Deriva os cards a partir de `instances` durante o render (sem efeito),
  // permitindo que `setCards` continue editável localmente (drag-and-drop).
  const [lastInstances, setLastInstances] = useState(instances);
  if (instances !== lastInstances) {
    setLastInstances(instances);
    setCards(instances.length > 0 ? convertInstancesToCards(instances) : []);
  }

  useEffect(() => {
    if (cards.length > 0 && dayRate === 100 && prevDayRateRef.current < 100) {
      const timer = setTimeout(() => {
        setShowCelebration(true);
        toast({
          title: (
            <span className="gap-xs flex items-center">
              <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
              {t('pages.todayTasks.allDoneTitle')}
            </span>
          ),
        });
      }, 0);
      prevDayRateRef.current = dayRate;
      return () => clearTimeout(timer);
    }
    prevDayRateRef.current = dayRate;
  }, [dayRate, cards.length, toast, t]);

  const loadCurrentUserMember = async () => {
    try {
      const member = await membersService.getCurrentUserMember();
      setOwnerId(member.id);
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyChecklist.loadUserError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Inicialização única por montagem: um `useQuery` com chave fixa fica sujeito
  // a refetchOnWindowFocus/staleness e pode reexecutar em segundo plano,
  // sobrescrevendo silenciosamente a data que o usuário selecionou manualmente
  // com a data atual do servidor. Um `useEffect` guardado por ref roda apenas
  // uma vez por montagem real do componente e nunca é reacionado por foco de
  // janela ou reconexão.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void (async () => {
      await loadCurrentUserMember();
      try {
        const serverDate = await appService.getCurrentDate();
        setSelectedDate(serverDate);
      } catch {
        setSelectedDate(formatLocalDate(new Date()));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (sync: boolean = false) => {
    try {
      setIsLoading(true);
      const [instancesResponse, reflections] = await Promise.all([
        taskInstancesService.getForDate(selectedDate, sync),
        dailyReflectionsService.getAll(),
      ]);
      setInstances(instancesResponse.instances);
      setSummary(instancesResponse.summary);
      const dayReflection = reflections.find((r) => r.date === selectedDate);
      if (dayReflection) {
        setReflection(dayReflection.reflection);
        setMood(dayReflection.mood || '');
        setReflectionId(dayReflection.id);
      } else {
        setReflection('');
        setMood('');
        setReflectionId(undefined);
      }
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyChecklist.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTaskComplete = useCallback(
    async (task: TaskInstance) => {
      const newStatus: InstanceStatus =
        task.status === 'completed' ? 'pending' : 'completed';
      setUpdatingTaskId(task.id);
      setInstances((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      );
      try {
        await taskInstancesService.bulkUpdate([{ id: task.id, status: newStatus }]);
      } catch (error: unknown) {
        setInstances((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        );
        toast({
          title: t('pages.dailyChecklist.saveError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [toast, t]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveCard(cards.find((c) => c.id === active.id) || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    setCards((prevCards) => {
      const ac = prevCards.find((c) => c.id === activeId);
      const oc = prevCards.find((c) => c.id === overId);
      if (!ac) return prevCards;
      let targetStatus: KanbanStatus | undefined;
      if (oc) targetStatus = oc.status;
      else if (['todo', 'doing', 'done'].includes(overId))
        targetStatus = overId as KanbanStatus;
      if (!targetStatus || ac.status === targetStatus) return prevCards;
      return prevCards.map((card) =>
        card.id === activeId ? { ...card, status: targetStatus } : card
      );
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    setCards((prevCards) => {
      const ac = prevCards.find((c) => c.id === activeId);
      const oc = prevCards.find((c) => c.id === overId);
      if (!ac) return prevCards;
      let finalStatus: KanbanStatus | undefined;
      if (oc) finalStatus = oc.status;
      else if (['todo', 'doing', 'done'].includes(overId))
        finalStatus = overId as KanbanStatus;
      if (!finalStatus) return prevCards;
      if (finalStatus === 'done' && ac.status !== 'done') {
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        xp.fire(
          vpW * 0.5 + (Math.random() - 0.5) * 120,
          vpH * 0.45 + (Math.random() - 0.5) * 60
        );
      }
      if (ac.status === finalStatus && oc) {
        const ai = prevCards.findIndex((c) => c.id === activeId);
        const oi = prevCards.findIndex((c) => c.id === overId);
        return arrayMove(prevCards, ai, oi);
      }
      return prevCards;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updates = cards.map((card) => ({
        id: card.task_id,
        status: mapKanbanToInstance(card.status),
        notes: card.notes,
      }));
      const updatePromise = taskInstancesService.bulkUpdate(updates);
      let reflectionPromise;
      if (reflection.trim().length >= 10) {
        const reflectionData = {
          date: selectedDate,
          reflection: reflection.trim(),
          mood: mood || undefined,
          owner: ownerId,
        };
        if (reflectionId) {
          reflectionPromise = dailyReflectionsService.update(
            reflectionId,
            reflectionData
          );
        } else {
          reflectionPromise = dailyReflectionsService.create(reflectionData);
        }
      }
      const promises: Promise<unknown>[] = [updatePromise];
      if (reflectionPromise) promises.push(reflectionPromise);
      await Promise.all(promises);
      toast({
        title: t('pages.dailyChecklist.saved'),
        description: t('pages.dailyChecklist.savedDesc'),
      });
      // Invalida (em vez de recarregar direto) para que qualquer outra data
      // já visitada nesta sessão também seja recarregada do servidor da
      // próxima vez que for selecionada, em vez de servir dados em cache
      // desatualizados.
      void queryClient.invalidateQueries({ queryKey: ['daily-checklist', 'data'] });
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyChecklist.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await loadData(true);
      void queryClient.invalidateQueries({ queryKey: ['daily-checklist', 'data'] });
      toast({
        title: t('pages.dailyChecklist.synced'),
        description: t('pages.dailyChecklist.syncedDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyChecklist.syncError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const { data: gamification } = useQuery<{
    total_xp: number;
    current_level: number;
    current_streak: number;
    level_progress_pct: number;
    xp_in_level: number;
    xp_needed_for_next_level: number;
  }>({
    queryKey: ['gamification-profile'],
    queryFn: () => apiClient.get('/api/v1/personal-planning/gamification/'),
    staleTime: 60_000,
  });

  const { notifications } = useNotificationsStore();
  const overdueTaskNotifications = notifications.filter(
    (n) => n.notification_type === 'task_overdue' && !n.is_read
  );

  const completedTasks = cardsByStatus.done.length;

  const dateLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  const viewToggle = (
    <div className="flex items-center rounded-md border p-0.5">
      {(['list', 'kanban'] as ViewMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => changeViewMode(mode)}
          title={t(`pages.todayTasks.${mode}Mode`)}
          className={cn(
            'px-sm py-xs rounded transition-colors',
            viewMode === mode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {mode === 'list' ? (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );

  if (isLoading) return <LoadingState />;

  const GreetIcon = greeting.Icon;
  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  return (
    <Wrapper>
      <XPFloating onMount={xp.register} />
      <SuccessAnimation
        show={showCelebration}
        variant="celebration"
        size="lg"
        onComplete={() => setShowCelebration(false)}
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      />

      {!embedded && (
        <PageHeader title={t('pages.dailyChecklist.title')} icon={<CheckCircle2 />}>
          {viewToggle}
        </PageHeader>
      )}

      <PomodoroBar />

      {/* Saudação + progresso do dia */}
      <div className="gap-lg bg-card px-lg py-md flex items-center rounded-lg border">
        <CircularProgress
          value={dayRate}
          size={64}
          strokeWidth={5}
          color={dayRingColor}
        >
          <span className="text-sm font-bold">{completedTasks}</span>
        </CircularProgress>
        <div className="flex-1">
          <div className="gap-sm flex items-center">
            <GreetIcon className="text-muted-foreground h-5 w-5" />
            <span className="text-lg font-semibold">{greeting.label}</span>
          </div>
          <p className="text-muted-foreground mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            {completedTasks}
            <span className="text-muted-foreground text-base font-normal">
              /{cards.length}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            {t('pages.todayTasks.tasksLabel')}
          </p>
        </div>
      </div>

      {gamification && (
        <div className="gap-md bg-muted/30 px-md py-sm flex items-center rounded-lg border">
          <div className="gap-sm flex items-center">
            <div className="bg-primary/15 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
              {gamification.current_level}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium">
                {t('pages.dailyChecklist.level', { level: gamification.current_level })}
              </p>
              <p className="text-muted-foreground text-xs">
                {gamification.total_xp} XP
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span className="gap-xs flex items-center">
                <Zap className="text-warning h-3 w-3" />
                {gamification.xp_in_level}/{gamification.xp_needed_for_next_level} XP
              </span>
              <span>{gamification.level_progress_pct}%</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{ width: `${Math.min(gamification.level_progress_pct, 100)}%` }}
              />
            </div>
          </div>
          {gamification.current_streak > 0 && (
            <div className="gap-xs px-sm py-xs flex items-center rounded-full bg-orange-500/10">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-sm font-bold text-orange-500">
                {gamification.current_streak}
              </span>
            </div>
          )}
        </div>
      )}

      {overdueTaskNotifications.length > 0 && (
        <div className="gap-sm border-destructive/30 bg-destructive/10 px-md py-sm text-destructive flex items-center rounded-lg border text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {t('pages.dailyChecklist.overdueBanner', {
              count: overdueTaskNotifications.length,
            })}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="gap-md flex flex-wrap items-center">
        {embedded && viewToggle}
        <div className="gap-sm flex items-end">
          <div>
            <Label htmlFor="date">{t('common.fields.date')}</Label>
            <DatePicker
              value={selectedDate ? parseLocalDate(selectedDate) : undefined}
              onChange={(date) => setSelectedDate(date ? formatLocalDate(date) : '')}
              placeholder={t('pages.dailyChecklist.datePlaceholder')}
              className="max-w-xs"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            aria-label={t('pages.dailyChecklist.syncBtn')}
          >
            <RefreshCw
              className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </Button>
          <Dialog open={isReflectionOpen} onOpenChange={setIsReflectionOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative"
                aria-label={t('pages.dailyChecklist.addReflection')}
              >
                <StickyNote className="h-4 w-4" aria-hidden="true" />
                {(reflection.trim() || mood) && (
                  <span className="bg-primary absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>{t('pages.dailyChecklist.reflectionTitle')}</DialogTitle>
                <DialogDescription>
                  {t('pages.dailyChecklist.reflectionPlaceholder')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-md py-md">
                <div>
                  <Label htmlFor="mood">{t('pages.dailyChecklist.moodQuestion')}</Label>
                  <Select value={mood} onValueChange={setMood}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('pages.dailyChecklist.moodPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {MOOD_CHOICES.map((choice) => (
                        <SelectItem key={choice.value} value={choice.value}>
                          {choice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reflection">
                    {t('pages.dailyChecklist.reflectionLabel')}
                  </Label>
                  <Textarea
                    id="reflection"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder={t('pages.dailyChecklist.reflectionTextPlaceholder')}
                    rows={6}
                  />
                  {reflection.length > 0 && reflection.length < 10 && (
                    <p className="mt-xs text-destructive text-sm">
                      {t('pages.dailyChecklist.reflectionMinLength')}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-sm flex-col sm:flex-row sm:items-center sm:justify-between">
                <Link
                  to="/planning/reflections"
                  className="gap-xs text-muted-foreground hover:text-primary flex items-center text-xs transition-colors"
                  onClick={() => setIsReflectionOpen(false)}
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('pages.dailyChecklist.viewAllReflections')}
                </Link>
                <div className="gap-sm flex">
                  <Button variant="outline" onClick={() => setIsReflectionOpen(false)}>
                    {t('common.actions.close')}
                  </Button>
                  <Button
                    onClick={() => {
                      void handleSave().then(() => setIsReflectionOpen(false));
                    }}
                    disabled={
                      isSaving ||
                      (reflection.trim().length > 0 && reflection.trim().length < 10)
                    }
                  >
                    {t('common.actions.save')}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex-1" />
        <div className="text-lg font-semibold">
          {completedTasks}{' '}
          {t('pages.dailyChecklist.itemsCompleted', { total: cards.length })}
          {summary.completion_rate > 0 && (
            <span className="ml-sm text-sm">
              ({summary.completion_rate.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>

      {/* Blocos de Foco */}
      {selectedDate && (
        <FocusBlocksSection
          date={selectedDate}
          instances={instances}
          onToggleTaskComplete={(task) => void handleToggleTaskComplete(task)}
          onBlockedTaskIdsChange={setBlockedTaskIds}
        />
      )}

      {/* Vista Lista */}
      {viewMode === 'list' && (
        <>
          {looseInstances.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="text-muted-foreground h-12 w-12" />}
              title={t('pages.dailyChecklist.noTasks')}
              message={t('pages.dailyChecklist.noTasksDesc')}
            />
          ) : (
            <div className="space-y-sm">
              {looseInstances.map((task) => {
                const isCompleted = task.status === 'completed';
                const isUpdating = updatingTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'gap-md p-md flex items-center rounded-lg border transition-opacity',
                      isCompleted && 'opacity-60'
                    )}
                  >
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => void handleToggleTaskComplete(task)}
                      className="text-muted-foreground hover:text-primary shrink-0 transition-colors disabled:opacity-50"
                      title={
                        isCompleted
                          ? t('pages.todayTasks.markPending')
                          : t('pages.todayTasks.markCompleted')
                      }
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="text-success h-6 w-6" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </button>
                    <div className="flex-1">
                      <h3
                        className={cn('font-semibold', isCompleted && 'line-through')}
                      >
                        {task.task_name}
                      </h3>
                      {task.time_display && (
                        <p className="text-muted-foreground text-sm">
                          {t('pages.todayTasks.timeLabel', { time: task.time_display })}
                        </p>
                      )}
                    </div>
                    {task.category && (
                      <TaskCategoryBadge
                        icon={task.icon}
                        label={translate('taskCategories', task.category)}
                        category={task.category}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Vista Kanban */}
      {viewMode === 'kanban' && (
        <>
          {instances.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="text-muted-foreground h-12 w-12" />}
              title={t('pages.dailyChecklist.noTasks')}
              message={t('pages.dailyChecklist.noTasksDesc')}
            />
          ) : looseInstances.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              measuring={measuringConfig}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="gap-md md:gap-lg grid grid-cols-1 md:grid-cols-3">
                <KanbanColumn
                  status="todo"
                  title={t('pages.dailyChecklist.todo')}
                  cards={looseCardsByStatus.todo}
                />
                <KanbanColumn
                  status="doing"
                  title={t('pages.dailyChecklist.inProgress')}
                  cards={looseCardsByStatus.doing}
                />
                <KanbanColumn
                  status="done"
                  title={t('pages.dailyChecklist.done')}
                  cards={looseCardsByStatus.done}
                />
              </div>
              <DragOverlay>
                {activeCard ? <KanbanCard card={activeCard} /> : null}
              </DragOverlay>
            </DndContext>
          ) : null}

          {cards.length > 0 &&
            cardsByStatus.todo.length === 0 &&
            cardsByStatus.doing.length === 0 &&
            cardsByStatus.done.length === cards.length &&
            !reflection.trim() && (
              <div className="gap-md border-success/30 bg-success/5 px-md py-md flex items-center rounded-lg border">
                <CheckCircle2 className="text-success h-6 w-6 shrink-0" />
                <div className="flex-1">
                  <p className="text-foreground text-sm font-medium">
                    {t('pages.dailyChecklist.reflectionPrompt')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsReflectionOpen(true)}
                >
                  <StickyNote className="mr-xs h-3.5 w-3.5" />
                  {t('pages.dailyChecklist.addReflection')}
                </Button>
              </div>
            )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              {isSaving ? (
                <>
                  <Save className="mr-sm h-4 w-4 animate-pulse" />
                  {t('common.actions.saving')}
                </>
              ) : (
                <>
                  <Save className="mr-sm h-4 w-4" />
                  {t('common.actions.save')}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </Wrapper>
  );
}
