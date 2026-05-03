import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";
import { useSettingsStore } from "../../stores/settingsStore";
import type { ExportOptions } from "../../services/tauriCommands";

function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

interface ExportModalProps {
    open: boolean;
    onClose: () => void;
}

export function ExportModal({ open, onClose }: ExportModalProps) {
    const { t } = useTranslation(["modals", "common"]);
    const exportSizeEstimate = useSettingsStore((s) => s.exportSizeEstimate);
    const fetchExportSizeEstimate = useSettingsStore((s) => s.fetchExportSizeEstimate);
    const exportDataWithOptions = useSettingsStore((s) => s.exportDataWithOptions);

    const [options, setOptions] = useState<ExportOptions>({
        includeTags: true,
        includeAttachments: true,
        includeVersions: true,
    });

    useEffect(() => {
        if (open) {
            fetchExportSizeEstimate();
            setOptions({
                includeTags: true,
                includeAttachments: true,
                includeVersions: true,
            });
        }
    }, [open, fetchExportSizeEstimate]);

    const estimatedSize = exportSizeEstimate
        ? exportSizeEstimate.items_json +
          (options.includeTags ? exportSizeEstimate.tags_json : 0) +
          (options.includeAttachments ? exportSizeEstimate.attachments : 0) +
          (options.includeVersions ? exportSizeEstimate.versions_json : 0)
        : 0;

    async function handleExport() {
        await exportDataWithOptions(options);
        onClose();
    }

    return (
        <Modal open={open} onClose={onClose} title={t("modals:export.title")}>
            <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                    {t("modals:export.desc")}
                </p>

                <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3">
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">{t("modals:export.notes")}</div>
                            <div className="text-xs text-[var(--muted)]">{t("modals:export.notesDesc")}</div>
                        </div>
                        {exportSizeEstimate && (
                            <span className="text-xs text-[var(--muted)]">
                                {formatSize(exportSizeEstimate.items_json)}
                            </span>
                        )}
                    </div>

                    <label className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3 hover:bg-[var(--hover)]">
                        <input
                            type="checkbox"
                            checked={options.includeTags}
                            onChange={(e) => setOptions({ ...options, includeTags: e.target.checked })}
                            className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">{t("modals:export.includeTags")}</div>
                            <div className="text-xs text-[var(--muted)]">{t("modals:export.tagsDesc")}</div>
                        </div>
                        {exportSizeEstimate && (
                            <span className="text-xs text-[var(--muted)]">
                                {formatSize(exportSizeEstimate.tags_json)}
                            </span>
                        )}
                    </label>

                    <label className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3 hover:bg-[var(--hover)]">
                        <input
                            type="checkbox"
                            checked={options.includeAttachments}
                            onChange={(e) => setOptions({ ...options, includeAttachments: e.target.checked })}
                            className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">{t("modals:export.includeAttachments")}</div>
                            <div className="text-xs text-[var(--muted)]">{t("modals:export.attachmentsDesc")}</div>
                        </div>
                        {exportSizeEstimate && (
                            <span className="text-xs text-[var(--muted)]">
                                {formatSize(exportSizeEstimate.attachments)}
                            </span>
                        )}
                    </label>

                    <label className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3 hover:bg-[var(--hover)]">
                        <input
                            type="checkbox"
                            checked={options.includeVersions}
                            onChange={(e) => setOptions({ ...options, includeVersions: e.target.checked })}
                            className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">{t("modals:export.includeVersions")}</div>
                            <div className="text-xs text-[var(--muted)]">{t("modals:export.versionsDesc")}</div>
                        </div>
                        {exportSizeEstimate && (
                            <span className="text-xs text-[var(--muted)]">
                                {formatSize(exportSizeEstimate.versions_json)}
                            </span>
                        )}
                    </label>
                </div>

                {exportSizeEstimate && (
                    <div className="rounded-xl bg-[var(--field)] px-4 py-3 text-sm">
                        <span className="text-[var(--muted)]">{t("modals:export.estimatedSize")}</span>
                        <span className="font-medium text-[var(--text)]">{formatSize(estimatedSize)}</span>
                        <span className="ml-1 text-xs text-[var(--muted)]">{t("modals:export.compressedHint")}</span>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        className="rounded-full px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                        type="button"
                        onClick={onClose}
                    >
                        {t("common:buttons.cancel")}
                    </button>
                    <button
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
                        type="button"
                        onClick={handleExport}
                    >
                        <Download className="h-4 w-4" />
                        {t("modals:export.exportBtn")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
