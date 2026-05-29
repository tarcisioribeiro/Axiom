import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { ToastAction, type ToastActionElement } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';

/**
 * Interface para servicos CRUD.
 * O servico deve implementar esses metodos.
 */
export interface CrudService<T, CreateData, UpdateData = CreateData> {
  getAll: () => Promise<T[]>;
  create: (data: CreateData) => Promise<T>;
  update: (id: string | number, data: UpdateData) => Promise<T>;
  delete: (id: string | number) => Promise<void>;
}

/**
 * Opcoes de configuracao do hook.
 */
export interface UseCrudPageOptions<T> {
  /** Nome do recurso em singular (ex: "conta", "despesa") */
  resourceName: string;
  /** Nome do recurso em plural (ex: "contas", "despesas") */
  resourceNamePlural?: string;
  /** Mensagens customizadas */
  messages?: {
    loadError?: string;
    createSuccess?: string;
    updateSuccess?: string;
    deleteSuccess?: string;
    deleteError?: string;
    saveError?: string;
  };
  /** Callback apos criar/atualizar/deletar com sucesso */
  onSuccess?: (action: 'create' | 'update' | 'delete', item?: T) => void;
}

/**
 * Retorno do hook useCrudPage.
 */
export interface UseCrudPageReturn<T, CreateData, UpdateData = CreateData> {
  /** Lista de itens */
  items: T[];
  /** Estado de loading inicial */
  isLoading: boolean;
  /** Estado de loading do submit */
  isSubmitting: boolean;
  /** Dialog de formulario aberto */
  isDialogOpen: boolean;
  /** Item selecionado para edicao (undefined = criar novo) */
  selectedItem: T | undefined;
  /** Abre dialog para criar novo item */
  handleCreate: () => void;
  /** Abre dialog para editar item existente */
  handleEdit: (item: T) => void;
  /** Deleta item com confirmacao */
  handleDelete: (id: string | number) => void;
  /** Submete formulario (cria ou atualiza) */
  handleSubmit: (data: CreateData | UpdateData) => Promise<void>;
  /** Fecha dialog */
  closeDialog: () => void;
  /** Recarrega dados */
  refresh: () => Promise<void>;
  /** Define estado do dialog */
  setIsDialogOpen: (open: boolean) => void;
}

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

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | undefined>();

  const { toast } = useToast();

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

  // Carrega dados
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await service.getAll();
      setItems(data);
    } catch (error: unknown) {
      toast({
        title: defaultMessages.loadError,
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [service, toast, defaultMessages.loadError]);

  // Carrega dados ao montar
  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      setItems((prev) => prev.filter((item) => item.id !== id));

      let undone = false;
      // Ref-like object so the closure captures the container (const) rather than the value (let)
      const timer = { handle: undefined as ReturnType<typeof setTimeout> | undefined };

      const handleUndo = () => {
        undone = true;
        clearTimeout(timer.handle);
        setItems((prev) => {
          const restored = [...prev];
          restored.splice(Math.min(itemIndex, restored.length), 0, deletedItem);
          return restored;
        });
      };

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
            setItems((prev) => {
              const restored = [...prev];
              restored.splice(Math.min(itemIndex, restored.length), 0, deletedItem);
              return restored;
            });
            toast({
              title: defaultMessages.deleteError,
              description: getErrorMessage(error),
              variant: 'destructive',
            });
          });
      }, 5000);
    },
    [items, service, toast, onSuccess, defaultMessages]
  );

  // Submete formulario
  const handleSubmit = useCallback(
    async (data: CreateData | UpdateData) => {
      if (selectedItem) {
        // OPTIMISTIC UPDATE: aplica mudanca imediatamente, reverte em erro
        const originalItem = selectedItem;
        const optimisticItem = { ...selectedItem, ...(data as object) };
        setItems((prev) =>
          prev.map((item) => (item.id === selectedItem.id ? optimisticItem : item))
        );
        closeDialog();

        try {
          setIsSubmitting(true);
          const result = await service.update(selectedItem.id, data as UpdateData);
          setItems((prev) =>
            prev.map((item) => (item.id === selectedItem.id ? result : item))
          );
          toast({ title: defaultMessages.updateSuccess });
          onSuccess?.('update', result);
        } catch (error: unknown) {
          // Reverte para estado original
          setItems((prev) =>
            prev.map((item) => (item.id === selectedItem.id ? originalItem : item))
          );
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
          toast({ title: defaultMessages.createSuccess });
          onSuccess?.('create', result);
          closeDialog();
          await loadData();
        } catch (error: unknown) {
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
    [selectedItem, service, toast, closeDialog, loadData, onSuccess, defaultMessages]
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
    refresh: loadData,
    setIsDialogOpen,
  };
}

// Helper para capitalizar primeira letra
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default useCrudPage;
