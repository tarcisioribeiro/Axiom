import * as React from 'react';

import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

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
  | { type: ActionType['ADD_TOAST']; toast: ToasterToast }
  | { type: ActionType['UPDATE_TOAST']; toast: Partial<ToasterToast> }
  | { type: ActionType['DISMISS_TOAST']; toastId?: ToasterToast['id'] }
  | { type: ActionType['REMOVE_TOAST']; toastId?: ToasterToast['id'] };

interface State {
  toasts: ToasterToast[];
  pending: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: 'REMOVE_TOAST', toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST': {
      if (state.toasts.length < TOAST_LIMIT) {
        return { ...state, toasts: [action.toast, ...state.toasts] };
      }
      return { ...state, pending: [...state.pending, action.toast] };
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
        state.toasts.forEach((t) => addToRemoveQueue(t.id));
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      };
    }
    case 'REMOVE_TOAST': {
      if (action.toastId === undefined) {
        return { ...state, toasts: [], pending: [] };
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
  listeners.forEach((listener) => listener(memoryState));
}

type Toast = Omit<ToasterToast, 'id'>;
type ToastReturn = {
  id: string;
  dismiss: () => void;
  update: (props: ToasterToast) => void;
};

function _toast({ ...props }: Toast): ToastReturn {
  const id = genId();
  const update = (p: ToasterToast) =>
    dispatch({ type: 'UPDATE_TOAST', toast: { ...p, id } });
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

  return { id, dismiss, update };
}

type ShorthandOpts = Partial<Omit<Toast, 'variant'>>;

type ToastFn = {
  (props: Toast): ToastReturn;
  success: (title: string, opts?: ShorthandOpts) => ToastReturn;
  error: (title: string, opts?: ShorthandOpts) => ToastReturn;
  info: (title: string, opts?: ShorthandOpts) => ToastReturn;
  warning: (title: string, opts?: ShorthandOpts) => ToastReturn;
};

_toast.success = (title: string, opts?: ShorthandOpts) =>
  _toast({ title, variant: 'success', ...opts });
_toast.error = (title: string, opts?: ShorthandOpts) =>
  _toast({ title, variant: 'destructive', ...opts });
_toast.info = (title: string, opts?: ShorthandOpts) =>
  _toast({ title, variant: 'info', ...opts });
_toast.warning = (title: string, opts?: ShorthandOpts) =>
  _toast({ title, variant: 'warning', ...opts });

export const toast = _toast as ToastFn;

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []); // stable subscription — no re-subscribe on state changes

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast };
