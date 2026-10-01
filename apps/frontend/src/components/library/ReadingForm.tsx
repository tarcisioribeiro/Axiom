/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  Hash,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
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
import { TIME_OF_DAY_ICONS } from '@/config/icons';
import { formatDate } from '@/lib/formatters';
import { logger } from '@/lib/logger';
import { projectReading } from '@/lib/reading-projection';
import { formatLocalDate } from '@/lib/utils';
import { readingSchema, type ReadingFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { readingsService } from '@/services/readings-service';
import type { Reading, Book } from '@/types';

const TIME_OF_DAY_KEYS = ['morning', 'afternoon', 'evening', 'dawn'] as const;

interface ReadingFormProps {
  reading?: Reading;
  books: Book[];
  onSubmit: (data: ReadingFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Pré-preenche o tempo de leitura (min) — usado pelo timer de leitura. */
  defaultReadingTime?: number;
  /** Trava data e tempo — leitura vinda de uma sessão do timer. */
  lockSession?: boolean;
}

export function ReadingForm({
  reading,
  books,
  onSubmit,
  onCancel,
  isLoading = false,
  defaultReadingTime = 0,
  lockSession = false,
}: ReadingFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<ReadingFormData>({
    resolver: zodResolver(readingSchema),
    defaultValues: reading
      ? {
          book: reading.book,
          pages_read: reading.pages_read,
          reading_date: reading.reading_date,
          reading_time: reading.reading_time,
          notes: reading.notes || '',
          current_page: reading.current_page ?? null,
          time_of_day: reading.time_of_day ?? null,
          owner: reading.owner,
        }
      : {
          book: books[0]?.id ?? 0,
          pages_read: 0,
          reading_date: formatLocalDate(new Date()),
          reading_time: defaultReadingTime,
          notes: '',
          current_page: null,
          time_of_day: null,
          owner: 0,
        },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!reading) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [reading, setValue]);

  const selectedBook = watch('book');

  // Progresso projetado: leituras anteriores da obra (sem esta, se for
  // edição) + páginas informadas agora.
  const progressBook = books.find((b) => b.id === selectedBook);
  const { data: bookReadings = [] } = useQuery({
    queryKey: ['readings', 'book', progressBook?.id],
    queryFn: () => readingsService.getAllPages({ book: progressBook!.id }),
    enabled: !!progressBook,
    staleTime: 0,
  });
  const previousReadings = bookReadings.filter((r) => r.id !== reading?.id);
  const previousPages = previousReadings.reduce((sum, r) => sum + r.pages_read, 0);
  // Mínimo 1; máximo = páginas restantes da obra.
  const maxPages = Math.max(1, (progressBook?.pages ?? 1) - previousPages);
  const clampPages = (value: number) => Math.min(maxPages, Math.max(1, value || 1));

  const submit = (data: ReadingFormData) => {
    if (data.pages_read > maxPages) {
      setError('pages_read', {
        message: t('pages.readings.form.pagesReadMax', { count: maxPages }),
      });
      return;
    }
    onSubmit(data);
  };

  const projection = progressBook
    ? projectReading({
        bookPages: progressBook.pages,
        previousReadings,
        pagesRead: watch('pages_read') || 0,
        readingDate: watch('reading_date'),
      })
    : null;

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-lg">
      <FormSection title={t('pages.readings.form.sectionProgress')} icon={BookOpen}>
        <div className="gap-md grid">
          {books.length > 1 && (
            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <BookOpen className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.readings.form.bookLabel')}
              </Label>
              <Select
                value={watch('book').toString()}
                onValueChange={(value) => setValue('book', parseInt(value))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('pages.readings.form.bookPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {books.map((book) => (
                    <SelectItem key={book.id} value={book.id.toString()}>
                      {book.title} (
                      {t('pages.readings.form.bookPages', { count: book.pages })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.book && (
                <p className="mt-xs text-destructive text-sm">{errors.book.message}</p>
              )}
            </div>
          )}

          <div className="gap-md grid grid-cols-1 md:grid-cols-2">
            <div className="space-y-sm">
              <Label htmlFor="pages_read" className="gap-xs flex items-center">
                <Hash className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.readings.form.pagesReadLabel')}
              </Label>
              <Input
                id="pages_read"
                type="number"
                min="1"
                max={maxPages}
                {...register('pages_read', {
                  setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
                  onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
                    setValue('pages_read', clampPages(parseInt(e.target.value)), {
                      shouldValidate: true,
                    }),
                })}
                disabled={isLoading}
              />
              {errors.pages_read && (
                <p className="mt-xs text-destructive text-sm">
                  {errors.pages_read.message}
                </p>
              )}
              {selectedBook > 0 && (
                <p className="text-muted-foreground text-xs">
                  {t('pages.readings.form.pagesReadMax', {
                    count: maxPages,
                  })}
                </p>
              )}
            </div>

            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.readings.form.readingDateLabel')}
              </Label>
              <DatePicker
                value={watch('reading_date')}
                onChange={(date) =>
                  setValue('reading_date', date ? formatLocalDate(date) : '')
                }
                placeholder={t('pages.readings.form.readingDatePlaceholder')}
                disabled={isLoading || lockSession}
              />
              {errors.reading_date && (
                <p className="mt-xs text-destructive text-sm">
                  {errors.reading_date.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.readings.form.sectionRecord')} icon={CalendarDays}>
        <div className="gap-md grid grid-cols-1 md:grid-cols-2">
          <div className="space-y-sm">
            <Label htmlFor="reading_time" className="gap-xs flex items-center">
              <Clock className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.readings.form.readingTimeLabel')}
            </Label>
            <Input
              id="reading_time"
              type="number"
              min="0"
              {...register('reading_time', {
                setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
              })}
              // readOnly (não disabled): RHF envia campos disabled como undefined.
              readOnly={lockSession}
              aria-disabled={lockSession}
              className={lockSession ? 'cursor-not-allowed opacity-50' : undefined}
              disabled={isLoading}
            />
            {errors.reading_time && (
              <p className="mt-xs text-destructive text-sm">
                {errors.reading_time.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="gap-xs flex items-center">
              <Clock className="text-muted-foreground h-3.5 w-3.5" />
              {t('pages.readings.form.timeOfDayLabel')}
            </Label>
            <Select
              value={watch('time_of_day') ?? ''}
              onValueChange={(value) =>
                setValue('time_of_day', value === '' ? null : value)
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.readings.form.timeOfDayPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {TIME_OF_DAY_KEYS.map((key) => {
                  const TimeIcon = TIME_OF_DAY_ICONS[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {TimeIcon && <TimeIcon className="h-4 w-4" />}
                        {t(
                          `pages.readings.form.timeOfDay${key.charAt(0).toUpperCase() + key.slice(1)}`
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.readings.form.sectionNotes')} icon={FileText}>
        <div className="space-y-sm">
          <Label htmlFor="notes" className="gap-xs flex items-center">
            <FileText className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.readings.form.notesLabel')}
          </Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.readings.form.notesPlaceholder')}
            rows={4}
            disabled={isLoading}
          />
          {errors.notes && (
            <p className="mt-xs text-destructive text-sm">{errors.notes.message}</p>
          )}
        </div>
        {progressBook && projection && (
          <div className="mt-md space-y-xs">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>{t('pages.readings.form.progressLabel')}</span>
              <span className="text-foreground font-semibold">
                {t('pages.readings.form.progressValue', {
                  read: projection.totalPages,
                  total: progressBook.pages,
                  percent: projection.progress,
                })}
              </span>
            </div>
            <Progress value={projection.progress} className="h-2" />
            <p className="text-muted-foreground text-xs">
              {t('pages.readings.form.progressDelta', {
                before: projection.previousProgress,
                after: projection.progress,
                delta:
                  Math.round((projection.progress - projection.previousProgress) * 10) /
                  10,
              })}
            </p>
            <p className="text-muted-foreground text-xs">
              {projection.finished
                ? t('pages.readings.form.progressFinished')
                : projection.estimatedCompletion
                  ? t('pages.readings.form.progressForecast', {
                      date: formatDate(projection.estimatedCompletion),
                      pace: projection.avgPagesPerDay,
                    })
                  : t('pages.readings.form.progressNoForecast')}
            </p>
          </div>
        )}
      </FormSection>

      <div className="dialog-footer gap-sm pt-md flex justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          <X className="mr-sm h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-sm h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-sm h-4 w-4" />
          )}
          {isLoading ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
