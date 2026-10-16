/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Angry,
  BookOpen,
  CalendarDays,
  Edit,
  Frown,
  Meh,
  Plus,
  Search,
  Smile,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Can } from '@/components/common/Can';
import { DateRangeFilter } from '@/components/common/DateRangeFilter';
import { EmptyState } from '@/components/common/EmptyState';
import { FilterBar, FilterField } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { SearchInput } from '@/components/common/SearchInput';
import { DailyReflectionForm } from '@/components/personal-planning/DailyReflectionForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { dailyReflectionSchema } from '@/lib/validations';
import { dailyReflectionsService } from '@/services/daily-reflections-service';
import { MOOD_CHOICES, type DailyReflection } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type DailyReflectionFormData = z.infer<typeof dailyReflectionSchema>;

const MOOD_VARIANT: Record<
  string,
  'success' | 'info' | 'secondary' | 'warning' | 'destructive'
> = {
  excellent: 'success',
  good: 'info',
  neutral: 'secondary',
  bad: 'warning',
  terrible: 'destructive',
};

function getMoodIcon(mood: string) {
  const cls = 'h-4 w-4';
  switch (mood) {
    case 'excellent':
      return <SmilePlus className={cn(cls, 'text-success')} />;
    case 'good':
      return <Smile className={cn(cls, 'text-info')} />;
    case 'neutral':
      return <Meh className={cls} />;
    case 'bad':
      return <Frown className={cn(cls, 'text-warning')} />;
    case 'terrible':
      return <Angry className={cn(cls, 'text-destructive')} />;
    default:
      return null;
  }
}

function ReflectionMeta({ reflection }: { reflection: DailyReflection }) {
  const date = parseISO(reflection.date + 'T00:00:00');
  return (
    <div className="gap-sm flex items-center">
      {reflection.mood && (
        <Badge
          variant={MOOD_VARIANT[reflection.mood] ?? 'secondary'}
          className="gap-sm"
        >
          {getMoodIcon(reflection.mood)}
          {reflection.mood_display ?? reflection.mood}
        </Badge>
      )}
      <span className="text-muted-foreground text-xs">
        {format(date, 'EEEE', { locale: ptBR })}
      </span>
    </div>
  );
}

function ReflectionCard({
  reflection,
  onOpen,
  onEdit,
  onDelete,
}: {
  reflection: DailyReflection;
  onOpen: (r: DailyReflection) => void;
  onEdit: (r: DailyReflection) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const date = parseISO(reflection.date + 'T00:00:00');

  return (
    <Card
      role="button"
      tabIndex={0}
      className="focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
      // Cliques nos botões de ação não abrem o detalhe.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) onOpen(reflection);
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen(reflection);
        }
      }}
    >
      <CardContent className="p-md pt-md">
        <div className="gap-md flex items-start">
          {/* Data (dd/mm/aaaa) */}
          <span className="bg-muted/40 px-sm py-xs shrink-0 rounded-lg border text-sm font-bold tabular-nums">
            {format(date, 'dd/MM/yyyy')}
          </span>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1">
            <div className="mb-sm">
              <ReflectionMeta reflection={reflection} />
            </div>
            <p className="line-clamp-3 text-sm leading-relaxed whitespace-pre-wrap">
              {reflection.reflection}
            </p>
          </div>

          {/* Ações */}
          <div className="gap-xs flex shrink-0">
            <Can action="change">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(reflection)}
                aria-label={t('common.actions.edit')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </Can>
            <Can action="delete">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(reflection.id)}
                aria-label={t('common.actions.delete')}
              >
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            </Can>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_REFLECTIONS: DailyReflection[] = [];
const REFLECTIONS_PAGE_SIZE = 5;

