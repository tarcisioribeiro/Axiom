import { create } from 'zustand';

interface AgentWidgetStore {
  hiddenByNav: boolean;
  setHiddenByNav: (hidden: boolean) => void;
}

export const useAgentWidgetStore = create<AgentWidgetStore>((set) => ({
  hiddenByNav: false,
  setHiddenByNav: (hidden) => set({ hiddenByNav: hidden }),
}));
