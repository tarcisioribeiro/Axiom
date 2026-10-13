import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SearchInput } from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { translate } from '@/config/constants';
import { TASK_CATEGORY_ICONS } from '@/config/icons';
import { getTaskCategoryColor } from '@/lib/helpers';
import { appearsOnDay, getTimesForTask } from '@/lib/routine-export';
import { cn } from '@/lib/utils';
import type { FocusBlock, RoutineTask } from '@/types';

interface FocusBlockTasksEditorProps {
  block: FocusBlock;
  /** Todos os blocos — uma tarefa (ou ocorrência) só pode estar em um. */
  allBlocks: FocusBlock[];
  routineTasks: RoutineTask[];
  /** Sem `onAddTask`/`onRemoveTask` a lista é só leitura: sem busca, remover nem adicionar. */
  onAddTask?: (routineTaskId: number, occurrenceIndex: number | null) => void;
  onRemoveTask?: (focusBlockTaskId: number) => void;
}

export function FocusBlockTasksEditor({
  block,
  allBlocks,
  routineTasks,
  onAddTask,
  onRemoveTask,
}: FocusBlockTasksEditorProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const readOnly = !onAddTask || !onRemoveTask;

  const takenByTask = new Map<number, Set<number | null>>();
  for (const bt of block.block_tasks) {
    const set = takenByTask.get(bt.routine_task) ?? new Set<number | null>();
    set.add(bt.occurrence_index ?? null);
    takenByTask.set(bt.routine_task, set);
  }
  const takenElsewhere = new Map<number, Set<number | null>>();
  for (const other of allBlocks) {
    if (other.id === block.id) continue;
    for (const bt of other.block_tasks) {
      const set = takenElsewhere.get(bt.routine_task) ?? new Set<number | null>();
      set.add(bt.occurrence_index ?? null);
      takenElsewhere.set(bt.routine_task, set);
    }
  }

  const taskById = new Map(routineTasks.map((task) => [task.id, task]));
  const startTime = (bt: FocusBlock['block_tasks'][number]) => {
    const task = taskById.get(bt.routine_task);
    return (task && getTimesForTask(task)[bt.occurrence_index ?? 0]) ?? null;
  };
  const timeLabel = (bt: FocusBlock['block_tasks'][number]) => {
    const task = taskById.get(bt.routine_task);
    if (!task) return null;
    const times = getTimesForTask(task);
    // Tarefa inteira com várias ocorrências: lista todos os horários.
    const starts = (bt.occurrence_index == null ? times : [times[bt.occurrence_index]])
      .filter((time): time is string => !!time)
      .map((time) => time.substring(0, 5));
    const end =
      task.daily_occurrences === 1 && task.closing_time
        ? task.closing_time.substring(0, 5)
        : null;
    return [starts.join(' · '), end].filter(Boolean).join(' — ') || null;
  };
  // Tarefas sem horário vão para o fim.
  const sortedBlockTasks = [...block.block_tasks].sort((a, b) =>
    (startTime(a) ?? '99:99').localeCompare(startTime(b) ?? '99:99')
  );
  const term = searchTerm.trim().toLowerCase();
  const visibleBlockTasks = term
    ? sortedBlockTasks.filter((bt) => {
        const description = taskById.get(bt.routine_task)?.description ?? '';
        return (
          bt.routine_task_name.toLowerCase().includes(term) ||
          description.toLowerCase().includes(term)
        );
      })
    : sortedBlockTasks;

  const addableTasks = routineTasks
    .filter((task) => block.weekdays.some((w) => appearsOnDay(task, w)))
    .map((task) => {
      const taken = takenByTask.get(task.id) ?? new Set<number | null>();
      const elsewhere = takenElsewhere.get(task.id);
      // Tarefa inteira em outro bloco ocupa todas as ocorrências.
      if (elsewhere?.has(null)) return null;
      if (task.daily_occurrences <= 1) {
        return taken.has(null) || elsewhere ? null : { task, occurrences: null };
      }
      const times = getTimesForTask(task);
      const options = Array.from(
        { length: task.daily_occurrences },
        (_, i) => i
      ).filter((i) => !taken.has(i) && !elsewhere?.has(i));
      const wholeAvailable = !taken.has(null) && !elsewhere;
      if (options.length === 0 && !wholeAvailable) return null;
      return { task, occurrences: { options, times, wholeAvailable } };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return (
    <div>
      {block.block_tasks.length === 0 ? (
        <p className="text-muted-foreground py-xs text-xs">
          {t('pages.routineTasks.focusBlocks.noTasks')}
        </p>
      ) : (
        <div className="space-y-xs">
          {!readOnly && (
            <SearchInput
              value={searchTerm}
              onValueChange={setSearchTerm}
              placeholder={t('pages.routineTasks.searchPlaceholder')}
              className="w-full"
            />
          )}
          {visibleBlockTasks.length === 0 && (
            <p className="text-muted-foreground py-xs text-xs">
              {t('common.noResults')}
            </p>
          )}
          {visibleBlockTasks.map((bt) => {
            const category = taskById.get(bt.routine_task)?.category;
            const CategoryIcon = category ? TASK_CATEGORY_ICONS[category] : undefined;
            return (
              <div
                key={bt.id}
                className={cn(
                  'group gap-sm px-sm py-xs flex items-center rounded-md transition-colors',
                  !readOnly && 'hover:bg-muted/40'
                )}
              >
                {CategoryIcon && (
                  <CategoryIcon
                    className="text-muted-foreground h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                {category && (
                  <Badge className={cn(getTaskCategoryColor(category), 'shrink-0')}>
                    {translate('taskCategories', category)}
                  </Badge>
                )}
                <span className="flex-1 text-sm">{bt.routine_task_name}</span>
                {timeLabel(bt) && (
                  <span className="text-muted-foreground/70 text-xs tabular-nums">
                    {timeLabel(bt)}
                  </span>
                )}
                {bt.occurrence_index !== null && bt.occurrence_index !== undefined && (
                  <span className="bg-primary/10 text-primary px-xs rounded text-xs font-medium">
                    {t('pages.routineTasks.focusBlocks.occurrenceLabel', {
                      index: bt.occurrence_index + 1,
                    })}
                  </span>
                )}
                {!readOnly && (
                  <PlainButton
                    type="button"
                    onClick={() => onRemoveTask(bt.id)}
                    title={t('pages.routineTasks.focusBlocks.removeTask')}
                    className={cn(
                      'group-hover:text-muted-foreground/50 text-transparent transition-colors',
                      'hover:!text-destructive shrink-0'
                    )}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </PlainButton>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && addableTasks.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-sm gap-xs px-sm text-muted-foreground hover:border-primary hover:text-primary h-7 border border-dashed text-xs"
            >
              <Plus className="h-3 w-3" />
              {t('pages.routineTasks.focusBlocks.addTask')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            {addableTasks.map(({ task, occurrences }) =>
              occurrences === null ? (
                <DropdownMenuItem
                  key={task.id}
                  onClick={() => onAddTask(task.id, null)}
                >
                  {task.name}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub key={task.id}>
                  <DropdownMenuSubTrigger>{task.name}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {occurrences.wholeAvailable && (
                      <DropdownMenuItem onClick={() => onAddTask(task.id, null)}>
                        {t('pages.routineTasks.focusBlocks.wholeTask')}
                      </DropdownMenuItem>
                    )}
                    {occurrences.options.map((i) => (
                      <DropdownMenuItem key={i} onClick={() => onAddTask(task.id, i)}>
                        {occurrences.times[i] ??
                          t('pages.routineTasks.focusBlocks.occurrenceLabel', {
                            index: i + 1,
                          })}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
