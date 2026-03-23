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
import {
  Save,
  CheckCircle2,
  StickyNote,
  RefreshCw,
  List,
  LayoutGrid,
  Circle,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { KanbanCard } from '@/components/personal-planning/KanbanCard';
import { KanbanColumn } from '@/components/personal-planning/KanbanColumn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { getIconByName } from '@/components/ui/icon-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn, formatLocalDate, parseLocalDate } from '@/lib/utils';
import { appService } from '@/services/app-service';
import { dailyReflectionsService } from '@/services/daily-reflections-service';
import { membersService } from '@/services/members-service';
import { taskInstancesService } from '@/services/task-instances-service';
import {
  MOOD_CHOICES,
  type TaskInstance,
  type TaskCard,
  type KanbanStatus,
  type InstanceStatus,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type ViewMode = 'list' | 'kanban';

const VIEW_MODE_KEY = 'todayTasks.viewMode';

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

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return { variant: 'success' as const, label: 'Concluída' };
    case 'in_progress':
      return { variant: 'warning' as const, label: 'Em andamento' };
    case 'skipped':
      return { variant: 'secondary' as const, label: 'Pulada' };
    default:
      return { variant: 'info' as const, label: 'Pendente' };
  }
};

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    health: 'bg-category-health text-white dark:text-black border-transparent',
    intellect: 'bg-category-studies text-white dark:text-black border-transparent',
    studies: 'bg-category-studies text-white dark:text-black border-transparent',
    spiritual: 'bg-category-spiritual text-white dark:text-black border-transparent',
    exercise: 'bg-category-exercise text-white dark:text-black border-transparent',
    nutrition: 'bg-category-nutrition text-white dark:text-black border-transparent',
    meditation: 'bg-category-spiritual text-white dark:text-black border-transparent',
    reading: 'bg-category-studies text-white dark:text-black border-transparent',
    writing: 'bg-category-work text-white dark:text-black border-transparent',
    work: 'bg-category-work text-white dark:text-black border-transparent',
    leisure: 'bg-category-leisure text-white dark:text-black border-transparent',
    family: 'bg-accent text-accent-foreground border-transparent',
    social: 'bg-category-leisure text-white dark:text-black border-transparent',
    finance: 'bg-category-finance text-white dark:text-black border-transparent',
    household: 'bg-category-nutrition text-white dark:text-black border-transparent',
    personal_care: 'bg-category-health text-white dark:text-black border-transparent',
  };
  return colors[category] ?? 'bg-muted text-muted-foreground border-transparent';
};

