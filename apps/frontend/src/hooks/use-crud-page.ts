import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback, useMemo } from 'react';

import { ToastAction, type ToastActionElement } from '@/components/ui/toast';
import type {
  CrudService,
  UseCrudPageOptions,
  UseCrudPageReturn,
} from '@/hooks/use-crud-page-types';
import { useSoundFeedback } from '@/hooks/use-sound-feedback';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';

export type { CrudService, UseCrudPageOptions, UseCrudPageReturn };

/**
 * Hook generico para paginas CRUD.
 *
 * Encapsula o padrao comum de:
 * - Carregar lista de itens
 * - Criar novo item
 * - Editar item existente
 * - Deletar item com confirmacao
 * - Gerenciar estados de loading
 * - Exibir toasts de sucesso/erro
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   isLoading,
 *   isSubmitting,
 *   isDialogOpen,
 *   selectedItem,
 *   handleCreate,
 *   handleEdit,
 *   handleDelete,
 *   handleSubmit,
 *   closeDialog,
 * } = useCrudPage(accountsService, { resourceName: 'conta' });
 * ```
 */
export function useCrudPage<
  T extends { id: string | number },
  CreateData,
  UpdateData = CreateData,
>(
  service: CrudService<T, CreateData, UpdateData>,
  options: UseCrudPageOptions<T>
): UseCrudPageReturn<T, CreateData, UpdateData> {
  const {
    resourceName,
    resourceNamePlural = `${resourceName}s`,
    messages = {},
    onSuccess,
  } = options;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | undefined>();

  const { toast } = useToast();
  const { playSuccess, playDelete, playError } = useSoundFeedback();
  const queryClient = useQueryClient();

  // Mensagens padrao — memoizadas para evitar re-criação a cada render
  const defaultMessages = useMemo(
    () => ({
      loadError: messages.loadError ?? `Erro ao carregar ${resourceNamePlural}`,
      createSuccess:
        messages.createSuccess ?? `${capitalize(resourceName)} criado(a) com sucesso`,
      updateSuccess:
        messages.updateSuccess ??
        `${capitalize(resourceName)} atualizado(a) com sucesso`,
      deleteSuccess:
        messages.deleteSuccess ?? `${capitalize(resourceName)} excluido(a). Desfazer?`,
      deleteError: messages.deleteError ?? `Erro ao excluir ${resourceName}`,
      saveError: messages.saveError ?? `Erro ao salvar ${resourceName}`,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resourceName, resourceNamePlural]
  );

  const queryKey = useMemo(() => ['crud-page', resourceName], [resourceName]);

  // Carrega dados via TanStack Query (sem efeito de montagem manual)
  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await service.getAll();
      } catch (error: unknown) {
        toast({
          title: defaultMessages.loadError,
          description: getErrorMessage(error),
          variant: 'destructive',
        });
        return [] as T[];
      }
    },
  });

  const refresh = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Abre dialog para criar
  const handleCreate = useCallback(() => {
    setSelectedItem(undefined);
    setIsDialogOpen(true);
  }, []);

  // Abre dialog para editar
  const handleEdit = useCallback((item: T) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  }, []);

  // Fecha dialog
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setSelectedItem(undefined);
  }, []);

  // Deleta com janela de desfazer (undo toast) — sem dialog de confirmacao bloqueante
  const handleDelete = useCallback(
    (id: string | number) => {
      const itemIndex = items.findIndex((item) => item.id === id);
      const deletedItem = items[itemIndex];
      if (!deletedItem) return;

      // Optimistic remove
      queryClient.setQueryData<T[]>(queryKey, (prev = []) =>
        prev.filter((item) => item.id !== id)
      );

      let undone = false;
      // Ref-like object so the closure captures the container (const) rather than the value (let)
      const timer = { handle: undefined as ReturnType<typeof setTimeout> | undefined };

      const handleUndo = () => {
        undone = true;
        clearTimeout(timer.handle);
        queryClient.setQueryData<T[]>(queryKey, (prev = []) => {
          const restored = [...prev];
          restored.splice(Math.min(itemIndex, restored.length), 0, deletedItem);
          return restored;
        });
      };

      playDelete();
      toast({
        title: defaultMessages.deleteSuccess,
        action: React.createElement(
          ToastAction,
          { altText: 'Desfazer exclusão', onClick: handleUndo },
          'Desfazer'
        ) as unknown as ToastActionElement,
      });

      timer.handle = setTimeout(() => {
        if (undone) return;
        void service
          .delete(id)
          .then(() => {
            onSuccess?.('delete');
          })
          .catch((error: unknown) => {
            queryClient.setQueryData<T[]>(queryKey, (prev = []) => {
              const restored = [...prev];
              restored.splice(Math.min(itemIndex, restored.length), 0, deletedItem);
              return restored;
            });
            playError();
            toast({
              title: defaultMessages.deleteError,
              description: getErrorMessage(error),
              variant: 'destructive',
            });
          });
      }, 5000);
    },
    [
      items,
      service,
      toast,
      onSuccess,
      defaultMessages,
      playDelete,
      playError,
      queryClient,
      queryKey,
    ]
  );

  // Submete formulario
  const handleSubmit = useCallback(
    async (data: CreateData | UpdateData) => {
      if (selectedItem) {
        // OPTIMISTIC UPDATE: aplica mudanca imediatamente, reverte em erro
        const originalItem = selectedItem;
        const optimisticItem = { ...selectedItem, ...(data as object) };
        queryClient.setQueryData<T[]>(queryKey, (prev = []) =>
          prev.map((item) => (item.id === selectedItem.id ? optimisticItem : item))
        );
        closeDialog();

        try {
          setIsSubmitting(true);
          const result = await service.update(selectedItem.id, data as UpdateData);
          queryClient.setQueryData<T[]>(queryKey, (prev = []) =>
            prev.map((item) => (item.id === selectedItem.id ? result : item))
          );
          playSuccess();
          toast({ title: defaultMessages.updateSuccess });
          onSuccess?.('update', result);
        } catch (error: unknown) {
          // Reverte para estado original
          queryClient.setQueryData<T[]>(queryKey, (prev = []) =>
            prev.map((item) => (item.id === selectedItem.id ? originalItem : item))
          );
          playError();
          toast({
            title: defaultMessages.saveError,
            description: getErrorMessage(error),
            variant: 'destructive',
          });
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // CREATE: fecha dialog apos sucesso e recarrega
        try {
          setIsSubmitting(true);
          const result = await service.create(data as CreateData);
          playSuccess();
          toast({ title: defaultMessages.createSuccess });
          onSuccess?.('create', result);
          closeDialog();
          await refresh();
        } catch (error: unknown) {
          playError();
          toast({
            title: defaultMessages.saveError,
            description: getErrorMessage(error),
            variant: 'destructive',
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [
      selectedItem,
      service,
      toast,
      closeDialog,
      refresh,
      onSuccess,
      defaultMessages,
      playSuccess,
      playError,
      queryClient,
      queryKey,
    ]
  );

  return {
    items,
    isLoading,
    isSubmitting,
    isDialogOpen,
    selectedItem,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    closeDialog,
    refresh,
    setIsDialogOpen,
  };
}

// Helper para capitalizar primeira letra
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default useCrudPage;
