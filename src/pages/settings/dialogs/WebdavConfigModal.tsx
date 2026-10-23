import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Modal } from "../../../components/common/Modal";
import { SettingsBadge, inputClass } from "../ui";
import type { RemoteBackupConfig } from "../../../services/tauriCommands";

interface WebdavConfigModalProps {
  open: boolean;
  onClose: () => void;
  draft: RemoteBackupConfig;
  onDraftChange: (updates: Partial<RemoteBackupConfig>) => void;
  onSaveConfig: () => void;
  onSavePassword: (password: string) => Promise<void>;
  onTest: () => Promise<void>;
  onClearPassword: () => void;
  testing: boolean;
}

/** WebDAV 远程备份配置对话框 */
export function WebdavConfigModal({
  open, onClose, draft, onDraftChange, onSaveConfig, onSavePassword, onTest, onClearPassword, testing,
}: WebdavConfigModalProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  async function handleSavePassword() {
    if (!password) return;
    setSavingPassword(true);
    try {
      await onSavePassword(password);
      setPassword("");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("settings:data.remoteBackup")} maxWidth="max-w-lg">
      <div className="space-y-3" data-testid="webdav-config-modal">
        <p className="text-xs leading-relaxed text-[var(--muted)]">{t("settings:data.remoteBackupDesc")}</p>

        <label className="block text-xs text-[var(--muted)]">
          {t("settings:data.webdavEndpoint")}
          <input
            className={`${inputClass} mt-1`}
            data-testid="remote-backup-endpoint"
            type="url"
            value={draft.endpoint}
            onChange={(event) => onDraftChange({ endpoint: event.target.value })}
            placeholder="https://dav.example.com/remote.php/dav/files/user"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--muted)]">
            {t("settings:data.webdavPath")}
            <input
              className={`${inputClass} mt-1`}
              data-testid="remote-backup-path"
              value={draft.remote_path}
              onChange={(event) => onDraftChange({ remote_path: event.target.value })}
              placeholder="quantanote/backups"
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            {t("settings:data.webdavUsername")}
            <input
              className={`${inputClass} mt-1`}
              data-testid="remote-backup-username"
              value={draft.username}
              onChange={(event) => onDraftChange({ username: event.target.value })}
            />
          </label>
        </div>
        <label className="block text-xs text-[var(--muted)]">
          {t("settings:data.webdavPassword")}
          <input
            className={`${inputClass} mt-1`}
            data-testid="remote-backup-password"
            type="password"
            value={password}
            placeholder={t("settings:data.webdavPasswordPlaceholder")}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--muted)]">
            {draft.last_upload_at
              ? `${t("settings:data.remoteBackupLastUpload")}：${new Date(draft.last_upload_at).toLocaleString()}`
              : t("settings:data.remoteBackupNeverUploaded")}
            {draft.last_upload_filename && <span className="ml-2 break-all">{draft.last_upload_filename}</span>}
          </span>
          <SettingsBadge tone={draft.password_configured ? "ok" : "neutral"}>
            {draft.password_configured ? t("settings:data.webdavPasswordConfigured") : t("settings:data.webdavPasswordPlaceholder")}
          </SettingsBadge>
        </div>

        {draft.last_upload_error && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300" data-testid="remote-backup-last-error">
            <div className="font-medium">{t("settings:data.remoteBackupLastError")}</div>
            <div className="mt-1 break-all">{draft.last_upload_error}</div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {draft.password_configured && (
              <button
                className="rounded-full px-3 py-1.5 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
                type="button"
                data-testid="remote-backup-clear-password-btn"
                onClick={onClearPassword}
              >
                {t("settings:data.clearWebdavPassword")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
              type="button"
              data-testid="remote-backup-test-btn"
              disabled={testing}
              onClick={() => void onTest()}
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("settings:data.testWebdav")}
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
              type="button"
              data-testid="remote-backup-save-password-btn"
              disabled={!password || savingPassword}
              onClick={() => void handleSavePassword()}
            >
              {t("settings:data.saveWebdavPassword")}
            </button>
            <button
              className="inline-flex items-center rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              type="button"
              data-testid="remote-backup-save-config-btn"
              onClick={() => onSaveConfig()}
            >
              {t("settings:data.saveWebdavConfig")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
