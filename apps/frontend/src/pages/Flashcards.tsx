/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  FileText,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Star,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { CardActions } from '@/components/common/CardActions';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide, GRID_PAGE_SIZE } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { FLASHCARD_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DURATION } from '@/lib/animations';
import { formatDate } from '@/lib/formatters';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import {
  flashCardService,
  type FlashCard,
  type FlashCardFormData,
} from '@/services/flashcard-service';
import { getErrorMessage } from '@/utils/error-utils';

type Mode = 'list' | 'review';

const STATUS_BADGE_VARIANT: Record<
  FlashCard['status'],
  'default' | 'secondary' | 'outline'
> = {
  new: 'default',
  learning: 'secondary',
  review: 'outline',
  mastered: 'outline',
};

/** Notas SM-2 (0–5): cor por resultado e ícone à esquerda do texto (§4). */
const RATINGS = [
  {
    className: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    icon: RotateCcw,
  },
  {
    className: 'bg-destructive/80 text-destructive-foreground hover:bg-destructive/70',
    icon: XCircle,
  },
  {
    className: 'bg-warning text-warning-foreground hover:bg-warning/90',
    icon: AlertCircle,
  },
  {
    className: 'bg-warning/80 text-warning-foreground hover:bg-warning/70',
    icon: CircleDot,
  },
  {
    className: 'bg-success/80 text-success-foreground hover:bg-success/70',
    icon: ThumbsUp,
  },
  {
    className: 'bg-success text-success-foreground hover:bg-success/90',
    icon: Sparkles,
  },
] as const;

type ViewFilter = 'all' | 'due';

function FlipCard({
  card,
  flipped,
  onFlip,
}: {
  card: FlashCard;
  flipped: boolean;
  onFlip: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('pages.flashcards.flipCard')}
      className={cn(
        'relative h-48 w-full cursor-pointer select-none',
        '[perspective:1000px]'
      )}
      onClick={onFlip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onFlip();
      }}
    >
      <div
        className={cn(
          'duration-slow absolute inset-0 transition-transform',
          '[transform-style:preserve-3d]',
          flipped ? '[transform:rotateY(180deg)]' : ''
        )}
      >
        <div className="bg-card p-lg absolute inset-0 flex items-center justify-center rounded-lg border text-center [backface-visibility:hidden]">
          <p className="text-lg font-medium">{card.front}</p>
        </div>
        <div className="bg-primary/5 p-lg absolute inset-0 flex [transform:rotateY(180deg)] items-center justify-center rounded-lg border text-center [backface-visibility:hidden]">
          <p className="text-lg">{card.back}</p>
        </div>
      </div>
    </div>
  );
}

