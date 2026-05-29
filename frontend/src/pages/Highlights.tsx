/* eslint-disable max-lines */
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Highlighter,
  Lightbulb,
  Plus,
  Quote,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { bookHighlightsService } from '@/services/book-highlights-service';
import { booksService } from '@/services/books-service';
import { membersService } from '@/services/members-service';
import type { Book, BookHighlight, BookHighlightFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

const COLOR_CLASSES: Record<string, { card: string; bar: string; bg: string }> = {
  yellow: {
    card: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20',
    bar: 'bg-yellow-400',
    bg: '#facc15',
  },
  green: {
    card: 'border-green-400 bg-green-50 dark:bg-green-950/20',
    bar: 'bg-green-400',
    bg: '#4ade80',
  },
  blue: {
    card: 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
    bar: 'bg-blue-400',
    bg: '#60a5fa',
  },
  pink: {
    card: 'border-pink-400 bg-pink-50 dark:bg-pink-950/20',
    bar: 'bg-pink-400',
    bg: '#f472b6',
  },
  orange: {
    card: 'border-orange-400 bg-orange-50 dark:bg-orange-950/20',
    bar: 'bg-orange-400',
    bg: '#fb923c',
  },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  quote: <Quote className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
  idea: <Lightbulb className="h-3.5 w-3.5" />,
};

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  quote: 'default',
  note: 'secondary',
  idea: 'outline',
};

const COLOR_OPTION_KEYS = [
  { value: 'yellow', bg: '#facc15' },
  { value: 'green', bg: '#4ade80' },
  { value: 'blue', bg: '#60a5fa' },
  { value: 'pink', bg: '#f472b6' },
  { value: 'orange', bg: '#fb923c' },
];

