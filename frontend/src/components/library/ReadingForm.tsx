import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { readingSchema, type ReadingFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import type { Reading, Book } from '@/types';

const TIME_OF_DAY_KEYS = ['morning', 'afternoon', 'evening', 'dawn'] as const;

interface ReadingFormProps {
  reading?: Reading;
  books: Book[];
  onSubmit: (data: ReadingFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ReadingForm({
  reading,
  books,
  onSubmit,
  onCancel,
  isLoading = false,
}: ReadingFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
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
          reading_time: 0,
          notes: '',
          current_page: null,
          time_of_day: null,
          owner: 0,
        },
  });

  // Load current user member when creating new reading
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
  const getBookMaxPages = (bookId: number): number => {
    const book = books.find((b) => b.id === bookId);
    return book?.pages || 1;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-md">
      <div className="grid gap-md">
        {books.length > 1 && (
          <div className="space-y-sm">
            <Label htmlFor="book">{t('pages.readings.form.bookLabel')}</Label>
            <Select
              value={watch('book').toString()}
              onValueChange={(value) => setValue('book', parseInt(value))}
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
              <p className="mt-xs text-sm text-destructive">{errors.book.message}</p>
            )}
          </div>
        )}

        <div className="space-y-sm">
          <Label htmlFor="pages_read">{t('pages.readings.form.pagesReadLabel')}</Label>
          <Input
            id="pages_read"
            type="number"
            min="1"
            max={selectedBook ? getBookMaxPages(selectedBook) : undefined}
            {...register('pages_read', {
              setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
            })}
          />
          {errors.pages_read && (
            <p className="mt-xs text-sm text-destructive">
              {errors.pages_read.message}
            </p>
          )}
          {selectedBook > 0 && (
            <p className="text-xs">
              {t('pages.readings.form.pagesReadMax', {
                count: getBookMaxPages(selectedBook),
              })}
            </p>
          )}
        </div>

        <div className="space-y-sm">
          <Label htmlFor="reading_date">
            {t('pages.readings.form.readingDateLabel')}
          </Label>
          <DatePicker
            value={watch('reading_date')}
            onChange={(date) =>
              setValue('reading_date', date ? formatLocalDate(date) : '')
            }
            placeholder={t('pages.readings.form.readingDatePlaceholder')}
          />
          {errors.reading_date && (
            <p className="mt-xs text-sm text-destructive">
              {errors.reading_date.message}
            </p>
          )}
        </div>

        <div className="space-y-sm">
          <Label htmlFor="reading_time">
            {t('pages.readings.form.readingTimeLabel')}
          </Label>
          <Input
            id="reading_time"
            type="number"
            min="0"
            {...register('reading_time', {
              setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
            })}
          />
          {errors.reading_time && (
            <p className="mt-xs text-sm text-destructive">
              {errors.reading_time.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-sm">
            <Label htmlFor="current_page">
              {t('pages.readings.form.currentPageLabel')}
            </Label>
            <Input
              id="current_page"
              type="number"
              min="1"
              placeholder={t('pages.readings.form.currentPagePlaceholder')}
              {...register('current_page', {
                setValueAs: (v: string) => (v === '' ? null : parseInt(v)),
              })}
            />
            {errors.current_page && (
              <p className="mt-xs text-sm text-destructive">
                {errors.current_page.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="time_of_day">
              {t('pages.readings.form.timeOfDayLabel')}
            </Label>
            <Select
              value={watch('time_of_day') ?? ''}
              onValueChange={(value) =>
                setValue('time_of_day', value === '' ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.readings.form.timeOfDayPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {TIME_OF_DAY_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(
                      `pages.readings.form.timeOfDay${key.charAt(0).toUpperCase() + key.slice(1)}`
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-sm">
          <Label htmlFor="notes">{t('pages.readings.form.notesLabel')}</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder={t('pages.readings.form.notesPlaceholder')}
            rows={4}
          />
          {errors.notes && (
            <p className="mt-xs text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-sm h-4 w-4 animate-spin" />
              {t('common.actions.saving')}
            </>
          ) : (
            t('common.actions.save')
          )}
        </Button>
      </div>
    </form>
  );
}
