import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Database, Download, FileText, RefreshCw, Settings2, Trash2, Upload } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { BackupManagerModal } from "../../../components/common/BackupManagerModal";
import { ExportModal } from "../../../components/common/ExportModal";
import { ImportModal } from "../../../components/common/ImportModal";
import { Select } from "../../../components/common/Select";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useToastStore } from "../../../stores/toastStore";
import { copyTextToSystemClipboard } from "../../../utils/clipboard";
import { SettingsGroup, SettingsHeader, SettingsRow, SettingsToggle, PrimaryButton, SecondaryButton, DangerButton } from "../ui";

function formatStorageBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function StorageIssueDetails({
    title,
    issues,
    testId,
}: {
    title: string;
    issues: readonly { path: string; reason: string }[];
    testId: string;
}) {
    if (issues.length === 0) return null;
    return (
        <details className="mx-4 my-2 rounded-xl bg-[var(--field)] px-3 py-2" data-testid={testId}>
            <summary className="cursor-pointer text-xs font-medium text-[var(--text)]">
                {title} ({issues.length})
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs text-[var(--muted)]">
                {issues.map((issue) => (
                    <li className="break-all" key={`${issue.path}-${issue.reason}`}>
                        <code className="text-[var(--text)]">{issue.path}</code>
                        <span className="ml-2">{issue.reason}</span>
                    </li>
                ))}
            </ul>
        </details>
    );
}

