import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import i18n from "../i18n";
import { useItemStore } from "./itemStore";
import { useToastStore } from "./toastStore";
import {
    getDbPath,
    setAutostart,
    getAutostart,
    updateWindowBehavior,
    getExportSizeEstimate,
    exportDataZip,
    importDataZip,
    getAutoBackupConfig,
    updateAutoBackupConfig as updateAutoBackupConfigCmd,
    triggerBackupNow as triggerBackupNowCmd,
    getBackupDirPath as getBackupDirPathCmd,
    listBackups as listBackupsCmd,
    deleteBackup as deleteBackupCmd,
    updateSqlLogConfig as updateSqlLogConfigCmd,
    clearSqlLog as clearSqlLogCmd,
    getLogDir as getLogDirCmd,
    getSqlLogPath as getSqlLogPathCmd,
    loadAllSettings,
    saveSettings,
    type ExportOptions,
    type ImportOptions,
    type ExportSizeEstimate,
    type AutoBackupConfig,
    type BackupFileInfo,
    type SqlLogConfig,
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
    autoUpdateEnabled: boolean;
    sqlLogging: SqlLogSettings;
    locale: "zh-CN" | "en";
}

export interface SqlLogSettings {
    enabled: boolean;
    toConsole: boolean;
    toFile: boolean;
    pretty: boolean;
    maxLen: number;
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
    autoUpdateEnabled: false,
    sqlLogging: {
        enabled: false,
        toConsole: false,
        toFile: true,
        pretty: false,
        maxLen: 4000,
    },
    locale: "zh-CN",
};

const AVAILABLE_FONT_FAMILIES = new Set(["Noto Sans SC", "system-ui"]);
const AVAILABLE_MONO_FAMILIES = new Set([
    "JetBrains Mono",
    "Consolas",
    "monospace",
]);

function normalizeSettings(settings: AppSettings): AppSettings {
    const locale = settings.locale === "en" ? "en" : "zh-CN";
    return {
        fontFamily: AVAILABLE_FONT_FAMILIES.has(settings.fontFamily)
            ? settings.fontFamily
            : DEFAULTS.fontFamily,
        fontMono: AVAILABLE_MONO_FAMILIES.has(settings.fontMono)
            ? settings.fontMono
            : DEFAULTS.fontMono,
        fontSize: Math.min(18, Math.max(14, Number(settings.fontSize) || DEFAULTS.fontSize)),
        accentColor: settings.accentColor,
        customAccentColors: Array.isArray(settings.customAccentColors)
            ? settings.customAccentColors
            : DEFAULTS.customAccentColors,
        minimizeToTray: Boolean(settings.minimizeToTray),
        closeKeepRunning: Boolean(settings.closeKeepRunning),
        autoBackup: Boolean(settings.autoBackup),
        autostart: Boolean(settings.autostart),
        autoUpdateEnabled: Boolean(settings.autoUpdateEnabled),
        sqlLogging: normalizeSqlLogSettings(settings.sqlLogging),
        locale,
    };
}

function normalizeSqlLogSettings(settings?: Partial<SqlLogSettings>): SqlLogSettings {
    return {
        ...DEFAULTS.sqlLogging,
        ...settings,
        maxLen: Math.min(50000, Math.max(200, Number(settings?.maxLen) || DEFAULTS.sqlLogging.maxLen)),
    };
}

function loadSettings(): AppSettings {
    return { ...DEFAULTS };
}

function persist(settings: AppSettings) {
    saveSettings({ "quantanote-settings": JSON.stringify(settings) }).catch(() => {});
}

function toBackendSqlLogConfig(settings: SqlLogSettings): SqlLogConfig {
    return {
        enabled: settings.enabled,
        to_console: settings.toConsole,
        to_file: settings.toFile,
        pretty: settings.pretty,
        max_len: settings.maxLen,
    };
}

