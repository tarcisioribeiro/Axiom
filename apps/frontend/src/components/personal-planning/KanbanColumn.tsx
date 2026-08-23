import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CheckCircleIcon as CheckCircle2 } from '@heroicons/react/24/solid';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { useCounter } from '@/lib/animations';
import type { TaskCard, KanbanStatus } from '@/types';

import { KanbanCard } from './KanbanCard';

function AnimatedCount({ value }: { value: number }) {
  const count = useCounter(value, 0.4);
  return <span>{count}</span>;
}

interface KanbanColumnProps {
  status: KanbanStatus;
  title: string;
  cards: TaskCard[];
  totalCards?: number;
}

export function KanbanColumn({ status, title, cards, totalCards }: KanbanColumnProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const isComplete =
    status === 'done' &&
    totalCards !== undefined &&
    totalCards > 0 &&
    cards.length >= totalCards;

  const getColorClasses = () => {
    const colors = {
      todo: 'bg-muted/30 border-border',
      doing: 'bg-info/10 border-info/30',
      done: 'bg-success/10 border-success/30',
    };
    return colors[status] || colors.todo;
  };

  const getHeaderColor = () => {
    const colors = {
      todo: 'bg-muted-foreground',
      doing: 'bg-info',
      done: 'bg-success',
    };
    return colors[status] || colors.todo;
  };

  return (
    <div className="flex max-h-[calc(100vh-14rem)] flex-col">
      <div
        className={`${getHeaderColor()} px-md flex-shrink-0 rounded-t-lg py-3 text-white`}
      >
        <div className="flex items-center justify-between">
          <div className="gap-sm flex items-center">
            <h3 className="text-lg font-semibold">{title}</h3>
            {isComplete && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                <CheckCircle2 className="h-5 w-5 text-white" aria-hidden="true" />
              </motion.div>
            )}
          </div>
          <motion.span
            key={cards.length}
            initial={{ scale: 1.4, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm font-bold"
          >
            <AnimatedCount value={cards.length} />
          </motion.span>
        </div>
        <p className="text-sm opacity-90">
          {t('pages.todayTasks.taskCount', { count: cards.length })}
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 ${getColorClasses()} kanban-scrollbar p-md min-h-[200px] overflow-y-auto rounded-b-lg border-2 transition-colors ${
          isOver ? 'border-info bg-info/20 border-4 border-dashed' : ''
        }`}
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            <AnimatePresence>
              {cards.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-xl text-center"
                >
                  <p className="text-sm">{t('pages.todayTasks.emptyColumn')}</p>
                </motion.div>
              ) : (
                cards.map((card) => <KanbanCard key={card.id} card={card} />)
              )}
            </AnimatePresence>
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
