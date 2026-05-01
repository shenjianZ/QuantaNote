import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { useItemStore } from "./itemStore";
import { useToastStore } from "./toastStore";
import {
    getDbPath,
    setAutostart,
    getAutostart,
    updateWindowBehavior,
} from "../services/tauriCommands";

export interface CustomColor {
    hex: string;
    name: string;
}

export interface AppSettings {
    fontFamily: string;
    fontMono: string;
    fontSize: number;
    accentColor: string;
    customAccentColors: CustomColor[];
    minimizeToTray: boolean;
    closeKeepRunning: boolean;
    autoBackup: boolean;
    autostart: boolean;
}

const DEFAULTS: AppSettings = {
    fontFamily: "Noto Sans SC",
    fontMono: "JetBrains Mono",
    fontSize: 15,
    accentColor: "#386c5f",
    customAccentColors: [],
    minimizeToTray: true,
    closeKeepRunning: false,
    autoBackup: true,
    autostart: false,
};

const AVAILABLE_FONT_FAMILIES = new Set(["Noto Sans SC", "system-ui"]);
const AVAILABLE_MONO_FAMILIES = new Set([
    "JetBrains Mono",
    "Consolas",
    "monospace",
]);

function normalizeSettings(settings: AppSettings): AppSettings {
    return {
        ...settings,
        fontFamily: AVAILABLE_FONT_FAMILIES.has(settings.fontFamily)
            ? settings.fontFamily
            : DEFAULTS.fontFamily,
        fontMono: AVAILABLE_MONO_FAMILIES.has(settings.fontMono)
            ? settings.fontMono
            : DEFAULTS.fontMono,
        fontSize: Math.min(18, Math.max(14, Number(settings.fontSize) || DEFAULTS.fontSize)),
    };
}

