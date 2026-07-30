import { LayoutList, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskInstance } from '@/types';

import { FocusBlockCard, type FocusBlock } from './FocusBlockCard';

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

      {blocks.map((block) => (
        <FocusBlockCard
          key={block.id}
          block={block}
          instances={instances}
          allBlockedIds={allBlockedIds}
          onToggleCollapse={toggleCollapse}
          onDeleteBlock={deleteBlock}
          onAddTask={addTaskToBlock}
          onRemoveTask={removeTaskFromBlock}
          onToggleTaskComplete={onToggleTaskComplete}
        />
      ))}

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
