import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TaskInstance } from '@/types';

export interface FocusBlock {
  id: string;
  name: string;
  taskIds: number[];
  collapsed: boolean;
}

interface FocusBlockCardProps {
  block: FocusBlock;
  instances: TaskInstance[];
  allBlockedIds: Set<number>;
  onToggleCollapse: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onAddTask: (blockId: string, taskId: number) => void;
  onRemoveTask: (blockId: string, taskId: number) => void;
  onToggleTaskComplete: (task: TaskInstance) => void;
}

export function FocusBlockCard({
  block,
  instances,
  allBlockedIds,
  onToggleCollapse,
  onDeleteBlock,
  onAddTask,
  onRemoveTask,
  onToggleTaskComplete,
}: FocusBlockCardProps) {
  const { t } = useTranslation();

  const blockTasks = instances.filter((i) => block.taskIds.includes(i.id));
  const doneCount = blockTasks.filter((task) => task.status === 'completed').length;
  const total = blockTasks.length;
  const progressPct = total > 0 ? (doneCount / total) * 100 : 0;
  const isAllDone = total > 0 && doneCount === total;
  const hasProgress = progressPct > 0 && !isAllDone;

  const availableToAdd = instances.filter((i) => !allBlockedIds.has(i.id));

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
    >
      <div className="gap-sm px-md py-sm flex items-center">
        <button
          type="button"
          onClick={() => onToggleCollapse(block.id)}
          className="gap-sm flex flex-1 items-center text-left"
        >
          {block.collapsed ? (
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          )}
          <span className="text-sm font-semibold">{block.name}</span>
        </button>

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

        <button
          type="button"
          onClick={() => onDeleteBlock(block.id)}
          title={t('pages.focusBlocks.deleteBlock')}
          className="ml-xs text-muted-foreground/40 hover:text-destructive shrink-0 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {total > 0 && (
        <div className="mx-md mb-xs bg-muted/50 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isAllDone ? 'bg-success' : 'bg-primary'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {!block.collapsed && (
        <div className="px-md pb-md pt-xs">
          {blockTasks.length === 0 ? (
            <p className="py-xs text-muted-foreground text-xs">
              {t('pages.focusBlocks.noTasks')}
            </p>
          ) : (
            <div className="space-y-xs">
              {blockTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'group gap-sm px-sm py-xs flex items-center rounded-md transition-colors',
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
                      task.status === 'completed' &&
                        'text-muted-foreground line-through'
                    )}
                  >
                    {task.task_name}
                  </span>
                  {task.time_display && (
                    <span className="text-muted-foreground/70 text-xs">
                      {task.time_display}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveTask(block.id, task.id)}
                    title={t('pages.focusBlocks.removeTask')}
                    className="hover:!text-destructive group-hover:text-muted-foreground/50 shrink-0 text-transparent transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {availableToAdd.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-sm gap-xs px-sm text-muted-foreground hover:border-primary hover:text-primary h-7 border border-dashed text-xs"
                >
                  <Plus className="h-3 w-3" />
                  {t('pages.focusBlocks.addTask')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
                {availableToAdd.map((task) => (
                  <DropdownMenuItem
                    key={task.id}
                    onClick={() => onAddTask(block.id, task.id)}
                  >
                    {task.task_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
