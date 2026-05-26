/* eslint-disable max-lines, react-hooks/incompatible-library */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BookOpen,
  FileText,
  ImagePlus,
  Loader2,
  Smartphone,
  Star,
  Tag,
  Upload,
  User2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StarRating } from '@/components/ui/star-rating';
import { Textarea } from '@/components/ui/textarea';
import {
  BOOK_GENRE_ICONS,
  BOOK_LITERARY_TYPE_ICONS,
  BOOK_LANGUAGE_ICON,
  READ_STATUS_ICONS,
} from '@/config/icons';
import { logger } from '@/lib/logger';
import { formatLocalDate } from '@/lib/utils';
import { bookSchema, type BookFormData } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { BOOK_LANGUAGES, BOOK_GENRES, LITERARY_TYPES } from '@/types';
import type { Book, Author, Publisher } from '@/types';

const MEDIA_TYPE_OPTIONS = [
  { value: 'Phi', icon: BookOpen, translationKey: 'Phi' },
  { value: 'Dig', icon: Smartphone, translationKey: 'Dig' },
] as const;

const READ_STATUS_VALUES = ['to_read', 'reading', 'read', 'paused'] as const;

interface BookFormProps {
  book?: Book;
  authors: Author[];
  publishers: Publisher[];
  onSubmit: (
    data: BookFormData,
    coverFile?: File | null,
    bookFile?: File | null,
    alreadyRead?: boolean,
    startDate?: string,
    endDate?: string
  ) => void;
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
  const { t } = useTranslation();
  const [selectedAuthors, setSelectedAuthors] = useState<number[]>(book?.authors || []);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(book?.cover || null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [bookFileName, setBookFileName] = useState<string | null>(() => {
    if (!book?.book_file) return null;
    try {
      const pathname = new URL(book.book_file).pathname;
      return decodeURIComponent(pathname.split('/').pop() ?? '') || null;
    } catch {
      return null;
    }
  });
  const [alreadyRead, setAlreadyRead] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bookFileInputRef = useRef<HTMLInputElement>(null);

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
          isbn: book.isbn || '',
          series_name: book.series_name || '',
          series_order: book.series_order ?? null,
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
          pause_reason: book.pause_reason || '',
          owner: book.owner,
        }
      : {
          title: '',
          isbn: '',
          series_name: '',
          series_order: null,
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
          pause_reason: '',
          owner: 0,
        },
  });

  useEffect(() => {
    const loadCurrentUserMember = async () => {
      if (!book) {
        try {
          const member = await membersService.getCurrentUserMember();
          setValue('owner', member.id);
        } catch (error) {
          logger.error('Erro ao carregar membro do usuário:', error);
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

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBookFile(file);
    setBookFileName(file.name);
  };

  const handleRemoveBookFile = () => {
    setBookFile(null);
    setBookFileName(null);
    if (bookFileInputRef.current) bookFileInputRef.current.value = '';
  };

  const mediaType = watch('media_type');

  return (
    <form
      onSubmit={handleSubmit((data) =>
        onSubmit(data, coverFile, bookFile, alreadyRead, startDate, endDate)
      )}
      className="space-y-lg"
    >
      {/* Capa do livro */}
      <div>
        <Label className="flex items-center gap-xs">
          <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
          {t('pages.books.form.coverLabel')}
        </Label>
        <div className="mt-sm flex items-start gap-md">
          <div className="relative flex h-52 w-36 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted shadow-sm">
            {coverPreview ? (
              <>
                <img
                  src={coverPreview}
                  alt={t('pages.books.form.coverAlt')}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 hover:bg-background"
                  aria-label={t('pages.books.form.removeCover')}
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
              id="cover-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {coverPreview
                ? t('pages.books.form.coverChangeBtn')
                : t('pages.books.form.coverSelectBtn')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('pages.books.form.coverHint')}
            </p>
          </div>
        </div>
      </div>

      <FormSection title={t('pages.books.form.sectionIdentification')} icon={BookOpen}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label htmlFor="title" className="flex items-center gap-xs">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.titleLabel')}
            </Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('pages.books.form.titlePlaceholder')}
              disabled={isLoading}
            />
            {errors.title && (
              <p className="mt-xs text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="isbn" className="flex items-center gap-xs">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.isbnLabel')}
            </Label>
            <Input
              id="isbn"
              {...register('isbn')}
              placeholder={t('pages.books.form.isbnPlaceholder')}
              maxLength={13}
              disabled={isLoading}
            />
            {errors.isbn && (
              <p className="mt-xs text-sm text-destructive">{errors.isbn.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="series_name" className="flex items-center gap-xs">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.seriesLabel')}
            </Label>
            <Input
              id="series_name"
              {...register('series_name')}
              placeholder={t('pages.books.form.seriesPlaceholder')}
              disabled={isLoading}
            />
            {errors.series_name && (
              <p className="mt-xs text-sm text-destructive">
                {errors.series_name.message}
              </p>
            )}
          </div>

          {watch('series_name') && (
            <div className="space-y-sm">
              <Label htmlFor="series_order" className="flex items-center gap-xs">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.books.form.seriesOrderLabel')}
              </Label>
              <Input
                id="series_order"
                type="number"
                min="1"
                {...register('series_order', {
                  setValueAs: (v: string) => (v === '' ? null : parseInt(v)),
                })}
                placeholder={t('pages.books.form.seriesOrderPlaceholder')}
                disabled={isLoading}
              />
              {errors.series_order && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.series_order.message}
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('pages.books.form.sectionClassification')} icon={Tag}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          {/* Adaptação visual: toggle de mídia */}
          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.mediaTypeLabel')}
            </Label>
            <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
              {MEDIA_TYPE_OPTIONS.map(({ value, icon: Icon, translationKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('media_type', value)}
                  disabled={isLoading}
                  className={`flex flex-1 items-center justify-center gap-xs rounded px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                    mediaType === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`pages.books.mediaTypes.${translationKey}`)}
                </button>
              ))}
            </div>
            {errors.media_type && (
              <p className="mt-xs text-sm text-destructive">
                {errors.media_type.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.genreLabel')}
            </Label>
            <Select
              value={watch('genre')}
              onValueChange={(value) => setValue('genre', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOK_GENRES.map((genre) => {
                  const GenreIcon = BOOK_GENRE_ICONS[genre.value];
                  return (
                    <SelectItem key={genre.value} value={genre.value}>
                      <span className="flex items-center gap-2">
                        {GenreIcon && <GenreIcon className="h-4 w-4" />}
                        {t(`pages.books.genres.${genre.value}`)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.genre && (
              <p className="mt-xs text-sm text-destructive">{errors.genre.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.literaryTypeLabel')}
            </Label>
            <Select
              value={watch('literarytype')}
              onValueChange={(value) => setValue('literarytype', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LITERARY_TYPES.map((type) => {
                  const LitIcon = BOOK_LITERARY_TYPE_ICONS[type.value];
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        {LitIcon && <LitIcon className="h-4 w-4" />}
                        {t(`pages.books.literaryTypes.${type.value}`)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.literarytype && (
              <p className="mt-xs text-sm text-destructive">
                {errors.literarytype.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.languageLabel')}
            </Label>
            <Select
              value={watch('language')}
              onValueChange={(value) => setValue('language', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOK_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <BOOK_LANGUAGE_ICON className="h-4 w-4" />
                      {t(`pages.books.languages.${lang.value}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.language && (
              <p className="mt-xs text-sm text-destructive">
                {errors.language.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('pages.books.form.sectionAuthorPublisher')} icon={User2}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <User2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.authorsLabel')}
            </Label>
            <Select
              onValueChange={(value) => handleAuthorToggle(parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('pages.books.form.authorsPlaceholder')} />
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
              <div className="mt-sm flex flex-wrap gap-sm">
                {selectedAuthors.map((authorId) => {
                  const author = authors.find((a) => a.id === authorId);
                  return author ? (
                    <Badge key={authorId} variant="secondary">
                      {author.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveAuthor(authorId)}
                        aria-label={t('pages.books.form.removeAuthor', {
                          name: author.name,
                        })}
                        className="ml-xs hover:text-destructive"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            {errors.authors && (
              <p className="mt-xs text-sm text-destructive">{errors.authors.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <User2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.publisherLabel')}
            </Label>
            <Select
              value={watch('publisher').toString()}
              onValueChange={(value) => setValue('publisher', parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('pages.books.form.publisherPlaceholder')} />
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
              <p className="mt-xs text-sm text-destructive">
                {errors.publisher.message}
              </p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="pages" className="flex items-center gap-xs">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.pagesLabel')}
            </Label>
            <Input
              id="pages"
              type="number"
              min="1"
              {...register('pages', {
                setValueAs: (value: string) => (value === '' ? 0 : parseInt(value)),
              })}
              disabled={isLoading}
            />
            {errors.pages && (
              <p className="mt-xs text-sm text-destructive">{errors.pages.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label htmlFor="edition" className="flex items-center gap-xs">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.editionLabel')}
            </Label>
            <Input
              id="edition"
              {...register('edition')}
              placeholder={t('pages.books.form.editionPlaceholder')}
              disabled={isLoading}
            />
            {errors.edition && (
              <p className="mt-xs text-sm text-destructive">{errors.edition.message}</p>
            )}
          </div>

          <div className="space-y-sm">
            <Label className="flex items-center gap-xs">
              <User2 className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.publishDateLabel')}
            </Label>
            <DatePicker
              value={watch('publish_date')}
              onChange={(date) =>
                setValue('publish_date', date ? formatLocalDate(date) : '')
              }
              placeholder={t('pages.books.form.publishDatePlaceholder')}
              disabled={isLoading}
            />
            {errors.publish_date && (
              <p className="mt-xs text-sm text-destructive">
                {errors.publish_date.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>

      {/* Arquivo digital — aparece condicionalmente ao selecionar mídia Digital */}
      {mediaType === 'Dig' && (
        <div>
          <Label className="flex items-center gap-xs">
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            {t('pages.books.form.bookFileLabel')}
          </Label>
          <div className="mt-sm flex items-center gap-md">
            <div className="flex min-w-0 flex-1 items-center gap-sm rounded-md border bg-muted px-3 py-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">
                {bookFileName ?? t('pages.books.form.bookFileNone')}
              </span>
              {bookFileName && (
                <button
                  type="button"
                  onClick={handleRemoveBookFile}
                  className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-background"
                  aria-label={t('pages.books.form.removeBookFile')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={bookFileInputRef}
              type="file"
              accept=".epub,.pdf"
              className="hidden"
              onChange={handleBookFileChange}
              id="book-file-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => bookFileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Upload className="mr-xs h-3 w-3" />
              {bookFileName
                ? t('pages.books.form.bookFileChangeBtn')
                : t('pages.books.form.bookFileSelectBtn')}
            </Button>
          </div>
          <p className="mt-xs text-xs text-muted-foreground">
            {t('pages.books.form.bookFileHint')}
          </p>
        </div>
      )}

      <FormSection title={t('pages.books.form.sectionReading')} icon={Star}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <div className="space-y-sm md:col-span-2">
            <Label className="flex items-center gap-xs">
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
              {t('pages.books.form.readStatusLabel')}
            </Label>
            <div className="flex rounded-md border border-border/70 bg-muted/30 p-0.5">
              {READ_STATUS_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('read_status', value)}
                  disabled={isLoading}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
                    watch('read_status') === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {(() => {
                    const StatusIcon = READ_STATUS_ICONS[value];
                    return StatusIcon ? <StatusIcon className="h-3.5 w-3.5" /> : null;
                  })()}
                  <span className="hidden sm:inline">
                    {t(`pages.books.readStatus.${value}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {watch('read_status') === 'paused' && (
            <div className="space-y-sm md:col-span-2">
              <Label htmlFor="pause_reason" className="flex items-center gap-xs">
                <Star className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.books.form.pauseReasonLabel')}
              </Label>
              <Textarea
                id="pause_reason"
                {...register('pause_reason')}
                placeholder={t('pages.books.form.pauseReasonPlaceholder')}
                rows={2}
                disabled={isLoading}
              />
              {errors.pause_reason && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.pause_reason.message}
                </p>
              )}
            </div>
          )}

          {!book && (
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-sm">
                <Checkbox
                  id="already-read"
                  checked={alreadyRead}
                  onCheckedChange={(checked) => {
                    setAlreadyRead(checked === true);
                    if (!checked) {
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                  disabled={isLoading}
                />
                <Label htmlFor="already-read" className="cursor-pointer font-normal">
                  {t('pages.books.form.alreadyReadLabel')}
                </Label>
              </div>

              {alreadyRead && (
                <div className="grid grid-cols-2 gap-md rounded-md border p-3">
                  <div>
                    <Label className="flex items-center gap-xs">
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('pages.books.form.startDateLabel')}
                    </Label>
                    <DatePicker
                      value={startDate}
                      onChange={(date) =>
                        setStartDate(date ? formatLocalDate(date) : '')
                      }
                      placeholder={t('pages.books.form.startDatePlaceholder')}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-xs">
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('pages.books.form.endDateLabel')}
                    </Label>
                    <DatePicker
                      value={endDate}
                      onChange={(date) => setEndDate(date ? formatLocalDate(date) : '')}
                      placeholder={t('pages.books.form.endDatePlaceholder')}
                      disabled={isLoading}
                    />
                    {endDate && startDate && endDate < startDate && (
                      <p className="mt-xs text-sm text-destructive">
                        {t('pages.books.form.endDateError')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {(watch('read_status') === 'read' || alreadyRead) && (
            <div className="space-y-sm md:col-span-2">
              <Label className="flex items-center gap-xs">
                <Star className="h-3.5 w-3.5 text-muted-foreground" />
                {t('pages.books.form.ratingLabel')}
              </Label>
              <StarRating
                value={watch('rating')}
                onChange={(value) => setValue('rating', value)}
                size="md"
                className="mt-sm"
              />
              {errors.rating && (
                <p className="mt-xs text-sm text-destructive">
                  {errors.rating.message}
                </p>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title={t('pages.books.form.sectionSynopsis')} icon={FileText}>
        <div className="space-y-sm">
          <Label htmlFor="synopsis" className="flex items-center gap-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {t('pages.books.form.synopsisLabel')}
          </Label>
          <Textarea
            id="synopsis"
            {...register('synopsis')}
            placeholder={t('pages.books.form.synopsisPlaceholder')}
            rows={5}
            disabled={isLoading}
          />
          {errors.synopsis && (
            <p className="mt-xs text-sm text-destructive">{errors.synopsis.message}</p>
          )}
        </div>
      </FormSection>

      <div className="flex justify-end gap-sm border-t pt-md">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
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
