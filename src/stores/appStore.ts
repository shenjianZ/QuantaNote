import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppPage } from "../types";
import type { ThemeMode } from "../hooks/useTheme";
import { loadAllSettings, saveSettings } from "../services/tauriCommands";
import { useToastStore } from "./toastStore";

function getAppWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

interface AppState {
  currentPage: AppPage;
  paletteOpen: boolean;
  selectedItemId: string | null;
  theme: ThemeMode;
  alwaysOnTop: boolean;
  init: () => Promise<void>;
  navigate: (page: AppPage) => void;
  openPalette: () => void;
  closePalette: () => void;
  selectItem: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setAlwaysOnTop: (value: boolean) => Promise<void>;
}

function applyThemeAttr(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
}

// 同步应用默认主题，避免首屏闪烁
applyThemeAttr("system");

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: "workspace",
  paletteOpen: false,
  selectedItemId: null,
  theme: "system",
  alwaysOnTop: false,

  init: async () => {
    try {
      const saved = await loadAllSettings();
      const patch: Partial<AppState> = {};

      if (saved.theme) {
        patch.theme = saved.theme as ThemeMode;
        applyThemeAttr(patch.theme);
      }
      if (saved.currentPage) {
        const page = saved.currentPage as AppPage;
        if (page === "library" || page === "settings") {
          patch.currentPage = page;
        }
      }
      if (saved.alwaysOnTop !== undefined) {
        const value = saved.alwaysOnTop === "true";
        const appWindow = getAppWindow();
        if (appWindow) {
          try {
            await appWindow.setAlwaysOnTop(value);
            const actual = await appWindow.isAlwaysOnTop();
            patch.alwaysOnTop = actual;
            if (actual !== value) {
              saveSettings({ alwaysOnTop: String(actual) }).catch(() => {});
            }
          } catch {
            try {
              patch.alwaysOnTop = await appWindow.isAlwaysOnTop();
              saveSettings({ alwaysOnTop: String(patch.alwaysOnTop) }).catch(() => {});
            } catch {
              patch.alwaysOnTop = false;
            }
          }
        } else {
          patch.alwaysOnTop = false;
        }
      }

      if (Object.keys(patch).length > 0) {
        set(patch);
      }
    } catch {
      /* 首次启动 SQLite 为空，使用默认值 */
    }
  },

  navigate: (page) => {
    set({ currentPage: page });
    saveSettings({ currentPage: page }).catch(() => {});
  },
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  selectItem: (id) => set({ selectedItemId: id }),
  setTheme: (theme) => {
    applyThemeAttr(theme);
    set({ theme });
    saveSettings({ theme }).catch(() => {});
  },
  setAlwaysOnTop: async (value) => {
    const previous = get().alwaysOnTop;
    const appWindow = getAppWindow();
    set({ alwaysOnTop: value });

    try {
      if (!appWindow) {
        throw new Error("Tauri window unavailable");
      }
      await appWindow.setAlwaysOnTop(value);
      const actual = await appWindow.isAlwaysOnTop();
      set({ alwaysOnTop: actual });
      saveSettings({ alwaysOnTop: String(actual) }).catch(() => {});
      if (actual !== value) {
        useToastStore.getState().addToast("error", "窗口置顶状态与系统返回不一致");
      }
    } catch {
      let actual = previous;
      try {
        actual = (await appWindow?.isAlwaysOnTop()) ?? previous;
      } catch {
        actual = previous;
      }
      set({ alwaysOnTop: actual });
      saveSettings({ alwaysOnTop: String(actual) }).catch(() => {});
      useToastStore.getState().addToast("error", "设置窗口置顶失败");
    }
  },
}));
