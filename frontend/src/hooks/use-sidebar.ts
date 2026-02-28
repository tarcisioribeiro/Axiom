import { create } from 'zustand';

interface SidebarStore {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

/**
 * Hook para controlar estado da sidebar em mobile
 *
 * UI-01/02: Gerencia visibilidade da sidebar responsiva
 */
export const useSidebar = create<SidebarStore>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
