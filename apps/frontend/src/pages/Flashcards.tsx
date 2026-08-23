/* eslint-disable max-lines */
import {
  LightBulbIcon as Brain,
  ChevronLeftIcon as ChevronLeft,
  PlusIcon as Plus,
  ArrowUturnLeftIcon as RotateCcw,
  StarIcon as Star,
} from '@heroicons/react/24/solid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
          'absolute inset-0 transition-transform duration-500',
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
  const totalCount = allCards?.count ?? 0;
  const dueCount = dueCards?.count ?? 0;
  const masteredCount = cards.filter((c) => c.status === 'mastered').length;
  const newCount = cards.filter((c) => c.status === 'new').length;

  const currentCard = due[reviewIndex] ?? null;

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
          subtitle={t('pages.flashcards.subtitle')}
          icon={<Brain className="text-primary h-6 w-6" />}
          actions={
            mode === 'list' ? (
              <div className="gap-sm flex">
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-sm h-4 w-4" />
                  {t('pages.flashcards.newCard')}
                </Button>
                {dueCount > 0 && (
                  <Button onClick={handleStartReview}>
                    <Star className="mr-sm h-4 w-4" />
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
                <ChevronLeft className="mr-sm h-4 w-4" />
                {t('common.actions.back')}
              </Button>
            )
          }
        />

        <div className="gap-md grid grid-cols-2 sm:grid-cols-4">
          <StatCard
            title={t('pages.flashcards.stats.total')}
            value={totalCount}
            icon={<Brain />}
          />
          <StatCard
            title={t('pages.flashcards.stats.due')}
            value={dueCount}
            icon={<RotateCcw />}
            accentColor="orange"
          />
          <StatCard
            title={t('pages.flashcards.stats.mastered')}
            value={masteredCount}
            icon={<Star />}
            accentColor="green"
          />
          <StatCard
            title={t('pages.flashcards.stats.new')}
            value={newCount}
            icon={<Plus />}
            accentColor="blue"
          />
        </div>

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
                  description={t('pages.flashcards.emptyReview.description')}
                  icon={<Star className="text-muted-foreground h-10 w-10" />}
                />
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                {t('pages.flashcards.stats.total')}
              </TabsTrigger>
              <TabsTrigger value="due" className="flex-1">
                {t('pages.flashcards.dueToday')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-md">
              {cards.length === 0 ? (
                <EmptyState
                  title={t('pages.flashcards.empty.title')}
                  description={t('pages.flashcards.empty.description')}
                  icon={<Brain className="text-muted-foreground h-10 w-10" />}
                />
              ) : (
                <div className="gap-sm grid sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((card) => (
                    <Card key={card.id}>
                      <CardHeader className="pb-xs">
                        <div className="gap-sm flex items-start justify-between">
                          <Badge
                            variant={STATUS_BADGE_VARIANT[card.status]}
                            className="text-xs"
                          >
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
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="due" className="mt-md">
              {due.length === 0 ? (
                <EmptyState
                  title={t('pages.flashcards.emptyReview.title')}
                  description={t('pages.flashcards.emptyReview.description')}
                  icon={<Star className="text-muted-foreground h-10 w-10" />}
                />
              ) : (
                <div className="gap-sm grid sm:grid-cols-2 lg:grid-cols-3">
                  {due.map((card) => (
                    <Card key={card.id} className="border-warning/30">
                      <CardContent className="space-y-sm pt-md">
                        <p className="text-sm font-medium">{card.front}</p>
                        <p className="text-muted-foreground text-xs">{card.back}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="gap-sm flex items-center">
                <Brain className="text-primary h-4 w-4" />
                {t('pages.flashcards.newCard')}
              </DialogTitle>
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
              <div className="gap-sm flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
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
