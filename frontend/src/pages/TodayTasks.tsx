import { CheckCircle2, Moon, Sun, Sunset } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { TodayKanbanView } from '@/components/today-tasks/TodayKanbanView';
import { TodayListView } from '@/components/today-tasks/TodayListView';
import { CircularProgress } from '@/components/ui/circular-progress';
import { useTodayTasks } from '@/hooks/use-today-tasks';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'kanban';
const VIEW_MODE_KEY = 'todayTasks.viewMode';

interface TodayTasksProps {
  embedded?: boolean;
}

function EmbeddedWrapper({ children }: { children: ReactNode }) {
  return <div className="space-y-lg">{children}</div>;
}

export default function TodayTasks({ embedded = false }: TodayTasksProps) {
  const { t, i18n } = useTranslation();

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

  if (isLoading) return <LoadingState />;

  const Wrapper = embedded ? EmbeddedWrapper : PageContainer;

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
            'rounded px-sm py-xs transition-colors',
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
      <PageHeader title={t('pages.todayTasks.title')} icon={<CheckCircle2 />}>
        {viewToggle}
      </PageHeader>

      <div className="flex items-center gap-lg rounded-lg border bg-card px-lg py-md">
        <CircularProgress
          value={dayRate}
          size={72}
          strokeWidth={6}
          color={dayRingColor}
        >
          <span className="text-sm font-bold">{doneCount}</span>
        </CircularProgress>
        <div className="flex-1">
          <div className="flex items-center gap-sm">
            <GreetIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-semibold">{greeting.label}</span>
          </div>
          <p className="mt-0.5 capitalize text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            {doneCount}
            <span className="text-base font-normal text-muted-foreground">
              /{todayTasksCount}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
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
