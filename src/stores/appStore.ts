import { create } from "zustand";
import type { AppPage } from "../types";
import type { ThemeMode } from "../hooks/useTheme";

interface AppState {
  currentPage: AppPage;
  paletteOpen: boolean;
  selectedItemId: string | null;
  theme: ThemeMode;
  navigate: (page: AppPage) => void;
  openPalette: () => void;
  closePalette: () => void;
  selectItem: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
}

function applyThemeAttr(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
}

function getInitialPage(): AppPage {
  try {
    const settings = JSON.parse(localStorage.getItem("quantanote-settings") || "{}") as { openHomePage?: boolean };
    if (settings.openHomePage !== false) return "home";
    const saved = localStorage.getItem("quantanote-current-page") as AppPage | null;
    return saved && saved !== "document" ? saved : "all";
  } catch {
    return "home";
  }
}

const initialTheme = (localStorage.getItem("quantanote-theme") as ThemeMode) || "system";
applyThemeAttr(initialTheme);

export const useAppStore = create<AppState>((set) => ({
  currentPage: getInitialPage(),
  paletteOpen: false,
  selectedItemId: null,
  theme: initialTheme,

  navigate: (page) => {
    localStorage.setItem("quantanote-current-page", page);
    set({ currentPage: page });
  },
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  selectItem: (id) => set({ selectedItemId: id }),
  setTheme: (theme) => {
    localStorage.setItem("quantanote-theme", theme);
    applyThemeAttr(theme);
    set({ theme });
  },
}));
