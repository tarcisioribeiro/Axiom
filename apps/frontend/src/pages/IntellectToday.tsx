/* eslint-disable max-lines */
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  Clock,
  Eye,
  Flame,
  PlayCircle,
  Sunrise,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

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
import { MEDAL_CLASSES, badgeLabel } from '@/lib/intellect-badges';
import { STALE_TIMES } from '@/lib/query-client';
import { apiClient } from '@/services/api-client';
import { intellectBadgesService } from '@/services/intellect-badges-service';
import { libraryDashboardService } from '@/services/library-dashboard-service';
import type { Book, Course } from '@/types';

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
    queryKey: ['flashcards', 'due', 'count'],
    queryFn: () =>
      apiClient.get<{ results: unknown[]; count: number }>(
        `${API_CONFIG.ENDPOINTS.FLASHCARDS}?due=true&page_size=1`
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
  const recentBadges = badges?.slice(0, 6) ?? [];
  const streak = stats?.reading_streak;

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
          icon={<Sunrise className="text-primary h-6 w-6" />}
        />

        <div className="gap-md grid grid-cols-1 sm:grid-cols-3">
          <StatCard
            title={t('pages.libraryDashboard.totalSessions')}
            value={stats?.total_sessions ?? 0}
            icon={<Clock />}
            accentColor="blue"
          />
          <StatCard
            title={t('pages.intellectToday.coursesInProgress')}
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

        <div className="gap-md grid lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="gap-sm flex items-center text-sm font-semibold">
                <BookOpen className="text-primary h-4 w-4" />
                {t('pages.intellectToday.activeBook')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeBook ? (
                <div className="gap-md flex items-center">
                  {activeBook.cover ? (
                    <img
                      src={activeBook.cover}
                      alt={activeBook.title}
                      className="h-20 w-14 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <div className="bg-muted flex h-20 w-14 shrink-0 items-center justify-center rounded border">
                      <BookOpen className="text-muted-foreground h-6 w-6" />
                    </div>
                  )}
                  <div className="space-y-xs min-w-0 flex-1">
                    <p className="truncate font-semibold">{activeBook.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {activeBook.authors_names.join(', ')}
                    </p>
                    <div className="gap-sm flex items-center">
                      <Progress
                        value={activeBook.reading_progress}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-muted-foreground text-xs">
                        {activeBook.reading_progress}%
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void navigate('/library/books')}
                  >
                    <BookOpen className="h-4 w-4" />
                    {t('pages.intellectToday.continueReading')}
                  </Button>
                </div>
              ) : (
                <EmptyState
                  title={t('pages.intellectToday.noActiveBook')}
                  icon={<BookOpen className="text-muted-foreground h-8 w-8" />}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="gap-sm flex items-center text-sm font-semibold">
                <PlayCircle className="text-primary h-4 w-4" />
                {t('pages.intellectToday.activeCourse')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeCourse ? (
                <div className="gap-md flex items-center">
                  <div className="space-y-xs min-w-0 flex-1">
                    <p className="truncate font-semibold">{activeCourse.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {t(`pages.courses.platform.${activeCourse.platform}`, {
                        defaultValue: activeCourse.platform_display,
                      })}
                    </p>
                    <div className="gap-sm flex items-center">
                      <Progress
                        value={activeCourse.progress_percentage}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-muted-foreground text-xs">
                        {activeCourse.completed_lessons}/{activeCourse.total_lessons}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void navigate('/library/courses')}
                  >
                    <PlayCircle className="h-4 w-4" />
                    {t('pages.intellectToday.openCourses')}
                  </Button>
                </div>
              ) : (
                <EmptyState
                  title={t('pages.intellectToday.noCourse')}
                  icon={<PlayCircle className="text-muted-foreground h-8 w-8" />}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="gap-sm flex items-center text-sm font-semibold">
                <Flame className="text-warning h-4 w-4" />
                {t('pages.intellectToday.streak')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {streak?.current_streak ? (
                <div className="gap-md flex items-center">
                  <div className="bg-warning/10 text-warning flex h-14 w-14 items-center justify-center rounded-full">
                    <Flame className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-warning text-2xl font-bold">
                      {t('pages.intellectToday.days', { count: streak.current_streak })}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t('pages.libraryDashboard.bestStreak')}:{' '}
                      {t('pages.intellectToday.days', { count: streak.longest_streak })}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title={t('pages.intellectToday.noStreak')}
                  icon={<Flame className="text-muted-foreground h-8 w-8" />}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="gap-sm flex items-center text-sm font-semibold">
                  <Award className="text-primary h-4 w-4" />
                  {t('pages.intellectToday.badges')}
                </CardTitle>
                {recentBadges.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void navigate('/planning/journey')}
                  >
                    <Eye aria-hidden="true" />
                    {t('pages.intellectToday.viewAll')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentBadges.length > 0 ? (
                <div className="gap-sm flex flex-wrap">
                  {recentBadges.map((badge) => (
                    <span
                      key={badge.id}
                      className={`gap-xs px-sm py-xs inline-flex items-center rounded-full border text-xs font-medium ${MEDAL_CLASSES[badge.level] ?? ''}`}
                    >
                      <Award className="h-3 w-3 shrink-0" />
                      {badgeLabel(t, badge)}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t('pages.intellectToday.noBadges')}
                  icon={<Award className="text-muted-foreground h-8 w-8" />}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </AnimatedPage>
  );
}
