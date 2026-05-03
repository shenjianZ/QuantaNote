import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import {
    getSyncConfig,
    saveSyncConfig,
    getSyncState,
    triggerSync,
    syncLogin,
    syncRegister,
    syncLogout,
    syncForgotPassword,
    syncResetPassword,
    testSyncConnection,
    getSyncHistory,
    type SyncConfig,
    type SyncState,
    type SyncResult,
    type SyncHistoryEntry,
} from "../services/tauriCommands";

let _autoSyncTimer: ReturnType<typeof setInterval> | null = null;
let _initialized = false;

function startAutoSync(intervalMinutes: number, triggerFn: () => Promise<void>) {
    stopAutoSync();
    if (intervalMinutes < 1) return;
    _autoSyncTimer = setInterval(() => {
        triggerFn().catch(() => {});
    }, intervalMinutes * 60 * 1000);
}

function stopAutoSync() {
    if (_autoSyncTimer) {
        clearInterval(_autoSyncTimer);
        _autoSyncTimer = null;
    }
}

interface SyncStore {
    config: SyncConfig;
    state: SyncState;
    history: SyncHistoryEntry[];
    isLoading: boolean;
    error: string | null;

    // 初始化
    init: () => Promise<void>;

    // 认证
    login: (serverUrl: string, email: string, password: string) => Promise<void>;
    register: (serverUrl: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    forgotPassword: (serverUrl: string, email: string) => Promise<string>;
    resetPassword: (serverUrl: string, email: string, resetToken: string, newPassword: string) => Promise<void>;

    // 同步操作
    triggerSync: () => Promise<SyncResult>;
    testConnection: (serverUrl: string) => Promise<boolean>;
    refreshHistory: () => Promise<void>;

    // 配置更新
    updateConfig: (partial: Partial<SyncConfig>) => Promise<void>;

    // 清除错误
    clearError: () => void;
}

const DEFAULT_CONFIG: SyncConfig = {
    enabled: false,
    server_url: "",
    access_token: "",
    refresh_token: "",
    user_id: "",
    device_id: "",
    auto_sync: false,
    sync_interval_minutes: 15,
    conflict_resolution: "auto",
    sync_attachments: true,
    last_sync_at: null,
    last_snapshot_id: null,
};

export const useSyncStore = create<SyncStore>((set, get) => ({
    config: { ...DEFAULT_CONFIG },
    state: { status: "idle", progress: null, last_error: null, last_sync_at: null },
    history: [],
    isLoading: false,
    error: null,

    init: async () => {
        try {
            const config = await getSyncConfig();
            const state = await getSyncState();
            set({ config, state });

            // 仅注册一次事件监听，防止重复
            if (!_initialized) {
                _initialized = true;
                listen<SyncState>("sync-state-changed", (event) => {
                    set({ state: event.payload });
                });
            }

            // 启动自动同步
            if (config.enabled && config.access_token && config.auto_sync) {
                startAutoSync(config.sync_interval_minutes, async () => {
                    try {
                        await get().triggerSync();
                    } catch (e) {
                        console.warn("自动同步失败:", e);
                    }
                });
            }
        } catch (e) {
            console.error("初始化同步配置失败:", e);
        }
    },

    login: async (serverUrl, email, password) => {
        set({ isLoading: true, error: null });
        try {
            await syncLogin(serverUrl, email, password);
            const config = await getSyncConfig();
            set({ config, isLoading: false });
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    register: async (serverUrl, email, password) => {
        set({ isLoading: true, error: null });
        try {
            await syncRegister(serverUrl, email, password);
            const config = await getSyncConfig();
            set({ config, isLoading: false });
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    logout: async () => {
        set({ isLoading: true, error: null });
        try {
            await syncLogout();
            const config = await getSyncConfig();
            set({ config, isLoading: false });
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    forgotPassword: async (serverUrl, email) => {
        set({ isLoading: true, error: null });
        try {
            const resetToken = await syncForgotPassword(serverUrl, email);
            set({ isLoading: false });
            return resetToken;
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    resetPassword: async (serverUrl, email, resetToken, newPassword) => {
        set({ isLoading: true, error: null });
        try {
            await syncResetPassword(serverUrl, email, resetToken, newPassword);
            set({ isLoading: false });
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    triggerSync: async () => {
        set({ isLoading: true, error: null });
        try {
            const result = await triggerSync();
            const config = await getSyncConfig();
            set({ config, isLoading: false });
            return result;
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    testConnection: async (serverUrl) => {
        try {
            return await testSyncConnection(serverUrl);
        } catch {
            return false;
        }
    },

    refreshHistory: async () => {
        try {
            const history = await getSyncHistory();
            set({ history });
        } catch (e) {
            console.error("获取同步历史失败:", e);
        }
    },

    updateConfig: async (partial) => {
        const current = get().config;
        const updated = { ...current, ...partial };
        set({ config: updated });
        try {
            await saveSyncConfig(updated);
        } catch (e) {
            set({ error: String(e) });
        }

        // 更新自动同步定时器
        if (updated.enabled && updated.access_token && updated.auto_sync) {
            startAutoSync(updated.sync_interval_minutes, async () => {
                try {
                    await get().triggerSync();
                } catch (e) {
                    console.warn("自动同步失败:", e);
                }
            });
        } else {
            stopAutoSync();
        }
    },

    clearError: () => set({ error: null }),
}));
