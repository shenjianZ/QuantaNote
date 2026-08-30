import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, GitMerge, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { useSyncStore } from "../../stores/syncStore";
import type {
    ConflictInfo,
    ConflictResolutionChoice,
} from "../../services/tauriCommands";

type ResolutionChoice = "local" | "remote" | "merged";
type FieldChoice = "local" | "remote" | "manual";

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function formatValue(value: unknown): string {
    if (value === undefined) return "—";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
        return String(value);
    }
}

function parseManualValue(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

function conflictKey(conflict: ConflictInfo): string {
    return `${conflict.table_name}:${conflict.record_id}`;
}

function isIdentityField(tableName: string, fieldName: string): boolean {
    if (tableName === "tags") return fieldName === "uuid";
    if (tableName === "item_tags") {
        return fieldName === "item_id" || fieldName === "tag_uuid";
    }
    return fieldName === "id";
}

function getDataObject(data: Record<string, unknown>): Record<string, unknown> {
    return data && typeof data === "object" ? data : {};
}

function buildMergedData(
    conflict: ConflictInfo,
    fieldNames: string[],
    fieldChoices: Record<string, FieldChoice>,
    manualValues: Record<string, string>,
): Record<string, unknown> {
    const localData = getDataObject(conflict.local_data);
    const remoteData = getDataObject(conflict.remote_data);
    const merged: Record<string, unknown> = {};

    for (const fieldName of fieldNames) {
        const choice = fieldChoices[fieldName];
        let value: unknown;

        if (isIdentityField(conflict.table_name, fieldName)) {
            value = localData[fieldName] ?? remoteData[fieldName];
        } else if (choice === "remote") {
            value = remoteData[fieldName];
        } else if (choice === "manual") {
            value = parseManualValue(manualValues[fieldName] ?? "");
        } else {
            value = localData[fieldName] ?? remoteData[fieldName];
        }

        if (value !== undefined) merged[fieldName] = value;
    }

    return merged;
}

export function ConflictResolutionModal({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const { t } = useTranslation(["sync", "common"]);
    const { pendingConflicts, resolveConflicts, cancelConflicts, isLoading } =
        useSyncStore();

    const [resolutions, setResolutions] = useState<
        Record<string, ConflictResolutionChoice>
    >({});

    if (!pendingConflicts || pendingConflicts.length === 0) return null;
    const conflicts = pendingConflicts;

    function setResolution(resolution: ConflictResolutionChoice) {
        setResolutions((prev) => ({
            ...prev,
            [`${resolution.table_name}:${resolution.record_id}`]: resolution,
        }));
    }

    function selectAll(choice: "local" | "remote") {
        const all: Record<string, ConflictResolutionChoice> = {};
        for (const conflict of conflicts) {
            all[conflictKey(conflict)] = {
                table_name: conflict.table_name,
                record_id: conflict.record_id,
                choice,
            };
        }
        setResolutions(all);
    }

    async function handleResolve() {
        const choices = conflicts.map((conflict) =>
            resolutions[conflictKey(conflict)] ?? {
                table_name: conflict.table_name,
                record_id: conflict.record_id,
                choice: "local" as const,
            },
        );
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
            maxWidth="max-w-3xl"
        >
            <div data-testid="conflict-resolution-modal" className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-xs text-amber-300">
                        {t("conflictHint", { count: conflicts.length })}
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        data-testid="conflict-all-local-btn"
                        type="button"
                        onClick={() => selectAll("local")}
                        className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    >
                        {t("allLocal")}
                    </button>
                    <button
                        data-testid="conflict-all-remote-btn"
                        type="button"
                        onClick={() => selectAll("remote")}
                        className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    >
                        {t("allRemote")}
                    </button>
                </div>

                <div className="max-h-[32rem] space-y-3 overflow-auto pr-1">
                    {conflicts.map((conflict) => {
                        const key = conflictKey(conflict);
                        return (
                            <ConflictRow
                                key={key}
                                conflict={conflict}
                                resolution={resolutions[key]}
                                onResolution={setResolution}
                            />
                        );
                    })}
                </div>

                <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
                    <button
                        data-testid="conflict-cancel-btn"
                        type="button"
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50"
                    >
                        {t("cancelSync")}
                    </button>
                    <button
                        data-testid="conflict-apply-btn"
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
    resolution,
    onResolution,
}: {
    conflict: ConflictInfo;
    resolution: ConflictResolutionChoice | undefined;
    onResolution: (resolution: ConflictResolutionChoice) => void;
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
    const localData = getDataObject(conflict.local_data);
    const remoteData = getDataObject(conflict.remote_data);
    const fieldNames = Array.from(
        new Set([...Object.keys(localData), ...Object.keys(remoteData)]),
    ).filter((fieldName) => fieldName !== "updated_at" && fieldName !== "_deleted");
    const [mode, setMode] = useState<ResolutionChoice>(
        resolution?.choice ?? "local",
    );
    const [fieldChoices, setFieldChoices] = useState<
        Record<string, FieldChoice>
    >({});
    const [manualValues, setManualValues] = useState<Record<string, string>>(
        {},
    );

    useEffect(() => {
        if (resolution?.choice && resolution.choice !== "merged") {
            setMode(resolution.choice);
        }
    }, [resolution?.choice]);

    useEffect(() => {
        if (mode !== "merged") return;
        onResolution({
            table_name: conflict.table_name,
            record_id: conflict.record_id,
            choice: "merged",
            merged_data: buildMergedData(
                conflict,
                fieldNames,
                fieldChoices,
                manualValues,
            ),
        });
    }, [mode, fieldChoices, manualValues]);

    function changeMode(nextMode: ResolutionChoice) {
        setMode(nextMode);
        onResolution({
            table_name: conflict.table_name,
            record_id: conflict.record_id,
            choice: nextMode,
            ...(nextMode === "merged"
                ? {
                      merged_data: buildMergedData(
                          conflict,
                          fieldNames,
                          fieldChoices,
                          manualValues,
                      ),
                  }
                : {}),
        });
    }

    function changeFieldChoice(fieldName: string, choice: FieldChoice) {
        setFieldChoices((prev) => ({ ...prev, [fieldName]: choice }));
        if (choice === "manual" && manualValues[fieldName] === undefined) {
            const currentValue = localData[fieldName] ?? remoteData[fieldName];
            setManualValues((prev) => ({
                ...prev,
                [fieldName]: formatValue(currentValue),
            }));
        }
    }

    const modeOptions = [
        {
            value: "local",
            label: `${t("local")} (${formatTime(conflict.local_updated_at)})`,
        },
        {
            value: "remote",
            label: `${t("remote")} (${formatTime(conflict.remote_updated_at)})`,
        },
        { value: "merged", label: t("fieldMerge") },
    ];

    return (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--field)] px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text)]">
                        {label}
                    </span>
                    <span className="truncate text-xs text-[var(--muted)]">
                        {conflict.record_id}
                    </span>
                </div>
                <div className="w-64 shrink-0" data-testid="conflict-mode-select">
                    <Select
                        value={mode}
                        onChange={(value) =>
                            changeMode(value as ResolutionChoice)
                        }
                        options={modeOptions}
                    />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <DataPreview
                    testId="conflict-local-data"
                    title={`${t("local")} · ${formatTime(conflict.local_updated_at)}`}
                    data={localData}
                />
                <DataPreview
                    testId="conflict-remote-data"
                    title={`${t("remote")} · ${formatTime(conflict.remote_updated_at)}`}
                    data={remoteData}
                />
            </div>

            {mode === "merged" && (
                <div
                    data-testid="conflict-field-merge"
                    className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3"
                >
                    <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                        <GitMerge className="h-3.5 w-3.5" />
                        <span>{t("mergeHint")}</span>
                    </div>
                    <div className="max-h-64 space-y-2 overflow-auto">
                        {fieldNames.map((fieldName) => {
                            const fixed = isIdentityField(
                                conflict.table_name,
                                fieldName,
                            );
                            const selected =
                                fieldChoices[fieldName] ??
                                (localData[fieldName] !== undefined
                                    ? "local"
                                    : "remote");
                            return (
                                <div
                                    key={fieldName}
                                    className="grid gap-2 rounded-lg border border-[var(--line)] p-2 md:grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_8rem]"
                                >
                                    <div className="flex items-center text-xs font-medium text-[var(--text)]">
                                        {fieldName}
                                    </div>
                                    <pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--field)] p-2 text-[11px] text-[var(--muted)]">
                                        {formatValue(localData[fieldName])}
                                    </pre>
                                    <pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--field)] p-2 text-[11px] text-[var(--muted)]">
                                        {formatValue(remoteData[fieldName])}
                                    </pre>
                                    {fixed ? (
                                        <span className="flex items-center text-[11px] text-[var(--muted)]">
                                            {t("fixedField")}
                                        </span>
                                    ) : (
                                        <div data-testid={`conflict-field-choice-${fieldName}`}>
                                            <Select
                                                value={selected}
                                                onChange={(value) =>
                                                    changeFieldChoice(
                                                        fieldName,
                                                        value as FieldChoice,
                                                    )
                                                }
                                                options={[
                                                    {
                                                        value: "local",
                                                        label: t("localValue"),
                                                    },
                                                    {
                                                        value: "remote",
                                                        label: t("remoteValue"),
                                                    },
                                                    {
                                                        value: "manual",
                                                        label: t("manualValue"),
                                                    },
                                                ]}
                                            />
                                        </div>
                                    )}
                                    {!fixed && selected === "manual" && (
                                        <textarea
                                            data-testid={`conflict-manual-value-${fieldName}`}
                                            value={manualValues[fieldName] ?? ""}
                                            onChange={(event) =>
                                                setManualValues((prev) => ({
                                                    ...prev,
                                                    [fieldName]: event.target.value,
                                                }))
                                            }
                                            placeholder={t("manualPlaceholder")}
                                            className="min-h-16 rounded-lg border border-[var(--line)] bg-[var(--field)] p-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)] md:col-start-2 md:col-span-3"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function DataPreview({
    title,
    data,
    testId,
}: {
    title: string;
    data: Record<string, unknown>;
    testId: string;
}) {
    return (
        <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2">
            <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">
                {title}
            </div>
            <pre
                data-testid={testId}
                className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--text)]"
            >
                {formatValue(data)}
            </pre>
        </div>
    );
}
