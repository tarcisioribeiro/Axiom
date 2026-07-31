/* eslint-disable max-lines */
import {
  CheckCircle2,
  Moon,
  Sun,
  Sunset,
  Timer,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { TodayKanbanView } from '@/components/today-tasks/TodayKanbanView';
import { TodayListView } from '@/components/today-tasks/TodayListView';
import { Button } from '@/components/ui/button';
import { CircularProgress } from '@/components/ui/circular-progress';
import { SuccessAnimation } from '@/components/ui/success-animation';
import { useToast } from '@/hooks/use-toast';
import { useTodayTasks } from '@/hooks/use-today-tasks';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'kanban';
const VIEW_MODE_KEY = 'todayTasks.viewMode';
const POMODORO_CYCLES_KEY = 'todayTasks.pomodoroCycles';

type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

function PomodoroTimer() {
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
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleComplete = useCallback(() => {
    setRunning(false);
    if (mode === 'focus') {
      const newCycles = cycles + 1;
      setCycles(newCycles);
      localStorage.setItem(POMODORO_CYCLES_KEY, String(newCycles));
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

  const switchMode = (newMode: PomodoroMode) => {
    setRunning(false);
    setMode(newMode);
    setSecondsLeft(POMODORO_DURATIONS[newMode]);
  };

  const reset = () => {
    setRunning(false);
    setSecondsLeft(POMODORO_DURATIONS[mode]);
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
          onClick={reset}
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

interface TodayTasksProps {
  embedded?: boolean;
}

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function TodayTasks({ embedded = false }: TodayTasksProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  const prevDayRateRef = useRef<number>(0);

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'kanban'
  );

  const {
    isLoading,
    selectedDate,
    setSelectedDate,
    todayTasks,
    updatingTaskId,
    cards,
    setCards,
    reflection,
    setReflection,
    mood,
    setMood,
    summary,
    isSaving,
    isSyncing,
    handleToggleTaskComplete,
    handleKanbanSave,
    handleSync,
    loadListData,
  } = useTodayTasks(viewMode);

  const hour = new Date().getHours();
  const greeting = useMemo(() => {
    if (hour < 12) return { label: t('pages.todayTasks.greetingMorning'), Icon: Sun };
    if (hour < 18)
      return { label: t('pages.todayTasks.greetingAfternoon'), Icon: Sunset };
    return { label: t('pages.todayTasks.greetingEvening'), Icon: Moon };
  }, [hour, t]);

  const todayTasksCount = viewMode === 'kanban' ? cards.length : todayTasks.length;
  const doneCount =
    viewMode === 'kanban'
      ? cards.filter((c) => c.status === 'done').length
      : todayTasks.filter((item) => item.status === 'completed').length;
  const dayRate = todayTasksCount > 0 ? (doneCount / todayTasksCount) * 100 : 0;
  const dayRingColor =
    dayRate >= 80
      ? 'hsl(var(--chart-2))'
      : dayRate >= 40
        ? 'hsl(var(--warning))'
        : 'hsl(var(--primary))';

  useEffect(() => {
    if (todayTasksCount > 0 && dayRate === 100 && prevDayRateRef.current < 100) {
      const timer = setTimeout(() => {
        setShowCelebration(true);
        toast({ title: t('pages.todayTasks.allDoneTitle') });
      }, 0);
      prevDayRateRef.current = dayRate;
      return () => clearTimeout(timer);
    }
    prevDayRateRef.current = dayRate;
  }, [dayRate, todayTasksCount, toast, t]);

  if (isLoading) return <LoadingState />;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

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

  const GreetIcon = greeting.Icon;

  return (
    <Wrapper>
      <SuccessAnimation
        show={showCelebration}
        variant="celebration"
        size="lg"
        onComplete={() => setShowCelebration(false)}
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      />
      <PageHeader title={t('pages.todayTasks.title')} icon={<CheckCircle2 />}>
        {viewToggle}
      </PageHeader>

      <PomodoroTimer />

      <div className="gap-lg bg-card px-lg py-md flex items-center rounded-lg border">
        <CircularProgress
          value={dayRate}
          size={72}
          strokeWidth={6}
          color={dayRingColor}
        >
          <span className="text-sm font-bold">{doneCount}</span>
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
            {doneCount}
            <span className="text-muted-foreground text-base font-normal">
              /{todayTasksCount}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            {t('pages.todayTasks.tasksLabel')}
          </p>
        </div>
      </div>

      {viewMode === 'list' && (
        <TodayListView
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          tasks={todayTasks}
          updatingTaskId={updatingTaskId}
          isLoading={isLoading}
          onToggleComplete={handleToggleTaskComplete}
          onSync={() => void loadListData(true)}
        />
      )}

      {viewMode === 'kanban' && (
        <TodayKanbanView
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          cards={cards}
          onCardsChange={setCards}
          reflection={reflection}
          onReflectionChange={setReflection}
          mood={mood}
          onMoodChange={setMood}
          summary={summary}
          isSyncing={isSyncing}
          isSaving={isSaving}
          onSync={() => void handleSync()}
          onSave={() => void handleKanbanSave()}
        />
      )}
    </Wrapper>
  );
}
