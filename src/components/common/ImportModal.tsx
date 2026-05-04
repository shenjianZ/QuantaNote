import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { useSettingsStore } from "../../stores/settingsStore";
import type { ImportOptions } from "../../services/tauriCommands";

interface ImportModalProps {
    open: boolean;
    onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
    const { t } = useTranslation(["modals", "common"]);
    const importDataWithOptions = useSettingsStore((s) => s.importDataWithOptions);

    const [options, setOptions] = useState<ImportOptions>({
        includeTags: true,
        includeAttachments: true,
        includeVersions: true,
        overwrite: false,
    });

    useEffect(() => {
        if (open) {
            setOptions({
                includeTags: true,
                includeAttachments: true,
                includeVersions: true,
                overwrite: false,
            });
        }
    }, [open]);

    async function handleImport() {
        await importDataWithOptions(options);
        onClose();
    }

    return (
        <Modal open={open} onClose={onClose} title={t("modals:import.title")}>
            <div data-testid="import-modal" className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                    {t("modals:import.desc")}
                </p>

                <div className="space-y-3">
                    <label className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3 hover:bg-[var(--hover)]">
                        <input
                            data-testid="import-include-tags"
                            type="checkbox"
                            checked={options.includeTags}
                            onChange={(e) => setOptions({ ...options, includeTags: e.target.checked })}
                            className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">{t("modals:import.includeTags")}</div>
                            <div className="text-xs text-[var(--muted)]">{t("modals:import.tagsDesc")}</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3 hover:bg-[var(--hover)]">
                        <input
                            data-testid="import-include-attachments"
                            type="checkbox"
                            checked={options.includeAttachments}
                            onChange={(e) => setOptions({ ...options, includeAttachments: e.target.checked })}
                            className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">{t("modals:import.includeAttachments")}</div>
                            <div className="text-xs text-[var(--muted)]">{t("modals:import.attachmentsDesc")}</div>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3 hover:bg-[var(--hover)]">
                        <input
                            data-testid="import-include-versions"
                            type="checkbox"
                            checked={options.includeVersions}
                            onChange={(e) => setOptions({ ...options, includeVersions: e.target.checked })}
                            className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">{t("modals:import.includeVersions")}</div>
                            <div className="text-xs text-[var(--muted)]">{t("modals:import.versionsDesc")}</div>
                        </div>
                    </label>
                </div>

                <div className="rounded-xl bg-[var(--field)] px-4 py-3">
                    <div className="mb-2 text-sm font-medium text-[var(--text)]">{t("modals:import.conflict")}</div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-3">
                            <input
                                data-testid="import-conflict-skip"
                                type="radio"
                                name="conflict"
                                checked={!options.overwrite}
                                onChange={() => setOptions({ ...options, overwrite: false })}
                                className="accent-[var(--accent)]"
                            />
                            <div>
                                <div className="text-sm text-[var(--text)]">{t("modals:import.skipExisting")}</div>
                                <div className="text-xs text-[var(--muted)]">{t("modals:import.skipDesc")}</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                data-testid="import-conflict-overwrite"
                                type="radio"
                                name="conflict"
                                checked={options.overwrite}
                                onChange={() => setOptions({ ...options, overwrite: true })}
                                className="accent-[var(--accent)]"
                            />
                            <div>
                                <div className="text-sm text-[var(--text)]">{t("modals:import.overwrite")}</div>
                                <div className="text-xs text-[var(--muted)]">{t("modals:import.overwriteDesc")}</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        data-testid="import-cancel-btn"
                        className="rounded-full px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                        type="button"
                        onClick={onClose}
                    >
                        {t("common:buttons.cancel")}
                    </button>
                    <button
                        data-testid="import-btn"
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
                        type="button"
                        onClick={handleImport}
                    >
                        <Upload className="h-4 w-4" />
                        {t("modals:import.importBtn")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
