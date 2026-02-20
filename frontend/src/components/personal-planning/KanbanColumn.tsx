import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import type { TaskCard, KanbanStatus } from '@/types';

import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  status: KanbanStatus;
  title: string;
  cards: TaskCard[];
}

export function KanbanColumn({ status, title, cards }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

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
      {/* Column Header */}
      <div
        className={`${getHeaderColor()} flex-shrink-0 rounded-t-lg px-4 py-3 text-white`}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm opacity-90">
          {cards.length} {cards.length === 1 ? 'tarefa' : 'tarefas'}
        </p>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`flex-1 ${getColorClasses()} kanban-scrollbar min-h-[200px] overflow-y-auto rounded-b-lg border-2 p-4 transition-colors ${
          isOver ? 'border-4 border-dashed border-info bg-info/20' : ''
        }`}
      >
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {cards.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm">Nenhuma tarefa</p>
              </div>
            ) : (
              cards.map((card) => <KanbanCard key={card.id} card={card} />)
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
