/* eslint-disable max-lines */
import {
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Edit,
  FileText,
  Globe,
  Hash,
  Highlighter,
  Library,
  Plus,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ReadingForm } from '@/components/library/ReadingForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { bookHighlightsService } from '@/services/book-highlights-service';
import { readingsService } from '@/services/readings-service';
import { summariesService } from '@/services/summaries-service';
import type {
  Book,
  BookHighlight,
  BookHighlightFormData,
  Reading,
  ReadingFormData,
  Summary,
  SummaryFormData,
} from '@/types';
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

interface HighlightInlineFormProps {
  bookId: number;
  ownerId: number;
  highlight?: BookHighlight;
  onSaved: () => void;
  onCancel: () => void;
}

function HighlightInlineForm({
  bookId,
  ownerId,
  highlight,
  onSaved,
  onCancel,
}: HighlightInlineFormProps) {
  const [text, setText] = useState(highlight?.text ?? '');
  const [pageNumber, setPageNumber] = useState(
    highlight?.page_number ? String(highlight.page_number) : ''
  );
  const [chapter, setChapter] = useState(highlight?.chapter ?? '');
  const [highlightType, setHighlightType] = useState(
    highlight?.highlight_type ?? 'quote'
  );
  const [color, setColor] = useState(highlight?.color ?? 'yellow');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      const data: BookHighlightFormData = {
        book: bookId,
        text: text.trim(),
        page_number: pageNumber ? Number(pageNumber) : null,
        chapter: chapter.trim() || null,
        highlight_type: highlightType,
        color,
        owner: ownerId,
      };
      if (highlight) {
        await bookHighlightsService.update(highlight.id, data);
      } else {
        await bookHighlightsService.create(data);
      }
      onSaved();
    } catch (error: unknown) {
      toast({
        title: t('pages.books.detail.highlightSaveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3 rounded-lg border p-3"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('pages.books.detail.hlTextPlaceholder')}
        rows={3}
        required
      />
      <div className="grid grid-cols-2 gap-sm">
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.books.detail.hlTypeLbl')}</Label>
          <Select
            value={highlightType}
            onValueChange={(v) => setHighlightType(v as typeof highlightType)}
          >
            <SelectTrigger className="h-8 text-xs">
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
        <div className="space-y-xs">
          <Label className="text-xs">{t('pages.books.detail.hlColorLbl')}</Label>
          <Select value={color} onValueChange={(v) => setColor(v as typeof color)}>
            <SelectTrigger className="h-8 text-xs">
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
      <div className="grid grid-cols-2 gap-sm">
        <Input
          type="number"
          min={1}
          placeholder={t('pages.books.detail.hlPagePlaceholder')}
          value={pageNumber}
          onChange={(e) => setPageNumber(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          placeholder={t('pages.books.detail.hlChapterPlaceholder')}
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex justify-end gap-sm">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isSaving || !text.trim()}>
          {isSaving ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}

type DetailTab = 'info' | 'highlights' | 'readings' | 'summaries';

interface BookDetailModalProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: number) => void;
  initialTab?: DetailTab;
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

function StarRow({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? 'fill-star text-star' : 'fill-muted text-muted'}`}
        />
      ))}
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-sm text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function BookDetailModal({
  book,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  initialTab = 'info',
}: BookDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);

  // Highlights state
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<BookHighlight | undefined>();
  const [isExporting, setIsExporting] = useState(false);

  // Readings state
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isLoadingReadings, setIsLoadingReadings] = useState(false);
  const [isReadingFormOpen, setIsReadingFormOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<Reading | undefined>();
  const [isReadingSubmitting, setIsReadingSubmitting] = useState(false);

  // Summaries state
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);
  const [isSummaryFormOpen, setIsSummaryFormOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState<Summary | null>(null);
  const [summaryFormData, setSummaryFormData] = useState<SummaryFormData>({
    title: '',
    book: 0,
    text: '',
    owner: 0,
  });
  const [isSummarySubmitting, setIsSummarySubmitting] = useState(false);

  const { showConfirm } = useAlertDialog();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Load data when tab changes
  useEffect(() => {
    if (book && open) {
      if (activeTab === 'highlights') void loadHighlights();
      if (activeTab === 'readings') void loadReadings();
      if (activeTab === 'summaries') void loadSummaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, open, activeTab]);

  // Reset state when modal opens with a new book or initialTab changes
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    } else {
      setShowAddForm(false);
      setEditingHighlight(undefined);
      setIsReadingFormOpen(false);
      setEditingReading(undefined);
      setIsSummaryFormOpen(false);
      setEditingSummary(null);
    }
  }, [open, initialTab]);

  const loadHighlights = async () => {
    if (!book) return;
    setIsLoadingHighlights(true);
    try {
      const data = await bookHighlightsService.getByBook(book.id);
      setHighlights(data);
    } catch {
      // silently ignore
    } finally {
      setIsLoadingHighlights(false);
    }
  };

  const loadReadings = async () => {
    if (!book) return;
    setIsLoadingReadings(true);
    try {
      const data = await readingsService.getAll();
      setReadings(data.filter((r) => r.book === book.id));
    } catch {
      // silently ignore
    } finally {
      setIsLoadingReadings(false);
    }
  };

  const handleReadingSubmit = async (data: ReadingFormData) => {
    if (!book) return;
    setIsReadingSubmitting(true);
    try {
      if (editingReading) {
        await readingsService.update(editingReading.id, data);
        toast({
          title: t('pages.readings.updated'),
          description: t('pages.readings.updatedDesc'),
        });
      } else {
        await readingsService.create({ ...data, book: book.id });
        toast({
          title: t('pages.readings.created'),
          description: t('pages.readings.createdDesc'),
        });
      }
      setIsReadingFormOpen(false);
      setEditingReading(undefined);
      void loadReadings();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsReadingSubmitting(false);
    }
  };

  const handleDeleteReading = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.readings.deleteTitle'),
      description: t('pages.readings.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await readingsService.delete(id);
      toast({
        title: t('pages.readings.deleted'),
        description: t('pages.readings.deletedDesc'),
      });
      void loadReadings();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const loadSummaries = async () => {
    if (!book) return;
    setIsLoadingSummaries(true);
    try {
      const data = await summariesService.getAll();
      setSummaries(data.filter((s) => s.book === book.id));
    } catch {
      // silently ignore
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  const openSummaryCreate = () => {
    if (!book) return;
    setEditingSummary(null);
    setSummaryFormData({ title: '', book: book.id, text: '', owner: book.owner });
    setIsSummaryFormOpen(true);
  };

  const openSummaryEdit = (summary: Summary) => {
    setEditingSummary(summary);
    setSummaryFormData({
      title: summary.title,
      book: summary.book,
      text: summary.text,
      owner: summary.owner,
    });
    setIsSummaryFormOpen(true);
  };

  const handleSummarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;
    setIsSummarySubmitting(true);
    try {
      if (editingSummary) {
        await summariesService.update(editingSummary.id, summaryFormData);
        toast({
          title: t('pages.summaries.updated'),
          description: t('pages.summaries.updatedDesc'),
        });
      } else {
        await summariesService.create(summaryFormData);
        toast({
          title: t('pages.summaries.created'),
          description: t('pages.summaries.createdDesc'),
        });
      }
      setIsSummaryFormOpen(false);
      setEditingSummary(null);
      void loadSummaries();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSummarySubmitting(false);
    }
  };

  const handleDeleteSummary = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.summaries.deleteTitle'),
      description: t('pages.summaries.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await summariesService.delete(id);
      toast({
        title: t('pages.summaries.deleted'),
        description: t('pages.summaries.deletedDesc'),
      });
      void loadSummaries();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHighlight = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.books.detail.highlightDeleteTitle'),
      description: t('pages.books.detail.highlightDeleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await bookHighlightsService.delete(id);
      void loadHighlights();
    } catch (error: unknown) {
      toast({
        title: t('pages.books.detail.highlightDeleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleExport = async () => {
    if (!book) return;
    setIsExporting(true);
    try {
      const blob = await bookHighlightsService.exportMarkdown(book.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `destaques_${book.title.slice(0, 30).replace(/\s+/g, '_')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.exportError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="sr-only">{book.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('pages.books.detail.dialogDesc', { title: book.title })}
          </DialogDescription>
        </DialogHeader>

        {/* Tab navigation */}
        <div className="flex shrink-0 gap-xs rounded-md border p-xs">
          {(
            [
              { id: 'info', label: t('pages.books.detail.tabInfo'), icon: null },
              {
                id: 'readings',
                label: t('pages.books.detail.tabReadings'),
                icon: <BookMarked className="h-3.5 w-3.5" />,
              },
              {
                id: 'summaries',
                label: t('pages.books.detail.tabSummaries'),
                icon: <FileText className="h-3.5 w-3.5" />,
              },
              {
                id: 'highlights',
                label: t('pages.books.detail.tabHighlights'),
                icon: <Highlighter className="h-3.5 w-3.5" />,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-sm rounded px-sm py-sm text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {/* Info tab */}
          {activeTab === 'info' && (
            <>
              {/* Top section: cover + main info */}
              <div className="flex gap-lg">
                {/* Cover */}
                <div className="shrink-0">
                  {book.cover ? (
                    <img
                      src={book.cover}
                      alt={t('pages.books.detail.coverAlt', { title: book.title })}
                      className="h-64 w-44 rounded-md object-cover shadow-md"
                    />
                  ) : (
                    <div className="flex h-64 w-44 items-center justify-center rounded-md border bg-muted shadow-sm">
                      <BookOpen className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h2 className="text-xl font-semibold leading-tight">
                      {book.title}
                    </h2>
                    <p className="mt-xs text-sm text-muted-foreground">
                      {book.authors_names.join(', ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-sm">
                    <Badge variant={statusVariant(book.read_status)}>
                      {book.read_status_display}
                    </Badge>
                    <Badge variant="secondary">{book.genre_display}</Badge>
                    {book.media_type_display && (
                      <Badge variant="outline">{book.media_type_display}</Badge>
                    )}
                    {book.has_summary && (
                      <Badge variant="outline">
                        {t('pages.books.detail.hasSummary')}
                      </Badge>
                    )}
                  </div>

                  {book.rating !== null && book.rating > 0 && (
                    <StarRow rating={book.rating} />
                  )}

                  <div className="space-y-sm">
                    <MetaRow
                      icon={<User className="h-4 w-4" />}
                      label={t('pages.books.detail.metaPublisher')}
                      value={book.publisher_name}
                    />
                    <MetaRow
                      icon={<BookOpen className="h-4 w-4" />}
                      label={t('pages.books.detail.metaPages')}
                      value={t('pages.books.detail.pagesCount', { count: book.pages })}
                    />
                    <MetaRow
                      icon={<Globe className="h-4 w-4" />}
                      label={t('pages.books.detail.metaLanguage')}
                      value={book.language_display}
                    />
                    <MetaRow
                      icon={<Library className="h-4 w-4" />}
                      label={t('pages.books.detail.metaType')}
                      value={book.literarytype_display}
                    />
                    <MetaRow
                      icon={<Hash className="h-4 w-4" />}
                      label={t('pages.books.detail.metaEdition')}
                      value={book.edition}
                    />
                    {book.publish_date && (
                      <MetaRow
                        icon={<Calendar className="h-4 w-4" />}
                        label={t('pages.books.detail.metaPublishDate')}
                        value={formatDate(book.publish_date, 'dd/MM/yyyy')}
                      />
                    )}
                    {book.genre_display && (
                      <MetaRow
                        icon={<Tag className="h-4 w-4" />}
                        label={t('pages.books.detail.metaGenre')}
                        value={book.genre_display}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Reading progress */}
              {book.reading_progress > 0 && (
                <>
                  <div className="border-t" />
                  <div className="space-y-sm">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-xs font-medium">
                        <TrendingUp className="h-4 w-4" />
                        {t('pages.books.detail.readingProgress')}
                      </span>
                      <span className="font-semibold">{book.reading_progress}%</span>
                    </div>
                    <Progress value={book.reading_progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {t('pages.books.detail.pagesRead', {
                        read: book.total_pages_read,
                        total: book.pages,
                      })}
                    </p>
                  </div>
                </>
              )}

              {/* Completion forecast */}
              {book.read_status === 'reading' &&
                (book.estimated_completion_general ||
                  book.estimated_completion_book) && (
                  <>
                    <div className="border-t" />
                    <div className="space-y-sm">
                      <span className="flex items-center gap-xs text-sm font-medium">
                        <Calendar className="h-4 w-4" />
                        {t('pages.books.detail.completionForecast')}
                      </span>
                      <div className="grid grid-cols-1 gap-sm text-xs">
                        {book.estimated_completion_book && (
                          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-sm">
                            <span className="text-muted-foreground">
                              {t('pages.books.detail.bookAvg')}
                              {book.book_avg_pages_per_day > 0 && (
                                <span className="ml-xs">
                                  {t('pages.books.detail.pagesPerDay', {
                                    count: book.book_avg_pages_per_day,
                                  })}
                                </span>
                              )}
                            </span>
                            <span className="font-semibold">
                              {new Date(
                                book.estimated_completion_book + 'T12:00:00'
                              ).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                        {book.estimated_completion_general && (
                          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-sm">
                            <span className="text-muted-foreground">
                              {t('pages.books.detail.generalAvg')}
                              {book.general_avg_pages_per_day > 0 && (
                                <span className="ml-xs">
                                  {t('pages.books.detail.pagesPerDay', {
                                    count: book.general_avg_pages_per_day,
                                  })}
                                </span>
                              )}
                            </span>
                            <span className="font-semibold">
                              {new Date(
                                book.estimated_completion_general + 'T12:00:00'
                              ).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

              {/* Synopsis */}
              {book.synopsis && book.synopsis !== 'Sem sinopse disponível.' && (
                <>
                  <div className="border-t" />
                  <div className="space-y-xs">
                    <p className="text-sm font-medium">
                      {t('pages.books.detail.synopsis')}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {book.synopsis}
                    </p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="border-t" />
              <div className="flex justify-end gap-sm">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(book.id);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-sm h-4 w-4" />
                  {t('common.actions.delete')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(book);
                  }}
                >
                  <Edit className="mr-sm h-4 w-4" />
                  {t('common.actions.edit')}
                </Button>
              </div>
            </> /* end info tab */
          )}

          {/* Highlights tab */}
          {activeTab === 'highlights' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t('pages.books.detail.highlightsCount', {
                    count: highlights.length,
                  })}
                </span>
                <div className="flex gap-sm">
                  {highlights.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleExport()}
                      disabled={isExporting}
                    >
                      <Download className="mr-sm h-3.5 w-3.5" />
                      {isExporting
                        ? t('pages.books.detail.exportingBtn')
                        : t('pages.books.detail.exportBtn')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingHighlight(undefined);
                      setShowAddForm(true);
                    }}
                  >
                    <Plus className="mr-sm h-3.5 w-3.5" />
                    {t('pages.books.detail.addBtn')}
                  </Button>
                </div>
              </div>

              {showAddForm && (
                <HighlightInlineForm
                  bookId={book.id}
                  ownerId={book.owner}
                  onSaved={() => {
                    setShowAddForm(false);
                    void loadHighlights();
                  }}
                  onCancel={() => setShowAddForm(false)}
                />
              )}

              {isLoadingHighlights ? (
                <p className="py-md text-center text-sm text-muted-foreground">
                  {t('pages.books.detail.loadingHighlights')}
                </p>
              ) : highlights.length === 0 && !showAddForm ? (
                <p className="py-lg text-center text-sm text-muted-foreground">
                  {t('pages.books.detail.noHighlights')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {highlights.map((h) =>
                    editingHighlight?.id === h.id ? (
                      <HighlightInlineForm
                        key={h.id}
                        bookId={book.id}
                        ownerId={book.owner}
                        highlight={h}
                        onSaved={() => {
                          setEditingHighlight(undefined);
                          void loadHighlights();
                        }}
                        onCancel={() => setEditingHighlight(undefined)}
                      />
                    ) : (
                      <div
                        key={h.id}
                        className={`rounded-lg border-l-4 p-3 ${COLOR_CLASSES[h.color] ?? COLOR_CLASSES.yellow}`}
                      >
                        <div className="mb-sm flex items-start justify-between gap-sm">
                          <div className="flex flex-wrap items-center gap-sm">
                            <Badge
                              variant={TYPE_VARIANT[h.highlight_type] ?? 'default'}
                              className="text-xs"
                            >
                              {h.highlight_type_display}
                            </Badge>
                            {h.page_number && (
                              <span className="text-xs text-muted-foreground">
                                p. {h.page_number}
                              </span>
                            )}
                            {h.chapter && (
                              <span className="text-xs text-muted-foreground">
                                {h.chapter}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingHighlight(h)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteHighlight(h.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed">{h.text}</p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Readings tab */}
          {activeTab === 'readings' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t('pages.books.detail.readingsCount', { count: readings.length })}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingReading(undefined);
                    setIsReadingFormOpen(true);
                  }}
                >
                  <Plus className="mr-sm h-3.5 w-3.5" />
                  {t('pages.books.detail.addBtn')}
                </Button>
              </div>

              {isLoadingReadings ? (
                <p className="py-md text-center text-sm text-muted-foreground">
                  {t('pages.books.detail.loadingReadings')}
                </p>
              ) : readings.length === 0 ? (
                <p className="py-lg text-center text-sm text-muted-foreground">
                  {t('pages.books.detail.noReadings')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {readings.map((r) => (
                    <Card key={r.id}>
                      <CardHeader className="pb-sm pt-3">
                        <div className="flex items-start justify-between gap-sm">
                          <div className="space-y-xs">
                            <div className="flex items-center gap-sm text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">
                                {formatDate(r.reading_date, 'dd/MM/yyyy')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {t('pages.books.detail.readingPagesRead', {
                                  count: r.pages_read,
                                })}
                              </span>
                              {r.reading_time > 0 && (
                                <span>
                                  {t('pages.books.detail.readingTime', {
                                    count: r.reading_time,
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title={t('common.actions.edit')}
                              onClick={() => {
                                setEditingReading(r);
                                setIsReadingFormOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              title={t('common.actions.delete')}
                              onClick={() => void handleDeleteReading(r.id)}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {r.notes && (
                        <CardContent className="pb-3 pt-0">
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {r.notes}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summaries tab */}
          {activeTab === 'summaries' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t('pages.books.detail.summariesCount', { count: summaries.length })}
                </span>
                <Button
                  size="sm"
                  onClick={openSummaryCreate}
                  disabled={book.read_status !== 'read'}
                  title={
                    book.read_status !== 'read'
                      ? t('pages.books.detail.summariesReadOnlyBtn')
                      : undefined
                  }
                >
                  <Plus className="mr-sm h-3.5 w-3.5" />
                  {t('pages.books.detail.addBtn')}
                </Button>
              </div>
              {book.read_status !== 'read' && (
                <p
                  className="rounded-md bg-muted px-3 py-sm text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{
                    __html: t('pages.books.detail.summariesReadOnlyNote'),
                  }}
                />
              )}

              {isLoadingSummaries ? (
                <p className="py-md text-center text-sm text-muted-foreground">
                  {t('pages.books.detail.loadingSummaries')}
                </p>
              ) : summaries.length === 0 ? (
                <p className="py-lg text-center text-sm text-muted-foreground">
                  {t('pages.books.detail.noSummaries')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {summaries.map((s) => (
                    <Card key={s.id}>
                      <CardHeader className="pb-sm pt-3">
                        <div className="flex items-start justify-between gap-sm">
                          <div className="space-y-xs">
                            <CardTitle className="text-sm">{s.title}</CardTitle>
                            <div className="flex items-center gap-sm">
                              {s.is_vectorized ? (
                                <Badge variant="default" className="gap-xs text-xs">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t('pages.summaries.vectorized')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-xs text-xs">
                                  <XCircle className="h-3 w-3" />
                                  {t('pages.summaries.notVectorized')}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title={t('common.actions.edit')}
                              onClick={() => openSummaryEdit(s)}
                            >
                              <Edit className="h-3 w-3" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              title={t('common.actions.delete')}
                              onClick={() => void handleDeleteSummary(s.id)}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 pt-0">
                        <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                          {s.text}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reading form dialog */}
          <Dialog open={isReadingFormOpen} onOpenChange={setIsReadingFormOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingReading
                    ? t('pages.readings.editTitle')
                    : t('pages.readings.newTitle')}
                </DialogTitle>
                <DialogDescription>
                  {editingReading
                    ? t('pages.readings.editDesc')
                    : t('pages.readings.newDesc', { title: book.title })}
                </DialogDescription>
              </DialogHeader>
              <ReadingForm
                reading={editingReading}
                books={[book]}
                onSubmit={handleReadingSubmit}
                onCancel={() => setIsReadingFormOpen(false)}
                isLoading={isReadingSubmitting}
              />
            </DialogContent>
          </Dialog>

          {/* Summary form dialog */}
          <Dialog open={isSummaryFormOpen} onOpenChange={setIsSummaryFormOpen}>
            <DialogContent className="max-w-2xl">
              <form onSubmit={(e) => void handleSummarySubmit(e)}>
                <DialogHeader>
                  <DialogTitle>
                    {editingSummary
                      ? t('pages.summaries.editTitle')
                      : t('pages.summaries.createTitle')}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSummary
                      ? t('pages.summaries.editDesc')
                      : t('pages.summaries.createDesc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-md py-md">
                  <div className="space-y-sm">
                    <Label htmlFor="summary-title">
                      {t('pages.summaries.titleField')}
                    </Label>
                    <Input
                      id="summary-title"
                      value={summaryFormData.title}
                      onChange={(e) =>
                        setSummaryFormData({
                          ...summaryFormData,
                          title: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-sm">
                    <Label htmlFor="summary-text">
                      {t('pages.summaries.contentField')}
                    </Label>
                    <Textarea
                      id="summary-text"
                      value={summaryFormData.text}
                      onChange={(e) =>
                        setSummaryFormData({ ...summaryFormData, text: e.target.value })
                      }
                      rows={10}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSummaryFormOpen(false)}
                    disabled={isSummarySubmitting}
                  >
                    {t('common.actions.cancel')}
                  </Button>
                  <Button type="submit" disabled={isSummarySubmitting}>
                    {isSummarySubmitting
                      ? t('common.actions.saving')
                      : editingSummary
                        ? t('pages.summaries.saveBtn')
                        : t('pages.summaries.createBtn')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
