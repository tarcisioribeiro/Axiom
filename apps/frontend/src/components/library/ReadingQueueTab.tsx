import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BookOpenIcon as BookOpen,
  Bars3Icon as GripVertical,
  ClockIcon as Clock,
} from '@heroicons/react/24/solid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { booksService } from '@/services/books-service';
import type { Book } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function getPriorityBadge(rank: number): {
  labelKey: string;
  variant: 'destructive' | 'warning' | 'secondary';
} {
  if (rank === 1)
    return { labelKey: 'pages.readingQueue.priorityHigh', variant: 'destructive' };
  if (rank <= 3)
    return { labelKey: 'pages.readingQueue.priorityMedium', variant: 'warning' };
  return { labelKey: 'pages.readingQueue.priorityLow', variant: 'secondary' };
}

interface SortableBookItemProps {
  book: Book;
  rank: number;
}

function SortableBookItem({ book, rank }: SortableBookItemProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: book.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const badge = getPriorityBadge(rank);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="gap-md bg-card p-md flex items-center rounded-lg border shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <span className="text-muted-foreground w-6 text-center text-sm font-semibold">
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{book.title}</p>
        <p className="text-muted-foreground truncate text-sm">
          {book.authors_names.join(', ')}
        </p>
      </div>

      <div className="gap-sm flex shrink-0 items-center">
        <Badge variant="outline" className="hidden text-xs sm:inline-flex">
          {book.genre_display}
        </Badge>
        {book.estimated_days_to_finish != null && (
          <Badge
            variant="outline"
            className="gap-xs hidden items-center text-xs lg:inline-flex"
          >
            <Clock className="h-3 w-3" />~{book.estimated_days_to_finish}d
          </Badge>
        )}
        <Badge variant={badge.variant} className="text-xs">
          {t(badge.labelKey)}
        </Badge>
      </div>
    </div>
  );
}

const EMPTY_QUEUE: Book[] = [];
const QUERY_KEY = ['reading-queue'];

export function ReadingQueueTab() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: books = EMPTY_QUEUE, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        return await booksService.getReadingQueue();
      } catch (err) {
        toast({
          title: t('pages.readingQueue.errorLoad'),
          description: getErrorMessage(err),
          variant: 'destructive',
        });
        return EMPTY_QUEUE;
      }
    },
  });

  const persistOrder = useCallback(
    (ordered: Book[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const items = ordered.map((book, index) => ({
          id: book.id,
          priority: index + 1,
        }));
        void booksService.reorderQueue(items).catch((err: unknown) => {
          toast({
            title: t('pages.readingQueue.errorSave'),
            description: getErrorMessage(err),
            variant: 'destructive',
          });
        });
      }, 500);
    },
    [toast, t]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    queryClient.setQueryData<Book[]>(QUERY_KEY, (prev = EMPTY_QUEUE) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      persistOrder(reordered);
      return reordered;
    });
  };

  if (isLoading) return <LoadingState />;

  if (books.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="text-muted-foreground h-12 w-12" />}
        title={t('pages.readingQueue.emptyTitle')}
        message={t('pages.readingQueue.emptyDesc')}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={books.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="gap-sm flex flex-col">
          {books.map((book, index) => (
            <SortableBookItem key={book.id} book={book} rank={index + 1} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