export default function Flashcards() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('list');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Incluir (header) e editar (card) usam o mesmo modal (§2.2).
  const [form, setForm] = useState<{ open: boolean; card?: FlashCard }>({
    open: false,
  });
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [invalid, setInvalid] = useState<{ front?: boolean; back?: boolean }>({});
  const [detailCard, setDetailCard] = useState<FlashCard | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookFilter, setBookFilter] = useState('all');

  const { data: allCards, isLoading } = useQuery({
    queryKey: ['flashcards'],
    queryFn: () => flashCardService.getAll(false),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: dueCards } = useQuery({
    queryKey: ['flashcards', 'due'],
    queryFn: () => flashCardService.getAll(true),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['flashcards'] });
  const errorToast = (err: unknown) =>
    toast({ title: getErrorMessage(err), variant: 'destructive' });

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: number }) =>
      flashCardService.review(id, rating),
    onSuccess: () => void invalidate(),
    onError: errorToast,
  });

  const saveMutation = useMutation({
    mutationFn: ({ data, card }: { data: FlashCardFormData; card?: FlashCard }) =>
      card ? flashCardService.update(card.id, data) : flashCardService.create(data),
    onSuccess: (_saved, { card }) => {
      toast({
        title: card
          ? t('pages.flashcards.updated')
          : t('pages.flashcards.generatedSuccess', { count: 1 }),
      });
      setForm({ open: false });
      void invalidate();
    },
    onError: errorToast,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => flashCardService.delete(id),
    onSuccess: () => {
      toast({ title: t('pages.flashcards.deleted') });
      void invalidate();
    },
    onError: errorToast,
  });

  const cards = allCards?.results ?? [];
  const due = dueCards?.results ?? [];
  const dueCount = dueCards?.count ?? 0;

  const currentCard = due[reviewIndex] ?? null;

  const bookTitles = Array.from(
    new Set(cards.map((c) => c.book_title).filter((b): b is string => !!b))
  );

  const matchesFilters = (card: FlashCard) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!card.front.toLowerCase().includes(q) && !card.back.toLowerCase().includes(q))
        return false;
    }
    if (statusFilter !== 'all' && card.status !== statusFilter) return false;
    if (bookFilter !== 'all' && card.book_title !== bookFilter) return false;
    return true;
  };

  const filteredCards = (viewFilter === 'due' ? due : cards).filter(matchesFilters);

  const hasActiveFilters =
    searchTerm !== '' ||
    viewFilter !== 'all' ||
    statusFilter !== 'all' ||
    bookFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setViewFilter('all');
    setStatusFilter('all');
    setBookFilter('all');
  };

  const handleRating = (rating: number) => {
    if (!currentCard) return;
    reviewMutation.mutate({ id: currentCard.id, rating });
    setFlipped(false);
    if (reviewIndex < due.length - 1) {
      setReviewIndex((i) => i + 1);
    } else {
      setMode('list');
      setReviewIndex(0);
    }
  };

  const handleStartReview = () => {
    if (due.length === 0) return;
    setReviewIndex(0);
    setFlipped(false);
    setMode('review');
  };

  const openForm = (card?: FlashCard) => {
    setFront(card?.front ?? '');
    setBack(card?.back ?? '');
    setInvalid({});
    setForm({ open: true, card });
  };

  const handleDelete = (card: FlashCard) => {
    void showConfirm({
      title: t('common.messages.confirmDeleteTitle'),
      description: card.front,
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    }).then((ok) => {
      if (ok) deleteMutation.mutate(card.id);
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = { front: !front.trim(), back: !back.trim() };
    setInvalid(missing);
    if (missing.front) {
      toast({
        title: t('common.fieldRequired', { field: t('pages.flashcards.front') }),
        variant: 'destructive',
      });
    }
    if (missing.back) {
      toast({
        title: t('common.fieldRequired', { field: t('pages.flashcards.back') }),
        variant: 'destructive',
      });
    }
    if (missing.front || missing.back) return;
    saveMutation.mutate({
      data: { front: front.trim(), back: back.trim() },
      card: form.card,
    });
  };

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageContainer>
          <LoadingState />
        </PageContainer>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageContainer>
        <PageHeader
          title={t('pages.flashcards.title')}
          icon={<Layers className="text-primary h-6 w-6" />}
          actions={
            mode === 'list' ? (
              <div className="gap-sm flex">
                <Button onClick={() => openForm()}>
                  <Plus className="h-4 w-4" />
                  {t('pages.flashcards.newCard')}
                </Button>
                {dueCount > 0 && (
                  <Button onClick={handleStartReview}>
                    <Star className="h-4 w-4" />
                    {t('pages.flashcards.reviewNow')}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setMode('list');
                  setReviewIndex(0);
                  setFlipped(false);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('common.actions.back')}
              </Button>
            )
          }
        />

        {mode === 'review' ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={reviewIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: DURATION.fast }}
              className="space-y-md"
            >
              {currentCard ? (
                <>
                  <div className="text-muted-foreground flex items-center justify-between text-sm">
                    <span>
                      {reviewIndex + 1} / {due.length}
                    </span>
                    {currentCard.book_title && (
                      <span className="text-xs">{currentCard.book_title}</span>
                    )}
                  </div>

                  <FlipCard
                    card={currentCard}
                    flipped={flipped}
                    onFlip={() => setFlipped((v) => !v)}
                  />

                  {!flipped && (
                    <p className="text-muted-foreground text-center text-sm">
                      {t('pages.flashcards.flipCard')}
                    </p>
                  )}

                  {flipped && (
                    <div className="space-y-sm">
                      <p className="text-center text-sm font-medium">
                        {t('pages.flashcards.rating.label')}
                      </p>
                      <div className="gap-sm grid grid-cols-3 sm:grid-cols-6">
                        {RATINGS.map(({ className, icon: Icon }, r) => (
                          <Button
                            key={r}
                            type="button"
                            onClick={() => handleRating(r)}
                            disabled={reviewMutation.isPending}
                            className={cn('text-xs', className)}
                          >
                            <Icon className="h-4 w-4" />
                            {t(`pages.flashcards.rating.${r}`)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  title={t('pages.flashcards.emptyReview.title')}
                  icon={<Star className="text-muted-foreground h-10 w-10" />}
                />
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <>
            <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
              <FilterField label={t('common.filterLabels.search')} icon={Search}>
                <SearchInput
                  placeholder={t('pages.flashcards.searchPlaceholder')}
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  className="w-44"
                />
              </FilterField>
              {/* "Todos / Vencem hoje" filtra a mesma lista: é filtro, não aba (§13). */}
              <FilterField label={t('pages.flashcards.viewFilter')} icon={Layers}>
                <Select
                  value={viewFilter}
                  onValueChange={(v) => setViewFilter(v as ViewFilter)}
                >
                  <SelectTrigger
                    className="w-40"
                    aria-label={t('pages.flashcards.viewFilter')}
                    startIcon={<CalendarClock className="h-3.5 w-3.5" />}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('pages.flashcards.allCards')}
                    </SelectItem>
                    <SelectItem value="due">
                      {t('pages.flashcards.dueToday')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label={t('common.fields.status')} icon={CheckCircle2}>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger
                    className="w-40"
                    aria-label={t('pages.flashcards.allStatus')}
                    startIcon={<CircleDot className="h-3.5 w-3.5" />}
                  >
                    <SelectValue placeholder={t('pages.flashcards.allStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('pages.flashcards.allStatus')}
                    </SelectItem>
                    {(['new', 'learning', 'review', 'mastered'] as const).map((st) => {
                      const Icon = FLASHCARD_STATUS_ICONS[st];
                      return (
                        <SelectItem
                          key={st}
                          value={st}
                          icon={<Icon className="h-4 w-4" />}
                        >
                          {t(`pages.flashcards.status.${st}`)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </FilterField>
              {bookTitles.length > 0 && (
                <FilterField label={t('common.filterLabels.book')} icon={BookOpen}>
                  <Select value={bookFilter} onValueChange={setBookFilter}>
                    <SelectTrigger
                      className="w-44"
                      aria-label={t('pages.flashcards.allBooks')}
                      startIcon={<BookOpen className="h-3.5 w-3.5" />}
                    >
                      <SelectValue placeholder={t('pages.flashcards.allBooks')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('pages.flashcards.allBooks')}
                      </SelectItem>
                      {bookTitles.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
              )}
            </FilterBar>

            {filteredCards.length === 0 ? (
              <EmptyState
                title={
                  viewFilter === 'due'
                    ? t('pages.flashcards.emptyReview.title')
                    : t('pages.flashcards.empty.title')
                }
                icon={<Layers className="text-muted-foreground h-10 w-10" />}
              />
            ) : (
              <PaginatedSlide
                key={`${viewFilter}-${statusFilter}-${bookFilter}-${searchTerm}`}
                items={filteredCards}
                pageSize={GRID_PAGE_SIZE}
                className="gap-md grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              >
                {(pageItems) =>
                  pageItems.map((card) => {
                    const StatusIcon = FLASHCARD_STATUS_ICONS[card.status];
                    return (
                      <div
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailCard(card)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setDetailCard(card);
                        }}
                        className="bg-card border-border flex cursor-pointer flex-col rounded-lg border"
                      >
                        <div className="px-md py-sm space-y-xs flex-1">
                          <div className="gap-sm flex items-start justify-between">
                            <p
                              className="truncate text-sm font-semibold"
                              title={card.front}
                            >
                              {card.front}
                            </p>
                            <Badge
                              variant={STATUS_BADGE_VARIANT[card.status]}
                              className="gap-xs shrink-0 text-xs"
                            >
                              {StatusIcon && (
                                <StatusIcon
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              )}
                              {t(`pages.flashcards.status.${card.status}`)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground truncate text-xs">
                            {card.book_title ?? '—'}
                          </p>
                          <p className="gap-xs text-muted-foreground flex items-center text-xs">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDate(card.next_review, 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div
                          role="presentation"
                          className="gap-xs px-sm py-xs flex items-center justify-end border-t"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <CardActions
                            onEdit={() => openForm(card)}
                            onDelete={() => handleDelete(card)}
                          />
                        </div>
                      </div>
                    );
                  })
                }
              </PaginatedSlide>
            )}
          </>
        )}

        {/* Detalhe do card (somente leitura) */}
        <Dialog open={!!detailCard} onOpenChange={(v) => !v && setDetailCard(null)}>
          <DialogContent className="max-w-lg">
            {detailCard && (
              <>
                <DialogHeader>
                  <DialogTitle icon={Layers}>
                    {t('pages.flashcards.detailTitle')}
                  </DialogTitle>
                  <VisuallyHidden>
                    <DialogDescription>{detailCard.front}</DialogDescription>
                  </VisuallyHidden>
                </DialogHeader>
                <div className="space-y-md text-sm">
                  <div>
                    <p className="mb-xs text-muted-foreground text-xs font-medium">
                      {t('pages.flashcards.front')}
                    </p>
                    <p className="line-clamp-6">{detailCard.front}</p>
                  </div>
                  <div className="pt-sm border-t">
                    <p className="mb-xs text-muted-foreground text-xs font-medium">
                      {t('pages.flashcards.back')}
                    </p>
                    <p className="line-clamp-6">{detailCard.back}</p>
                  </div>
                  <div className="gap-sm text-muted-foreground flex flex-wrap items-center text-xs">
                    <Badge variant={STATUS_BADGE_VARIANT[detailCard.status]}>
                      {t(`pages.flashcards.status.${detailCard.status}`)}
                    </Badge>
                    {detailCard.book_title && (
                      <span className="gap-xs flex items-center">
                        <BookOpen className="h-3.5 w-3.5" />
                        {detailCard.book_title}
                      </span>
                    )}
                    <span className="gap-xs flex items-center">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {t('pages.flashcards.nextReview')}:{' '}
                      {formatDate(detailCard.next_review, 'dd/MM/yyyy')}
                    </span>
                  </div>
                </div>
                <DialogCloseFooter />
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Incluir / editar */}
        <Dialog open={form.open} onOpenChange={(v) => !v && setForm({ open: false })}>
          <DialogContent className="max-w-md">
            <form onSubmit={handleFormSubmit}>
              <DialogHeader>
                <DialogTitle mode={form.card ? 'edit' : 'create'}>
                  {form.card
                    ? t('pages.flashcards.editCard')
                    : t('pages.flashcards.newCard')}
                </DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>{t('pages.flashcards.title')}</DialogDescription>
                </VisuallyHidden>
              </DialogHeader>
              <div className="space-y-md py-md">
                <div className="space-y-xs">
                  <Label className="gap-xs flex items-center" htmlFor="fc-front">
                    <FileText className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.flashcards.front')}
                  </Label>
                  <Textarea
                    id="fc-front"
                    value={front}
                    placeholder={t('common.placeholders.flashcardFront')}
                    onChange={(e) => setFront(e.target.value)}
                    aria-invalid={invalid.front}
                    rows={3}
                  />
                </div>
                <div className="space-y-xs">
                  <Label className="gap-xs flex items-center" htmlFor="fc-back">
                    <FileText className="text-muted-foreground h-3.5 w-3.5" />
                    {t('pages.flashcards.back')}
                  </Label>
                  <Textarea
                    id="fc-back"
                    value={back}
                    placeholder={t('common.placeholders.flashcardBack')}
                    onChange={(e) => setBack(e.target.value)}
                    aria-invalid={invalid.back}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm({ open: false })}
                >
                  <X className="h-4 w-4" />
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" loading={saveMutation.isPending}>
                  {!saveMutation.isPending && <Save className="h-4 w-4" />}
                  {t('common.actions.save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}
