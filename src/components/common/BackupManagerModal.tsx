import { useEffect } from "react";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { useSettingsStore } from "../../stores/settingsStore";

function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

interface BackupManagerModalProps {
    open: boolean;
    onClose: () => void;
}

export function BackupManagerModal({ open, onClose }: BackupManagerModalProps) {
    const { t } = useTranslation(["modals"]);
    const backupFiles = useSettingsStore((s) => s.backupFiles);
    const fetchBackups = useSettingsStore((s) => s.fetchBackups);
    const deleteBackup = useSettingsStore((s) => s.deleteBackup);
    const verifyBackup = useSettingsStore((s) => s.verifyBackup);
    const [checkingFilename, setCheckingFilename] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            fetchBackups();
        }
    }, [open, fetchBackups]);

    async function handleVerify(filename: string) {
        setCheckingFilename(filename);
        try {
            await verifyBackup(filename);
        } catch {
            // Store 层负责显示具体的 IPC 错误提示。
        } finally {
            setCheckingFilename(null);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={t("modals:backupManager.title")} maxWidth="max-w-lg">
            <div data-testid="backup-manager-modal" className="space-y-3">
                {backupFiles.length === 0 ? (
                    <p data-testid="backup-empty" className="py-8 text-center text-sm text-[var(--muted)]">
                        {t("modals:backupManager.noBackups")}
                    </p>
                ) : (
                    <div data-testid="backup-list" className="max-h-80 space-y-1 overflow-auto">
                        {backupFiles.map((file) => (
                            <div
                                key={file.filename}
                                data-testid="backup-item"
                                className="group flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3 hover:bg-[var(--hover)]"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm text-[var(--text)]">
                                        {file.filename}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--muted)]">
                                        <span data-testid="backup-type">
                                            {file.backup_type === "manual"
                                                ? t("modals:backupManager.manual")
                                                : t("modals:backupManager.automatic")}
                                        </span>
                                        <span>{formatSize(file.size)}</span>
                                        <span>{file.created_at}</span>
                                    </div>
                                    <div
                                        className={`mt-1 inline-flex items-center gap-1 text-xs ${file.verified ? "text-emerald-400" : "text-amber-400"}`}
                                        data-testid="backup-verification-status"
                                    >
                                        {file.verified ? (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                        ) : (
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                        )}
                                        {file.verified
                                            ? t("modals:backupManager.verified")
                                            : t("modals:backupManager.invalid")}
                                    </div>
                                    {!file.verified && file.verification_error && (
                                        <div
                                            className="mt-1 break-all text-xs text-amber-400/80"
                                            data-testid="backup-verification-error"
                                        >
                                            {file.verification_error}
                                        </div>
                                    )}
                                </div>
                                <button
                                    data-testid="backup-verify-btn"
                                    className="shrink-0 rounded-full p-2 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                                    type="button"
                                    title={t("modals:backupManager.verifyBackup")}
                                    disabled={checkingFilename !== null}
                                    onClick={() => void handleVerify(file.filename)}
                                >
                                    <RefreshCw className={`h-4 w-4 ${checkingFilename === file.filename ? "animate-spin" : ""}`} />
                                </button>
                                <button
                                    data-testid="backup-delete-btn"
                                    className="shrink-0 rounded-full p-2 text-[var(--muted)] opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                                    type="button"
                                    title={t("modals:backupManager.deleteBackup")}
                                    onClick={() => deleteBackup(file.filename)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        data-testid="backup-close-btn"
                        className="rounded-full px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                        type="button"
                        onClick={onClose}
                    >
                        {t("modals:backupManager.close")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
