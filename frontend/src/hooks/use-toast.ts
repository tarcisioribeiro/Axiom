import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

/** Numero maximo de toasts visiveis simultaneamente */
const TOAST_LIMIT = 3;

/** Tempo em ms para remover toast apos dismiss */
const TOAST_REMOVE_DELAY = 5000;

/**
 * Tipo de toast com propriedades adicionais.
 */
type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = {
  ADD_TOAST: 'ADD_TOAST';
  UPDATE_TOAST: 'UPDATE_TOAST';
  DISMISS_TOAST: 'DISMISS_TOAST';
  REMOVE_TOAST: 'REMOVE_TOAST';
};

type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: ToasterToast['id'];
    };

interface State {
  toasts: ToasterToast[];
  pending: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST': {
      if (state.toasts.length < TOAST_LIMIT) {
        return {
          ...state,
          toasts: [action.toast, ...state.toasts],
        };
      }
      return {
        ...state,
        pending: [...state.pending, action.toast],
      };
    }

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case 'REMOVE_TOAST': {
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
          pending: [],
        };
      }
      const filtered = state.toasts.filter((t) => t.id !== action.toastId);
      const availableSlots = TOAST_LIMIT - filtered.length;
      const toPromote = state.pending.slice(0, availableSlots);
      const remainingPending = state.pending.slice(availableSlots);
      return {
        ...state,
        toasts: [...filtered, ...toPromote],
        pending: remainingPending,
      };
    }
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [], pending: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, 'id'>;

/**
 * Exibe um toast de notificacao.
 *
 * Funcao imperativa que pode ser usada fora de componentes React.
 *
 * @param props - Propriedades do toast
 * @returns Objeto com id, dismiss e update para controlar o toast
 *
 * @example
 * ```ts
 * // Toast simples
 * toast({ title: 'Sucesso!', description: 'Operacao concluida.' });
 *
 * // Toast de erro
 * toast({
 *   title: 'Erro',
 *   description: 'Falha ao salvar dados.',
 *   variant: 'destructive'
 * });
 *
 * // Controlar toast programaticamente
 * const { dismiss, update } = toast({ title: 'Carregando...' });
 * // Depois...
 * update({ title: 'Concluido!' });
 * dismiss();
 * ```
 */
function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

/**
 * Hook para gerenciar toasts de notificacao.
 *
 * Permite ate 3 toasts simultaneos (TOAST_LIMIT).
 * Toasts sao removidos automaticamente apos 5 segundos.
 *
 * @returns Objeto com toasts atuais, funcao toast e funcao dismiss
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { toast, dismiss } = useToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       toast({ title: 'Salvo com sucesso!' });
 *     } catch (error) {
 *       toast({
 *         title: 'Erro ao salvar',
 *         description: getErrorMessage(error),
 *         variant: 'destructive'
 *       });
 *     }
 *   };
 *
 *   return <button onClick={handleSave}>Salvar</button>;
 * }
 * ```
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    /** Dispensa um toast por ID, ou todos se ID nao for fornecido */
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast, toast };
