import { create } from 'zustand';

interface BreadcrumbExtraStore {
  extraLabel: string | null;
  extraSubLabel: string | null;
  setExtraLabel: (label: string | null) => void;
  setExtraSubLabel: (label: string | null) => void;
}

export const useBreadcrumbExtraStore = create<BreadcrumbExtraStore>((set) => ({
  extraLabel: null,
  extraSubLabel: null,
  setExtraLabel: (label) => set({ extraLabel: label }),
  setExtraSubLabel: (label) => set({ extraSubLabel: label }),
}));
