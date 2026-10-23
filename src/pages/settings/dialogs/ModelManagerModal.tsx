import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Modal } from "../../../components/common/Modal";
import { useToastStore } from "../../../stores/toastStore";
import { getAiModels } from "../../../services/tauriCommands";
import { DangerButton, SecondaryButton, inputClass } from "../ui";

interface ModelManagerModalProps {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  currentModel: string;
  onSelect: (model: string) => void;
}

/** 模型管理对话框：拉取 /v1/models 列表选择/搜索/手动添加/测试连接 */
export function ModelManagerModal({ open, onClose, endpoint, currentModel, onSelect }: ModelManagerModalProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [models, setModels] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [manualModel, setManualModel] = useState("");
  const fetchedRef = useRef(false);

  async function loadModels(silent = false) {
    setLoading(true);
    if (!silent) setError(null);
    try {
      const list = await getAiModels();
      setModels(list);
      setError(null);
    } catch (loadError) {
      setError(String(loadError).replace(/^Error:?\s*/i, ""));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      void loadModels();
    }
    if (!open) fetchedRef.current = false;
  }, [open]);

  async function handleTest() {
    setTesting(true);
    try {
      await getAiModels();
      useToastStore.getState().addToast("success", t("settings:ai.testSuccess"));
    } catch (testError) {
      useToastStore.getState().addToast("error", String(testError).replace(/^Error:?\s*/i, ""));
    } finally {
      setTesting(false);
    }
  }

  const filtered = (models ?? []).filter((model) => model.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Modal open={open} onClose={onClose} title={t("settings:ai.modelManagerTitle")} maxWidth="max-w-lg">
      <div className="space-y-3" data-testid="model-manager-modal">
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          {t("settings:ai.modelManagerDesc")}
          {endpoint && <span className="mt-1 block break-all">{endpoint}</span>}
        </p>

        <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            value={search}
            placeholder={t("settings:ai.modelSearchPlaceholder")}
            data-testid="model-manager-search"
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <button
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            type="button"
            aria-label={t("settings:ai.modelRefresh")}
            title={t("settings:ai.modelRefresh")}
            onClick={() => { setModels(null); fetchedRef.current = true; void loadModels(); }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && (
          <p className="flex items-center gap-2 py-4 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />{t("settings:ai.modelLoading")}
          </p>
        )}

        {error && !loading && (
          <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--danger)]" data-testid="model-manager-error">
            {error}
          </p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="py-2 text-sm text-[var(--muted)]">{t("settings:ai.modelEmpty")}</p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="max-h-56 divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-[var(--line)]">
            {filtered.map((model) => (
              <button
                key={model}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--hover)] ${model === currentModel ? "text-[var(--accent)]" : "text-[var(--text)]"}`}
                type="button"
                data-testid="model-manager-item"
                onClick={() => { onSelect(model); onClose(); }}
              >
                <span className="min-w-0 truncate">{model}</span>
                {model === currentModel && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-[var(--line)] pt-3">
          <input
            className={inputClass}
            value={manualModel}
            placeholder={t("settings:ai.modelManualPlaceholder")}
            data-testid="model-manager-manual-input"
            onChange={(event) => setManualModel(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && manualModel.trim()) {
                onSelect(manualModel.trim());
                onClose();
              }
            }}
          />
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            type="button"
            data-testid="model-manager-manual-use-btn"
            disabled={!manualModel.trim()}
            onClick={() => {
              onSelect(manualModel.trim());
              onClose();
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("settings:ai.modelUse")}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <SecondaryButton onClick={() => void handleTest()} disabled={testing} data-testid="model-manager-test-btn">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("settings:ai.testConnection")}
          </SecondaryButton>
          <DangerButton onClick={onClose}>{t("common:buttons.close")}</DangerButton>
        </div>
      </div>
    </Modal>
  );
}