function HighlightCard({
  highlight,
  bookCover,
  onEdit,
  onDelete,
}: {
  highlight: BookHighlight;
  bookCover?: string | null;
  onEdit: (h: BookHighlight) => void;
  onDelete: (id: number) => void;
}) {
  const colorDef = COLOR_CLASSES[highlight.color] ?? COLOR_CLASSES.yellow;
  const isQuote = highlight.highlight_type === 'quote';

  return (
    <div className={`rounded-lg border-l-4 p-md ${colorDef.card}`}>
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          {/* Type badge with icon */}
          <Badge
            variant={TYPE_VARIANT[highlight.highlight_type] ?? 'default'}
            className="flex items-center gap-xs"
          >
            {TYPE_ICON[highlight.highlight_type]}
            {highlight.highlight_type_display}
          </Badge>

          {highlight.page_number && (
            <span className="rounded bg-background/60 px-sm py-0.5 text-xs text-muted-foreground">
              p. {highlight.page_number}
            </span>
          )}
          {highlight.chapter && (
            <span className="rounded bg-background/60 px-sm py-0.5 text-xs text-muted-foreground">
              {highlight.chapter}
            </span>
          )}
        </div>

        <div className="flex shrink-0 gap-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(highlight)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(highlight.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Text — special typography for quotes */}
      {isQuote ? (
        <blockquote className="relative pl-md">
          <span
            className="absolute left-0 top-0 select-none font-serif text-3xl leading-none text-muted-foreground/40"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <p className="text-sm italic leading-relaxed">{highlight.text}</p>
        </blockquote>
      ) : (
        <p className="text-sm leading-relaxed">{highlight.text}</p>
      )}

      {/* Footer: book info + optional cover */}
      <div className="mt-3 flex items-center gap-sm border-t border-black/5 pt-sm dark:border-white/5">
        {bookCover ? (
          <img
            src={bookCover}
            alt=""
            aria-hidden="true"
            className="h-8 w-6 flex-shrink-0 rounded object-cover shadow-sm"
          />
        ) : (
          <div
            className="flex h-8 w-6 flex-shrink-0 items-center justify-center rounded"
            style={{ background: colorDef.bg + '33' }}
          >
            <BookMarked className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {highlight.book_title}
        </span>
      </div>
    </div>
  );
}

interface HighlightFormProps {
  highlight?: BookHighlight;
  books: Book[];
  ownerId: number;
  onSubmit: (data: BookHighlightFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

function HighlightForm({
  highlight,
  books,
  ownerId,
  onSubmit,
  onCancel,
  isLoading,
}: HighlightFormProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(highlight?.text ?? '');
  const [bookId, setBookId] = useState<string>(highlight ? String(highlight.book) : '');
  const [pageNumber, setPageNumber] = useState(
    highlight?.page_number ? String(highlight.page_number) : ''
  );
  const [chapter, setChapter] = useState(highlight?.chapter ?? '');
  const [highlightType, setHighlightType] = useState(
    highlight?.highlight_type ?? 'quote'
  );
  const [color, setColor] = useState(highlight?.color ?? 'yellow');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookId || !text.trim()) return;
    await onSubmit({
      book: Number(bookId),
      text: text.trim(),
      page_number: pageNumber ? Number(pageNumber) : null,
      chapter: chapter.trim() || null,
      highlight_type: highlightType,
      color,
      owner: ownerId,
    });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-md">
      <div className="space-y-sm">
        <Label htmlFor="hl-book">{t('pages.highlights.form.bookLabel')}</Label>
        <Select value={bookId} onValueChange={setBookId}>
          <SelectTrigger id="hl-book">
            <SelectValue placeholder={t('pages.highlights.form.bookPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {books.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-sm">
        <Label htmlFor="hl-text">{t('pages.highlights.form.textLabel')}</Label>
        <Textarea
          id="hl-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('pages.highlights.form.textPlaceholder')}
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-md">
        <div className="space-y-sm">
          <Label htmlFor="hl-type">{t('pages.highlights.form.typeLabel')}</Label>
          <Select
            value={highlightType}
            onValueChange={(v) => setHighlightType(v as typeof highlightType)}
          >
            <SelectTrigger id="hl-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">
                <div className="flex items-center gap-sm">
                  <Quote className="h-3.5 w-3.5" />{' '}
                  {t('pages.highlights.form.typeQuote')}
                </div>
              </SelectItem>
              <SelectItem value="note">
                <div className="flex items-center gap-sm">
                  <StickyNote className="h-3.5 w-3.5" />{' '}
                  {t('pages.highlights.form.typeNote')}
                </div>
              </SelectItem>
              <SelectItem value="idea">
                <div className="flex items-center gap-sm">
                  <Lightbulb className="h-3.5 w-3.5" />{' '}
                  {t('pages.highlights.form.typeIdea')}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-sm">
          <Label htmlFor="hl-color">{t('pages.highlights.form.colorLabel')}</Label>
          <Select value={color} onValueChange={(v) => setColor(v as typeof color)}>
            <SelectTrigger id="hl-color">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTION_KEYS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-sm">
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: opt.bg }}
                    />
                    {t(
                      `pages.highlights.form.color${opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}`
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-md">
        <div className="space-y-sm">
          <Label htmlFor="hl-page">{t('pages.highlights.form.pageLabel')}</Label>
          <Input
            id="hl-page"
            type="number"
            min={1}
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
            placeholder={t('pages.highlights.form.pagePlaceholder')}
          />
        </div>
        <div className="space-y-sm">
          <Label htmlFor="hl-chapter">{t('pages.highlights.form.chapterLabel')}</Label>
          <Input
            id="hl-chapter"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder={t('pages.highlights.form.chapterPlaceholder')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-sm pt-sm">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || !bookId || !text.trim()}>
          {isLoading ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}

export default function Highlights() {
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [ownerId, setOwnerId] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<BookHighlight | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const PAGE_SIZE = 30;

  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [highlightsData, booksData, member] = await Promise.all([
        bookHighlightsService.getAll(),
        booksService.getAll(),
        membersService.getCurrentUserMember(),
      ]);
      setHighlights(highlightsData);
      setBooks(booksData);
      setOwnerId(member.id);
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

  const bookCoverMap = new Map<number, string | null>(
    books.map((b) => [b.id, b.cover ?? null])
  );

  const handleCreate = () => {
    setEditingHighlight(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (highlight: BookHighlight) => {
    setEditingHighlight(highlight);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.highlights.deleteTitle'),
      description: t('pages.highlights.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await bookHighlightsService.delete(id);
      toast({ title: t('pages.highlights.deleted') });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: BookHighlightFormData) => {
    try {
      setIsSubmitting(true);
      if (editingHighlight) {
        await bookHighlightsService.update(editingHighlight.id, data);
        toast({ title: t('pages.highlights.editTitle') });
      } else {
        await bookHighlightsService.create(data);
        toast({ title: t('pages.highlights.newTitle') });
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

  const handleExport = async (format: 'markdown' | 'json' | 'csv') => {
    try {
      setIsExporting(true);
      const blob = await bookHighlightsService.exportAs(format);
      const ext = format === 'markdown' ? 'md' : format;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `destaques.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = highlights.filter((h) => {
    if (filterType && h.highlight_type !== filterType) return false;
    if (filterColor && h.color !== filterColor) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        h.text.toLowerCase().includes(q) ||
        h.book_title.toLowerCase().includes(q) ||
        (h.chapter ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedHighlights = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.highlights.title')}
        icon={<Highlighter />}
        action={{
          label: t('pages.highlights.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <FilterBar
        hasActiveFilters={!!(searchTerm || filterType || filterColor)}
        onClear={() => {
          setSearchTerm('');
          setFilterType('');
          setFilterColor('');
          setCurrentPage(1);
        }}
      >
        <SearchInput
          placeholder={t('pages.highlights.searchPlaceholder')}
          value={searchTerm}
          onValueChange={(v) => {
            setSearchTerm(v);
            setCurrentPage(1);
          }}
          className="w-44 flex-none"
        />

        {/* Type filter */}
        <Select
          value={filterType || 'all'}
          onValueChange={(v) => {
            setFilterType(v === 'all' ? '' : v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.highlights.form.allTypes')}</SelectItem>
            <SelectItem value="quote">
              <div className="flex items-center gap-sm">
                <Quote className="h-3.5 w-3.5" /> {t('pages.highlights.form.typeQuote')}
              </div>
            </SelectItem>
            <SelectItem value="note">
              <div className="flex items-center gap-sm">
                <StickyNote className="h-3.5 w-3.5" />{' '}
                {t('pages.highlights.form.typeNote')}
              </div>
            </SelectItem>
            <SelectItem value="idea">
              <div className="flex items-center gap-sm">
                <Lightbulb className="h-3.5 w-3.5" />{' '}
                {t('pages.highlights.form.typeIdea')}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Color filter with swatches */}
        <Select
          value={filterColor || 'all'}
          onValueChange={(v) => {
            setFilterColor(v === 'all' ? '' : v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Cor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pages.highlights.form.allColors')}</SelectItem>
            {COLOR_OPTION_KEYS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-sm">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-black/10"
                    style={{ backgroundColor: opt.bg }}
                  />
                  {t(
                    `pages.highlights.form.color${opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}`
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {highlights.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting}>
                <Download className="mr-sm h-4 w-4" />
                {isExporting ? t('common.actions.loading') : t('common.actions.export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport('markdown')}>
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport('json')}>
                JSON (.json)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport('csv')}>
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? t('pages.highlights.emptySearch')
              : t('pages.highlights.emptyState')
          }
        />
      ) : (
        <>
          <div className="space-y-md">
            {pagedHighlights.map((h) => (
              <HighlightCard
                key={h.id}
                highlight={h}
                bookCover={bookCoverMap.get(h.book)}
                onEdit={handleEdit}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filtered.length} destaque{filtered.length !== 1 ? 's' : ''} — página{' '}
                {safePage} de {totalPages}
              </span>
              <div className="flex items-center gap-xs">
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingHighlight
                ? t('pages.highlights.editTitle')
                : t('pages.highlights.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingHighlight
                ? t('pages.highlights.editDesc')
                : t('pages.highlights.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <HighlightForm
            highlight={editingHighlight}
            books={books}
            ownerId={ownerId}
            onSubmit={handleSubmit}
            onCancel={() => setIsFormOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
