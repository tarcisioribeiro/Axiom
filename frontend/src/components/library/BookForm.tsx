import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/ui/star-rating';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bookSchema, type BookFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { BOOK_LANGUAGES, BOOK_GENRES, LITERARY_TYPES, MEDIA_TYPES } from '@/types';
import type { Book, Author, Publisher } from '@/types';

import { formatLocalDate } from '@/lib/utils';
interface BookFormProps {
  book?: Book;
  authors: Author[];
  publishers: Publisher[];
  onSubmit: (data: BookFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BookForm({
  book,
  authors,
  publishers,
  onSubmit,
  onCancel,
  isLoading = false,
}: BookFormProps) {
  const [selectedAuthors, setSelectedAuthors] = useState<number[]>(book?.authors || []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: book
      ? {
          title: book.title,
          authors: book.authors,
          pages: book.pages,
          publisher: book.publisher,
          language: book.language,
          genre: book.genre,
          literarytype: book.literarytype,
          publish_date: book.publish_date || '',
          synopsis: book.synopsis,
          edition: book.edition,
          media_type: book.media_type || '',
          rating: book.rating ?? null,
          read_status: book.read_status,
          owner: book.owner,
        }
      : {
          title: '',
          authors: [],
          pages: 0,
          publisher: 0,
          language: 'Por',
          genre: 'Fiction',
          literarytype: 'book',
          publish_date: '',
          synopsis: '',
          edition: '1ª',
          media_type: '',
          rating: null,
          read_status: 'to_read',
          owner: 0,
        },
  });

  // Load current user member when creating new book
  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!book) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          console.error('Erro ao carregar membro do usuário:', error);
        }
      }
    };

    void loadCurrentUserMember();
  }, [book, setValue]);

  const handleAuthorToggle = (authorId: number) => {
    const newAuthors = selectedAuthors.includes(authorId)
      ? selectedAuthors.filter((id) => id !== authorId)
      : [...selectedAuthors, authorId];
    setSelectedAuthors(newAuthors);
    setValue('authors', newAuthors);
  };

  const handleRemoveAuthor = (authorId: number) => {
    const newAuthors = selectedAuthors.filter((id) => id !== authorId);
    setSelectedAuthors(newAuthors);
    setValue('authors', newAuthors);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">Título *</Label>
          <Input id="title" {...register('title')} placeholder="Título do livro" />
          {errors.title && (
            <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label>Autores *</Label>
          <Select onValueChange={(value) => handleAuthorToggle(parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione os autores" />
            </SelectTrigger>
            <SelectContent>
              {authors.map((author) => (
                <SelectItem key={author.id} value={author.id.toString()}>
                  {author.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAuthors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedAuthors.map((authorId) => {
                const author = authors.find((a) => a.id === authorId);
                return author ? (
                  <Badge key={authorId} variant="secondary">
                    {author.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveAuthor(authorId)}
                      aria-label={`Remover ${author.name}`}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          )}
          {errors.authors && (
            <p className="mt-1 text-sm text-destructive">{errors.authors.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="pages">Páginas *</Label>
          <Input
            id="pages"
            type="number"
            min="1"
            {...register('pages', {
              setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
            })}
          />
          {errors.pages && (
            <p className="mt-1 text-sm text-destructive">{errors.pages.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="publisher">Editora *</Label>
          <Select
            value={watch('publisher').toString()}
            onValueChange={(value) => setValue('publisher', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a editora" />
            </SelectTrigger>
            <SelectContent>
              {publishers.map((publisher) => (
                <SelectItem key={publisher.id} value={publisher.id.toString()}>
                  {publisher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.publisher && (
            <p className="mt-1 text-sm text-destructive">{errors.publisher.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="language">Idioma *</Label>
          <Select
            value={watch('language')}
            onValueChange={(value) => setValue('language', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOOK_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.language && (
            <p className="mt-1 text-sm text-destructive">{errors.language.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="genre">Gênero *</Label>
          <Select
            value={watch('genre')}
            onValueChange={(value) => setValue('genre', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOOK_GENRES.map((genre) => (
                <SelectItem key={genre.value} value={genre.value}>
                  {genre.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.genre && (
            <p className="mt-1 text-sm text-destructive">{errors.genre.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="literarytype">Tipo Literário *</Label>
          <Select
            value={watch('literarytype')}
            onValueChange={(value) => setValue('literarytype', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LITERARY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.literarytype && (
            <p className="mt-1 text-sm text-destructive">
              {errors.literarytype.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="media_type">Tipo de Mídia</Label>
          <Select
            value={watch('media_type') || undefined}
            onValueChange={(value) => setValue('media_type', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de mídia..." />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.media_type && (
            <p className="mt-1 text-sm text-destructive">{errors.media_type.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="edition">Edição *</Label>
          <Input id="edition" {...register('edition')} placeholder="Ex: 1ª edição" />
          {errors.edition && (
            <p className="mt-1 text-sm text-destructive">{errors.edition.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="publish_date">Data de Publicação</Label>
          <DatePicker
            value={watch('publish_date')}
            onChange={(date) =>
              setValue('publish_date', date ? formatLocalDate(date) : '')
            }
            placeholder="Selecione a data de publicação"
          />
          {errors.publish_date && (
            <p className="mt-1 text-sm text-destructive">
              {errors.publish_date.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="rating">Avaliação</Label>
          <StarRating
            value={watch('rating')}
            onChange={(value) => setValue('rating', value)}
            size="md"
            className="mt-2"
          />
          {errors.rating && (
            <p className="mt-1 text-sm text-destructive">{errors.rating.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="synopsis">Sinopse *</Label>
          <Textarea
            id="synopsis"
            {...register('synopsis')}
            placeholder="Descrição do livro..."
            rows={5}
          />
          {errors.synopsis && (
            <p className="mt-1 text-sm text-destructive">{errors.synopsis.message}</p>
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
