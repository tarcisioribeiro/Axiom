/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Library,
  BookOpen,
  User,
  Building2,
  FileText,
  BookMarked,
  BookCheck,
  Clock,
  Zap,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Flame,
  Download,
  Moon,
  Sun,
  Sunset,
  GraduationCap,
  Brain,
  CheckCircle2,
  Play,
  Pause,
  Award,
  PieChart,
  BarChart2,
  Activity,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer } from '@/components/charts';
import { EnhancedTooltip } from '@/components/charts/EnhancedTooltip';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReadingGoalCard } from '@/components/library/ReadingGoalCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { useChartColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { coursesService } from '@/services/courses-service';
import { libraryDashboardService } from '@/services/library-dashboard-service';
import { skillsService } from '@/services/skills-service';

export default function LibraryDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['libraryDashboard'],
    queryFn: () => libraryDashboardService.getStats(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesService.getAll({ page_size: 200 }),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const { data: skills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: () => skillsService.getAll({ page_size: 200 }),
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

  const translatedReadingStatus = useMemo(
    () =>
      (stats?.reading_status_distribution || []).map((item) => ({
        ...item,
        status_display: t('pages.books.readStatuses.' + item.status, {
          defaultValue: item.status_display,
        }),
      })),
    [stats?.reading_status_distribution, t]
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

  const translatedReadingByTimeOfDay = useMemo(
    () =>
      (stats?.reading_by_time_of_day || []).map((item) => {
        const key =
          'pages.readings.form.timeOfDay' +
          item.time_of_day.charAt(0).toUpperCase() +
          item.time_of_day.slice(1);
        return {
          ...item,
          time_of_day_display: t(key, { defaultValue: item.time_of_day_display }),
        };
      }),
    [stats?.reading_by_time_of_day, t]
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
      byCategory[c.category_display] = (byCategory[c.category_display] ?? 0) + 1;
    });
    const byCategoryData = Object.entries(byCategory).map(([name, count]) => ({
      name,
      count,
    }));

    const byPlatform: Record<string, number> = {};
    courses.forEach((c) => {
      byPlatform[c.platform_display] = (byPlatform[c.platform_display] ?? 0) + 1;
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
  }, [courses]);

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
    const proficiencyLabels: Record<string, string> = {
      beginner: 'Iniciante',
      basic: 'Básico',
      intermediate: 'Intermediário',
      advanced: 'Avançado',
      expert: 'Especialista',
    };
    const byProficiency: Record<string, number> = {};
    skills.forEach((s) => {
      byProficiency[s.proficiency] = (byProficiency[s.proficiency] ?? 0) + 1;
    });
    const byProficiencyData = proficiencyOrder
      .filter((p) => byProficiency[p] !== undefined)
      .map((p) => ({ name: proficiencyLabels[p] ?? p, count: byProficiency[p] ?? 0 }));

    const byCategory: Record<string, number> = {};
    skills.forEach((s) => {
      byCategory[s.category_display] = (byCategory[s.category_display] ?? 0) + 1;
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
  }, [skills]);

  const contentDistributionData = useMemo(() => {
    const booksRead = stats?.books_read || 0;
    const coursesCompleted = courseStats.completed;
    if (booksRead === 0 && coursesCompleted === 0) return [];
    return [
      { name: t('pages.libraryDashboard.booksReadLabel'), value: booksRead },
      {
        name: t('pages.libraryDashboard.coursesCompletedLabel'),
        value: coursesCompleted,
      },
    ];
  }, [stats?.books_read, courseStats.completed, t]);

  const exportCSV = () => {
    if (!stats) return;
    const rows: string[][] = [
      ['Métrica', 'Valor'],
      ['Total de Livros', String(stats.total_books)],
      ['Total de Autores', String(stats.total_authors)],
      ['Total de Editoras', String(stats.total_publishers)],
      ['Livros Lendo', String(stats.books_reading)],
      ['Livros Para Ler', String(stats.books_to_read)],
      ['Livros Lidos', String(stats.books_read)],
      ['Avaliação Média', String(stats.average_rating)],
      ['Total de Páginas Lidas', String(stats.total_pages_read)],
      ['Horas de Leitura', String(stats.total_reading_time_hours)],
      ['Velocidade (pág/hora)', String(stats.avg_speed_pages_per_hour)],
      ['Total de Sessões', String(stats.total_sessions)],
      ['Média de Páginas por Sessão', String(stats.avg_pages_per_session)],
      ['Maior Sessão (páginas)', String(stats.longest_session_pages)],
      ['Streak Atual (dias)', String(stats.reading_streak.current_streak)],
      ['Maior Streak (dias)', String(stats.reading_streak.longest_streak)],
      [],
      ['Período do Dia', 'Sessões', 'Páginas'],
      ...(stats.reading_by_time_of_day || []).map((item) => [
        item.time_of_day_display,
        String(item.session_count),
        String(item.total_pages),
      ]),
      [],
      ['Gênero', 'Quantidade de Livros'],
      ...stats.books_by_genre.map((g) => [g.genre_display, String(g.count)]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biblioteca_stats_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SECTION_STORAGE_KEY = 'axiom-library-dashboard-sections';
  const defaultSections: Record<string, boolean> = {
    overview: true,
    courses: true,
    skills: true,
    content: true,
    stats: true,
    sessions: true,
    monthly: true,
    genres: true,
    timeline: true,
    ratings: true,
    timeOfDay: true,
  };

  // Study timer state
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => {
          if (s <= 1) {
            setTimerRunning(false);
            setTimerMode((m) => (m === 'study' ? 'break' : 'study'));
            return timerMode === 'study' ? 5 * 60 : 25 * 60;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const timerDisplay = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;

  // Unified learning streak: reading + courses
  const unifiedStreak = useMemo(() => {
    const readingStreak = stats?.reading_streak?.current_streak ?? 0;
    const longestStreak = stats?.reading_streak?.longest_streak ?? 0;
    const totalLearningHours =
      (stats?.total_reading_time_hours ?? 0) + courseStats.investedHours;
    return { readingStreak, longestStreak, totalLearningHours };
  }, [stats, courseStats]);

  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(SECTION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        return { ...defaultSections, ...parsed };
      }
    } catch {
      // ignore
    }
    return defaultSections;
  });

  const toggle = (key: string) => {
    setSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  const timeOfDayIcons: Record<string, React.ReactNode> = {
    morning: <Sun className="h-4 w-4 text-yellow-500" />,
    afternoon: <Sunset className="h-4 w-4 text-orange-500" />,
    evening: <Moon className="h-4 w-4 text-blue-400" />,
    dawn: <Moon className="h-4 w-4 text-indigo-500" />,
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-md">
        <PageHeader title={t('pages.libraryDashboard.title')} icon={<Library />} />
        <div className="flex flex-wrap items-center gap-sm">
          {/* Unified Learning Streak */}
          {(unifiedStreak.readingStreak > 0 || unifiedStreak.longestStreak > 0) && (
            <div className="flex items-center gap-sm rounded-lg border border-orange-200 bg-orange-50 px-md py-sm dark:border-orange-900 dark:bg-orange-950/30">
              <Flame className="h-4 w-4 text-orange-500" />
              <div className="text-xs">
                <span className="font-bold text-orange-600 dark:text-orange-400">
                  {unifiedStreak.readingStreak}
                </span>
                <span className="ml-xs text-muted-foreground">
                  {t('pages.libraryDashboard.streakDays')}
                </span>
                {unifiedStreak.longestStreak > unifiedStreak.readingStreak && (
                  <span className="ml-sm text-muted-foreground/70">
                    ({t('pages.libraryDashboard.bestStreak')}:{' '}
                    {unifiedStreak.longestStreak})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Study Timer */}
          <button
            onClick={() => setTimerOpen((v) => !v)}
            className="flex items-center gap-sm rounded-md border px-3 py-sm text-sm text-muted-foreground hover:bg-muted"
          >
            <Timer className="h-4 w-4" />
            {timerRunning ? (
              <span className="font-mono text-primary">{timerDisplay}</span>
            ) : (
              t('pages.libraryDashboard.studyTimer')
            )}
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-sm rounded-md border px-3 py-sm text-sm text-muted-foreground hover:bg-muted"
            title={t('pages.libraryDashboard.exportCSVTitle')}
          >
            <Download className="h-4 w-4" />
            {t('pages.libraryDashboard.exportCSV')}
          </button>
        </div>
      </div>

      {/* Study Timer Panel */}
      {timerOpen && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-lg py-md shadow-sm">
          <div className="flex items-center gap-md">
            <div className="text-center">
              <p className="font-mono text-4xl font-bold tabular-nums text-foreground">
                {timerDisplay}
              </p>
              <p className="mt-xs text-xs text-muted-foreground">
                {timerMode === 'study'
                  ? t('pages.libraryDashboard.studyMode')
                  : t('pages.libraryDashboard.breakMode')}
              </p>
            </div>
            <div className="flex gap-sm">
              <button
                onClick={() => setTimerRunning((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {timerRunning ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(timerMode === 'study' ? 25 * 60 : 5 * 60);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-sm">
            <button
              onClick={() => {
                setTimerMode('study');
                setTimerRunning(false);
                setTimerSeconds(25 * 60);
              }}
              className={`rounded-md px-sm py-xs text-xs ${timerMode === 'study' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              25 min
            </button>
            <button
              onClick={() => {
                setTimerMode('break');
                setTimerRunning(false);
                setTimerSeconds(5 * 60);
              }}
              className={`rounded-md px-sm py-xs text-xs ${timerMode === 'break' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              5 min
            </button>
          </div>
        </div>
      )}

      {/* Block 1: Métricas + Status de Leitura (esquerda) | Meta de Leitura (direita) */}
      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <CollapsibleSection
          title={t('pages.libraryDashboard.overview')}
          icon={<BookOpen className="h-4 w-4" />}
          open={sections.overview}
          onToggle={() => toggle('overview')}
          className="lg:col-span-2"
        >
          <div className="flex flex-col gap-md">
            {/* Métricas Principais */}
            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="text-sm font-medium">
                  {t('pages.libraryDashboard.overview')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-md sm:grid-cols-5">
                  <div className="flex flex-col gap-xs">
                    <div className="flex items-center gap-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.libraryDashboard.books')}
                      </span>
                    </div>
                    <span className="text-2xl font-bold">
                      {stats?.total_books || 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <div className="flex items-center gap-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.libraryDashboard.authors')}
                      </span>
                    </div>
                    <span className="text-2xl font-bold">
                      {stats?.total_authors || 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <div className="flex items-center gap-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.libraryDashboard.publishers')}
                      </span>
                    </div>
                    <span className="text-2xl font-bold">
                      {stats?.total_publishers || 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <div className="flex items-center gap-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.libraryDashboard.pagesRead')}
                      </span>
                    </div>
                    <span className="text-2xl font-bold">
                      {stats?.total_pages_read || 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <div className="flex items-center gap-sm text-muted-foreground">
                      <Star className="h-4 w-4" />
                      <span className="text-xs">
                        {t('pages.libraryDashboard.averageRating')}
                      </span>
                    </div>
                    <span className="text-2xl font-bold">
                      {stats?.average_rating ? stats.average_rating.toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status de Leitura */}
            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="text-sm font-medium">
                  {t('pages.libraryDashboard.readingStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col justify-between gap-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookMarked className="h-5 w-5 text-info" />
                    <span className="text-sm font-medium">
                      {t('pages.libraryDashboard.reading')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-info">
                      {stats?.books_reading || 0}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.libraryDashboard.inProgressSubtitle')}
                    </p>
                  </div>
                </div>
                <div className="border-t" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-warning" />
                    <span className="text-sm font-medium">
                      {t('pages.libraryDashboard.toRead')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-warning">
                      {stats?.books_to_read || 0}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.libraryDashboard.inQueueSubtitle')}
                    </p>
                  </div>
                </div>
                <div className="border-t" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookCheck className="h-5 w-5 text-success" />
                    <span className="text-sm font-medium">
                      {t('pages.libraryDashboard.read')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-success">
                      {stats?.books_read || 0}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {t('pages.libraryDashboard.completedCount', {
                        count: stats?.books_read || 0,
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleSection>

        {/* Meta de Leitura — always visible, outside any collapsible section */}
        <ReadingGoalCard
          onGoalChange={() =>
            queryClient.invalidateQueries({ queryKey: ['libraryDashboard'] })
          }
        />
      </div>

      {/* Courses Section */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.coursesTitle')}
        icon={<GraduationCap className="h-4 w-4" />}
        open={sections.courses}
        onToggle={() => toggle('courses')}
      >
        <div className="flex flex-col gap-md">
          {/* Intelecto: Cursos — métricas principais */}
          <Card>
            <CardHeader className="pb-sm">
              <div className="flex items-center gap-sm">
                <GraduationCap className="h-4 w-4 text-category-intellect" />
                <CardTitle className="text-sm font-medium">
                  {t('pages.libraryDashboard.coursesTitle')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-md sm:grid-cols-6">
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.totalCourses')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold">{courseStats.total}</span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <Play className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.coursesInProgress')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-info">
                    {courseStats.inProgress}
                  </span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.coursesCompleted')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-success">
                    {courseStats.completed}
                  </span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.coursesInvestedHours')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold">
                    {courseStats.investedHours.toFixed(0)}h
                  </span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.completionRate')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-category-intellect">
                    {courseStats.completionRate.toFixed(0)}%
                  </span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.avgProgress')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold">
                    {courseStats.avgProgress.toFixed(0)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('pages.libraryDashboard.inProgressSubtitle')}
                  </span>
                </div>
              </div>

              {/* Barra de progresso visual por status */}
              {courseStats.total > 0 && (
                <div className="mt-md space-y-sm border-t pt-md">
                  {[
                    {
                      label: t('pages.libraryDashboard.courseStatusCompleted'),
                      count: courseStats.completed,
                      colorClass: 'bg-success',
                    },
                    {
                      label: t('pages.libraryDashboard.courseStatusInProgress'),
                      count: courseStats.inProgress,
                      colorClass: 'bg-info',
                    },
                    {
                      label: t('pages.libraryDashboard.courseStatusPaused'),
                      count: courseStats.paused,
                      colorClass: 'bg-warning',
                    },
                    {
                      label: t('pages.libraryDashboard.courseStatusNotStarted'),
                      count: courseStats.notStarted,
                      colorClass: 'bg-muted-foreground/40',
                    },
                  ]
                    .filter((s) => s.count > 0)
                    .map((s) => {
                      const pct = (s.count / courseStats.total) * 100;
                      return (
                        <div key={s.label} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-xs text-muted-foreground">
                            {s.label}
                          </span>
                          <div className="flex flex-1 items-center gap-sm">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${s.colorClass}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs font-medium">
                              {s.count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cursos: distribuição por categoria e plataforma */}
          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="flex items-center gap-sm text-sm">
                  <GraduationCap className="h-4 w-4" />
                  {t('pages.libraryDashboard.coursesByCategory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  chartId="intellect-courses-by-category"
                  data={courseStats.byCategoryData}
                  dataKey="count"
                  nameKey="name"
                  formatter={(value) =>
                    t('pages.libraryDashboard.courseCount', { count: Number(value) })
                  }
                  colors={COLORS}
                  emptyMessage={t('pages.libraryDashboard.noCourses')}
                  lockChartType="pie"
                  height={250}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="flex items-center gap-sm text-sm">
                  <Play className="h-4 w-4" />
                  {t('pages.libraryDashboard.coursesByPlatform')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  chartId="intellect-courses-by-platform"
                  data={courseStats.byPlatformData}
                  dataKey="count"
                  nameKey="name"
                  formatter={(value) =>
                    t('pages.libraryDashboard.courseCount', { count: Number(value) })
                  }
                  colors={COLORS}
                  emptyMessage={t('pages.libraryDashboard.noCourses')}
                  lockChartType="pie"
                  height={250}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </CollapsibleSection>

      {/* Skills Section */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.skillsTitle')}
        icon={<Brain className="h-4 w-4" />}
        open={sections.skills}
        onToggle={() => toggle('skills')}
      >
        <div className="flex flex-col gap-md">
          {/* Intelecto: Habilidades — métricas principais */}
          <Card>
            <CardHeader className="pb-sm">
              <div className="flex items-center gap-sm">
                <Brain className="h-4 w-4 text-category-intellect" />
                <CardTitle className="text-sm font-medium">
                  {t('pages.libraryDashboard.skillsTitle')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <Brain className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.totalSkills')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold">{skillStats.total}</span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <Award className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.skillsMastered')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-success">
                    {skillStats.mastered}
                  </span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.skillsEvolving')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-warning">
                    {skillStats.evolving}
                  </span>
                </div>
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-sm text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.skillsLearning')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-info">
                    {skillStats.learning}
                  </span>
                </div>
              </div>

              {/* Distribuição por proficiência */}
              {skillStats.byProficiencyData.length > 0 && (
                <div className="mt-md space-y-sm border-t pt-md">
                  <p className="mb-sm text-xs font-semibold text-muted-foreground">
                    {t('pages.libraryDashboard.proficiencyDistribution')}
                  </p>
                  {skillStats.byProficiencyData.map((item, i) => {
                    const max = Math.max(
                      ...skillStats.byProficiencyData.map((d) => d.count)
                    );
                    const pct = max > 0 ? (item.count / max) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-muted-foreground">
                          {item.name}
                        </span>
                        <div className="flex flex-1 items-center gap-sm">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-category-intellect/70 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-xs font-medium">
                            {item.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Habilidades: distribuição por categoria + status */}
          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="flex items-center gap-sm text-sm">
                  <Brain className="h-4 w-4" />
                  {t('pages.libraryDashboard.skillsByCategory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  chartId="intellect-skills-by-category"
                  data={skillStats.byCategoryData}
                  dataKey="count"
                  nameKey="name"
                  formatter={(value) =>
                    t('pages.libraryDashboard.skillCount', { count: Number(value) })
                  }
                  colors={COLORS}
                  emptyMessage={t('pages.libraryDashboard.noSkills')}
                  lockChartType="pie"
                  height={250}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-sm">
                <CardTitle className="flex items-center gap-sm text-sm">
                  <Award className="h-4 w-4" />
                  {t('pages.libraryDashboard.skillsByProficiency')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  chartId="intellect-skills-proficiency"
                  data={skillStats.byProficiencyData}
                  dataKey="count"
                  nameKey="name"
                  formatter={(value) =>
                    t('pages.libraryDashboard.skillCount', { count: Number(value) })
                  }
                  colors={COLORS}
                  emptyMessage={t('pages.libraryDashboard.noSkills')}
                  lockChartType="bar"
                  height={250}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </CollapsibleSection>

      {/* Content Distribution */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.contentDistribution')}
        icon={<PieChart className="h-4 w-4" />}
        open={sections.content}
        onToggle={() => toggle('content')}
      >
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.libraryDashboard.contentDistribution')}</CardTitle>
            <p className="text-sm">
              {t('pages.libraryDashboard.contentDistributionDesc')}
            </p>
          </CardHeader>
          <CardContent>
            <ChartContainer
              chartId="intellect-content-distribution"
              data={contentDistributionData}
              dataKey="value"
              nameKey="name"
              formatter={(value) => String(value)}
              colors={[COLORS[0], 'hsl(var(--category-intellect))']}
              emptyMessage={t('pages.libraryDashboard.noContentDistribution')}
              lockChartType="pie"
              height={250}
            />
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* General Stats */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.generalStats')}
        icon={<BarChart2 className="h-4 w-4" />}
        open={sections.stats}
        onToggle={() => toggle('stats')}
      >
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.generalStats')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div className="flex flex-col gap-xs">
                <div className="flex items-center gap-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">
                    {t('pages.libraryDashboard.readingTime')}
                  </span>
                </div>
                <span className="text-2xl font-bold">
                  {stats?.total_reading_time_hours || 0}h
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('pages.libraryDashboard.readingTimeTotal')}
                </span>
              </div>
              <div className="flex flex-col gap-xs">
                <div className="flex items-center gap-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs">
                    {t('pages.libraryDashboard.avgPerBook')}
                  </span>
                </div>
                <span className="text-2xl font-bold">
                  {stats?.average_pages_per_book?.toFixed(0) || 0}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('pages.libraryDashboard.pagesPerBook')}
                </span>
              </div>
              <div className="flex flex-col gap-xs">
                <div className="flex items-center gap-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="text-xs">
                    {t('pages.libraryDashboard.mostReadAuthor')}
                  </span>
                </div>
                {stats?.most_read_author ? (
                  <>
                    <span
                      className="truncate text-lg font-bold"
                      title={stats.most_read_author.name}
                    >
                      {stats.most_read_author.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('pages.libraryDashboard.booksReadCount', {
                        count: stats.most_read_author.books_count,
                      })}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t('pages.libraryDashboard.noAuthor')}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-xs">
                <div className="flex items-center gap-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="text-xs">
                    {t('pages.libraryDashboard.mostReadPublisher')}
                  </span>
                </div>
                {stats?.most_read_publisher ? (
                  <>
                    <span
                      className="truncate text-lg font-bold"
                      title={stats.most_read_publisher.name}
                    >
                      {stats.most_read_publisher.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('pages.libraryDashboard.booksReadCount', {
                        count: stats.most_read_publisher.books_count,
                      })}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t('pages.libraryDashboard.noAuthor')}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* Sessions & Pace */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.sessionsAndPace')}
        icon={<Activity className="h-4 w-4" />}
        open={sections.sessions}
        onToggle={() => toggle('sessions')}
      >
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          {/* Sessões & Ritmo */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.libraryDashboard.sessionsAndPace')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {/* Streak em destaque */}
              <div className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-sm dark:bg-orange-950/20">
                <div className="flex items-center gap-sm">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    {t('pages.libraryDashboard.currentStreak')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {stats?.reading_streak?.current_streak || 0}
                  </span>
                  <span className="ml-xs text-xs text-orange-500">
                    {t('pages.libraryDashboard.streakUnit', {
                      count: stats?.reading_streak?.current_streak || 0,
                    })}
                  </span>
                </div>
              </div>

              <div className="border-t" />

              {(
                [
                  {
                    icon: <Zap className="h-4 w-4" />,
                    label: t('pages.libraryDashboard.avgSpeed'),
                    value:
                      stats?.avg_speed_pages_per_hour &&
                      stats.avg_speed_pages_per_hour > 0
                        ? `${stats.avg_speed_pages_per_hour} ${t('pages.libraryDashboard.speedUnit')}`
                        : '—',
                  },
                  {
                    icon: <BookOpen className="h-4 w-4" />,
                    label: t('pages.libraryDashboard.totalSessions'),
                    value: stats?.total_sessions || 0,
                  },
                  {
                    icon: <FileText className="h-4 w-4" />,
                    label: t('pages.libraryDashboard.avgPerSession'),
                    value: `${stats?.avg_pages_per_session || 0} ${t('pages.libraryDashboard.pagesUnit')}`,
                  },
                  {
                    icon: <Zap className="h-4 w-4" />,
                    label: t('pages.libraryDashboard.longestSession'),
                    value: `${stats?.longest_session_pages || 0} ${t('pages.libraryDashboard.pagesUnit')}`,
                  },
                  {
                    icon: <CalendarClock className="h-4 w-4" />,
                    label: t('pages.libraryDashboard.mostProductiveDay'),
                    value: stats?.most_productive_day?.weekday_display || '—',
                  },
                ] as { icon: React.ReactNode; label: string; value: React.ReactNode }[]
              ).map(({ icon, label, value }, i, arr) => (
                <div key={label}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-sm text-muted-foreground">
                      {icon}
                      <span className="text-sm">{label}</span>
                    </div>
                    <span className="text-sm font-semibold">{value}</span>
                  </div>
                  {i < arr.length - 1 && <div className="mt-3 border-t" />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Previsão de Conclusão — todos os livros em leitura */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-sm font-medium">
                {t('pages.libraryDashboard.completionEstimate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.current_reading_books ||
              stats.current_reading_books.length === 0 ? (
                <div className="flex h-full items-center justify-center py-xl text-sm text-muted-foreground">
                  {t('pages.libraryDashboard.completionNoBook')}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.current_reading_books.map((book, i, arr) => (
                    <div key={book.title}>
                      <div className="flex flex-col gap-xs">
                        <div className="flex items-start gap-sm">
                          <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                          <p
                            className="truncate text-sm font-medium"
                            title={book.title}
                          >
                            {book.title}
                          </p>
                        </div>
                        <div className="ml-lg flex flex-col gap-0.5">
                          {book.estimated_days_to_finish !== null ? (
                            <div className="flex flex-wrap items-baseline gap-sm">
                              <span className="text-lg font-bold">
                                {t('pages.libraryDashboard.completionDaysLabel', {
                                  count: book.estimated_days_to_finish,
                                })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {t('pages.libraryDashboard.completionForecast', {
                                  date: format(
                                    addDays(new Date(), book.estimated_days_to_finish),
                                    'dd/MM/yyyy',
                                    { locale: ptBR }
                                  ),
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t('pages.libraryDashboard.completionNoPace')}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {book.pages_read} / {book.total_pages}{' '}
                            {t('pages.libraryDashboard.pagesUnit')}
                            {book.total_pages > 0 && (
                              <>
                                {' '}
                                ·{' '}
                                {Math.round((book.pages_read / book.total_pages) * 100)}
                                %
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      {i < arr.length - 1 && <div className="mt-3 border-t" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Monthly Comparison */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.monthlyComparison')}
        icon={<TrendingUp className="h-4 w-4" />}
        open={sections.monthly}
        onToggle={() => toggle('monthly')}
      >
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.monthlyComparison')}</CardTitle>
              <p className="text-sm">
                {t('pages.libraryDashboard.monthlyComparisonDesc')}
              </p>
            </CardHeader>
            <CardContent>
              {stats?.monthly_comparison &&
                (() => {
                  const mc = stats.monthly_comparison;
                  const currLabel = t('pages.libraryDashboard.currentMonth');
                  const prevLabel = t('pages.libraryDashboard.previousMonth');

                  const metrics = [
                    {
                      label: t('pages.libraryDashboard.monthlyPages'),
                      unit: t('pages.libraryDashboard.pages'),
                      curr: mc.current_month.pages_read,
                      prev: mc.previous_month.pages_read,
                      change: mc.changes.pages_read,
                    },
                    {
                      label: t('pages.libraryDashboard.monthlyHours'),
                      unit: t('pages.libraryDashboard.hours'),
                      curr: mc.current_month.reading_time_hours,
                      prev: mc.previous_month.reading_time_hours,
                      change: mc.changes.reading_time_hours,
                    },
                    {
                      label: t('pages.libraryDashboard.monthlyBooks'),
                      unit: '',
                      curr: mc.current_month.books_completed,
                      prev: mc.previous_month.books_completed,
                      change: mc.changes.books_completed,
                    },
                  ];

                  return (
                    <div className="grid grid-cols-3 gap-md">
                      {metrics.map(({ label, unit, curr, prev, change }) => {
                        const data = [
                          { name: currLabel, value: curr },
                          { name: prevLabel, value: prev },
                        ];
                        return (
                          <div
                            key={label}
                            className="flex flex-col items-center gap-sm"
                          >
                            <p className="text-xs font-semibold">{label}</p>
                            <ResponsiveContainer width="100%" height={130}>
                              <BarChart
                                data={data}
                                margin={{ top: 5, right: 4, bottom: 5, left: 4 }}
                              >
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis hide domain={[0, 'auto']} />
                                <Tooltip
                                  content={
                                    <EnhancedTooltip
                                      formatter={(value) =>
                                        `${String(value)}${unit ? ' ' + unit : ''}`
                                      }
                                    />
                                  }
                                />
                                <Bar
                                  dataKey="value"
                                  name={label}
                                  radius={[4, 4, 0, 0]}
                                  maxBarSize={40}
                                >
                                  <Cell fill={COLORS[0]} />
                                  <Cell fill={COLORS[2]} fillOpacity={0.7} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            {change === null ? (
                              <div className="flex items-center gap-xs text-xs text-muted-foreground">
                                <Minus className="h-3 w-3" />
                                <span>—</span>
                              </div>
                            ) : change > 0 ? (
                              <div className="flex items-center gap-xs text-xs text-success">
                                <TrendingUp className="h-3 w-3" />
                                <span>+{change}%</span>
                              </div>
                            ) : change < 0 ? (
                              <div className="flex items-center gap-xs text-xs text-destructive">
                                <TrendingDown className="h-3 w-3" />
                                <span>{change}%</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-xs text-xs text-muted-foreground">
                                <Minus className="h-3 w-3" />
                                <span>0%</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
            </CardContent>
          </Card>

          {/* Top 3 gêneros por tempo de leitura */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.topGenresByTime')}</CardTitle>
              <p className="text-sm">
                {t('pages.libraryDashboard.topGenresByTimeDesc')}
              </p>
            </CardHeader>
            <CardContent>
              {!translatedTopGenresByTime || translatedTopGenresByTime.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm">
                  {t('pages.libraryDashboard.noReadings')}
                </div>
              ) : (
                <div className="space-y-3">
                  {translatedTopGenresByTime.map((item, index) => {
                    const maxHours = translatedTopGenresByTime[0].total_time_hours;
                    const pct =
                      maxHours > 0
                        ? Math.round((item.total_time_hours / maxHours) * 100)
                        : 0;
                    return (
                      <div key={item.genre} className="space-y-xs">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-sm">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: COLORS[index] }}
                            >
                              {index + 1}
                            </span>
                            <span className="font-medium">{item.genre_display}</span>
                          </div>
                          <span className="text-xs">{item.total_time_hours}h</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[index] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Genre & Reading Status */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.genreDistribution')}
        icon={<BookOpen className="h-4 w-4" />}
        open={sections.genres}
        onToggle={() => toggle('genres')}
      >
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          {/* Livros por Gênero */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.genreDistribution')}</CardTitle>
              <p className="text-sm">
                {t('pages.libraryDashboard.genreDistributionDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="library-books-genre"
                data={translatedBooksByGenre}
                dataKey="count"
                nameKey="genre_display"
                formatter={(value) =>
                  t('pages.libraryDashboard.booksCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.libraryDashboard.noBooks')}
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>

          {/* Gráfico: Status de Leitura (Donut/Pie) */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.readingStatus')}</CardTitle>
              <p className="text-sm">{t('pages.libraryDashboard.readingStatusDesc')}</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="library-reading-status"
                data={translatedReadingStatus}
                dataKey="count"
                nameKey="status_display"
                formatter={(value) =>
                  t('pages.libraryDashboard.booksCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.libraryDashboard.noBooks')}
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Reading Timeline */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.readingTimeline')}
        icon={<TrendingUp className="h-4 w-4" />}
        open={sections.timeline}
        onToggle={() => toggle('timeline')}
      >
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.readingTimeline')}</CardTitle>
              <p className="text-sm">
                {t('pages.libraryDashboard.readingTimelineDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="library-reading-timeline"
                data={stats?.reading_timeline || []}
                dataKey="pages_read"
                nameKey="date"
                formatter={(value) => value.toString()}
                colors={COLORS}
                emptyMessage={t('pages.libraryDashboard.noReadings')}
                lockChartType="line"
                xAxisTickFormatter={(value: string) => {
                  try {
                    const [year, month, day] = value.split('-');
                    const date = new Date(Number(year), Number(month) - 1, Number(day));
                    return format(date, 'dd/MM/yy', { locale: ptBR });
                  } catch {
                    return value;
                  }
                }}
                tooltipLabelFormatter={(label: string | number) => {
                  try {
                    const [year, month, day] = String(label).split('-');
                    const date = new Date(Number(year), Number(month) - 1, Number(day));
                    return format(date, 'dd/MM/yyyy', { locale: ptBR });
                  } catch {
                    return String(label);
                  }
                }}
                dualYAxis={{
                  left: {
                    dataKey: 'pages_read',
                    label: t('pages.libraryDashboard.pages'),
                    color: COLORS[0],
                  },
                  right: {
                    dataKey: 'reading_time_hours',
                    label: t('pages.libraryDashboard.hours'),
                    color: COLORS[1],
                  },
                }}
                lines={[
                  {
                    dataKey: 'pages_read',
                    stroke: COLORS[0],
                    yAxisId: 'left',
                    name: t('pages.libraryDashboard.pagesReadLabel'),
                  },
                  {
                    dataKey: 'reading_time_hours',
                    stroke: COLORS[1],
                    yAxisId: 'right',
                    name: t('pages.libraryDashboard.timeLabel'),
                  },
                ]}
              />
            </CardContent>
          </Card>

          {/* Top 5 Autores */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.topAuthors')}</CardTitle>
              <p className="text-sm">{t('pages.libraryDashboard.topAuthorsDesc')}</p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="library-top-authors"
                data={stats?.top_authors || []}
                dataKey="books_count"
                nameKey="name"
                formatter={(value) =>
                  t('pages.libraryDashboard.booksCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.libraryDashboard.noBooks')}
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      {/* Ratings & Distributions */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.ratingDistribution')}
        icon={<Star className="h-4 w-4" />}
        open={sections.ratings}
        onToggle={() => toggle('ratings')}
      >
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.ratingDistribution')}</CardTitle>
              <p className="text-sm">
                {t('pages.libraryDashboard.ratingDistributionDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                chartId="library-rating-distribution"
                data={translatedRatingDistribution}
                dataKey="count"
                nameKey="rating_range"
                formatter={(value) =>
                  t('pages.libraryDashboard.booksCount', { count: Number(value) })
                }
                colors={COLORS}
                emptyMessage={t('pages.libraryDashboard.noRatings')}
                lockChartType="pie"
                height={350}
              />
            </CardContent>
          </Card>

          {/* Distribuições (Idioma, Mídia e Tipo Literário) */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.distributions')}</CardTitle>
              <p className="text-sm">
                {t('pages.libraryDashboard.distributionsDescExtended')}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
                <div>
                  <h4 className="mb-3 text-sm font-semibold">
                    {t('pages.libraryDashboard.byLanguage')}
                  </h4>
                  <ChartContainer
                    chartId="library-language-distribution"
                    data={translatedBooksByLanguage}
                    dataKey="count"
                    nameKey="language_display"
                    formatter={(value) =>
                      t('pages.libraryDashboard.booksCount', { count: Number(value) })
                    }
                    colors={COLORS}
                    emptyMessage={t('pages.libraryDashboard.noBooks')}
                    lockChartType="pie"
                    height={200}
                  />
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold">
                    {t('pages.libraryDashboard.byMediaType')}
                  </h4>
                  <ChartContainer
                    chartId="library-media-type-distribution"
                    data={translatedBooksByMediaType}
                    dataKey="count"
                    nameKey="media_type_display"
                    formatter={(value) =>
                      t('pages.libraryDashboard.booksCount', { count: Number(value) })
                    }
                    colors={COLORS.slice(3)}
                    emptyMessage={t('pages.libraryDashboard.noMediaDefined')}
                    lockChartType="pie"
                    height={200}
                  />
                </div>
                <div>
                  <h4 className="mb-3 text-sm font-semibold">
                    {t('pages.libraryDashboard.byLiteraryType')}
                  </h4>
                  <ChartContainer
                    chartId="library-literary-type-distribution"
                    data={translatedBooksByLiteraryType}
                    dataKey="count"
                    nameKey="literary_type_display"
                    formatter={(value) =>
                      t('pages.libraryDashboard.booksCount', { count: Number(value) })
                    }
                    colors={COLORS.slice(1)}
                    emptyMessage={t('pages.libraryDashboard.noBooks')}
                    lockChartType="pie"
                    height={200}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      {/* When You Read + Recent Readings */}
      <CollapsibleSection
        title={t('pages.libraryDashboard.whenYouRead')}
        icon={<Clock className="h-4 w-4" />}
        open={sections.timeOfDay}
        onToggle={() => toggle('timeOfDay')}
      >
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
          {/* Quando você mais lê */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.whenYouRead')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('pages.libraryDashboard.sessionDistribution')}
              </p>
            </CardHeader>
            <CardContent>
              {translatedReadingByTimeOfDay.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  {t('pages.libraryDashboard.noSessionPeriods')}
                </div>
              ) : (
                <div className="space-y-3">
                  {translatedReadingByTimeOfDay.map((item) => {
                    const total = translatedReadingByTimeOfDay.reduce(
                      (s, i) => s + i.session_count,
                      0
                    );
                    const pct = total > 0 ? (item.session_count / total) * 100 : 0;
                    const barColors: Record<string, string> = {
                      morning: 'hsl(var(--warning))',
                      afternoon: 'hsl(var(--accent))',
                      evening: 'hsl(var(--info))',
                      dawn: 'hsl(var(--primary))',
                    };
                    const barColor =
                      barColors[item.time_of_day] ?? 'hsl(var(--muted-foreground))';
                    return (
                      <div key={item.time_of_day} className="space-y-xs">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-sm">
                            {timeOfDayIcons[item.time_of_day]}
                            <span>{item.time_of_day_display}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {t('pages.libraryDashboard.sessionCount', {
                              count: item.session_count,
                            })}{' '}
                            · {item.total_pages}{' '}
                            {t('pages.libraryDashboard.pageAbbrev')}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leituras Recentes */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.libraryDashboard.recentReadings')}</CardTitle>
              <p className="text-sm">
                {t('pages.libraryDashboard.recentReadingsDesc')}
              </p>
            </CardHeader>
            <CardContent>
              {!stats || stats.recent_readings.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                  {t('pages.libraryDashboard.noReadings')}
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recent_readings.map((reading, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5" />
                        <div>
                          <p className="text-sm font-medium">{reading.book_title}</p>
                          <p className="text-xs">
                            {t('pages.libraryDashboard.pagesReadCount', {
                              count: reading.pages_read,
                            })}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs">
                        {format(new Date(reading.reading_date), "dd 'de' MMM", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>
    </PageContainer>
  );
}
