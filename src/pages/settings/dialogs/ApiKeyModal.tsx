import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { Modal } from "../../../components/common/Modal";
import { SettingsBadge, inputClass } from "../ui";

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  configured: boolean;
  onSave: (apiKey: string) => Promise<boolean>;
  onClear: () => Promise<boolean>;
}

/** API 密钥对话框：输入/保存/清除 + 配置状态徽章 */
export function ApiKeyModal({ open, onClose, configured, onSave, onClear }: ApiKeyModalProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  async function handleSave() {
    if (!password) return;
    setSaving(true);
    try {
      const saved = await onSave(password);
      if (saved) setPassword("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("settings:ai.apiKeyTitle")} maxWidth="max-w-md">
      <div className="space-y-3" data-testid="api-key-modal">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text)]">
            <KeyRound className="h-4 w-4 text-[var(--muted)]" />
            {t("settings:ai.apiKeyStatus")}
          </span>
          <SettingsBadge tone={configured ? "ok" : "neutral"}>
            {configured ? t("settings:ai.apiKeyConfigured") : t("settings:ai.apiKeyNotConfigured")}
          </SettingsBadge>
        </div>

        <label className="block text-xs text-[var(--muted)]">
          {t("settings:data.aiApiKey")}
          <input
            className={`${inputClass} mt-1`}
            data-testid="ai-summary-api-key"
            type="password"
            value={password}
            placeholder={t("settings:data.aiApiKeyPlaceholder")}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </label>

        <p className="text-[11px] leading-relaxed text-[var(--muted)]">{t("settings:ai.apiKeyHint")}</p>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          {configured ? (
            <button
              className="rounded-full px-3 py-1.5 text-xs text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
              type="button"
              data-testid="ai-summary-clear-key-btn"
              onClick={() => void onClear()}
            >
              {t("settings:data.clearAiApiKey")}
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              type="button"
              onClick={onClose}
            >
              {t("common:buttons.close")}
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              data-testid="ai-summary-save-key-btn"
              disabled={!password || saving}
              onClick={() => void handleSave()}
            >
              {t("settings:data.saveAiApiKey")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
