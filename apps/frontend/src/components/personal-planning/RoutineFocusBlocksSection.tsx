import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutList } from 'lucide-react';
import { useImperativeHandle, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { PaginatedSlide } from '@/components/common/PaginatedSlide';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { STALE_TIMES } from '@/lib/query-client';
import { focusBlockTasksService } from '@/services/focus-block-tasks-service';
import { focusBlocksService } from '@/services/focus-blocks-service';
import type { FocusBlock, FocusBlockFormData, RoutineTask } from '@/types';
import { getErrorMessage } from '@/utils/error-utils';

import { FocusBlockTasksEditor } from './FocusBlockTasksEditor';
import { RoutineFocusBlockCard } from './RoutineFocusBlockCard';
import { RoutineFocusBlockForm } from './RoutineFocusBlockForm';

// Uma linha do grid (2 colunas em md+).
const LIST_PAGE_SIZE = 2;

export interface RoutineFocusBlocksSectionHandle {
  create: () => void;
}

interface RoutineFocusBlocksSectionProps {
  routineTasks: RoutineTask[];
  ownerId: number;
  ref?: Ref<RoutineFocusBlocksSectionHandle>;
}

export function RoutineFocusBlocksSection({
  routineTasks,
  ownerId,
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
          description: t('pages.routineTasks.focusBlocks.updatedDesc'),
        });
      } else {
        const created = await focusBlocksService.create(data);
        setSelectedBlock(created);
        toast({
          title: t('pages.routineTasks.focusBlocks.created'),
          description: t('pages.routineTasks.focusBlocks.createdDesc'),
        });
      }
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.saveError'),
        description: getErrorMessage(error),
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
        description: t('pages.routineTasks.focusBlocks.deletedDesc'),
      });
      void invalidate();
    } catch (error: unknown) {
      toast({
        title: t('pages.routineTasks.focusBlocks.deleteError'),
        description: getErrorMessage(error),
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
        title: t('pages.routineTasks.focusBlocks.addTaskError'),
        description: getErrorMessage(error),
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
        title: t('pages.routineTasks.focusBlocks.removeTaskError'),
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-sm">
      {blocks.length === 0 ? (
        <div className="bg-muted/20 px-md py-md rounded-lg border border-dashed text-center">
          <LayoutList className="mb-xs text-muted-foreground/40 mx-auto h-5 w-5" />
          <p className="text-muted-foreground text-xs">
            {t('pages.routineTasks.focusBlocks.emptyStateDesc')}
          </p>
        </div>
      ) : (
        <PaginatedSlide
          items={blocks}
          pageSize={LIST_PAGE_SIZE}
          className="gap-sm grid md:grid-cols-2"
        >
          {(pageBlocks) =>
            pageBlocks.map((block) => (
              <RoutineFocusBlockCard
                key={block.id}
                block={block}
                allBlocks={blocks}
                routineTasks={routineTasks}
                onEdit={() => handleEdit(block)}
                onDelete={() => void handleDelete(block)}
                onAddTask={(routineTaskId, occurrenceIndex) =>
                  void handleAddTask(block.id, routineTaskId, occurrenceIndex)
                }
                onRemoveTask={(id) => void handleRemoveTask(block.id, id)}
              />
            ))
          }
        </PaginatedSlide>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedBlock
                ? t('pages.routineTasks.focusBlocks.editBlockTitle')
                : t('pages.routineTasks.focusBlocks.newBlockTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedBlock
                ? t('pages.routineTasks.focusBlocks.editBlockDesc')
                : t('pages.routineTasks.focusBlocks.newBlockDesc')}
            </DialogDescription>
          </DialogHeader>
          <RoutineFocusBlockForm
            block={selectedBlock}
            ownerId={ownerId}
            onSubmit={(data) => void handleSubmit(data)}
            onCancel={() => setIsDialogOpen(false)}
            isLoading={isSubmitting}
          />
          {selectedBlock && (
            <div className="pt-sm pb-lg border-t">
              <FocusBlockTasksEditor
                block={selectedBlock}
                allBlocks={blocks}
                routineTasks={routineTasks}
                onAddTask={(routineTaskId, occurrenceIndex) =>
                  void handleAddTask(selectedBlock.id, routineTaskId, occurrenceIndex)
                }
                onRemoveTask={(id) => void handleRemoveTask(selectedBlock.id, id)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
