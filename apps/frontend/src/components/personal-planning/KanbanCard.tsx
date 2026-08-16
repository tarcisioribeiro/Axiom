import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import {
  GripVertical,
  Clock,
  CheckCircle2,
  Flame,
  AlertTriangle,
  Minus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PomodoroTriggerButton } from '@/components/personal-planning/PomodoroTimer';
import { Badge } from '@/components/ui/badge';
import { getIconByName } from '@/components/ui/icon-picker';
import { cn } from '@/lib/utils';
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
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      health: 'bg-category-health/15 text-category-health border-transparent',
      intellect: 'bg-category-studies/15 text-category-studies border-transparent',
      studies: 'bg-category-studies/15 text-category-studies border-transparent',
      spiritual: 'bg-category-spiritual/15 text-category-spiritual border-transparent',
      exercise: 'bg-category-exercise/15 text-category-exercise border-transparent',
      nutrition: 'bg-category-nutrition/15 text-category-nutrition border-transparent',
      meditation: 'bg-category-spiritual/15 text-category-spiritual border-transparent',
      reading: 'bg-category-studies/15 text-category-studies border-transparent',
      writing: 'bg-category-work/15 text-category-work border-transparent',
      work: 'bg-category-work/15 text-category-work border-transparent',
      leisure: 'bg-category-leisure/15 text-category-leisure border-transparent',
      family: 'bg-accent text-accent-foreground border-transparent',
      social: 'bg-category-leisure/15 text-category-leisure border-transparent',
      finance: 'bg-category-finance/15 text-category-finance border-transparent',
      household: 'bg-category-nutrition/15 text-category-nutrition border-transparent',
      personal_care: 'bg-category-health/15 text-category-health border-transparent',
      other: 'bg-muted text-muted-foreground border-transparent',
    };
    return colors[category] || 'bg-muted text-muted-foreground border-transparent';
  };

  const getCategoryBorderColor = (category: string) => {
    const borders: Record<string, string> = {
      health: 'border-l-category-health',
      intellect: 'border-l-category-studies',
      studies: 'border-l-category-studies',
      spiritual: 'border-l-category-spiritual',
      exercise: 'border-l-category-exercise',
      nutrition: 'border-l-category-nutrition',
      meditation: 'border-l-category-spiritual',
      reading: 'border-l-category-studies',
      writing: 'border-l-category-work',
      work: 'border-l-category-work',
      leisure: 'border-l-category-leisure',
      family: 'border-l-accent',
      social: 'border-l-category-leisure',
      finance: 'border-l-category-finance',
      household: 'border-l-category-nutrition',
      personal_care: 'border-l-category-health',
      other: 'border-l-muted-foreground',
    };
    return borders[category] || 'border-l-muted-foreground';
  };

  const getPriorityIndicator = (priority?: string) => {
    if (!priority || priority === 'low') return null;
    if (priority === 'high')
      return (
        <Flame
          className="text-destructive h-3.5 w-3.5 shrink-0"
          aria-label={t('pages.routineTasks.priorityHigh', { defaultValue: 'Alta' })}
        />
      );
    if (priority === 'medium')
      return (
        <AlertTriangle
          className="text-warning h-3.5 w-3.5 shrink-0"
          aria-label={t('pages.routineTasks.priorityMedium', { defaultValue: 'Média' })}
        />
      );
    return <Minus className="text-muted-foreground h-3.5 w-3.5 shrink-0" />;
  };

  const isDone = card.status === 'done';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0, scale: isDragging ? 1.03 : 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      whileHover={{
        scale: isDragging ? 1.03 : 1.01,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}
      className={cn(
        'border-border bg-card p-md cursor-grab rounded-lg border border-l-4 shadow-sm active:cursor-grabbing',
        getCategoryBorderColor(card.category)
      )}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle / Done indicator */}
        <div className="mt-xs hover:text-foreground">
          <AnimatePresence mode="wait">
            {isDone ? (
              <motion.div
                key="done"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <CheckCircle2 className="text-success h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div key="drag" initial={{ scale: 1 }} animate={{ scale: 1 }}>
                <GripVertical className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Card Content */}
        <div className="space-y-sm flex-1">
          {/* Title and Category */}
          <div className="gap-sm flex items-start justify-between">
            <div className="flex-1">
              <h4
                className={cn(
                  'gap-sm flex items-center text-sm leading-tight font-semibold',
                  isDone && 'line-through opacity-60'
                )}
              >
                <TaskIconDisplay icon={card.icon} />
                {getPriorityIndicator(card.priority)}
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
                <div className="mt-xs gap-xs flex items-center text-xs">
                  <Clock className="h-3 w-3" />
                  <span>
                    {card.scheduled_time}
                    {card.scheduled_time && card.closing_time && ' — '}
                    {card.closing_time}
                  </span>
                </div>
              )}
            </div>
            <div
              className="gap-xs flex shrink-0 items-center"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {!isDone && <PomodoroTriggerButton taskName={card.task_name} />}
              <Badge className={`${getCategoryColor(card.category)} text-xs`}>
                {t(`pages.todayTasks.categories.${card.category}`, {
                  defaultValue: card.category_display,
                })}
              </Badge>
            </div>
          </div>

          {/* Task Description */}
          {card.description && (
            <p className="text-xs leading-relaxed whitespace-pre-wrap">
              {card.description}
            </p>
          )}

          {/* Daily Notes */}
          {card.notes && (
            <div className="border-warning bg-warning/20 p-sm rounded-md border">
              <p className="mb-xs text-xs font-medium">
                {t('pages.todayTasks.notesLabel')}
              </p>
              <p className="text-foreground text-xs leading-relaxed whitespace-pre-wrap">
                {card.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
