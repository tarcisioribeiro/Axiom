import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Filter,
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

const COLOR_OPTIONS = [
  { value: 'yellow', label: 'Amarelo', bg: '#facc15' },
  { value: 'green', label: 'Verde', bg: '#4ade80' },
  { value: 'blue', label: 'Azul', bg: '#60a5fa' },
  { value: 'pink', label: 'Rosa', bg: '#f472b6' },
  { value: 'orange', label: 'Laranja', bg: '#fb923c' },
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
    <div className={`rounded-lg border-l-4 p-4 ${colorDef.card}`}>
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type badge with icon */}
          <Badge
            variant={TYPE_VARIANT[highlight.highlight_type] ?? 'default'}
            className="flex items-center gap-1"
          >
            {TYPE_ICON[highlight.highlight_type]}
            {highlight.highlight_type_display}
          </Badge>

          {highlight.page_number && (
            <span className="rounded bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground">
              p. {highlight.page_number}
            </span>
          )}
          {highlight.chapter && (
            <span className="rounded bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground">
              {highlight.chapter}
            </span>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
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
        <blockquote className="relative pl-4">
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
      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-2 dark:border-white/5">
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
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hl-book">Livro</Label>
        <Select value={bookId} onValueChange={setBookId}>
          <SelectTrigger id="hl-book">
            <SelectValue placeholder="Selecione um livro" />
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

      <div className="space-y-2">
        <Label htmlFor="hl-text">Texto do destaque</Label>
        <Textarea
          id="hl-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole aqui o trecho do livro..."
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hl-type">Tipo</Label>
          <Select
            value={highlightType}
            onValueChange={(v) => setHighlightType(v as typeof highlightType)}
          >
            <SelectTrigger id="hl-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">
                <div className="flex items-center gap-2">
                  <Quote className="h-3.5 w-3.5" /> Citação
                </div>
              </SelectItem>
              <SelectItem value="note">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-3.5 w-3.5" /> Nota
                </div>
              </SelectItem>
              <SelectItem value="idea">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5" /> Ideia
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hl-color">Cor</Label>
          <Select value={color} onValueChange={(v) => setColor(v as typeof color)}>
            <SelectTrigger id="hl-color">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: opt.bg }}
                    />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hl-page">Página (opcional)</Label>
          <Input
            id="hl-page"
            type="number"
            min={1}
            value={pageNumber}
            onChange={(e) => setPageNumber(e.target.value)}
            placeholder="Ex: 42"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hl-chapter">Capítulo (opcional)</Label>
          <Input
            id="hl-chapter"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Ex: Cap. 3"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !bookId || !text.trim()}>
          {isLoading ? 'Salvando...' : 'Salvar'}
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
      title: 'Excluir destaque',
      description: 'Tem certeza que deseja excluir este destaque?',
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await bookHighlightsService.delete(id);
      toast({ title: 'Destaque excluído' });
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
        toast({ title: 'Destaque atualizado' });
      } else {
        await bookHighlightsService.create(data);
        toast({ title: 'Destaque salvo' });
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
        title: 'Erro ao exportar',
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
        title="Destaques"
        icon={<Highlighter />}
        action={{
          label: 'Novo Destaque',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Buscar destaques..."
          value={searchTerm}
          onValueChange={(v) => {
            setSearchTerm(v);
            setCurrentPage(1);
          }}
          className="max-w-sm"
        />
        <Filter className="h-4 w-4 text-muted-foreground" />

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
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="quote">
              <div className="flex items-center gap-2">
                <Quote className="h-3.5 w-3.5" /> Citação
              </div>
            </SelectItem>
            <SelectItem value="note">
              <div className="flex items-center gap-2">
                <StickyNote className="h-3.5 w-3.5" /> Nota
              </div>
            </SelectItem>
            <SelectItem value="idea">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5" /> Ideia
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
            <SelectItem value="all">Todas as cores</SelectItem>
            {COLOR_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-black/10"
                    style={{ backgroundColor: opt.bg }}
                  />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {highlights.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exportando...' : 'Exportar'}
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhum destaque encontrado para a pesquisa atual.'
              : 'Nenhum destaque registrado. Clique em "Novo Destaque" para começar.'
          }
        />
      ) : (
        <>
          <div className="space-y-4">
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
              <div className="flex items-center gap-1">
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
              {editingHighlight ? 'Editar Destaque' : 'Novo Destaque'}
            </DialogTitle>
            <DialogDescription>
              {editingHighlight
                ? 'Edite os dados do destaque.'
                : 'Adicione um novo destaque, citação ou nota de um livro.'}
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
