import {
  BookOpen,
  Plus,
  Star,
  Edit,
  Trash2,
  BookMarked,
  FileText,
  Highlighter,
  MoreHorizontal,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { authorsService } from '@/services/authors-service';
import { booksService } from '@/services/books-service';
import { publishersService } from '@/services/publishers-service';
import type { Book, BookFormData, Author, Publisher } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type DetailTab = 'info' | 'highlights' | 'readings' | 'summaries';

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

const priorityBadge = (
  priority: number | null
): { label: string; variant: 'destructive' | 'warning' | 'secondary' } | null => {
  if (priority === null) return null;
  if (priority === 1) return { label: 'Alta', variant: 'destructive' };
  if (priority <= 3) return { label: 'Média', variant: 'warning' };
  return { label: 'Baixa', variant: 'secondary' };
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

  // Detail modal
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>('info');

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

  const openDetail = (book: Book, tab: DetailTab = 'info') => {
    setDetailBook(book);
    setDetailInitialTab(tab);
    setIsDetailOpen(true);
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

  const STATUS_ORDER: Record<string, number> = { reading: 0, to_read: 1, read: 2 };

  // Sort: by read_status first (reading → to_read → read), then by reading_priority ascending (null last)
  const filteredBooks = books
    .filter(
      (book) =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.authors_names.some((a) =>
          a.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        book.publisher_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const statusDiff =
        (STATUS_ORDER[a.read_status] ?? 3) - (STATUS_ORDER[b.read_status] ?? 3);
      if (statusDiff !== 0) return statusDiff;
      if (a.reading_priority === null && b.reading_priority === null) return 0;
      if (a.reading_priority === null) return 1;
      if (b.reading_priority === null) return -1;
      return a.reading_priority - b.reading_priority;
    });

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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-50">{t('pages.books.colCover')}</TableHead>
                <TableHead>{t('pages.books.colTitle')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('pages.books.colAuthors')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('pages.books.colPublisher')}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('pages.books.colGenre')}
                </TableHead>
                <TableHead>{t('pages.books.colStatus')}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">
                  {t('pages.books.colPages')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('pages.books.colRating')}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('pages.books.colProgress')}
                </TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBooks.map((book) => {
                const pb = priorityBadge(book.reading_priority);
                return (
                  <TableRow
                    key={book.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(book, 'info')}
                  >
                    {/* Cover */}
                    <TableCell className="py-2">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={`Capa de ${book.title}`}
                          className="w-50 h-64 rounded-md object-cover shadow-md"
                        />
                      ) : (
                        <div className="w-50 flex h-64 items-center justify-center rounded-md border bg-muted shadow-sm">
                          <BookOpen className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>

                    {/* Title + priority */}
                    <TableCell>
                      <p className="font-semibold leading-tight">{book.title}</p>
                      {pb && (
                        <Badge variant={pb.variant} className="mt-1 text-xs">
                          {pb.label}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Authors */}
                    <TableCell className="hidden max-w-[160px] truncate text-sm text-muted-foreground md:table-cell">
                      {book.authors_names.join(', ')}
                    </TableCell>

                    {/* Publisher */}
                    <TableCell className="hidden max-w-[120px] truncate text-sm text-muted-foreground lg:table-cell">
                      {book.publisher_name}
                    </TableCell>

                    {/* Genre */}
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">
                        {book.genre_display}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant={statusVariant(book.read_status)}
                        className="text-xs"
                      >
                        {book.read_status_display}
                      </Badge>
                    </TableCell>

                    {/* Pages */}
                    <TableCell className="hidden text-right text-sm text-muted-foreground lg:table-cell">
                      {book.pages}p
                    </TableCell>

                    {/* Rating */}
                    <TableCell className="hidden md:table-cell">
                      <StarRow rating={book.rating} />
                    </TableCell>

                    {/* Progress */}
                    <TableCell className="hidden sm:table-cell">
                      {book.reading_progress > 0 ? (
                        <div className="flex items-center gap-2">
                          <Progress
                            value={book.reading_progress}
                            className="h-1.5 w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            {book.reading_progress}%
                          </span>
                        </div>
                      ) : null}
                    </TableCell>

                    {/* Actions */}
                    <TableCell onClick={(e) => e.stopPropagation()} className="py-2">
                      <div className="flex gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Mais opções"
                              aria-label="Mais opções"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openDetail(book, 'readings')}
                            >
                              <BookMarked className="mr-2 h-4 w-4" />
                              {t('pages.readings.title')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDetail(book, 'summaries')}
                              disabled={book.read_status !== 'read'}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              {t('pages.summaries.title')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDetail(book, 'highlights')}
                            >
                              <Highlighter className="mr-2 h-4 w-4" />
                              Destaques
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(book)}
                          title={t('common.actions.edit')}
                          aria-label={t('common.actions.edit')}
                        >
                          <Edit className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => void handleDelete(book.id)}
                          title={t('common.actions.delete')}
                          aria-label={t('common.actions.delete')}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Book detail modal */}
      <BookDetailModal
        book={detailBook}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        initialTab={detailInitialTab}
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
