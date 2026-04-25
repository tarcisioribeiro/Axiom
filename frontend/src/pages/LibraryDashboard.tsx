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
} from 'lucide-react';
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
      <div className="flex items-center justify-between">
        <PageHeader title={t('pages.libraryDashboard.title')} icon={<Library />} />
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          title="Exportar estatísticas em CSV"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* Block 1: Métricas + Status de Leitura (esquerda) | Meta de Leitura (direita) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Métricas Principais */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('pages.libraryDashboard.overview')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs">{t('pages.libraryDashboard.books')}</span>
                  </div>
                  <span className="text-2xl font-bold">{stats?.total_books || 0}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.authors')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold">
                    {stats?.total_authors || 0}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.publishers')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold">
                    {stats?.total_publishers || 0}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">
                      {t('pages.libraryDashboard.pagesRead')}
                    </span>
                  </div>
                  <span className="text-2xl font-bold">
                    {stats?.total_pages_read || 0}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('pages.libraryDashboard.readingStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-between gap-4">
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
                  <p className="text-xs text-muted-foreground">em andamento</p>
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
                  <p className="text-xs text-muted-foreground">na fila</p>
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
                    {stats?.books_read === 1 ? 'completo' : 'completos'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meta de Leitura */}
        <ReadingGoalCard
          onGoalChange={() =>
            queryClient.invalidateQueries({ queryKey: ['libraryDashboard'] })
          }
        />
      </div>

      {/* Block 2: Estatísticas Gerais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Estatísticas Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
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
                    {stats.most_read_author.books_count}{' '}
                    {stats.most_read_author.books_count === 1
                      ? 'livro lido'
                      : 'livros lidos'}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t('pages.libraryDashboard.noAuthor')}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground">
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
                    {stats.most_read_publisher.books_count}{' '}
                    {stats.most_read_publisher.books_count === 1
                      ? 'livro lido'
                      : 'livros lidos'}
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

      {/* Block 3: Sessões & Ritmo | Previsão de Conclusão */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Sessões & Ritmo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sessões & Ritmo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(
              [
                {
                  icon: <Zap className="h-4 w-4" />,
                  label: t('pages.libraryDashboard.avgSpeed'),
                  value:
                    stats?.avg_speed_pages_per_hour &&
                    stats.avg_speed_pages_per_hour > 0
                      ? `${stats.avg_speed_pages_per_hour} pág/h`
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
                  value: `${stats?.avg_pages_per_session || 0} págs`,
                },
                {
                  icon: <Zap className="h-4 w-4" />,
                  label: t('pages.libraryDashboard.longestSession'),
                  value: `${stats?.longest_session_pages || 0} págs`,
                },
                {
                  icon: <Flame className="h-4 w-4" />,
                  label: t('pages.libraryDashboard.currentStreak'),
                  value: `${stats?.reading_streak?.current_streak || 0} dias`,
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
                  <div className="flex items-center gap-2 text-muted-foreground">
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t('pages.libraryDashboard.completionEstimate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.current_reading_books ||
            stats.current_reading_books.length === 0 ? (
              <div className="flex h-full items-center justify-center py-8 text-sm text-muted-foreground">
                {t('pages.libraryDashboard.completionNoBook')}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.current_reading_books.map((book, i, arr) => (
                  <div key={book.title}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                        <p className="truncate text-sm font-medium" title={book.title}>
                          {book.title}
                        </p>
                      </div>
                      <div className="ml-6 flex flex-col gap-0.5">
                        {book.estimated_days_to_finish !== null ? (
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-lg font-bold">
                              ~{book.estimated_days_to_finish}{' '}
                              {book.estimated_days_to_finish === 1 ? 'dia' : 'dias'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              previsão:{' '}
                              {format(
                                addDays(new Date(), book.estimated_days_to_finish),
                                'dd/MM/yyyy',
                                { locale: ptBR }
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t('pages.libraryDashboard.completionNoPace')}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {book.pages_read} / {book.total_pages} págs
                          {book.total_pages > 0 && (
                            <>
                              {' '}
                              · {Math.round((book.pages_read / book.total_pages) * 100)}
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

      {/* Block 4: Comparativo Mensal (barras independentes) + Top 3 Gêneros */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                  <div className="grid grid-cols-3 gap-4">
                    {metrics.map(({ label, unit, curr, prev, change }) => {
                      const data = [
                        { name: currLabel, value: curr },
                        { name: prevLabel, value: prev },
                      ];
                      return (
                        <div key={label} className="flex flex-col items-center gap-2">
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
                                radius={[4, 4, 0, 0]}
                                maxBarSize={40}
                              >
                                <Cell fill={COLORS[0]} />
                                <Cell fill={COLORS[2]} fillOpacity={0.7} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          {change === null ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Minus className="h-3 w-3" />
                              <span>—</span>
                            </div>
                          ) : change > 0 ? (
                            <div className="flex items-center gap-1 text-xs text-success">
                              <TrendingUp className="h-3 w-3" />
                              <span>+{change}%</span>
                            </div>
                          ) : change < 0 ? (
                            <div className="flex items-center gap-1 text-xs text-destructive">
                              <TrendingDown className="h-3 w-3" />
                              <span>{change}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
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

      {/* Timeline e Top Autores */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
              formatter={(value) => `${value} ${value === 1 ? 'livro' : 'livros'}`}
              colors={COLORS}
              emptyMessage={t('pages.libraryDashboard.noBooks')}
              lockChartType="pie"
              height={350}
            />
          </CardContent>
        </Card>
      </div>

      {/* Ratings e Distribuições */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

        {/* Distribuições (Idioma, Mídia e Tipo Literário) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.libraryDashboard.distributions')}</CardTitle>
            <p className="text-sm">
              {t('pages.libraryDashboard.distributionsDescExtended')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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

      {/* Período do Dia + Leituras Recentes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quando você mais lê */}
        <Card>
          <CardHeader>
            <CardTitle>Quando você mais lê</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribuição das sessões por período do dia
            </p>
          </CardHeader>
          <CardContent>
            {!stats || (stats.reading_by_time_of_day || []).length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Registre o período nas suas sessões de leitura
              </div>
            ) : (
              <div className="space-y-3">
                {stats.reading_by_time_of_day.map((item) => {
                  const total = stats.reading_by_time_of_day.reduce(
                    (s, i) => s + i.session_count,
                    0
                  );
                  const pct = total > 0 ? (item.session_count / total) * 100 : 0;
                  return (
                    <div key={item.time_of_day} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {timeOfDayIcons[item.time_of_day]}
                          <span>{item.time_of_day_display}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {item.session_count}{' '}
                          {item.session_count === 1 ? 'sessão' : 'sessões'} ·{' '}
                          {item.total_pages} pág.
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
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
      </div>
    </PageContainer>
  );
}
