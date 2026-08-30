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
    getSyncDevices,
    revokeSyncDevice,
    getPendingConflicts,
    resolveSyncConflicts,
    cancelSyncConflicts,
    pauseSync as pauseSyncCommand,
    resumeSync as resumeSyncCommand,
    type SyncConfig,
    type SyncState,
    type SyncResult,
    type SyncHistoryEntry,
    type SyncDevice,
    type ConflictInfo,
    type ConflictResolutionChoice,
} from "../services/tauriCommands";
import { useItemStore } from "./itemStore";
import i18n from "../i18n";
import { useTagStore } from "./tagStore";

let _autoSyncTimer: ReturnType<typeof setInterval> | null = null;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (_retryTimer) {
        clearTimeout(_retryTimer);
        _retryTimer = null;
    }
}

function scheduleQueueRetry(nextRetryAt: string, triggerFn: () => Promise<void>) {
    if (_retryTimer) {
        clearTimeout(_retryTimer);
    }
    const delay = Math.max(0, new Date(nextRetryAt).getTime() - Date.now());
    _retryTimer = setTimeout(() => {
        _retryTimer = null;
        triggerFn().catch(() => {});
    }, delay);
}

interface SyncStore {
    config: SyncConfig;
    state: SyncState;
    history: SyncHistoryEntry[];
    historyTotal: number;
    historyPage: number;
    historyPageSize: number;
    devices: SyncDevice[];
    isLoading: boolean;
    error: string | null;
    pendingConflicts: ConflictInfo[] | null;

    // 初始化
    init: () => Promise<void>;

    // 认证
    login: (serverUrl: string, email: string, password: string) => Promise<void>;
    register: (serverUrl: string, email: string, password: string, verifyCode?: string) => Promise<void>;
    logout: () => Promise<void>;
    forgotPassword: (serverUrl: string, email: string) => Promise<string | null>;
    resetPassword: (serverUrl: string, email: string, resetToken: string, newPassword: string) => Promise<void>;

    // 同步操作
    triggerSync: () => Promise<SyncResult>;
    pauseSync: () => Promise<void>;
    resumeSync: () => Promise<void>;
    testConnection: (serverUrl: string) => Promise<boolean>;
    refreshHistory: (page?: number, pageSize?: number) => Promise<void>;
    refreshDevices: () => Promise<void>;
    revokeDevice: (deviceId: string) => Promise<void>;

    // 冲突解决
    resolveConflicts: (resolutions: ConflictResolutionChoice[]) => Promise<SyncResult>;
    cancelConflicts: () => Promise<void>;

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
    authenticated: false,
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
    state: {
        status: "idle",
        progress: null,
        last_error: null,
        last_sync_at: null,
        queued: false,
        retry_count: 0,
        next_retry_at: null,
        paused: false,
    },
    history: [],
    historyTotal: 0,
    historyPage: 1,
    historyPageSize: 10,
    devices: [],
    isLoading: false,
    error: null,
    pendingConflicts: null,

    init: async () => {
        try {
            const config = await getSyncConfig();
            const state = await getSyncState();
            set({ config, state });

            if (config.authenticated) {
                await get().refreshDevices();
            }

            if (state.queued && !state.paused && state.next_retry_at) {
                scheduleQueueRetry(state.next_retry_at, async () => {
                    await get().triggerSync();
                });
            }

            // 检查是否有待解决的冲突（应用重启后恢复）
            try {
                const pending = await getPendingConflicts();
                if (pending && pending.length > 0) {
                    set({ pendingConflicts: pending });
                }
            } catch {
                // 忽略：可能后端尚未注册该 command
            }

            // 仅注册一次事件监听，防止重复
            if (!_initialized) {
                _initialized = true;
                listen<SyncState>("sync-state-changed", (event) => {
                    set({ state: event.payload });
                });
            }

            // 启动自动同步
            if (config.enabled && config.authenticated && config.auto_sync) {
                startAutoSync(config.sync_interval_minutes, async () => {
                    try {
                        await get().triggerSync();
                    } catch (e) {
                        console.warn("Auto sync failed:", e);
                    }
                });
            }
        } catch (e) {
            console.error("Init sync config failed:", e);
        }
    },

