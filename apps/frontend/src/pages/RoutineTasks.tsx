/* eslint-disable max-lines */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  CheckSquare,
  CircleDot,
  Edit,
  Flag,
  Tag,
  Trash2,
  BarChart2,
  LayoutList,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { type z } from 'zod';

import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { LoadingState } from '@/components/common/LoadingState';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { HabitHeatmap } from '@/components/personal-planning/HabitHeatmap';
import {
  RoutineFocusBlocksSection,
  type RoutineFocusBlocksSectionHandle,
} from '@/components/personal-planning/RoutineFocusBlocksSection';
import { RoutineTaskForm } from '@/components/personal-planning/RoutineTaskForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogCloseFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getIconByName } from '@/components/ui/icon-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { translate } from '@/config/constants';
import { PRIORITY_ICONS, TASK_CATEGORY_ICONS, TASK_STATUS_ICONS } from '@/config/icons';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useTabRoute } from '@/hooks/use-tab-route';
import { useToast } from '@/hooks/use-toast';
import { getTaskCategoryColor } from '@/lib/helpers';
import { STALE_TIMES } from '@/lib/query-client';
import { cn } from '@/lib/utils';
import { type routineTaskSchema } from '@/lib/validations';
import { membersService } from '@/services/members-service';
import { routineTasksService } from '@/services/routine-tasks-service';
import { TASK_CATEGORIES, type RoutineTask } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

type RoutineTaskFormData = z.infer<typeof routineTaskSchema>;

const LIST_PAGE_SIZE = 5;
const ROUTINE_TABS = ['tasks', 'focus-blocks'] as const;

interface RoutineTasksProps {
  embedded?: boolean;
  /** Quando informado, o cabeçalho é renderizado nesse elemento (acima das abas do pai). */
  headerTarget?: HTMLElement | null;
}

function Wrapper({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="space-y-lg">{children}</div>
  ) : (
    <PageContainer>{children}</PageContainer>
  );
}