function fromBackendSqlLogConfig(config: SqlLogConfig): SqlLogSettings {
    return normalizeSqlLogSettings({
        enabled: config.enabled,
        toConsole: config.to_console,
        toFile: config.to_file,
        pretty: config.pretty,
        maxLen: config.max_len,
    });
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
    exportSizeEstimate: ExportSizeEstimate | null;
    autoBackupConfig: AutoBackupConfig | null;
    backupDirPath: string;
    backupFiles: BackupFileInfo[];
    logDir: string;
    sqlLogPath: string;
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
    fetchExportSizeEstimate: () => Promise<void>;
    exportDataWithOptions: (options: ExportOptions) => Promise<void>;
    importDataWithOptions: (options: ImportOptions) => Promise<void>;
    fetchAutoBackupConfig: () => Promise<void>;
    updateAutoBackupConfig: (config: AutoBackupConfig) => Promise<void>;
    triggerBackupNow: () => Promise<void>;
    fetchBackupDirPath: () => Promise<void>;
    fetchBackups: () => Promise<void>;
    deleteBackup: (filename: string) => Promise<void>;
    fetchDiagnosticsPaths: () => Promise<void>;
    updateSqlLogging: (partial: Partial<SqlLogSettings>) => Promise<void>;
    clearSqlLogFile: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: loadSettings(),
    dbSize: "计算中...",
    dbPath: "",
    exportSizeEstimate: null,
    autoBackupConfig: null,
    backupDirPath: "",
    backupFiles: [],
    logDir: "",
    sqlLogPath: "",

    init: async () => {
        // 从 SQLite 加载设置
        try {
            const saved = await loadAllSettings();
            if (saved["quantanote-settings"]) {
                const parsed = JSON.parse(saved["quantanote-settings"]);
                const merged = normalizeSettings({ ...DEFAULTS, ...parsed });
                set({ settings: merged });
                if (saved["quantanote-settings"] !== JSON.stringify(merged)) {
                    persist(merged);
                }
            }
        } catch {
            /* 首次启动，SQLite 为空 */
        }

        const settings = get().settings;
        applySettings(settings);
        i18n.changeLanguage(settings.locale);
        updateSqlLogConfigCmd(toBackendSqlLogConfig(settings.sqlLogging))
            .then((config) => {
                const sqlLogging = fromBackendSqlLogConfig(config);
                const current = get().settings;
                const updated = { ...current, sqlLogging };
                persist(updated);
                set({ settings: updated });
            })
            .catch(() => {});
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
        // 触发自动更新检查
        import("./updaterStore").then(({ useUpdaterStore }) => {
            useUpdaterStore.getState().startAutoUpdateCheck();
        }).catch(() => {});
    },

    updateSetting: async (key, value) => {
        const settings = { ...get().settings, [key]: value };
        persist(settings);
        applySettings(settings);
        set({ settings });

        if (key === "locale") {
            i18n.changeLanguage(value as string);
        }

        // 同步到 Rust 端
        if (key === "autostart") {
            try {
                await setAutostart(value as boolean);
                useToastStore
                    .getState()
                    .addToast(
                        "success",
                        value ? i18n.t("common:toast.autostartEnabled") : i18n.t("common:toast.autostartDisabled"),
                    );
            } catch {
                useToastStore
                    .getState()
                    .addToast("error", i18n.t("common:toast.autostartFailed"));
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
                            ? i18n.t("common:toast.trayEnabled")
                            : i18n.t("common:toast.trayDisabled"),
                    );
            } catch {
                useToastStore
                    .getState()
                    .addToast("error", i18n.t("common:toast.windowBehaviorFailed"));
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
                            ? i18n.t("common:toast.closeTrayEnabled")
                            : i18n.t("common:toast.closeTrayDisabled"),
                    );
            } catch {
                useToastStore
                    .getState()
                    .addToast("error", i18n.t("common:toast.windowBehaviorFailed"));
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
        updateSqlLogConfigCmd(toBackendSqlLogConfig(settings.sqlLogging)).catch(() => {});
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
                .addToast("success", i18n.t("common:toast.dbOptimized"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.dbOptimizeFailed"));
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
                    .addToast("success", i18n.t("common:toast.exportSuccess"));
            }
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.exportFailed"));
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
                    .addToast("success", i18n.t("common:toast.importSuccess"));
            }
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.importFailed"));
        }
    },

    fetchExportSizeEstimate: async () => {
        try {
            const estimate = await getExportSizeEstimate();
            set({ exportSizeEstimate: estimate });
        } catch {
            set({ exportSizeEstimate: null });
        }
    },

    exportDataWithOptions: async (options: ExportOptions) => {
        try {
            const path = await save({
                defaultPath: "quantanote-backup.zip",
                filters: [{ name: "ZIP", extensions: ["zip"] }],
            });
            if (path) {
                await exportDataZip(path, options);
                useToastStore
                    .getState()
                    .addToast("success", i18n.t("common:toast.exportSuccess"));
            }
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.exportFailed"));
        }
    },

    importDataWithOptions: async (options: ImportOptions) => {
        try {
            const path = await open({
                multiple: false,
                filters: [{ name: "ZIP", extensions: ["zip"] }],
            });
            if (path) {
                await importDataZip(path, options);
                await useItemStore.getState().fetchItems();
                await get().refreshDbSize();
                useToastStore
                    .getState()
                    .addToast("success", i18n.t("common:toast.importSuccess"));
            }
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.importFailed"));
        }
    },

    fetchAutoBackupConfig: async () => {
        try {
            const config = await getAutoBackupConfig();
            set({ autoBackupConfig: config });
        } catch {
            set({ autoBackupConfig: null });
        }
    },

    updateAutoBackupConfig: async (config: AutoBackupConfig) => {
        try {
            await updateAutoBackupConfigCmd(config);
            set({ autoBackupConfig: config });
            useToastStore.getState().addToast("success", i18n.t("common:toast.configUpdated"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.configUpdateFailed"));
        }
    },

    triggerBackupNow: async () => {
        try {
            await triggerBackupNowCmd();
            await get().fetchBackups();
            await get().fetchAutoBackupConfig();
            useToastStore.getState().addToast("success", i18n.t("common:toast.backupSuccess"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.backupFailed"));
        }
    },

    fetchBackupDirPath: async () => {
        try {
            const path = await getBackupDirPathCmd();
            set({ backupDirPath: path });
        } catch {
            set({ backupDirPath: "" });
        }
    },

    fetchBackups: async () => {
        try {
            const files = await listBackupsCmd();
            set({ backupFiles: files });
        } catch {
            set({ backupFiles: [] });
        }
    },

    deleteBackup: async (filename: string) => {
        try {
            await deleteBackupCmd(filename);
            await get().fetchBackups();
            useToastStore.getState().addToast("success", i18n.t("common:toast.backupDeleted"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.backupDeleteFailed"));
        }
    },

    fetchDiagnosticsPaths: async () => {
        try {
            const [logDir, sqlLogPath] = await Promise.all([
                getLogDirCmd(),
                getSqlLogPathCmd(),
            ]);
            set({ logDir, sqlLogPath });
        } catch {
            set({ logDir: "", sqlLogPath: "" });
        }
    },

    updateSqlLogging: async (partial: Partial<SqlLogSettings>) => {
        const current = get().settings;
        const nextSqlLogging = normalizeSqlLogSettings({
            ...current.sqlLogging,
            ...partial,
        });
        const optimistic = { ...current, sqlLogging: nextSqlLogging };
        persist(optimistic);
        set({ settings: optimistic });

        try {
            const synced = await updateSqlLogConfigCmd(toBackendSqlLogConfig(nextSqlLogging));
            const sqlLogging = fromBackendSqlLogConfig(synced);
            const updated = { ...get().settings, sqlLogging };
            persist(updated);
            set({ settings: updated });
            useToastStore
                .getState()
                .addToast("success", sqlLogging.enabled ? i18n.t("common:toast.sqlLogEnabled") : i18n.t("common:toast.sqlLogDisabled"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.sqlLogFailed"));
        }
    },

    clearSqlLogFile: async () => {
        try {
            await clearSqlLogCmd();
            useToastStore.getState().addToast("success", i18n.t("common:toast.sqlLogCleared"));
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.sqlLogClearFailed"));
        }
    },
}));
