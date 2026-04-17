import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer, EnhancedTooltip } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { ReadingGoalCard } from '@/components/library/ReadingGoalCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChartColors } from '@/lib/chart-colors';
import { STALE_TIMES } from '@/lib/query-client';
import { libraryDashboardService } from '@/services/library-dashboard-service';

export default function LibraryDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['libraryDashboard'],
    queryFn: () => libraryDashboardService.getStats(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

  const COLORS = useChartColors();

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <PageContainer>
      <PageHeader title={t('pages.libraryDashboard.title')} icon={<Library />} />

      {/* Métricas Principais - Grid 5 colunas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.books')}
            </CardTitle>
            <BookOpen className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_books || 0}</div>
            <p className="mt-1 text-xs">
              {stats?.total_books === 1 ? 'livro cadastrado' : 'livros cadastrados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.authors')}
            </CardTitle>
            <User className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_authors || 0}</div>
            <p className="mt-1 text-xs">
              {stats?.total_authors === 1 ? 'autor' : 'autores'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.publishers')}
            </CardTitle>
            <Building2 className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_publishers || 0}</div>
            <p className="mt-1 text-xs">
              {stats?.total_publishers === 1 ? 'editora' : 'editoras'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.pagesRead')}
            </CardTitle>
            <FileText className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_pages_read || 0}</div>
            <p className="mt-1 text-xs">páginas lidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.averageRating')}
            </CardTitle>
            <Star className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.average_rating ? stats.average_rating.toFixed(1) : '—'}
            </div>
            <p className="mt-1 text-xs">
              {t('pages.libraryDashboard.averageRatingDesc')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso de Leitura - Grid 4 colunas (status + meta anual) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.reading')}
            </CardTitle>
            <BookMarked className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">
              {stats?.books_reading || 0}
            </div>
            <p className="mt-1 text-xs">
              {stats?.books_reading === 1
                ? 'livro em andamento'
                : 'livros em andamento'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.toRead')}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {stats?.books_to_read || 0}
            </div>
            <p className="mt-1 text-xs">
              {stats?.books_to_read === 1 ? 'livro na fila' : 'livros na fila'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.read')}
            </CardTitle>
            <BookCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {stats?.books_read || 0}
            </div>
            <p className="mt-1 text-xs">
              {stats?.books_read === 1 ? 'livro completo' : 'livros completos'}
            </p>
          </CardContent>
        </Card>

        {/* Meta Anual */}
        <ReadingGoalCard
          onGoalChange={() =>
            queryClient.invalidateQueries({ queryKey: ['libraryDashboard'] })
          }
        />
      </div>

      {/* Row 3: Novas Estatísticas - Grid 4 colunas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tempo Total de Leitura */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.readingTime')}
            </CardTitle>
            <Clock className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_reading_time_hours || 0}h
            </div>
            <p className="mt-1 text-xs">
              {t('pages.libraryDashboard.readingTimeTotal')}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Média de Páginas por Livro */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.avgPerBook')}
            </CardTitle>
            <FileText className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.average_pages_per_book?.toFixed(0) || 0}
            </div>
            <p className="mt-1 text-xs">{t('pages.libraryDashboard.pagesPerBook')}</p>
          </CardContent>
        </Card>

        {/* Card 3: Autor Mais Lido */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.mostReadAuthor')}
            </CardTitle>
            <User className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            {stats?.most_read_author ? (
              <>
                <div
                  className="truncate text-lg font-bold"
                  title={stats.most_read_author.name}
                >
                  {stats.most_read_author.name}
                </div>
                <p className="mt-1 text-xs">
                  {stats.most_read_author.books_count}{' '}
                  {stats.most_read_author.books_count === 1
                    ? 'livro lido'
                    : 'livros lidos'}
                </p>
              </>
            ) : (
              <div className="text-sm">{t('pages.libraryDashboard.noAuthor')}</div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Editora Mais Lida */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.mostReadPublisher')}
            </CardTitle>
            <Building2 className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            {stats?.most_read_publisher ? (
              <>
                <div
                  className="truncate text-lg font-bold"
                  title={stats.most_read_publisher.name}
                >
                  {stats.most_read_publisher.name}
                </div>
                <p className="mt-1 text-xs">
                  {stats.most_read_publisher.books_count}{' '}
                  {stats.most_read_publisher.books_count === 1
                    ? 'livro lido'
                    : 'livros lidos'}
                </p>
              </>
            ) : (
              <div className="text-sm">{t('pages.libraryDashboard.noAuthor')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Velocidade de leitura + Previsão de conclusão */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Velocidade média */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.avgSpeed')}
            </CardTitle>
            <Zap className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            {stats?.avg_speed_pages_per_hour && stats.avg_speed_pages_per_hour > 0 ? (
              <>
                <div className="text-2xl font-bold">
                  {stats.avg_speed_pages_per_hour}
                </div>
                <p className="mt-1 text-xs">
                  {t('pages.libraryDashboard.avgSpeedDesc')}
                </p>
              </>
            ) : (
              <div className="mt-1 text-sm">
                {t('pages.libraryDashboard.avgSpeedNoData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previsão de conclusão */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.completionEstimate')}
            </CardTitle>
            <CalendarClock className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            {!stats?.current_reading_book ? (
              <div className="mt-1 text-sm">
                {t('pages.libraryDashboard.completionNoBook')}
              </div>
            ) : stats.current_reading_book.estimated_days_to_finish === null ? (
              <>
                <div
                  className="truncate text-sm font-medium"
                  title={stats.current_reading_book.title}
                >
                  {t('pages.libraryDashboard.currentBook', {
                    title: stats.current_reading_book.title,
                  })}
                </div>
                <p className="mt-1 text-xs">
                  {t('pages.libraryDashboard.completionNoPace')}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {t('pages.libraryDashboard.completionDays', {
                    days: stats.current_reading_book.estimated_days_to_finish,
                  })}
                </div>
                <p
                  className="mt-1 truncate text-xs"
                  title={stats.current_reading_book.title}
                >
                  {t('pages.libraryDashboard.currentBook', {
                    title: stats.current_reading_book.title,
                  })}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Estatísticas de sessão */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.totalSessions')}
            </CardTitle>
            <BookOpen className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_sessions || 0}</div>
            <p className="mt-1 text-xs">
              {t('pages.libraryDashboard.totalSessionsDesc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.avgPerSession')}
            </CardTitle>
            <FileText className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avg_pages_per_session || 0}
            </div>
            <p className="mt-1 text-xs">
              {t('pages.libraryDashboard.avgPerSessionDesc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.longestSession')}
            </CardTitle>
            <Zap className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.longest_session_pages || 0}
            </div>
            <p className="mt-1 text-xs">
              {t('pages.libraryDashboard.longestSessionDesc')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.currentStreak')}
            </CardTitle>
            <Flame className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.reading_streak?.current_streak || 0}
            </div>
            <p className="mt-1 text-xs">
              {t('pages.libraryDashboard.currentStreakDesc')}
              {(stats?.reading_streak?.longest_streak ?? 0) > 0 && (
                <>
                  {' '}
                  ·{' '}
                  {t('pages.libraryDashboard.longestStreak', {
                    days: stats!.reading_streak.longest_streak,
                  })}
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.mostProductiveDay')}
            </CardTitle>
            <CalendarClock className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            {stats?.most_productive_day ? (
              <>
                <div className="text-2xl font-bold">
                  {stats.most_productive_day.weekday_display}
                </div>
                <p className="mt-1 text-xs">
                  {t('pages.libraryDashboard.mostProductiveDayDesc', {
                    pages: stats.most_productive_day.total_pages,
                    sessions: stats.most_productive_day.session_count,
                  })}
                </p>
              </>
            ) : (
              <div className="mt-1 text-sm">
                {t('pages.libraryDashboard.noProductiveDay')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 6: Comparativo mensal + Top 3 gêneros por tempo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Comparativo mensal */}
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
                const chartData = [
                  {
                    name: t('pages.libraryDashboard.monthlyPages'),
                    [t('pages.libraryDashboard.currentMonth')]:
                      mc.current_month.pages_read,
                    [t('pages.libraryDashboard.previousMonth')]:
                      mc.previous_month.pages_read,
                  },
                  {
                    name: t('pages.libraryDashboard.monthlyHours'),
                    [t('pages.libraryDashboard.currentMonth')]:
                      mc.current_month.reading_time_hours,
                    [t('pages.libraryDashboard.previousMonth')]:
                      mc.previous_month.reading_time_hours,
                  },
                  {
                    name: t('pages.libraryDashboard.monthlyBooks'),
                    [t('pages.libraryDashboard.currentMonth')]:
                      mc.current_month.books_completed,
                    [t('pages.libraryDashboard.previousMonth')]:
                      mc.previous_month.books_completed,
                  },
                ];
                const currKey = t('pages.libraryDashboard.currentMonth');
                const prevKey = t('pages.libraryDashboard.previousMonth');
                return (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={chartData}
                        margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<EnhancedTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey={currKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={prevKey} fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {/* Variações percentuais */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {(
                        [
                          {
                            label: t('pages.libraryDashboard.monthlyPages'),
                            change: mc.changes.pages_read,
                          },
                          {
                            label: t('pages.libraryDashboard.monthlyHours'),
                            change: mc.changes.reading_time_hours,
                          },
                          {
                            label: t('pages.libraryDashboard.monthlyBooks'),
                            change: mc.changes.books_completed,
                          },
                        ] as { label: string; change: number | null }[]
                      ).map(({ label, change }) => (
                        <div key={label} className="rounded-md bg-muted/50 p-2">
                          <p className="text-xs font-medium">{label}</p>
                          {change === null ? (
                            <div className="flex items-center justify-center gap-1 text-xs">
                              <Minus className="h-3 w-3" />
                              <span>—</span>
                            </div>
                          ) : change > 0 ? (
                            <div className="flex items-center justify-center gap-1 text-xs text-success">
                              <TrendingUp className="h-3 w-3" />
                              <span>+{change}%</span>
                            </div>
                          ) : change < 0 ? (
                            <div className="flex items-center justify-center gap-1 text-xs text-destructive">
                              <TrendingDown className="h-3 w-3" />
                              <span>{change}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 text-xs">
                              <Minus className="h-3 w-3" />
                              <span>0%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
          </CardContent>
        </Card>

        {/* Top 3 gêneros por tempo de leitura */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.libraryDashboard.topGenresByTime')}</CardTitle>
            <p className="text-sm">{t('pages.libraryDashboard.topGenresByTimeDesc')}</p>
          </CardHeader>
          <CardContent>
            {!stats?.top_genres_by_time || stats.top_genres_by_time.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm">
                {t('pages.libraryDashboard.noReadings')}
              </div>
            ) : (
              <div className="space-y-3">
                {stats.top_genres_by_time.map((item, index) => {
                  const maxHours = stats.top_genres_by_time[0].total_time_hours;
                  const pct =
                    maxHours > 0
                      ? Math.round((item.total_time_hours / maxHours) * 100)
                      : 0;
                  return (
                    <div key={item.genre} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
              data={stats?.books_by_genre || []}
              dataKey="count"
              nameKey="genre_display"
              formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
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
              data={stats?.reading_status_distribution || []}
              dataKey="count"
              nameKey="status_display"
              formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
              colors={COLORS}
              emptyMessage={t('pages.libraryDashboard.noBooks')}
              lockChartType="pie"
              height={350}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Timeline e Top Autores */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico: Timeline de Leituras (Line) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.libraryDashboard.readingTimeline')}</CardTitle>
            <p className="text-sm">{t('pages.libraryDashboard.readingTimelineDesc')}</p>
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

        {/* Gráfico: Top 5 Autores (Horizontal Bar) */}
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
              formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
              colors={COLORS}
              emptyMessage={t('pages.libraryDashboard.noBooks')}
              lockChartType="pie"
              height={350}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 6: Ratings e Distribuições */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico: Distribuição de Ratings (Vertical Bar) */}
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
              data={stats?.rating_distribution || []}
              dataKey="count"
              nameKey="rating_range"
              formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
              colors={COLORS}
              emptyMessage={t('pages.libraryDashboard.noRatings')}
              lockChartType="pie"
              height={350}
            />
          </CardContent>
        </Card>

        {/* Card: Distribuições (Idioma, Mídia e Tipo Literário) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.libraryDashboard.distributions')}</CardTitle>
            <p className="text-sm">
              {t('pages.libraryDashboard.distributionsDescExtended')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Seção: Por Idioma */}
              <div>
                <h4 className="mb-3 text-sm font-semibold">
                  {t('pages.libraryDashboard.byLanguage')}
                </h4>
                <ChartContainer
                  chartId="library-language-distribution"
                  data={stats?.books_by_language || []}
                  dataKey="count"
                  nameKey="language_display"
                  formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
                  colors={COLORS}
                  emptyMessage={t('pages.libraryDashboard.noBooks')}
                  lockChartType="pie"
                  height={200}
                />
              </div>

              {/* Seção: Por Tipo de Mídia */}
              <div>
                <h4 className="mb-3 text-sm font-semibold">
                  {t('pages.libraryDashboard.byMediaType')}
                </h4>
                <ChartContainer
                  chartId="library-media-type-distribution"
                  data={stats?.books_by_media_type || []}
                  dataKey="count"
                  nameKey="media_type_display"
                  formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
                  colors={COLORS.slice(3)}
                  emptyMessage={t('pages.libraryDashboard.noMediaDefined')}
                  lockChartType="pie"
                  height={200}
                />
              </div>

              {/* Seção: Por Tipo Literário */}
              <div>
                <h4 className="mb-3 text-sm font-semibold">
                  {t('pages.libraryDashboard.byLiteraryType')}
                </h4>
                <ChartContainer
                  chartId="library-literary-type-distribution"
                  data={stats?.books_by_literary_type || []}
                  dataKey="count"
                  nameKey="literary_type_display"
                  formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
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

      {/* Leituras Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pages.libraryDashboard.recentReadings')}</CardTitle>
          <p className="text-sm">{t('pages.libraryDashboard.recentReadingsDesc')}</p>
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
                        {reading.pages_read}{' '}
                        {reading.pages_read === 1 ? 'página' : 'páginas'}
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
    </PageContainer>
  );
}
