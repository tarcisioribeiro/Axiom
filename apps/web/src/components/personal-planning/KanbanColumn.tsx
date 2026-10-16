import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import type { TaskCard, KanbanStatus } from '@/types';

import { KanbanCard } from './KanbanCard';

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

  // Cor do status só na bolinha do header; coluna sempre neutra
  const dotColor = {
    todo: 'bg-muted-foreground',
    doing: 'bg-info',
    done: 'bg-success',
  }[status];

  return (
    <div className="flex max-h-[var(--kanban-max-h,calc(100vh-14rem))] flex-col">
      <div className="bg-muted border-border px-md py-sm flex-shrink-0 rounded-t-lg border border-b-0">
        <div className="flex items-center justify-between">
          <div className="gap-sm flex items-center">
            <span
              className={cn('h-2.5 w-2.5 rounded-full', dotColor)}
              aria-hidden="true"
            />
            <h3 className="text-foreground text-lg font-semibold">{title}</h3>
            {isComplete && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <CheckCircle2 className="text-success h-5 w-5" aria-hidden="true" />
              </motion.div>
            )}
          </div>
          <span className="bg-background text-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold">
            {cards.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'kanban-scrollbar p-md min-h-[200px] flex-1 overflow-y-auto rounded-b-lg border transition-colors',
          isOver
            ? 'border-primary bg-primary/5 border-dashed'
            : 'border-border bg-muted/30'
        )}
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-sm">
            <AnimatePresence>
              {cards.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-xl text-center"
                >
                  <EmptyState title={t('pages.todayTasks.emptyColumn')} />
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
