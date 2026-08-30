/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Library,
  Plus,
  Star,
  Edit,
  Trash2,
  BookMarked,
  FileText,
  Highlighter,
  Loader2,
  MoreHorizontal,
  Download,
  BookText,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  BookOpen,
  Brain,
  CheckCircle,
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const BookReader = lazy(() => import('./BookReader'));

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { BookDetailModal } from '@/components/library/BookDetailModal';
import { BookForm } from '@/components/library/BookForm';
import { HighlightsTab } from '@/components/library/HighlightsTab';
import { ReadingQueueTab } from '@/components/library/ReadingQueueTab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { authorsService } from '@/services/authors-service';
import { booksService } from '@/services/books-service';
import { membersService } from '@/services/members-service';
import { publishersService } from '@/services/publishers-service';
import { readingsService } from '@/services/readings-service';
import type { Book, BookFormData, Author, Publisher } from '@/types';
import { BOOK_GENRES, READ_STATUS } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const PAGE_SIZE = 20;

type DetailTab = 'info' | 'highlights' | 'readings' | 'summaries';
type ViewMode = 'table' | 'grid';

const GENRE_COLORS: Record<string, string> = {
  Fiction: 'from-violet-500 to-purple-600',
  NonFiction: 'from-blue-500 to-cyan-600',
  Fantasy: 'from-emerald-500 to-teal-600',
  SciFi: 'from-sky-500 to-indigo-600',
  Mystery: 'from-slate-500 to-gray-600',
  Thriller: 'from-red-500 to-rose-600',
  Romance: 'from-pink-500 to-fuchsia-600',
  Horror: 'from-gray-700 to-zinc-800',
  Historical: 'from-amber-500 to-orange-600',
  Biography: 'from-yellow-500 to-amber-600',
  SelfHelp: 'from-lime-500 to-green-600',
  Science: 'from-cyan-500 to-blue-600',
  Philosophy: 'from-indigo-500 to-violet-600',
  Psychology: 'from-teal-500 to-cyan-600',
  Economics: 'from-orange-500 to-amber-600',
  Politics: 'from-blue-600 to-indigo-700',
  Art: 'from-fuchsia-500 to-pink-600',
  Poetry: 'from-rose-400 to-pink-500',
  Comics: 'from-yellow-400 to-orange-500',
  Other: 'from-stone-400 to-slate-500',
};

function genreGradient(genre: string): string {
  return GENRE_COLORS[genre] ?? 'from-stone-400 to-slate-500';
}

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
  priority: number | null,
  t: (key: string) => string
): { label: string; variant: 'destructive' | 'warning' | 'secondary' } | null => {
  if (priority === null) return null;
  if (priority === 1)
    return { label: t('pages.books.priorityHigh'), variant: 'destructive' };
  if (priority <= 3)
    return { label: t('pages.books.priorityMedium'), variant: 'warning' };
  return { label: t('pages.books.priorityLow'), variant: 'secondary' };
};

function StarRow({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? 'fill-star text-star' : 'fill-muted text-muted'}`}
        />
      ))}
    </div>
  );
}

function BookCoverPlaceholder({ title, genre }: { title: string; genre: string }) {
  const initial = title.charAt(0).toUpperCase();
  const gradient = genreGradient(genre);
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-md bg-gradient-to-br ${gradient}`}
    >
      <span className="text-4xl font-bold text-white/90 select-none">{initial}</span>
    </div>
  );
}

