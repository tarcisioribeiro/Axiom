import { Edit, Trash2 } from 'lucide-react';
import { createElement } from 'react';

import { Button } from '@/components/ui/button';
import { getIconByName } from '@/components/ui/icon-picker';
import type { FocusBlock, RoutineTask } from '@/types';
import { WEEKDAY_CHOICES } from '@/types';

import { FocusBlockTasksEditor } from './FocusBlockTasksEditor';

function BlockIcon({ name, className }: { name?: string | null; className?: string }) {
  const icon = getIconByName(name);
  if (!icon) return null;
  return createElement(icon, { className });
}

interface RoutineFocusBlockCardProps {
  block: FocusBlock;
  routineTasks: RoutineTask[];
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: (routineTaskId: number, occurrenceIndex: number | null) => void;
  onRemoveTask: (focusBlockTaskId: number) => void;
}

export function RoutineFocusBlockCard({
  block,
  routineTasks,
  onEdit,
  onDelete,
  onAddTask,
  onRemoveTask,
}: RoutineFocusBlockCardProps) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-l-4"
      style={{ borderLeftColor: block.color || undefined }}
    >
      <div className="gap-sm px-md py-sm bg-muted/20 flex items-center">
        <BlockIcon
          name={block.icon}
          className="text-muted-foreground h-4 w-4 shrink-0"
        />
        <div className="flex-1">
          <span className="block text-sm font-semibold">{block.name}</span>
          <span className="text-muted-foreground text-2xs">
            {WEEKDAY_CHOICES.filter((d) => block.weekdays.includes(d.value))
              .map((d) => d.label.substring(0, 3))
              .join(' · ')}
          </span>
        </div>
        <span className="bg-muted text-muted-foreground px-xs rounded-full py-0.5 text-xs font-medium tabular-nums">
          {block.block_tasks.length}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="text-destructive h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="px-md pb-md pt-sm">
        <FocusBlockTasksEditor
          block={block}
          routineTasks={routineTasks}
          onAddTask={onAddTask}
          onRemoveTask={onRemoveTask}
        />
      </div>
    </div>
  );
}