    login: async (serverUrl, email, password) => {
        set({ isLoading: true, error: null });
        try {
            await syncLogin(serverUrl, email, password);
            const config = await getSyncConfig();
            set({ config, isLoading: false });
            await get().refreshDevices();
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    register: async (serverUrl, email, password, verifyCode) => {
        set({ isLoading: true, error: null });
        try {
            await syncRegister(serverUrl, email, password, verifyCode);
            const config = await getSyncConfig();
            set({ config, isLoading: false });
            await get().refreshDevices();
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    logout: async () => {
        stopAutoSync();
        set({ isLoading: true, error: null });
        try {
            await syncLogout();
            const config = await getSyncConfig();
            set({ config, devices: [], isLoading: false });
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    forgotPassword: async (serverUrl, email) => {
        set({ isLoading: true, error: null });
        try {
            const resetToken = await syncForgotPassword(serverUrl, email, i18n.language);
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
            if (result.pending_conflicts == null) {
                if (_retryTimer) {
                    clearTimeout(_retryTimer);
                    _retryTimer = null;
                }
            }
            const config = await getSyncConfig();
            const state = await getSyncState();
            set({ config, state, isLoading: false });

            // manual 模式有冲突：保存冲突列表，不刷新数据
            if (result.pending_conflicts && result.pending_conflicts.length > 0) {
                set({ pendingConflicts: result.pending_conflicts });
                return result;
            }

            // 同步成功后刷新应用数据，让 UI 反映最新状态
            if (result.pulled > 0) {
                await useItemStore.getState().fetchItems();
                await useTagStore.getState().fetchTags();
            }

            // 刷新同步历史
            await get().refreshHistory();

            return result;
        } catch (e) {
            const msg = String(e);
            // token 过期：自动注销并停止自动同步
            if (msg.includes("TokenExpired") || msg.includes("登录已过期")) {
                stopAutoSync();
                await get().logout();
                set({ isLoading: false, error: i18n.t("sync:sessionExpired") });
                throw new Error(i18n.t("sync:sessionExpired"));
            }
            try {
                const state = await getSyncState();
                set({ state });
                if (state.queued && !state.paused && state.next_retry_at) {
                    scheduleQueueRetry(state.next_retry_at, async () => {
                        await get().triggerSync();
                    });
                }
            } catch {
                // 忽略状态刷新失败，保留原始同步错误
            }
            set({ isLoading: false, error: msg });
            throw e;
        }
    },

    pauseSync: async () => {
        set({ error: null });
        try {
            await pauseSyncCommand();
            stopAutoSync();
            const state = await getSyncState();
            set({ state });
        } catch (e) {
            set({ error: String(e) });
            throw e;
        }
    },

    resumeSync: async () => {
        set({ error: null });
        try {
            await resumeSyncCommand();
            const state = await getSyncState();
            set({ state });
            const config = get().config;
            if (config.enabled && config.authenticated && config.auto_sync) {
                startAutoSync(config.sync_interval_minutes, async () => {
                    try {
                        await get().triggerSync();
                    } catch (e) {
                        console.warn("Auto sync failed:", e);
                    }
                });
            }
            await get().triggerSync();
        } catch (e) {
            set({ error: String(e) });
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

    refreshHistory: async (page?: number, pageSize?: number) => {
        const p = page ?? get().historyPage;
        const ps = pageSize ?? get().historyPageSize;
        try {
            const result = await getSyncHistory(p, ps);
            set({
                history: result.items,
                historyTotal: result.total,
                historyPage: result.page,
                historyPageSize: result.page_size,
            });
        } catch (e) {
            console.error("Fetch sync history failed:", e);
        }
    },

    refreshDevices: async () => {
        if (!get().config.authenticated) {
            set({ devices: [] });
            return;
        }
        try {
            const devices = await getSyncDevices();
            set({ devices });
        } catch (e) {
            console.error("Fetch sync devices failed:", e);
        }
    },

    revokeDevice: async (deviceId: string) => {
        set({ error: null });
        try {
            await revokeSyncDevice(deviceId);
            await get().refreshDevices();
        } catch (e) {
            set({ error: String(e) });
            throw e;
        }
    },

    resolveConflicts: async (resolutions) => {
        set({ isLoading: true, error: null });
        try {
            const result = await resolveSyncConflicts(resolutions);
            set({ pendingConflicts: null, isLoading: false });

            // 刷新应用数据
            if (result.pulled > 0) {
                await useItemStore.getState().fetchItems();
                await useTagStore.getState().fetchTags();
            }
            const config = await getSyncConfig();
            set({ config });
            await get().refreshHistory();

            return result;
        } catch (e) {
            set({ isLoading: false, error: String(e) });
            throw e;
        }
    },

    cancelConflicts: async () => {
        try {
            await cancelSyncConflicts();
            set({ pendingConflicts: null });
        } catch (e) {
            set({ error: String(e) });
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
        if (updated.enabled && updated.authenticated && updated.auto_sync) {
            startAutoSync(updated.sync_interval_minutes, async () => {
                try {
                    await get().triggerSync();
                } catch (e) {
                    console.warn("Auto sync failed:", e);
                }
            });
        } else {
            stopAutoSync();
        }
    },

    clearError: () => set({ error: null }),
}));
