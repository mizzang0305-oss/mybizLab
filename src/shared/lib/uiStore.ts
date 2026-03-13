import { create } from 'zustand';

const STORAGE_KEY = 'mybizlab:ui-state';

interface UiState {
  selectedStoreId?: string;
  sidebarOpen: boolean;
  setSelectedStoreId: (storeId?: string) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

function getInitialStoreId() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as { selectedStoreId?: string };
    return parsed.selectedStoreId;
  } catch {
    return undefined;
  }
}

function persistUiState(selectedStoreId?: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedStoreId,
    }),
  );
}

export const useUiStore = create<UiState>((set) => ({
  selectedStoreId: getInitialStoreId(),
  sidebarOpen: false,
  setSelectedStoreId: (selectedStoreId) => {
    persistUiState(selectedStoreId);
    set({ selectedStoreId });
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}));
