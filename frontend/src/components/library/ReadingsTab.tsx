/* eslint-disable max-lines */
import {
  Plus,
  Edit,
  Trash2,
  BookMarked,
  BookOpen,
  Calendar,
  Clock,
  BarChart2,
  CalendarRange,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { SearchInput } from '@/components/common/SearchInput';
import { ReadingForm } from '@/components/library/ReadingForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/utils';
import { booksService } from '@/services/books-service';
import { readingsService } from '@/services/readings-service';
import type { Reading, ReadingFormData, Book } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

interface ReadingsTabProps {
  isCreateOpen: boolean;
  onCreateClose: () => void;
}

// ─── Book progress bar ────────────────────────────────────────────────────────

interface BookProgressProps {
  book: Book;
  readings: Reading[];
}

function BookProgressBar({ book, readings }: BookProgressProps) {
  const bookReadings = readings.filter((r) => r.book === book.id);
  const totalRead = bookReadings.reduce((sum, r) => sum + r.pages_read, 0);
  const pct = book.pages > 0 ? Math.min((totalRead / book.pages) * 100, 100) : 0;

  return (
    <div className="space-y-xs">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="truncate font-medium">{book.title}</span>
        <span className="ml-sm shrink-0">
          {totalRead}/{book.pages} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {bookReadings.length} {bookReadings.length === 1 ? 'sessão' : 'sessões'}
      </p>
    </div>
  );
}

// ─── Mark-as-read modal ───────────────────────────────────────────────────────

interface MarkAsReadModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
}