export default function RoutineTasks({
  embedded = false,
  headerTarget,
}: RoutineTasksProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<RoutineTask | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heatmapTask, setHeatmapTask] = useState<RoutineTask | null>(null);
  const [activeTab, setActiveTab] = useTabRoute(
    '/planning/tasks-goals/routine',
    ROUTINE_TABS,
    'tasks',
    'subtab'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const focusBlocksRef = useRef<RoutineFocusBlocksSectionHandle>(null);
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const { data: member } = useQuery({
    queryKey: ['current-member'],
    queryFn: () => membersService.getCurrentUserMember(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  const ownerId = member?.id ?? 0;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['routine-tasks'],
    queryFn: async () => {
      const tasksData = await routineTasksService.getAll();
      return [...tasksData].sort((a, b) => {
        if (!a.default_time && !b.default_time) return 0;
        if (!a.default_time) return 1;
        if (!b.default_time) return -1;
        return a.default_time.localeCompare(b.default_time);
      });
    },
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });

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
      });
      void queryClient.invalidateQueries({ queryKey: ['routine-tasks'] });
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.deleteError', { reason: getErrorMessage(error) }),
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
        await routineTasksService.update(selectedTask.id, apiData);
        toast({
          title: t('pages.routineTasks.updated'),
        });
      } else {
        await routineTasksService.create(apiData);
        toast({
          title: t('pages.routineTasks.created'),
        });
      }
      setIsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['routine-tasks'] });
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.saveError', { reason: getErrorMessage(error) }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
    const displayOrder = [6, 0, 1, 2, 3, 4, 5];
    return (
      <div className="flex gap-0.5">
        {displayOrder.map((dayIdx) => {
          const label = t(`pages.planningDashboard.weekdayShort.${dayIdx}`);
          return (
            <div
              key={dayIdx}
              title={label}
              className={cn(
                'text-2xs flex h-5 w-5 items-center justify-center rounded font-semibold',
                activeDays.includes(dayIdx)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {label.charAt(0)}
            </div>
          );
        })}
      </div>
    );
  }

  function CompletionBar({ rate }: { rate: number }): ReactNode {
    const barColor =
      rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-destructive';
    return (
      <div className="gap-sm flex w-28 items-center">
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className={cn('h-full rounded-full transition-[width]', barColor)}
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
        </div>
        <span className="w-8 text-right text-xs font-semibold tabular-nums">
          {rate.toFixed(0)}%
        </span>
      </div>
    );
  }

  const filteredTasks = tasks.filter((task) => {
    if (searchTerm && !task.name.toLowerCase().includes(searchTerm.toLowerCase()))
      return false;
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && task.is_active !== (statusFilter === 'active'))
      return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  const hasActiveFilters =
    searchTerm !== '' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  // Define table columns
  const columns: Column<RoutineTask>[] = [
    {
      key: 'name',
      label: t('pages.routineTasks.columns.name'),
      render: (task) => {
        const TaskIcon = getIconByName(task.icon);
        return (
          <div className="gap-sm flex items-center font-medium">
            {TaskIcon && (
              <TaskIcon className="text-muted-foreground h-4 w-4 shrink-0" />
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
        <Badge className={getTaskCategoryColor(task.category)}>
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
        const PriorityIcon = PRIORITY_ICONS[task.priority];
        return (
          <Badge
            variant={priorityVariant[task.priority] ?? 'secondary'}
            className="gap-xs"
          >
            {PriorityIcon && (
              <PriorityIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
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
      render: (task) => {
        const StatusIcon = TASK_STATUS_ICONS[task.is_active ? 'active' : 'inactive'];
        return (
          <Badge variant={task.is_active ? 'success' : 'secondary'} className="gap-xs">
            {StatusIcon && <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {task.is_active
              ? t('pages.routineTasks.statusActive')
              : t('pages.routineTasks.statusInactive')}
          </Badge>
        );
      },
    },
  ];

  const renderActions = (task: RoutineTask) => (
    <div className="gap-sm flex justify-center">
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
        <Trash2 className="text-destructive h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );

  if (isLoading) {
    return <LoadingState />;
  }

  const header = (
    <PageHeader title={t('pages.routineTasks.title')} icon={<CheckSquare />}>
      <Button
        onClick={
          activeTab === 'tasks' ? handleCreate : () => focusBlocksRef.current?.create()
        }
        className="gap-sm"
      >
        <Plus className="h-4 w-4" />
        {activeTab === 'tasks'
          ? t('pages.routineTasks.newBtn')
          : t('pages.routineTasks.focusBlocks.newBlock')}
      </Button>
    </PageHeader>
  );

  return (
    <Wrapper embedded={embedded}>
      {headerTarget ? createPortal(header, headerTarget) : header}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof ROUTINE_TABS)[number])}
      >
        <TabsList className="mb-lg w-full">
          <TabsTrigger value="tasks" className="gap-xs flex-1">
            <CheckSquare className="h-4 w-4" />
            {t('pages.routineTasks.tasksTab')}
          </TabsTrigger>
          <TabsTrigger value="focus-blocks" className="gap-xs flex-1">
            <LayoutList className="h-4 w-4" />
            {t('pages.routineTasks.focusBlocks.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-lg mt-0">
          <FilterBar
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            activeFilters={[
              ...(categoryFilter !== 'all'
                ? [
                    {
                      key: 'category',
                      label: `${t('pages.routineTasks.columns.category')}: ${translate('taskCategories', categoryFilter)}`,
                      onRemove: () => setCategoryFilter('all'),
                    },
                  ]
                : []),
              ...(statusFilter !== 'all'
                ? [
                    {
                      key: 'status',
                      label: `${t('pages.routineTasks.columns.status')}: ${
                        statusFilter === 'active'
                          ? t('pages.routineTasks.statusActive')
                          : t('pages.routineTasks.statusInactive')
                      }`,
                      onRemove: () => setStatusFilter('all'),
                    },
                  ]
                : []),
              ...(priorityFilter !== 'all'
                ? [
                    {
                      key: 'priority',
                      label: `${t('pages.routineTasks.columns.priority')}: ${t(`pages.routineTasks.form.priorityOptions.${priorityFilter}`)}`,
                      onRemove: () => setPriorityFilter('all'),
                    },
                  ]
                : []),
            ]}
          >
            <SearchInput
              placeholder={t('pages.routineTasks.searchPlaceholder')}
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="w-44"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-44"
                aria-label={t('pages.routineTasks.columns.category')}
                startIcon={<Tag className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.routineTasks.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.routineTasks.allCategories')}
                </SelectItem>
                {TASK_CATEGORIES.map(({ value }) => {
                  const CatIcon = TASK_CATEGORY_ICONS[value];
                  return (
                    <SelectItem
                      key={value}
                      value={value}
                      icon={CatIcon ? <CatIcon className="h-4 w-4" /> : undefined}
                    >
                      {translate('taskCategories', value)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-36"
                aria-label={t('pages.routineTasks.allStatus')}
                startIcon={<CircleDot className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.routineTasks.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.routineTasks.allStatus')}</SelectItem>
                <SelectItem
                  value="active"
                  icon={<TASK_STATUS_ICONS.active className="h-4 w-4" />}
                >
                  {t('pages.routineTasks.statusActive')}
                </SelectItem>
                <SelectItem
                  value="inactive"
                  icon={<TASK_STATUS_ICONS.inactive className="h-4 w-4" />}
                >
                  {t('pages.routineTasks.statusInactive')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger
                className="w-36"
                aria-label={t('pages.routineTasks.allPriorities')}
                startIcon={<Flag className="h-3.5 w-3.5" />}
              >
                <SelectValue placeholder={t('pages.routineTasks.allPriorities')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.routineTasks.allPriorities')}
                </SelectItem>
                <SelectItem
                  value="low"
                  icon={<PRIORITY_ICONS.low className="h-4 w-4" />}
                >
                  {t('pages.routineTasks.form.priorityOptions.low')}
                </SelectItem>
                <SelectItem
                  value="medium"
                  icon={<PRIORITY_ICONS.medium className="h-4 w-4" />}
                >
                  {t('pages.routineTasks.form.priorityOptions.medium')}
                </SelectItem>
                <SelectItem
                  value="high"
                  icon={<PRIORITY_ICONS.high className="h-4 w-4" />}
                >
                  {t('pages.routineTasks.form.priorityOptions.high')}
                </SelectItem>
                <SelectItem
                  value="critical"
                  icon={<PRIORITY_ICONS.critical className="h-4 w-4" />}
                >
                  {t('pages.routineTasks.form.priorityOptions.critical')}
                </SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <DataTable
            data={filteredTasks}
            pageSize={LIST_PAGE_SIZE}
            centerList
            density="compact"
            columns={columns}
            actions={renderActions}
            keyExtractor={(task) => task.id}
            isLoading={isLoading}
            emptyState={{
              icon: <CheckSquare className="h-12 w-12" />,
              title: t('pages.routineTasks.emptyState'),
            }}
          />
        </TabsContent>

        <TabsContent value="focus-blocks" className="mt-0">
          <RoutineFocusBlocksSection
            ref={focusBlocksRef}
            routineTasks={tasks}
            ownerId={ownerId}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[98vh] max-w-5xl">
          <DialogHeader sticky>
            <DialogTitle mode={selectedTask ? 'edit' : 'create'}>
              {selectedTask
                ? t('pages.routineTasks.editTitle')
                : t('pages.routineTasks.newTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedTask
                  ? t('pages.routineTasks.editDesc')
                  : t('pages.routineTasks.newDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <RoutineTaskForm
            task={selectedTask}
            onSubmit={handleSubmit}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Heatmap Dialog */}
      <Dialog
        open={!!heatmapTask}
        onOpenChange={(open) => !open && setHeatmapTask(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="gap-sm flex items-center">
              <BarChart2 className="h-5 w-5" />
              {t('pages.routineTasks.heatmapConsistency')} — {heatmapTask?.name}
            </DialogTitle>
            <DialogDescription>{t('pages.routineTasks.heatmapDesc')}</DialogDescription>
          </DialogHeader>
          {heatmapTask && (
            <HabitHeatmap taskId={heatmapTask.id} taskName={heatmapTask.name} />
          )}
          <DialogCloseFooter />
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
