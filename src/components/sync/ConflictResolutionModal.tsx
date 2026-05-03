import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { useSyncStore } from "../../stores/syncStore";
import type { ConflictInfo } from "../../services/tauriCommands";

interface ConflictResolutionModalProps {
    open: boolean;
    onClose: () => void;
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function conflictKey(conflict: ConflictInfo): string {
    return `${conflict.table_name}:${conflict.record_id}`;
}

export function ConflictResolutionModal({
    open,
    onClose,
}: ConflictResolutionModalProps) {
    const { t } = useTranslation(["sync", "common"]);
    const { pendingConflicts, resolveConflicts, cancelConflicts, isLoading } =
        useSyncStore();

    const [resolutions, setResolutions] = useState<
        Record<string, "local" | "remote">
    >({});

    if (!pendingConflicts || pendingConflicts.length === 0) return null;

    function setChoice(key: string, choice: "local" | "remote") {
        setResolutions((prev) => ({ ...prev, [key]: choice }));
    }

    // 默认全部选择"本地"
    function selectAllLocal() {
        const all: Record<string, "local" | "remote"> = {};
        for (const c of pendingConflicts!) {
            all[conflictKey(c)] = "local";
        }
        setResolutions(all);
    }

    function selectAllRemote() {
        const all: Record<string, "local" | "remote"> = {};
        for (const c of pendingConflicts!) {
            all[conflictKey(c)] = "remote";
        }
        setResolutions(all);
    }

    async function handleResolve() {
        // 确保所有冲突都已选择
        const choices = pendingConflicts!.map((c) => ({
            table_name: c.table_name,
            record_id: c.record_id,
            choice: resolutions[conflictKey(c)] || "local",
        }));
        try {
            await resolveConflicts(choices);
            setResolutions({});
            onClose();
        } catch {
            // error handled in store
        }
    }

    async function handleCancel() {
        try {
            await cancelConflicts();
            setResolutions({});
            onClose();
        } catch {
            // error handled in store
        }
    }

    return (
        <Modal
            open={open}
            onClose={handleCancel}
            title={t("syncConflictTitle")}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-xs text-amber-300">
                        {t("conflictHint", { count: pendingConflicts.length })}
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={selectAllLocal}
                        className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    >
                        {t("allLocal")}
                    </button>
                    <button
                        type="button"
                        onClick={selectAllRemote}
                        className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    >
                        {t("allRemote")}
                    </button>
                </div>

                <div className="max-h-60 space-y-2 overflow-auto">
                    {pendingConflicts.map((conflict) => {
                        const key = conflictKey(conflict);
                        return (
                            <ConflictRow
                                key={key}
                                conflict={conflict}
                                conflictKey={key}
                                choice={resolutions[key]}
                                onChoice={(c) => setChoice(key, c)}
                            />
                        );
                    })}
                </div>

                <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                    >
                        {t("cancelSync")}
                    </button>
                    <button
                        type="button"
                        onClick={handleResolve}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {isLoading && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {t("applyResolution")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function ConflictRow({
    conflict,
    conflictKey,
    choice,
    onChoice,
}: {
    conflict: ConflictInfo;
    conflictKey: string;
    choice: "local" | "remote" | undefined;
    onChoice: (c: "local" | "remote") => void;
}) {
    const { t } = useTranslation(["sync", "common"]);
    const TABLE_LABELS: Record<string, string> = {
        items: t("tables.items"),
        tags: t("tables.tags"),
        item_tags: t("tables.item_tags"),
        versions: t("tables.versions"),
        attachments: t("tables.attachments"),
    };
    const label = TABLE_LABELS[conflict.table_name] || conflict.table_name;
    const currentChoice = choice || "local";

    return (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text)]">
                    {label}
                </span>
                <span className="text-xs text-[var(--muted)]">
                    {conflict.record_id.slice(0, 8)}...
                </span>
            </div>
            <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="radio"
                        name={`conflict-${conflictKey}`}
                        checked={currentChoice === "local"}
                        onChange={() => onChoice("local")}
                        className="accent-[var(--accent)]"
                    />
                    <span className="text-[var(--text)]">
                        {t("local")}{" "}
                        <span className="text-[var(--muted)]">
                            ({formatTime(conflict.local_updated_at)})
                        </span>
                    </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="radio"
                        name={`conflict-${conflictKey}`}
                        checked={currentChoice === "remote"}
                        onChange={() => onChoice("remote")}
                        className="accent-[var(--accent)]"
                    />
                    <span className="text-[var(--text)]">
                        {t("remote")}{" "}
                        <span className="text-[var(--muted)]">
                            ({formatTime(conflict.remote_updated_at)})
                        </span>
                    </span>
                </label>
            </div>
        </div>
    );
}