function MarkAsReadModal({ isOpen, onClose, books }: MarkAsReadModalProps) {
  const [selectedBook, setSelectedBook] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setSelectedBook(0);
      setStartDate('');
      setEndDate('');
    } else if (books.length === 1) {
      setSelectedBook(books[0].id);
    }
  }, [isOpen, books]);

  const handleSubmit = async () => {
    if (!selectedBook || !startDate || !endDate) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (endDate < startDate) {
      toast({
        title: 'Data de fim deve ser posterior à de início',
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      const result = await booksService.markAsRead(selectedBook, startDate, endDate);
      toast({
        title: 'Leitura registrada!',
        description: `${result.sessions_created} sessões criadas automaticamente.`,
      });
      onClose();
    } catch (error: unknown) {
      toast({
        title: 'Erro ao registrar leitura',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const eligibleBooks = books.filter(
    (b) =>
      b.read_status === 'to_read' ||
      b.read_status === 'reading' ||
      b.read_status === 'paused'
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como Lido (período)</DialogTitle>
          <DialogDescription>
            Gera sessões de leitura distribuídas automaticamente entre as datas
            informadas, usando seu ritmo histórico de leitura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-md">
          {eligibleBooks.length > 1 && (
            <div className="space-y-sm">
              <Label>Livro *</Label>
              <Select
                value={selectedBook ? selectedBook.toString() : ''}
                onValueChange={(v) => setSelectedBook(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um livro" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleBooks.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-sm">
              <Label>Data de início *</Label>
              <DatePicker
                value={startDate}
                onChange={(d) => setStartDate(d ? formatLocalDate(d) : '')}
                placeholder="Quando começou"
              />
            </div>
            <div className="space-y-sm">
              <Label>Data de fim *</Label>
              <DatePicker
                value={endDate}
                onChange={(d) => setEndDate(d ? formatLocalDate(d) : '')}
                placeholder="Quando terminou"
              />
            </div>
          </div>

          <div className="flex justify-end gap-sm border-t pt-md">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReadingsTab({ isCreateOpen, onCreateClose }: ReadingsTabProps) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [selectedReading, setSelectedReading] = useState<Reading | undefined>();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMarkAsReadOpen, setIsMarkAsReadOpen] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { t } = useTranslation();

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounce(searchTerm), 400);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const loadData = useCallback(
    async (search?: string) => {
      try {
        setLoading(true);
        const params = search ? { search } : undefined;
        const [readingsData, booksData] = await Promise.all([
          readingsService.getAllPages(params),
          booksService.getAllPages(),
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
    },
    [toast, t]
  );

  useEffect(() => {
    void loadData(searchDebounce || undefined);
  }, [searchDebounce, loadData]);

  const handleCreateOpen = () => {
    if (books.length === 0) {
      toast({
        title: t('common.messages.actionDenied'),
        description: t('pages.readings.noBookMsg'),
        variant: 'destructive',
      });
      onCreateClose();
      return;
    }
    setSelectedReading(undefined);
  };

  useEffect(() => {
    if (isCreateOpen) handleCreateOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateOpen]);

  const handleEdit = (reading: Reading) => {
    setSelectedReading(reading);
    setIsEditOpen(true);
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
      void loadData(searchDebounce || undefined);
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
      onCreateClose();
      setIsEditOpen(false);
      void loadData(searchDebounce || undefined);
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

  // Collect books that have readings for progress view
  const booksWithReadings = books.filter((b) => readings.some((r) => r.book === b.id));

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder={t('pages.readings.searchPlaceholder')}
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowProgress((p) => !p)}
          className="gap-sm"
        >
          <BarChart2 className="h-4 w-4" />
          {showProgress ? 'Ver sessões' : 'Ver progresso'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMarkAsReadOpen(true)}
          className="gap-sm"
        >
          <CalendarRange className="h-4 w-4" />
          Marcar como lido (período)
        </Button>
      </div>

      {/* Progress view */}
      {showProgress ? (
        booksWithReadings.length === 0 ? (
          <EmptyState
            icon={<BookMarked className="h-12 w-12 text-muted-foreground" />}
            message="Nenhuma leitura registrada ainda."
          />
        ) : (
          <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
            {booksWithReadings.map((book) => (
              <Card key={book.id}>
                <CardContent className="pt-md">
                  <BookProgressBar book={book} readings={readings} />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : readings.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="h-12 w-12 text-muted-foreground" />}
          message={
            searchTerm
              ? t('pages.readings.emptySearch')
              : t('pages.readings.emptyState')
          }
        />
      ) : (
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-3">
          {readings.map((reading) => (
            <Card key={reading.id}>
              <CardHeader className="pb-sm">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-xs flex items-center gap-sm">
                      <BookOpen className="h-4 w-4 flex-shrink-0" />
                      <CardTitle className="truncate text-base">
                        {reading.book_title}
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-sm text-xs">
                      <div className="flex items-center gap-xs">
                        <Calendar className="h-3 w-3" />
                        {formatDate(reading.reading_date, 'dd/MM/yyyy')}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {t('pages.readings.pagesRead', { count: reading.pages_read })}
                      </Badge>
                      {reading.reading_time > 0 && (
                        <div className="flex items-center gap-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {reading.reading_time}min
                        </div>
                      )}
                      {reading.time_of_day_display && (
                        <Badge variant="outline" className="text-xs">
                          {reading.time_of_day_display}
                        </Badge>
                      )}
                      {reading.current_page && (
                        <span className="text-muted-foreground">
                          pág. {reading.current_page}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-xs">
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
                      onClick={() => void handleDelete(reading.id)}
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

      {/* Create dialog */}
      <Dialog
        open={isCreateOpen && books.length > 0}
        onOpenChange={(open) => {
          if (!open) onCreateClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.readings.newTitle')}</DialogTitle>
            <DialogDescription>{t('pages.readings.newDesc')}</DialogDescription>
          </DialogHeader>
          <ReadingForm
            books={books}
            onSubmit={handleSubmit}
            onCancel={onCreateClose}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.readings.editTitle')}</DialogTitle>
            <DialogDescription>{t('pages.readings.editDesc')}</DialogDescription>
          </DialogHeader>
          <ReadingForm
            reading={selectedReading}
            books={books}
            onSubmit={handleSubmit}
            onCancel={() => setIsEditOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Mark-as-read modal */}
      <MarkAsReadModal
        isOpen={isMarkAsReadOpen}
        onClose={() => {
          setIsMarkAsReadOpen(false);
          void loadData(searchDebounce || undefined);
        }}
        books={books}
      />
    </div>
  );
}

export { Plus };
