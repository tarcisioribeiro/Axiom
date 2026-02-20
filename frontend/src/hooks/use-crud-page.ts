import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getErrorMessage } from '@/lib/utils';

/**
 * Interface para servicos CRUD.
 * O servico deve implementar esses metodos.
 */
export interface CrudService<T, CreateData, UpdateData = CreateData> {
  getAll: () => Promise<T[]>;
  create: (data: CreateData) => Promise<T>;
  update: (id: number, data: UpdateData) => Promise<T>;
  delete: (id: number) => Promise<void>;
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
    deleteConfirmTitle?: string;
    deleteConfirmDescription?: string;
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
  handleDelete: (id: number) => Promise<void>;
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
  T extends { id: number },
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
  const { showConfirm } = useAlertDialog();

  // Mensagens padrao
  const defaultMessages = {
    loadError: messages.loadError ?? `Erro ao carregar ${resourceNamePlural}`,
    createSuccess:
      messages.createSuccess ?? `${capitalize(resourceName)} criado(a) com sucesso`,
    updateSuccess:
      messages.updateSuccess ?? `${capitalize(resourceName)} atualizado(a) com sucesso`,
    deleteSuccess:
      messages.deleteSuccess ?? `${capitalize(resourceName)} excluido(a) com sucesso`,
    deleteError: messages.deleteError ?? `Erro ao excluir ${resourceName}`,
    saveError: messages.saveError ?? `Erro ao salvar ${resourceName}`,
    deleteConfirmTitle: messages.deleteConfirmTitle ?? `Excluir ${resourceName}`,
    deleteConfirmDescription:
      messages.deleteConfirmDescription ??
      `Tem certeza que deseja excluir este(a) ${resourceName}? Esta acao nao pode ser desfeita.`,
  };

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

  // Deleta com confirmacao
  const handleDelete = useCallback(
    async (id: number) => {
      const confirmed = await showConfirm({
        title: defaultMessages.deleteConfirmTitle,
        description: defaultMessages.deleteConfirmDescription,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        variant: 'destructive',
      });

      if (!confirmed) return;

      try {
        await service.delete(id);
        toast({
          title: defaultMessages.deleteSuccess,
          variant: 'default',
        });
        onSuccess?.('delete');
        await loadData();
      } catch (error: unknown) {
        toast({
          title: defaultMessages.deleteError,
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    },
    [service, toast, showConfirm, loadData, onSuccess, defaultMessages]
  );

  // Submete formulario
  const handleSubmit = useCallback(
    async (data: CreateData | UpdateData) => {
      try {
        setIsSubmitting(true);
        let result: T;

        if (selectedItem) {
          result = await service.update(selectedItem.id, data as UpdateData);
          toast({
            title: defaultMessages.updateSuccess,
            variant: 'default',
          });
          onSuccess?.('update', result);
        } else {
          result = await service.create(data as CreateData);
          toast({
            title: defaultMessages.createSuccess,
            variant: 'default',
          });
          onSuccess?.('create', result);
        }

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
