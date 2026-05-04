import { useEffect } from "react";
import { Trash2 } from "lucide-react";
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

    useEffect(() => {
        if (open) {
            fetchBackups();
        }
    }, [open, fetchBackups]);

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
                                        <span>{formatSize(file.size)}</span>
                                        <span>{file.created_at}</span>
                                    </div>
                                </div>
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
