import {
  BookOpen,
  Calendar,
  Download,
  Edit,
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
} from 'lucide-react';
import { useState, useEffect } from 'react';

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
        title: 'Erro ao salvar destaque',
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
        placeholder="Texto do destaque..."
        rows={3}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={highlightType}
            onValueChange={(v) => setHighlightType(v as typeof highlightType)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">Citação</SelectItem>
              <SelectItem value="note">Nota</SelectItem>
              <SelectItem value="idea">Ideia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cor</Label>
          <Select value={color} onValueChange={(v) => setColor(v as typeof color)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yellow">Amarelo</SelectItem>
              <SelectItem value="green">Verde</SelectItem>
              <SelectItem value="blue">Azul</SelectItem>
              <SelectItem value="pink">Rosa</SelectItem>
              <SelectItem value="orange">Laranja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min={1}
          placeholder="Página"
          value={pageNumber}
          onChange={(e) => setPageNumber(e.target.value)}
          className="h-8 text-xs"
        />
        <Input
          placeholder="Capítulo"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isSaving || !text.trim()}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

interface BookDetailModalProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: number) => void;
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
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

type ActiveTab = 'info' | 'highlights';

export function BookDetailModal({
  book,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: BookDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [isLoadingHighlights, setIsLoadingHighlights] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<BookHighlight | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const { showConfirm } = useAlertDialog();
  const { toast } = useToast();

  useEffect(() => {
    if (book && open && activeTab === 'highlights') {
      void loadHighlights();
    }
  }, [book, open, activeTab]);

  // Reset tab when a different book is opened
  useEffect(() => {
    if (!open) {
      setActiveTab('info');
      setShowAddForm(false);
      setEditingHighlight(undefined);
    }
  }, [open]);

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

  const handleDeleteHighlight = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir destaque',
      description: 'Tem certeza que deseja excluir este destaque?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await bookHighlightsService.delete(id);
      void loadHighlights();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir destaque',
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
        title: 'Erro ao exportar',
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
      <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{book.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes do livro {book.title}
          </DialogDescription>
        </DialogHeader>

        {/* Tab navigation */}
        <div className="flex gap-1 rounded-md border p-1">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'info'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Informações
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('highlights')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'highlights'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Highlighter className="h-3.5 w-3.5" />
            Destaques
          </button>
        </div>

        {/* Info tab */}
        {activeTab === 'info' && (
          <>
            {/* Top section: cover + main info */}
            <div className="flex gap-6">
              {/* Cover */}
              <div className="shrink-0">
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={`Capa de ${book.title}`}
                    className="h-48 w-32 rounded-md object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-48 w-32 items-center justify-center rounded-md border bg-muted shadow-sm">
                    <BookOpen className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Main info */}
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <h2 className="text-xl font-semibold leading-tight">{book.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {book.authors_names.join(', ')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant(book.read_status)}>
                    {book.read_status_display}
                  </Badge>
                  <Badge variant="secondary">{book.genre_display}</Badge>
                  {book.media_type_display && (
                    <Badge variant="outline">{book.media_type_display}</Badge>
                  )}
                  {book.has_summary && <Badge variant="outline">✓ Possui resumo</Badge>}
                </div>

                {book.rating !== null && book.rating > 0 && (
                  <StarRow rating={book.rating} />
                )}

                <div className="space-y-1.5">
                  <MetaRow
                    icon={<User className="h-4 w-4" />}
                    label="Editora"
                    value={book.publisher_name}
                  />
                  <MetaRow
                    icon={<BookOpen className="h-4 w-4" />}
                    label="Páginas"
                    value={`${book.pages} páginas`}
                  />
                  <MetaRow
                    icon={<Globe className="h-4 w-4" />}
                    label="Idioma"
                    value={book.language_display}
                  />
                  <MetaRow
                    icon={<Library className="h-4 w-4" />}
                    label="Tipo"
                    value={book.literarytype_display}
                  />
                  <MetaRow
                    icon={<Hash className="h-4 w-4" />}
                    label="Edição"
                    value={book.edition}
                  />
                  {book.publish_date && (
                    <MetaRow
                      icon={<Calendar className="h-4 w-4" />}
                      label="Publicação"
                      value={formatDate(book.publish_date, 'dd/MM/yyyy')}
                    />
                  )}
                  {book.genre_display && (
                    <MetaRow
                      icon={<Tag className="h-4 w-4" />}
                      label="Gênero"
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Progresso de Leitura
                    </span>
                    <span className="font-semibold">{book.reading_progress}%</span>
                  </div>
                  <Progress value={book.reading_progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {book.total_pages_read} de {book.pages} páginas lidas
                  </p>
                </div>
              </>
            )}

            {/* Synopsis */}
            {book.synopsis && book.synopsis !== 'Sem sinopse disponível.' && (
              <>
                <div className="border-t" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Sinopse</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {book.synopsis}
                  </p>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="border-t" />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(book.id);
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(book);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
          </> /* end info tab */
        )}

        {/* Highlights tab */}
        {activeTab === 'highlights' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {highlights.length} destaque{highlights.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                {highlights.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleExport()}
                    disabled={isExporting}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {isExporting ? 'Exportando...' : 'Exportar MD'}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingHighlight(undefined);
                    setShowAddForm(true);
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar
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
              <p className="py-4 text-center text-sm text-muted-foreground">
                Carregando destaques...
              </p>
            ) : highlights.length === 0 && !showAddForm ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum destaque ainda. Clique em &quot;Adicionar&quot; para começar.
              </p>
            ) : (
              <div className="space-y-2">
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
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
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
      </DialogContent>
    </Dialog>
  );
}
