import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/common/SearchInput';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getErrorMessage } from '@/utils/error-utils';
import { publishersService } from '@/services/publishers-service';
import type { Publisher, PublisherFormData } from '@/types';
import { Plus, Edit, Trash2, Building2, Globe, Calendar, BookOpen } from 'lucide-react';
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
import { PublisherForm } from '@/components/library/PublisherForm';
import { PageContainer } from '@/components/common/PageContainer';

export default function Publishers() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadPublishers();
  }, []);

  const loadPublishers = async () => {
    try {
      setLoading(true);
      const data = await publishersService.getAll();
      setPublishers(data);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar editoras',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPublisher(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (publisher: Publisher) => {
    setSelectedPublisher(publisher);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir editora',
      description:
        'Tem certeza que deseja excluir esta editora? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await publishersService.delete(id);
      toast({
        title: 'Editora excluída',
        description: 'A editora foi excluída com sucesso.',
      });
      void loadPublishers();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir editora',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: PublisherFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedPublisher) {
        await publishersService.update(selectedPublisher.id, data);
        toast({
          title: 'Editora atualizada',
          description: 'A editora foi atualizada com sucesso.',
        });
      } else {
        await publishersService.create(data);
        toast({
          title: 'Editora criada',
          description: 'A editora foi criada com sucesso.',
        });
      }
      setIsDialogOpen(false);
      void loadPublishers();
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

  const filteredPublishers = publishers.filter(
    (publisher) =>
      publisher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (publisher.country?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Editoras"
        icon={<Building2 />}
        action={{
          label: 'Nova Editora',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex items-center gap-4">
        <SearchInput
          placeholder="Buscar editoras..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="flex-1"
        />
      </div>

      {filteredPublishers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhuma editora encontrada para a pesquisa atual.'
              : 'Nenhuma editora cadastrada. Clique em "Nova Editora" para começar.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPublishers.map((publisher) => (
            <Card key={publisher.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{publisher.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {publisher.country_display}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(publisher)}
                      aria-label="Editar"
                    >
                      <Edit className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(publisher.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {publisher.founded_year && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Fundada em {publisher.founded_year}</span>
                  </div>
                )}
                {publisher.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <a
                      href={publisher.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-primary hover:underline"
                    >
                      {publisher.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">
                    {publisher.books_count}{' '}
                    {publisher.books_count === 1 ? 'livro' : 'livros'}
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
            <DialogTitle>{selectedPublisher ? 'Editar' : 'Nova'} Editora</DialogTitle>
            <DialogDescription>
              {selectedPublisher
                ? 'Atualize as informações da editora'
                : 'Adicione uma nova editora à sua biblioteca'}
            </DialogDescription>
          </DialogHeader>
          <PublisherForm
            publisher={selectedPublisher}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
