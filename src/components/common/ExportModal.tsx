import { useEffect, useState } from "react";
import { Download } from "lucide-react";
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
        <Modal open={open} onClose={onClose} title="导出数据">
            <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                    导出为 ZIP 格式，可选择包含标签、附件和版本历史。
                </p>

                <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-[var(--field)] px-4 py-3">
                        <div className="flex-1">
                            <div className="text-sm text-[var(--text)]">笔记记录</div>
                            <div className="text-xs text-[var(--muted)]">始终包含</div>
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
                            <div className="text-sm text-[var(--text)]">包含标签</div>
                            <div className="text-xs text-[var(--muted)]">标签和记录关联</div>
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
                            <div className="text-sm text-[var(--text)]">包含附件</div>
                            <div className="text-xs text-[var(--muted)]">图片、文件等</div>
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
                            <div className="text-sm text-[var(--text)]">包含版本历史</div>
                            <div className="text-xs text-[var(--muted)]">记录的历史版本</div>
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
                        <span className="text-[var(--muted)]">预估大小：</span>
                        <span className="font-medium text-[var(--text)]">{formatSize(estimatedSize)}</span>
                        <span className="ml-1 text-xs text-[var(--muted)]">（ZIP 压缩后更小）</span>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        className="rounded-full px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                        type="button"
                        onClick={onClose}
                    >
                        取消
                    </button>
                    <button
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
                        type="button"
                        onClick={handleExport}
                    >
                        <Download className="h-4 w-4" />
                        导出 ZIP
                    </button>
                </div>
            </div>
        </Modal>
    );
}
