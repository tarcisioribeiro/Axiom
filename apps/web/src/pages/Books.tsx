/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookMarked,
  BookOpen,
  BookText,
  Brain,
  CheckCircle2,
  Download,
  FileText,
  Highlighter,
  LayoutGrid,
  Library,
  List,
  Plus,
  Search,
  Star,
  Target,
  Tag,
} from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

const BookReader = lazy(() => import('./BookReader'));

import { Can } from '@/components/common/Can';
import { CardActions, type CardMenuAction } from '@/components/common/CardActions';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import {
  GRID_PAGE_SIZE,
  LIST_PAGE_SIZE,
  PaginatedSlide,
} from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { ViewModeToggle } from '@/components/common/ViewModeToggle';
import { BookDetailModal } from '@/components/library/BookDetailModal';
import { BookForm } from '@/components/library/BookForm';
import { HighlightsTab } from '@/components/library/HighlightsTab';
import { ReadingGoalsDialog } from '@/components/library/ReadingGoalsDialog';
import { ReadingQueueTab } from '@/components/library/ReadingQueueTab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { BOOK_GENRE_ICONS, READ_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useTabRoute } from '@/hooks/use-tab-route';
import { useToast } from '@/hooks/use-toast';
import { ValidationError } from '@/services/api-errors';
import { authorsService } from '@/services/authors-service';
import { bookHighlightsService } from '@/services/book-highlights-service';
import { booksService } from '@/services/books-service';
import { publishersService } from '@/services/publishers-service';
import type { Book, BookFormData, Author, Publisher } from '@/types';
import { BOOK_GENRES, READ_STATUS } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type DetailTab = 'info' | 'highlights' | 'readings' | 'summaries';
type ViewMode = 'table' | 'grid';

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

/** Capa do livro (ou ícone neutro quando não há capa). */
function BookCover({ book, className }: { book: Book; className: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={`bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md border ${className}`}
    >
      {book.cover ? (
        <img
          src={book.cover}
          alt={t('pages.books.coverAlt', { title: book.title })}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <BookOpen className="text-muted-foreground h-5 w-5" aria-hidden="true" />
      )}
    </div>
  );
}

function StatusBadge({ book }: { book: Book }) {
  const { t } = useTranslation();
  const StatusIcon = READ_STATUS_ICONS[book.read_status];
  return (
    <Badge
      variant={statusVariant(book.read_status)}
      className="gap-xs shrink-0 text-xs"
    >
      {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {t(`pages.books.readStatuses.${book.read_status}`, {
        defaultValue: book.read_status_display,
      })}
    </Badge>
  );
}

/**
 * Card de grade (§5): capa + título + autores (1 linha) + progresso (métrica) +
 * status. Gênero, prioridade, nota e demais dados ficam no modal de detalhe.
 */
function BookGridCard({
  book,
  menuActions,
  onEdit,
  onDelete,
  onOpenDetail,
}: {
  book: Book;
  menuActions: CardMenuAction[];
  onEdit: () => void;
  onDelete: () => void;
  onOpenDetail: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="bg-card border-border flex cursor-pointer flex-col rounded-lg border"
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenDetail();
      }}
    >
      <div className="gap-sm px-md py-sm flex flex-1 items-center">
        <BookCover book={book} className="h-14 w-10" />
        <div className="space-y-xs min-w-0 flex-1">
          <div className="gap-sm flex items-start justify-between">
            <p className="truncate text-sm font-semibold" title={book.title}>
              {book.title}
            </p>
            <StatusBadge book={book} />
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {book.authors_names.join(', ')}
          </p>
          <div className="gap-sm flex items-center">
            <Progress value={book.reading_progress} className="h-1.5 flex-1" />
            <span className="text-muted-foreground text-xs">
              {book.reading_progress}%
            </span>
          </div>
        </div>
      </div>
      <div
        role="presentation"
        className="gap-xs px-sm py-xs flex items-center justify-end border-t"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <CardActions onEdit={onEdit} onDelete={onDelete} menuActions={menuActions} />
      </div>
    </div>
  );
}

const TABS = ['books', 'reading-queue', 'highlights'] as const;

const TAB_HEADERS: Record<
  (typeof TABS)[number],
  { titleKey: string; icon: ReactNode }
> = {
  books: { titleKey: 'pages.books.title', icon: <Library /> },
  'reading-queue': { titleKey: 'nav.items.readingQueue', icon: <BookMarked /> },
  highlights: { titleKey: 'nav.items.highlights', icon: <Highlighter /> },
};

