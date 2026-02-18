import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/common/SearchInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getErrorMessage } from '@/utils/error-utils';
import { authorsService } from '@/services/authors-service';
import type { Author, AuthorFormData } from '@/types';
import { Plus, Edit, Trash2, BookOpen, User, UserPen, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { AuthorForm } from '@/components/library/AuthorForm';
import { PageContainer } from '@/components/common/PageContainer';

export default function Authors() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    loadAuthors();
  }, []);

  const loadAuthors = async () => {
    try {
      setLoading(true);
      const data = await authorsService.getAll();
      setAuthors(data);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar autores',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedAuthor(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (author: Author) => {
    setSelectedAuthor(author);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir autor',
      description: 'Tem certeza que deseja excluir este autor? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await authorsService.delete(id);
      toast({
        title: 'Autor excluído',
        description: 'O autor foi excluído com sucesso.',
      });
      loadAuthors();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir autor',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: AuthorFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedAuthor) {
        await authorsService.update(selectedAuthor.id, data);
        toast({
          title: 'Autor atualizado',
          description: 'O autor foi atualizado com sucesso.',
        });
      } else {
        await authorsService.create(data);
        toast({
          title: 'Autor criado',
          description: 'O autor foi criado com sucesso.',
        });
      }
      setIsDialogOpen(false);
      loadAuthors();
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

  const filteredAuthors = authors.filter(
    (author) =>
      author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (author.nationality?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Autores"
        icon={<UserPen />}
        action={{
          label: 'Novo Autor',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex items-center gap-4">
        <SearchInput
          placeholder="Buscar autores..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="flex-1"
        />
      </div>

      {filteredAuthors.length === 0 ? (
        <EmptyState
          icon={<User className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhum autor encontrado para a pesquisa atual.'
              : 'Nenhum autor cadastrado. Clique em "Novo Autor" para começar.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAuthors.map((author) => (
            <Card key={author.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{author.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {author.nationality_display}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(author)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(author.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(author.birth_year || author.death_year) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {author.birth_year && (
                        <>
                          {author.birth_year} {author.birth_era_display || ''}
                        </>
                      )}
                      {author.death_year && (
                        <>
                          {' - '}
                          {author.death_year} {author.death_era_display || ''}
                        </>
                      )}
                    </span>
                  </div>
                )}
                {author.biography && (
                  <p className="text-sm line-clamp-3">
                    {author.biography}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm">
                    {author.books_count} {author.books_count === 1 ? 'livro' : 'livros'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAuthor ? 'Editar' : 'Novo'} Autor
            </DialogTitle>
            <DialogDescription>
              {selectedAuthor
                ? 'Atualize as informações do autor'
                : 'Adicione um novo autor à sua biblioteca'}
            </DialogDescription>
          </DialogHeader>
          <AuthorForm
            author={selectedAuthor}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
