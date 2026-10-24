/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarDays, Clock, FileText, Hash, Save, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
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
import { toast } from '@/hooks/use-toast';
import { notifyFormErrors } from '@/lib/form-errors';
import { formatDate } from '@/lib/formatters';
import { logger } from '@/lib/logger';
import { projectReading } from '@/lib/reading-projection';
import { formatLocalDate } from '@/lib/utils';
import { makeReadingSchema, type ReadingFormData } from '@/lib/validations';
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
  /** Pré-preenche o período do dia — usado pelo timer de leitura. */
  defaultTimeOfDay?: string | null;
}

export function ReadingForm({
  reading,
  books,
  onSubmit,
  onCancel,
  isLoading = false,
  defaultReadingTime = 0,
  lockSession = false,
  defaultTimeOfDay = null,
}: ReadingFormProps) {
  const { t } = useTranslation();
  const readingSchema = useMemo(() => makeReadingSchema(t), [t]);
  const {
    control,
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
          time_of_day: defaultTimeOfDay,
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

  const submit = (data: ReadingFormData) => {
    if (data.pages_read > maxPages) {
      const message = t('pages.readings.form.pagesReadMax', { count: maxPages });
      setError('pages_read', { message });
      toast({ title: message, variant: 'destructive' });
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
    <form
      noValidate
      onSubmit={handleSubmit(submit, notifyFormErrors)}
      className="space-y-lg"
    >
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
                <SelectTrigger aria-invalid={!!errors.book}>
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
            </div>
          )}

          <div className="gap-md grid grid-cols-1 md:grid-cols-2">
            <div className="space-y-sm">
              <Label htmlFor="pages_read" className="gap-xs flex items-center">
                <Hash className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.readings.form.pagesReadLabel')}
              </Label>
              <Controller
                control={control}
                name="pages_read"
                render={({ field }) => (
                  <NumberStepper
                    id="pages_read"
                    aria-invalid={!!errors.pages_read}
                    disabled={isLoading}
                    min={1}
                    max={maxPages}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="space-y-sm">
              <Label className="gap-xs flex items-center">
                <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
                {t('pages.readings.form.readingDateLabel')}
              </Label>
              <DatePicker
                aria-invalid={!!errors.reading_date}
                value={watch('reading_date')}
                onChange={(date) =>
                  setValue('reading_date', date ? formatLocalDate(date) : '')
                }
                placeholder={t('pages.readings.form.readingDatePlaceholder')}
                disabled={isLoading || lockSession}
              />
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
            <Controller
              control={control}
              name="reading_time"
              render={({ field }) => (
                <NumberStepper
                  id="reading_time"
                  aria-invalid={!!errors.reading_time}
                  disabled={isLoading || lockSession}
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
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
            aria-invalid={!!errors.notes}
            placeholder={t('pages.readings.form.notesPlaceholder')}
            rows={1}
            disabled={isLoading}
          />
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
          <X className="h-4 w-4" />
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Save className="h-4 w-4" />}
          {t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
