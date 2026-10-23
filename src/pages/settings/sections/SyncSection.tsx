import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud } from "lucide-react";
import { SyncSettingsPanel } from "../../../components/sync/SyncSettingsPanel";
import { useSettingsStore } from "../../../stores/settingsStore";
import type { RemoteBackupConfig } from "../../../services/tauriCommands";
import { WebdavConfigModal } from "../dialogs/WebdavConfigModal";
import { SettingsBadge, SettingsGroup, SettingsHeader, SettingsRow, SettingsToggle, SecondaryButton } from "../ui";

const DEFAULT_REMOTE_BACKUP: RemoteBackupConfig = {
    enabled: false,
    endpoint: "",
    remote_path: "quantanote/backups",
    username: "",
    password_configured: false,
    last_upload_at: null,
    last_upload_filename: null,
    last_upload_error: null,
};

export function SyncSection() {
    const { t } = useTranslation(["settings", "common"]);
    const autoBackupConfig = useSettingsStore((s) => s.autoBackupConfig);
    const updateAutoBackupConfig = useSettingsStore((s) => s.updateAutoBackupConfig);
    const saveRemoteBackupPassword = useSettingsStore((s) => s.saveRemoteBackupPassword);
    const clearRemoteBackupPassword = useSettingsStore((s) => s.clearRemoteBackupPassword);
    const testRemoteBackup = useSettingsStore((s) => s.testRemoteBackup);

    const [remoteDraft, setRemoteDraft] = useState<RemoteBackupConfig>(DEFAULT_REMOTE_BACKUP);
    const [webdavOpen, setWebdavOpen] = useState(false);
    const [remoteTesting, setRemoteTesting] = useState(false);

    useEffect(() => {
        if (autoBackupConfig?.remote) {
            setRemoteDraft(autoBackupConfig.remote);
        }
    }, [autoBackupConfig?.remote]);

    function updateRemoteDraft(updates: Partial<RemoteBackupConfig>) {
        setRemoteDraft((current) => ({ ...current, ...updates }));
    }

    function saveRemoteConfig() {
        if (!autoBackupConfig) return;
        void updateAutoBackupConfig({ ...autoBackupConfig, remote: remoteDraft });
    }

    async function handleRemotePasswordSave(password: string) {
        await saveRemoteBackupPassword(password);
    }

    async function handleRemoteTest() {
        setRemoteTesting(true);
        try {
            await testRemoteBackup();
        } finally {
            setRemoteTesting(false);
        }
    }

    return (
        <>
            <SettingsHeader icon={<Cloud className="h-4.5 w-4.5" />} title={t("settings:data.syncTitle")} description={t("settings:sync.description")} />

            <SettingsGroup testId="remote-backup-settings" title={t("settings:data.remoteBackup")}>
                <SettingsRow label={t("settings:data.enableRemoteBackup")} desc={t("settings:data.remoteBackupDesc")}>
                    <SettingsToggle
                        value={remoteDraft.enabled}
                        onChange={(value) => {
                            updateRemoteDraft({ enabled: value });
                            if (autoBackupConfig) {
                                void updateAutoBackupConfig({ ...autoBackupConfig, remote: { ...remoteDraft, enabled: value } });
                            }
                        }}
                        testId="remote-backup-toggle"
                    />
                </SettingsRow>
                {remoteDraft.enabled && (
                    <SettingsRow
                        label={t("settings:data.webdavStatus")}
                        desc={
                            <span className="break-all">
                                {remoteDraft.last_upload_at
                                    ? `${t("settings:data.remoteBackupLastUpload")}：${new Date(remoteDraft.last_upload_at).toLocaleString()}`
                                    : t("settings:data.remoteBackupNeverUploaded")}
                                {remoteDraft.last_upload_filename && <span className="ml-1">{remoteDraft.last_upload_filename}</span>}
                            </span>
                        }
                    >
                        <div className="flex items-center gap-2">
                            <SettingsBadge tone={remoteDraft.password_configured ? "ok" : "warn"}>
                                {remoteDraft.password_configured ? t("settings:data.webdavPasswordConfigured") : t("settings:data.webdavPasswordPlaceholder")}
                            </SettingsBadge>
                            <SecondaryButton data-testid="remote-backup-config-btn" onClick={() => setWebdavOpen(true)}>
                                {t("settings:data.webdavConfig")}
                            </SecondaryButton>
                        </div>
                    </SettingsRow>
                )}
                {remoteDraft.enabled && remoteDraft.last_upload_error && (
                    <div className="mx-4 my-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300" data-testid="remote-backup-last-error">
                        <div className="font-medium">{t("settings:data.remoteBackupLastError")}</div>
                        <div className="mt-1 break-all">{remoteDraft.last_upload_error}</div>
                    </div>
                )}
            </SettingsGroup>

            <WebdavConfigModal
                open={webdavOpen}
                onClose={() => setWebdavOpen(false)}
                draft={remoteDraft}
                onDraftChange={updateRemoteDraft}
                onSaveConfig={saveRemoteConfig}
                onSavePassword={handleRemotePasswordSave}
                onTest={handleRemoteTest}
                onClearPassword={() => void clearRemoteBackupPassword()}
                testing={remoteTesting}
            />

            <SyncSettingsPanel showAccount={false} />
        </>
    );
}