function loadSettings(): AppSettings {
    try {
        const saved = localStorage.getItem("quantanote-settings");
        if (saved) {
            return normalizeSettings({ ...DEFAULTS, ...JSON.parse(saved) });
        }
    } catch {
        /* ignore */
    }
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
    const sansStack =
        settings.fontFamily === "system-ui"
            ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            : `'${settings.fontFamily}', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const monoStack =
        settings.fontMono === "monospace"
            ? "'SFMono-Regular', Consolas, monospace"
            : `'${settings.fontMono}', 'SFMono-Regular', Consolas, monospace`;

    root.style.setProperty("--font-sans", sansStack);
    root.style.setProperty("--font-mono", monoStack);
    root.style.setProperty(
        "--font-size-base",
        `${settings.fontSize}px`,
    );
    root.style.setProperty(
        "--font-size-2xs",
        `max(11px, calc(${settings.fontSize}px - 3px))`,
    );
    root.style.setProperty(
        "--font-size-xs",
        `max(12px, calc(${settings.fontSize}px - 2px))`,
    );
    root.style.setProperty(
        "--font-size-sm",
        `${settings.fontSize}px`,
    );
    root.style.setProperty("--font-size-md", `${settings.fontSize}px`);
    root.style.setProperty(
        "--font-size-lg",
        `calc(${settings.fontSize}px + 2px)`,
    );
    root.style.setProperty(
        "--font-size-xl",
        `calc(${settings.fontSize}px + 5px)`,
    );
    root.style.setProperty(
        "--font-size-2xl",
        `calc(${settings.fontSize}px + 9px)`,
    );
    root.style.setProperty(
        "--font-size-3xl",
        `calc(${settings.fontSize}px + 13px)`,
    );
    root.style.setProperty(
        "--font-size-md-h1",
        `calc(${settings.fontSize}px + 13px)`,
    );
    root.style.setProperty(
        "--font-size-md-h2",
        `calc(${settings.fontSize}px + 7px)`,
    );
    root.style.setProperty(
        "--font-size-md-h3",
        `calc(${settings.fontSize}px + 3px)`,
    );
    root.style.setProperty("--accent", settings.accentColor);
    const rgb = hexToRgb(settings.accentColor);
    if (rgb) {
        root.style.setProperty(
            "--accent-soft",
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
        );
    }
    document.body.style.fontSize = `${settings.fontSize}px`;
}

interface SettingsState {
    settings: AppSettings;
    dbSize: string;
    dbPath: string;
    init: () => void;
    updateSetting: <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K],
    ) => void;
    updateSettings: (partial: Partial<AppSettings>) => void;
    addCustomColor: (hex: string, name: string) => void;
    removeCustomColor: (hex: string) => void;
    refreshDbSize: () => Promise<void>;
    fetchDbPath: () => Promise<void>;
    optimizeDb: () => Promise<void>;
    exportData: () => Promise<void>;
    importData: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: loadSettings(),
    dbSize: "计算中...",
    dbPath: "",

    init: () => {
        const settings = get().settings;
        applySettings(settings);
        // 同步窗口行为到 Rust 端
        updateWindowBehavior(
            settings.minimizeToTray,
            settings.closeKeepRunning,
        ).catch(() => {});
        // 获取自启状态
        getAutostart()
            .then((enabled) => {
                if (enabled !== settings.autostart) {
                    const updated = { ...settings, autostart: enabled };
                    persist(updated);
                    set({ settings: updated });
                }
            })
            .catch(() => {});
    },

    updateSetting: async (key, value) => {
        const settings = { ...get().settings, [key]: value };
        persist(settings);
        applySettings(settings);
        set({ settings });

        // 同步到 Rust 端
        if (key === "autostart") {
            try {
                await setAutostart(value as boolean);
                useToastStore
                    .getState()
                    .addToast(
                        "success",
                        value ? "已开启开机自动启动" : "已关闭开机自动启动",
                    );
            } catch {
                useToastStore
                    .getState()
                    .addToast("error", "开机自动启动设置同步失败");
            }
        } else if (key === "minimizeToTray") {
            try {
                await updateWindowBehavior(
                    settings.minimizeToTray,
                    settings.closeKeepRunning,
                );
                useToastStore
                    .getState()
                    .addToast(
                        "success",
                        value
                            ? "已开启最小化到系统托盘"
                            : "已关闭最小化到系统托盘",
                    );
            } catch {
                useToastStore
                    .getState()
                    .addToast("error", "窗口行为设置同步失败");
            }
        } else if (key === "closeKeepRunning") {
            try {
                await updateWindowBehavior(
                    settings.minimizeToTray,
                    settings.closeKeepRunning,
                );
                useToastStore
                    .getState()
                    .addToast(
                        "success",
                        value
                            ? "已开启关闭窗口时隐藏到托盘"
                            : "已关闭关闭窗口时隐藏到托盘",
                    );
            } catch {
                useToastStore
                    .getState()
                    .addToast("error", "窗口行为设置同步失败");
            }
        }
    },

    updateSettings: (partial) => {
        const settings = { ...get().settings, ...partial };
        persist(settings);
        applySettings(settings);
        set({ settings });
        // 同步窗口行为
        updateWindowBehavior(
            settings.minimizeToTray,
            settings.closeKeepRunning,
        ).catch(() => {});
    },

    addCustomColor: (hex, name) => {
        const settings = get().settings;
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
        const colors = settings.customAccentColors.filter((c) => c.hex !== hex);
        colors.push({ hex, name: name.trim() || hex.toUpperCase() });
        const updated = { ...settings, customAccentColors: colors };
        persist(updated);
        set({ settings: updated });
    },

    removeCustomColor: (hex) => {
        const settings = get().settings;
        const colors = settings.customAccentColors.filter((c) => c.hex !== hex);
        const updated = { ...settings, customAccentColors: colors };
        persist(updated);
        set({ settings: updated });
    },

    refreshDbSize: async () => {
        try {
            const size = await invoke<string>("get_db_size");
            set({ dbSize: size });
        } catch {
            set({ dbSize: "未知" });
        }
    },

    fetchDbPath: async () => {
        try {
            const path = await getDbPath();
            set({ dbPath: path });
        } catch {
            set({ dbPath: "未知" });
        }
    },

    optimizeDb: async () => {
        try {
            await invoke("optimize_db");
            await get().refreshDbSize();
            useToastStore
                .getState()
                .addToast("success", "数据库优化完成，已回收未使用空间");
        } catch {
            useToastStore.getState().addToast("error", "数据库优化失败");
        }
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
                useToastStore
                    .getState()
                    .addToast("success", "数据已备份到文件");
            }
        } catch {
            useToastStore.getState().addToast("error", "数据备份失败");
        }
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
                useToastStore
                    .getState()
                    .addToast("success", "数据已恢复，请刷新查看");
            }
        } catch {
            useToastStore.getState().addToast("error", "数据恢复失败");
        }
    },
}));
