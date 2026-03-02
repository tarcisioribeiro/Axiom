import { Plus, Edit, Trash2, BookMarked, BookOpen, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
        title: t('common.messages.loadError'),
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
        title: t('common.messages.actionDenied'),
        description: t('pages.readings.noBookMsg'),
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
      title: t('pages.readings.deleteTitle'),
      description: t('pages.readings.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await readingsService.delete(id);
      toast({
        title: t('pages.readings.deleted'),
        description: t('pages.readings.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('common.messages.deleteError'),
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
          title: t('pages.readings.updated'),
          description: t('pages.readings.updatedDesc'),
        });
      } else {
        await readingsService.create(data);
        toast({
          title: t('pages.readings.created'),
          description: t('pages.readings.createdDesc'),
        });
      }
      setIsDialogOpen(false);
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

  const filteredReadings = readings.filter(
    (reading) =>
      reading.book_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.readings.title')}
        icon={<BookMarked />}
        action={{
          label: t('pages.readings.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      <div className="flex items-center gap-4">
        <SearchInput
          placeholder={t('pages.readings.searchPlaceholder')}
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
              ? t('pages.readings.emptySearch')
              : t('pages.readings.emptyState')
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
                        {t('pages.readings.pagesRead', { count: reading.pages_read })}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(reading)}
                      aria-label={t('common.actions.edit')}
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(reading.id)}
                      aria-label={t('common.actions.delete')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
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
              {selectedReading
                ? t('pages.readings.editTitle')
                : t('pages.readings.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedReading
                ? t('pages.readings.editDesc')
                : t('pages.readings.newDesc')}
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
