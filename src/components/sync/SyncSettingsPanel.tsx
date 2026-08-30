import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Cloud,
    CloudOff,
    Loader2,
    LogIn,
    LogOut,
    RefreshCw,
    UserPlus,
    History,
    CheckCircle,
    AlertCircle,
    Pause,
    Play,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useSyncStore } from "../../stores/syncStore";
import { LoginModal } from "../auth/LoginModal";
import { RegisterModal } from "../auth/RegisterModal";
import { ForgotPasswordModal } from "../auth/ForgotPasswordModal";
import { ResetPasswordModal } from "../auth/ResetPasswordModal";
import { ConflictResolutionModal } from "./ConflictResolutionModal";
import { Select } from "../common/Select";

type AuthModal = "login" | "register" | "forgot" | "reset" | null;

interface SyncSettingsPanelProps {
    showAccount?: boolean;
}

export function SyncSettingsPanel({ showAccount = true }: SyncSettingsPanelProps) {
    const { t } = useTranslation(["sync", "common"]);
    const {
        config,
        state,
        history,
        historyTotal,
        historyPage,
        historyPageSize,
        devices,
        isLoading,
        error,
        pendingConflicts,
        updateConfig,
        triggerSync,
        pauseSync,
        resumeSync,
        logout,
        testConnection,
        refreshHistory,
        refreshDevices,
        revokeDevice,
        clearError,
    } = useSyncStore();

    const [authModal, setAuthModal] = useState<AuthModal>(null);
    const [resetEmail, setResetEmail] = useState("");
    const [serverUrlInput, setServerUrlInput] = useState(config.server_url);
    const [testResult, setTestResult] = useState<boolean | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);

    useEffect(() => {
        setServerUrlInput(config.server_url);
    }, [config.server_url]);

    useEffect(() => {
        if (config.authenticated) {
            refreshHistory();
            refreshDevices();
        }
    }, [config.authenticated, refreshHistory, refreshDevices]);

    const isLoggedIn = Boolean(config.authenticated && config.user_id);

    async function handleTestConnection() {
        if (!serverUrlInput.trim()) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await testConnection(serverUrlInput);
            setTestResult(result);
        } catch {
            setTestResult(false);
        }
        setIsTesting(false);
    }

    async function handleSync() {
        clearError();
        try {
            await triggerSync();
        } catch {
            // error handled in store
        }
    }

    async function handlePause() {
        try {
            await pauseSync();
        } catch {
            // error handled in store
        }
    }

    async function handleResume() {
        try {
            await resumeSync();
        } catch {
            // error handled in store
        }
    }

    async function handleRevokeDevice(deviceId: string) {
        if (!window.confirm(t("revokeDeviceConfirm"))) return;
        setRevokingDeviceId(deviceId);
        try {
            await revokeDevice(deviceId);
        } catch {
            // 错误由同步状态统一展示
        } finally {
            setRevokingDeviceId(null);
        }
    }

    function handleServerUrlBlur() {
        if (serverUrlInput !== config.server_url) {
            updateConfig({ server_url: serverUrlInput });
        }
    }

    const isSyncing =
        state.status === "preparing" ||
        state.status === "pushing" ||
        state.status === "pulling" ||
        state.status === "syncing_attachments";
    const isPaused = state.paused;

    return (
        <div className="space-y-6">
            {/* 同步总开关 */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-medium text-[var(--text)]">
                        {t("enableSync")}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                        {t("enableSyncDesc")}
                    </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                    <input
                        data-testid="sync-toggle"
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) =>
                            updateConfig({ enabled: e.target.checked })
                        }
                        className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-[var(--field)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[var(--muted)] after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                </label>
            </div>

            {/* 服务器地址 */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--text)]">
                    {t("serverUrl")}
                </label>
                <div className="flex gap-2">
                    <input
                        data-testid="sync-server-url-input"
                        type="url"
                        value={serverUrlInput}
                        onChange={(e) => setServerUrlInput(e.target.value)}
                        onBlur={handleServerUrlBlur}
                        placeholder="https://your-server.com"
                        className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                    <button
                        data-testid="sync-test-connection-btn"
                        onClick={handleTestConnection}
                        disabled={isTesting || !serverUrlInput.trim()}
                        className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                    >
                        {isTesting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {t("testBtn")}
                    </button>
                </div>
                {testResult !== null && (
                    <div
                        data-testid="sync-test-result"
                        className={`flex items-center gap-1.5 text-xs ${testResult ? "text-green-400" : "text-red-400"}`}
                    >
                        {testResult ? (
                            <CheckCircle className="h-3.5 w-3.5" />
                        ) : (
                            <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        {testResult ? t("testSuccess") : t("testFailed")}
                    </div>
                )}
            </div>

            {/* 账号状态 */}
            {showAccount && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text)]">
                        {t("account")}
                    </label>
                    {isLoggedIn ? (
                        <div className="flex items-center justify-between rounded-xl bg-[var(--field)] px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Cloud className="h-4 w-4 text-[var(--accent)]" />
                                <span className="text-sm text-[var(--text)]">
                                    {t("loggedIn")}
                                </span>
                            </div>
                            <button
                                data-testid="sync-logout-btn"
                                onClick={logout}
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                {t("logout")}
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                data-testid="sync-login-btn"
                                onClick={() => setAuthModal("login")}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                            >
                                <LogIn className="h-4 w-4" />
                                {t("login")}
                            </button>
                            <button
                                data-testid="sync-register-btn"
                                onClick={() => setAuthModal("register")}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                            >
                                <UserPlus className="h-4 w-4" />
                                {t("register")}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 同步策略 */}
            {isLoggedIn && (
                <>
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-[var(--text)]">
                            {t("syncStrategy")}
                        </label>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--muted)]">
                                {t("autoSync")}
                            </span>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    data-testid="sync-auto-sync-toggle"
                                    type="checkbox"
                                    checked={config.auto_sync}
                                    onChange={(e) =>
                                        updateConfig({
                                            auto_sync: e.target.checked,
                                        })
                                    }
                                    className="peer sr-only"
                                />
                                <div className="h-5 w-9 rounded-full bg-[var(--field)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-[var(--muted)] after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                            </label>
                        </div>
                        {config.auto_sync && (
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--muted)]">
                                    {t("syncInterval")}
                                </span>
                                <input
                                    data-testid="sync-interval-input"
                                    type="number"
                                    min={5}
                                    max={1440}
                                    value={config.sync_interval_minutes}
                                    onChange={(e) =>
                                        updateConfig({
                                            sync_interval_minutes: Math.max(
                                                5,
                                                parseInt(e.target.value) || 15,
                                            ),
                                        })
                                    }
                                    className="w-20 rounded-lg border border-[var(--line)] bg-[var(--field)] px-2.5 py-1.5 text-right text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                />
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--muted)]">
                                {t("syncAttachments")}
                            </span>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    data-testid="sync-attachments-toggle"
                                    type="checkbox"
                                    checked={config.sync_attachments}
                                    onChange={(e) =>
                                        updateConfig({
                                            sync_attachments: e.target.checked,
                                        })
                                    }
                                    className="peer sr-only"
                                />
                                <div className="h-5 w-9 rounded-full bg-[var(--field)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-[var(--muted)] after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--muted)]">
                                {t("conflictResolution")}
                            </span>
                            <Select
                                className="w-32"
                                value={config.conflict_resolution}
                                onChange={(v) =>
                                    updateConfig({
                                        conflict_resolution: v,
                                    })
                                }
                                options={[
                                    { value: "auto", label: t("conflictAuto") },
                                    { value: "local-wins", label: t("conflictLocal") },
                                    { value: "remote-wins", label: t("conflictRemote") },
                                    { value: "manual", label: t("conflictManual") },
                                ]}
                            />
                        </div>
                    </div>

                    {/* 待解决冲突提示 */}
                    {pendingConflicts && pendingConflicts.length > 0 && (
                        <div data-testid="sync-pending-conflicts" className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                            {t("pendingConflicts", { count: pendingConflicts.length })}
                        </div>
                    )}

                    {/* 同步状态 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--text)]">
                            {t("syncStatus")}
                        </label>
                        <div data-testid="sync-status" className="rounded-xl bg-[var(--field)] px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {isSyncing ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                    ) : isPaused ? (
                                        <Pause className="h-4 w-4 text-amber-300" />
                                    ) : state.status === "error" ? (
                                        <CloudOff className="h-4 w-4 text-red-400" />
                                    ) : (
                                        <Cloud className="h-4 w-4 text-[var(--muted)]" />
                                    )}
                                    <span className="text-sm text-[var(--text)]">
                                        {isPaused
                                            ? t("paused")
                                            : isSyncing
                                            ? `${t("syncing")}${state.progress ? `: ${state.progress.phase}` : ""}`
                                            : state.status === "completed"
                                              ? t("syncCompleted")
                                              : state.status === "error"
                                                ? t("syncError")
                                                : t("idle")}
                                    </span>
                                </div>
                                <button
                                    data-testid="sync-now-btn"
                                    onClick={handleSync}
                                    disabled={isSyncing || isLoading || isPaused}
                                    className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                                >
                                    {isSyncing ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    )}
                                    {isSyncing ? t("syncingBtn") : t("syncNow")}
                                </button>
                                {isPaused ? (
                                    <button
                                        data-testid="sync-resume-btn"
                                        onClick={handleResume}
                                        disabled={isLoading}
                                        className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-50"
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        {t("resumeSync")}
                                    </button>
                                ) : (
                                    <button
                                        data-testid="sync-pause-btn"
                                        onClick={handlePause}
                                        disabled={isSyncing || isLoading}
                                        className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                                    >
                                        <Pause className="h-3.5 w-3.5" />
                                        {t("pauseSync")}
                                    </button>
                                )}
                            </div>
                            {state.progress && isSyncing && (
                                <div data-testid="sync-progress" className="mt-2">
                                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                                        <div
                                            className="h-full rounded-full bg-[var(--accent)] transition-all"
                                            style={{
                                                width: `${state.progress.total > 0 ? (state.progress.current / state.progress.total) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="mt-1 text-right text-xs text-[var(--muted)]">
                                        {state.progress.current} /{" "}
                                        {state.progress.total}
                                    </div>
                                </div>
                            )}
                            {(state.last_sync_at || config.last_sync_at) && !isSyncing && (
                                <div className="mt-1.5 text-xs text-[var(--muted)]">
                                    {t("lastSync", { time: new Date(
                                        state.last_sync_at || config.last_sync_at!,
                                    ).toLocaleString() })}
                                </div>
                            )}
                            {state.last_error && state.status === "error" && (
                                <div className="mt-1.5 text-xs text-red-400">
                                    {state.last_error}
                                </div>
                            )}
                            {state.queued && (
                                <div data-testid="sync-queue-status" className="mt-1.5 text-xs text-amber-300">
                                    {state.retry_count > 0
                                        ? t("retryScheduled", { count: state.retry_count })
                                        : t("syncQueued")}
                                    {state.next_retry_at && (
                                        <span className="ml-1 text-[var(--muted)]">
                                            {t("retryAt", { time: new Date(state.next_retry_at).toLocaleString() })}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 设备会话 */}
                    <div data-testid="sync-devices" className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-[var(--text)]">
                                {t("devices")}
                            </label>
                            <button
                                data-testid="sync-devices-refresh-btn"
                                onClick={() => refreshDevices()}
                                disabled={isLoading}
                                className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                                title={t("refreshDevices")}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {devices.map((device) => (
                                <div
                                    key={device.device_id}
                                    data-testid="sync-device-row"
                                    data-device-id={device.device_id}
                                    className="flex items-center justify-between rounded-xl bg-[var(--field)] px-3 py-2.5"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-xs text-[var(--text)]">
                                            <span className="truncate" title={device.device_id}>
                                                {device.is_current
                                                    ? t("currentDevice")
                                                    : device.device_id}
                                            </span>
                                            {device.is_current && (
                                                <span className="shrink-0 rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                                                    {t("currentDeviceBadge")}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                                            {t("deviceLastSeen", {
                                                time: new Date(device.last_seen_at).toLocaleString(),
                                            })}
                                        </div>
                                    </div>
                                    {!device.is_current && (
                                        <button
                                            data-testid="sync-device-revoke-btn"
                                            onClick={() => handleRevokeDevice(device.device_id)}
                                            disabled={revokingDeviceId === device.device_id}
                                            className="ml-3 shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                        >
                                            {revokingDeviceId === device.device_id
                                                ? t("revokingDevice")
                                                : t("revokeDevice")}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 同步历史 */}
                    {historyTotal > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4 text-[var(--muted)]" />
                                <label className="text-sm font-medium text-[var(--text)]">
                                    {t("syncHistory")}
                                </label>
                                <span className="text-xs text-[var(--muted)]">
                                    {t("totalRecords", { count: historyTotal })}
                                </span>
                            </div>
                            <div data-testid="sync-history-list" className="max-h-60 space-y-1 overflow-auto">
                                {history.map((entry) => (
                                    <div
                                        key={entry.snapshot_id}
                                        className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                                    >
                                        <span className="text-[var(--muted)]">
                                            {new Date(
                                                entry.created_at,
                                            ).toLocaleString()}
                                        </span>
                                        <span className="text-[var(--text)]">
                                            {t("recordCount", { count: entry.record_count })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {/* 分页导航 */}
                            {Math.ceil(historyTotal / historyPageSize) > 1 && (
                                <div className="flex items-center justify-between pt-1">
                                    <button
                                        onClick={() => refreshHistory(historyPage - 1)}
                                        disabled={historyPage <= 1}
                                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                        {t("prevPage")}
                                    </button>
                                    <span className="text-xs text-[var(--muted)]">
                                        {historyPage} / {Math.ceil(historyTotal / historyPageSize)}
                                    </span>
                                    <button
                                        onClick={() => refreshHistory(historyPage + 1)}
                                        disabled={historyPage >= Math.ceil(historyTotal / historyPageSize)}
                                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {t("nextPage")}
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* 错误提示 */}
            {error && (
                <div data-testid="sync-error" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                </div>
            )}

            {/* 认证模态框 */}
            <LoginModal
                open={authModal === "login"}
                onClose={() => setAuthModal(null)}
                onSwitchToRegister={() => setAuthModal("register")}
                onSwitchToForgotPassword={() => setAuthModal("forgot")}
            />
            <RegisterModal
                open={authModal === "register"}
                onClose={() => setAuthModal(null)}
                onSwitchToLogin={() => setAuthModal("login")}
            />
            <ForgotPasswordModal
                open={authModal === "forgot"}
                onClose={() => setAuthModal(null)}
                onSwitchToLogin={() => setAuthModal("login")}
                onSwitchToResetPassword={(email) => {
                    setResetEmail(email);
                    setAuthModal("reset");
                }}
            />
            <ResetPasswordModal
                open={authModal === "reset"}
                onClose={() => setAuthModal(null)}
                email={resetEmail}
                onSwitchToLogin={() => setAuthModal("login")}
            />

            {/* 冲突解决对话框 */}
            <ConflictResolutionModal
                open={Boolean(pendingConflicts && pendingConflicts.length > 0)}
                onClose={() => {}}
            />
        </div>
    );
}
