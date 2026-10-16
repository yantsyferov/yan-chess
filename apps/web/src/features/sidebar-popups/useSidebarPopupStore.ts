import { create } from "zustand";

export type PopupId = "settings" | "friends" | "chat" | "notifications";

interface SidebarPopupState {
  openPopup: PopupId | null;
  open: (id: PopupId) => void;
  close: () => void;
  toggle: (id: PopupId) => void;
}

export const useSidebarPopupStore = create<SidebarPopupState>((set, get) => ({
  openPopup: null,
  open: (id) => set({ openPopup: id }),
  close: () => set({ openPopup: null }),
  toggle: (id) => set({ openPopup: get().openPopup === id ? null : id }),
}));
