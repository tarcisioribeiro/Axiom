import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { readingSchema, type ReadingFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import type { Reading, Book } from '@/types';

import { formatLocalDate } from '@/lib/utils';
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
          owner: reading.owner,
        }
      : {
          book: 0,
          pages_read: 0,
          reading_date: formatLocalDate(new Date()),
          reading_time: 0,
          notes: '',
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
          console.error('Erro ao carregar membro do usuário:', error);
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="book">Livro *</Label>
          <Select
            value={watch('book').toString()}
            onValueChange={(value) => setValue('book', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um livro" />
            </SelectTrigger>
            <SelectContent>
              {books.map((book) => (
                <SelectItem key={book.id} value={book.id.toString()}>
                  {book.title} ({book.pages} páginas)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.book && (
            <p className="mt-1 text-sm text-destructive">{errors.book.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pages_read">Páginas Lidas *</Label>
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
            <p className="mt-1 text-sm text-destructive">{errors.pages_read.message}</p>
          )}
          {selectedBook > 0 && (
            <p className="text-xs">Máximo: {getBookMaxPages(selectedBook)} páginas</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reading_date">Data da Leitura *</Label>
          <DatePicker
            value={watch('reading_date')}
            onChange={(date) =>
              setValue('reading_date', date ? formatLocalDate(date) : '')
            }
            placeholder="Selecione a data de leitura"
          />
          {errors.reading_date && (
            <p className="mt-1 text-sm text-destructive">
              {errors.reading_date.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reading_time">Tempo de Leitura (minutos) *</Label>
          <Input
            id="reading_time"
            type="number"
            min="0"
            {...register('reading_time', {
              setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
            })}
          />
          {errors.reading_time && (
            <p className="mt-1 text-sm text-destructive">
              {errors.reading_time.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Anotações</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Anotações sobre esta sessão de leitura..."
            rows={4}
          />
          {errors.notes && (
            <p className="mt-1 text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar'
          )}
        </Button>
      </div>
    </form>
  );
}
