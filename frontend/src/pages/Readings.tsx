import { Plus, Edit, Trash2, BookMarked, BookOpen, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { ReadingForm } from '@/components/library/ReadingForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { booksService } from '@/services/books-service';
import { readingsService } from '@/services/readings-service';
import type { Reading, ReadingFormData, Book } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

export default function Readings() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReading, setSelectedReading] = useState<Reading | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [readingsData, booksData] = await Promise.all([
        readingsService.getAll(),
        booksService.getAll(),
      ]);
      setReadings(readingsData);
      setBooks(booksData);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar dados',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (books.length === 0) {
      toast({
        title: 'Ação não permitida',
        description:
          'É necessário ter pelo menos um livro cadastrado antes de registrar uma leitura.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedReading(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (reading: Reading) => {
    setSelectedReading(reading);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: 'Excluir leitura',
      description:
        'Tem certeza que deseja excluir esta leitura? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await readingsService.delete(id);
      toast({
        title: 'Leitura excluída',
        description: 'A leitura foi excluída com sucesso.',
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir leitura',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: ReadingFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedReading) {
        await readingsService.update(selectedReading.id, data);
        toast({
          title: 'Leitura atualizada',
          description: 'A leitura foi atualizada com sucesso.',
        });
      } else {
        await readingsService.create(data);
        toast({
          title: 'Leitura registrada',
          description: 'A leitura foi registrada com sucesso.',
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

  const filteredReadings = readings.filter(
    (reading) =>
      reading.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reading.notes?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Leituras"
        icon={<BookMarked />}
        action={{
          label: 'Nova Leitura',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex items-center gap-4">
        <SearchInput
          placeholder="Buscar leituras..."
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="flex-1"
        />
      </div>

      {filteredReadings.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? 'Nenhuma leitura encontrada para a pesquisa atual.'
              : 'Nenhuma leitura registrada. Clique em "Nova Leitura" para começar.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReadings.map((reading) => (
            <Card key={reading.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 flex-shrink-0" />
                      <CardTitle className="truncate text-base">
                        {reading.book_title}
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(reading.reading_date, 'dd/MM/yyyy')}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {reading.pages_read} pág.
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(reading)}
                      aria-label="Editar"
                    >
                      <Edit className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(reading.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {reading.notes && (
                <CardContent className="pt-0">
                  <p className="line-clamp-3 text-sm">{reading.notes}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedReading ? 'Editar' : 'Registrar'} Leitura
            </DialogTitle>
            <DialogDescription>
              {selectedReading
                ? 'Atualize as informações da leitura'
                : 'Registre o progresso de leitura de um livro'}
            </DialogDescription>
          </DialogHeader>
          <ReadingForm
            reading={selectedReading}
            books={books}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
