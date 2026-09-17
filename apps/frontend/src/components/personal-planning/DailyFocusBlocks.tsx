import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Edit, LayoutList } from 'lucide-react';
import { createElement, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getIconByName } from '@/components/ui/icon-picker';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { getPythonWeekday } from '@/lib/routine-export';
import { cn, parseLocalDate } from '@/lib/utils';
import { focusBlockTasksService } from '@/services/focus-block-tasks-service';
import { focusBlocksService } from '@/services/focus-blocks-service';
import { routineTasksService } from '@/services/routine-tasks-service';
import type { FocusBlock, FocusBlockFormData, TaskInstance } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { FocusBlockTasksEditor } from './FocusBlockTasksEditor';
import { RoutineFocusBlockForm } from './RoutineFocusBlockForm';

function BlockIcon({ name, className }: { name?: string | null; className?: string }) {
  const icon = getIconByName(name);
  if (!icon) return null;
  return createElement(icon, { className });
}

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

interface DailyFocusBlockCardProps {
  block: FocusBlock;
  tasks: TaskInstance[];
  onToggleTaskComplete: (task: TaskInstance) => void;
  onEdit: () => void;
}

function DailyFocusBlockCard({
  block,
  tasks,
  onToggleTaskComplete,
  onEdit,
}: DailyFocusBlockCardProps) {
  const doneCount = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const progressPct = total > 0 ? (doneCount / total) * 100 : 0;
  const isAllDone = total > 0 && doneCount === total;
  const hasProgress = progressPct > 0 && !isAllDone;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-l-4 transition-colors',
        isAllDone
          ? 'border-l-success bg-success/5'
          : hasProgress
            ? 'border-l-primary bg-primary/[0.03]'
            : 'border-l-muted-foreground/20 bg-card'
      )}
      style={{
        borderLeftColor:
          !isAllDone && !hasProgress ? block.color || undefined : undefined,
      }}
    >
      <div className="gap-sm px-md py-sm flex items-center">
        <BlockIcon
          name={block.icon}
          className="text-muted-foreground h-4 w-4 shrink-0"
        />
        <span className="flex-1 text-sm font-semibold">{block.name}</span>
        {total > 0 && (
          <span
            className={cn(
              'px-xs rounded-full py-0.5 text-xs font-medium tabular-nums',
              isAllDone
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {doneCount}/{total}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
          <Edit className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      {total > 0 && (
        <div className="mx-md mb-xs bg-muted/50 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full w-full origin-left rounded-full transition-transform duration-500',
              isAllDone ? 'bg-success' : 'bg-primary'
            )}
            style={{ transform: `scaleX(${progressPct / 100})` }}
          />
        </div>
      )}

      <div className="px-md pb-md pt-xs">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'gap-sm px-sm py-xs flex items-center rounded-md transition-colors',
              task.status === 'completed' ? 'bg-success/5' : 'hover:bg-muted/40'
            )}
          >
            <button
              type="button"
              onClick={() => onToggleTaskComplete(task)}
              className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
            >
              {task.status === 'completed' ? (
                <CheckCircle2 className="text-success h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>
            <span
              className={cn(
                'flex-1 text-sm',
                task.status === 'completed' && 'text-muted-foreground line-through'
              )}
            >
              {task.task_name}
            </span>
            {task.time_display && (
              <span className="text-muted-foreground/70 text-xs">
                {task.time_display}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
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
