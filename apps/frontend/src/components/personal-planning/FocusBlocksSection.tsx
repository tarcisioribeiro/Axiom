import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  LayoutList,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TaskInstance } from '@/types';

interface FocusBlock {
  id: string;
  name: string;
  taskIds: number[];
  collapsed: boolean;
}

interface FocusBlocksSectionProps {
  date: string;
  instances: TaskInstance[];
  onToggleTaskComplete: (task: TaskInstance) => void;
  onBlockedTaskIdsChange?: (ids: Set<number>) => void;
}

const storageKey = (date: string) => `axiom.focusBlocks.${date}`;

function loadBlocks(date: string): FocusBlock[] {
  try {
    const raw = localStorage.getItem(storageKey(date));
    return raw ? (JSON.parse(raw) as FocusBlock[]) : [];
  } catch {
    return [];
  }
}

function saveBlocks(date: string, blocks: FocusBlock[]) {
  localStorage.setItem(storageKey(date), JSON.stringify(blocks));
}

export function FocusBlocksSection({
  date,
  instances,
  onToggleTaskComplete,
  onBlockedTaskIdsChange,
}: FocusBlocksSectionProps) {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<FocusBlock[]>(() => loadBlocks(date));
  const [newBlockName, setNewBlockName] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const callbackRef = useRef(onBlockedTaskIdsChange);

  useEffect(() => {
    callbackRef.current = onBlockedTaskIdsChange;
  });

  useEffect(() => {
    if (addingBlock) inputRef.current?.focus();
  }, [addingBlock]);

  useEffect(() => {
    const ids = new Set(blocks.flatMap((b) => b.taskIds));
    callbackRef.current?.(ids);
  }, [blocks]);

  const persist = useCallback(
    (updated: FocusBlock[]) => {
      setBlocks(updated);
      saveBlocks(date, updated);
    },
    [date]
  );

  const addBlock = () => {
    const name = newBlockName.trim();
    if (!name) return;
    persist([
      ...blocks,
      { id: crypto.randomUUID(), name, taskIds: [], collapsed: false },
    ]);
    setNewBlockName('');
    setAddingBlock(false);
  };

  const deleteBlock = (id: string) => persist(blocks.filter((b) => b.id !== id));

  const toggleCollapse = (id: string) =>
    persist(blocks.map((b) => (b.id === id ? { ...b, collapsed: !b.collapsed } : b)));

  const addTaskToBlock = (blockId: string, taskId: number) =>
    persist(
      blocks.map((b) =>
        b.id === blockId && !b.taskIds.includes(taskId)
          ? { ...b, taskIds: [...b.taskIds, taskId] }
          : b
      )
    );

  const removeTaskFromBlock = (blockId: string, taskId: number) =>
    persist(
      blocks.map((b) =>
        b.id === blockId
          ? { ...b, taskIds: b.taskIds.filter((id) => id !== taskId) }
          : b
      )
    );

  const allBlockedIds = new Set(blocks.flatMap((b) => b.taskIds));

  return (
    <div className="space-y-sm">
      <div className="flex items-center gap-sm">
        <LayoutList className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{t('pages.focusBlocks.title')}</span>
        {blocks.length > 0 && (
          <span className="rounded-full bg-primary/10 px-xs py-0.5 text-xs font-medium text-primary">
            {blocks.length}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAddingBlock(true)}
          className="ml-auto h-7 gap-xs px-sm text-xs"
        >
          <Plus className="h-3 w-3" />
          {t('pages.focusBlocks.addBlock')}
        </Button>
      </div>

      {blocks.length === 0 && !addingBlock && (
        <div className="rounded-lg border border-dashed bg-muted/20 px-md py-md text-center">
          <LayoutList className="mx-auto mb-xs h-5 w-5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            {t('pages.focusBlocks.emptyState')}
          </p>
        </div>
      )}

      {blocks.map((block) => {
        const blockTasks = instances.filter((i) => block.taskIds.includes(i.id));
        const doneCount = blockTasks.filter(
          (task) => task.status === 'completed'
        ).length;
        const total = blockTasks.length;
        const progressPct = total > 0 ? (doneCount / total) * 100 : 0;
        const isAllDone = total > 0 && doneCount === total;
        const hasProgress = progressPct > 0 && !isAllDone;

        const availableToAdd = instances.filter((i) => !allBlockedIds.has(i.id));

        return (
          <div
            key={block.id}
            className={cn(
              'overflow-hidden rounded-lg border border-l-4 transition-colors',
              isAllDone
                ? 'border-l-success bg-success/5'
                : hasProgress
                  ? 'border-l-primary bg-primary/[0.03]'
                  : 'border-l-muted-foreground/20 bg-card'
            )}
          >
            <div className="flex items-center gap-sm px-md py-sm">
              <button
                type="button"
                onClick={() => toggleCollapse(block.id)}
                className="flex flex-1 items-center gap-sm text-left"
              >
                {block.collapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold">{block.name}</span>
              </button>

              {total > 0 && (
                <span
                  className={cn(
                    'rounded-full px-xs py-0.5 text-xs font-medium tabular-nums',
                    isAllDone
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {doneCount}/{total}
                </span>
              )}

              <button
                type="button"
                onClick={() => deleteBlock(block.id)}
                title={t('pages.focusBlocks.deleteBlock')}
                className="ml-xs shrink-0 text-muted-foreground/40 transition-colors hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {total > 0 && (
              <div className="mx-md mb-xs h-1 overflow-hidden rounded-full bg-muted/50">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isAllDone ? 'bg-success' : 'bg-primary'
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}

            {!block.collapsed && (
              <div className="px-md pb-md pt-xs">
                {blockTasks.length === 0 ? (
                  <p className="py-xs text-xs text-muted-foreground">
                    {t('pages.focusBlocks.noTasks')}
                  </p>
                ) : (
                  <div className="space-y-xs">
                    {blockTasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'group flex items-center gap-sm rounded-md px-sm py-xs transition-colors',
                          task.status === 'completed'
                            ? 'bg-success/5'
                            : 'hover:bg-muted/40'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleTaskComplete(task)}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className={cn(
                            'flex-1 text-sm',
                            task.status === 'completed' &&
                              'text-muted-foreground line-through'
                          )}
                        >
                          {task.task_name}
                        </span>
                        {task.time_display && (
                          <span className="text-xs text-muted-foreground/70">
                            {task.time_display}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTaskFromBlock(block.id, task.id)}
                          title={t('pages.focusBlocks.removeTask')}
                          className="shrink-0 text-transparent transition-colors hover:!text-destructive group-hover:text-muted-foreground/50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {availableToAdd.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-sm h-7 gap-xs border border-dashed px-sm text-xs text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                        {t('pages.focusBlocks.addTask')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="max-h-48 overflow-y-auto"
                    >
                      {availableToAdd.map((task) => (
                        <DropdownMenuItem
                          key={task.id}
                          onClick={() => addTaskToBlock(block.id, task.id)}
                        >
                          {task.task_name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        );
      })}

      {addingBlock && (
        <div className="flex gap-sm">
          <Input
            ref={inputRef}
            value={newBlockName}
            onChange={(e) => setNewBlockName(e.target.value)}
            placeholder={t('pages.focusBlocks.blockPlaceholder')}
            className="h-9 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addBlock();
              if (e.key === 'Escape') setAddingBlock(false);
            }}
          />
          <Button size="sm" onClick={addBlock}>
            {t('common.actions.add')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddingBlock(false)}>
            {t('common.actions.cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}
