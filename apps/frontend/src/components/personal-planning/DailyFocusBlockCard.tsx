import { CheckCircle2, Circle, Edit } from 'lucide-react';
import { createElement } from 'react';

import { Button } from '@/components/ui/button';
import { getIconByName } from '@/components/ui/icon-picker';
import { PlainButton } from '@/components/ui/plain-button';
import { cn } from '@/lib/utils';
import type { FocusBlock, TaskInstance } from '@/types';

function BlockIcon({ name, className }: { name?: string | null; className?: string }) {
  const icon = getIconByName(name);
  if (!icon) return null;
  return createElement(icon, { className });
}

interface DailyFocusBlockCardProps {
  block: FocusBlock;
  tasks: TaskInstance[];
  onToggleTaskComplete: (task: TaskInstance) => void;
  onEdit: () => void;
}

export function DailyFocusBlockCard({
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
            <PlainButton
              type="button"
              onClick={() => onToggleTaskComplete(task)}
              className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
            >
              {task.status === 'completed' ? (
                <CheckCircle2 className="text-success h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </PlainButton>
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