function TaskCategoryBadge({
  icon,
  label,
  category,
}: {
  icon?: string | null;
  label: string;
  category: string;
}) {
  const Icon = getIconByName(icon);
  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${getCategoryColor(category)}`}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- Icon is a stable Lucide reference, not a dynamic component */}
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{label}</span>
    </div>
  );
}

export default function TodayTasks() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'kanban';
  });

  // Shared
  const [isLoading, setIsLoading] = useState(true);
  const [ownerId, setOwnerId] = useState(0);

  // List mode state
  const [todayTasks, setTodayTasks] = useState<TaskInstance[]>([]);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  // Kanban mode state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [activeCard, setActiveCard] = useState<TaskCard | null>(null);
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState<string>('');
  const [reflectionId, setReflectionId] = useState<number | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReflectionOpen, setIsReflectionOpen] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    completion_rate: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const measuringConfig = { droppable: { strategy: MeasuringStrategy.Always } };

  const convertInstancesToCards = (instances: TaskInstance[]): TaskCard[] =>
    instances.map((instance) => ({
      id: `instance-${instance.id}`,
      task_id: instance.id,
      task_name: instance.task_name,
      description: instance.task_description || undefined,
      category: instance.category,
      category_display: instance.category_display,
      icon: instance.icon || undefined,
      unit: instance.unit,
      index: instance.occurrence_index,
      total_instances: instances.filter((i) => i.template === instance.template).length,
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

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const serverDate = await appService.getCurrentDate();
        setSelectedDate(serverDate);
      } catch {
        setSelectedDate(formatLocalDate(new Date()));
      }
    };
    void loadCurrentUserMember();
    void init();
  }, []);

  useEffect(() => {
    if (ownerId > 0 && selectedDate) {
      if (viewMode === 'list') {
        void loadListData();
      } else {
        void loadKanbanData();
      }
    }
  }, [selectedDate, ownerId, viewMode]);

  useEffect(() => {
    if (instances.length > 0) {
      setCards(convertInstancesToCards(instances));
    } else {
      setCards([]);
    }
  }, [instances]);

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

  const loadListData = async () => {
    try {
      setIsLoading(true);
      const today = await appService
        .getCurrentDate()
        .catch(() => formatLocalDate(new Date()));
      const response = await taskInstancesService.getForDate(today);
      setTodayTasks(response.instances);
    } catch (error: unknown) {
      toast({
        title: t('pages.todayTasks.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadKanbanData = async (sync = false) => {
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

  const handleToggleTaskComplete = async (task: TaskInstance) => {
    const newStatus: InstanceStatus =
      task.status === 'completed' ? 'pending' : 'completed';
    setUpdatingTaskId(task.id);
    try {
      await taskInstancesService.bulkUpdate([
        { id: task.id, status: newStatus, notes: task.notes ?? undefined },
      ]);
      setTodayTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: newStatus,
                status_display: newStatus === 'completed' ? 'Concluída' : 'Pendente',
              }
            : t
        )
      );
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Kanban drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    setCards((prev) => {
      const activeCard = prev.find((c) => c.id === activeId);
      const overCard = prev.find((c) => c.id === overId);
      if (!activeCard) return prev;
      let targetStatus: KanbanStatus | undefined;
      if (overCard) targetStatus = overCard.status;
      else if (['todo', 'doing', 'done'].includes(overId))
        targetStatus = overId as KanbanStatus;
      if (!targetStatus || activeCard.status === targetStatus) return prev;
      return prev.map((c) => (c.id === activeId ? { ...c, status: targetStatus } : c));
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    setCards((prev) => {
      const activeCard = prev.find((c) => c.id === activeId);
      const overCard = prev.find((c) => c.id === overId);
      if (!activeCard) return prev;
      let finalStatus: KanbanStatus | undefined;
      if (overCard) finalStatus = overCard.status;
      else if (['todo', 'doing', 'done'].includes(overId))
        finalStatus = overId as KanbanStatus;
      if (!finalStatus) return prev;
      if (activeCard.status === finalStatus && overCard) {
        const activeIndex = prev.findIndex((c) => c.id === activeId);
        const overIndex = prev.findIndex((c) => c.id === overId);
        return arrayMove(prev, activeIndex, overIndex);
      }
      return prev;
    });
  };

  const handleKanbanSave = async () => {
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
      void loadKanbanData();
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
      await loadKanbanData(true);
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

  if (isLoading) return <LoadingState />;

  const viewToggle = (
    <div className="flex items-center rounded-md border p-0.5">
      <button
        type="button"
        onClick={() => changeViewMode('list')}
        title={t('pages.todayTasks.listMode')}
        className={cn(
          'rounded px-2 py-1 transition-colors',
          viewMode === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => changeViewMode('kanban')}
        title={t('pages.todayTasks.kanbanMode')}
        className={cn(
          'rounded px-2 py-1 transition-colors',
          viewMode === 'kanban'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader title={t('pages.todayTasks.title')} icon={<CheckCircle2 />}>
        {viewToggle}
      </PageHeader>

      {/* ─── LIST MODE ─── */}
      {viewMode === 'list' && (
        <>
          {todayTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
              message={t('pages.todayTasks.emptyState')}
            />
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => {
                const badge = getStatusBadge(task.status);
                const isCompleted = task.status === 'completed';
                const isUpdating = updatingTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border p-4 transition-opacity',
                      isCompleted && 'opacity-60'
                    )}
                  >
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => void handleToggleTaskComplete(task)}
                      title={
                        isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'
                      }
                      className="shrink-0 text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6 text-success" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn('font-semibold', isCompleted && 'line-through')}
                        >
                          {task.task_name}
                        </h3>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      {task.time_display && (
                        <p className="text-sm text-muted-foreground">
                          {t('pages.todayTasks.timeLabel', { time: task.time_display })}
                        </p>
                      )}
                      {task.notes && (
                        <p className="text-sm text-muted-foreground">{task.notes}</p>
                      )}
                    </div>
                    {task.category_display && (
                      <TaskCategoryBadge
                        icon={task.icon}
                        label={task.category_display}
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

      {/* ─── KANBAN MODE ─── */}
      {viewMode === 'kanban' && (
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="date">{t('common.fields.date')}</Label>
                <DatePicker
                  value={selectedDate ? parseLocalDate(selectedDate) : undefined}
                  onChange={(date) =>
                    setSelectedDate(date ? formatLocalDate(date) : '')
                  }
                  placeholder={t('pages.dailyChecklist.datePlaceholder')}
                  className="max-w-xs"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void handleSync()}
                disabled={isSyncing || isLoading}
                title={t('pages.dailyChecklist.syncBtn')}
                aria-label={t('pages.dailyChecklist.syncBtn')}
              >
                <RefreshCw
                  className={cn('h-4 w-4', isSyncing && 'animate-spin')}
                  aria-hidden="true"
                />
              </Button>
              <Dialog open={isReflectionOpen} onOpenChange={setIsReflectionOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative"
                    title={t('pages.dailyChecklist.addReflection')}
                    aria-label={t('pages.dailyChecklist.addReflection')}
                  >
                    <StickyNote className="h-4 w-4" aria-hidden="true" />
                    {(reflection.trim() || mood) && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent size="md">
                  <DialogHeader>
                    <DialogTitle>
                      {t('pages.dailyChecklist.reflectionTitle')}
                    </DialogTitle>
                    <DialogDescription>
                      {t('pages.dailyChecklist.reflectionPlaceholder')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="mood">
                        {t('pages.dailyChecklist.moodQuestion')}
                      </Label>
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
                        placeholder={t(
                          'pages.dailyChecklist.reflectionTextPlaceholder'
                        )}
                        rows={6}
                      />
                      {reflection.length > 0 && reflection.length < 10 && (
                        <p className="mt-1 text-sm text-destructive">
                          {t('pages.dailyChecklist.reflectionMinLength')}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsReflectionOpen(false)}
                    >
                      {t('common.actions.close')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex-1" />
            <div className="text-lg font-semibold">
              {cardsByStatus.done.length}{' '}
              {t('pages.dailyChecklist.itemsCompleted', { total: cards.length })}
              {summary.completion_rate > 0 && (
                <span className="ml-2 text-sm">
                  ({summary.completion_rate.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>

          {cards.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
              title={t('pages.dailyChecklist.noTasks')}
              message={t('pages.dailyChecklist.noTasksDesc')}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              measuring={measuringConfig}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-3 gap-6">
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

          <div className="flex justify-end">
            <Button
              onClick={() => void handleKanbanSave()}
              disabled={isSaving}
              size="lg"
            >
              {isSaving ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-pulse" />
                  {t('common.actions.saving')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('common.actions.save')}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </PageContainer>
  );
}
