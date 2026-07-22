/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Brain, Clock, Flame, PlayCircle, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnimatedPage } from '@/components/common/AnimatedPage';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { API_CONFIG } from '@/config/constants';
import { STALE_TIMES } from '@/lib/query-client';
import { apiClient } from '@/services/api-client';
import { intellectBadgesService } from '@/services/intellect-badges-service';
import { libraryDashboardService } from '@/services/library-dashboard-service';
import type { Book, Course } from '@/types';

const BADGE_LEVEL_COLORS: Record<string, string> = {
  bronze:
    'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300',
  silver:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  gold: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300',
};

export default function IntellectToday() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['library-dashboard-stats'],
    queryFn: () => libraryDashboardService.getStats(),
    staleTime: STALE_TIMES.DASHBOARD_STATS,
  });

  const { data: booksData, isLoading: isLoadingBooks } = useQuery({
    queryKey: ['books', 'reading'],
    queryFn: () =>
      apiClient.get<{ results: Book[]; count: number }>(
        `${API_CONFIG.ENDPOINTS.BOOKS}?read_status=reading`
      ),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', 'in_progress'],
    queryFn: () =>
      apiClient.get<{ results: Course[]; count: number }>(
        `${API_CONFIG.ENDPOINTS.COURSES}?status=in_progress`
      ),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: flashcardsData, isLoading: isLoadingFlashcards } = useQuery({
    queryKey: ['flashcards', 'due'],
    queryFn: () =>
      apiClient.get<{ results: unknown[]; count: number }>(
        `${API_CONFIG.ENDPOINTS.FLASHCARDS}?due=true`
      ),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: badges, isLoading: isLoadingBadges } = useQuery({
    queryKey: ['intellect-badges'],
    queryFn: () => intellectBadgesService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const isLoading =
    isLoadingStats ||
    isLoadingBooks ||
    isLoadingCourses ||
    isLoadingFlashcards ||
    isLoadingBadges;

  const activeBook = booksData?.results[0] ?? null;
  const activeCourse = coursesData?.results[0] ?? null;
  const dueFlashcardsCount = flashcardsData?.count ?? 0;
  const recentBadges = badges?.slice(0, 4) ?? [];

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
          title={t('pages.intellectToday.title')}
          subtitle={t('pages.intellectToday.subtitle')}
          icon={<Brain className="h-6 w-6 text-primary" />}
        />

        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <StatCard
            title={t('pages.intellectToday.weekProgress')}
            value={stats?.total_sessions ?? 0}
            icon={<Clock />}
            accentColor="blue"
          />
          <StatCard
            title={t('pages.intellectToday.activeCourse')}
            value={coursesData?.count ?? 0}
            icon={<PlayCircle />}
            accentColor="purple"
          />
          <StatCard
            title={t('pages.intellectToday.dueFlashcards')}
            value={dueFlashcardsCount}
            icon={<Zap />}
            accentColor="orange"
          />
        </div>

        <div className="grid gap-md lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-sm text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-primary" />
                {t('pages.intellectToday.activeBook')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeBook ? (
                <div className="space-y-md">
                  <div className="flex gap-md">
                    {activeBook.cover ? (
                      <img
                        src={activeBook.cover}
                        alt={activeBook.title}
                        className="h-20 w-14 shrink-0 rounded object-cover shadow"
                      />
                    ) : (
                      <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded border bg-muted">
                        <BookOpen className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-xs">
                      <p className="truncate font-semibold">{activeBook.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeBook.authors_names.join(', ')}
                      </p>
                      {activeBook.reading_progress > 0 && (
                        <div className="space-y-xs">
                          <Progress
                            value={activeBook.reading_progress}
                            className="h-1.5"
                          />
                          <p className="text-xs text-muted-foreground">
                            {activeBook.reading_progress}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full gap-sm"
                    onClick={() => void navigate('/library/books')}
                  >
                    <BookOpen className="h-4 w-4" />
                    {t('pages.intellectToday.continueReading')}
                  </Button>
                </div>
              ) : (
                <EmptyState
                  title={t('pages.intellectToday.noActiveBook')}
                  description={t('pages.intellectToday.startReading')}
                  icon={<BookOpen className="h-8 w-8 text-muted-foreground" />}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-sm text-sm font-semibold">
                <PlayCircle className="h-4 w-4 text-primary" />
                {t('pages.intellectToday.activeCourse')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeCourse ? (
                <div className="space-y-md">
                  <div className="space-y-xs">
                    <p className="font-semibold">{activeCourse.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeCourse.platform_display}
                    </p>
                    <div className="space-y-xs">
                      <Progress
                        value={activeCourse.progress_percentage}
                        className="h-1.5"
                      />
                      <p className="text-xs text-muted-foreground">
                        {activeCourse.progress_percentage}% —{' '}
                        {activeCourse.completed_lessons}/{activeCourse.total_lessons}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full gap-sm"
                    variant="outline"
                    onClick={() => void navigate('/intellect/courses')}
                  >
                    <PlayCircle className="h-4 w-4" />
                    {t('pages.intellectToday.startCourse')}
                  </Button>
                </div>
              ) : (
                <EmptyState
                  title={t('pages.intellectToday.noCourse')}
                  description={t('pages.intellectToday.startCourse')}
                  icon={<PlayCircle className="h-8 w-8 text-muted-foreground" />}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-sm text-sm font-semibold">
              <Zap className="h-4 w-4 text-primary" />
              {t('pages.intellectToday.quickActions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
              <Button
                variant="outline"
                className="flex flex-col gap-xs py-md"
                onClick={() => void navigate('/library/books')}
              >
                <BookOpen className="h-5 w-5" />
                <span className="text-xs">{t('pages.intellectToday.logReading')}</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col gap-xs py-md"
                onClick={() => void navigate('/library/flashcards')}
              >
                <Brain className="h-5 w-5" />
                <span className="text-xs">{t('pages.intellectToday.reviewCards')}</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col gap-xs py-md"
                onClick={() => void navigate('/library/books')}
              >
                <PlayCircle className="h-5 w-5" />
                <span className="text-xs">
                  {t('pages.intellectToday.startReading')}
                </span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col gap-xs py-md"
                onClick={() => void navigate('/intellect/courses')}
              >
                <Zap className="h-5 w-5" />
                <span className="text-xs">{t('pages.intellectToday.startCourse')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-sm text-sm font-semibold">
                <Flame className="h-4 w-4 text-warning" />
                {t('pages.intellectToday.streak')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.reading_streak.current_streak ? (
              <div className="flex items-center gap-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <Flame className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">
                    {t('pages.intellectToday.days', {
                      count: stats.reading_streak.current_streak,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('pages.intellectToday.weekProgress')}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('pages.intellectToday.noStreak')}
              </p>
            )}
          </CardContent>
        </Card>

        {recentBadges.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-sm text-sm font-semibold">
                  <Award className="h-4 w-4 text-primary" />
                  {t('pages.intellectToday.badges')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => void navigate('/intellect/library-dashboard')}
                >
                  {t('pages.intellectToday.viewAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-sm">
                {recentBadges.map((badge) => (
                  <span
                    key={badge.id}
                    className={`inline-flex items-center gap-xs rounded-full border px-sm py-xs text-xs font-medium ${BADGE_LEVEL_COLORS[badge.level] ?? ''}`}
                  >
                    <Award className="h-3 w-3 shrink-0" />
                    {badge.code_display}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </AnimatedPage>
  );
}
