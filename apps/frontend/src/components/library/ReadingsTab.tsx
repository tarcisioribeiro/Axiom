/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useState, useEffect } from 'react';
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
  const { t } = useTranslation();
  const bookReadings = readings.filter((r) => r.book === book.id);
  const totalRead = bookReadings.reduce((sum, r) => sum + r.pages_read, 0);
  const pct = book.pages > 0 ? Math.min((totalRead / book.pages) * 100, 100) : 0;

  return (
    <div className="space-y-xs">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span className="truncate font-medium">{book.title}</span>
        <span className="ml-sm shrink-0">
          {totalRead}/{book.pages} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-muted-foreground text-[10px]">
        {t('pages.readings.sessionsCount', { count: bookReadings.length })}
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
  const { t } = useTranslation();
  const [selectedBook, setSelectedBook] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Reinicia o formulário quando o dialog abre/fecha (derivado durante o
  // render — sem efeito — comparando com a última transição de `isOpen`).
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  if (isOpen !== lastIsOpen) {
    setLastIsOpen(isOpen);
    if (!isOpen) {
      setSelectedBook(0);
      setStartDate('');
      setEndDate('');
    } else if (books.length === 1) {
      setSelectedBook(books[0].id);
    }
  }

  const handleSubmit = async () => {
    if (!selectedBook || !startDate || !endDate) {
      toast({
        title: t('pages.readings.markAsRead.fillRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (endDate < startDate) {
      toast({
        title: t('pages.readings.markAsRead.endAfterStart'),
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      const result = await booksService.markAsRead(selectedBook, startDate, endDate);
      toast({
        title: t('pages.readings.markAsRead.successTitle'),
        description: t('pages.readings.markAsRead.successDesc', {
          count: result.sessions_created,
        }),
      });
      onClose();
    } catch (error: unknown) {
      toast({
        title: t('pages.readings.markAsRead.errorTitle'),
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
          <DialogTitle>{t('pages.readings.markAsRead.title')}</DialogTitle>
          <DialogDescription>
            {t('pages.readings.markAsRead.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-md">
          {eligibleBooks.length > 1 && (
            <div className="space-y-sm">
              <Label>{t('pages.readings.markAsRead.bookLabel')}</Label>
              <Select
                value={selectedBook ? selectedBook.toString() : ''}
                onValueChange={(v) => setSelectedBook(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('pages.readings.markAsRead.bookPlaceholder')}
                  />
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

          <div className="gap-md grid grid-cols-2">
            <div className="space-y-sm">
              <Label>{t('pages.readings.markAsRead.startDateLabel')}</Label>
              <DatePicker
                value={startDate}
                onChange={(d) => setStartDate(d ? formatLocalDate(d) : '')}
                placeholder={t('pages.readings.markAsRead.startDatePlaceholder')}
              />
            </div>
            <div className="space-y-sm">
              <Label>{t('pages.readings.markAsRead.endDateLabel')}</Label>
              <DatePicker
                value={endDate}
                onChange={(d) => setEndDate(d ? formatLocalDate(d) : '')}
                placeholder={t('pages.readings.markAsRead.endDatePlaceholder')}
              />
            </div>
          </div>

          <div className="gap-sm pt-md flex justify-end border-t">
            <Button variant="outline" onClick={onClose}>
              {t('pages.readings.markAsRead.cancelBtn')}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting
                ? t('pages.readings.markAsRead.submitting')
                : t('pages.readings.markAsRead.submitBtn')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY_READINGS: Reading[] = [];
const EMPTY_BOOKS: Book[] = [];

export function ReadingsTab({ isCreateOpen, onCreateClose }: ReadingsTabProps) {
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
  const queryClient = useQueryClient();

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounce(searchTerm), 400);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const { data: pageData, isLoading: loading } = useQuery({
    queryKey: ['readings-tab', searchDebounce],
    queryFn: async () => {
      try {
        const params = searchDebounce ? { search: searchDebounce } : undefined;
        const [readingsData, booksData] = await Promise.all([
          readingsService.getAllPages(params),
          booksService.getAllPages(),
        ]);
        return { readings: readingsData, books: booksData };
      } catch (error: unknown) {
        toast({
          title: t('common.messages.loadError'),
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return { readings: EMPTY_READINGS, books: EMPTY_BOOKS };
      }
    },
  });
  const readings = pageData?.readings ?? EMPTY_READINGS;
  const books = pageData?.books ?? EMPTY_BOOKS;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['readings-tab', searchDebounce] });

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

  // Reinicia o formulário quando o dialog de criação abre (derivado durante
  // o render — sem efeito — comparando com a última transição de `isCreateOpen`).
  const [lastIsCreateOpen, setLastIsCreateOpen] = useState(isCreateOpen);
  if (isCreateOpen !== lastIsCreateOpen) {
    setLastIsCreateOpen(isCreateOpen);
    if (isCreateOpen) handleCreateOpen();
  }

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
      void refresh();
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
      void refresh();
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
          {showProgress
            ? t('pages.readings.viewSessions')
            : t('pages.readings.viewProgress')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMarkAsReadOpen(true)}
          className="gap-sm"
        >
          <CalendarRange className="h-4 w-4" />
          {t('pages.readings.markAsReadPeriodBtn')}
        </Button>
      </div>

      {/* Progress view */}
      {showProgress ? (
        booksWithReadings.length === 0 ? (
          <EmptyState
            icon={<BookMarked className="text-muted-foreground h-12 w-12" />}
            message={t('pages.readings.noReadingsProgress')}
          />
        ) : (
          <div className="gap-md grid md:grid-cols-2 lg:grid-cols-3">
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
          icon={<BookMarked className="text-muted-foreground h-12 w-12" />}
          message={
            searchTerm
              ? t('pages.readings.emptySearch')
              : t('pages.readings.emptyState')
          }
        />
      ) : (
        <div className="gap-md grid md:grid-cols-2 lg:grid-cols-3">
          {readings.map((reading) => (
            <Card key={reading.id}>
              <CardHeader className="pb-sm">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-xs gap-sm flex items-center">
                      <BookOpen className="h-4 w-4 flex-shrink-0" />
                      <CardTitle className="truncate text-base">
                        {reading.book_title}
                      </CardTitle>
                    </div>
                    <div className="gap-sm flex flex-wrap items-center text-xs">
                      <div className="gap-xs flex items-center">
                        <Calendar className="h-3 w-3" />
                        {formatDate(reading.reading_date, 'dd/MM/yyyy')}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {t('pages.readings.pagesRead', { count: reading.pages_read })}
                      </Badge>
                      {reading.reading_time > 0 && (
                        <div className="gap-xs text-muted-foreground flex items-center">
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
                          {t('pages.readingsTab.pageLabel')} {reading.current_page}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="gap-xs flex flex-shrink-0">
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
          void refresh();
        }}
        books={books}
      />
    </div>
  );
}

export { Plus };
