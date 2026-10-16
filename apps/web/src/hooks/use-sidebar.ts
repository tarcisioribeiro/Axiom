import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface SidebarStore {
  isOpen: boolean;
  isCollapsed: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleCollapsed: () => void;
}

const getStoredCollapsed = (): boolean => {
  try {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  } catch {
    return false;
  }
};

export const useSidebar = create<SidebarStore>((set) => ({
  isOpen: false,
  isCollapsed: getStoredCollapsed(),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleCollapsed: () =>
    set((s) => {
      const next = !s.isCollapsed;
      try {
        localStorage.setItem('sidebar-collapsed', String(next));
      } catch {
        // ignore
      }
      return { isCollapsed: next };
    }),
}));

/** Returns true when the viewport is narrower than the md breakpoint (768px). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
