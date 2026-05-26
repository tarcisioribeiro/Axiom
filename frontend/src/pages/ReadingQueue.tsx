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
import { BookOpen, GripVertical, Clock } from 'lucide-react';
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

const RANK_COLORS = ['bg-amber-500', 'bg-zinc-400', 'bg-orange-600'];

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
    opacity: isDragging ? 0.4 : 1,
  };

  const badge = getPriorityBadge(rank);
  const rankColorClass = rank <= 3 ? RANK_COLORS[rank - 1] : 'bg-muted-foreground/40';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-md rounded-lg border bg-card p-md shadow-sm"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none opacity-40 transition-opacity hover:opacity-100 active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Circular rank badge */}
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${rankColorClass}`}
      >
        {rank}
      </span>

      {/* Book cover thumbnail */}
      <div className="h-12 w-8 shrink-0 overflow-hidden rounded shadow-sm">
        {book.cover ? (
          <img
            src={book.cover}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Title + author */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{book.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {book.authors_names.join(', ')}
        </p>
      </div>

      {/* Badges */}
      <div className="flex shrink-0 items-center gap-sm">
        <Badge variant="outline" className="hidden text-xs sm:inline-flex">
          {book.genre_display}
        </Badge>
        {book.estimated_days_to_finish != null && (
          <Badge
            variant="outline"
            className="hidden items-center gap-xs text-xs lg:inline-flex"
          >
            <Clock className="h-3 w-3" />~{book.estimated_days_to_finish}d
          </Badge>
        )}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <PageHeader title={t('pages.readingQueue.title')} icon={<BookOpen />} />

      {books.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12 text-muted-foreground" />}
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
