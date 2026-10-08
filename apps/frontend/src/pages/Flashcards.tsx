/* eslint-disable max-lines */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain,
  CalendarClock,
  ChevronLeft,
  Layers,
  Plus,
  Star,
  Loader2,
  Save,
  X,
  CircleDot,
  BookOpen,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { FLASHCARD_STATUS_ICONS } from '@/config/icons';
import { useToast } from '@/hooks/use-toast';
import { DURATION } from '@/lib/animations';
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

const RATING_COLORS = [
  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  'bg-destructive/80 text-destructive-foreground hover:bg-destructive/70',
  'bg-warning text-warning-foreground hover:bg-warning/90',
  'bg-warning/80 text-warning-foreground hover:bg-warning/70',
  'bg-success/80 text-success-foreground hover:bg-success/70',
  'bg-success text-success-foreground hover:bg-success/90',
];

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
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('list');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: number }) =>
      flashCardService.review(id, rating),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: (data: FlashCardFormData) => flashCardService.create(data),
    onSuccess: () => {
      toast({ title: t('pages.flashcards.generatedSuccess', { count: 1 }) });
      setCreateOpen(false);
      setNewFront('');
      setNewBack('');
      void queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: 'destructive' }),
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

  const filteredCards = cards.filter(matchesFilters);
  const filteredDue = due.filter(matchesFilters);

  const hasActiveFilters =
    searchTerm !== '' || statusFilter !== 'all' || bookFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    createMutation.mutate({ front: newFront.trim(), back: newBack.trim() });
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
          icon={<Brain className="text-primary h-6 w-6" />}
          actions={
            mode === 'list' ? (
              <div className="gap-sm flex">
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
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
                        {([0, 1, 2, 3, 4, 5] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => handleRating(r)}
                            disabled={reviewMutation.isPending}
                            className={cn(
                              'px-sm py-sm rounded-md text-xs font-semibold transition-opacity disabled:opacity-50',
                              RATING_COLORS[r]
                            )}
                          >
                            {t(`pages.flashcards.rating.${r}`)}
                          </button>
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
          <Tabs defaultValue="all">
            <FilterBar
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters}
              activeFilters={[
                ...(statusFilter !== 'all'
                  ? [
                      {
                        key: 'status',
                        label: `${t('common.fields.status')}: ${t(`pages.flashcards.status.${statusFilter}`)}`,
                        onRemove: () => setStatusFilter('all'),
                      },
                    ]
                  : []),
                ...(bookFilter !== 'all'
                  ? [
                      {
                        key: 'book',
                        label: `${t('pages.flashcards.allBooks')}: ${bookFilter}`,
                        onRemove: () => setBookFilter('all'),
                      },
                    ]
                  : []),
              ]}
            >
              <FilterField label={t('common.filterLabels.search')}>
                <SearchInput
                  placeholder={t('pages.flashcards.searchPlaceholder')}
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  className="w-44"
                />
              </FilterField>
              <FilterField label={t('common.fields.status')}>
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
                    <SelectItem
                      value="new"
                      icon={<FLASHCARD_STATUS_ICONS.new className="h-4 w-4" />}
                    >
                      {t('pages.flashcards.status.new')}
                    </SelectItem>
                    <SelectItem
                      value="learning"
                      icon={<FLASHCARD_STATUS_ICONS.learning className="h-4 w-4" />}
                    >
                      {t('pages.flashcards.status.learning')}
                    </SelectItem>
                    <SelectItem
                      value="review"
                      icon={<FLASHCARD_STATUS_ICONS.review className="h-4 w-4" />}
                    >
                      {t('pages.flashcards.status.review')}
                    </SelectItem>
                    <SelectItem
                      value="mastered"
                      icon={<FLASHCARD_STATUS_ICONS.mastered className="h-4 w-4" />}
                    >
                      {t('pages.flashcards.status.mastered')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
              {bookTitles.length > 0 && (
                <FilterField label={t('common.filterLabels.book')}>
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
            <TabsList className="w-full">
              <TabsTrigger value="all" className="gap-xs flex-1">
                <Layers className="h-4 w-4" />
                {t('pages.flashcards.stats.total')}
              </TabsTrigger>
              <TabsTrigger value="due" className="gap-xs flex-1">
                <CalendarClock className="h-4 w-4" />
                {t('pages.flashcards.dueToday')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-md">
              {filteredCards.length === 0 ? (
                <EmptyState
                  title={t('pages.flashcards.empty.title')}
                  icon={<Brain className="text-muted-foreground h-10 w-10" />}
                />
              ) : (
                <PaginatedSlide
                  items={filteredCards}
                  pageSize={LIST_PAGE_SIZE}
                  className="gap-sm grid sm:grid-cols-2 lg:grid-cols-3"
                >
                  {(pageItems) =>
                    pageItems.map((card) => (
                      <Card key={card.id}>
                        <CardHeader className="pb-xs">
                          <div className="gap-sm flex items-start justify-between">
                            <Badge
                              variant={STATUS_BADGE_VARIANT[card.status]}
                              className="gap-xs text-xs"
                            >
                              {(() => {
                                const StatusIcon = FLASHCARD_STATUS_ICONS[card.status];
                                return StatusIcon ? (
                                  <StatusIcon
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                ) : null;
                              })()}
                              {t(`pages.flashcards.status.${card.status}`)}
                            </Badge>
                            {card.book_title && (
                              <span className="text-muted-foreground max-w-[120px] truncate text-xs">
                                {card.book_title}
                              </span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-sm">
                          <div>
                            <p className="mb-xs text-muted-foreground text-xs font-medium">
                              {t('pages.flashcards.front')}
                            </p>
                            <p className="text-sm">{card.front}</p>
                          </div>
                          <div className="pt-sm border-t">
                            <p className="mb-xs text-muted-foreground text-xs font-medium">
                              {t('pages.flashcards.back')}
                            </p>
                            <p className="text-muted-foreground text-sm">{card.back}</p>
                          </div>
                          {card.next_review && (
                            <p className="text-muted-foreground text-xs">
                              {t('pages.flashcards.nextReview')}:{' '}
                              {new Date(card.next_review).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  }
                </PaginatedSlide>
              )}
            </TabsContent>

            <TabsContent value="due" className="mt-md">
              {filteredDue.length === 0 ? (
                <EmptyState
                  title={t('pages.flashcards.emptyReview.title')}
                  icon={<Star className="text-muted-foreground h-10 w-10" />}
                />
              ) : (
                <PaginatedSlide
                  items={filteredDue}
                  pageSize={LIST_PAGE_SIZE}
                  className="gap-sm grid sm:grid-cols-2 lg:grid-cols-3"
                >
                  {(pageItems) =>
                    pageItems.map((card) => (
                      <Card key={card.id}>
                        <CardContent className="space-y-sm pt-md">
                          <p className="text-sm font-medium">{card.front}</p>
                          <p className="text-muted-foreground text-xs">{card.back}</p>
                        </CardContent>
                      </Card>
                    ))
                  }
                </PaginatedSlide>
              )}
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader sticky>
              <DialogTitle mode="create">{t('pages.flashcards.newCard')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-md">
              <div className="space-y-xs">
                <Label>{t('pages.flashcards.front')}</Label>
                <Textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-xs">
                <Label>{t('pages.flashcards.back')}</Label>
                <Textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div className="dialog-footer gap-sm flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  <X className="h-4 w-4" />
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {createMutation.isPending
                    ? t('common.actions.saving')
                    : t('common.actions.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AnimatedPage>
  );
}
