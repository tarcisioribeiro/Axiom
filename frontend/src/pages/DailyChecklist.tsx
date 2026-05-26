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
import { Save, CheckCircle2, StickyNote, RefreshCw } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { KanbanCard } from '@/components/personal-planning/KanbanCard';
import { KanbanColumn } from '@/components/personal-planning/KanbanColumn';
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
import { formatLocalDate, parseLocalDate } from '@/lib/utils';
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

export default function DailyChecklist() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [instances, setInstances] = useState<TaskInstance[]>([]);
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
  const [summary, setSummary] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    completion_rate: 0,
  });
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const measuringConfig = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  // Converte TaskInstance[] para TaskCard[]
  const convertInstancesToCards = (instances: TaskInstance[]): TaskCard[] => {
    return instances.map((instance) => ({
      id: `instance-${instance.id}`,
      task_id: instance.id, // Agora é o ID da instância
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
  };

  // Agrupa cards por status
  const cardsByStatus = useMemo(() => {
    return {
      todo: cards.filter((card) => card.status === 'todo'),
      doing: cards.filter((card) => card.status === 'doing'),
      done: cards.filter((card) => card.status === 'done'),
    };
  }, [cards]);

  useEffect(() => {
    const initializeDate = async () => {
      try {
        const serverDate = await appService.getCurrentDate();
        setSelectedDate(serverDate);
      } catch {
        setSelectedDate(formatLocalDate(new Date()));
      }
    };

    void loadCurrentUserMember();
    void initializeDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ownerId > 0 && selectedDate) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, ownerId]);

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

  const loadData = async (sync: boolean = false) => {
    try {
      setIsLoading(true);
      const [instancesResponse, reflections] = await Promise.all([
        taskInstancesService.getForDate(selectedDate, sync),
        dailyReflectionsService.getAll(),
      ]);

      setInstances(instancesResponse.instances);
      setSummary(instancesResponse.summary);

      // Encontra reflexão do dia selecionado
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find((c) => c.id === active.id);
    setActiveCard(card || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setCards((prevCards) => {
      const activeCard = prevCards.find((c) => c.id === activeId);
      const overCard = prevCards.find((c) => c.id === overId);

      if (!activeCard) return prevCards;

      let targetStatus: KanbanStatus | undefined;

      if (overCard) {
        targetStatus = overCard.status;
      } else if (['todo', 'doing', 'done'].includes(overId)) {
        targetStatus = overId as KanbanStatus;
      }

      // Retorna o mesmo array se não houver mudança - evita re-renders desnecessários
      if (!targetStatus || activeCard.status === targetStatus) {
        return prevCards;
      }

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
      const activeCard = prevCards.find((c) => c.id === activeId);
      const overCard = prevCards.find((c) => c.id === overId);

      if (!activeCard) return prevCards;

      let finalStatus: KanbanStatus | undefined;

      if (overCard) {
        finalStatus = overCard.status;
      } else if (['todo', 'doing', 'done'].includes(overId)) {
        finalStatus = overId as KanbanStatus;
      }

      if (!finalStatus) return prevCards;

      // Reordena apenas se estiver na mesma coluna e sobre outro card
      if (activeCard.status === finalStatus && overCard) {
        const activeIndex = prevCards.findIndex((c) => c.id === activeId);
        const overIndex = prevCards.findIndex((c) => c.id === overId);
        return arrayMove(prevCards, activeIndex, overIndex);
      }

      return prevCards;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Prepara atualizações de status das instâncias
      const updates = cards.map((card) => ({
        id: card.task_id, // task_id agora é o ID da instância
        status: mapKanbanToInstance(card.status),
        notes: card.notes,
      }));

      // Salva todas as atualizações de uma vez
      const updatePromise = taskInstancesService.bulkUpdate(updates);

      // Salva ou atualiza reflexão se houver conteúdo
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

      // Recarrega dados para obter IDs e contagens atualizados
      void loadData();
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

  const completedTasks = cardsByStatus.done.length;

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.dailyChecklist.title')} icon={<CheckCircle2 />} />

      <div className="flex flex-wrap items-center gap-md">
        <div className="flex items-end gap-sm">
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
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
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
                    <p className="mt-xs text-sm text-destructive">
                      {t('pages.dailyChecklist.reflectionMinLength')}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsReflectionOpen(false)}>
                  {t('common.actions.close')}
                </Button>
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
          <div className="grid grid-cols-1 gap-md md:grid-cols-3 md:gap-lg">
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
    </PageContainer>
  );
}
