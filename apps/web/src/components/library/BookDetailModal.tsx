/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlignLeft,
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Globe,
  Hash,
  Info,
  Highlighter,
  Library,
  Pencil,
  Plus,
  Save,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Can } from '@/components/common/Can';
import { EmptyState } from '@/components/common/EmptyState';
import {
  DETAIL_TEXT_PAGE_SIZE,
  LIST_PAGE_SIZE,
  PaginatedSlide,
} from '@/components/common/PaginatedSlide';
import { HighlightForm } from '@/components/library/HighlightForm';
import { ReadingForm } from '@/components/library/ReadingForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { transitions } from '@/lib/animations/transitions';
import { formatDate } from '@/lib/formatters';
import { HIGHLIGHT_TYPE_KEY, highlightBg } from '@/lib/highlight-colors';
import { cn } from '@/lib/utils';
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

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  quote: 'default',
  note: 'secondary',
  idea: 'outline',
};

const EMPTY_HIGHLIGHTS: BookHighlight[] = [];
const EMPTY_READINGS: Reading[] = [];
const EMPTY_SUMMARIES: Summary[] = [];

type DetailTab = 'info' | 'highlights' | 'readings' | 'summaries';

// Ordem de exibição das abas, usada para calcular a direção do slide ao trocar.
const TAB_ORDER: DetailTab[] = ['info', 'readings', 'summaries', 'highlights'];

/**
 * Painel de aba empilhado: o inativo continua no grid (mantém a altura), invisível.
 * O ativo entra com fade + slide horizontal, igual ao padrão de `TabsContent`
 * (components/ui/tabs.tsx), mas sem desmontar os demais.
 */
function StackPanel({
  active,
  direction,
  children,
}: {
  active: boolean;
  direction: number;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className={cn('min-w-0 [grid-area:1/1]', !active && 'invisible')}
      aria-hidden={!active}
      inert={!active}
    >
      {active ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, x: 24 * direction }}
          animate={{ opacity: 1, x: 0 }}
          transition={transitions.normal}
        >
          {children}
        </motion.div>
      ) : (
        children
      )}
    </div>
  );
}

interface BookDetailModalProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

