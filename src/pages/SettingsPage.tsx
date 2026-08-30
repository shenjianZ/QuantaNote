import { useEffect, useState } from "react";
import {
    BookOpen,
    Cloud,
    Database,
    Download,
    FileText,
    Github,
    Keyboard,
    Globe2,
    Laptop,
    MessageSquare,
    Moon,
    Palette,
    RefreshCw,
    Settings2,
    Sun,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import type { ThemeMode } from "../hooks/useTheme";
import { BackupManagerModal } from "../components/common/BackupManagerModal";
import { ColorPickerModal } from "../components/common/ColorPickerModal";
import { ExportModal } from "../components/common/ExportModal";
import { ImportModal } from "../components/common/ImportModal";
import { Select } from "../components/common/Select";
import { SyncSettingsPanel } from "../components/sync/SyncSettingsPanel";
import { ContentWidthControl } from "../components/common/ContentWidthControl";
import { useSettingsStore } from "../stores/settingsStore";
import { useAppStore } from "../stores/appStore";
import { useToastStore } from "../stores/toastStore";
import { useUpdaterStore } from "../stores/updaterStore";
import { isMobile } from "../utils/platform";
import { copyTextToSystemClipboard } from "../utils/clipboard";
import {
    eventToShortcut,
    findShortcutConflicts,
    getShortcutLabel,
    SHORTCUT_DEFINITIONS,
    type ShortcutId,
} from "../utils/shortcutRegistry";

const FONT_OPTIONS_KEYS = [
    { value: "Noto Sans SC", label: "Noto Sans SC" },
    { value: "system-ui", labelKey: "settings:font.systemDefault" },
];

const MONO_OPTIONS_KEYS = [
    { value: "JetBrains Mono", label: "JetBrains Mono" },
    { value: "Consolas", label: "Consolas" },
    { value: "monospace", labelKey: "settings:font.systemMono" },
];

const ACCENT_COLOR_KEYS = [
    { value: "#386c5f", labelKey: "settings:appearance.colors.green" },
    { value: "#2563eb", labelKey: "settings:appearance.colors.blue" },
    { value: "#7c3aed", labelKey: "settings:appearance.colors.purple" },
    { value: "#c47b12", labelKey: "settings:appearance.colors.amber" },
    { value: "#b64242", labelKey: "settings:appearance.colors.red" },
    { value: "#0891b2", labelKey: "settings:appearance.colors.cyan" },
    { value: "#059669", labelKey: "settings:appearance.colors.emerald" },
    { value: "#d97706", labelKey: "settings:appearance.colors.orange" },
    { value: "#e11d48", labelKey: "settings:appearance.colors.rose" },
    { value: "#6366f1", labelKey: "settings:appearance.colors.indigo" },
    { value: "#8b5cf6", labelKey: "settings:appearance.colors.violet" },
    { value: "#64748b", labelKey: "settings:appearance.colors.slate" },
];

interface SettingsPageProps {
    theme?: ThemeMode;
    onThemeChange?: (theme: ThemeMode) => void;
}


const rowClass =
    "flex min-h-12 items-center justify-between gap-4 border-b border-[var(--line)] py-2 last:border-b-0";

function formatStorageBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function StorageIssueDetails({
    title,
    issues,
    testId,
}: {
    title: string;
    issues: readonly { path: string; reason: string }[];
    testId: string;
}) {
    if (issues.length === 0) return null;
    return (
        <details className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--field)] px-3 py-2" data-testid={testId}>
            <summary className="cursor-pointer text-xs font-medium text-[var(--text)]">
                {title} ({issues.length})
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs text-[var(--muted)]">
                {issues.map((issue) => (
                    <li className="break-all" key={`${issue.path}-${issue.reason}`}>
                        <code className="text-[var(--text)]">{issue.path}</code>
                        <span className="ml-2">{issue.reason}</span>
                    </li>
                ))}
            </ul>
        </details>
    );
}

