import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      health: 'bg-category-health text-white border-transparent',
      intellect: 'bg-category-studies text-white border-transparent',
      studies: 'bg-category-studies text-white border-transparent',
      spiritual: 'bg-category-spiritual text-white border-transparent',
      exercise: 'bg-category-exercise text-white border-transparent',
      nutrition: 'bg-category-nutrition text-white border-transparent',
      meditation: 'bg-category-spiritual text-white border-transparent',
      reading: 'bg-category-studies text-white border-transparent',
      writing: 'bg-category-work text-white border-transparent',
      work: 'bg-category-work text-white border-transparent',
      leisure: 'bg-category-leisure text-white border-transparent',
      family: 'bg-accent text-accent-foreground border-transparent',
      social: 'bg-category-leisure text-white border-transparent',
      finance: 'bg-category-finance text-white border-transparent',
      household: 'bg-category-nutrition text-white border-transparent',
      personal_care: 'bg-category-health text-white border-transparent',
      other: 'bg-muted text-muted-foreground border-transparent',
    };
    return colors[category] || 'bg-muted text-muted-foreground border-transparent';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border-2 border-border bg-card p-md shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div className="mt-xs hover:text-foreground">
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Card Content */}
        <div className="flex-1 space-y-sm">
          {/* Title and Category */}
          <div className="flex items-start justify-between gap-sm">
            <div className="flex-1">
              <h4 className="flex items-center gap-sm text-sm font-semibold leading-tight">
                <TaskIconDisplay icon={card.icon} />
                <span>
                  {card.task_name}
                  {card.total_instances > 1 && (
                    <span className="ml-sm text-xs font-normal">
                      ({card.index + 1}º{' '}
                      {t(`pages.routineTasks.form.unitOptions.${card.unit}`, {
                        defaultValue: card.unit,
                      })}
                      )
                    </span>
                  )}
                </span>
              </h4>
              {(card.scheduled_time || card.closing_time) && (
                <div className="mt-xs flex items-center gap-xs text-xs">
                  <Clock className="h-3 w-3" />
                  <span>
                    {card.scheduled_time}
                    {card.scheduled_time && card.closing_time && ' — '}
                    {card.closing_time}
                  </span>
                </div>
              )}
            </div>
            <Badge className={`${getCategoryColor(card.category)} shrink-0 text-xs`}>
              {t(`pages.todayTasks.categories.${card.category}`, {
                defaultValue: card.category_display,
              })}
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
            <div className="rounded-md border border-warning bg-warning/20 p-sm">
              <p className="mb-xs text-xs font-medium">
                {t('pages.todayTasks.notesLabel')}
              </p>
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