export default function DailyReflections() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selected, setSelected] = useState<DailyReflection | undefined>();
  const [viewing, setViewing] = useState<DailyReflection | undefined>();
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const hasActiveFilters =
    moodFilter !== 'all' || !!startDate || !!endDate || !!searchTerm;
  const clearFilters = () => {
    setMoodFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchTerm('');
  };

  const { data: reflections = EMPTY_REFLECTIONS, isLoading } = useQuery({
    queryKey: ['daily-reflections'],
    queryFn: async () => {
      try {
        return await dailyReflectionsService.getAll();
      } catch (error: unknown) {
        toast({
          title: t('pages.dailyReflections.loadError', {
            reason: getErrorMessage(error),
          }),
          variant: 'destructive',
        });
        return EMPTY_REFLECTIONS;
      }
    },
  });

  const filtered = useMemo(() => {
    let result = [...reflections];
    if (moodFilter !== 'all') result = result.filter((r) => r.mood === moodFilter);
    if (startDate) result = result.filter((r) => new Date(r.date) >= startDate);
    if (endDate) result = result.filter((r) => new Date(r.date) <= endDate);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((r) => r.reflection.toLowerCase().includes(q));
    }
    return result;
  }, [reflections, moodFilter, startDate, endDate, searchTerm]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['daily-reflections'] });

  const handleCreate = () => {
    setSelected(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (reflection: DailyReflection) => {
    setSelected(reflection);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.dailyReflections.deleteTitle'),
      description: t('pages.dailyReflections.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await dailyReflectionsService.delete(id);
      toast({
        title: t('pages.dailyReflections.deleted'),
      });
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyReflections.deleteError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: DailyReflectionFormData) => {
    try {
      setIsSubmitting(true);
      if (selected) {
        await dailyReflectionsService.update(selected.id, data);
        toast({
          title: t('pages.dailyReflections.updated'),
        });
      } else {
        await dailyReflectionsService.create(data);
        toast({
          title: t('pages.dailyReflections.created'),
        });
      }
      setIsDialogOpen(false);
      void refresh();
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyReflections.saveError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.dailyReflections.title')}
        icon={<BookOpen />}
        action={{
          label: t('pages.dailyReflections.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      {/* Filtros */}
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        activeFilters={[
          ...(moodFilter !== 'all'
            ? [
                {
                  key: 'mood',
                  label: t(`common.mood.${moodFilter}`),
                  onRemove: () => setMoodFilter('all'),
                },
              ]
            : []),
          ...(startDate
            ? [
                {
                  key: 'startDate',
                  label: `${t('common.fields.from')}: ${formatDate(startDate)}`,
                  onRemove: () => setStartDate(undefined),
                },
              ]
            : []),
          ...(endDate
            ? [
                {
                  key: 'endDate',
                  label: `${t('common.fields.to')}: ${formatDate(endDate)}`,
                  onRemove: () => setEndDate(undefined),
                },
              ]
            : []),
        ]}
      >
        <FilterField label={t('common.filterLabels.search')} icon={Search}>
          <SearchInput
            placeholder={t('pages.dailyReflections.searchPlaceholder')}
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="w-52 sm:w-64"
          />
        </FilterField>
        <FilterField label={t('common.filterLabels.mood')} icon={Smile}>
          <Select value={moodFilter} onValueChange={setMoodFilter}>
            <SelectTrigger
              className="w-44"
              startIcon={<SmilePlus className="h-3.5 w-3.5" />}
            >
              <SelectValue placeholder={t('pages.dailyReflections.filters.allMoods')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.dailyReflections.filters.allMoods')}
              </SelectItem>
              {MOOD_CHOICES.map((choice) => (
                <SelectItem
                  key={choice.value}
                  value={choice.value}
                  icon={getMoodIcon(choice.value)}
                >
                  {t(`common.mood.${choice.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('common.filterLabels.period')} icon={CalendarDays}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </FilterField>
      </FilterBar>

      {/* Entradas no estilo diário */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          title={t('pages.dailyReflections.emptyStateTitle')}
        />
      ) : (
        <PaginatedSlide
          key={`${moodFilter}-${startDate?.getTime()}-${endDate?.getTime()}-${searchTerm}`}
          items={filtered}
          pageSize={REFLECTIONS_PAGE_SIZE}
          centerList
          className="space-y-sm"
        >
          {(pageReflections) =>
            pageReflections.map((r) => (
              <ReflectionCard
                key={r.id}
                reflection={r}
                onOpen={setViewing}
                onEdit={handleEdit}
                onDelete={(id) => void handleDelete(id)}
              />
            ))
          }
        </PaginatedSlide>
      )}

      {/* Detalhe da reflexão (texto completo) */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(undefined)}>
        <DialogContent className="max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle icon={BookOpen}>
                  {format(parseISO(viewing.date + 'T00:00:00'), 'dd/MM/yyyy')}
                </DialogTitle>
                <DialogDescription>
                  {t('pages.dailyReflections.title')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-md">
                <ReflectionMeta reflection={viewing} />
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {viewing.reflection}
                </p>
              </div>
              <DialogCloseFooter>
                <Can action="change">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const r = viewing;
                      setViewing(undefined);
                      handleEdit(r);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    {t('common.actions.edit')}
                  </Button>
                </Can>
                <Can action="delete">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const id = viewing.id;
                      setViewing(undefined);
                      void handleDelete(id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.actions.delete')}
                  </Button>
                </Can>
              </DialogCloseFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle mode={selected ? 'edit' : 'create'}>
              {selected
                ? t('pages.dailyReflections.editTitle')
                : t('pages.dailyReflections.newTitle')}
            </DialogTitle>
          </DialogHeader>
          <DailyReflectionForm
            reflection={selected}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
