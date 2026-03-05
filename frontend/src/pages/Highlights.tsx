import {
  BookMarked,
  Download,
  Edit,
  Highlighter,
  Plus,
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

function HighlightCard({
  highlight,
  onEdit,
  onDelete,
}: {
  highlight: BookHighlight;
  onEdit: (h: BookHighlight) => void;
  onDelete: (id: number) => void;
}) {
  const colorClass = COLOR_CLASSES[highlight.color] ?? COLOR_CLASSES.yellow;

  return (
    <div className={`rounded-lg border-l-4 p-4 ${colorClass}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TYPE_VARIANT[highlight.highlight_type] ?? 'default'}>
            {highlight.highlight_type_display}
          </Badge>
          {highlight.page_number && (
            <span className="text-xs text-muted-foreground">p. {highlight.page_number}</span>
          )}
          {highlight.chapter && (
            <span className="text-xs text-muted-foreground">{highlight.chapter}</span>
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {highlight.book_title}
          </span>
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
      <p className="text-sm leading-relaxed">{highlight.text}</p>
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
  const [highlightType, setHighlightType] = useState(highlight?.highlight_type ?? 'quote');
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
          <Select value={highlightType} onValueChange={(v) => setHighlightType(v as typeof highlightType)}>
            <SelectTrigger id="hl-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">Citação</SelectItem>
              <SelectItem value="note">Nota</SelectItem>
              <SelectItem value="idea">Ideia</SelectItem>
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
              <SelectItem value="yellow">Amarelo</SelectItem>
              <SelectItem value="green">Verde</SelectItem>
              <SelectItem value="blue">Azul</SelectItem>
              <SelectItem value="pink">Rosa</SelectItem>
              <SelectItem value="orange">Laranja</SelectItem>
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<BookHighlight | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
        title: 'Erro ao exportar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Client-side filtering
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

      <div className="flex items-center gap-2">
        <SearchInput
          placeholder="Buscar destaques..."
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
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exportando...' : 'Exportar MD'}
          </Button>
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
        <div className="space-y-3">
          {filtered.map((h) => (
            <HighlightCard
              key={h.id}
              highlight={h}
              onEdit={handleEdit}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
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
