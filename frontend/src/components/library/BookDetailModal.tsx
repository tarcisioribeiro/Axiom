import {
  BookOpen,
  Calendar,
  Edit,
  Globe,
  Hash,
  Library,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { formatDate } from '@/lib/formatters';
import type { Book } from '@/types';

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

export function BookDetailModal({
  book,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: BookDetailModalProps) {
  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{book.title}</DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
