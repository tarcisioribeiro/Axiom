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
import { GripVertical } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { booksService } from '@/services/books-service';
import type { Book } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

function getPriorityBadge(rank: number): {
  label: string;
  variant: 'destructive' | 'warning' | 'secondary';
} {
  if (rank === 1) return { label: 'Alta', variant: 'destructive' };
  if (rank <= 3) return { label: 'Média', variant: 'warning' };
  return { label: 'Baixa', variant: 'secondary' };
}

interface SortableBookItemProps {
  book: Book;
  rank: number;
}

function SortableBookItem({ book, rank }: SortableBookItemProps) {
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
      className="flex items-center gap-md rounded-lg border bg-card p-md shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{book.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {book.authors_names.join(', ')}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-sm">
        <Badge variant="outline" className="hidden text-xs sm:inline-flex">
          {book.genre_display}
        </Badge>
        <Badge variant={badge.variant} className="text-xs">
          {badge.label}
        </Badge>
      </div>
    </div>
  );
}

export default function ReadingQueue() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    void loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      setIsLoading(true);
      const data = await booksService.getReadingQueue();
      setBooks(data);
    } catch (err) {
      toast({
        title: t('pages.readingQueue.errorLoad'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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

    setBooks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      persistOrder(reordered);
      return reordered;
    });
  };

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader title={t('pages.readingQueue.title')} />

      {books.length === 0 ? (
        <EmptyState
          title={t('pages.readingQueue.emptyTitle')}
          message={t('pages.readingQueue.emptyDesc')}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={books.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-sm">
              {books.map((book, index) => (
                <SortableBookItem key={book.id} book={book} rank={index + 1} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </PageContainer>
  );
}
