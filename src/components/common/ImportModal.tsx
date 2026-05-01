import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Modal } from "./Modal";
import { useSettingsStore } from "../../stores/settingsStore";
import type { ImportOptions } from "../../services/tauriCommands";

interface ImportModalProps {
    open: boolean;
    onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
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
        <Modal open={open} onClose={onClose} title="导入数据">
            <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                    从 ZIP 文件导入数据，可选择导入内容和冲突处理方式。
                </p>

                <div className="space-y-3">
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
                    </label>
                </div>

                <div className="rounded-xl bg-[var(--field)] px-4 py-3">
                    <div className="mb-2 text-sm font-medium text-[var(--text)]">冲突处理</div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-3">
                            <input
                                type="radio"
                                name="conflict"
                                checked={!options.overwrite}
                                onChange={() => setOptions({ ...options, overwrite: false })}
                                className="accent-[var(--accent)]"
                            />
                            <div>
                                <div className="text-sm text-[var(--text)]">跳过已有</div>
                                <div className="text-xs text-[var(--muted)]">保留现有数据，忽略重复项</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="radio"
                                name="conflict"
                                checked={options.overwrite}
                                onChange={() => setOptions({ ...options, overwrite: true })}
                                className="accent-[var(--accent)]"
                            />
                            <div>
                                <div className="text-sm text-[var(--text)]">覆盖已有</div>
                                <div className="text-xs text-[var(--muted)]">用导入数据替换现有数据</div>
                            </div>
                        </label>
                    </div>
                </div>

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
                        onClick={handleImport}
                    >
                        <Upload className="h-4 w-4" />
                        导入 ZIP
                    </button>
                </div>
            </div>
        </Modal>
    );
}
