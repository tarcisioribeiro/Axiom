import {
  Bookmark,
  BookOpen,
  Hash,
  Palette,
  Quote,
  Save,
  Shapes,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { HIGHLIGHT_DOT } from '@/lib/highlight-colors';
import type { Book, BookHighlight, BookHighlightFormData } from '@/types';

const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'] as const;
const COLOR_KEYS: Record<(typeof COLORS)[number], string> = {
  yellow: 'colorYellow',
  green: 'colorGreen',
  blue: 'colorBlue',
  pink: 'colorPink',
  orange: 'colorOrange',
};

interface HighlightFormProps {
  highlight?: BookHighlight;
  /** Livros do seletor. Ignorado quando `bookId` vem fixo (detalhe do livro). */
  books?: Book[];
  /** Livro fixo: esconde o seletor de livro. */
  bookId?: number;
  ownerId: number;
  onSubmit: (data: BookHighlightFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

/** Formulário de destaque (incluir/editar), sempre dentro de um Dialog. */
export function HighlightForm({
  highlight,
  books = [],
  bookId: fixedBookId,
  ownerId,
  onSubmit,
  onCancel,
  isLoading,
}: HighlightFormProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(highlight?.text ?? '');
  const [bookId, setBookId] = useState<string>(
    fixedBookId ? String(fixedBookId) : highlight ? String(highlight.book) : ''
  );
  const [pageNumber, setPageNumber] = useState<number | null>(
    highlight?.page_number ?? null
  );
  const [chapter, setChapter] = useState(highlight?.chapter ?? '');
  const [highlightType, setHighlightType] = useState(
    highlight?.highlight_type ?? 'quote'
  );
  const [color, setColor] = useState(highlight?.color ?? 'yellow');
  const [invalid, setInvalid] = useState<{ book?: boolean; text?: boolean }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = { book: !bookId, text: !text.trim() };
    setInvalid(missing);
    if (missing.book) {
      toast({
        title: t('common.fieldRequired', {
          field: t('pages.highlights.form.bookLabel'),
        }),
        variant: 'destructive',
      });
    }
    if (missing.text) {
      toast({
        title: t('common.fieldRequired', {
          field: t('pages.highlights.form.textLabel'),
        }),
        variant: 'destructive',
      });
    }
    if (missing.book || missing.text) return;
    await onSubmit({
      book: Number(bookId),
      text: text.trim(),
      page_number: pageNumber,
      chapter: chapter.trim() || null,
      highlight_type: highlightType,
      color,
      owner: ownerId,
    });
  };

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-md">
      {!fixedBookId && (
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="hl-book">
            <BookOpen className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.highlights.form.bookLabel')}
          </Label>
          <Select value={bookId} onValueChange={setBookId}>
            <SelectTrigger id="hl-book" aria-invalid={invalid.book}>
              <SelectValue placeholder={t('pages.highlights.form.bookPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {books.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-sm">
        <Label className="gap-xs flex items-center" htmlFor="hl-text">
          <Quote className="text-muted-foreground h-3.5 w-3.5" />
          {t('pages.highlights.form.textLabel')}
        </Label>
        <Textarea
          id="hl-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('pages.highlights.form.textPlaceholder')}
          aria-invalid={invalid.text}
          rows={4}
        />
      </div>

      <div className="gap-md grid grid-cols-2">
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="hl-type">
            <Shapes className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.highlights.form.typeLabel')}
          </Label>
          <Select
            value={highlightType}
            onValueChange={(v) => setHighlightType(v as typeof highlightType)}
          >
            <SelectTrigger id="hl-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">
                {t('pages.highlights.form.typeQuote')}
              </SelectItem>
              <SelectItem value="note">
                {t('pages.highlights.form.typeNote')}
              </SelectItem>
              <SelectItem value="idea">
                {t('pages.highlights.form.typeIdea')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="hl-color">
            <Palette className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.highlights.form.colorLabel')}
          </Label>
          <Select value={color} onValueChange={(v) => setColor(v as typeof color)}>
            <SelectTrigger id="hl-color">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLORS.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="gap-sm flex items-center">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${HIGHLIGHT_DOT[c]}`}
                    />
                    {t(`pages.highlights.form.${COLOR_KEYS[c]}`)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="gap-md grid grid-cols-2">
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="hl-page">
            <Hash className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.highlights.form.pageLabel')}
          </Label>
          <NumberStepper
            id="hl-page"
            min={1}
            optional
            placeholder={t('pages.highlights.form.pagePlaceholder')}
            value={pageNumber}
            onChange={setPageNumber}
          />
        </div>
        <div className="space-y-sm">
          <Label className="gap-xs flex items-center" htmlFor="hl-chapter">
            <Bookmark className="text-muted-foreground h-3.5 w-3.5" />
            {t('pages.highlights.form.chapterLabel')}
          </Label>
          <Input
            id="hl-chapter"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder={t('pages.highlights.form.chapterPlaceholder')}
          />
        </div>
      </div>

      <div className="dialog-footer gap-sm pt-sm flex justify-end">
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