function BookGridCard({
  book,
  onOpen,
  onEdit,
  onDelete,
  onOpenDetail,
  onOpenReader,
  onAskIntellect,
}: {
  book: Book;
  onOpen: (b: Book, tab: DetailTab) => void;
  onEdit: (b: Book) => void;
  onDelete: (id: number) => void;
  onOpenDetail: (b: Book) => void;
  onOpenReader: (b: Book) => void;
  onAskIntellect: (b: Book) => void;
}) {
  const { t } = useTranslation();
  const pb = priorityBadge(book.reading_priority, t);

  return (
    <div
      role="button"
      tabIndex={0}
      className="group bg-card flex cursor-pointer flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onOpenDetail(book)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenDetail(book);
      }}
    >
      {/* Cover */}
      <div className="bg-muted relative aspect-[2/3] w-full overflow-hidden">
        {book.cover ? (
          <img
            src={book.cover}
            alt={t('pages.books.coverAlt', { title: book.title })}
            className="hoverable:group-hover:scale-105 h-full w-full object-cover transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <BookCoverPlaceholder title={book.title} genre={book.genre} />
        )}
        <div className="absolute top-2 right-2">
          <Badge variant={statusVariant(book.read_status)} className="text-xs shadow">
            {t('pages.books.readStatuses.' + book.read_status, {
              defaultValue: book.read_status_display,
            })}
          </Badge>
        </div>
        {pb && (
          <div className="absolute top-2 left-2">
            <Badge variant={pb.variant} className="text-xs shadow">
              {pb.label}
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="gap-xs flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm leading-tight font-semibold">{book.title}</p>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {book.authors_names.join(', ')}
        </p>
        <Badge variant="secondary" className="mt-xs w-fit text-xs">
          {t('pages.books.genres.' + book.genre, { defaultValue: book.genre_display })}
        </Badge>

        {book.reading_progress > 0 && (
          <div className="gap-sm pt-sm mt-auto flex items-center">
            <Progress value={book.reading_progress} className="h-1.5 flex-1" />
            <span className="text-muted-foreground text-xs">
              {book.reading_progress}%
            </span>
          </div>
        )}

        {book.rating && (
          <div className="mt-xs">
            <StarRow rating={book.rating} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        role="presentation"
        className="gap-xs px-sm py-xs flex items-center justify-end border-t"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={t('pages.books.moreOptions')}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {book.media_type === 'Dig' && book.book_file && (
              <DropdownMenuItem onClick={() => onOpenReader(book)}>
                <BookText className="mr-sm h-4 w-4" />
                {t('pages.books.openReader')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onOpen(book, 'readings')}>
              <BookMarked className="mr-sm h-4 w-4" />
              {t('pages.readings.title')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpen(book, 'summaries')}
              disabled={book.read_status !== 'read'}
            >
              <FileText className="mr-sm h-4 w-4" />
              {t('pages.summaries.title')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpen(book, 'highlights')}>
              <Highlighter className="mr-sm h-4 w-4" />
              {t('pages.highlights.title')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAskIntellect(book)}>
              <Brain className="mr-sm h-4 w-4" />
              {t('pages.books.askIntellect')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(book)}
          title={t('common.actions.edit')}
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive h-7 w-7"
          onClick={() => void onDelete(book.id)}
          title={t('common.actions.delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function Books() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [activeTab, setActiveTab] = useState<'books' | 'reading-queue' | 'highlights'>(
    'books'
  );
  const [isHighlightCreateOpen, setIsHighlightCreateOpen] = useState(false);

  // Form dialog (create / edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail modal
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>('info');

  // Inline reader modal
  const [readerBookId, setReaderBookId] = useState<number | null>(null);

  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureBookId, setQuickCaptureBookId] = useState<number | ''>('');
  const [quickCapturePages, setQuickCapturePages] = useState('');

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const ownerId = member?.id ?? 0;

  const { data: booksData, isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      try {
        const [booksData, authorsData, publishersData] = await Promise.all([
          booksService.getAll(),
          authorsService.getAll(),
          publishersService.getAll(),
        ]);
        return { books: booksData, authors: authorsData, publishers: publishersData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return {
          books: [] as Book[],
          authors: [] as Author[],
          publishers: [] as Publisher[],
        };
      }
    },
  });
  const books = booksData?.books ?? [];
  const authors = booksData?.authors ?? [];
  const publishers = booksData?.publishers ?? [];

  const quickCaptureMutation = useMutation({
    mutationFn: (data: { book: number; pages_read: number }) =>
      readingsService.create({
        book: data.book,
        reading_date: new Date().toISOString().split('T')[0],
        reading_time: 0,
        pages_read: data.pages_read,
        owner: ownerId,
      }),
    onSuccess: () => {
      toast({ title: t('pages.books.quickCapture.saved') });
      setIsQuickCaptureOpen(false);
      setQuickCaptureBookId('');
      setQuickCapturePages('');
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleQuickCapture = () => {
    const bookId = Number(quickCaptureBookId);
    const pages = Number(quickCapturePages);
    if (!bookId || !pages || pages <= 0) return;
    quickCaptureMutation.mutate({ book: bookId, pages_read: pages });
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
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (
    data: BookFormData,
    coverFile?: File | null,
    bookFile?: File | null,
    alreadyRead?: boolean,
    startDate?: string,
    endDate?: string
  ) => {
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
      if (bookFile && data.media_type === 'Dig') {
        await booksService.uploadBookFile(saved.id, bookFile);
      }
      if (alreadyRead && startDate && endDate) {
        const result = await booksService.markAsRead(saved.id, startDate, endDate);
        toast({
          title: t('pages.books.readingRegistered'),
          description: t('pages.books.sessionsCreated', {
            count: result.sessions_created,
          }),
        });
      }
      setIsFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['books'] });
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

  const handleDownloadFile = async (book: Book) => {
    try {
      const { url } = await booksService.getBookFileUrl(book.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = book.title;
      a.target = '_blank';
      a.click();
    } catch (error: unknown) {
      toast({
        title: t('pages.books.downloadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleOpenReader = (book: Book) => {
    setReaderBookId(book.id);
  };

  const handleAskIntellect = (book: Book) => {
    const context = encodeURIComponent(`Livro: ${book.title}`);
    void navigate(`/agents?context=${context}`);
  };

  const STATUS_ORDER: Record<string, number> = { reading: 0, to_read: 1, read: 2 };

  const filteredBooks = books
    .filter((book) => {
      if (filterStatus && book.read_status !== filterStatus) return false;
      if (filterGenre && book.genre !== filterGenre) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          book.title.toLowerCase().includes(q) ||
          book.authors_names.some((a) => a.toLowerCase().includes(q)) ||
          book.publisher_name.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const statusDiff =
        (STATUS_ORDER[a.read_status] ?? 3) - (STATUS_ORDER[b.read_status] ?? 3);
      if (statusDiff !== 0) return statusDiff;
      if (a.reading_priority === null && b.reading_priority === null) return 0;
      if (a.reading_priority === null) return 1;
      if (b.reading_priority === null) return -1;
      return a.reading_priority - b.reading_priority;
    });

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedBooks = filteredBooks.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleFilterChange = () => setCurrentPage(1);

  return (
    <PageContainer>
      <PageHeader title={t('pages.books.title')} icon={<Library />}>
        {activeTab === 'books' && (
          <div className="gap-sm flex items-center">
            <div className="flex items-center rounded-md border">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-r-none border-r"
                onClick={() => setViewMode('table')}
                title={t('pages.books.listView')}
                aria-label={t('pages.books.listView')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setViewMode('grid')}
                title={t('pages.books.gridView')}
                aria-label={t('pages.books.gridView')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="mr-sm h-4 w-4" />
              {t('pages.books.newBtn')}
            </Button>
          </div>
        )}
        {activeTab === 'highlights' && (
          <Button onClick={() => setIsHighlightCreateOpen(true)}>
            <Plus className="mr-sm h-4 w-4" />
            {t('pages.highlights.newBtn')}
          </Button>
        )}
      </PageHeader>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as 'books' | 'reading-queue' | 'highlights')
        }
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="books" className="gap-xs flex-1">
            <Library className="h-4 w-4" />
            {t('nav.items.books')}
          </TabsTrigger>
          <TabsTrigger value="reading-queue" className="gap-xs flex-1">
            <BookMarked className="h-4 w-4" />
            {t('nav.items.readingQueue')}
          </TabsTrigger>
          <TabsTrigger value="highlights" className="gap-xs flex-1">
            <Highlighter className="h-4 w-4" />
            {t('nav.items.highlights')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="books" className="mt-0">
          {isLoading ? (
            <LoadingState />
          ) : (
            <>
              <FilterBar
                hasActiveFilters={!!(searchTerm || filterStatus || filterGenre)}
                onClear={() => {
                  setSearchTerm('');
                  setFilterStatus('');
                  setFilterGenre('');
                  handleFilterChange();
                }}
              >
                <SearchInput
                  placeholder={t('pages.books.searchPlaceholder')}
                  value={searchTerm}
                  onValueChange={(v) => {
                    setSearchTerm(v);
                    handleFilterChange();
                  }}
                  className="w-44 flex-none"
                />
                <Select
                  value={filterStatus || 'all'}
                  onValueChange={(v) => {
                    setFilterStatus(v === 'all' ? '' : v);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger
                    className="w-36"
                    startIcon={<BookOpen className="h-3.5 w-3.5" />}
                  >
                    <SelectValue placeholder={t('pages.books.statusPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pages.books.allStatuses')}</SelectItem>
                    {READ_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {t(`pages.books.readStatuses.${s.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filterGenre || 'all'}
                  onValueChange={(v) => {
                    setFilterGenre(v === 'all' ? '' : v);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger
                    className="w-36"
                    startIcon={<Library className="h-3.5 w-3.5" />}
                  >
                    <SelectValue placeholder={t('pages.books.genrePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pages.books.allGenres')}</SelectItem>
                    {BOOK_GENRES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {t(`pages.books.genres.${g.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterBar>

              {filteredBooks.length === 0 ? (
                <EmptyState
                  icon={<Library className="text-muted-foreground h-12 w-12" />}
                  message={
                    searchTerm
                      ? t('pages.books.emptySearch')
                      : t('pages.books.emptyState')
                  }
                />
              ) : viewMode === 'grid' ? (
                <div className="gap-md grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {pagedBooks.map((book) => (
                    <BookGridCard
                      key={book.id}
                      book={book}
                      onOpen={openDetail}
                      onEdit={handleEdit}
                      onDelete={(id) => void handleDelete(id)}
                      onOpenDetail={(b) => openDetail(b, 'info')}
                      onOpenReader={handleOpenReader}
                      onAskIntellect={handleAskIntellect}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">
                          {t('pages.books.colCover')}
                        </TableHead>
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
                      {pagedBooks.map((book) => {
                        const pb = priorityBadge(book.reading_priority, t);
                        return (
                          <TableRow
                            key={book.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => openDetail(book, 'info')}
                          >
                            {/* Cover — compact in table view */}
                            <TableCell className="py-sm">
                              <div className="h-20 w-14 overflow-hidden rounded-md shadow-sm">
                                {book.cover ? (
                                  <img
                                    src={book.cover}
                                    alt={t('pages.books.coverAlt', {
                                      title: book.title,
                                    })}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <BookCoverPlaceholder
                                    title={book.title}
                                    genre={book.genre}
                                  />
                                )}
                              </div>
                            </TableCell>

                            {/* Title + priority */}
                            <TableCell>
                              <p className="leading-tight font-semibold">
                                {book.title}
                              </p>
                              {pb && (
                                <Badge variant={pb.variant} className="mt-xs text-xs">
                                  {pb.label}
                                </Badge>
                              )}
                            </TableCell>

                            {/* Authors */}
                            <TableCell className="text-muted-foreground hidden max-w-[160px] truncate text-sm md:table-cell">
                              {book.authors_names.join(', ')}
                            </TableCell>

                            {/* Publisher */}
                            <TableCell className="text-muted-foreground hidden max-w-[120px] truncate text-sm lg:table-cell">
                              {book.publisher_name}
                            </TableCell>

                            {/* Genre */}
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="secondary" className="text-xs">
                                {t('pages.books.genres.' + book.genre, {
                                  defaultValue: book.genre_display,
                                })}
                              </Badge>
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <Badge
                                variant={statusVariant(book.read_status)}
                                className="text-xs"
                              >
                                {t('pages.books.readStatuses.' + book.read_status, {
                                  defaultValue: book.read_status_display,
                                })}
                              </Badge>
                            </TableCell>

                            {/* Pages */}
                            <TableCell className="text-muted-foreground hidden text-right text-sm lg:table-cell">
                              {book.pages}p
                            </TableCell>

                            {/* Rating */}
                            <TableCell className="hidden md:table-cell">
                              <StarRow rating={book.rating} />
                            </TableCell>

                            {/* Progress */}
                            <TableCell className="hidden sm:table-cell">
                              {book.reading_progress > 0 ? (
                                <div className="gap-sm flex items-center">
                                  <Progress
                                    value={book.reading_progress}
                                    className="h-2 w-28"
                                  />
                                  <span className="text-muted-foreground text-xs">
                                    {book.reading_progress}%
                                  </span>
                                </div>
                              ) : null}
                            </TableCell>

                            {/* Actions */}
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              className="py-sm"
                            >
                              <div className="gap-xs flex">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title={t('pages.books.moreOptions')}
                                      aria-label={t('pages.books.moreOptions')}
                                    >
                                      <MoreHorizontal
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {book.media_type === 'Dig' && book.book_file && (
                                      <DropdownMenuItem
                                        onClick={() => handleOpenReader(book)}
                                      >
                                        <BookText className="mr-sm h-4 w-4" />
                                        {t('pages.books.openReader')}
                                      </DropdownMenuItem>
                                    )}
                                    {book.media_type === 'Dig' && book.book_file && (
                                      <DropdownMenuItem
                                        onClick={() => void handleDownloadFile(book)}
                                      >
                                        <Download className="mr-sm h-4 w-4" />
                                        {t('pages.books.downloadFile')}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => openDetail(book, 'readings')}
                                    >
                                      <BookMarked className="mr-sm h-4 w-4" />
                                      {t('pages.readings.title')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => openDetail(book, 'summaries')}
                                      disabled={book.read_status !== 'read'}
                                    >
                                      <FileText className="mr-sm h-4 w-4" />
                                      {t('pages.summaries.title')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => openDetail(book, 'highlights')}
                                    >
                                      <Highlighter className="mr-sm h-4 w-4" />
                                      {t('pages.highlights.title')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleAskIntellect(book)}
                                    >
                                      <Brain className="mr-sm h-4 w-4" />
                                      {t('pages.books.askIntellect')}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="text-muted-foreground flex items-center justify-between text-sm">
                  <span>
                    {t('pages.books.paginationInfo', {
                      count: filteredBooks.length,
                      total: filteredBooks.length,
                      page: safePage,
                      totalPages,
                    })}
                  </span>
                  <div className="gap-xs flex items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="reading-queue" className="mt-0">
          <ReadingQueueTab />
        </TabsContent>

        <TabsContent value="highlights" className="mt-0">
          <HighlightsTab
            isCreateOpen={isHighlightCreateOpen}
            onCreateClose={() => setIsHighlightCreateOpen(false)}
          />
        </TabsContent>
      </Tabs>

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
        onAskIntellect={(book) => {
          setIsDetailOpen(false);
          handleAskIntellect(book);
        }}
      />

      {/* Create / Edit form dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="custom-scrollbar max-w-3xl">
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

      {/* Quick Capture FAB — offset left of the shared bottom-right corner
          (right-24 instead of right-6) so it doesn't sit under the global
          StudyTimer trigger, which anchors at bottom-6 right-6. */}
      {activeTab === 'books' && (
        <button
          onClick={() => setIsQuickCaptureOpen(true)}
          className="gap-sm bg-primary px-md text-primary-foreground fixed right-24 bottom-6 z-40 flex items-center rounded-full py-3 text-sm font-semibold shadow-lg transition-shadow hover:shadow-xl"
          aria-label={t('pages.books.quickCapture.title')}
        >
          <CheckCircle className="h-4 w-4" />
          {t('pages.books.quickCapture.title')}
        </button>
      )}

      {/* Quick Capture Dialog */}
      <Dialog open={isQuickCaptureOpen} onOpenChange={setIsQuickCaptureOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <BookOpen className="text-primary h-4 w-4" />
              {t('pages.books.quickCapture.title')}
            </DialogTitle>
            <DialogDescription>{t('pages.books.quickCapture.desc')}</DialogDescription>
          </DialogHeader>
          <div className="gap-md py-sm flex flex-col">
            <div className="gap-xs flex flex-col">
              <Label htmlFor="qc-book">
                {t('pages.books.quickCapture.selectBook')}
              </Label>
              <Select
                value={quickCaptureBookId === '' ? 'none' : String(quickCaptureBookId)}
                onValueChange={(v) =>
                  setQuickCaptureBookId(v === 'none' ? '' : Number(v))
                }
              >
                <SelectTrigger id="qc-book">
                  <SelectValue
                    placeholder={t('pages.books.quickCapture.selectBookPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {books
                    .filter((b) => b.read_status === 'reading')
                    .map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="gap-xs flex flex-col">
              <Label htmlFor="qc-pages">
                {t('pages.books.quickCapture.pagesRead')}
              </Label>
              <Input
                id="qc-pages"
                type="number"
                min={1}
                value={quickCapturePages}
                onChange={(e) => setQuickCapturePages(e.target.value)}
                placeholder={t('pages.books.quickCapture.pagesPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickCaptureOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={handleQuickCapture}
              disabled={
                !quickCaptureBookId ||
                !quickCapturePages ||
                Number(quickCapturePages) <= 0 ||
                quickCaptureMutation.isPending
              }
            >
              {quickCaptureMutation.isPending ? (
                <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              ) : null}
              {t('common.actions.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen reader overlay */}
      {readerBookId !== null && (
        <div className="fixed inset-0 z-50">
          <Suspense
            fallback={
              <div className="bg-background flex h-full items-center justify-center">
                <Loader2 className="text-muted-foreground h-10 w-10 animate-spin" />
              </div>
            }
          >
            <BookReader
              bookIdProp={readerBookId}
              onClose={() => setReaderBookId(null)}
            />
          </Suspense>
        </div>
      )}
    </PageContainer>
  );
}
