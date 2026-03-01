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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartContainer } from '@/components/charts';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/common/PageHeader';
import { ReadingGoalCard } from '@/components/library/ReadingGoalCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useChartColors } from '@/lib/chart-colors';
import {
  libraryDashboardService,
  type LibraryDashboardStats,
} from '@/services/library-dashboard-service';
import { getErrorMessage } from '@/utils/error-utils';

export default function LibraryDashboard() {
  const [stats, setStats] = useState<LibraryDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    void loadData();

    // Recarregar dados quando a aba/janela volta ao foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadData();
      }
    };

    const handleFocus = () => {
      void loadData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await libraryDashboardService.getStats();
      setStats(data);
    } catch (error: unknown) {
      toast({
        title: t('common.messages.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = useChartColors();

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <div className="space-y-6 px-4 py-8">
      <PageHeader title={t('pages.libraryDashboard.title')} icon={<Library />} />

      {/* Métricas Principais - Grid 4 colunas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <p className="mt-1 text-xs">
              {t('pages.libraryDashboard.average')}{' '}
              {stats?.average_rating?.toFixed(1) || 0} ★
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
        <ReadingGoalCard onGoalChange={loadData} />
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

        {/* Card: Distribuições (Idioma e Mídia) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.libraryDashboard.distributions')}</CardTitle>
            <p className="text-sm">{t('pages.libraryDashboard.distributionsDesc')}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
    </div>
  );
}