/** Editar/Excluir de uma linha dentro do modal (só ícone com tooltip). */
function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 gap-0.5">
      <Can action="change">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={t('common.actions.edit')}
          onClick={onEdit}
        >
          <Pencil className={cn('h-3.5 w-3.5', ACTION_COLOR.edit)} aria-hidden="true" />
        </Button>
      </Can>
      <Can action="delete">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={t('common.actions.delete')}
          onClick={onDelete}
        >
          <Trash2
            className={cn('h-3.5 w-3.5', ACTION_COLOR.delete)}
            aria-hidden="true"
          />
        </Button>
      </Can>
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
    <div className="gap-sm flex items-start text-sm">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function BookDetailModal({
  book,
  open,
  onOpenChange,
  initialTab = 'info',
}: BookDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);
  // Direção do slide ao trocar de aba: 1 = entra pela direita, -1 = pela esquerda.
  const [tabDirection, setTabDirection] = useState(0);
  const tabIndicatorId = useId();

  const handleTabChange = (tab: DetailTab) => {
    if (tab === activeTab) return;
    setTabDirection(Math.sign(TAB_ORDER.indexOf(tab) - TAB_ORDER.indexOf(activeTab)));
    setActiveTab(tab);
  };

  // Highlights state
  // Destaque: o mesmo modal inclui (highlight undefined) e edita.
  const [highlightDialog, setHighlightDialog] = useState<{
    open: boolean;
    highlight?: BookHighlight;
  }>({ open: false });
  const [isHighlightSubmitting, setIsHighlightSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Readings state
  const [isReadingFormOpen, setIsReadingFormOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<Reading | undefined>();
  const [isReadingSubmitting, setIsReadingSubmitting] = useState(false);

  // Summaries state
  const [isSummaryFormOpen, setIsSummaryFormOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState<Summary | null>(null);
  const [summaryFormData, setSummaryFormData] = useState<SummaryFormData>({
    title: '',
    book: 0,
    text: '',
    owner: 0,
  });
  const [isSummarySubmitting, setIsSummarySubmitting] = useState(false);
  const [summaryInvalid, setSummaryInvalid] = useState<{
    title?: boolean;
    text?: boolean;
  }>({});

  const { showConfirm } = useAlertDialog();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: highlights = EMPTY_HIGHLIGHTS, isLoading: isLoadingHighlights } =
    useQuery({
      queryKey: ['book-highlights', book?.id],
      queryFn: async () => {
        if (!book) return EMPTY_HIGHLIGHTS;
        try {
          return await bookHighlightsService.getByBook(book.id);
        } catch {
          return EMPTY_HIGHLIGHTS;
        }
      },
      enabled: !!book && open,
    });
  const refreshHighlights = () =>
    queryClient.invalidateQueries({ queryKey: ['book-highlights', book?.id] });

  const { data: readings = EMPTY_READINGS, isLoading: isLoadingReadings } = useQuery({
    queryKey: ['book-readings', book?.id],
    queryFn: async () => {
      if (!book) return EMPTY_READINGS;
      try {
        return await readingsService.getAllPages({ book: book.id });
      } catch {
        return EMPTY_READINGS;
      }
    },
    enabled: !!book && open,
  });
  const refreshReadings = () =>
    queryClient.invalidateQueries({ queryKey: ['book-readings', book?.id] });

  const { data: summaries = EMPTY_SUMMARIES, isLoading: isLoadingSummaries } = useQuery(
    {
      queryKey: ['book-summaries', book?.id],
      queryFn: async () => {
        if (!book) return EMPTY_SUMMARIES;
        try {
          return await summariesService.getAllPages({ book: book.id });
        } catch {
          return EMPTY_SUMMARIES;
        }
      },
      enabled: !!book && open,
    }
  );
  const refreshSummaries = () =>
    queryClient.invalidateQueries({ queryKey: ['book-summaries', book?.id] });

  // Reset state when modal opens with a new book or initialTab changes
  // (derivado durante o render — sem efeito).
  const [lastResetKey, setLastResetKey] = useState({ open, initialTab });
  if (lastResetKey.open !== open || lastResetKey.initialTab !== initialTab) {
    setLastResetKey({ open, initialTab });
    if (open) {
      setActiveTab(initialTab);
      setTabDirection(0);
    } else {
      setHighlightDialog({ open: false });
      setIsReadingFormOpen(false);
      setEditingReading(undefined);
      setIsSummaryFormOpen(false);
      setEditingSummary(null);
    }
  }

  const handleReadingSubmit = async (data: ReadingFormData) => {
    if (!book) return;
    setIsReadingSubmitting(true);
    try {
      if (editingReading) {
        await readingsService.update(editingReading.id, data);
        toast({
          title: t('pages.readings.updated'),
        });
      } else {
        await readingsService.create({ ...data, book: book.id });
        toast({
          title: t('pages.readings.created'),
        });
      }
      setIsReadingFormOpen(false);
      setEditingReading(undefined);
      void refreshReadings();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
      });
      void refreshReadings();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
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
    const missing = {
      title: !summaryFormData.title.trim(),
      text: !summaryFormData.text.trim(),
    };
    setSummaryInvalid(missing);
    if (missing.title) {
      toast({
        title: t('common.fieldRequired', { field: t('pages.summaries.titleField') }),
        variant: 'destructive',
      });
    }
    if (missing.text) {
      toast({
        title: t('common.fieldRequired', { field: t('pages.summaries.contentField') }),
        variant: 'destructive',
      });
    }
    if (missing.title || missing.text) return;
    setIsSummarySubmitting(true);
    try {
      if (editingSummary) {
        await summariesService.update(editingSummary.id, summaryFormData);
        toast({
          title: t('pages.summaries.updated'),
        });
      } else {
        await summariesService.create(summaryFormData);
        toast({
          title: t('pages.summaries.created'),
        });
      }
      setIsSummaryFormOpen(false);
      setEditingSummary(null);
      void refreshSummaries();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.saveError', { reason: getErrorMessage(error) }),
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
      });
      void refreshSummaries();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    }
  };

  const handleHighlightSubmit = async (data: BookHighlightFormData) => {
    setIsHighlightSubmitting(true);
    try {
      if (highlightDialog.highlight) {
        await bookHighlightsService.update(highlightDialog.highlight.id, data);
        toast({ title: t('pages.highlights.updated') });
      } else {
        await bookHighlightsService.create(data);
        toast({ title: t('pages.highlights.saved') });
      }
      setHighlightDialog({ open: false });
      void refreshHighlights();
    } catch (error: unknown) {
      toast({
        title: t('pages.books.detail.highlightSaveError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsHighlightSubmitting(false);
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
      void refreshHighlights();
    } catch (error: unknown) {
      toast({
        title: t('pages.books.detail.highlightDeleteError', {
          reason: getErrorMessage(error),
        }),
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
        title: t('common.messages.exportError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!book) return null;

  // O modal só abre com os dados das abas já carregados (§7: sem "Carregando…"
  // dentro do modal nem salto de tamanho).
  const isLoadingData = isLoadingHighlights || isLoadingReadings || isLoadingSummaries;

  return (
    <Dialog open={open && !isLoadingData} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="gap-sm flex items-center">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{book.title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('pages.books.detail.dialogDesc', { title: book.title })}
          </DialogDescription>
        </DialogHeader>

        {/* Tab navigation */}
        <div className="gap-xs p-xs flex shrink-0 rounded-md border">
          {(
            [
              {
                id: 'info',
                label: t('pages.books.detail.tabInfo'),
                icon: <Info className="h-3.5 w-3.5" />,
              },
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
              onClick={() => handleTabChange(tab.id)}
              className={`gap-sm px-sm py-sm relative isolate flex flex-1 items-center justify-center rounded text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeTab === tab.id && (
                <motion.span
                  layoutId={`${tabIndicatorId}-tab-indicator`}
                  className="bg-primary absolute inset-0 -z-10 rounded"
                  transition={transitions.normal}
                />
              )}
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Painéis empilhados na mesma célula do grid: o modal fica com a altura
            do maior (Informações) em todas as abas, sem altura fixa. */}
        <div className="grid">
          {/* Info tab */}
          <StackPanel active={activeTab === 'info'} direction={tabDirection}>
            <>
              {/* Top section: cover + main info */}
              <div className="gap-lg flex">
                {/* Cover */}
                <div className="shrink-0">
                  {book.cover ? (
                    <img
                      src={book.cover}
                      alt={t('pages.books.detail.coverAlt', { title: book.title })}
                      className="h-64 w-44 rounded-md object-cover shadow-md"
                    />
                  ) : (
                    <div className="bg-muted flex h-64 w-44 items-center justify-center rounded-md border shadow-sm">
                      <BookOpen className="text-muted-foreground h-10 w-10" />
                    </div>
                  )}
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-muted-foreground text-sm">
                    {book.authors_names.join(', ')}
                  </p>

                  <div className="gap-sm flex flex-wrap">
                    <Badge variant={statusVariant(book.read_status)}>
                      {t(`pages.books.readStatuses.${book.read_status}`, {
                        defaultValue: book.read_status_display,
                      })}
                    </Badge>
                    <Badge variant="secondary">
                      {t(`pages.books.genres.${book.genre}`, {
                        defaultValue: book.genre_display,
                      })}
                    </Badge>
                    {book.media_type && (
                      <Badge variant="outline">
                        {t(`pages.books.mediaTypes.${book.media_type}`, {
                          defaultValue: book.media_type_display,
                        })}
                      </Badge>
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
                      value={t('pages.books.detail.pagesCount', {
                        count: book.pages,
                      })}
                    />
                    <MetaRow
                      icon={<Globe className="h-4 w-4" />}
                      label={t('pages.books.detail.metaLanguage')}
                      value={t(`pages.books.languages.${book.language}`, {
                        defaultValue: book.language_display,
                      })}
                    />
                    <MetaRow
                      icon={<Library className="h-4 w-4" />}
                      label={t('pages.books.detail.metaType')}
                      value={t(`pages.books.literaryTypes.${book.literarytype}`, {
                        defaultValue: book.literarytype_display,
                      })}
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
                        value={t(`pages.books.genres.${book.genre}`, {
                          defaultValue: book.genre_display,
                        })}
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
                      <span className="gap-xs flex items-center font-medium">
                        <TrendingUp className="h-4 w-4" />
                        {t('pages.books.detail.readingProgress')}
                      </span>
                      <span className="font-semibold">{book.reading_progress}%</span>
                    </div>
                    <Progress value={book.reading_progress} className="h-2" />
                    <p className="text-muted-foreground text-xs">
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
                      <span className="gap-xs flex items-center text-sm font-medium">
                        <Calendar className="h-4 w-4" />
                        {t('pages.books.detail.completionForecast')}
                      </span>
                      <div className="gap-sm grid grid-cols-1 text-xs">
                        {book.estimated_completion_book && (
                          <div className="bg-muted py-sm flex items-center justify-between rounded-md px-3">
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
                              {formatDate(book.estimated_completion_book, 'dd/MM/yyyy')}
                            </span>
                          </div>
                        )}
                        {book.estimated_completion_general && (
                          <div className="bg-muted py-sm flex items-center justify-between rounded-md px-3">
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
                              {formatDate(
                                book.estimated_completion_general,
                                'dd/MM/yyyy'
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

              {/* Synopsis */}
              {book.synopsis && (
                <>
                  <div className="border-t" />
                  <div className="space-y-xs">
                    <p className="text-sm font-medium">
                      {t('pages.books.detail.synopsis')}
                    </p>
                    <p
                      className="text-muted-foreground line-clamp-4 text-sm leading-relaxed"
                      title={book.synopsis}
                    >
                      {book.synopsis}
                    </p>
                  </div>
                </>
              )}
            </>{' '}
            {/* end info tab */}
          </StackPanel>

          {/* Highlights tab */}
          <StackPanel active={activeTab === 'highlights'} direction={tabDirection}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  {t('pages.books.detail.highlightsCount', {
                    count: highlights.length,
                  })}
                </span>
                <div className="gap-sm flex">
                  {highlights.length > 0 && (
                    <Can action="export">
                      <Button
                        variant="outline"
                        onClick={() => void handleExport()}
                        loading={isExporting}
                      >
                        {!isExporting && <Download className="h-4 w-4" />}
                        {t('pages.books.detail.exportBtn')}
                      </Button>
                    </Can>
                  )}
                  <Button onClick={() => setHighlightDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    {t('pages.books.detail.addBtn')}
                  </Button>
                </div>
              </div>

              {highlights.length === 0 ? (
                <EmptyState title={t('pages.books.detail.noHighlights')} />
              ) : (
                <PaginatedSlide
                  items={highlights}
                  pageSize={DETAIL_TEXT_PAGE_SIZE}
                  pinNav={false}
                  className="space-y-sm"
                >
                  {(pageHighlights) =>
                    pageHighlights.map((h) => (
                      <div
                        key={h.id}
                        className={cn('rounded-lg border p-3', highlightBg(h.color))}
                      >
                        <div className="mb-sm gap-sm flex items-start justify-between">
                          <div className="gap-sm flex flex-wrap items-center">
                            <Badge
                              variant={TYPE_VARIANT[h.highlight_type] ?? 'default'}
                              className="text-xs"
                            >
                              {t(HIGHLIGHT_TYPE_KEY[h.highlight_type] ?? '', {
                                defaultValue: h.highlight_type_display,
                              })}
                            </Badge>
                            {h.page_number && (
                              <span className="text-muted-foreground text-xs">
                                {t('pages.highlights.pageShort', {
                                  page: h.page_number,
                                })}
                              </span>
                            )}
                            {h.chapter && (
                              <span className="text-muted-foreground text-xs">
                                {h.chapter}
                              </span>
                            )}
                          </div>
                          <RowActions
                            onEdit={() =>
                              setHighlightDialog({ open: true, highlight: h })
                            }
                            onDelete={() => void handleDeleteHighlight(h.id)}
                          />
                        </div>
                        <p
                          className="line-clamp-4 text-sm leading-relaxed"
                          title={h.text}
                        >
                          {h.text}
                        </p>
                      </div>
                    ))
                  }
                </PaginatedSlide>
              )}
            </div>
          </StackPanel>

          {/* Readings tab */}
          <StackPanel active={activeTab === 'readings'} direction={tabDirection}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  {t('pages.books.detail.readingsCount', { count: readings.length })}
                </span>
                <Button
                  onClick={() => {
                    setEditingReading(undefined);
                    setIsReadingFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {t('pages.books.detail.addBtn')}
                </Button>
              </div>

              {readings.length === 0 ? (
                <EmptyState title={t('pages.books.detail.noReadings')} />
              ) : (
                <PaginatedSlide
                  items={readings}
                  pageSize={LIST_PAGE_SIZE}
                  pinNav={false}
                  growOnAdd
                  className="space-y-sm"
                >
                  {(pageReadings) =>
                    pageReadings.map((r) => (
                      <Card key={r.id}>
                        <CardHeader className="pb-sm pt-3">
                          <div className="gap-sm flex items-start justify-between">
                            <div className="space-y-xs">
                              <div className="gap-sm flex items-center text-sm">
                                <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                                <span className="font-medium">
                                  {formatDate(r.reading_date, 'dd/MM/yyyy')}
                                </span>
                              </div>
                              <div className="text-muted-foreground flex items-center gap-3 text-xs">
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
                            <RowActions
                              onEdit={() => {
                                setEditingReading(r);
                                setIsReadingFormOpen(true);
                              }}
                              onDelete={() => void handleDeleteReading(r.id)}
                            />
                          </div>
                        </CardHeader>
                        {r.notes && (
                          <CardContent className="pt-0 pb-3">
                            <p className="text-muted-foreground line-clamp-2 text-xs">
                              {r.notes}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    ))
                  }
                </PaginatedSlide>
              )}
            </div>
          </StackPanel>

          {/* Summaries tab */}
          <StackPanel active={activeTab === 'summaries'} direction={tabDirection}>
            <div className="space-y-3">
              <div className="gap-sm flex flex-wrap items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  {t('pages.books.detail.summariesCount', {
                    count: summaries.length,
                  })}
                </span>
                <div className="gap-xs flex shrink-0 items-center">
                  <Button
                    onClick={openSummaryCreate}
                    disabled={book.read_status !== 'read'}
                  >
                    <Plus className="h-4 w-4" />
                    {t('pages.books.detail.addBtn')}
                  </Button>
                </div>
              </div>

              {summaries.length === 0 ? (
                <EmptyState title={t('pages.books.detail.noSummaries')} />
              ) : (
                <PaginatedSlide
                  items={summaries}
                  pageSize={DETAIL_TEXT_PAGE_SIZE}
                  pinNav={false}
                  className="space-y-sm"
                >
                  {(pageSummaries) =>
                    pageSummaries.map((s) => (
                      <Card key={s.id}>
                        <CardHeader className="pb-sm pt-3">
                          <div className="gap-sm flex items-start justify-between">
                            <div className="space-y-xs">
                              <CardTitle className="text-sm">{s.title}</CardTitle>
                              <div className="gap-sm flex items-center">
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
                            <RowActions
                              onEdit={() => openSummaryEdit(s)}
                              onDelete={() => void handleDeleteSummary(s.id)}
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                          <p className="text-muted-foreground line-clamp-4 text-xs whitespace-pre-wrap">
                            {s.text}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  }
                </PaginatedSlide>
              )}
            </div>
          </StackPanel>
        </div>

        <div>
          {/* Reading form dialog */}
          <Dialog open={isReadingFormOpen} onOpenChange={setIsReadingFormOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle mode={editingReading ? 'edit' : 'create'}>
                  {editingReading
                    ? t('pages.readings.editTitle')
                    : t('pages.readings.newTitle')}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>
                    {editingReading
                      ? t('pages.readings.editDesc')
                      : t('pages.readings.newDesc', { title: book.title })}
                  </DialogDescription>
                </VisuallyHidden>
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

          {/* Highlight form dialog (incluir / editar) */}
          <Dialog
            open={highlightDialog.open}
            onOpenChange={(v) => !v && setHighlightDialog({ open: false })}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle mode={highlightDialog.highlight ? 'edit' : 'create'}>
                  {highlightDialog.highlight
                    ? t('pages.highlights.editTitle')
                    : t('pages.highlights.newTitle')}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>
                    {highlightDialog.highlight
                      ? t('pages.highlights.editDesc')
                      : t('pages.highlights.newDesc')}
                  </DialogDescription>
                </VisuallyHidden>
              </DialogHeader>
              <HighlightForm
                key={highlightDialog.highlight?.id ?? 'new'}
                highlight={highlightDialog.highlight}
                bookId={book.id}
                ownerId={book.owner}
                onSubmit={handleHighlightSubmit}
                onCancel={() => setHighlightDialog({ open: false })}
                isLoading={isHighlightSubmitting}
              />
            </DialogContent>
          </Dialog>

          {/* Summary form dialog */}
          <Dialog open={isSummaryFormOpen} onOpenChange={setIsSummaryFormOpen}>
            <DialogContent className="max-w-2xl">
              <form noValidate onSubmit={(e) => void handleSummarySubmit(e)}>
                <DialogHeader>
                  <DialogTitle mode={editingSummary ? 'edit' : 'create'}>
                    {editingSummary
                      ? t('pages.summaries.editTitle')
                      : t('pages.summaries.createTitle')}
                  </DialogTitle>
                  <VisuallyHidden>
                    <DialogDescription>
                      {editingSummary
                        ? t('pages.summaries.editDesc')
                        : t('pages.summaries.createDesc')}
                    </DialogDescription>
                  </VisuallyHidden>
                </DialogHeader>
                <div className="gap-md py-md grid">
                  <div className="space-y-sm">
                    <Label className="gap-xs flex items-center" htmlFor="summary-title">
                      <FileText className="text-muted-foreground h-3.5 w-3.5" />
                      {t('pages.summaries.titleField')}
                    </Label>
                    <Input
                      id="summary-title"
                      placeholder={t('common.placeholders.summaryTitle')}
                      value={summaryFormData.title}
                      onChange={(e) =>
                        setSummaryFormData({
                          ...summaryFormData,
                          title: e.target.value,
                        })
                      }
                      aria-invalid={summaryInvalid.title}
                    />
                  </div>
                  <div className="space-y-sm">
                    <Label className="gap-xs flex items-center" htmlFor="summary-text">
                      <AlignLeft className="text-muted-foreground h-3.5 w-3.5" />
                      {t('pages.summaries.contentField')}
                    </Label>
                    <Textarea
                      id="summary-text"
                      placeholder={t('common.placeholders.summaryText')}
                      value={summaryFormData.text}
                      onChange={(e) =>
                        setSummaryFormData({ ...summaryFormData, text: e.target.value })
                      }
                      rows={10}
                      aria-invalid={summaryInvalid.text}
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
                    <X className="h-4 w-4" />
                    {t('common.actions.cancel')}
                  </Button>
                  <Button type="submit" loading={isSummarySubmitting}>
                    {!isSummarySubmitting && <Save className="h-4 w-4" />}
                    {t('common.actions.save')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <DialogCloseFooter />
      </DialogContent>
    </Dialog>
  );
}
