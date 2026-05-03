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
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useSyncStore } from "../../stores/syncStore";
import { LoginModal } from "../auth/LoginModal";
import { RegisterModal } from "../auth/RegisterModal";
import { ForgotPasswordModal } from "../auth/ForgotPasswordModal";
import { ResetPasswordModal } from "../auth/ResetPasswordModal";
import { ConflictResolutionModal } from "./ConflictResolutionModal";

type AuthModal = "login" | "register" | "forgot" | "reset" | null;

export function SyncSettingsPanel() {
    const { t } = useTranslation(["sync", "common"]);
    const {
        config,
        state,
        history,
        historyTotal,
        historyPage,
        historyPageSize,
        isLoading,
        error,
        pendingConflicts,
        updateConfig,
        triggerSync,
        logout,
        testConnection,
        refreshHistory,
        clearError,
    } = useSyncStore();

    const [authModal, setAuthModal] = useState<AuthModal>(null);
    const [resetEmail, setResetEmail] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [serverUrlInput, setServerUrlInput] = useState(config.server_url);
    const [testResult, setTestResult] = useState<boolean | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        setServerUrlInput(config.server_url);
    }, [config.server_url]);

    useEffect(() => {
        if (config.access_token) {
            refreshHistory();
        }
    }, [config.access_token, refreshHistory]);

    const isLoggedIn = Boolean(config.access_token && config.user_id);

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
                        type="url"
                        value={serverUrlInput}
                        onChange={(e) => setServerUrlInput(e.target.value)}
                        onBlur={handleServerUrlBlur}
                        placeholder="https://your-server.com"
                        className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                    <button
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
                            onClick={() => setAuthModal("login")}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                        >
                            <LogIn className="h-4 w-4" />
                            {t("login")}
                        </button>
                        <button
                            onClick={() => setAuthModal("register")}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        >
                            <UserPlus className="h-4 w-4" />
                            {t("register")}
                        </button>
                    </div>
                )}
            </div>

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
                            <select
                                value={config.conflict_resolution}
                                onChange={(e) =>
                                    updateConfig({
                                        conflict_resolution: e.target.value,
                                    })
                                }
                                className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-2.5 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            >
                                <option value="auto">{t("conflictAuto")}</option>
                                <option value="local-wins">{t("conflictLocal")}</option>
                                <option value="remote-wins">{t("conflictRemote")}</option>
                                <option value="manual">{t("conflictManual")}</option>
                            </select>
                        </div>
                    </div>

                    {/* 待解决冲突提示 */}
                    {pendingConflicts && pendingConflicts.length > 0 && (
                        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                            {t("pendingConflicts", { count: pendingConflicts.length })}
                        </div>
                    )}

                    {/* 同步状态 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--text)]">
                            {t("syncStatus")}
                        </label>
                        <div className="rounded-xl bg-[var(--field)] px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {isSyncing ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                    ) : state.status === "error" ? (
                                        <CloudOff className="h-4 w-4 text-red-400" />
                                    ) : (
                                        <Cloud className="h-4 w-4 text-[var(--muted)]" />
                                    )}
                                    <span className="text-sm text-[var(--text)]">
                                        {isSyncing
                                            ? `${t("syncing")}${state.progress ? `: ${state.progress.phase}` : ""}`
                                            : state.status === "completed"
                                              ? t("syncCompleted")
                                              : state.status === "error"
                                                ? t("syncError")
                                                : t("idle")}
                                    </span>
                                </div>
                                <button
                                    onClick={handleSync}
                                    disabled={isSyncing || isLoading}
                                    className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                                >
                                    {isSyncing ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    )}
                                    {isSyncing ? t("syncingBtn") : t("syncNow")}
                                </button>
                            </div>
                            {state.progress && isSyncing && (
                                <div className="mt-2">
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
                            <div className="max-h-60 space-y-1 overflow-auto">
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
                <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
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
                onSwitchToResetPassword={(email, token) => {
                    setResetEmail(email);
                    setResetToken(token);
                    setAuthModal("reset");
                }}
            />
            <ResetPasswordModal
                open={authModal === "reset"}
                onClose={() => setAuthModal(null)}
                email={resetEmail}
                resetToken={resetToken}
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
