/* eslint-disable max-lines */
import {
  Plus,
  CheckSquare,
  Edit,
  Trash2,
  BarChart2,
  Library,
  Download,
  FileText,
  Sheet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { DataTable, type Column } from '@/components/common/DataTable';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { HabitHeatmap } from '@/components/personal-planning/HabitHeatmap';
import { RoutineTaskForm } from '@/components/personal-planning/RoutineTaskForm';
import { RoutineTemplateModal } from '@/components/personal-planning/RoutineTemplateModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getIconByName } from '@/components/ui/icon-picker';
import { translate } from '@/config/constants';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useRoutineExport } from '@/hooks/use-routine-export';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type routineTaskSchema } from '@/lib/validations';
import { routineTasksService } from '@/services/routine-tasks-service';
import type {
  RoutineTask,
  RoutineTaskFormData as RoutineTaskApiFormData,
} from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type RoutineTaskFormData = z.infer<typeof routineTaskSchema>;

interface RoutineTasksProps {
  embedded?: boolean;
}

export default function RoutineTasks({ embedded = false }: RoutineTasksProps) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<RoutineTask | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heatmapTask, setHeatmapTask] = useState<RoutineTask | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();
  const { isExporting, exportPDF, exportExcel } = useRoutineExport();

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const tasksData = await routineTasksService.getAll();
      const sorted = [...tasksData].sort((a, b) => {
        if (!a.default_time && !b.default_time) return 0;
        if (!a.default_time) return 1;
        if (!b.default_time) return -1;
        return a.default_time.localeCompare(b.default_time);
      });
      setTasks(sorted);
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.loadError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedTask(undefined);
    setIsDialogOpen(true);
  };

  const handleEdit = (task: RoutineTask) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm({
      title: t('pages.routineTasks.deleteTitle'),
      description: t('pages.routineTasks.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await routineTasksService.delete(id);
      toast({
        title: t('pages.routineTasks.deleted'),
        description: t('pages.routineTasks.deletedDesc'),
      });
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.deleteError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (data: RoutineTaskFormData) => {
    try {
      setIsSubmitting(true);
      // Convert null to undefined for API compatibility
      const apiData = {
        ...data,
        weekday: data.weekday === null ? undefined : data.weekday,
        day_of_month: data.day_of_month === null ? undefined : data.day_of_month,
      };

      if (selectedTask) {
        await routineTasksService.update(
          selectedTask.id,
          apiData as RoutineTaskApiFormData
        );
        toast({
          title: t('pages.routineTasks.updated'),
          description: t('pages.routineTasks.updatedDesc'),
        });
      } else {
        await routineTasksService.create(apiData as RoutineTaskApiFormData);
        toast({
          title: t('pages.routineTasks.created'),
          description: t('pages.routineTasks.createdDesc'),
        });
      }
      setIsDialogOpen(false);
      void loadData();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.saveError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      if (format === 'pdf') {
        await exportPDF(tasks);
      } else {
        await exportExcel(tasks);
      }
    } catch {
      toast({
        title: t('pages.routineTasks.export.errorTitle'),
        description: t('pages.routineTasks.export.errorDesc'),
        variant: 'destructive',
      });
    }
  };

  const handleImported = async (createdIds: number[]) => {
    await loadData();
    const idSet = new Set(createdIds);
    setHighlightedIds(idSet);
    setTimeout(() => setHighlightedIds(new Set()), 5000);
  };

  // Retorna os índices dos dias ativos para a tarefa (0=Seg, 1=Ter, ... 6=Dom)
  const getActiveWeekdays = (task: RoutineTask): number[] => {
    if (task.periodicity === 'daily') return [0, 1, 2, 3, 4, 5, 6];
    if (task.periodicity === 'weekdays') return [0, 1, 2, 3, 4];
    if (task.periodicity === 'weekly' && task.weekday !== undefined)
      return [task.weekday];
    if (task.custom_weekdays && task.custom_weekdays.length > 0)
      return task.custom_weekdays;
    return [];
  };

  function WeekdayDots({ task }: { task: RoutineTask }): ReactNode {
    const activeDays = getActiveWeekdays(task);
    const labels = [0, 1, 2, 3, 4, 5, 6].map((i) =>
      t(`pages.planningDashboard.weekdayShort.${i}`)
    );
    return (
      <div className="flex gap-0.5">
        {labels.map((label, idx) => (
          <div
            key={idx}
            title={label}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold',
              activeDays.includes(idx)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {label.charAt(0)}
          </div>
        ))}
      </div>
    );
  }

  function CompletionBar({ rate }: { rate: number }): ReactNode {
    const barColor =
      rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-destructive';
    return (
      <div className="flex w-28 items-center gap-sm">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
        </div>
        <span className="w-8 text-right text-xs font-semibold tabular-nums">
          {rate.toFixed(0)}%
        </span>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      health: 'bg-category-health text-white dark:text-black border-transparent',
      intellect: 'bg-category-studies text-white dark:text-black border-transparent',
      spiritual: 'bg-category-spiritual text-white dark:text-black border-transparent',
      exercise: 'bg-category-exercise text-white dark:text-black border-transparent',
      nutrition: 'bg-category-nutrition text-white dark:text-black border-transparent',
      work: 'bg-category-work text-white dark:text-black border-transparent',
      social: 'bg-category-leisure text-white dark:text-black border-transparent',
      finance: 'bg-category-finance text-white dark:text-black border-transparent',
      household: 'bg-category-nutrition text-white dark:text-black border-transparent',
      personal_care: 'bg-category-health text-white dark:text-black border-transparent',
      other: 'bg-muted text-muted-foreground border-transparent',
    };
    return colors[category] || 'bg-muted text-muted-foreground border-transparent';
  };

  // Define table columns
  const columns: Column<RoutineTask>[] = [
    {
      key: 'name',
      label: t('pages.routineTasks.columns.name'),
      render: (task) => {
        const TaskIcon = getIconByName(task.icon);
        return (
          <div className="flex items-center gap-sm font-medium">
            {TaskIcon && (
              <TaskIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span>{task.name}</span>
          </div>
        );
      },
    },
    {
      key: 'category',
      label: t('pages.routineTasks.columns.category'),
      render: (task) => (
        <Badge className={getCategoryColor(task.category)}>
          {translate('taskCategories', task.category)}
        </Badge>
      ),
    },
    {
      key: 'periodicity',
      label: t('pages.routineTasks.columns.frequency'),
      render: (task) => (
        <div className="space-y-sm">
          <div className="text-sm">
            {t(`pages.routineTasks.form.periodicityOptions.${task.periodicity}`, {
              defaultValue: task.periodicity_display,
            })}
          </div>
          <WeekdayDots task={task} />
        </div>
      ),
    },
    {
      key: 'target',
      label: t('pages.routineTasks.columns.goal'),
      render: (task) => (
        <span className="text-sm">
          {task.target_quantity}{' '}
          {t(`pages.routineTasks.form.unitOptions.${task.unit}`, {
            defaultValue: task.unit,
          })}
        </span>
      ),
    },
    {
      key: 'completion_rate',
      label: t('pages.routineTasks.columns.completionRate'),
      render: (task) => <CompletionBar rate={task.completion_rate} />,
    },
    {
      key: 'priority',
      label: t('pages.routineTasks.columns.priority'),
      render: (task) => {
        type PriorityVariant = 'secondary' | 'info' | 'warning' | 'destructive';
        const priorityVariant: Record<string, PriorityVariant> = {
          low: 'secondary',
          medium: 'info',
          high: 'warning',
          critical: 'destructive',
        };
        return (
          <Badge variant={priorityVariant[task.priority] ?? 'secondary'}>
            {t(`pages.routineTasks.form.priorityOptions.${task.priority}`, {
              defaultValue: task.priority_display,
            })}
          </Badge>
        );
      },
    },
    {
      key: 'is_active',
      label: t('pages.routineTasks.columns.status'),
      render: (task) => (
        <Badge variant={task.is_active ? 'success' : 'secondary'}>
          {task.is_active
            ? t('pages.routineTasks.statusActive')
            : t('pages.routineTasks.statusInactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: t('common.table.actions'),
      align: 'center',
      render: (task) => (
        <div className="flex justify-center gap-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHeatmapTask(task)}
            aria-label={t('pages.routineTasks.viewHeatmap')}
            title={t('pages.routineTasks.viewConsistency')}
          >
            <BarChart2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(task)}
            aria-label={t('common.actions.edit')}
            title={t('common.actions.edit')}
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(task.id)}
            aria-label={t('common.actions.delete')}
            title={t('common.actions.delete')}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <LoadingState />;
  }

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => (
        <div className="space-y-lg">{children}</div>
      )
    : PageContainer;

  return (
    <Wrapper>
      <PageHeader title={t('pages.routineTasks.title')} icon={<CheckSquare />}>
        <div className="flex items-center gap-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting || tasks.length === 0}
              >
                <Download className="mr-sm h-4 w-4" />
                {isExporting
                  ? t('pages.routineTasks.export.exporting')
                  : t('pages.routineTasks.export.btn')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleExport('pdf')}>
                <FileText className="mr-sm h-4 w-4" />
                {t('pages.routineTasks.export.pdf')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleExport('excel')}>
                <Sheet className="mr-sm h-4 w-4" />
                {t('pages.routineTasks.export.excel')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplateModalOpen(true)}
          >
            <Library className="mr-sm h-4 w-4" />
            {t('pages.routineTasks.templates.importBtn')}
          </Button>
          <Button onClick={handleCreate} className="gap-sm">
            <Plus className="h-4 w-4" />
            {t('pages.routineTasks.newBtn')}
          </Button>
        </div>
      </PageHeader>

      <DataTable
        data={tasks}
        columns={columns}
        keyExtractor={(task) => task.id}
        isLoading={isLoading}
        emptyState={{
          icon: <CheckSquare className="h-12 w-12" />,
          title: t('pages.routineTasks.emptyState'),
          message: t('pages.routineTasks.emptyStateDesc'),
        }}
        rowClassName={(task) =>
          highlightedIds.has(task.id)
            ? 'animate-pulse bg-primary/10 transition-colors duration-1000'
            : ''
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-scrollbar max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTask
                ? t('pages.routineTasks.editTitle')
                : t('pages.routineTasks.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedTask
                ? t('pages.routineTasks.editDesc')
                : t('pages.routineTasks.newDesc')}
            </DialogDescription>
          </DialogHeader>
          <RoutineTaskForm
            task={selectedTask}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <RoutineTemplateModal
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onImported={(ids) => void handleImported(ids)}
      />

      {/* Heatmap Dialog */}
      <Dialog
        open={!!heatmapTask}
        onOpenChange={(open) => !open && setHeatmapTask(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-sm">
              <BarChart2 className="h-5 w-5" />
              {t('pages.routineTasks.heatmapConsistency')} — {heatmapTask?.name}
            </DialogTitle>
            <DialogDescription>{t('pages.routineTasks.heatmapDesc')}</DialogDescription>
          </DialogHeader>
          {heatmapTask && (
            <HabitHeatmap taskId={heatmapTask.id} taskName={heatmapTask.name} />
          )}
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
