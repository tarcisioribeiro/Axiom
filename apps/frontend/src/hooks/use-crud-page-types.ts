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
