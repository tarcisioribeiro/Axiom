import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutList, X } from 'lucide-react';
import { useImperativeHandle, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/common/EmptyState';
import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { focusBlockTasksService } from '@/services/focus-block-tasks-service';
import { focusBlocksService } from '@/services/focus-blocks-service';
import type { FocusBlock, FocusBlockFormData, RoutineTask } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { FocusBlockTasksEditor } from './FocusBlockTasksEditor';
import { BlockIcon, RoutineFocusBlockCard } from './RoutineFocusBlockCard';
import { RoutineFocusBlockForm } from './RoutineFocusBlockForm';

const LIST_PAGE_SIZE = 20;

export interface RoutineFocusBlocksSectionHandle {
  create: () => void;
}

interface RoutineFocusBlocksSectionProps {
  routineTasks: RoutineTask[];
  ownerId: number;
  searchTerm?: string;
  /** 'all' | 'active' | 'inactive' */
  statusFilter?: string;
  ref?: Ref<RoutineFocusBlocksSectionHandle>;
}

export function RoutineFocusBlocksSection({
  routineTasks,
  ownerId,
  searchTerm = '',
  statusFilter = 'all',
  ref,
}: RoutineFocusBlocksSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { showConfirm } = useAlertDialog();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<FocusBlock | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: blocks = [] } = useQuery({
    queryKey: ['focus-blocks'],
    queryFn: () => focusBlocksService.getAll(),
    staleTime: STALE_TIMES.DEFAULT_LIST,
  });
  // Guarda o id para o modal refletir o bloco atualizado após invalidações.
  const [viewingBlockId, setViewingBlockId] = useState<number | null>(null);
  const viewingBlock = blocks.find((b) => b.id === viewingBlockId);
  const term = searchTerm.trim().toLowerCase();
  const visibleBlocks = blocks.filter(
    (b) =>
      b.name.toLowerCase().includes(term) &&
      (statusFilter === 'all' || b.is_active === (statusFilter === 'active'))
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['focus-blocks'] });

  const handleCreate = () => {
    setSelectedBlock(undefined);
    setIsDialogOpen(true);
  };

  useImperativeHandle(ref, () => ({ create: handleCreate }));

  const handleEdit = (block: FocusBlock) => {
    setSelectedBlock(block);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: FocusBlockFormData) => {
    try {
      setIsSubmitting(true);
      if (selectedBlock) {
        const updated = await focusBlocksService.update(selectedBlock.id, data);
        setSelectedBlock(updated);
        toast({
          title: t('pages.routineTasks.focusBlocks.updated'),
        });
      } else {
        const created = await focusBlocksService.create(data);
        setSelectedBlock(created);
        toast({
          title: t('pages.routineTasks.focusBlocks.created'),
        });
      }
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.saveError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (block: FocusBlock) => {
    const confirmed = await showConfirm({
      title: t('pages.routineTasks.focusBlocks.deleteTitle'),
      description: t('pages.routineTasks.focusBlocks.deleteDesc'),
      confirmText: t('common.actions.delete'),
      cancelText: t('common.actions.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await focusBlocksService.delete(block.id);
      toast({
        title: t('pages.routineTasks.focusBlocks.deleted'),
      });
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.deleteError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    }
  };

  const refreshSelectedBlock = async (focusBlock: number) => {
    const refreshed = await focusBlocksService.getById(focusBlock);
    setSelectedBlock((current) => (current?.id === focusBlock ? refreshed : current));
  };

  const handleAddTask = async (
    focusBlock: number,
    routineTask: number,
    occurrenceIndex: number | null
  ) => {
    try {
      await focusBlockTasksService.create({
        focus_block: focusBlock,
        routine_task: routineTask,
        occurrence_index: occurrenceIndex,
      });
      await refreshSelectedBlock(focusBlock);
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.addTaskError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTask = async (focusBlock: number, focusBlockTaskId: number) => {
    try {
      await focusBlockTasksService.delete(focusBlockTaskId);
      await refreshSelectedBlock(focusBlock);
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.removeTaskError', {
          reason: getErrorMessage(error),
        }),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-sm">
      {visibleBlocks.length === 0 ? (
        <EmptyState
          title={
            blocks.length === 0
              ? t('pages.routineTasks.focusBlocks.emptyStateDesc')
              : t('common.noResults')
          }
          icon={<LayoutList />}
        />
      ) : (
        <PaginatedSlide
          items={visibleBlocks}
          pageSize={LIST_PAGE_SIZE}
          className="gap-sm grid md:grid-cols-2 lg:grid-cols-4"
        >
          {(pageBlocks) =>
            pageBlocks.map((block) => (
              <RoutineFocusBlockCard
                key={block.id}
                block={block}
                onOpen={() => setViewingBlockId(block.id)}
                onEdit={() => handleEdit(block)}
                onDelete={() => void handleDelete(block)}
              />
            ))
          }
        </PaginatedSlide>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader sticky>
            <DialogTitle mode={selectedBlock ? 'edit' : 'create'}>
              {selectedBlock
                ? t('pages.routineTasks.focusBlocks.editBlockTitle')
                : t('pages.routineTasks.focusBlocks.newBlockTitle')}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {selectedBlock
                  ? t('pages.routineTasks.focusBlocks.editBlockDesc')
                  : t('pages.routineTasks.focusBlocks.newBlockDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <RoutineFocusBlockForm
            block={selectedBlock}
            ownerId={ownerId}
            onSubmit={(data) => void handleSubmit(data)}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
            tasksEditor={
              selectedBlock && (
                <FocusBlockTasksEditor
                  block={selectedBlock}
                  allBlocks={blocks}
                  routineTasks={routineTasks}
                  onAddTask={(routineTaskId, occurrenceIndex) =>
                    void handleAddTask(selectedBlock.id, routineTaskId, occurrenceIndex)
                  }
                  onRemoveTask={(id) => void handleRemoveTask(selectedBlock.id, id)}
                />
              )
            }
          />
        </DialogContent>
      </Dialog>

      {/* Tarefas do bloco (só leitura) */}
      <Dialog
        open={!!viewingBlock}
        onOpenChange={(open) => {
          if (!open) setViewingBlockId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader sticky>
            <DialogTitle className="gap-sm flex items-center">
              <BlockIcon name={viewingBlock?.icon} className="h-4 w-4 shrink-0" />
              {viewingBlock?.name}
            </DialogTitle>
            <VisuallyHidden>
              <DialogDescription>
                {t('pages.routineTasks.focusBlocks.blockTasksDesc')}
              </DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          {viewingBlock && (
            <FocusBlockTasksEditor
              block={viewingBlock}
              allBlocks={blocks}
              routineTasks={routineTasks}
            />
          )}
          <DialogFooter className="sm:justify-start">
            <Button variant="outline" onClick={() => setViewingBlockId(null)}>
              <X className="h-4 w-4" />
              {t('common.actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
