import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { useItemStore } from "./itemStore";

export interface AppSettings {
  fontFamily: string;
  fontMono: string;
  fontSize: number;
  accentColor: string;
  minimizeToTray: boolean;
  closeKeepRunning: boolean;
  autoBackup: boolean;
}

const DEFAULTS: AppSettings = {
  fontFamily: "Noto Sans SC",
  fontMono: "JetBrains Mono",
  fontSize: 15,
  accentColor: "#386c5f",
  minimizeToTray: true,
  closeKeepRunning: false,
  autoBackup: true,
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem("quantanote-settings");
    if (saved) {
      return { ...DEFAULTS, ...JSON.parse(saved) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function persist(settings: AppSettings) {
  localStorage.setItem("quantanote-settings", JSON.stringify(settings));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function applySettings(settings: AppSettings) {
  const root = document.documentElement;
  root.style.setProperty("--font-sans", `'${settings.fontFamily}', system-ui, -apple-system, sans-serif`);
  root.style.setProperty("--font-mono", `'${settings.fontMono}', monospace`);
  root.style.setProperty("--font-size-base", `${settings.fontSize}px`);
  root.style.setProperty("--font-size-xs", `max(12px, calc(${settings.fontSize}px - 3px))`);
  root.style.setProperty("--font-size-sm", `max(13px, calc(${settings.fontSize}px - 2px))`);
  root.style.setProperty("--font-size-md", `${settings.fontSize}px`);
  root.style.setProperty("--font-size-lg", `calc(${settings.fontSize}px + 2px)`);
  root.style.setProperty("--font-size-xl", `calc(${settings.fontSize}px + 5px)`);
  root.style.setProperty("--accent", settings.accentColor);
  const rgb = hexToRgb(settings.accentColor);
  if (rgb) {
    root.style.setProperty("--accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
  }
  document.body.style.fontSize = `${settings.fontSize}px`;
}

interface SettingsState {
  settings: AppSettings;
  dbSize: string;
  init: () => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  refreshDbSize: () => Promise<void>;
  optimizeDb: () => Promise<void>;
  exportData: () => Promise<void>;
  importData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettings(),
  dbSize: "计算中...",

  init: () => {
    applySettings(get().settings);
  },

  updateSetting: (key, value) => {
    const settings = { ...get().settings, [key]: value };
    persist(settings);
    applySettings(settings);
    set({ settings });
  },

  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    persist(settings);
    applySettings(settings);
    set({ settings });
  },

  refreshDbSize: async () => {
    try {
      const size = await invoke<string>("get_db_size");
      set({ dbSize: size });
    } catch {
      set({ dbSize: "未知" });
    }
  },

  optimizeDb: async () => {
    try {
      await invoke("optimize_db");
      await get().refreshDbSize();
    } catch { /* ignore */ }
  },

  exportData: async () => {
    try {
      const json = await invoke<string>("export_data");
      const path = await save({
        defaultPath: "quantanote-backup.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path) {
        await invoke("save_to_file", { path, content: json });
      }
    } catch { /* ignore */ }
  },

  importData: async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path) {
        const json = await invoke<string>("read_from_file", { path });
        await invoke("import_data", { json });
        await useItemStore.getState().fetchItems();
        await get().refreshDbSize();
      }
    } catch { /* ignore */ }
  },
}));
