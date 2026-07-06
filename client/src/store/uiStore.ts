import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  selectedTaskId: string | null;
  isTaskDrawerOpen: boolean;
  isCreateTaskModalOpen: boolean;
  
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setTaskDrawerOpen: (isOpen: boolean) => void;
  setCreateTaskModalOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  selectedTaskId: null,
  isTaskDrawerOpen: false,
  isCreateTaskModalOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId, isTaskDrawerOpen: !!taskId }),
  setTaskDrawerOpen: (isOpen) => set((state) => ({ 
    isTaskDrawerOpen: isOpen,
    selectedTaskId: isOpen ? state.selectedTaskId : null 
  })),
  setCreateTaskModalOpen: (isOpen) => set({ isCreateTaskModalOpen: isOpen })
}));
