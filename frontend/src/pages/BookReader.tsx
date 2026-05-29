/* eslint-disable max-lines */
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
  Save,
  Sun,
  X,
} from 'lucide-react';
// Configure PDF.js worker via Vite ?url import for reliable asset bundling
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useParams } from 'react-router-dom';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface BookReaderProps {
  /** When provided, the reader runs embedded (modal mode) using this book id. */
  bookIdProp?: number;
  /** Called when the user closes the reader in modal mode. */
  onClose?: () => void;
}

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
import { bookHighlightsService } from '@/services/book-highlights-service';
import { booksService } from '@/services/books-service';
import { membersService } from '@/services/members-service';
import { readingsService } from '@/services/readings-service';
import type { Book, BookHighlight, BookHighlightFormData } from '@/types';
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
  label: string;
  backgroundColor: string;
  color: string;
  borderColor: string;
  icon: React.ReactNode;
  epubBody: { background: string; color: string; linkColor: string };
}

// ============================================================================
// THEME DEFINITIONS — 6 variants: 3 reader modes × 2 app themes (Alucard/Dracula)
// Colors are derived from the active app palette so the reader is visually
// coherent with the rest of the UI.  All values are concrete (no CSS vars) so
// they can be safely injected into EPUB iframes without resolution.
// ============================================================================

