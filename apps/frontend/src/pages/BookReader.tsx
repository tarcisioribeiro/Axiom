/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import Epub, { type Book as EpubBook, type Rendition } from 'epubjs';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Loader2,
  Minus,
  Moon,
  Palette,
  PanelRight,
  Plus,
  FileText,
  Save,
  Shapes,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
// Configure PDF.js worker via Vite ?url import for reliable asset bundling
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface BookReaderProps {
  /** Book shown in the fullscreen reader overlay (opened from Livros). */
  bookIdProp: number;
  /** Closes the overlay. */
  onClose: () => void;
}

import { EmptyState } from '@/components/common/EmptyState';
import {
  DETAIL_TEXT_PAGE_SIZE,
  PaginatedSlide,
} from '@/components/common/PaginatedSlide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { API_CONFIG } from '@/config/constants';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { ACTION_COLOR } from '@/lib/action-colors';
import { HIGHLIGHT_DOT, HIGHLIGHT_TYPE_KEY, highlightBg } from '@/lib/highlight-colors';
import { cn, formatLocalDate } from '@/lib/utils';
import { bookHighlightsService } from '@/services/book-highlights-service';
import { booksService } from '@/services/books-service';
import { membersService } from '@/services/members-service';
import { readingsService } from '@/services/readings-service';
import type { BookHighlight, BookHighlightFormData } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// ============================================================================
// TYPES
// ============================================================================

type ReaderTheme = 'light' | 'sepia' | 'dark';

// Width presets in pixels (content area)
const WIDTH_PRESETS = [600, 750, 900, 1100] as const;
type WidthPreset = (typeof WIDTH_PRESETS)[number];

interface ThemeConfig {
  backgroundColor: string;
  color: string;
  borderColor: string;
  icon: React.ReactNode;
  epubBody: { background: string; color: string; linkColor: string };
}

// ============================================================================
// THEME DEFINITIONS — 3 reader modes (light / sepia / dark). The colors come
// from the `--reader-*` tokens in `index.css` (redefined under `.dark`), and
// are resolved to concrete `hsl()` strings so they can be injected into the
// EPUB iframe, where the app's CSS variables don't exist.
// ============================================================================

