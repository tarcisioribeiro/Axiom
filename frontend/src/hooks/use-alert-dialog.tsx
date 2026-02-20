import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';

/** Variante visual do dialog */
type AlertVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info';

/** Tipo de animacao de entrada */
type AnimationType = 'default' | 'slideUp' | 'slideDown' | 'bounce' | 'shake';

/** Nivel de blur do backdrop */
type BlurLevel = 'none' | 'sm' | 'md' | 'lg';

/** Estado interno do dialog */
interface AlertDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: AlertVariant;
  animation?: AnimationType;
  blur?: BlurLevel;
  icon?: LucideIcon | React.ReactNode;
  showIcon?: boolean;
}

/** Store Zustand para gerenciar estado do dialog */
interface AlertDialogStore extends AlertDialogState {
  openAlert: (config: Omit<AlertDialogState, 'isOpen'>) => void;
  closeAlert: () => void;
}

/**
 * Store Zustand para estado global do AlertDialog.
 * Use o hook `useAlertDialog` para interagir com dialogs.
 */
export const useAlertDialogStore = create<AlertDialogStore>((set) => ({
  isOpen: false,
  title: '',
  description: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'default',
  animation: 'default',
  blur: 'md',
  showIcon: true,
  openAlert: (config) => set({ ...config, isOpen: true }),
  closeAlert: () => set({ isOpen: false }),
}));

/**
 * Hook para exibir dialogs de alerta e confirmacao.
 *
 * Fornece metodos utilitarios para diferentes tipos de dialogs:
 * - `showConfirm`: Dialog de confirmacao com botoes Sim/Nao
 * - `showAlert`: Dialog de alerta com botao OK
 * - `showSuccess`: Dialog de sucesso (verde)
 * - `showWarning`: Dialog de aviso (amarelo) com confirmacao
 * - `showError`: Dialog de erro (vermelho)
 * - `showInfo`: Dialog informativo (azul)
 * - `showDelete`: Dialog de confirmacao de exclusao
 *
 * @example
 * ```tsx
 * const { showConfirm, showDelete, showSuccess } = useAlertDialog();
 *
 * // Confirmacao simples
 * const confirmed = await showConfirm({
 *   title: 'Confirmar acao',
 *   description: 'Deseja continuar?'
 * });
 *
 * // Confirmacao de exclusao
 * const shouldDelete = await showDelete('este item');
 * if (shouldDelete) {
 *   await deleteItem();
 *   await showSuccess('Excluido', 'Item removido com sucesso');
 * }
 * ```
 */
export const useAlertDialog = () => {
  const store = useAlertDialogStore();

  /**
   * Exibe dialog de confirmacao com botoes Confirmar/Cancelar.
   *
   * @param options - Configuracoes do dialog
   * @returns Promise que resolve para true (confirmou) ou false (cancelou)
   */
  const showConfirm = (options: {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: AlertVariant;
    animation?: AnimationType;
    blur?: BlurLevel;
    icon?: LucideIcon | React.ReactNode;
    showIcon?: boolean;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      store.openAlert({
        ...options,
        onConfirm: () => {
          store.closeAlert();
          resolve(true);
        },
        onCancel: () => {
          store.closeAlert();
          resolve(false);
        },
      });
    });
  };

  /**
   * Exibe dialog de alerta com botao OK.
   *
   * @param options - Configuracoes do dialog
   * @returns Promise que resolve quando o usuario fecha o dialog
   */
  const showAlert = (options: {
    title: string;
    description: string;
    confirmText?: string;
    variant?: AlertVariant;
    animation?: AnimationType;
    blur?: BlurLevel;
    icon?: LucideIcon | React.ReactNode;
    showIcon?: boolean;
  }): Promise<void> => {
    return new Promise((resolve) => {
      store.openAlert({
        ...options,
        onConfirm: () => {
          store.closeAlert();
          resolve();
        },
      });
    });
  };

  /**
   * Exibe dialog de sucesso (verde) com animacao bounce.
   *
   * @param title - Titulo do dialog
   * @param description - Descricao/mensagem
   * @param options - Opcoes adicionais
   */
  const showSuccess = (
    title: string,
    description: string,
    options?: Partial<DefaultOptions>
  ): Promise<void> => {
    return showAlert({
      title,
      description,
      variant: 'success',
      animation: 'bounce',
      ...options,
    });
  };

  /**
   * Exibe dialog de aviso (amarelo) com confirmacao.
   *
   * @param title - Titulo do dialog
   * @param description - Descricao/mensagem
   * @param options - Opcoes adicionais
   * @returns Promise que resolve para true (confirmou) ou false (cancelou)
   */
  const showWarning = (
    title: string,
    description: string,
    options?: Partial<DefaultOptions>
  ): Promise<boolean> => {
    return showConfirm({
      title,
      description,
      variant: 'warning',
      animation: 'slideDown',
      ...options,
    });
  };

  /**
   * Exibe dialog de erro (vermelho) com animacao shake.
   *
   * @param title - Titulo do dialog
   * @param description - Descricao/mensagem de erro
   * @param options - Opcoes adicionais
   */
  const showError = (
    title: string,
    description: string,
    options?: Partial<DefaultOptions>
  ): Promise<void> => {
    return showAlert({
      title,
      description,
      variant: 'destructive',
      animation: 'shake',
      ...options,
    });
  };

  /**
   * Exibe dialog informativo (azul).
   *
   * @param title - Titulo do dialog
   * @param description - Descricao/informacao
   * @param options - Opcoes adicionais
   */
  const showInfo = (
    title: string,
    description: string,
    options?: Partial<DefaultOptions>
  ): Promise<void> => {
    return showAlert({
      title,
      description,
      variant: 'info',
      animation: 'slideUp',
      ...options,
    });
  };

  /**
   * Exibe dialog de confirmacao de exclusao.
   *
   * Usa variante destructive com animacao shake.
   *
   * @param itemName - Nome do item a ser excluido (ex: "este usuario")
   * @param options - Opcoes adicionais
   * @returns Promise que resolve para true (confirmou) ou false (cancelou)
   *
   * @example
   * ```ts
   * const shouldDelete = await showDelete('esta conta');
   * if (shouldDelete) {
   *   await accountsService.delete(id);
   * }
   * ```
   */
  const showDelete = (
    itemName: string,
    options?: Partial<DefaultOptions>
  ): Promise<boolean> => {
    return showConfirm({
      title: 'Confirmar exclusao',
      description: `Tem certeza que deseja excluir ${itemName}? Esta acao nao pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
      animation: 'shake',
      ...options,
    });
  };

  return {
    showConfirm,
    showAlert,
    showSuccess,
    showWarning,
    showError,
    showInfo,
    showDelete,
  };
};

type DefaultOptions = {
  confirmText: string;
  cancelText: string;
  animation: AnimationType;
  blur: BlurLevel;
  showIcon: boolean;
};
