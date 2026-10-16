import { CheckCircle2, Circle, Edit } from 'lucide-react';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
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
  const { t } = useTranslation();
  const doneCount = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const progressPct = total > 0 ? (doneCount / total) * 100 : 0;
  const isAllDone = total > 0 && doneCount === total;

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
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
        <Can action="change">
          <Button
            aria-label={t('common.actions.edit')}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onEdit}
          >
            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </Can>
      </div>

      {total > 0 && (
        <div className="mx-md mb-xs bg-muted/50 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              'duration-slow h-full w-full origin-left rounded-full transition-transform',
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
              task.status !== 'completed' && 'hover:bg-muted/40'
            )}
          >
            <PlainButton
              type="button"
              onClick={() => onToggleTaskComplete(task)}
              className="text-primary hover:text-primary shrink-0 transition-colors"
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
            {(task.time_display || task.closing_time) && (
              <span className="text-muted-foreground/70 text-xs tabular-nums">
                {[task.time_display, task.closing_time?.substring(0, 5)]
                  .filter(Boolean)
                  .join(' — ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