function buildThemes(isDark: boolean): Record<ReaderTheme, ThemeConfig> {
  if (isDark) {
    // ── Dracula palette variants ─────────────────────────────────────────────
    return {
      light: {
        label: 'Claro',
        backgroundColor: '#ECEEF8', // very light cool blue-grey (Dracula-tinted)
        color: '#21222C', // Dracula near-black
        borderColor: '#B0BAD4',
        icon: <Sun className="h-4 w-4" />,
        epubBody: { background: '#ECEEF8', color: '#21222C', linkColor: '#1D4ED8' },
      },
      sepia: {
        label: 'Sépia',
        backgroundColor: '#E8E2F5', // cool lavender parchment (Dracula purple-tinted)
        color: '#3D2852', // deep purple-brown
        borderColor: '#9478C2',
        icon: <Palette className="h-4 w-4" />,
        epubBody: { background: '#E8E2F5', color: '#3D2852', linkColor: '#6D28D9' },
      },
      dark: {
        label: 'Escuro',
        backgroundColor: '#282A36', // Dracula background
        color: '#F8F8F2', // Dracula foreground
        borderColor: '#44475A', // Dracula current-line
        icon: <Moon className="h-4 w-4" />,
        epubBody: { background: '#282A36', color: '#F8F8F2', linkColor: '#8BE9FD' },
      },
    };
  }
  // ── Alucard palette variants ───────────────────────────────────────────────
  return {
    light: {
      label: 'Claro',
      backgroundColor: '#FFFBEB', // Alucard warm cream (hsl 48 100% 96%)
      color: '#1F1F1F',
      borderColor: '#C8C4D8',
      icon: <Sun className="h-4 w-4" />,
      epubBody: { background: '#FFFBEB', color: '#1F1F1F', linkColor: '#2563EB' },
    },
    sepia: {
      label: 'Sépia',
      backgroundColor: '#F5E6C8', // warm golden parchment (Alucard amber tones)
      color: '#5C3D2E', // warm dark brown
      borderColor: '#C8A870',
      icon: <Palette className="h-4 w-4" />,
      epubBody: { background: '#F5E6C8', color: '#5C3D2E', linkColor: '#2563EB' },
    },
    dark: {
      label: 'Escuro',
      backgroundColor: '#1A0E08', // very dark warm brown (Alucard inverted)
      color: '#F5EDD6', // warm cream
      borderColor: '#4A3020',
      icon: <Moon className="h-4 w-4" />,
      epubBody: { background: '#1A0E08', color: '#F5EDD6', linkColor: '#F5A623' },
    },
  };
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

const HIGHLIGHT_COLORS: { value: string; label: string; dot: string }[] = [
  { value: 'yellow', label: 'Amarelo', dot: 'bg-yellow-400' },
  { value: 'green', label: 'Verde', dot: 'bg-green-400' },
  { value: 'blue', label: 'Azul', dot: 'bg-blue-400' },
  { value: 'pink', label: 'Rosa', dot: 'bg-pink-400' },
  { value: 'orange', label: 'Laranja', dot: 'bg-orange-400' },
];

const COLOR_BG: Record<string, string> = {
  yellow: 'border-l-yellow-400 bg-yellow-50',
  green: 'border-l-green-400 bg-green-50',
  blue: 'border-l-blue-400 bg-blue-50',
  pink: 'border-l-pink-400 bg-pink-50',
  orange: 'border-l-orange-400 bg-orange-50',
};

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
    if (!text.trim()) return;
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
      toast({ title: 'Anotação salva' });
    } catch (err) {
      toast({
        title: t('pages.bookReader.annotationError'),
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {t('pages.bookReader.newAnnotation')}
        </span>
        {currentPage && (
          <Badge variant="secondary" className="text-xs">
            p. {currentPage}
          </Badge>
        )}
      </div>
      <Textarea
        placeholder={t('pages.bookReader.annotationPlaceholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex gap-sm">
        <div className="flex-1">
          <Label className="mb-xs block text-xs">
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
          <Label className="mb-xs block text-xs">
            {t('pages.bookReader.colorLabel')}
          </Label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HIGHLIGHT_COLORS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="flex items-center gap-sm">
                    <span className={`inline-block h-3 w-3 rounded-full ${c.dot}`} />
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-sm">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          size="sm"
          disabled={!text.trim() || isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? (
            <Loader2 className="mr-xs h-3 w-3 animate-spin" />
          ) : (
            <Save className="mr-xs h-3 w-3" />
          )}
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
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border p-sm shadow backdrop-blur-sm"
        style={{
          backgroundColor: `${cfg.backgroundColor}cc`,
          borderColor: cfg.borderColor,
          color: cfg.color,
        }}
        aria-label={t('pages.bookReader.prevPage')}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border p-sm shadow backdrop-blur-sm"
        style={{
          backgroundColor: `${cfg.backgroundColor}cc`,
          borderColor: cfg.borderColor,
          color: cfg.color,
        }}
        aria-label={t('pages.bookReader.nextPage')}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
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
        className="flex flex-1 items-start justify-center overflow-auto py-lg"
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
            <div className="flex h-64 flex-col items-center justify-center gap-sm opacity-60">
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

export default function BookReader({ bookIdProp, onClose }: BookReaderProps = {}) {
  const { t } = useTranslation();
  const { bookId: bookIdParam } = useParams<{ bookId: string }>();
  const bookId = bookIdProp !== undefined ? String(bookIdProp) : bookIdParam;
  const { toast } = useToast();
  const { isDark } = useTheme();

  // Close via callback (modal) or window.close() (standalone tab)
  const handleClose = onClose ?? (() => window.close());

  // Escape key closes modal
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const [book, setBook] = useState<Book | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'epub' | 'pdf' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  const [annotations, setAnnotations] = useState<BookHighlight[]>([]);
  const [ownerId, setOwnerId] = useState<number>(0);

  // PDF pagination (lifted from PdfReader so the toolbar can own the nav)
  const [numPages, setNumPages] = useState(0);
  const [pageInput, setPageInput] = useState('1');

  // Progress tracking
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);
  const [latestReadingId, setLatestReadingId] = useState<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bookId) return;
    void loadAll(parseInt(bookId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const loadAll = async (id: number) => {
    try {
      setIsLoading(true);
      const [bookData, fileData, readingsData, highlights, member] = await Promise.all([
        booksService.getById(id),
        booksService.getBookFileUrl(id),
        readingsService.getAll({ book: id }),
        bookHighlightsService.getByBook(id),
        membersService.getCurrentUserMember(),
      ]);

      setBook(bookData);
      // Stream via Django proxy (same-origin) to avoid CORS restrictions from PDF.js worker
      const streamUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BOOK_FILE_STREAM}${id}/file/stream/`;
      setFileUrl(streamUrl);
      setAnnotations(highlights);
      setOwnerId(member.id);

      const ext = fileData.name.split('.').pop()?.toLowerCase();
      const isEpub = ext === 'epub';
      setFileType(isEpub ? 'epub' : 'pdf');

      if (readingsData.length > 0) {
        const latest = [...readingsData].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];
        setLatestReadingId(latest.id);
        if (latest.current_page) {
          setCurrentPage(latest.current_page);
          setPageInput(String(latest.current_page));
        }
        if (isEpub && latest.current_cfi) {
          setCurrentCfi(latest.current_cfi);
        }
      }
    } catch (err) {
      toast({
        title: 'Erro ao carregar livro',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
              reading_date: new Date().toISOString().split('T')[0],
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
        title: 'Erro ao remover',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!book || !fileUrl || !fileType) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-md bg-background">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">
          {t('pages.bookReader.fileNotFound')}
        </p>
        <Button variant="outline" onClick={handleClose}>
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
      <header className="flex shrink-0 items-center px-md py-sm" style={tbStyle}>
        {/* Left: book title (+ page badge for EPUB) */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BookOpen className="h-5 w-5 shrink-0 opacity-60" />
          <span className="truncate text-sm font-semibold">{book.title}</span>
          {fileType === 'epub' && currentPage !== null && (
            <Badge
              variant="secondary"
              className="shrink-0 text-xs"
              style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
            >
              p. {currentPage}
            </Badge>
          )}
        </div>

        {/* Center: PDF page navigation */}
        {fileType === 'pdf' && (
          <div className="flex shrink-0 items-center gap-xs">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPdfPage((currentPage ?? 1) - 1)}
              disabled={(currentPage ?? 1) <= 1}
              style={{ color: cfg.color }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-sm text-sm">
              <Input
                className="h-7 w-14 text-center text-sm"
                value={pageInput}
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
        <div className="flex flex-1 shrink-0 items-center justify-end gap-xs">
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
          {(Object.keys(themes) as ReaderTheme[]).map((t) => (
            <Button
              key={t}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleThemeChange(t)}
              title={themes[t].label}
              style={
                theme === t
                  ? {
                      backgroundColor: `${themes[t].color}20`,
                      color: themes[t].color,
                    }
                  : { color: cfg.color }
              }
            >
              {themes[t].icon}
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
                ? { backgroundColor: `${cfg.color}20`, color: cfg.color }
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
              className="flex items-center justify-between px-3 py-sm"
              style={{
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: cfg.borderColor,
              }}
            >
              <div className="flex items-center gap-sm">
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
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
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
                <div className="flex flex-col items-center gap-sm py-xl text-center text-sm opacity-50">
                  <Highlighter className="h-8 w-8" />
                  <p>{t('pages.bookReader.noAnnotations')}</p>
                  <p className="text-xs">Clique em + para adicionar.</p>
                </div>
              )}

              {annotations.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border-l-4 p-3 text-sm ${COLOR_BG[a.color] ?? 'border-l-gray-300 bg-gray-50'}`}
                >
                  <div className="mb-xs flex items-start justify-between gap-xs">
                    <div className="flex flex-wrap gap-xs">
                      <Badge variant="secondary" className="text-xs">
                        {a.highlight_type_display}
                      </Badge>
                      {a.page_number && (
                        <Badge variant="outline" className="text-xs">
                          p. {a.page_number}
                        </Badge>
                      )}
                    </div>
                    <button
                      onClick={() => void handleDeleteAnnotation(a.id)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                      aria-label={t('pages.bookReader.removeAnnotation')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="leading-snug">{a.text}</p>
                  {a.chapter && <p className="mt-xs text-xs opacity-60">{a.chapter}</p>}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
