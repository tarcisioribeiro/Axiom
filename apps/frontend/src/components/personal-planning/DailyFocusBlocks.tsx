import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutList } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { getPythonWeekday } from '@/lib/routine-export';
import { parseLocalDate } from '@/lib/utils';
import { focusBlockTasksService } from '@/services/focus-block-tasks-service';
import { focusBlocksService } from '@/services/focus-blocks-service';
import { routineTasksService } from '@/services/routine-tasks-service';
import type { FocusBlock, FocusBlockFormData, TaskInstance } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { DailyFocusBlockCard } from './DailyFocusBlockCard';
import { FocusBlockTasksEditor } from './FocusBlockTasksEditor';
import { RoutineFocusBlockForm } from './RoutineFocusBlockForm';

function matchInstance(block: FocusBlock, instances: TaskInstance[]): TaskInstance[] {
  const matched: TaskInstance[] = [];
  for (const bt of block.block_tasks) {
    const instance = instances.find(
      (i) =>
        i.template === bt.routine_task &&
        (bt.occurrence_index === null ||
          bt.occurrence_index === undefined ||
          i.occurrence_index === bt.occurrence_index)
    );
    if (instance) matched.push(instance);
  }
  return matched;
}

interface DailyFocusBlocksProps {
  date: string;
  ownerId: number;
  instances: TaskInstance[];
  onToggleTaskComplete: (task: TaskInstance) => void;
}

export function DailyFocusBlocks({
  date,
  ownerId,
  instances,
  onToggleTaskComplete,
}: DailyFocusBlocksProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<FocusBlock | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: blocks = [] } = useQuery({
    queryKey: ['focus-blocks'],
    queryFn: () => focusBlocksService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: routineTasks = [] } = useQuery({
    queryKey: ['routine-tasks'],
    queryFn: () => routineTasksService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['focus-blocks'] });

  const todayWeekday = getPythonWeekday(parseLocalDate(date) ?? new Date());
  const visibleBlocks = blocks
    .filter((b) => b.is_active && b.weekdays.includes(todayWeekday))
    .map((block) => ({ block, tasks: matchInstance(block, instances) }));

  const handleEdit = (block: FocusBlock) => {
    setSelectedBlock(block);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: FocusBlockFormData) => {
    if (!selectedBlock) return;
    try {
      setIsSubmitting(true);
      const updated = await focusBlocksService.update(selectedBlock.id, data);
      setSelectedBlock(updated);
      toast({
        title: t('pages.routineTasks.focusBlocks.updated'),
        description: t('pages.routineTasks.focusBlocks.updatedDesc'),
      });
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTask = async (routineTask: number, occurrenceIndex: number | null) => {
    if (!selectedBlock) return;
    try {
      await focusBlockTasksService.create({
        focus_block: selectedBlock.id,
        routine_task: routineTask,
        occurrence_index: occurrenceIndex,
      });
      const refreshed = await focusBlocksService.getById(selectedBlock.id);
      setSelectedBlock(refreshed);
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.addTaskError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTask = async (focusBlockTaskId: number) => {
    if (!selectedBlock) return;
    try {
      await focusBlockTasksService.delete(focusBlockTaskId);
      const refreshed = await focusBlocksService.getById(selectedBlock.id);
      setSelectedBlock(refreshed);
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.removeTaskError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-sm">
      <div className="gap-sm flex items-center">
        <LayoutList className="text-primary h-4 w-4" />
        <span className="text-sm font-semibold">
          {t('pages.routineTasks.focusBlocks.title')}
        </span>
      </div>

      {visibleBlocks.length === 0 ? (
        <div className="bg-muted/20 px-md py-md rounded-lg border border-dashed text-center">
          <LayoutList className="mb-xs text-muted-foreground/40 mx-auto h-5 w-5" />
          <p className="text-muted-foreground text-xs">
            {blocks.length === 0
              ? t('pages.routineTasks.focusBlocks.emptyStateDesc')
              : t('pages.todayTasks.focusBlocksNoneTodayDesc')}
          </p>
        </div>
      ) : (
        visibleBlocks.map(({ block, tasks }) => (
          <DailyFocusBlockCard
            key={block.id}
            block={block}
            tasks={tasks}
            onToggleTaskComplete={onToggleTaskComplete}
            onEdit={() => handleEdit(block)}
          />
        ))
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('pages.routineTasks.focusBlocks.editBlockTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('pages.routineTasks.focusBlocks.editBlockDesc')}
            </DialogDescription>
          </DialogHeader>
          <RoutineFocusBlockForm
            block={selectedBlock}
            ownerId={ownerId}
            onSubmit={(data) => void handleSubmit(data)}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
          {selectedBlock && (
            <div className="pt-sm border-t">
              <FocusBlockTasksEditor
                block={selectedBlock}
                routineTasks={routineTasks}
                onAddTask={(routineTask, occurrenceIndex) =>
                  void handleAddTask(routineTask, occurrenceIndex)
                }
                onRemoveTask={(id) => void handleRemoveTask(id)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
