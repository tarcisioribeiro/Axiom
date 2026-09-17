import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { appearsOnDay, getTimesForTask } from '@/lib/routine-export';
import { cn } from '@/lib/utils';
import type { FocusBlock, RoutineTask } from '@/types';

interface FocusBlockTasksEditorProps {
  block: FocusBlock;
  routineTasks: RoutineTask[];
  onAddTask: (routineTaskId: number, occurrenceIndex: number | null) => void;
  onRemoveTask: (focusBlockTaskId: number) => void;
}

export function FocusBlockTasksEditor({
  block,
  routineTasks,
  onAddTask,
  onRemoveTask,
}: FocusBlockTasksEditorProps) {
  const { t } = useTranslation();

  const takenByTask = new Map<number, Set<number | null>>();
  for (const bt of block.block_tasks) {
    const set = takenByTask.get(bt.routine_task) ?? new Set<number | null>();
    set.add(bt.occurrence_index ?? null);
    takenByTask.set(bt.routine_task, set);
  }

  const addableTasks = routineTasks
    .filter((task) => block.weekdays.some((w) => appearsOnDay(task, w)))
    .map((task) => {
      const taken = takenByTask.get(task.id) ?? new Set<number | null>();
      if (task.daily_occurrences <= 1) {
        return taken.has(null) ? null : { task, occurrences: null };
      }
      const times = getTimesForTask(task);
      const options = Array.from(
        { length: task.daily_occurrences },
        (_, i) => i
      ).filter((i) => !taken.has(i));
      const wholeAvailable = !taken.has(null);
      if (options.length === 0 && !wholeAvailable) return null;
      return { task, occurrences: { options, times, wholeAvailable } };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return (
    <div>
      {block.block_tasks.length === 0 ? (
        <p className="text-muted-foreground py-xs text-xs">
          {t('pages.routineTasks.focusBlocks.noTasks')}
        </p>
      ) : (
        <div className="space-y-xs">
          {block.block_tasks.map((bt) => (
            <div
              key={bt.id}
              className="group gap-sm px-sm py-xs hover:bg-muted/40 flex items-center rounded-md transition-colors"
            >
              <span className="flex-1 text-sm">{bt.routine_task_name}</span>
              {bt.occurrence_index !== null && bt.occurrence_index !== undefined && (
                <span className="bg-primary/10 text-primary px-xs rounded font-mono text-xs font-medium">
                  {t('pages.routineTasks.focusBlocks.occurrenceLabel', {
                    index: bt.occurrence_index + 1,
                  })}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoveTask(bt.id)}
                title={t('pages.routineTasks.focusBlocks.removeTask')}
                className={cn(
                  'group-hover:text-muted-foreground/50 text-transparent transition-colors',
                  'hover:!text-destructive shrink-0'
                )}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {addableTasks.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-sm gap-xs px-sm text-muted-foreground hover:border-primary hover:text-primary h-7 border border-dashed text-xs"
            >
              <Plus className="h-3 w-3" />
              {t('pages.routineTasks.focusBlocks.addTask')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            {addableTasks.map(({ task, occurrences }) =>
              occurrences === null ? (
                <DropdownMenuItem
                  key={task.id}
                  onClick={() => onAddTask(task.id, null)}
                >
                  {task.name}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub key={task.id}>
                  <DropdownMenuSubTrigger>{task.name}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {occurrences.wholeAvailable && (
                      <DropdownMenuItem onClick={() => onAddTask(task.id, null)}>
                        {t('pages.routineTasks.focusBlocks.wholeTask')}
                      </DropdownMenuItem>
                    )}
                    {occurrences.options.map((i) => (
                      <DropdownMenuItem key={i} onClick={() => onAddTask(task.id, i)}>
                        {occurrences.times[i] ??
                          t('pages.routineTasks.focusBlocks.occurrenceLabel', {
                            index: i + 1,
                          })}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