function readerToken(mode: ReaderTheme, part: 'bg' | 'fg' | 'border' | 'link'): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--reader-${mode}-${part}`)
    .trim();
  return `hsl(${value})`;
}

/** `hsl(H S L)` → `hsl(H S L / alpha)`. */
function withAlpha(color: string, alpha: number): string {
  return color.replace(')', ` / ${alpha})`);
}

const READER_THEME_ICONS: Record<ReaderTheme, React.ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  sepia: <Palette className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
};

// `_isDark` só entra para recalcular quando o tema do app muda (os tokens
// `--reader-*` são redefinidos em `.dark`).
function buildThemes(_isDark: boolean): Record<ReaderTheme, ThemeConfig> {
  const make = (mode: ReaderTheme): ThemeConfig => {
    const background = readerToken(mode, 'bg');
    const color = readerToken(mode, 'fg');
    return {
      backgroundColor: background,
      color,
      borderColor: readerToken(mode, 'border'),
      icon: READER_THEME_ICONS[mode],
      epubBody: { background, color, linkColor: readerToken(mode, 'link') },
    };
  };
  return { light: make('light'), sepia: make('sepia'), dark: make('dark') };
}

// Applies all reader-mode themes to an epubjs rendition and selects the
// current one.  Called on book creation and again whenever isDark or theme
// changes so the EPUB iframe always reflects the correct palette.
function applyEpubThemes(
  rendition: Rendition,
  themes: Record<ReaderTheme, ThemeConfig>,
  currentTheme: ReaderTheme
): void {
  (Object.keys(themes) as ReaderTheme[]).forEach((key) => {
    const { epubBody } = themes[key];
    rendition.themes.register(key, {
      body: {
        background: `${epubBody.background} !important`,
        color: `${epubBody.color} !important`,
        'font-family': 'Georgia, serif',
        'line-height': '1.75',
        padding: '0 2rem',
      },
      'p, li, span, div, h1, h2, h3, h4': {
        color: `${epubBody.color} !important`,
        background: 'transparent !important',
      },
      a: { color: `${epubBody.linkColor} !important` },
    });
  });
  rendition.themes.select(currentTheme);
}

// ============================================================================
// HIGHLIGHT COLORS
// ============================================================================

const HIGHLIGHT_COLOR_VALUES = [
  { value: 'yellow', key: 'colorYellow', dot: HIGHLIGHT_DOT.yellow },
  { value: 'green', key: 'colorGreen', dot: HIGHLIGHT_DOT.green },
  { value: 'blue', key: 'colorBlue', dot: HIGHLIGHT_DOT.blue },
  { value: 'pink', key: 'colorPink', dot: HIGHLIGHT_DOT.pink },
  { value: 'orange', key: 'colorOrange', dot: HIGHLIGHT_DOT.orange },
];

// ============================================================================
// HELPERS
// ============================================================================

function themeStyle(cfg: ThemeConfig): React.CSSProperties {
  return { backgroundColor: cfg.backgroundColor, color: cfg.color };
}

// ============================================================================
// ANNOTATION FORM
// ============================================================================

interface AnnotationFormProps {
  bookId: number;
  ownerId: number;
  currentPage: number | null;
  onSaved: (h: BookHighlight) => void;
  onCancel: () => void;
}

function AnnotationForm({
  bookId,
  ownerId,
  currentPage,
  onSaved,
  onCancel,
}: AnnotationFormProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [type, setType] = useState('note');
  const [color, setColor] = useState('yellow');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!text.trim()) {
      toast({
        title: t('common.fieldRequired', {
          field: t('pages.highlights.form.textLabel'),
        }),
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSaving(true);
      const data: BookHighlightFormData = {
        book: bookId,
        text: text.trim(),
        page_number: currentPage ?? undefined,
        highlight_type: type,
        color,
        owner: ownerId,
      };
      const created = await bookHighlightsService.create(data);
      onSaved(created);
      toast({ title: t('pages.bookReader.annotationSaved') });
    } catch (err) {
      toast({
        title: t('pages.bookReader.annotationError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-background space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {t('pages.bookReader.newAnnotation')}
        </span>
        {currentPage && (
          <Badge variant="secondary" className="text-xs">
            {t('pages.highlights.pageShort', { page: currentPage })}
          </Badge>
        )}
      </div>
      <Label className="gap-xs flex items-center text-xs" htmlFor="annotation-text">
        <FileText className="text-muted-foreground h-3.5 w-3.5" />
        {t('pages.highlights.form.textLabel')}
      </Label>
      <Textarea
        id="annotation-text"
        placeholder={t('pages.bookReader.annotationPlaceholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="gap-sm flex">
        <div className="flex-1">
          <Label className="gap-xs mb-xs flex items-center text-xs">
            <Shapes className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.bookReader.typeLabel')}
          </Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">{t('pages.bookReader.typeQuote')}</SelectItem>
              <SelectItem value="note">{t('pages.bookReader.typeNote')}</SelectItem>
              <SelectItem value="idea">{t('pages.bookReader.typeIdea')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="gap-xs mb-xs flex items-center text-xs">
            <Palette className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.bookReader.colorLabel')}
          </Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HIGHLIGHT_COLOR_VALUES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="gap-sm flex items-center">
                    <span className={`inline-block h-3 w-3 rounded-full ${c.dot}`} />
                    {t(`pages.bookReader.${c.key}`)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="gap-sm flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X aria-hidden="true" />
          {t('common.actions.cancel')}
        </Button>
        <Button size="sm" loading={isSaving} onClick={() => void handleSave()}>
          {!isSaving && <Save className="h-3 w-3" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// EPUB READER
// ============================================================================

interface EpubReaderProps {
  url: string;
  theme: ReaderTheme;
  width: number;
  initialCfi: string | null;
  isDark: boolean;
  onLocationChange: (cfi: string, page: number) => void;
}

function EpubReader({
  url,
  theme,
  width,
  initialCfi,
  isDark,
  onLocationChange,
}: EpubReaderProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    const container = containerRef.current;

    const init = async () => {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      if (cancelled) return;

      const book = Epub(buffer);
      bookRef.current = book;

      const rendition = book.renderTo(container, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
      });
      renditionRef.current = rendition;

      applyEpubThemes(rendition, buildThemes(isDark), theme);

      await rendition.display(initialCfi ?? undefined);
      if (!cancelled) setIsLoading(false);

      rendition.on(
        'relocated',
        (location: { start: { cfi: string; displayed: { page: number } } }) => {
          onLocationChange(location.start.cfi, location.start.displayed.page);
        }
      );
    };

    void init().catch(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      void bookRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Re-register palette-aware themes whenever the app theme (isDark) or the
  // reader mode changes so the EPUB iframe always shows the correct colors.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    applyEpubThemes(rendition, buildThemes(isDark), theme);
  }, [isDark, theme]);

  // Apply width change
  useEffect(() => {
    renditionRef.current?.resize(width, undefined as unknown as number);
  }, [width]);

  const prev = () => renditionRef.current?.prev();
  const next = () => renditionRef.current?.next();

  const themes = buildThemes(isDark);
  const cfg = themes[theme];

  return (
    <div className="relative flex h-full flex-col" style={themeStyle(cfg)}>
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={themeStyle(cfg)}
        >
          <Loader2 className="h-8 w-8 animate-spin opacity-60" />
        </div>
      )}
      <div
        ref={containerRef}
        className="mx-auto flex-1 overflow-hidden"
        style={{ width: `${width}px`, maxWidth: '100%' }}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={prev}
        className="p-sm absolute top-1/2 left-2 -translate-y-1/2 rounded-full border shadow backdrop-blur-sm"
        style={{
          backgroundColor: withAlpha(cfg.backgroundColor, 0.8),
          borderColor: cfg.borderColor,
          color: cfg.color,
        }}
        aria-label={t('pages.bookReader.prevPage')}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={next}
        className="p-sm absolute top-1/2 right-2 -translate-y-1/2 rounded-full border shadow backdrop-blur-sm"
        style={{
          backgroundColor: withAlpha(cfg.backgroundColor, 0.8),
          borderColor: cfg.borderColor,
          color: cfg.color,
        }}
        aria-label={t('pages.bookReader.nextPage')}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

// ============================================================================
// PDF READER
// ============================================================================

interface PdfReaderProps {
  url: string;
  theme: ReaderTheme;
  width: number;
  pageNumber: number;
  isDark: boolean;
  onNumPagesChange: (n: number) => void;
}

// Maps each reader theme to a CSS filter applied directly to the PDF canvas so
// the page colours actually change (canvas ignores CSS color/background).
// dark  → invert everything, then rotate hue 180° to restore image colours.
// sepia → warm tint without full inversion.
// light → no filter (renders the native PDF colours).
const PDF_THEME_FILTER: Record<ReaderTheme, string | undefined> = {
  light: undefined,
  sepia: 'sepia(0.55) brightness(0.96)',
  dark: 'invert(1) hue-rotate(180deg)',
};

function PdfReader({
  url,
  theme,
  width,
  pageNumber,
  isDark,
  onNumPagesChange,
}: PdfReaderProps) {
  const { t } = useTranslation();
  const themes = buildThemes(isDark);
  const cfg = themes[theme];
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);

  // Fetch PDF as ArrayBuffer with JWT cookies so that:
  // 1. The worker never needs to make authenticated requests itself.
  // 2. Embedded images are part of the binary and rendered correctly.
  useEffect(() => {
    let cancelled = false;
    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (!cancelled) setPdfData(buf);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      setPdfData(null);
    };
  }, [url]);

  const pageFilter = PDF_THEME_FILTER[theme];

  return (
    <div className="flex h-full flex-col" style={themeStyle(cfg)}>
      <div
        className="py-lg flex flex-1 items-start justify-center overflow-auto"
        style={themeStyle(cfg)}
      >
        <Document
          file={pdfData ?? undefined}
          onLoadSuccess={({ numPages: n }) => onNumPagesChange(n)}
          loading={
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin opacity-60" />
            </div>
          }
          error={
            <div className="gap-sm flex h-64 flex-col items-center justify-center opacity-60">
              <BookOpen className="h-10 w-10" />
              <p className="text-sm">{t('pages.bookReader.pdfError')}</p>
            </div>
          }
        >
          <div style={pageFilter ? { filter: pageFilter } : undefined}>
            <Page
              pageNumber={pageNumber}
              className="shadow-xl"
              renderAnnotationLayer
              renderTextLayer
              width={Math.min(width, window.innerWidth - 64)}
            />
          </div>
        </Document>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN READER PAGE
// ============================================================================

export default function BookReader({ bookIdProp, onClose }: BookReaderProps) {
  const { t } = useTranslation();
  const bookId = String(bookIdProp);
  const { toast } = useToast();
  const { isDark } = useTheme();

  const handleClose = onClose;

  // Escape key closes the overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const [theme, setTheme] = useState<ReaderTheme>(
    () => (localStorage.getItem('reader-theme') as ReaderTheme) ?? 'light'
  );

  // Re-computed on every render; cheap since it only builds a plain object.
  // Depends on both isDark (app palette) and theme (reader mode).
  const themes = buildThemes(isDark);
  const cfg = themes[theme];

  const [contentWidth, setContentWidth] = useState<WidthPreset>(
    () => (Number(localStorage.getItem('reader-width')) as WidthPreset) ?? 750
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);

  // PDF pagination (lifted from PdfReader so the toolbar can own the nav)
  const [numPages, setNumPages] = useState(0);
  const [pageInput, setPageInput] = useState('1');

  // Progress tracking
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);
  const [latestReadingId, setLatestReadingId] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: loadResult, isLoading } = useQuery({
    queryKey: ['book-reader', bookId],
    queryFn: async () => {
      const id = parseInt(bookId ?? '0');
      try {
        const [bookData, fileData, readingsData, highlights, member] =
          await Promise.all([
            booksService.getById(id),
            booksService.getBookFileUrl(id),
            readingsService.getAll({ book: id }),
            bookHighlightsService.getByBook(id),
            membersService.getCurrentUserMember(),
          ]);

        // Stream via Django proxy (same-origin) to avoid CORS restrictions from PDF.js worker
        const streamUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOK_FILE_STREAM}${id}/file/stream/`;
        const ext = fileData.name.split('.').pop()?.toLowerCase();
        const isEpub = ext === 'epub';
        const latest =
          readingsData.length > 0
            ? [...readingsData].sort(
                (a, b) =>
                  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              )[0]
            : null;

        return {
          book: bookData,
          fileUrl: streamUrl,
          fileType: isEpub ? 'epub' : 'pdf',
          highlights,
          ownerId: member.id,
          latest,
          isEpub,
        };
      } catch (err) {
        toast({
          title: t('common.messages.loadError', { reason: getErrorMessage(err) }),
          variant: 'destructive',
        });
        return null;
      }
    },
    enabled: !!bookId,
  });

  const book = loadResult?.book ?? null;
  const fileUrl = loadResult?.fileUrl ?? null;
  const fileType = loadResult?.fileType ?? null;
  const ownerId = loadResult?.ownerId ?? 0;

  const [annotations, setAnnotations] = useState<BookHighlight[]>([]);
  const [lastHighlights, setLastHighlights] = useState(loadResult?.highlights);
  if (loadResult?.highlights !== lastHighlights) {
    setLastHighlights(loadResult?.highlights);
    setAnnotations(loadResult?.highlights ?? []);
  }

  const [lastLatest, setLastLatest] = useState(loadResult?.latest);
  if (loadResult?.latest !== lastLatest) {
    setLastLatest(loadResult?.latest);
    const latest = loadResult?.latest;
    if (latest) {
      setLatestReadingId(latest.id);
      if (latest.current_page) {
        setCurrentPage(latest.current_page);
        setPageInput(String(latest.current_page));
      }
      if (loadResult?.isEpub && latest.current_cfi) {
        setCurrentCfi(latest.current_cfi);
      }
    }
  }

  const saveProgress = useCallback(
    (page: number, cfi?: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (!bookId || !ownerId) return;
        const doSave = async () => {
          const payload: { current_page: number; current_cfi?: string } = {
            current_page: page,
          };
          if (cfi) payload.current_cfi = cfi;
          if (latestReadingId) {
            await readingsService.patch(latestReadingId, payload);
          } else {
            const created = await readingsService.create({
              book: parseInt(bookId),
              reading_date: formatLocalDate(new Date()),
              reading_time: 0,
              pages_read: 0,
              current_page: page,
              current_cfi: cfi,
              owner: ownerId,
            });
            setLatestReadingId(created.id);
          }
        };
        void doSave().catch(() => {
          // Silent — progress save should not interrupt reading
        });
      }, 2000);
    },
    [bookId, ownerId, latestReadingId]
  );

  const goToPdfPage = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(page, numPages || 1));
      setCurrentPage(p);
      setPageInput(String(p));
      saveProgress(p);
    },
    [numPages, saveProgress]
  );

  const handleEpubLocationChange = (cfi: string, page: number) => {
    setCurrentCfi(cfi);
    setCurrentPage(page);
    saveProgress(page, cfi);
  };

  const handleThemeChange = (t: ReaderTheme) => {
    setTheme(t);
    localStorage.setItem('reader-theme', t);
  };

  const handleWidthChange = (delta: number) => {
    const idx = WIDTH_PRESETS.indexOf(contentWidth);
    const next =
      WIDTH_PRESETS[Math.max(0, Math.min(WIDTH_PRESETS.length - 1, idx + delta))];
    setContentWidth(next);
    localStorage.setItem('reader-width', String(next));
  };

  const handleAnnotationSaved = (h: BookHighlight) => {
    setAnnotations((prev) => [h, ...prev]);
    setShowAnnotationForm(false);
  };

  const handleDeleteAnnotation = async (id: number) => {
    try {
      await bookHighlightsService.delete(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast({
        title: t('common.messages.deleteError', { reason: getErrorMessage(err) }),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!book || !fileUrl || !fileType) {
    return (
      <div className="gap-md bg-background flex h-screen flex-col items-center justify-center">
        <BookOpen className="text-muted-foreground h-16 w-16" />
        <p className="text-muted-foreground text-lg">
          {t('pages.bookReader.fileNotFound')}
        </p>
        <Button variant="outline" onClick={handleClose}>
          <X aria-hidden="true" />
          Fechar
        </Button>
      </div>
    );
  }

  const tbStyle: React.CSSProperties = {
    backgroundColor: cfg.backgroundColor,
    color: cfg.color,
    borderBottomColor: cfg.borderColor,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
  };

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ backgroundColor: cfg.backgroundColor, color: cfg.color }}
    >
      {/* ── Toolbar ── */}
      <header className="px-md py-sm flex shrink-0 items-center" style={tbStyle}>
        {/* Left: book title (+ page badge for EPUB) */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BookOpen className="h-5 w-5 shrink-0 opacity-60" />
          <span className="truncate text-sm font-semibold">{book.title}</span>
          {fileType === 'epub' && currentPage !== null && (
            <Badge
              variant="secondary"
              className="shrink-0 text-xs"
              style={{ backgroundColor: withAlpha(cfg.color, 0.1), color: cfg.color }}
            >
              p. {currentPage}
            </Badge>
          )}
        </div>

        {/* Center: PDF page navigation */}
        {fileType === 'pdf' && (
          <div className="gap-xs flex shrink-0 items-center">
            <Button
              aria-label={t('common.table.previousPage')}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPdfPage((currentPage ?? 1) - 1)}
              disabled={(currentPage ?? 1) <= 1}
              style={{ color: cfg.color }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="gap-sm flex items-center text-sm">
              <Input
                className="h-7 w-14 text-center text-sm"
                value={pageInput}
                placeholder="1"
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') goToPdfPage(parseInt(pageInput) || 1);
                }}
                onBlur={() => goToPdfPage(parseInt(pageInput) || 1)}
                style={{
                  color: cfg.color,
                  backgroundColor: `${cfg.backgroundColor}`,
                  borderColor: cfg.borderColor,
                }}
              />
              <span className="opacity-70" style={{ color: cfg.color }}>
                / {numPages}
              </span>
            </div>
            <Button
              aria-label={t('common.table.nextPage')}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPdfPage((currentPage ?? 1) + 1)}
              disabled={(currentPage ?? 1) >= numPages}
              style={{ color: cfg.color }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Right: controls */}
        <div className="gap-xs flex flex-1 shrink-0 items-center justify-end">
          {/* Width controls */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleWidthChange(-1)}
            disabled={WIDTH_PRESETS.indexOf(contentWidth) === 0}
            title={t('pages.bookReader.decreaseWidth')}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs opacity-70">
            {contentWidth}px
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleWidthChange(1)}
            disabled={WIDTH_PRESETS.indexOf(contentWidth) === WIDTH_PRESETS.length - 1}
            title={t('pages.bookReader.increaseWidth')}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <div
            className="mx-xs h-4 w-px opacity-20"
            style={{ backgroundColor: cfg.color }}
          />

          {/* Theme switcher */}
          {(Object.keys(themes) as ReaderTheme[]).map((themeKey) => (
            <Button
              key={themeKey}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleThemeChange(themeKey)}
              title={t(
                `pages.bookReader.theme${themeKey.charAt(0).toUpperCase()}${themeKey.slice(1)}`
              )}
              style={
                theme === themeKey
                  ? {
                      backgroundColor: withAlpha(themes[themeKey].color, 0.12),
                      color: themes[themeKey].color,
                    }
                  : { color: cfg.color }
              }
            >
              {themes[themeKey].icon}
            </Button>
          ))}

          <div
            className="mx-xs h-4 w-px opacity-20"
            style={{ backgroundColor: cfg.color }}
          />

          {/* Annotations toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={t('pages.bookReader.annotations')}
            style={
              sidebarOpen
                ? { backgroundColor: withAlpha(cfg.color, 0.12), color: cfg.color }
                : { color: cfg.color }
            }
          >
            <PanelRight className="h-4 w-4" />
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClose}
            title={t('pages.bookReader.closeReader')}
            style={{ color: cfg.color }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Reading area ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {fileType === 'epub' ? (
            <EpubReader
              url={fileUrl}
              theme={theme}
              width={contentWidth}
              initialCfi={currentCfi}
              isDark={isDark}
              onLocationChange={handleEpubLocationChange}
            />
          ) : (
            <PdfReader
              url={fileUrl}
              theme={theme}
              width={contentWidth}
              pageNumber={currentPage ?? 1}
              isDark={isDark}
              onNumPagesChange={setNumPages}
            />
          )}
        </main>

        {/* ── Annotations sidebar ── */}
        {sidebarOpen && (
          <aside
            className="flex w-80 shrink-0 flex-col overflow-hidden"
            style={{
              backgroundColor: cfg.backgroundColor,
              color: cfg.color,
              borderLeftWidth: 1,
              borderLeftStyle: 'solid',
              borderLeftColor: cfg.borderColor,
            }}
          >
            {/* Sidebar header */}
            <div
              className="py-sm flex items-center justify-between px-3"
              style={{
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: cfg.borderColor,
              }}
            >
              <div className="gap-sm flex items-center">
                <Highlighter className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t('pages.bookReader.annotations')} ({annotations.length})
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowAnnotationForm(!showAnnotationForm)}
                title={t('pages.bookReader.addAnnotation')}
                style={{ color: cfg.color }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 space-y-3 p-3">
              {showAnnotationForm && ownerId > 0 && (
                <AnnotationForm
                  bookId={book.id}
                  ownerId={ownerId}
                  currentPage={currentPage}
                  onSaved={handleAnnotationSaved}
                  onCancel={() => setShowAnnotationForm(false)}
                />
              )}

              {annotations.length === 0 && !showAnnotationForm && (
                <EmptyState
                  title={t('pages.bookReader.noAnnotations')}
                  icon={<Highlighter />}
                />
              )}

              <PaginatedSlide
                items={annotations}
                pageSize={DETAIL_TEXT_PAGE_SIZE}
                pinNav={false}
                className="space-y-3"
              >
                {(pageAnnotations) =>
                  pageAnnotations.map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-lg border p-3 text-sm ${highlightBg(a.color)}`}
                    >
                      <div className="mb-xs gap-xs flex items-start justify-between">
                        <div className="gap-xs flex flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {t(HIGHLIGHT_TYPE_KEY[a.highlight_type] ?? '', {
                              defaultValue: a.highlight_type_display,
                            })}
                          </Badge>
                          {a.page_number && (
                            <Badge variant="outline" className="text-xs">
                              {t('pages.highlights.pageShort', { page: a.page_number })}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => void handleDeleteAnnotation(a.id)}
                          aria-label={t('pages.bookReader.removeAnnotation')}
                        >
                          <Trash2 className={cn('h-3.5 w-3.5', ACTION_COLOR.delete)} />
                        </Button>
                      </div>
                      <p className="leading-snug">{a.text}</p>
                      {a.chapter && (
                        <p className="mt-xs text-xs opacity-60">{a.chapter}</p>
                      )}
                    </div>
                  ))
                }
              </PaginatedSlide>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
