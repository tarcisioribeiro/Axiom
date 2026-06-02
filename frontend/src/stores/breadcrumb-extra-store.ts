import { create } from 'zustand';

interface BreadcrumbExtraStore {
  extraLabel: string | null;
  setExtraLabel: (label: string | null) => void;
}

export const useBreadcrumbExtraStore = create<BreadcrumbExtraStore>((set) => ({
  extraLabel: null,
  setExtraLabel: (label) => set({ extraLabel: label }),
}));
