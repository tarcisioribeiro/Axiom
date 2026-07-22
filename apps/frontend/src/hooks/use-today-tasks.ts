/* eslint-disable max-lines */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/lib/utils';
import { appService } from '@/services/app-service';
import { dailyReflectionsService } from '@/services/daily-reflections-service';
import { membersService } from '@/services/members-service';
import { taskInstancesService } from '@/services/task-instances-service';
import type { InstanceStatus, KanbanStatus, TaskCard, TaskInstance } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type ViewMode = 'list' | 'kanban';

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

export function useTodayTasks(viewMode: ViewMode) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [ownerId, setOwnerId] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [todayTasks, setTodayTasks] = useState<TaskInstance[]>([]);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState('');
  const [reflectionId, setReflectionId] = useState<number | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    completion_rate: 0,
  });

  const convertInstancesToCards = useCallback(
    (list: TaskInstance[]): TaskCard[] =>
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
        closing_time: instance.closing_time
          ? instance.closing_time.substring(0, 5)
          : undefined,
      })),
    []
  );

  const loadCurrentUserMember = useCallback(async () => {
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
  }, [toast, t]);

  const loadListData = useCallback(
    async (sync = false) => {
      try {
        setIsLoading(true);
        const response = await taskInstancesService.getForDate(selectedDate, sync);
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
    },
    [selectedDate, toast, t]
  );

  const loadKanbanData = useCallback(
    async (sync = false) => {
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
    },
    [selectedDate, toast, t]
  );

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
  }, [loadCurrentUserMember]);

  useEffect(() => {
    if (ownerId > 0 && selectedDate) {
      if (viewMode === 'list') void loadListData();
      else void loadKanbanData();
    }
  }, [selectedDate, ownerId, viewMode, loadListData, loadKanbanData]);

  useEffect(() => {
    setCards(instances.length > 0 ? convertInstancesToCards(instances) : []);
  }, [instances, convertInstancesToCards]);

  const handleToggleTaskComplete = async (task: TaskInstance) => {
    const newStatus: InstanceStatus =
      task.status === 'completed' ? 'pending' : 'completed';
    setUpdatingTaskId(task.id);
    try {
      await taskInstancesService.bulkUpdate([
        { id: task.id, status: newStatus, notes: task.notes ?? undefined },
      ]);
      setTodayTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: newStatus,
                status_display: newStatus === 'completed' ? 'Concluída' : 'Pendente',
              }
            : item
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

  const handleKanbanSave = async () => {
    try {
      setIsSaving(true);
      const updates = cards.map((card) => ({
        id: card.task_id,
        status: mapKanbanToInstance(card.status),
        notes: card.notes,
      }));
      const reflectionData =
        reflection.trim().length >= 10
          ? {
              date: selectedDate,
              reflection: reflection.trim(),
              mood: mood || undefined,
              owner: ownerId,
            }
          : null;
      const promises: Promise<unknown>[] = [taskInstancesService.bulkUpdate(updates)];
      if (reflectionData) {
        promises.push(
          reflectionId
            ? dailyReflectionsService.update(reflectionId, reflectionData)
            : dailyReflectionsService.create(reflectionData)
        );
      }
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

  return {
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
  };
}