export function SettingsPage({
    theme = "system",
    onThemeChange,
}: SettingsPageProps) {
    const { t } = useTranslation(["settings", "common"]);
    const settingsSection = useAppStore((s) => s.settingsSection);
    const setSettingsSection = useAppStore((s) => s.setSettingsSection);
    const [activeSection, setActiveSection] = useState(settingsSection ?? 0);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [backupManagerOpen, setBackupManagerOpen] = useState(false);
    const [recordingShortcutId, setRecordingShortcutId] = useState<ShortcutId | null>(null);
    const settings = useSettingsStore((s) => s.settings);
    const [shortcutDraft, setShortcutDraft] = useState(settings.shortcuts);
    const isMobilePlatform = isMobile();
    const dbSize = useSettingsStore((s) => s.dbSize);
    const dbPath = useSettingsStore((s) => s.dbPath);
    const autoBackupConfig = useSettingsStore((s) => s.autoBackupConfig);
    const backupDirPath = useSettingsStore((s) => s.backupDirPath);
    const logDir = useSettingsStore((s) => s.logDir);
    const sqlLogPath = useSettingsStore((s) => s.sqlLogPath);
    const storageReport = useSettingsStore((s) => s.storageReport);
    const storageScanLoading = useSettingsStore((s) => s.storageScanLoading);
    const init = useSettingsStore((s) => s.init);
    const updateSetting = useSettingsStore((s) => s.updateSetting);
    const addCustomColor = useSettingsStore((s) => s.addCustomColor);
    const removeCustomColor = useSettingsStore((s) => s.removeCustomColor);
    const refreshDbSize = useSettingsStore((s) => s.refreshDbSize);
    const fetchDbPath = useSettingsStore((s) => s.fetchDbPath);
    const optimizeDb = useSettingsStore((s) => s.optimizeDb);
    const fetchAutoBackupConfig = useSettingsStore((s) => s.fetchAutoBackupConfig);
    const updateAutoBackupConfig = useSettingsStore((s) => s.updateAutoBackupConfig);
    const triggerBackupNow = useSettingsStore((s) => s.triggerBackupNow);
    const fetchBackupDirPath = useSettingsStore((s) => s.fetchBackupDirPath);
    const fetchBackups = useSettingsStore((s) => s.fetchBackups);
    const fetchDiagnosticsPaths = useSettingsStore((s) => s.fetchDiagnosticsPaths);
    const fetchStorageConsistency = useSettingsStore((s) => s.fetchStorageConsistency);
    const repairStorageConsistency = useSettingsStore((s) => s.repairStorageConsistency);
    const updateSqlLogging = useSettingsStore((s) => s.updateSqlLogging);
    const clearSqlLogFile = useSettingsStore((s) => s.clearSqlLogFile);
    const updateState = useUpdaterStore((s) => s.updateState);
    const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
    const downloadUpdate = useUpdaterStore((s) => s.downloadUpdate);
    const installUpdate = useUpdaterStore((s) => s.installUpdate);

    useEffect(() => {
        setShortcutDraft(settings.shortcuts);
    }, [settings.shortcuts]);

    useEffect(() => {
        init();
        refreshDbSize();
        fetchDbPath();
        fetchAutoBackupConfig();
        fetchBackupDirPath();
        fetchBackups();
        fetchDiagnosticsPaths();
        fetchStorageConsistency();
    }, [init, refreshDbSize, fetchDbPath, fetchAutoBackupConfig, fetchBackupDirPath, fetchBackups, fetchDiagnosticsPaths, fetchStorageConsistency]);

    useEffect(() => {
        if (settingsSection != null) {
            setActiveSection(settingsSection);
            setSettingsSection(null);
        }
    }, [settingsSection, setSettingsSection]);

    function renderToggle(value: boolean, onChange: (v: boolean) => void, testId?: string, ariaLabel?: string) {
        return (
            <button
                type="button"
                role="switch"
                aria-checked={value}
                aria-label={ariaLabel}
                data-testid={testId}
                className={`settings-switch relative shrink-0 rounded-full border border-[var(--line)] transition ${value ? "bg-[var(--accent)]" : "bg-[var(--field)]"}`}
                onClick={() => onChange(!value)}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${value ? "left-6" : "left-1"}`}
                />
            </button>
        );
    }

    function updateFloatingBallPosition(axis: "x" | "y", value: string) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;
        const current = settings.floatingBallPosition ?? { x: 0, y: 0 };
        updateSetting("floatingBallPosition", {
            ...current,
            [axis]: Math.round(numericValue),
        });
    }

    async function handleOpenLogDir() {
        if (!logDir) return;
        try {
            await openPath(logDir);
        } catch {
            try {
                await copyTextToSystemClipboard(logDir);
                useToastStore
                    .getState()
                    .addToast("info", t("common:toast.pathCopied"));
            } catch {
                useToastStore
                    .getState()
                    .addToast("error", t("common:toast.copyFailed"));
            }
        }
    }

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

    const settingsMenu = [
        { label: t("settings:menu.appearance"), icon: Palette },
        { label: t("settings:menu.font"), icon: Globe2 },
        { label: t("settings:menu.shortcuts"), icon: Keyboard },
        { label: t("settings:menu.data"), icon: Database },
        { label: t("settings:menu.sync"), icon: Cloud },
        { label: t("settings:menu.about"), icon: Settings2 },
    ];

    function renderSection() {
        if (activeSection === 0) {
            return (
                <>
                    <section className="mb-6">
                        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                            {t("settings:appearance.theme")}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {[
                                {
                                    value: "system" as ThemeMode,
                                    icon: Laptop,
                                    label: t("settings:appearance.system"),
                                },
                                {
                                    value: "light" as ThemeMode,
                                    icon: Sun,
                                    label: t("settings:appearance.light"),
                                },
                                {
                                    value: "dark" as ThemeMode,
                                    icon: Moon,
                                    label: t("settings:appearance.dark"),
                                },
                            ].map((opt) => {
                                const Icon = opt.icon;
                                return (
                                    <button
                                        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm ${theme === opt.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]" : "border-[var(--line)] bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"}`}
                                        key={opt.value}
                                        data-testid={`theme-${opt.value}`}
                                        role="radio"
                                        aria-checked={theme === opt.value}
                                        aria-label={opt.label}
                                        onClick={() =>
                                            onThemeChange?.(opt.value)
                                        }
                                        type="button"
                                    >
                                        <Icon className="h-4 w-4" />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    <section className="mb-6">
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:contentWidth.title")}
                        </h2>
                        <p className="mb-3 text-xs text-[var(--muted)]">
                            {t("settings:contentWidth.description")}
                        </p>
                        <ContentWidthControl testId="settings-content-width-control" />
                    </section>
                    <section className="mb-6">
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:documentOutline.title")}
                        </h2>
                        <p className="mb-3 text-xs text-[var(--muted)]">
                            {t("settings:documentOutline.description")}
                        </p>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:documentOutline.enabled")}
                            </span>
                            {renderToggle(
                                settings.showDocumentOutline,
                                (value) => updateSetting("showDocumentOutline", value),
                                "settings-document-outline-toggle",
                                t("settings:documentOutline.enabled"),
                            )}
                        </div>
                    </section>
                    <section className="mb-6">
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:data.locale")}
                        </h2>
                        <div className={rowClass}>
                            <span className="text-xs text-[var(--muted)]">
                                {t("settings:data.localeDesc")}
                            </span>
                            <Select
                                className="w-36"
                                options={[
                                    { value: "zh-CN", label: t("settings:localeOptions.zh-CN") },
                                    { value: "en", label: t("settings:localeOptions.en") },
                                ]}
                                value={settings.locale}
                                onChange={(v) => updateSetting("locale", v as "zh-CN" | "en")}
                            />
                        </div>
                    </section>
                    <section className="mb-6">
                        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                            {t("settings:appearance.accentColor")}
                        </h2>
                        <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">{t("settings:appearance.predefined")}</div>
                        <div className="mb-4 flex flex-wrap gap-2.5">
                            {ACCENT_COLOR_KEYS.map((c) => (
                                <button
                                    className={`settings-color-swatch rounded-full border border-[var(--line)] transition-transform hover:scale-110 ${c.value === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                                    key={c.value}
                                    data-testid="accent-color"
                                    style={{ background: c.value }}
                                    title={t(c.labelKey)}
                                    type="button"
                                    onClick={() =>
                                        updateSetting("accentColor", c.value)
                                    }
                                />
                            ))}
                        </div>
                        <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">{t("settings:appearance.custom")}</div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            {settings.customAccentColors.map((c) => (
                                <div className="group relative" key={c.hex}>
                                    <button
                                        className={`settings-color-swatch rounded-full border border-[var(--line)] transition-transform hover:scale-110 ${c.hex === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                                        style={{ background: c.hex }}
                                        title={`${c.name} (${c.hex.toUpperCase()})`}
                                        type="button"
                                        onClick={() =>
                                            updateSetting("accentColor", c.hex)
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--danger)] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeCustomColor(c.hex);
                                        }}
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                data-testid="settings-add-custom-color-btn"
                                className="settings-color-swatch flex items-center justify-center rounded-full border border-dashed border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                title={t("settings:appearance.addCustomColor")}
                                onClick={() => setColorPickerOpen(true)}
                            >
                                <span className="text-sm leading-none">+</span>
                            </button>
                        </div>
                        <ColorPickerModal
                            open={colorPickerOpen}
                            onConfirm={(hex, name) => {
                                addCustomColor(hex, name);
                                updateSetting("accentColor", hex);
                                setColorPickerOpen(false);
                            }}
                            onCancel={() => setColorPickerOpen(false)}
                        />
                    </section>
                    {!isMobilePlatform && (
                    <section>
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:appearance.windowBehavior")}
                        </h2>
                        {[
                            {
                                key: "minimizeToTray" as const,
                                label: t("settings:appearance.minimizeToTray"),
                                desc: t("settings:appearance.minimizeToTrayDesc"),
                            },
                            {
                                key: "closeKeepRunning" as const,
                                label: t("settings:appearance.closeKeepRunning"),
                                desc: t("settings:appearance.closeKeepRunningDesc"),
                            },
                            {
                                key: "floatingBall" as const,
                                label: t("settings:appearance.floatingBall"),
                                desc: t("settings:appearance.floatingBallDesc"),
                            },
                        ].map((item) => (
                            <div className={rowClass} key={item.key}>
                                <div>
                                    <span className="text-sm text-[var(--text)]">
                                        {item.label}
                                    </span>
                                    <div className="mt-0.5 text-xs text-[var(--muted)]">
                                        {item.desc}
                                    </div>
                                </div>
                                {renderToggle(settings[item.key], (v) =>
                                    updateSetting(item.key, v),
                                )}
                            </div>
                        ))}
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    {t("settings:appearance.floatingBallPosition")}
                                </span>
                                <div className="mt-0.5 text-xs text-[var(--muted)]">
                                    {t("settings:appearance.floatingBallPositionDesc")}
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                                    <span>X</span>
                                    <input
                                        data-testid="floating-ball-x-input"
                                        className="h-8 w-20 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                        inputMode="numeric"
                                        type="number"
                                        value={settings.floatingBallPosition?.x ?? ""}
                                        placeholder={t("settings:appearance.floatingBallDefault")}
                                        onChange={(e) => updateFloatingBallPosition("x", e.currentTarget.value)}
                                    />
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                                    <span>Y</span>
                                    <input
                                        data-testid="floating-ball-y-input"
                                        className="h-8 w-20 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                        inputMode="numeric"
                                        type="number"
                                        value={settings.floatingBallPosition?.y ?? ""}
                                        placeholder={t("settings:appearance.floatingBallDefault")}
                                        onChange={(e) => updateFloatingBallPosition("y", e.currentTarget.value)}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="h-8 rounded-full bg-[var(--field)] px-3 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                                    onClick={() => updateSetting("floatingBallPosition", null)}
                                >
                                    {t("settings:appearance.floatingBallReset")}
                                </button>
                            </div>
                        </div>
                    </section>
                    )}
                    {!isMobilePlatform && (
                    <section>
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:appearance.systemSection")}
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:appearance.autostart")}
                            </span>
                            {renderToggle(settings.autostart, (v) =>
                                updateSetting("autostart", v),
                            )}
                        </div>
                    </section>
                    )}
                </>
            );
        }

        if (activeSection === 1) {
            return (
                <>
                    <section className="mb-6">
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:font.title")}
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:font.uiFont")}
                            </span>
                            <Select
                                className="w-48"
                                options={FONT_OPTIONS_KEYS.map(o => ({ value: o.value, label: o.label ?? t(o.labelKey!) }))}
                                value={settings.fontFamily}
                                onChange={(v) => updateSetting("fontFamily", v)}
                            />
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:font.monoFont")}
                            </span>
                            <Select
                                className="w-48"
                                options={MONO_OPTIONS_KEYS.map(o => ({ value: o.value, label: o.label ?? t(o.labelKey!) }))}
                                value={settings.fontMono}
                                onChange={(v) => updateSetting("fontMono", v)}
                            />
                        </div>
                    </section>
                    <section>
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:font.fontSize")}
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:font.uiFontSize")}
                            </span>
                            <Select
                                className="w-24"
                                options={[
                                    { value: "14", label: "14 px" },
                                    { value: "15", label: "15 px" },
                                    { value: "16", label: "16 px" },
                                    { value: "17", label: "17 px" },
                                    { value: "18", label: "18 px" },
                                ]}
                                value={String(settings.fontSize)}
                                onChange={(v) => updateSetting("fontSize", Number(v))}
                            />
                        </div>
                        <div className="mt-4 rounded-2xl bg-[var(--field)] p-4 text-sm text-[var(--text)]">
                            {t("settings:font.preview")}
                        </div>
                    </section>
                </>
            );
        }

        if (activeSection === 2) {
            const conflicts = findShortcutConflicts(shortcutDraft);
            return (
                <section data-testid="settings-shortcuts-section">
                    <div className="mb-5 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text)]">
                                {t("settings:shortcuts.title")}
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                                {t("settings:shortcuts.description")}
                            </p>
                        </div>
                        <button
                            className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                            type="button"
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
                        </button>
                    </div>
                    <div className="divide-y divide-[var(--line)]">
                        {SHORTCUT_DEFINITIONS.map((definition) => {
                            const value = shortcutDraft[definition.id];
                            const conflictingIds = value ? (conflicts.get(value) ?? []).filter((id) => id !== definition.id) : [];
                            const conflictingNames = conflictingIds
                                .map((id) => SHORTCUT_DEFINITIONS.find((item) => item.id === id))
                                .filter(Boolean)
                                .map((item) => t(item!.labelKey))
                                .join(", ");
                            return (
                                <div className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4" key={definition.id}>
                                    <div className="min-w-0">
                                        <div className="text-sm text-[var(--text)]">{t(definition.labelKey)}</div>
                                        <div className="mt-0.5 text-xs text-[var(--muted)]">{t(definition.descriptionKey)}</div>
                                        {conflictingNames && (
                                            <div className="mt-1 text-xs text-red-500" data-testid={`shortcut-conflict-${definition.id.replace(".", "-")}`}>
                                                {t("settings:shortcuts.conflict", { commands: conflictingNames })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            className={`min-w-28 rounded-xl border px-3 py-2 text-center text-xs font-medium transition-colors ${recordingShortcutId === definition.id ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--field)] text-[var(--text)] hover:border-[var(--accent)]"}`}
                                            type="button"
                                            data-testid={`shortcut-recorder-${definition.id.replace(".", "-")}`}
                                            data-shortcut-recorder="true"
                                            onFocus={() => setRecordingShortcutId(definition.id)}
                                            onBlur={() => setRecordingShortcutId((current) => current === definition.id ? null : current)}
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
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            );
        }

        if (activeSection === 3) {
            return (
                <>
                    <section className="mb-6">
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:data.autoBackup")}
                        </h2>
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    {t("settings:data.enableAutoBackup")}
                                </span>
                                <div className="mt-0.5 text-xs text-[var(--muted)]">
                                    {t("settings:data.enableAutoBackupDesc")}
                                </div>
                            </div>
                            {renderToggle(autoBackupConfig?.enabled ?? false, (v) => {
                                if (autoBackupConfig) {
                                    updateAutoBackupConfig({ ...autoBackupConfig, enabled: v });
                                }
                            })}
                        </div>
                        {autoBackupConfig?.enabled && (
                            <>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        {t("settings:data.backupInterval")}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            className="w-20"
                                            options={Array.from({ length: 30 }, (_, i) => ({
                                                value: String(i + 1),
                                                label: String(i + 1),
                                            }))}
                                            value={String(autoBackupConfig.interval_days)}
                                            onChange={(v) =>
                                                updateAutoBackupConfig({
                                                    ...autoBackupConfig,
                                                    interval_days: Number(v),
                                                })
                                            }
                                        />
                                        <span className="text-sm text-[var(--muted)]">{t("settings:data.days")}</span>
                                    </div>
                                </div>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        {t("settings:data.maxBackups")}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            className="w-20"
                                            options={[5, 10, 20, 50, 100].map((n) => ({
                                                value: String(n),
                                                label: String(n),
                                            }))}
                                            value={String(autoBackupConfig.max_backups)}
                                            onChange={(v) =>
                                                updateAutoBackupConfig({
                                                    ...autoBackupConfig,
                                                    max_backups: Number(v),
                                                })
                                            }
                                        />
                                        <span className="text-sm text-[var(--muted)]">{t("settings:data.backupsUnit")}</span>
                                    </div>
                                </div>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        {t("settings:data.expireDays")}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            className="w-20"
                                            options={[30, 60, 90, 180, 365].map((n) => ({
                                                value: String(n),
                                                label: String(n),
                                            }))}
                                            value={String(autoBackupConfig.expire_days)}
                                            onChange={(v) =>
                                                updateAutoBackupConfig({
                                                    ...autoBackupConfig,
                                                    expire_days: Number(v),
                                                })
                                            }
                                        />
                                        <span className="text-sm text-[var(--muted)]">{t("settings:data.days")}</span>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.backupDir")}
                            </span>
                            <span className="max-w-[60%] truncate text-sm text-[var(--muted)]">
                                {backupDirPath || t("common:buttons.loading")}
                            </span>
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.lastBackup")}
                            </span>
                            <span className="text-sm text-[var(--muted)]">
                                {autoBackupConfig?.last_backup_at
                                    ? new Date(autoBackupConfig.last_backup_at).toLocaleString()
                                    : t("settings:data.neverBackup")}
                            </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                            <button
                                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
                                data-testid="settings-backup-now-btn"
                                type="button"
                                onClick={() => triggerBackupNow()}
                            >
                                {t("settings:data.backupNow")}
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
                                data-testid="settings-backup-manager-btn"
                                type="button"
                                onClick={() => setBackupManagerOpen(true)}
                            >
                                <Settings2 className="h-4 w-4" />
                                {t("settings:data.backupManager")}
                            </button>
                            <BackupManagerModal
                                open={backupManagerOpen}
                                onClose={() => setBackupManagerOpen(false)}
                            />
                        </div>
                    </section>
                    <section className="mb-6">
                        <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">
                            {t("settings:data.importExport")}
                        </h2>
                        <div className="mb-3 text-sm text-[var(--muted)]">
                            {t("settings:data.importExportDesc")}
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-3 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={() => setExportModalOpen(true)}
                            >
                                <Download className="h-4 w-4" />
                                {t("settings:data.export")}
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-3 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={() => setImportModalOpen(true)}
                            >
                                <Upload className="h-4 w-4" />
                                {t("settings:data.import")}
                            </button>
                        </div>
                        <ExportModal
                            open={exportModalOpen}
                            onClose={() => setExportModalOpen(false)}
                        />
                        <ImportModal
                            open={importModalOpen}
                            onClose={() => setImportModalOpen(false)}
                        />
                    </section>
                    <section>
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:data.database")}
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.dbSize")}
                            </span>
                            <span className="text-sm text-[var(--muted)]">
                                {dbSize}
                            </span>
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.dbPath")}
                            </span>
                            <button
                                className="max-w-[60%] truncate rounded-full bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
                                type="button"
                                title={dbPath}
                                onClick={async () => {
                                    try {
                                        await copyTextToSystemClipboard(dbPath);
                                        useToastStore
                                            .getState()
                                            .addToast(
                                                "success",
                                                t("common:toast.pathCopied"),
                                            );
                                    } catch {
                                        useToastStore
                                            .getState()
                                            .addToast("error", t("common:toast.copyFailed"));
                                    }
                                }}
                            >
                                {dbPath || t("common:buttons.loading")}
                            </button>
                        </div>
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    {t("settings:data.optimize")}
                                </span>
                                <div className="mt-1 text-xs text-[var(--muted)]">
                                    {t("settings:data.optimizeDesc")}
                                </div>
                            </div>
                            <button
                                className="rounded-full bg-[var(--field)] px-3 py-1.5 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                data-testid="optimize-db-btn"
                                onClick={() => optimizeDb()}
                            >
                                {t("settings:data.optimizeBtn")}
                            </button>
                        </div>
                    </section>
                    <section className="mt-6" data-testid="storage-consistency-section">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-[var(--text)]">
                                    {t("settings:data.storageConsistency")}
                                </h2>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                    {t("settings:data.storageConsistencyDesc")}
                                </p>
                            </div>
                            <button
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--field)] px-3 py-1.5 text-sm hover:bg-[var(--hover)] disabled:cursor-wait disabled:opacity-60"
                                type="button"
                                data-testid="storage-consistency-scan-btn"
                                disabled={storageScanLoading}
                                onClick={() => void fetchStorageConsistency()}
                            >
                                <RefreshCw className={`h-4 w-4 ${storageScanLoading ? "animate-spin" : ""}`} />
                                {t("settings:data.storageScan")}
                            </button>
                        </div>
                        {storageReport ? (
                            <>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        {t("settings:data.storageMissingFiles")}
                                    </span>
                                    <span className="text-sm text-[var(--muted)]" data-testid="storage-missing-count">
                                        {storageReport.missingFiles.length}
                                    </span>
                                </div>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        {t("settings:data.storageOrphanFiles")}
                                    </span>
                                    <span className="text-sm text-[var(--muted)]" data-testid="storage-orphan-count">
                                        {storageReport.orphanFiles.length}
                                    </span>
                                </div>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        {t("settings:data.storageBrokenReferences")}
                                    </span>
                                    <span className="text-sm text-[var(--muted)]" data-testid="storage-broken-reference-count">
                                        {storageReport.brokenReferences.length}
                                    </span>
                                </div>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        {t("settings:data.storageUsage")}
                                    </span>
                                    <span className="text-sm text-[var(--muted)]">
                                        {formatStorageBytes(storageReport.storageBytes)} · {t("settings:data.storageScannedFiles", { count: storageReport.scannedFiles })}
                                    </span>
                                </div>
                                <StorageIssueDetails
                                    title={t("settings:data.storageMissingFiles")}
                                    issues={storageReport.missingFiles}
                                    testId="storage-missing-details"
                                />
                                <StorageIssueDetails
                                    title={t("settings:data.storageOrphanFiles")}
                                    issues={storageReport.orphanFiles}
                                    testId="storage-orphan-details"
                                />
                                <StorageIssueDetails
                                    title={t("settings:data.storageBrokenReferences")}
                                    issues={storageReport.brokenReferences}
                                    testId="storage-broken-reference-details"
                                />
                                {storageReport.orphanFiles.length > 0 && (
                                    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--field)] p-3">
                                        <span className="text-xs text-[var(--muted)]">
                                            {t("settings:data.storageRepairDesc")}
                                        </span>
                                        <button
                                            className="shrink-0 rounded-full bg-[var(--danger)]/10 px-3 py-1.5 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/20 disabled:opacity-60"
                                            type="button"
                                            data-testid="storage-consistency-repair-btn"
                                            disabled={storageScanLoading}
                                            onClick={() => {
                                                if (window.confirm(t("settings:data.storageRepairConfirm"))) {
                                                    void repairStorageConsistency();
                                                }
                                            }}
                                        >
                                            {t("settings:data.storageRepair")}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="py-3 text-sm text-[var(--muted)]">
                                {storageScanLoading ? t("settings:data.storageScanning") : t("settings:data.storageUnavailable")}
                            </p>
                        )}
                    </section>
                    <section className="mt-6">
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:data.diagnostics")}
                        </h2>
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    {t("settings:data.sqlLog")}
                                </span>
                                <div className="mt-1 text-xs text-[var(--muted)]">
                                    {t("settings:data.sqlLogDesc")}
                                </div>
                            </div>
                            {renderToggle(settings.sqlLogging.enabled, (v) =>
                                updateSqlLogging({ enabled: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.outputToConsole")}
                            </span>
                            {renderToggle(settings.sqlLogging.toConsole, (v) =>
                                updateSqlLogging({ toConsole: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.outputToFile")}
                            </span>
                            {renderToggle(settings.sqlLogging.toFile, (v) =>
                                updateSqlLogging({ toFile: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.formatSql")}
                            </span>
                            {renderToggle(settings.sqlLogging.pretty, (v) =>
                                updateSqlLogging({ pretty: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.maxLen")}
                            </span>
                            <Select
                                className="w-28"
                                options={[
                                    { value: "1000", label: "1,000" },
                                    { value: "4000", label: "4,000" },
                                    { value: "10000", label: "10,000" },
                                    { value: "50000", label: "50,000" },
                                ]}
                                value={String(settings.sqlLogging.maxLen)}
                                onChange={(v) => updateSqlLogging({ maxLen: Number(v) })}
                            />
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:data.sqlLogFile")}
                            </span>
                            <button
                                className="max-w-[60%] truncate rounded-full bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
                                type="button"
                                title={sqlLogPath}
                                onClick={async () => {
                                    try {
                                        await copyTextToSystemClipboard(sqlLogPath);
                                        useToastStore
                                            .getState()
                                            .addToast("success", t("common:toast.sqlLogPathCopied"));
                                    } catch {
                                        useToastStore
                                            .getState()
                                            .addToast("error", t("common:toast.copyFailed"));
                                    }
                                }}
                            >
                                {sqlLogPath || t("common:buttons.loading")}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={handleOpenLogDir}
                            >
                                <FileText className="h-4 w-4" />
                                {t("settings:data.openLogDir")}
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
                                data-testid="settings-clear-sql-log-btn"
                                type="button"
                                onClick={() => clearSqlLogFile()}
                            >
                                <Trash2 className="h-4 w-4" />
                                {t("settings:data.clearSqlLog")}
                            </button>
                        </div>
                    </section>
                </>
            );
        }

        if (activeSection === 4) {
            return (
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                        {t("settings:data.syncTitle")}
                    </h2>
                    <SyncSettingsPanel showAccount={false} />
                </section>
            );
        }

        return (
            <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <span className="inline-block rounded-md bg-[var(--accent)] px-2.5 py-1 text-white">QuantaNote</span>
                    <span data-testid="settings-about-version" className="inline-block rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent)]">v{updateState.currentVersion}</span>
                </h2>
                <div className="mb-4 text-sm text-[var(--muted)]">
                    {t("settings:about.description")}
                </div>
                <div className="space-y-2 text-sm text-[var(--muted)]">
                    <div>{t("settings:about.author")}</div>
                    <div>{t("settings:about.techStack")}</div>
                    <div>{t("settings:about.searchEngine")}</div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="translate-y-[1px]"><Github size={14} /></span>
                        {t("settings:about.github")}
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://quantanote-docs.shenjianl.cn/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="translate-y-[1px]"><BookOpen size={14} /></span>
                        {t("settings:about.docs")}
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="translate-y-[1px]"><MessageSquare size={14} /></span>
                        {t("settings:about.feedback")}
                    </a>
                </div>

                {/* 更新检查 */}
                {!isMobilePlatform && (
                <section className="mt-6">
                    <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                        {t("settings:about.updateSection")}
                    </h2>
                    <div className={rowClass}>
                        <div>
                            <span className="text-sm text-[var(--text)]">
                                {t("settings:about.autoUpdateEnabled")}
                            </span>
                            <div className="mt-0.5 text-xs text-[var(--muted)]">
                                {t("settings:about.autoUpdateEnabledDesc")}
                            </div>
                        </div>
                        {renderToggle(settings.autoUpdateEnabled, (v) =>
                            updateSetting("autoUpdateEnabled", v),
                        )}
                    </div>
                    <div className="py-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text)]">
                                {t("settings:about.currentVersion")}
                            </span>
                            <span className="text-[var(--muted)]">
                                v{updateState.currentVersion}
                            </span>
                        </div>
                        {updateState.latestVersion && (
                            <div className="mt-0.5 text-xs text-[var(--muted)]">
                                v{updateState.latestVersion}
                            </div>
                        )}
                    </div>
                    <div className="py-2">
                        <span className="text-sm text-[var(--muted)]">
                            {(() => {
                                switch (updateState.status as string) {
                                    case "idle": return t("settings:about.updateStatusIdle");
                                    case "checking": return t("settings:about.updateStatusChecking");
                                    case "available": return t("settings:about.updateStatusAvailable");
                                    case "downloading": return t("settings:about.updateStatusDownloading");
                                    case "downloaded": return t("settings:about.updateStatusDownloaded");
                                    case "up-to-date": return t("settings:about.updateStatusUpToDate");
                                    case "error": return updateState.error || t("settings:about.updateStatusError");
                                    default: return "";
                                }
                            })()}
                        </span>
                        {updateState.status === "downloaded" && (
                            <div className="mt-1 text-xs text-[var(--accent)]">
                                {t("settings:about.updateReadyToInstall")}
                            </div>
                        )}
                    </div>
                    {updateState.status === "downloading" && updateState.contentLength !== null && (
                        <div className="mb-3 space-y-1.5">
                            <div className="h-2 rounded-full bg-[var(--field)]">
                                <div
                                    className="h-2 rounded-full bg-[var(--accent)] transition-[width]"
                                    style={{
                                        width: `${Math.min(100, Math.round((updateState.downloadedBytes / updateState.contentLength) * 100))}%`,
                                    }}
                                />
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                                {Math.round((updateState.downloadedBytes / updateState.contentLength) * 100)}%
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
                            type="button"
                            disabled={updateState.status === "checking" || updateState.status === "downloading"}
                            onClick={() => checkForUpdates()}
                        >
                            <RefreshCw className={`h-4 w-4 ${updateState.status === "checking" ? "animate-spin" : ""}`} />
                            {t("settings:about.updateCheck")}
                        </button>
                        <button
                            className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)] disabled:opacity-50"
                            type="button"
                            disabled={
                                updateState.status !== "available" &&
                                updateState.status !== "downloaded"
                            }
                            onClick={() =>
                                updateState.status === "downloaded"
                                    ? installUpdate()
                                    : downloadUpdate()
                            }
                        >
                            <Download className="h-4 w-4" />
                            {updateState.status === "downloaded"
                                ? t("settings:about.updateInstall")
                                : t("settings:about.updateDownload")}
                        </button>
                    </div>
                </section>
                )}
            </section>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-2 bg-[var(--app-bg)] p-2 sm:flex-row sm:gap-3 sm:p-4">
            <nav className="flex shrink-0 gap-1 overflow-x-auto px-1 sm:w-36 sm:flex-col sm:space-y-1 sm:overflow-x-visible sm:px-0">
                {settingsMenu.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <button
                            className={`flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm ${index === activeSection ? "bg-[var(--nav-active)] text-[var(--text)] font-medium" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
                            key={item.label}
                            onClick={() => setActiveSection(index)}
                            type="button"
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <main className="min-h-0 flex-1 overflow-auto rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-3 sm:p-5">
                {renderSection()}
            </main>
        </div>
    );
}
