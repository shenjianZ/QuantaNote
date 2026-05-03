import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { Modal } from "../common/Modal";

interface ConflictRecord {
    tableName: string;
    recordId: string;
    localData: Record<string, unknown>;
    remoteData: Record<string, unknown>;
}

interface ConflictResolverProps {
    open: boolean;
    conflicts: ConflictRecord[];
    onResolve: (tableName: string, recordId: string, useLocal: boolean) => void;
    onClose: () => void;
}

export function ConflictResolver({
    open,
    conflicts,
    onResolve,
    onClose,
}: ConflictResolverProps) {
    if (conflicts.length === 0) return null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="同步冲突"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">
                        检测到 {conflicts.length} 条冲突记录，请选择保留哪个版本
                    </span>
                </div>

                <div className="max-h-[50vh] space-y-3 overflow-auto">
                    {conflicts.map((conflict) => (
                        <div
                            key={`${conflict.tableName}-${conflict.recordId}`}
                            className="rounded-xl border border-[var(--line)] p-4"
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-[var(--muted)]">
                                        {conflict.tableName}
                                    </span>
                                    <span className="ml-2 text-sm font-medium text-[var(--text)]">
                                        {String(
                                            conflict.localData.title ||
                                                conflict.localData.name ||
                                                conflict.recordId,
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() =>
                                        onResolve(
                                            conflict.tableName,
                                            conflict.recordId,
                                            true,
                                        )
                                    }
                                    className="flex flex-col items-start gap-1 rounded-lg border border-[var(--line)] p-3 text-left hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                                >
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]">
                                        <ArrowLeft className="h-3.5 w-3.5" />
                                        使用本地版本
                                    </div>
                                    <div className="line-clamp-2 text-xs text-[var(--muted)]">
                                        {String(
                                            conflict.localData.content ||
                                                conflict.localData.summary ||
                                                JSON.stringify(
                                                    conflict.localData,
                                                ).slice(0, 100),
                                        )}
                                    </div>
                                </button>

                                <button
                                    onClick={() =>
                                        onResolve(
                                            conflict.tableName,
                                            conflict.recordId,
                                            false,
                                        )
                                    }
                                    className="flex flex-col items-start gap-1 rounded-lg border border-[var(--line)] p-3 text-left hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                                >
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]">
                                        <ArrowRight className="h-3.5 w-3.5" />
                                        使用远端版本
                                    </div>
                                    <div className="line-clamp-2 text-xs text-[var(--muted)]">
                                        {String(
                                            conflict.remoteData.content ||
                                                conflict.remoteData.summary ||
                                                JSON.stringify(
                                                    conflict.remoteData,
                                                ).slice(0, 100),
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
