import { useEffect, useState } from "react";
import {
    Cloud,
    Database,
    Download,
    FileText,
    Globe2,
    Laptop,
    Moon,
    Palette,
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
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";

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

export function SettingsPage({
    theme = "system",
    onThemeChange,
}: SettingsPageProps) {
    const { t } = useTranslation(["settings", "common"]);
    const [activeSection, setActiveSection] = useState(0);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [backupManagerOpen, setBackupManagerOpen] = useState(false);
    const settings = useSettingsStore((s) => s.settings);
    const dbSize = useSettingsStore((s) => s.dbSize);
    const dbPath = useSettingsStore((s) => s.dbPath);
    const autoBackupConfig = useSettingsStore((s) => s.autoBackupConfig);
    const backupDirPath = useSettingsStore((s) => s.backupDirPath);
    const logDir = useSettingsStore((s) => s.logDir);
    const sqlLogPath = useSettingsStore((s) => s.sqlLogPath);
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
    const updateSqlLogging = useSettingsStore((s) => s.updateSqlLogging);
    const clearSqlLogFile = useSettingsStore((s) => s.clearSqlLogFile);

    useEffect(() => {
        init();
        refreshDbSize();
        fetchDbPath();
        fetchAutoBackupConfig();
        fetchBackupDirPath();
        fetchBackups();
        fetchDiagnosticsPaths();
    }, [init, refreshDbSize, fetchDbPath, fetchAutoBackupConfig, fetchBackupDirPath, fetchBackups, fetchDiagnosticsPaths]);

    function renderToggle(value: boolean, onChange: (v: boolean) => void) {
        return (
            <button
                type="button"
                className={`relative h-6 w-11 rounded-full border border-[var(--line)] transition ${value ? "bg-[var(--accent)]" : "bg-[var(--field)]"}`}
                onClick={() => onChange(!value)}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`}
                />
            </button>
        );
    }

    const settingsMenu = [
        { label: t("settings:menu.appearance"), icon: Palette },
        { label: t("settings:menu.font"), icon: Globe2 },
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
                        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                            {t("settings:appearance.accentColor")}
                        </h2>
                        <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">{t("settings:appearance.predefined")}</div>
                        <div className="mb-4 flex flex-wrap gap-2.5">
                            {ACCENT_COLOR_KEYS.map((c) => (
                                <button
                                    className={`h-7 w-7 rounded-full border border-[var(--line)] transition-transform hover:scale-110 ${c.value === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
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
                                        className={`h-7 w-7 rounded-full border border-[var(--line)] transition-transform hover:scale-110 ${c.hex === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
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
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
                    </section>
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
                    <section>
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            {t("settings:data.locale")}
                        </h2>
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    {t("settings:data.locale")}
                                </span>
                                <div className="mt-0.5 text-xs text-[var(--muted)]">
                                    {t("settings:data.localeDesc")}
                                </div>
                            </div>
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
                                type="button"
                                onClick={() => triggerBackupNow()}
                            >
                                {t("settings:data.backupNow")}
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
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
                                        await navigator.clipboard.writeText(
                                            dbPath,
                                        );
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
                                        await navigator.clipboard.writeText(sqlLogPath);
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
                                onClick={() => logDir && openPath(logDir)}
                            >
                                <FileText className="h-4 w-4" />
                                {t("settings:data.openLogDir")}
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
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

        if (activeSection === 3) {
            return (
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                        {t("settings:data.syncTitle")}
                    </h2>
                    <SyncSettingsPanel />
                </section>
            );
        }

        return (
            <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <span className="inline-block rounded-md bg-[var(--accent)] px-2.5 py-1 text-white">QuantaNote</span>
                    <span className="inline-block rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent)]">v0.1.0</span>
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
                        {t("settings:about.github")}
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote#readme"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("settings:about.docs")}
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("settings:about.feedback")}
                    </a>
                </div>
            </section>
        );
    }

    return (
        <div className="flex h-full min-h-0 gap-3 bg-[var(--app-bg)] p-4">
            <nav className="w-36 shrink-0 space-y-1">
                {settingsMenu.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <button
                            className={`flex h-10 w-full items-center gap-2 rounded-full px-3 text-sm ${index === activeSection ? "bg-[var(--nav-active)] text-[var(--text)] font-medium" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
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

            <main className="min-h-0 flex-1 overflow-auto rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-5">
                {renderSection()}
            </main>
        </div>
    );
}
