import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getIconByName } from '@/components/ui/icon-picker';
import type { TaskCard } from '@/types';

function TaskIconDisplay({ icon }: { icon: string | null | undefined }) {
  const Icon = getIconByName(icon);
  // eslint-disable-next-line react-hooks/static-components -- Icon is a stable Lucide reference, not a dynamic component
  return Icon ? <Icon className="h-4 w-4 shrink-0" /> : null;
}

interface KanbanCardProps {
  card: TaskCard;
}

export function KanbanCard({ card }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      health: 'bg-category-health',
      studies: 'bg-category-studies',
      spiritual: 'bg-category-spiritual',
      exercise: 'bg-category-exercise',
      nutrition: 'bg-category-nutrition',
      meditation: 'bg-category-spiritual',
      reading: 'bg-category-studies',
      writing: 'bg-category-work',
      work: 'bg-category-work',
      leisure: 'bg-category-leisure',
      family: 'bg-accent',
      social: 'bg-category-leisure',
      finance: 'bg-category-finance',
      household: 'bg-category-nutrition',
      personal_care: 'bg-category-health',
      other: 'bg-muted',
    };
    return colors[category] || 'bg-muted';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border-2 border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div className="mt-1 hover:text-foreground">
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Card Content */}
        <div className="flex-1 space-y-2.5">
          {/* Title and Category */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                <TaskIconDisplay icon={card.icon} />
                <span>
                  {card.task_name}
                  {card.total_instances > 1 && (
                    <span className="ml-2 text-xs font-normal">
                      ({card.index + 1}º {card.unit})
                    </span>
                  )}
                </span>
              </h4>
              {card.scheduled_time && (
                <div className="mt-1 flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  <span>{card.scheduled_time}</span>
                </div>
              )}
            </div>
            <Badge className={`${getCategoryColor(card.category)} shrink-0 text-xs`}>
              {card.category_display}
            </Badge>
          </div>

          {/* Task Description */}
          {card.description && (
            <p className="whitespace-pre-wrap text-xs leading-relaxed">
              {card.description}
            </p>
          )}

          {/* Daily Notes */}
          {card.notes && (
            <div className="rounded-md border border-warning bg-warning/20 p-2.5">
              <p className="mb-1 text-xs font-medium">Notas:</p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                {card.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