export default function Books() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [activeTab, setActiveTab] = useTabRoute('/library/books', TABS, 'books');
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

  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [isExportingHighlights, setIsExportingHighlights] = useState(false);

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: booksData, isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      try {
        const [booksData, authorsData, publishersData] = await Promise.all([
          booksService.getAllPages(),
          authorsService.getAllPages(),
          publishersService.getAllPages(),
        ]);
        return { books: booksData, authors: authorsData, publishers: publishersData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(error) }),
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

  const handleExportHighlights = async () => {
    try {
      setIsExportingHighlights(true);
      const blob = await bookHighlightsService.exportMarkdown();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('pages.highlights.exportFileName')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast({
        title: t('pages.highlights.exportError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsExportingHighlights(false);
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
        title: t('pages.books.noPrerequisitesMsg'),
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
      });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
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
        });
      } else {
        saved = await booksService.create(data);
        toast({
          title: t('pages.books.created'),
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
          title: t('pages.books.sessionsCreated', {
            count: result.sessions_created,
          }),
        });
      }
      setIsFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    } catch (error: unknown) {
      // Título duplicado: o BookForm marca o campo e mostra o toast (§3).
      if (error instanceof ValidationError && error.errors.title) throw error;
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
        title: t('pages.books.downloadError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleOpenReader = (book: Book) => {
    setReaderBookId(book.id);
  };

  const handleAskIntellect = (book: Book) => {
    const context = encodeURIComponent(
      t('pages.books.agentContext', { title: book.title })
    );
    void navigate(`/agents?context=${context}`);
  };

  const bookMenuActions = (book: Book): CardMenuAction[] => [
    ...(book.media_type === 'Dig' && book.book_file
      ? [
          {
            icon: BookText,
            label: t('pages.books.openReader'),
            onClick: () => handleOpenReader(book),
            color: 'preview' as const,
          },
          {
            icon: Download,
            label: t('pages.books.downloadFile'),
            onClick: () => void handleDownloadFile(book),
            color: 'download' as const,
          },
        ]
      : []),
    {
      icon: BookMarked,
      label: t('pages.readings.title'),
      onClick: () => openDetail(book, 'readings'),
      color: 'progress',
    },
    {
      icon: FileText,
      label: t('pages.summaries.title'),
      onClick: () => openDetail(book, 'summaries'),
      color: 'plan',
      disabled: book.read_status !== 'read',
    },
    {
      icon: Highlighter,
      label: t('pages.highlights.title'),
      onClick: () => openDetail(book, 'highlights'),
      color: 'plan',
    },
    {
      icon: Brain,
      label: t('pages.books.askIntellect'),
      onClick: () => handleAskIntellect(book),
      color: 'chat',
    },
  ];

  const bookColumns: Column<Book>[] = [
    {
      key: 'cover',
      label: t('pages.books.colCover'),
      className: 'w-14',
      render: (book) => <BookCover book={book} className="h-12 w-9" />,
    },
    {
      key: 'title',
      label: t('pages.books.colTitle'),
      render: (book) => {
        const pb = priorityBadge(book.reading_priority, t);
        return (
          <div className="min-w-0">
            <p className="max-w-56 truncate font-semibold" title={book.title}>
              {book.title}
            </p>
            {pb && (
              <Badge variant={pb.variant} className="mt-xs text-xs">
                {pb.label}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'authors',
      label: t('pages.books.colAuthors'),
      render: (book) => (
        <div
          className="text-muted-foreground max-w-40 truncate text-sm"
          title={book.authors_names.join(', ')}
        >
          {book.authors_names.join(', ')}
        </div>
      ),
    },
    {
      key: 'genre',
      label: t('pages.books.colGenre'),
      render: (book) => (
        <Badge variant="secondary" className="text-xs">
          {t(`pages.books.genres.${book.genre}`, { defaultValue: book.genre_display })}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: t('pages.books.colStatus'),
      render: (book) => <StatusBadge book={book} />,
    },
    {
      key: 'pages',
      label: t('pages.books.colPages'),
      align: 'right',
      render: (book) => (
        <span className="text-muted-foreground text-sm">
          {t('pages.books.detail.pagesCount', { count: book.pages })}
        </span>
      ),
    },
    {
      key: 'rating',
      label: t('pages.books.colRating'),
      render: (book) => <StarRow rating={book.rating} />,
    },
    {
      key: 'progress',
      label: t('pages.books.colProgress'),
      render: (book) => (
        <div className="gap-sm flex items-center">
          <Progress value={book.reading_progress} className="h-2 w-24" />
          <span className="text-muted-foreground text-xs">
            {book.reading_progress}%
          </span>
        </div>
      ),
    },
  ];

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

  return (
    <PageContainer>
      <PageHeader
        title={t(TAB_HEADERS[activeTab].titleKey)}
        icon={TAB_HEADERS[activeTab].icon}
      >
        {activeTab === 'books' && (
          <div className="gap-sm flex items-center">
            <ViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'table', label: t('pages.books.listView'), icon: List },
                { value: 'grid', label: t('pages.books.gridView'), icon: LayoutGrid },
              ]}
            />
            <Button variant="outline" onClick={() => setIsGoalsOpen(true)}>
              <Target className="h-4 w-4" />
              {t('pages.books.readingGoalBtn')}
            </Button>
            <Can action="add">
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                {t('pages.books.newBtn')}
              </Button>
            </Can>
          </div>
        )}
        {activeTab === 'highlights' && (
          <div className="gap-sm flex items-center">
            <Can action="export">
              <Button
                variant="outline"
                onClick={() => void handleExportHighlights()}
                loading={isExportingHighlights}
              >
                {!isExportingHighlights && <Download className="h-4 w-4" />}
                {t('pages.highlights.exportBtn')}
              </Button>
            </Can>
            <Can action="add">
              <Button onClick={() => setIsHighlightCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('pages.highlights.newBtn')}
              </Button>
            </Can>
          </div>
        )}
      </PageHeader>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof TABS)[number])}
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
            <div className="space-y-lg">
              <FilterBar
                hasActiveFilters={!!(searchTerm || filterStatus || filterGenre)}
                onClear={() => {
                  setSearchTerm('');
                  setFilterStatus('');
                  setFilterGenre('');
                }}
              >
                <FilterField label={t('common.filterLabels.search')} icon={Search}>
                  <SearchInput
                    placeholder={t('pages.books.searchPlaceholder')}
                    value={searchTerm}
                    onValueChange={(v) => {
                      setSearchTerm(v);
                    }}
                    className="w-44 flex-none"
                  />
                </FilterField>
                <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
                  <Select
                    value={filterStatus || 'all'}
                    onValueChange={(v) => {
                      setFilterStatus(v === 'all' ? '' : v);
                    }}
                  >
                    <SelectTrigger
                      className="w-36"
                      startIcon={<BookOpen className="h-3.5 w-3.5" />}
                    >
                      <SelectValue placeholder={t('pages.books.statusPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('pages.books.allStatuses')}
                      </SelectItem>
                      {READ_STATUS.map((s) => {
                        const StatusIcon = READ_STATUS_ICONS[s.value];
                        return (
                          <SelectItem
                            key={s.value}
                            value={s.value}
                            icon={
                              StatusIcon ? (
                                <StatusIcon className="h-4 w-4" />
                              ) : undefined
                            }
                          >
                            {t(`pages.books.readStatuses.${s.value}`)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label={t('common.filterLabels.genre')} icon={Tag}>
                  <Select
                    value={filterGenre || 'all'}
                    onValueChange={(v) => {
                      setFilterGenre(v === 'all' ? '' : v);
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
                      {BOOK_GENRES.map((g) => {
                        const GenreIcon = BOOK_GENRE_ICONS[g.value];
                        return (
                          <SelectItem
                            key={g.value}
                            value={g.value}
                            icon={
                              GenreIcon ? <GenreIcon className="h-4 w-4" /> : undefined
                            }
                          >
                            {t(`pages.books.genres.${g.value}`)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </FilterField>
              </FilterBar>

              {filteredBooks.length === 0 ? (
                <EmptyState
                  icon={<Library className="text-muted-foreground h-12 w-12" />}
                  title={
                    searchTerm
                      ? t('pages.books.emptySearch')
                      : t('pages.books.emptyState')
                  }
                />
              ) : viewMode === 'grid' ? (
                <PaginatedSlide
                  key={`${searchTerm}-${filterStatus}-${filterGenre}`}
                  items={filteredBooks}
                  pageSize={GRID_PAGE_SIZE}
                  className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                >
                  {(pagedBooks) =>
                    pagedBooks.map((book) => (
                      <BookGridCard
                        key={book.id}
                        book={book}
                        menuActions={bookMenuActions(book)}
                        onEdit={() => handleEdit(book)}
                        onDelete={() => void handleDelete(book.id)}
                        onOpenDetail={() => openDetail(book, 'info')}
                      />
                    ))
                  }
                </PaginatedSlide>
              ) : (
                <DataTable
                  key={`${searchTerm}-${filterStatus}-${filterGenre}`}
                  data={filteredBooks}
                  columns={bookColumns}
                  keyExtractor={(book) => book.id}
                  pageSize={LIST_PAGE_SIZE}
                  onRowClick={(book) => openDetail(book, 'info')}
                  actions={(book) => (
                    <div className="gap-xs flex items-center justify-center">
                      <CardActions
                        onEdit={() => handleEdit(book)}
                        onDelete={() => void handleDelete(book.id)}
                        menuActions={bookMenuActions(book)}
                      />
                    </div>
                  )}
                />
              )}
            </div>
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
      />

      {/* Create / Edit form dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle mode={editingBook ? 'edit' : 'create'}>
              {editingBook ? t('pages.books.editTitle') : t('pages.books.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {editingBook ? t('pages.books.editDesc') : t('pages.books.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
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

      <ReadingGoalsDialog open={isGoalsOpen} onClose={() => setIsGoalsOpen(false)} />

      {/* Fullscreen reader overlay */}
      <AnimatePresence>
        {readerBookId !== null && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Suspense
              fallback={
                <div className="bg-background h-full">
                  <LoadingState />
                </div>
              }
            >
              <BookReader
                bookIdProp={readerBookId}
                onClose={() => setReaderBookId(null)}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
