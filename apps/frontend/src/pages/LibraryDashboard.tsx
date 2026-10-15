/* eslint-disable max-lines */
/**
 * Dashboard do Intelecto: 3 seções em acordeão (Leitura, Acervo, Aprendizado),
 * só uma aberta por vez e sem rolagem de página (§5, §6). A meta de leitura
 * fica em Obras (botão "Meta de Leitura").
 */
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Gauge,
  GraduationCap,
  Library,
  ListChecks,
  Star,
  Timer,
  TrendingUp,
  Trophy,
  UserPen,
  Brain,
  Flame,
  BookMarked,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { LIST_PAGE_SIZE, PaginatedSlide } from '@/components/common/PaginatedSlide';
import { StreakBadge } from '@/components/common/StreakBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Progress } from '@/components/ui/progress';
import { useChartColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { coursesService } from '@/services/courses-service';
import { libraryDashboardService } from '@/services/library-dashboard-service';
import { skillsService } from '@/services/skills-service';

type Section = 'reading' | 'collection' | 'learning';

const CHART_HEIGHT = 170;

/** Indicador compacto (ícone + rótulo + valor) para as faixas de KPIs. */
function Kpi({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="border-border px-sm py-xs flex flex-col items-center rounded-lg border text-center">
      <span className="gap-xs text-muted-foreground flex items-center text-xs [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {label}
      </span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-xs pt-sm px-md">
        <CardTitle className="gap-xs flex items-center text-sm font-medium [&_svg]:h-4 [&_svg]:w-4">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-md pb-sm flex-1">{children}</CardContent>
    </Card>
  );
}

function changeLabel(value: number | null): { text: string; className: string } {
  if (value === null) return { text: '—', className: 'text-muted-foreground' };
  const rounded = Math.round(value);
  if (rounded > 0) return { text: `+${rounded}%`, className: 'text-success' };
  if (rounded < 0) return { text: `${rounded}%`, className: 'text-destructive' };
  return { text: '0%', className: 'text-muted-foreground' };
}

export default function LibraryDashboard() {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['libraryDashboard'],
    queryFn: () => libraryDashboardService.getStats(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: skills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: () => skillsService.getAllPages(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const COLORS = useChartColors();

  const translatedBooksByGenre = useMemo(
    () =>
      (stats?.books_by_genre || []).map((item) => ({
        ...item,
        genre_display: t('pages.books.genres.' + item.genre, {
          defaultValue: item.genre_display,
        }),
      })),
    [stats?.books_by_genre, t]
  );

  const translatedBooksByLanguage = useMemo(
    () =>
      (stats?.books_by_language || []).map((item) => ({
        ...item,
        language_display: t('pages.books.languages.' + item.language, {
          defaultValue: item.language_display,
        }),
      })),
    [stats?.books_by_language, t]
  );

  const translatedBooksByMediaType = useMemo(
    () =>
      (stats?.books_by_media_type || []).map((item) => ({
        ...item,
        media_type_display: t('pages.books.mediaTypes.' + item.media_type, {
          defaultValue: item.media_type_display,
        }),
      })),
    [stats?.books_by_media_type, t]
  );

  const translatedBooksByLiteraryType = useMemo(
    () =>
      (stats?.books_by_literary_type || []).map((item) => ({
        ...item,
        literary_type_display: t('pages.books.literaryTypes.' + item.literarytype, {
          defaultValue: item.literary_type_display,
        }),
      })),
    [stats?.books_by_literary_type, t]
  );

  const translatedTopGenresByTime = useMemo(
    () =>
      (stats?.top_genres_by_time || []).map((item) => ({
        ...item,
        genre_display: t('pages.books.genres.' + item.genre, {
          defaultValue: item.genre_display,
        }),
      })),
    [stats?.top_genres_by_time, t]
  );

  const translatedRatingDistribution = useMemo(
    () =>
      (stats?.rating_distribution || []).map((item) => {
        const match = item.rating_range.match(/^(\d+)/);
        const count = match ? parseInt(match[1], 10) : 0;
        return {
          ...item,
          rating_range:
            count > 0
              ? t('pages.libraryDashboard.ratingRange', { count })
              : item.rating_range,
        };
      }),
    [stats?.rating_distribution, t]
  );

  const courseStats = useMemo(() => {
    const inProgress = courses.filter((c) => c.status === 'in_progress');
    const completed = courses.filter((c) => c.status === 'completed');
    const notStarted = courses.filter((c) => c.status === 'not_started');
    const paused = courses.filter((c) => c.status === 'paused');
    const avgProgress =
      inProgress.length > 0
        ? inProgress.reduce((sum, c) => sum + (c.progress_percentage || 0), 0) /
          inProgress.length
        : 0;
    const completionRate =
      courses.length > 0 ? (completed.length / courses.length) * 100 : 0;

    const byCategory: Record<string, number> = {};
    courses.forEach((c) => {
      const name = t(`pages.courses.category.${c.category}`, {
        defaultValue: c.category_display,
      });
      byCategory[name] = (byCategory[name] ?? 0) + 1;
    });
    const byCategoryData = Object.entries(byCategory).map(([name, count]) => ({
      name,
      count,
    }));

    const byPlatform: Record<string, number> = {};
    courses.forEach((c) => {
      const name = t(`pages.courses.platform.${c.platform}`, {
        defaultValue: c.platform_display,
      });
      byPlatform[name] = (byPlatform[name] ?? 0) + 1;
    });
    const byPlatformData = Object.entries(byPlatform).map(([name, count]) => ({
      name,
      count,
    }));

    return {
      total: courses.length,
      inProgress: inProgress.length,
      completed: completed.length,
      notStarted: notStarted.length,
      paused: paused.length,
      investedHours: courses.reduce((sum, c) => sum + (c.invested_hours || 0), 0),
      avgProgress,
      completionRate,
      byCategoryData,
      byPlatformData,
    };
  }, [courses, t]);

  const skillStats = useMemo(() => {
    const mastered = skills.filter((s) => s.status === 'mastered').length;
    const evolving = skills.filter((s) => s.status === 'evolving').length;
    const learning = skills.filter((s) => s.status === 'learning').length;

    const proficiencyOrder = [
      'beginner',
      'basic',
      'intermediate',
      'advanced',
      'expert',
    ];
    const byProficiency: Record<string, number> = {};
    skills.forEach((s) => {
      byProficiency[s.proficiency] = (byProficiency[s.proficiency] ?? 0) + 1;
    });
    const byProficiencyData = proficiencyOrder
      .filter((p) => byProficiency[p] !== undefined)
      .map((p) => ({
        name: t(`pages.skills.proficiency.${p}`),
        count: byProficiency[p] ?? 0,
      }));

    const byCategory: Record<string, number> = {};
    skills.forEach((s) => {
      const name = t(`pages.skills.category.${s.category}`, {
        defaultValue: s.category_display,
      });
      byCategory[name] = (byCategory[name] ?? 0) + 1;
    });
    const byCategoryData = Object.entries(byCategory).map(([name, count]) => ({
      name,
      count,
    }));

    return {
      total: skills.length,
      mastered,
      evolving,
      learning,
      byProficiencyData,
      byCategoryData,
    };
  }, [skills, t]);

  const weekdayLabel = (day?: { weekday: number; weekday_display: string } | null) =>
    day
      ? t(`pages.libraryDashboard.weekdays.${day.weekday}`, {
          defaultValue: day.weekday_display,
        })
      : '—';
  const timeOfDayLabel = (code: string, fallback: string) =>
    t(`pages.readings.form.timeOfDay${code.charAt(0).toUpperCase()}${code.slice(1)}`, {
      defaultValue: fallback,
    });

  const exportCSV = () => {
    if (!stats) return;
    const label = (key: string) => t(`pages.libraryDashboard.csv.${key}`);
    const rows: string[][] = [
      [label('metric'), label('value')],
      [label('totalBooks'), String(stats.total_books)],
      [label('totalAuthors'), String(stats.total_authors)],
      [label('totalPublishers'), String(stats.total_publishers)],
      [label('booksReading'), String(stats.books_reading)],
      [label('booksToRead'), String(stats.books_to_read)],
      [label('booksRead'), String(stats.books_read)],
      [label('averageRating'), String(stats.average_rating)],
      [label('totalPagesRead'), String(stats.total_pages_read)],
      [label('readingHours'), String(stats.total_reading_time_hours)],
      [label('speed'), String(stats.avg_speed_pages_per_hour)],
      [label('totalSessions'), String(stats.total_sessions)],
      [label('avgPagesPerSession'), String(stats.avg_pages_per_session)],
      [label('longestSession'), String(stats.longest_session_pages)],
      [label('currentStreak'), String(stats.reading_streak.current_streak)],
      [label('longestStreak'), String(stats.reading_streak.longest_streak)],
      [],
      [label('timeOfDay'), label('sessions'), label('pages')],
      ...(stats.reading_by_time_of_day || []).map((item) => [
        timeOfDayLabel(item.time_of_day, item.time_of_day_display),
        String(item.session_count),
        String(item.total_pages),
      ]),
      [],
      [label('genre'), label('bookCount')],
      ...translatedBooksByGenre.map((g) => [g.genre_display, String(g.count)]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('pages.libraryDashboard.csv.fileName')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unified learning streak: reading + courses
  const unifiedStreak = useMemo(() => {
    const readingStreak = stats?.reading_streak?.current_streak ?? 0;
    const longestStreak = stats?.reading_streak?.longest_streak ?? 0;
    const totalLearningHours =
      (stats?.total_reading_time_hours ?? 0) + courseStats.investedHours;
    return { readingStreak, longestStreak, totalLearningHours };
  }, [stats, courseStats]);

  const [openSection, setOpenSection] = useState<Section | null>('reading');
  const toggleSection = (key: Section) =>
    setOpenSection((prev) => (prev === key ? null : key));

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  const monthly = stats?.monthly_comparison;
  const pieProps = {
    colors: COLORS,
    lockChartType: 'pie' as const,
    height: CHART_HEIGHT,
  };
  const booksFormatter = (value: number | string) =>
    t('pages.libraryDashboard.booksCount', { count: Number(value) });
  const formatTimelineDate = (value: string, pattern: string) => {
    const [year, month, day] = value.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime())
      ? value
      : format(date, pattern, { locale: ptBR });
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.libraryDashboard.title')}
        icon={<Library />}
        actions={
          <div className="gap-sm flex items-center">
            {(unifiedStreak.readingStreak > 0 || unifiedStreak.longestStreak > 0) && (
              <StreakBadge
                days={unifiedStreak.readingStreak}
                label={t('pages.libraryDashboard.streakDays')}
                bestDays={
                  unifiedStreak.longestStreak > unifiedStreak.readingStreak
                    ? unifiedStreak.longestStreak
                    : undefined
                }
                bestLabel={t('pages.libraryDashboard.bestStreak')}
              />
            )}
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4" />
              {t('pages.libraryDashboard.exportCSV')}
            </Button>
          </div>
        }
      />

      {/* ── Leitura ─────────────────────────────────────────────────────── */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.sectionReading')}
        icon={<BookOpen className="h-4 w-4" />}
        open={openSection === 'reading'}
        onToggle={() => toggleSection('reading')}
      >
        <div className="space-y-md">
          <div className="gap-sm grid grid-cols-4 lg:grid-cols-8">
            <Kpi
              icon={<BookOpen />}
              label={t('pages.libraryDashboard.books')}
              value={stats?.total_books ?? 0}
            />
            <Kpi
              icon={<UserPen />}
              label={t('pages.libraryDashboard.authors')}
              value={stats?.total_authors ?? 0}
            />
            <Kpi
              icon={<Building2 />}
              label={t('pages.libraryDashboard.publishers')}
              value={stats?.total_publishers ?? 0}
            />
            <Kpi
              icon={<FileText />}
              label={t('pages.libraryDashboard.pagesRead')}
              value={(stats?.total_pages_read ?? 0).toLocaleString('pt-BR')}
            />
            <Kpi
              icon={<Star />}
              label={t('pages.libraryDashboard.averageRating')}
              value={(stats?.average_rating ?? 0).toFixed(1)}
            />
            <Kpi
              icon={<Clock />}
              label={t('pages.libraryDashboard.readingTime')}
              value={t('pages.courses.hoursValue', {
                hours: stats?.total_reading_time_hours ?? 0,
              })}
            />
            <Kpi
              icon={<Gauge />}
              label={t('pages.libraryDashboard.avgSpeed')}
              value={`${stats?.avg_speed_pages_per_hour ?? 0} ${t('pages.libraryDashboard.speedUnit')}`}
            />
            <Kpi
              icon={<Timer />}
              label={t('pages.libraryDashboard.totalSessions')}
              value={stats?.total_sessions ?? 0}
            />
          </div>

          <div className="gap-md grid lg:grid-cols-3">
            <ChartCard
              title={t('pages.libraryDashboard.readingStatus')}
              icon={<ListChecks />}
            >
              <div className="space-y-sm text-sm">
                {[
                  {
                    label: t('pages.libraryDashboard.reading'),
                    value: stats?.books_reading ?? 0,
                    className: 'text-info',
                  },
                  {
                    label: t('pages.libraryDashboard.toRead'),
                    value: stats?.books_to_read ?? 0,
                    className: 'text-warning',
                  },
                  {
                    label: t('pages.libraryDashboard.read'),
                    value: stats?.books_read ?? 0,
                    className: 'text-success',
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span>{row.label}</span>
                    <span className={cn('text-lg font-bold', row.className)}>
                      {row.value}
                    </span>
                  </div>
                ))}
                <div className="space-y-xs text-muted-foreground pt-sm border-t text-xs">
                  <div className="flex justify-between">
                    <span>{t('pages.libraryDashboard.avgPerSession')}</span>
                    <span className="text-foreground font-medium">
                      {stats?.avg_pages_per_session ?? 0}{' '}
                      {t('pages.libraryDashboard.pageAbbrev')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('pages.libraryDashboard.longestSession')}</span>
                    <span className="text-foreground font-medium">
                      {stats?.longest_session_pages ?? 0}{' '}
                      {t('pages.libraryDashboard.pageAbbrev')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('pages.libraryDashboard.mostProductiveDay')}</span>
                    <span className="text-foreground font-medium">
                      {weekdayLabel(stats?.most_productive_day)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="gap-xs flex items-center">
                      <Flame className="text-warning h-3.5 w-3.5" />
                      {t('pages.libraryDashboard.currentStreak')}
                    </span>
                    <span className="text-foreground font-medium">
                      {t('pages.intellectToday.days', {
                        count: stats?.reading_streak?.current_streak ?? 0,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </ChartCard>

            <ChartCard
              title={t('pages.libraryDashboard.monthlyComparison')}
              icon={<TrendingUp />}
            >
              {monthly ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs">
                      <th className="py-xs text-left font-medium" />
                      <th className="py-xs text-right font-medium">
                        {t('pages.libraryDashboard.currentMonth')}
                      </th>
                      <th className="py-xs text-right font-medium">
                        {t('pages.libraryDashboard.previousMonth')}
                      </th>
                      <th className="py-xs text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['pages_read', t('pages.libraryDashboard.monthlyPages')],
                        [
                          'reading_time_hours',
                          t('pages.libraryDashboard.monthlyHours'),
                        ],
                        ['books_completed', t('pages.libraryDashboard.monthlyBooks')],
                      ] as const
                    ).map(([key, label]) => {
                      const change = changeLabel(monthly.changes[key]);
                      return (
                        <tr key={key} className="border-t">
                          <td className="py-sm">{label}</td>
                          <td className="py-sm text-right font-semibold">
                            {monthly.current_month[key]}
                          </td>
                          <td className="text-muted-foreground py-sm text-right">
                            {monthly.previous_month[key]}
                          </td>
                          <td
                            className={cn(
                              'py-sm text-right text-xs font-medium',
                              change.className
                            )}
                          >
                            {change.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState title={t('pages.libraryDashboard.noReadings')} />
              )}
            </ChartCard>

            <ChartCard
              title={t('pages.libraryDashboard.readingTimeline')}
              icon={<BookMarked />}
            >
              <ChartContainer
                chartId="library-reading-timeline"
                data={stats?.reading_timeline || []}
                dataKey="pages_read"
                nameKey="date"
                formatter={(value) => value.toString()}
                colors={COLORS}
                emptyMessage={t('pages.libraryDashboard.noReadings')}
                lockChartType="line"
                height={CHART_HEIGHT}
                xAxisTickFormatter={(value: string) =>
                  formatTimelineDate(value, 'dd/MM')
                }
                tooltipLabelFormatter={(label) =>
                  formatTimelineDate(String(label), 'dd/MM/yyyy')
                }
                lines={[
                  {
                    dataKey: 'pages_read',
                    stroke: COLORS[0],
                    name: t('pages.libraryDashboard.pagesReadLabel'),
                  },
                ]}
              />
            </ChartCard>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Acervo ──────────────────────────────────────────────────────── */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.sectionCollection')}
        icon={<Library className="h-4 w-4" />}
        open={openSection === 'collection'}
        onToggle={() => toggleSection('collection')}
      >
        <div className="space-y-md">
          <div className="gap-md grid md:grid-cols-2 lg:grid-cols-4">
            <ChartCard
              title={t('pages.libraryDashboard.genreDistribution')}
              icon={<BookOpen />}
            >
              <ChartContainer
                chartId="library-books-genre"
                data={translatedBooksByGenre}
                dataKey="count"
                nameKey="genre_display"
                formatter={booksFormatter}
                emptyMessage={t('pages.libraryDashboard.noBooks')}
                {...pieProps}
              />
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.byLanguage')}
              icon={<FileText />}
            >
              <ChartContainer
                chartId="library-books-language"
                data={translatedBooksByLanguage}
                dataKey="count"
                nameKey="language_display"
                formatter={booksFormatter}
                emptyMessage={t('pages.libraryDashboard.noBooks')}
                {...pieProps}
              />
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.byMediaType')}
              icon={<BookMarked />}
            >
              <ChartContainer
                chartId="library-books-media"
                data={translatedBooksByMediaType}
                dataKey="count"
                nameKey="media_type_display"
                formatter={booksFormatter}
                emptyMessage={t('pages.libraryDashboard.noMediaDefined')}
                {...pieProps}
              />
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.byLiteraryType')}
              icon={<Library />}
            >
              <ChartContainer
                chartId="library-books-literary-type"
                data={translatedBooksByLiteraryType}
                dataKey="count"
                nameKey="literary_type_display"
                formatter={booksFormatter}
                emptyMessage={t('pages.libraryDashboard.noBooks')}
                {...pieProps}
              />
            </ChartCard>
          </div>

          <div className="gap-md grid lg:grid-cols-3">
            <ChartCard
              title={t('pages.libraryDashboard.ratingDistribution')}
              icon={<Star />}
            >
              <ChartContainer
                chartId="library-rating-distribution"
                data={translatedRatingDistribution}
                dataKey="count"
                nameKey="rating_range"
                formatter={booksFormatter}
                emptyMessage={t('pages.libraryDashboard.noRatings')}
                {...pieProps}
              />
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.topAuthors')}
              icon={<UserPen />}
            >
              {stats?.top_authors?.length ? (
                <PaginatedSlide
                  items={stats.top_authors}
                  pageSize={LIST_PAGE_SIZE}
                  pinNav={false}
                  className="space-y-sm"
                >
                  {(authors) =>
                    authors.map((author) => (
                      <div
                        key={author.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate">{author.name}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {booksFormatter(author.books_count)}
                        </span>
                      </div>
                    ))
                  }
                </PaginatedSlide>
              ) : (
                <EmptyState title={t('pages.libraryDashboard.noBooks')} />
              )}
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.topGenresByTime')}
              icon={<Trophy />}
            >
              {translatedTopGenresByTime.length ? (
                <div className="space-y-sm">
                  {translatedTopGenresByTime.map((item) => {
                    const max = translatedTopGenresByTime[0].total_time_hours || 1;
                    return (
                      <div key={item.genre} className="space-y-xs">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.genre_display}</span>
                          <span className="text-muted-foreground text-xs">
                            {t('pages.courses.hoursValue', {
                              hours: item.total_time_hours,
                            })}
                          </span>
                        </div>
                        <Progress
                          value={(item.total_time_hours / max) * 100}
                          className="h-1.5"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title={t('pages.libraryDashboard.noReadings')} />
              )}
            </ChartCard>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Aprendizado ─────────────────────────────────────────────────── */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.sectionLearning')}
        icon={<GraduationCap className="h-4 w-4" />}
        open={openSection === 'learning'}
        onToggle={() => toggleSection('learning')}
      >
        <div className="space-y-md">
          <div className="gap-sm grid grid-cols-4 lg:grid-cols-8">
            <Kpi
              icon={<GraduationCap />}
              label={t('pages.libraryDashboard.totalCourses')}
              value={courseStats.total}
            />
            <Kpi
              icon={<Timer />}
              label={t('pages.libraryDashboard.coursesInProgress')}
              value={courseStats.inProgress}
            />
            <Kpi
              icon={<CheckCircle2 />}
              label={t('pages.libraryDashboard.coursesCompleted')}
              value={courseStats.completed}
            />
            <Kpi
              icon={<Clock />}
              label={t('pages.libraryDashboard.coursesInvestedHours')}
              value={t('pages.courses.hoursValue', {
                hours: courseStats.investedHours.toFixed(1),
              })}
            />
            <Kpi
              icon={<TrendingUp />}
              label={t('pages.libraryDashboard.completionRate')}
              value={`${courseStats.completionRate.toFixed(0)}%`}
            />
            <Kpi
              icon={<Brain />}
              label={t('pages.libraryDashboard.totalSkills')}
              value={skillStats.total}
            />
            <Kpi
              icon={<Trophy />}
              label={t('pages.libraryDashboard.skillsMastered')}
              value={skillStats.mastered}
            />
            <Kpi
              icon={<TrendingUp />}
              label={t('pages.libraryDashboard.skillsEvolving')}
              value={skillStats.evolving}
            />
          </div>

          <div className="gap-md grid md:grid-cols-2 lg:grid-cols-4">
            <ChartCard
              title={t('pages.libraryDashboard.coursesByCategory')}
              icon={<GraduationCap />}
            >
              <ChartContainer
                chartId="intellect-courses-by-category"
                data={courseStats.byCategoryData}
                dataKey="count"
                nameKey="name"
                formatter={(v) =>
                  t('pages.libraryDashboard.courseCount', { count: Number(v) })
                }
                emptyMessage={t('pages.libraryDashboard.noCourses')}
                {...pieProps}
              />
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.coursesByPlatform')}
              icon={<GraduationCap />}
            >
              <ChartContainer
                chartId="intellect-courses-by-platform"
                data={courseStats.byPlatformData}
                dataKey="count"
                nameKey="name"
                formatter={(v) =>
                  t('pages.libraryDashboard.courseCount', { count: Number(v) })
                }
                emptyMessage={t('pages.libraryDashboard.noCourses')}
                {...pieProps}
              />
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.skillsByCategory')}
              icon={<Brain />}
            >
              <ChartContainer
                chartId="intellect-skills-by-category"
                data={skillStats.byCategoryData}
                dataKey="count"
                nameKey="name"
                formatter={(v) =>
                  t('pages.libraryDashboard.skillCount', { count: Number(v) })
                }
                emptyMessage={t('pages.libraryDashboard.noSkills')}
                {...pieProps}
              />
            </ChartCard>
            <ChartCard
              title={t('pages.libraryDashboard.skillsByProficiency')}
              icon={<Gauge />}
            >
              <ChartContainer
                chartId="intellect-skills-by-proficiency"
                data={skillStats.byProficiencyData}
                dataKey="count"
                nameKey="name"
                formatter={(v) =>
                  t('pages.libraryDashboard.skillCount', { count: Number(v) })
                }
                emptyMessage={t('pages.libraryDashboard.noSkills')}
                {...pieProps}
              />
            </ChartCard>
          </div>
        </div>
      </CollapsibleSection>
    </PageContainer>
  );
}
