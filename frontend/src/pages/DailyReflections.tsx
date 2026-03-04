import { format } from 'date-fns';
import { Plus, StickyNote, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { DataTable, type Column } from '@/components/common/DataTable';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { DailyReflectionForm } from '@/components/personal-planning/DailyReflectionForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatLocalDate } from '@/lib/utils';
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
  }, []);

  useEffect(() => {
    applyFilters();
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
    if (moodFilter !== 'all') {
      result = result.filter((r) => r.mood === moodFilter);
    }
    if (startDate) {
      result = result.filter((r) => new Date(r.date) >= startDate);
    }
    if (endDate) {
      result = result.filter((r) => new Date(r.date) <= endDate);
    }
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

  const columns: Column<DailyReflection>[] = [
    {
      key: 'date',
      label: t('pages.dailyReflections.columns.date'),
      render: (r) => (
        <span className="font-medium">
          {format(new Date(r.date + 'T00:00:00'), 'dd/MM/yyyy')}
        </span>
      ),
    },
    {
      key: 'mood',
      label: t('pages.dailyReflections.columns.mood'),
      render: (r) =>
        r.mood ? (
          <Badge className={MOOD_COLOR[r.mood] ?? 'bg-secondary'}>
            {r.mood_display ?? r.mood}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'reflection',
      label: t('pages.dailyReflections.columns.reflection'),
      render: (r) => <p className="max-w-md truncate text-sm">{r.reflection}</p>,
    },
    {
      key: 'actions',
      label: t('pages.dailyReflections.columns.actions'),
      align: 'center',
      render: (r) => (
        <div className="flex justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(r)}
            aria-label={t('common.actions.edit')}
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete(r.id)}
            aria-label={t('common.actions.delete')}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('pages.dailyReflections.title')}
        icon={<StickyNote />}
        action={{
          label: t('pages.dailyReflections.newBtn'),
          icon: <Plus className="h-4 w-4" />,
          onClick: handleCreate,
        }}
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
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
          <label className="mb-1 block text-sm text-muted-foreground">
            {t('pages.dailyReflections.filters.startDate')}
          </label>
          <DatePicker
            value={startDate ? formatLocalDate(startDate) : ''}
            onChange={setStartDate}
            placeholder={t('pages.dailyReflections.filters.startDate')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            {t('pages.dailyReflections.filters.endDate')}
          </label>
          <DatePicker
            value={endDate ? formatLocalDate(endDate) : ''}
            onChange={setEndDate}
            placeholder={t('pages.dailyReflections.filters.endDate')}
          />
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyState={{
          icon: <StickyNote className="h-12 w-12" />,
          message: t('pages.dailyReflections.emptyState'),
        }}
      />

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
