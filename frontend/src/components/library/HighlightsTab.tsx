/* eslint-disable max-lines */
import { BookMarked, Download, Edit, Highlighter, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
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

const COLOR_CLASSES: Record<string, string> = {
  yellow: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20',
  green: 'border-green-400 bg-green-50 dark:bg-green-950/20',
  blue: 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
  pink: 'border-pink-400 bg-pink-50 dark:bg-pink-950/20',
  orange: 'border-orange-400 bg-orange-50 dark:bg-orange-950/20',
};

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  quote: 'default',
  note: 'secondary',
  idea: 'outline',
};

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
                {t('pages.highlights.form.typeQuote')}
              </SelectItem>
              <SelectItem value="note">
                {t('pages.highlights.form.typeNote')}
              </SelectItem>
              <SelectItem value="idea">
                {t('pages.highlights.form.typeIdea')}
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
              <SelectItem value="yellow">
                {t('pages.highlights.form.colorYellow')}
              </SelectItem>
              <SelectItem value="green">
                {t('pages.highlights.form.colorGreen')}
              </SelectItem>
              <SelectItem value="blue">
                {t('pages.highlights.form.colorBlue')}
              </SelectItem>
              <SelectItem value="pink">
                {t('pages.highlights.form.colorPink')}
              </SelectItem>
              <SelectItem value="orange">
                {t('pages.highlights.form.colorOrange')}
              </SelectItem>
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

interface HighlightsTabProps {
  isCreateOpen: boolean;
  onCreateClose: () => void;
}

export function HighlightsTab({ isCreateOpen, onCreateClose }: HighlightsTabProps) {
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [ownerId, setOwnerId] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingHighlight, setEditingHighlight] = useState<BookHighlight | undefined>();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  const handleEdit = (highlight: BookHighlight) => {
    setEditingHighlight(highlight);
    setIsEditOpen(true);
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
        toast({ title: t('pages.highlights.updated') });
      } else {
        await bookHighlightsService.create(data);
        toast({ title: t('pages.highlights.saved') });
      }
      onCreateClose();
      setIsEditOpen(false);
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

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      const blob = await bookHighlightsService.exportMarkdown();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'destaques.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast({
        title: t('pages.highlights.exportError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = searchTerm
    ? highlights.filter(
        (h) =>
          h.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          h.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (h.chapter ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : highlights;

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-md">
      <div className="flex items-center gap-sm">
        <SearchInput
          placeholder={t('pages.highlights.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
        {highlights.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportAll()}
            disabled={isExporting}
          >
            <Download className="mr-sm h-4 w-4" />
            {isExporting
              ? t('pages.highlights.exportingBtn')
              : t('pages.highlights.exportBtn')}
          </Button>
        )}
      </div>

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
        <div className="space-y-3">
          {filtered.map((h) => {
            const colorClass = COLOR_CLASSES[h.color] ?? COLOR_CLASSES.yellow;
            return (
              <div key={h.id} className={`rounded-lg border-l-4 p-md ${colorClass}`}>
                <div className="mb-sm flex items-start justify-between gap-sm">
                  <div className="flex flex-wrap items-center gap-sm">
                    <Badge variant={TYPE_VARIANT[h.highlight_type] ?? 'default'}>
                      {h.highlight_type_display}
                    </Badge>
                    {h.page_number && (
                      <span className="text-xs text-muted-foreground">
                        p. {h.page_number}
                      </span>
                    )}
                    {h.chapter && (
                      <span className="text-xs text-muted-foreground">{h.chapter}</span>
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                      {h.book_title}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEdit(h)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(h.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{h.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) onCreateClose();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('pages.highlights.newTitle')}</DialogTitle>
            <DialogDescription>{t('pages.highlights.newDesc')}</DialogDescription>
          </DialogHeader>
          <HighlightForm
            books={books}
            ownerId={ownerId}
            onSubmit={handleSubmit}
            onCancel={onCreateClose}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('pages.highlights.editTitle')}</DialogTitle>
            <DialogDescription>{t('pages.highlights.editDesc')}</DialogDescription>
          </DialogHeader>
          <HighlightForm
            highlight={editingHighlight}
            books={books}
            ownerId={ownerId}
            onSubmit={handleSubmit}
            onCancel={() => setIsEditOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { Highlighter };
