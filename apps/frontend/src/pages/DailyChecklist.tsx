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
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  RefreshCw,
  AlertCircle,
  Flame,
  LayoutList,
  Tag,
  Zap,
  Moon,
  Sun,
  Sunset,
  Target,
  Coffee,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { DailyFocusBlocks } from '@/components/personal-planning/DailyFocusBlocks';
import { KanbanCard } from '@/components/personal-planning/KanbanCard';
import { KanbanColumn } from '@/components/personal-planning/KanbanColumn';
import { XPFloating, useXPTrigger } from '@/components/personal-planning/XPFloating';
import { TaskCategoryBadge } from '@/components/today-tasks/TaskCategoryBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CircularProgress } from '@/components/ui/circular-progress';
import { DatePicker } from '@/components/ui/date-picker';
import { PlainButton } from '@/components/ui/plain-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SuccessAnimation } from '@/components/ui/success-animation';
import { Tooltip } from '@/components/ui/tooltip';
import { translate } from '@/config/constants';
import { DAILY_CHECKLIST_STATUS_ICONS, TASK_CATEGORY_ICONS } from '@/config/icons';
import { useTaskReminders } from '@/hooks/use-task-reminders';
import { useToast } from '@/hooks/use-toast';
import { cn, formatLocalDate, parseLocalDate } from '@/lib/utils';
import { apiClient } from '@/services/api-client';
import { appService } from '@/services/app-service';
import { membersService } from '@/services/members-service';
import { taskInstancesService } from '@/services/task-instances-service';
import { useNotificationsStore } from '@/stores/notifications-store';
import {
  TASK_CATEGORIES,
  type TaskInstance,
  type TaskCard,
  type KanbanStatus,
  type InstanceStatus,
  type InstancesForDateResponse,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type ViewMode = 'list' | 'kanban' | 'focusBlocks';
const EMPTY_INSTANCES: TaskInstance[] = [];
const VIEW_MODE_KEY = 'dailyChecklist.viewMode';
const POMODORO_CYCLES_KEY = 'dailyChecklist.pomodoroCycles';
const LIST_PAGE_SIZE = 5;

type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';
const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};
const POMODORO_MODE_ICONS: Record<PomodoroMode, typeof Target> = {
  focus: Target,
  shortBreak: Coffee,
  longBreak: Moon,
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
    <div className="gap-md bg-card px-lg py-md flex flex-wrap items-center rounded-lg border">
      <div className="gap-xs flex items-center rounded-md border p-0.5">
        {(['focus', 'shortBreak', 'longBreak'] as PomodoroMode[]).map((m) => {
          const ModeIcon = POMODORO_MODE_ICONS[m];
          return (
            <Tooltip key={m} content={t(`pages.todayTasks.pomodoroMode.${m}`)}>
              <button
                type="button"
                onClick={() => switchMode(m)}
                aria-label={t(`pages.todayTasks.pomodoroMode.${m}`)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded transition-colors',
                  mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ModeIcon className="h-4 w-4" />
              </button>
            </Tooltip>
          );
        })}
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
  /** Quando informado, o cabeçalho é renderizado nesse elemento (acima das abas do pai). */
  headerTarget?: HTMLElement | null;
}

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function DailyChecklist({
  embedded = false,
  headerTarget,
}: DailyChecklistProps) {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatLocalDate(new Date())
  );
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [activeCard, setActiveCard] = useState<TaskCard | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ownerId, setOwnerId] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'kanban'
  );
  const [showCelebration, setShowCelebration] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const prevDayRateRef = useRef<number>(0);
  const xp = useXPTrigger();
  useTaskReminders(cards);
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
      is_optional: instance.is_optional,
    }));

  const cardsByStatus = useMemo(
    () => ({
      todo: cards.filter((c) => c.status === 'todo'),
      doing: cards.filter((c) => c.status === 'doing'),
      done: cards.filter((c) => c.status === 'done'),
    }),
    [cards]
  );

  // Tarefas opcionais não contam para a conclusão do dia nem para o streak.
  const requiredCards = useMemo(() => cards.filter((c) => !c.is_optional), [cards]);
  const requiredDone = useMemo(
    () => requiredCards.filter((c) => c.status === 'done').length,
    [requiredCards]
  );
  const dayRate =
    requiredCards.length > 0 ? (requiredDone / requiredCards.length) * 100 : 0;
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

  const { data: instancesResponse, isLoading } = useQuery({
    queryKey: ['daily-checklist', 'data', selectedDate, ownerId],
    queryFn: () => taskInstancesService.getForDate(selectedDate),
    enabled: ownerId > 0 && !!selectedDate,
  });
  const instances = instancesResponse?.instances ?? EMPTY_INSTANCES;

  // Deriva os cards a partir de `instances` durante o render (sem efeito),
  // permitindo que `setCards` continue editável localmente (drag-and-drop).
  const [lastInstances, setLastInstances] = useState(instances);
  if (instances !== lastInstances) {
    setLastInstances(instances);
    setCards(instances.length > 0 ? convertInstancesToCards(instances) : []);
  }

  useEffect(() => {
    if (requiredCards.length > 0 && dayRate === 100 && prevDayRateRef.current < 100) {
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
  }, [dayRate, requiredCards.length, toast, t]);

  const loadCurrentUserMember = async () => {
    try {
      const member = await membersService.getCurrentUserMember();
      setOwnerId(member.id);
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyChecklist.loadUserError', {
          reason: getErrorMessage(error),
        }),
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

  const setInstancesCache = useCallback(
    (updater: (prev: TaskInstance[]) => TaskInstance[]) => {
      queryClient.setQueryData<InstancesForDateResponse>(
        ['daily-checklist', 'data', selectedDate, ownerId],
        (prev) => (prev ? { ...prev, instances: updater(prev.instances) } : prev)
      );
    },
    [queryClient, selectedDate, ownerId]
  );

  const handleToggleTaskComplete = useCallback(
    async (task: TaskInstance) => {
      const newStatus: InstanceStatus =
        task.status === 'completed' ? 'pending' : 'completed';
      setUpdatingTaskId(task.id);
      setInstancesCache((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      );
      try {
        const result = await taskInstancesService.bulkUpdate([
          { id: task.id, status: newStatus },
        ]);
        // Ex.: tarefa vinculada ao treino não pode ser concluída manualmente
        if (result.errors.length > 0) throw new Error(result.errors[0].error);
      } catch (error: unknown) {
        setInstancesCache((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        );
        toast({
          title: t('pages.dailyChecklist.saveError', {
            reason: getErrorMessage(error),
          }),
          variant: 'destructive',
        });
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [toast, t, setInstancesCache]
  );

  // Status do card no início do arraste: o handleDragOver já move o card de
  // coluna durante o arraste, então só ele diz se o status mudou de fato.
  const dragOriginRef = useRef<KanbanStatus | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id) || null;
    setActiveCard(card);
    dragOriginRef.current = card?.status ?? null;
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

  const setCardStatus = (cardId: string, status: KanbanStatus) =>
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status } : c)));

  // Salva só o status do card movido; enquanto salva, o quadro fica travado.
  const saveCardStatus = async (
    card: TaskCard,
    origin: KanbanStatus,
    status: KanbanStatus
  ) => {
    setIsSaving(true);
    try {
      const { errors } = await taskInstancesService.bulkUpdate([
        { id: card.task_id, status: mapKanbanToInstance(status) },
      ]);
      // Ex.: tarefa vinculada ao treino não pode ser concluída manualmente
      if (errors.length > 0) throw new Error(errors[0].error);
      // Invalida para que outras datas já visitadas nesta sessão também sejam
      // recarregadas do servidor em vez de servir cache desatualizado.
      void queryClient.invalidateQueries({ queryKey: ['daily-checklist', 'data'] });
    } catch (error: unknown) {
      setCardStatus(card.id, origin);
      toast({
        title: t('pages.dailyChecklist.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    const activeId = active.id as string;
    const card = cards.find((c) => c.id === activeId);
    if (!card || !origin) return;
    const overId = over?.id as string | undefined;
    const overCard = cards.find((c) => c.id === overId);
    const finalStatus =
      overCard?.status ??
      (overId && ['todo', 'doing', 'done'].includes(overId)
        ? (overId as KanbanStatus)
        : undefined);
    // Solto fora do quadro: desfaz a mudança de coluna feita no dragOver.
    if (!finalStatus) {
      setCardStatus(activeId, origin);
      return;
    }
    setCards((prev) => {
      const next = prev.map((c) =>
        c.id === activeId ? { ...c, status: finalStatus } : c
      );
      if (!overCard || overCard.id === activeId) return next;
      return arrayMove(
        next,
        next.findIndex((c) => c.id === activeId),
        next.findIndex((c) => c.id === overCard.id)
      );
    });
    if (finalStatus === origin) return;
    if (finalStatus === 'done') {
      xp.fire(
        window.innerWidth * 0.5 + (Math.random() - 0.5) * 120,
        window.innerHeight * 0.45 + (Math.random() - 0.5) * 60
      );
    }
    void saveCardStatus(card, origin, finalStatus);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const synced = await taskInstancesService.getForDate(selectedDate, true);
      queryClient.setQueryData(
        ['daily-checklist', 'data', selectedDate, ownerId],
        synced
      );
      void queryClient.invalidateQueries({ queryKey: ['daily-checklist', 'data'] });
      toast({
        title: t('pages.dailyChecklist.syncedDesc'),
      });
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyChecklist.syncError', { reason: getErrorMessage(error) }),
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

  const filteredInstances = instances.filter((instance) => {
    if (categoryFilter !== 'all' && instance.category !== categoryFilter) return false;
    if (statusFilter !== 'all') {
      const isCompleted = instance.status === 'completed';
      if (statusFilter === 'completed' ? !isCompleted : isCompleted) return false;
    }
    return true;
  });

  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const viewToggle = (
    <div className="flex items-center rounded-md border p-0.5">
      {(['list', 'kanban', 'focusBlocks'] as ViewMode[]).map((mode) => (
        <PlainButton
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
          ) : mode === 'kanban' ? (
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
          ) : (
            <LayoutList className="h-4 w-4" />
          )}
        </PlainButton>
      ))}
    </div>
  );

  // Limita a altura das colunas do kanban ao espaço que sobra na viewport,
  // para a página não ganhar scroll. Mede o topo do quadro com offsetTop (e
  // não getBoundingClientRect) para ignorar o transform da animação de
  // entrada da página.
  const boardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const board = boardRef.current;
      if (!board) return;
      let top = 0;
      let el: Element | null = board;
      while (el instanceof HTMLElement) {
        top += el.offsetTop;
        el = el.offsetParent;
      }
      board.style.setProperty(
        '--kanban-max-h',
        `calc(100vh - ${top}px - var(--spacing-xl))`
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isLoading, viewMode, instances.length]);

  if (isLoading) return <LoadingState />;

  const GreetIcon = greeting.Icon;
  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;
  const toolbar = (
    <div className="gap-md flex flex-wrap items-center">
      <PomodoroBar />

      {/* Saudação + progresso do dia */}
      <div className="gap-md bg-card px-lg py-md flex items-center rounded-lg border">
        <CircularProgress
          value={dayRate}
          size={64}
          strokeWidth={5}
          color={dayRingColor}
        >
          <span className="text-sm font-bold">{completedTasks}</span>
        </CircularProgress>
        <div className="gap-sm flex items-center">
          <GreetIcon className="text-muted-foreground h-5 w-5" />
          <span className="text-lg font-semibold">{greeting.label}</span>
        </div>
        <p className="text-2xl font-bold">
          {completedTasks}
          <span className="text-muted-foreground text-base font-normal">
            /{cards.length}
          </span>
        </p>
      </div>

      {gamification && (
        <div className="gap-md bg-muted/30 px-md py-sm flex items-center rounded-lg border">
          <div className="gap-sm flex items-center">
            <div className="bg-primary/15 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
              {gamification.current_level}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium">
                {t('pages.dailyChecklist.level', {
                  level: gamification.current_level,
                })}
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
                style={{
                  width: `${Math.min(gamification.level_progress_pct, 100)}%`,
                }}
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

      <div className="gap-sm flex items-center">
        <div role="group" aria-label={t('common.fields.date')}>
          <DatePicker
            value={selectedDate ? parseLocalDate(selectedDate) : undefined}
            onChange={(date) => {
              setSelectedDate(date ? formatLocalDate(date) : '');
            }}
            placeholder={t('pages.dailyChecklist.datePlaceholder')}
            maxDate={new Date()}
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
      </div>
    </div>
  );

  const header = (
    <PageHeader
      title={t('pages.dailyChecklist.title')}
      icon={<CheckCircle2 />}
      childrenClassName="flex flex-1 items-center"
    >
      <div className="flex-1" />
      {toolbar}
      <div className="flex flex-1 justify-end">{viewToggle}</div>
    </PageHeader>
  );

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

      {headerTarget ? createPortal(header, headerTarget) : header}

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

      {/* Troca de modo: só animação de entrada (sem esperar a saída), para o
          quadro/lista novo já estar montado quando os layout effects medem. */}
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-lg"
      >
        {/* Vista Bloco de Foco */}
        {viewMode === 'focusBlocks' && selectedDate && (
          <DailyFocusBlocks
            date={selectedDate}
            ownerId={ownerId}
            instances={instances}
            onToggleTaskComplete={(task) => void handleToggleTaskComplete(task)}
          />
        )}

        {/* Vista Lista */}
        {viewMode === 'list' && (
          <>
            {instances.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="text-muted-foreground h-12 w-12" />}
                title={t('pages.dailyChecklist.noTasks')}
              />
            ) : (
              <>
                <FilterBar
                  hasActiveFilters={hasActiveFilters}
                  onClear={clearFilters}
                  activeFilters={[
                    ...(categoryFilter !== 'all'
                      ? [
                          {
                            key: 'category',
                            label: `${t('pages.dailyChecklist.allCategories')}: ${translate('taskCategories', categoryFilter)}`,
                            onRemove: () => setCategoryFilter('all'),
                          },
                        ]
                      : []),
                    ...(statusFilter !== 'all'
                      ? [
                          {
                            key: 'status',
                            label: `${t('common.fields.status')}: ${
                              statusFilter === 'completed'
                                ? t('pages.dailyChecklist.done')
                                : t('common.status.pending')
                            }`,
                            onRemove: () => setStatusFilter('all'),
                          },
                        ]
                      : []),
                  ]}
                >
                  <FilterField label={t('common.fields.category')}>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger
                        className="w-44"
                        aria-label={t('pages.dailyChecklist.allCategories')}
                        startIcon={<Tag className="h-3.5 w-3.5" />}
                      >
                        <SelectValue
                          placeholder={t('pages.dailyChecklist.allCategories')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('pages.dailyChecklist.allCategories')}
                        </SelectItem>
                        {TASK_CATEGORIES.map(({ value }) => {
                          const CatIcon = TASK_CATEGORY_ICONS[value];
                          return (
                            <SelectItem
                              key={value}
                              value={value}
                              icon={
                                CatIcon ? <CatIcon className="h-4 w-4" /> : undefined
                              }
                            >
                              {translate('taskCategories', value)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </FilterField>
                  <FilterField label={t('common.fields.status')}>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger
                        className="w-36"
                        aria-label={t('pages.dailyChecklist.allStatus')}
                        startIcon={<CircleDot className="h-3.5 w-3.5" />}
                      >
                        <SelectValue
                          placeholder={t('pages.dailyChecklist.allStatus')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('pages.dailyChecklist.allStatus')}
                        </SelectItem>
                        <SelectItem
                          value="completed"
                          icon={
                            <DAILY_CHECKLIST_STATUS_ICONS.completed className="h-4 w-4" />
                          }
                        >
                          {t('pages.dailyChecklist.done')}
                        </SelectItem>
                        <SelectItem
                          value="pending"
                          icon={
                            <DAILY_CHECKLIST_STATUS_ICONS.pending className="h-4 w-4" />
                          }
                        >
                          {t('common.status.pending')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterField>
                </FilterBar>

                {filteredInstances.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 className="text-muted-foreground h-12 w-12" />}
                    title={t('pages.dailyChecklist.noTasks')}
                  />
                ) : (
                  <PaginatedSlide
                    key={selectedDate}
                    items={filteredInstances}
                    pageSize={LIST_PAGE_SIZE}
                    centerList
                    className="space-y-sm"
                  >
                    {(pageTasks) =>
                      pageTasks.map((task) => {
                        const isCompleted = task.status === 'completed';
                        const isUpdating = updatingTaskId === task.id;
                        return (
                          <div
                            key={task.id}
                            className="gap-md p-md bg-card flex items-center rounded-lg border"
                          >
                            <PlainButton
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
                            </PlainButton>
                            <div className="flex-1">
                              <h3
                                className={cn(
                                  'gap-sm flex items-center font-semibold',
                                  isCompleted && 'line-through'
                                )}
                              >
                                {task.task_name}
                                {task.is_optional && (
                                  <Badge variant="outline" className="text-xs">
                                    {t('pages.dailyChecklist.optionalBadge')}
                                  </Badge>
                                )}
                              </h3>
                              {task.time_display && (
                                <p className="text-muted-foreground text-sm">
                                  {t('pages.todayTasks.timeLabel', {
                                    time: task.time_display,
                                  })}
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
                      })
                    }
                  </PaginatedSlide>
                )}
              </>
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
              />
            ) : (
              <DndContext
                sensors={isSaving ? [] : sensors}
                collisionDetection={rectIntersection}
                measuring={measuringConfig}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                {/* mb-0: o DndContext injeta nós ocultos de acessibilidade depois
                  do quadro, então ele não é o último filho e receberia a
                  margem inferior do space-y do wrapper. */}
                <div
                  ref={boardRef}
                  aria-busy={isSaving}
                  className={cn(
                    'gap-md md:gap-lg mb-0 grid grid-cols-1 md:grid-cols-3',
                    isSaving && 'pointer-events-none'
                  )}
                >
                  <KanbanColumn
                    status="todo"
                    title={t('pages.dailyChecklist.todo')}
                    cards={cardsByStatus.todo}
                  />
                  <KanbanColumn
                    status="doing"
                    title={t('pages.dailyChecklist.inProgress')}
                    cards={cardsByStatus.doing}
                  />
                  <KanbanColumn
                    status="done"
                    title={t('pages.dailyChecklist.done')}
                    cards={cardsByStatus.done}
                  />
                </div>
                <DragOverlay>
                  {activeCard ? <KanbanCard card={activeCard} /> : null}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}
      </motion.div>
    </Wrapper>
  );
}
