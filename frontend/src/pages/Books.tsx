import { BookOpen, Plus, Star, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { BookDetailModal } from '@/components/library/BookDetailModal';
import { BookForm } from '@/components/library/BookForm';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { authorsService } from '@/services/authors-service';
import { booksService } from '@/services/books-service';
import { publishersService } from '@/services/publishers-service';
import type { Book, BookFormData, Author, Publisher } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const statusVariant = (status: string): 'success' | 'info' | 'warning' => {
  switch (status) {
    case 'read':
      return 'success';
    case 'reading':
      return 'info';
    default:
      return 'warning';
  }
};

function StarRow({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3 w-3 ${s <= rating ? 'fill-star text-star' : 'fill-muted text-muted'}`}
        />
      ))}
    </div>
  );
}

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form dialog (create / edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail modal (view)
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [booksData, authorsData, publishersData] = await Promise.all([
        booksService.getAll(),
        authorsService.getAll(),
        publishersService.getAll(),
      ]);
      setBooks(booksData);
      setAuthors(authorsData);
      setPublishers(publishersData);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    if (authors.length === 0 || publishers.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.books.noPrerequisitesMsg'),
        variant: 'destructive',
      });
      return;
    }
    setEditingBook(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.books.deleteTitle'),
      description: t('pages.books.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await booksService.delete(id);
      toast({
        title: t('pages.books.deleted'),
        description: t('pages.books.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: BookFormData, coverFile?: File | null) => {
    try {
      setIsSubmitting(true);
      let saved: Book;
      if (editingBook) {
        saved = await booksService.update(editingBook.id, data);
        toast({
          title: t('pages.books.updated'),
          description: t('pages.books.updatedDesc'),
        });
      } else {
        saved = await booksService.create(data);
        toast({
          title: t('pages.books.created'),
          description: t('pages.books.createdDesc'),
        });
      }
      if (coverFile) {
        await booksService.uploadCover(saved.id, coverFile);
      }
      setIsFormOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.authors_names.some((a) =>
        a.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      book.publisher_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.books.title')}
        icon={<BookOpen />}
        action={{
          label: t('pages.books.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <SearchInput
        placeholder={t('pages.books.searchPlaceholder')}
        value={searchTerm}
        onValueChange={setSearchTerm}
        className="max-w-sm"
      />

      {filteredBooks.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm ? t('pages.books.emptySearch') : t('pages.books.emptyState')
          }
        />
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filteredBooks.map((book) => (
            <button
              key={book.id}
              type="button"
              className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setDetailBook(book);
                setIsDetailOpen(true);
              }}
              aria-label={`Ver detalhes de ${book.title}`}
            >
              {/* Cover thumbnail */}
              <div className="shrink-0">
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={`Capa de ${book.title}`}
                    className="h-16 w-11 rounded object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-16 w-11 items-center justify-center rounded border bg-muted">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Title + Authors + Progress */}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-semibold leading-tight">{book.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {book.authors_names.join(', ')}
                </p>
                {book.reading_progress > 0 && (
                  <div className="flex items-center gap-2">
                    <Progress
                      value={book.reading_progress}
                      className="h-1.5 max-w-[160px]"
                    />
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      {book.reading_progress}%
                    </span>
                  </div>
                )}
              </div>

              {/* Status + Genre + Rating */}
              <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                <Badge variant={statusVariant(book.read_status)} className="text-xs">
                  {book.read_status_display}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {book.genre_display}
                </Badge>
                <StarRow rating={book.rating} />
              </div>

              {/* Pages */}
              <div className="hidden shrink-0 text-right text-xs text-muted-foreground lg:block">
                <p>{book.pages}p</p>
                {book.media_type_display && <p>{book.media_type_display}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <BookDetailModal
        book={detailBook}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={(book) => {
          setIsDetailOpen(false);
          handleEdit(book);
        }}
        onDelete={(id) => {
          setIsDetailOpen(false);
          void handleDelete(id);
        }}
      />

      {/* Create / Edit form dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBook ? t('pages.books.editTitle') : t('pages.books.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingBook ? t('pages.books.editDesc') : t('pages.books.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <BookForm
            book={editingBook}
            authors={authors}
            publishers={publishers}
            onSubmit={handleSubmit}
            onCancel={() => setIsFormOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
