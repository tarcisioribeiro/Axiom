import { Plus, BookOpen, TrendingUp, Edit, Trash2, Star } from 'lucide-react';
import { useState, useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { BookForm } from '@/components/library/BookForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { authorsService } from '@/services/authors-service';
import { booksService } from '@/services/books-service';
import { publishersService } from '@/services/publishers-service';
import type { Book, BookFormData, Author, Publisher } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [booksData, authorsData, publishersData] = await Promise.all([
        booksService.getAll(),
        authorsService.getAll(),
        publishersService.getAll(),
      ]);
      setBooks(booksData);
      setAuthors(authorsData);
      setPublishers(publishersData);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    if (authors.length === 0 || publishers.length === 0) {
      const missing = [];
      if (authors.length === 0) missing.push('autores');
      if (publishers.length === 0) missing.push('editoras');

      toast({
        title: 'Ação não permitida',
        description: `É necessário ter ${missing.join(' e ')} cadastrados antes de criar um livro.`,
        variant: 'destructive',
      });
      return;
    }
    setSelectedBook(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (book: Book) => {
    setSelectedBook(book);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir livro',
      description:
        'Tem certeza que deseja excluir este livro? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await booksService.delete(id);
      toast({
        title: 'Livro excluído',
        description: 'O livro foi excluído com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir livro',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: BookFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedBook) {
        await booksService.update(selectedBook.id, data);
        toast({
          title: 'Livro atualizado',
          description: 'O livro foi atualizado com sucesso.',
        });
      } else {
        await booksService.create(data);
        toast({
          title: 'Livro criado',
          description: 'O livro foi criado com sucesso.',
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.authors_names.some((author) =>
        author.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      book.publisher_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusVariant = (status: string): 'success' | 'info' | 'warning' => {
    switch (status) {
      case 'read':
        return 'success';
      case 'reading':
        return 'info';
      case 'to_read':
        return 'warning';
      default:
        return 'warning';
    }
  };

  const renderStars = (rating: number | null) => {
    if (rating === null || rating === 0) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-star text-star'
                : 'fill-muted text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Biblioteca"
        icon={<BookOpen />}
        action={{
          label: 'Novo Livro',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex gap-4">
        <SearchInput
          placeholder="Buscar livros, autores ou editoras..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredBooks.map((book) => (
          <Card key={book.id} className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="line-clamp-2 text-lg">{book.title}</CardTitle>
                  <CardDescription className="line-clamp-1">
                    {book.authors_names.join(', ')}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(book)}
                    aria-label="Editar"
                  >
                    <Edit className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(book.id)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant={getStatusVariant(book.read_status)}>
                    {book.read_status_display}
                  </Badge>
                  <Badge variant="secondary">{book.genre_display}</Badge>
                </div>

                {book.rating !== null && book.rating > 0 && (
                  <div className="flex items-center gap-2">
                    {renderStars(book.rating)}
                  </div>
                )}

                {book.synopsis && (
                  <p className="line-clamp-2 text-sm">{book.synopsis}</p>
                )}

                <div className="text-sm">{book.publisher_name}</div>

                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4" />
                  <span>{book.pages} páginas</span>
                  {book.media_type_display && (
                    <>
                      <span>•</span>
                      <span>{book.media_type_display}</span>
                    </>
                  )}
                </div>

                {book.reading_progress > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Progresso
                      </span>
                      <span className="font-medium">{book.reading_progress}%</span>
                    </div>
                    <Progress value={book.reading_progress} className="h-2" />
                    <p className="text-xs">
                      {book.total_pages_read} de {book.pages} páginas lidas
                    </p>
                  </div>
                )}

                {book.has_summary && (
                  <Badge variant="outline" className="w-full justify-center">
                    ✓ Possui resumo
                  </Badge>
                )}

                <div className="pt-2 text-xs">
                  {book.publish_date
                    ? `Publicado em ${formatDate(book.publish_date, 'dd/MM/yyyy')}`
                    : `Adicionado em ${formatDate(book.created_at, 'dd/MM/yyyy')}`}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBooks.length === 0 && (
        <EmptyState
          icon={<BookOpen className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhum livro encontrado para a pesquisa atual.'
              : 'Nenhum livro cadastrado. Clique em "Novo Livro" para começar.'
          }
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBook ? 'Editar' : 'Novo'} Livro</DialogTitle>
            <DialogDescription>
              {selectedBook
                ? 'Atualize as informações do livro'
                : 'Adicione um novo livro à sua biblioteca'}
            </DialogDescription>
          </DialogHeader>
          <BookForm
            book={selectedBook}
            authors={authors}
            publishers={publishers}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
