/* eslint-disable max-lines */
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  BookOpen,
  Edit,
  Trash2,
  SmilePlus,
  Smile,
  Meh,
  Frown,
  Angry,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { DailyReflectionForm } from '@/components/personal-planning/DailyReflectionForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
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
import { cn, formatLocalDate } from '@/lib/utils';
import type { dailyReflectionSchema } from '@/lib/validations';
import { dailyReflectionsService } from '@/services/daily-reflections-service';
import { MOOD_CHOICES, type DailyReflection } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type DailyReflectionFormData = z.infer<typeof dailyReflectionSchema>;

const MOOD_COLOR: Record<string, string> = {
  excellent: 'bg-success',
  good: 'bg-category-studies',
  neutral: 'bg-secondary',
  bad: 'bg-warning',
  terrible: 'bg-destructive',
};

const MOOD_DOT: Record<string, string> = {
  excellent: 'bg-success',
  good: 'bg-info',
  neutral: 'bg-secondary',
  bad: 'bg-warning',
  terrible: 'bg-destructive',
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

function MoodTimeline({ reflections }: { reflections: DailyReflection[] }) {
  const today = new Date();
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = subDays(today, 20 - i);
    const key = formatLocalDate(d);
    const ref = reflections.find((r) => r.date === key);
    return { date: d, key, mood: ref?.mood };
  });

  return (
    <div className="mb-lg flex items-end gap-sm">
      {days.map(({ date, key, mood }) => (
        <div key={key} className="flex flex-col items-center gap-xs">
          <div
            title={`${format(date, 'dd/MM')}${mood ? ` — ${mood}` : ''}`}
            className={cn(
              'h-3 w-3 rounded-full transition-all',
              mood ? MOOD_DOT[mood] : 'bg-muted'
            )}
          />
          {date.getDay() === 0 && (
            <span className="text-[9px] text-muted-foreground">
              {format(date, 'dd/MM')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ReflectionCard({
  reflection,
  onEdit,
  onDelete,
}: {
  reflection: DailyReflection;
  onEdit: (r: DailyReflection) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = reflection.reflection.length > 240;
  const text =
    isLong && !expanded
      ? reflection.reflection.slice(0, 240) + '…'
      : reflection.reflection;

  const date = parseISO(reflection.date + 'T00:00:00');

  return (
    <Card className="group">
      <CardContent className="p-5">
        <div className="flex items-start gap-md">
          {/* Data estilo calendário */}
          <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border bg-muted/40 py-sm text-center">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              {format(date, 'MMM', { locale: ptBR })}
            </span>
            <span className="text-2xl font-bold leading-tight">
              {format(date, 'dd')}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {format(date, 'yyyy')}
            </span>
          </div>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1">
            <div className="mb-sm flex items-center gap-sm">
              {reflection.mood && (
                <Badge
                  className={cn(
                    'gap-sm',
                    MOOD_COLOR[reflection.mood] ?? 'bg-secondary'
                  )}
                >
                  {getMoodIcon(reflection.mood)}
                  {reflection.mood_display ?? reflection.mood}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {format(date, 'EEEE', { locale: ptBR })}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-xs flex items-center gap-xs text-xs text-primary hover:underline"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> {t('common.actions.seeLess')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> {t('common.actions.seeMore')}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Ações */}
          <div className="flex shrink-0 gap-xs opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(reflection)}
              aria-label={t('common.actions.edit')}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(reflection.id)}
              aria-label={t('common.actions.delete')}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DailyReflections() {
  const { t } = useTranslation();
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [filtered, setFiltered] = useState<DailyReflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selected, setSelected] = useState<DailyReflection | undefined>();
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reflections, moodFilter, startDate, endDate]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await dailyReflectionsService.getAll();
      setReflections(data);
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyReflections.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...reflections];
    if (moodFilter !== 'all') result = result.filter((r) => r.mood === moodFilter);
    if (startDate) result = result.filter((r) => new Date(r.date) >= startDate);
    if (endDate) result = result.filter((r) => new Date(r.date) <= endDate);
    setFiltered(result);
  };

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
        description: t('pages.dailyReflections.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyReflections.deleteError'),
        description: getErrorMessage(error),
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
          description: t('pages.dailyReflections.updatedDesc'),
        });
      } else {
        await dailyReflectionsService.create(data);
        toast({
          title: t('pages.dailyReflections.created'),
          description: t('pages.dailyReflections.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.dailyReflections.saveError'),
        description: getErrorMessage(error),
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

      {/* Timeline de humores dos últimos 21 dias */}
      {reflections.length > 0 && (
        <div className="rounded-lg border bg-card px-5 py-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('pages.dailyReflections.moodTimeline')}
          </p>
          <MoodTimeline reflections={reflections} />
          <div className="flex items-center gap-md text-xs text-muted-foreground">
            {MOOD_CHOICES.map((c) => (
              <span key={c.value} className="flex items-center gap-xs">
                <span className={cn('h-2.5 w-2.5 rounded-full', MOOD_DOT[c.value])} />
                {c.label}
              </span>
            ))}
            <span className="flex items-center gap-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              {t('pages.dailyReflections.noMood')}
            </span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-md">
        <div className="w-48">
          <Select value={moodFilter} onValueChange={setMoodFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.dailyReflections.filters.allMoods')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('pages.dailyReflections.filters.allMoods')}
              </SelectItem>
              {MOOD_CHOICES.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-xs block text-sm text-muted-foreground">
            {t('pages.dailyReflections.filters.startDate')}
          </label>
          <DatePicker
            value={startDate ? formatLocalDate(startDate) : ''}
            onChange={setStartDate}
            placeholder={t('pages.dailyReflections.filters.startDate')}
          />
        </div>
        <div>
          <label className="mb-xs block text-sm text-muted-foreground">
            {t('pages.dailyReflections.filters.endDate')}
          </label>
          <DatePicker
            value={endDate ? formatLocalDate(endDate) : ''}
            onChange={setEndDate}
            placeholder={t('pages.dailyReflections.filters.endDate')}
          />
        </div>
      </div>

      {/* Entradas no estilo diário */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          message={t('pages.dailyReflections.emptyState')}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReflectionCard
              key={r.id}
              reflection={r}
              onEdit={handleEdit}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected
                ? t('pages.dailyReflections.editTitle')
                : t('pages.dailyReflections.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? t('pages.dailyReflections.editDesc')
                : t('pages.dailyReflections.newDesc')}
            </DialogDescription>
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
