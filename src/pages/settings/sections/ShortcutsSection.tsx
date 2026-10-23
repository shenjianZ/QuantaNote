import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard } from "lucide-react";
import { useSettingsStore } from "../../../stores/settingsStore";
import {
    eventToShortcut,
    findShortcutConflicts,
    getShortcutLabel,
    SHORTCUT_DEFINITIONS,
    type ShortcutId,
} from "../../../utils/shortcutRegistry";
import { SettingsGroup, SettingsHeader, SettingsRow, SecondaryButton } from "../ui";

export function ShortcutsSection() {
    const { t } = useTranslation(["settings"]);
    const settings = useSettingsStore((s) => s.settings);
    const updateSetting = useSettingsStore((s) => s.updateSetting);
    const [shortcutDraft, setShortcutDraft] = useState(settings.shortcuts);
    const [recordingShortcutId, setRecordingShortcutId] = useState<ShortcutId | null>(null);

    useEffect(() => {
        setShortcutDraft(settings.shortcuts);
    }, [settings.shortcuts]);

    function updateShortcut(id: ShortcutId, value: string) {
        const next = { ...shortcutDraft, [id]: value };
        setShortcutDraft(next);
        updateSetting("shortcuts", next);
    }

    function handleShortcutKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, id: ShortcutId) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
            setRecordingShortcutId(null);
            event.currentTarget.blur();
            return;
        }
        const shortcut = eventToShortcut(event.nativeEvent);
        if (!shortcut) return;
        updateShortcut(id, shortcut);
        setRecordingShortcutId(null);
        event.currentTarget.blur();
    }

    const conflicts = findShortcutConflicts(shortcutDraft);

    return (
        <>
            <SettingsHeader
                icon={<Keyboard className="h-4.5 w-4.5" />}
                title={t("settings:shortcuts.title")}
                description={t("settings:shortcuts.description")}
            />

            <SettingsGroup testId="settings-shortcuts-section">
                <SettingsRow label={t("settings:shortcuts.reset")} stacked={false}>
                    <SecondaryButton
                        data-testid="shortcuts-reset-btn"
                        onClick={() => {
                            const defaults = SHORTCUT_DEFINITIONS.reduce(
                                (current, definition) => ({ ...current, [definition.id]: definition.defaultShortcut }),
                                { ...shortcutDraft },
                            );
                            setShortcutDraft(defaults);
                            updateSetting("shortcuts", defaults);
                        }}
                    >
                        {t("settings:shortcuts.reset")}
                    </SecondaryButton>
                </SettingsRow>
                {SHORTCUT_DEFINITIONS.map((definition) => {
                    const value = shortcutDraft[definition.id];
                    const conflictingIds = value ? (conflicts.get(value) ?? []).filter((id) => id !== definition.id) : [];
                    const conflictingNames = conflictingIds
                        .map((id) => SHORTCUT_DEFINITIONS.find((item) => item.id === id))
                        .filter(Boolean)
                        .map((item) => t(item!.labelKey))
                        .join(", ");
                    return (
                        <SettingsRow
                            key={definition.id}
                            label={t(definition.labelKey)}
                            desc={conflictingNames
                                ? <span className="text-red-500" data-testid={`shortcut-conflict-${definition.id.replace(".", "-")}`}>{t("settings:shortcuts.conflict", { commands: conflictingNames })}</span>
                                : t(definition.descriptionKey)}
                        >
                            <button
                                className={`min-w-28 rounded-xl border px-3 py-2 text-center text-xs font-medium transition-colors ${recordingShortcutId === definition.id ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--field)] text-[var(--text)] hover:border-[var(--accent)]"}`}
                                type="button"
                                data-testid={`shortcut-recorder-${definition.id.replace(".", "-")}`}
                                data-shortcut-recorder="true"
                                onFocus={() => setRecordingShortcutId(definition.id)}
                                onBlur={() => setRecordingShortcutId((current) => (current === definition.id ? null : current))}
                                onKeyDown={(event) => handleShortcutKeyDown(event, definition.id)}
                            >
                                {recordingShortcutId === definition.id
                                    ? t("settings:shortcuts.record")
                                    : value ? getShortcutLabel(value) : t("settings:shortcuts.empty")}
                            </button>
                            {value && (
                                <button
                                    className="rounded-full px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                                    type="button"
                                    data-testid={`shortcut-clear-${definition.id.replace(".", "-")}`}
                                    onClick={() => updateShortcut(definition.id, "")}
                                >
                                    {t("settings:shortcuts.clear")}
                                </button>
                            )}
                        </SettingsRow>
                    );
                })}
            </SettingsGroup>
        </>
    );
}