export function DataSection() {
    const { t } = useTranslation(["settings", "common"]);
    const settings = useSettingsStore((s) => s.settings);
    const updateSqlLogging = useSettingsStore((s) => s.updateSqlLogging);
    const dbSize = useSettingsStore((s) => s.dbSize);
    const dbPath = useSettingsStore((s) => s.dbPath);
    const autoBackupConfig = useSettingsStore((s) => s.autoBackupConfig);
    const backupDirPath = useSettingsStore((s) => s.backupDirPath);
    const logDir = useSettingsStore((s) => s.logDir);
    const sqlLogPath = useSettingsStore((s) => s.sqlLogPath);
    const storageReport = useSettingsStore((s) => s.storageReport);
    const storageScanLoading = useSettingsStore((s) => s.storageScanLoading);
    const refreshDbSize = useSettingsStore((s) => s.refreshDbSize);
    const optimizeDb = useSettingsStore((s) => s.optimizeDb);
    const updateAutoBackupConfig = useSettingsStore((s) => s.updateAutoBackupConfig);
    const triggerBackupNow = useSettingsStore((s) => s.triggerBackupNow);
    const fetchStorageConsistency = useSettingsStore((s) => s.fetchStorageConsistency);
    const repairStorageConsistency = useSettingsStore((s) => s.repairStorageConsistency);
    const clearSqlLogFile = useSettingsStore((s) => s.clearSqlLogFile);

    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [backupManagerOpen, setBackupManagerOpen] = useState(false);

    async function copyPath(path: string) {
        try {
            await copyTextToSystemClipboard(path);
            useToastStore.getState().addToast("success", t("common:toast.pathCopied"));
        } catch {
            useToastStore.getState().addToast("error", t("common:toast.copyFailed"));
        }
    }

    async function handleOpenLogDir() {
        if (!logDir) return;
        try {
            await openPath(logDir);
        } catch {
            await copyPath(logDir);
        }
    }

    return (
        <>
            <SettingsHeader icon={<Database className="h-4.5 w-4.5" />} title={t("settings:menu.data")} description={t("settings:data.description")} />

            <SettingsGroup title={t("settings:data.autoBackup")}>
                <SettingsRow label={t("settings:data.enableAutoBackup")} desc={t("settings:data.enableAutoBackupDesc")}>
                    <SettingsToggle
                        value={autoBackupConfig?.enabled ?? false}
                        onChange={(v) => {
                            if (autoBackupConfig) updateAutoBackupConfig({ ...autoBackupConfig, enabled: v });
                        }}
                    />
                </SettingsRow>
                {autoBackupConfig?.enabled && (
                    <>
                        <SettingsRow label={t("settings:data.backupInterval")}>
                            <div className="flex items-center gap-1.5">
                                <Select
                                    className="w-24"
                                    options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                                    value={String(autoBackupConfig.interval_days)}
                                    onChange={(v) => updateAutoBackupConfig({ ...autoBackupConfig, interval_days: Number(v) })}
                                />
                                <span className="text-xs text-[var(--muted)]">{t("settings:data.days")}</span>
                            </div>
                        </SettingsRow>
                        <SettingsRow label={t("settings:data.maxBackups")}>
                            <div className="flex items-center gap-1.5">
                                <Select
                                    className="w-24"
                                    options={[5, 10, 20, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
                                    value={String(autoBackupConfig.max_backups)}
                                    onChange={(v) => updateAutoBackupConfig({ ...autoBackupConfig, max_backups: Number(v) })}
                                />
                                <span className="text-xs text-[var(--muted)]">{t("settings:data.backupsUnit")}</span>
                            </div>
                        </SettingsRow>
                        <SettingsRow label={t("settings:data.expireDays")}>
                            <div className="flex items-center gap-1.5">
                                <Select
                                    className="w-24"
                                    options={[30, 60, 90, 180, 365].map((n) => ({ value: String(n), label: String(n) }))}
                                    value={String(autoBackupConfig.expire_days)}
                                    onChange={(v) => updateAutoBackupConfig({ ...autoBackupConfig, expire_days: Number(v) })}
                                />
                                <span className="text-xs text-[var(--muted)]">{t("settings:data.days")}</span>
                            </div>
                        </SettingsRow>
                    </>
                )}
                <SettingsRow label={t("settings:data.backupDir")}>
                    <span className="max-w-[60%] truncate text-sm text-[var(--muted)]">{backupDirPath || t("common:buttons.loading")}</span>
                </SettingsRow>
                <SettingsRow label={t("settings:data.lastSuccessfulBackup")} testId="backup-last-success">
                    <span className="max-w-[65%] text-right text-sm text-[var(--muted)]">
                        {autoBackupConfig?.last_backup_at ? (
                            <>
                                <span>{new Date(autoBackupConfig.last_backup_at).toLocaleString()}</span>
                                {autoBackupConfig.last_backup_filename && (
                                    <span className="ml-2 break-all text-xs">
                                        {autoBackupConfig.last_backup_filename}
                                        {autoBackupConfig.last_backup_size != null && <> · {formatStorageBytes(autoBackupConfig.last_backup_size)}</>}
                                    </span>
                                )}
                            </>
                        ) : t("settings:data.neverBackup")}
                    </span>
                </SettingsRow>
                {autoBackupConfig?.last_backup_error && (
                    <div className="mx-4 my-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300" data-testid="backup-last-error">
                        <div className="font-medium">{t("settings:data.lastBackupError")}</div>
                        <div className="mt-1 break-all text-amber-200/80">{autoBackupConfig.last_backup_error}</div>
                    </div>
                )}
                <SettingsRow label={t("settings:data.backupActions", { defaultValue: t("settings:data.backupManager") })}>
                    <PrimaryButton data-testid="settings-backup-now-btn" onClick={() => triggerBackupNow()}>
                        {t("settings:data.backupNow")}
                    </PrimaryButton>
                    <SecondaryButton data-testid="settings-backup-manager-btn" onClick={() => setBackupManagerOpen(true)}>
                        <Settings2 className="h-3.5 w-3.5" />
                        {t("settings:data.backupManager")}
                    </SecondaryButton>
                </SettingsRow>
            </SettingsGroup>

            <BackupManagerModal open={backupManagerOpen} onClose={() => setBackupManagerOpen(false)} />

            <SettingsGroup title={t("settings:data.importExport")}>
                <SettingsRow label={t("settings:data.importExportDesc")}>
                    <SecondaryButton onClick={() => setExportModalOpen(true)}>
                        <Download className="h-3.5 w-3.5" />
                        {t("settings:data.export")}
                    </SecondaryButton>
                    <SecondaryButton onClick={() => setImportModalOpen(true)}>
                        <Upload className="h-3.5 w-3.5" />
                        {t("settings:data.import")}
                    </SecondaryButton>
                </SettingsRow>
            </SettingsGroup>

            <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
            <ImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />

            <SettingsGroup title={t("settings:data.database")}>
                <SettingsRow label={t("settings:data.dbSize")}>
                    <span className="block text-right text-sm text-[var(--muted)]">{dbSize}</span>
                </SettingsRow>
                <SettingsRow label={t("settings:data.dbPath")}>
                    <button
                        className="max-w-[60%] truncate rounded-full bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
                        type="button"
                        title={dbPath}
                        onClick={() => { void copyPath(dbPath); void refreshDbSize(); }}
                    >
                        {dbPath || t("common:buttons.loading")}
                    </button>
                </SettingsRow>
                <SettingsRow label={t("settings:data.optimize")} desc={t("settings:data.optimizeDesc")}>
                    <SecondaryButton data-testid="optimize-db-btn" onClick={() => optimizeDb()}>
                        {t("settings:data.optimizeBtn")}
                    </SecondaryButton>
                </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title={t("settings:data.storageConsistency")} testId="storage-consistency-section">
                <SettingsRow label={t("settings:data.storageConsistency")} desc={t("settings:data.storageConsistencyDesc")}>
                    <SecondaryButton data-testid="storage-consistency-scan-btn" disabled={storageScanLoading} onClick={() => void fetchStorageConsistency(true)}>
                        <RefreshCw className={`h-3.5 w-3.5 ${storageScanLoading ? "animate-spin" : ""}`} />
                        {t("settings:data.storageScan")}
                    </SecondaryButton>
                </SettingsRow>
                {storageReport ? (
                    <>
                        <SettingsRow label={t("settings:data.storageMissingFiles")}>
                            <span className="text-sm text-[var(--muted)]" data-testid="storage-missing-count">{storageReport.missingFiles.length}</span>
                        </SettingsRow>
                        <SettingsRow label={t("settings:data.storageOrphanFiles")}>
                            <span className="text-sm text-[var(--muted)]" data-testid="storage-orphan-count">{storageReport.orphanFiles.length}</span>
                        </SettingsRow>
                        <SettingsRow label={t("settings:data.storageBrokenReferences")}>
                            <span className="text-sm text-[var(--muted)]" data-testid="storage-broken-reference-count">{storageReport.brokenReferences.length}</span>
                        </SettingsRow>
                        <SettingsRow label={t("settings:data.storageUsage")}>
                            <span className="text-sm text-[var(--muted)]">
                                {formatStorageBytes(storageReport.storageBytes)} · {t("settings:data.storageScannedFiles", { count: storageReport.scannedFiles })}
                            </span>
                        </SettingsRow>
                        <StorageIssueDetails title={t("settings:data.storageMissingFiles")} issues={storageReport.missingFiles} testId="storage-missing-details" />
                        <StorageIssueDetails title={t("settings:data.storageOrphanFiles")} issues={storageReport.orphanFiles} testId="storage-orphan-details" />
                        <StorageIssueDetails title={t("settings:data.storageBrokenReferences")} issues={storageReport.brokenReferences} testId="storage-broken-reference-details" />
                        {storageReport.orphanFiles.length > 0 && (
                            <SettingsRow label={t("settings:data.storageRepairDesc")}>
                                <DangerButton
                                    data-testid="storage-consistency-repair-btn"
                                    disabled={storageScanLoading}
                                    onClick={() => {
                                        if (window.confirm(t("settings:data.storageRepairConfirm"))) {
                                            void repairStorageConsistency();
                                        }
                                    }}
                                >
                                    {t("settings:data.storageRepair")}
                                </DangerButton>
                            </SettingsRow>
                        )}
                    </>
                ) : (
                    <p className="px-4 py-3 text-sm text-[var(--muted)]">
                        {storageScanLoading ? t("settings:data.storageScanning") : t("settings:data.storageUnavailable")}
                    </p>
                )}
            </SettingsGroup>

            <SettingsGroup title={t("settings:data.diagnostics")}>
                <SettingsRow label={t("settings:data.sqlLog")} desc={t("settings:data.sqlLogDesc")}>
                    <SettingsToggle value={settings.sqlLogging.enabled} onChange={(v) => updateSqlLogging({ enabled: v })} />
                </SettingsRow>
                <SettingsRow label={t("settings:data.outputToConsole")}>
                    <SettingsToggle value={settings.sqlLogging.toConsole} onChange={(v) => updateSqlLogging({ toConsole: v })} />
                </SettingsRow>
                <SettingsRow label={t("settings:data.outputToFile")}>
                    <SettingsToggle value={settings.sqlLogging.toFile} onChange={(v) => updateSqlLogging({ toFile: v })} />
                </SettingsRow>
                <SettingsRow label={t("settings:data.formatSql")}>
                    <SettingsToggle value={settings.sqlLogging.pretty} onChange={(v) => updateSqlLogging({ pretty: v })} />
                </SettingsRow>
                <SettingsRow label={t("settings:data.maxLen")}>
                    <Select
                        className="w-28"
                        options={[
                            { value: "1000", label: "1,000" },
                            { value: "4000", label: "4,000" },
                            { value: "10000", label: "10,000" },
                            { value: "50000", label: "50,000" },
                        ]}
                        value={String(settings.sqlLogging.maxLen)}
                        onChange={(v) => updateSqlLogging({ maxLen: Number(v) })}
                    />
                </SettingsRow>
                <SettingsRow label={t("settings:data.sqlLogFile")}>
                    <button
                        className="max-w-[60%] truncate rounded-full bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
                        type="button"
                        title={sqlLogPath}
                        onClick={async () => {
                            try {
                                await copyTextToSystemClipboard(sqlLogPath);
                                useToastStore.getState().addToast("success", t("common:toast.sqlLogPathCopied"));
                            } catch {
                                useToastStore.getState().addToast("error", t("common:toast.copyFailed"));
                            }
                        }}
                    >
                        {sqlLogPath || t("common:buttons.loading")}
                    </button>
                </SettingsRow>
                <SettingsRow label={t("settings:data.logActions", { defaultValue: t("settings:data.diagnostics") })}>
                    <SecondaryButton onClick={() => void handleOpenLogDir()}>
                        <FileText className="h-3.5 w-3.5" />
                        {t("settings:data.openLogDir")}
                    </SecondaryButton>
                    <SecondaryButton data-testid="settings-clear-sql-log-btn" onClick={() => clearSqlLogFile()}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("settings:data.clearSqlLog")}
                    </SecondaryButton>
                </SettingsRow>
            </SettingsGroup>
        </>
    );
}
