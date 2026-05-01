import { useEffect, useState } from "react";
import {
    Database,
    Download,
    FileText,
    Globe2,
    Keyboard,
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
import type { ThemeMode } from "../hooks/useTheme";
import { BackupManagerModal } from "../components/common/BackupManagerModal";
import { ColorPickerModal } from "../components/common/ColorPickerModal";
import { ExportModal } from "../components/common/ExportModal";
import { ImportModal } from "../components/common/ImportModal";
import { Select } from "../components/common/Select";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";

const settingsMenu = [
    { icon: Palette, label: "外观" },
    { icon: Keyboard, label: "字体" },
    { icon: Database, label: "数据" },
    { icon: Globe2, label: "关于" },
];

const FONT_OPTIONS = [
    { value: "Noto Sans SC", label: "Noto Sans SC" },
    { value: "system-ui", label: "系统默认" },
];

const MONO_OPTIONS = [
    { value: "JetBrains Mono", label: "JetBrains Mono" },
    { value: "Consolas", label: "Consolas" },
    { value: "monospace", label: "系统等宽" },
];

const ACCENT_COLORS = [
    { value: "#386c5f", label: "松绿" },
    { value: "#2563eb", label: "蓝色" },
    { value: "#7c3aed", label: "紫色" },
    { value: "#c47b12", label: "琥珀" },
    { value: "#b64242", label: "红色" },
    { value: "#0891b2", label: "青色" },
    { value: "#059669", label: "翠绿" },
    { value: "#d97706", label: "橙色" },
    { value: "#e11d48", label: "玫红" },
    { value: "#6366f1", label: "靛蓝" },
    { value: "#8b5cf6", label: "紫罗兰" },
    { value: "#64748b", label: "石板灰" },
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

    function renderSection() {
        if (activeSection === 0) {
            return (
                <>
                    <section className="mb-6">
                        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                            外观主题
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {[
                                {
                                    value: "system" as ThemeMode,
                                    icon: Laptop,
                                    label: "跟随系统",
                                },
                                {
                                    value: "light" as ThemeMode,
                                    icon: Sun,
                                    label: "浅色",
                                },
                                {
                                    value: "dark" as ThemeMode,
                                    icon: Moon,
                                    label: "深色",
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
                            强调色
                        </h2>
                        <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">预定义</div>
                        <div className="mb-4 flex flex-wrap gap-2.5">
                            {ACCENT_COLORS.map((c) => (
                                <button
                                    className={`h-7 w-7 rounded-full border border-[var(--line)] transition-transform hover:scale-110 ${c.value === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                                    key={c.value}
                                    data-testid="accent-color"
                                    style={{ background: c.value }}
                                    title={c.label}
                                    type="button"
                                    onClick={() =>
                                        updateSetting("accentColor", c.value)
                                    }
                                />
                            ))}
                        </div>
                        <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">自定义</div>
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
                                title="添加自定义颜色"
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
                            窗口行为
                        </h2>
                        {[
                            {
                                key: "minimizeToTray" as const,
                                label: "最小化到系统托盘",
                                desc: "点击最小化按钮时，将窗口隐藏到托盘",
                            },
                            {
                                key: "closeKeepRunning" as const,
                                label: "关闭窗口时隐藏到托盘",
                                desc: "点击关闭按钮时，不退出应用，而是隐藏到托盘",
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
                            系统
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                开机自动启动
                            </span>
                            {renderToggle(settings.autostart, (v) =>
                                updateSetting("autostart", v),
                            )}
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
                            字体
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                界面字体
                            </span>
                            <Select
                                className="w-48"
                                options={FONT_OPTIONS}
                                value={settings.fontFamily}
                                onChange={(v) => updateSetting("fontFamily", v)}
                            />
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                等宽字体
                            </span>
                            <Select
                                className="w-48"
                                options={MONO_OPTIONS}
                                value={settings.fontMono}
                                onChange={(v) => updateSetting("fontMono", v)}
                            />
                        </div>
                    </section>
                    <section>
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            字号
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                界面字号
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
                            这是一段预览文字 The quick brown fox
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
                            自动备份
                        </h2>
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    启用自动备份
                                </span>
                                <div className="mt-0.5 text-xs text-[var(--muted)]">
                                    定时在后台创建 ZIP 备份
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
                                        备份间隔
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
                                        <span className="text-sm text-[var(--muted)]">天</span>
                                    </div>
                                </div>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        最多保留
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
                                        <span className="text-sm text-[var(--muted)]">个备份</span>
                                    </div>
                                </div>
                                <div className={rowClass}>
                                    <span className="text-sm text-[var(--text)]">
                                        过期时长
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
                                        <span className="text-sm text-[var(--muted)]">天</span>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                备份目录
                            </span>
                            <span className="max-w-[60%] truncate text-sm text-[var(--muted)]">
                                {backupDirPath || "加载中..."}
                            </span>
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                上次备份
                            </span>
                            <span className="text-sm text-[var(--muted)]">
                                {autoBackupConfig?.last_backup_at
                                    ? new Date(autoBackupConfig.last_backup_at).toLocaleString()
                                    : "从未备份"}
                            </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                            <button
                                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
                                type="button"
                                onClick={() => triggerBackupNow()}
                            >
                                立即备份
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={() => setBackupManagerOpen(true)}
                            >
                                <Settings2 className="h-4 w-4" />
                                备份管理
                            </button>
                            <BackupManagerModal
                                open={backupManagerOpen}
                                onClose={() => setBackupManagerOpen(false)}
                            />
                        </div>
                    </section>
                    <section className="mb-6">
                        <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">
                            导入导出
                        </h2>
                        <div className="mb-3 text-sm text-[var(--muted)]">
                            导出为 ZIP 格式，可选择包含标签、附件和版本历史。
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-3 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={() => setExportModalOpen(true)}
                            >
                                <Download className="h-4 w-4" />
                                导出
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-3 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={() => setImportModalOpen(true)}
                            >
                                <Upload className="h-4 w-4" />
                                导入
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
                            数据库
                        </h2>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                数据库大小
                            </span>
                            <span className="text-sm text-[var(--muted)]">
                                {dbSize}
                            </span>
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                存储位置
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
                                                "路径已复制到剪贴板",
                                            );
                                    } catch {
                                        useToastStore
                                            .getState()
                                            .addToast("error", "复制失败");
                                    }
                                }}
                            >
                                {dbPath || "加载中..."}
                            </button>
                        </div>
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    优化
                                </span>
                                <div className="mt-1 text-xs text-[var(--muted)]">
                                    回收未使用空间并重建全文索引（VACUUM + FTS
                                    rebuild）
                                </div>
                            </div>
                            <button
                                className="rounded-full bg-[var(--field)] px-3 py-1.5 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                data-testid="optimize-db-btn"
                                onClick={() => optimizeDb()}
                            >
                                优化与清理
                            </button>
                        </div>
                    </section>
                    <section className="mt-6">
                        <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">
                            诊断日志
                        </h2>
                        <div className={rowClass}>
                            <div>
                                <span className="text-sm text-[var(--text)]">
                                    SQL 日志
                                </span>
                                <div className="mt-1 text-xs text-[var(--muted)]">
                                    仅用于排查问题，可能包含笔记内容、搜索词和文件路径
                                </div>
                            </div>
                            {renderToggle(settings.sqlLogging.enabled, (v) =>
                                updateSqlLogging({ enabled: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                输出到控制台
                            </span>
                            {renderToggle(settings.sqlLogging.toConsole, (v) =>
                                updateSqlLogging({ toConsole: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                输出到 SQL 日志文件
                            </span>
                            {renderToggle(settings.sqlLogging.toFile, (v) =>
                                updateSqlLogging({ toFile: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                格式化 SQL
                            </span>
                            {renderToggle(settings.sqlLogging.pretty, (v) =>
                                updateSqlLogging({ pretty: v }),
                            )}
                        </div>
                        <div className={rowClass}>
                            <span className="text-sm text-[var(--text)]">
                                单条最大长度
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
                                SQL 日志文件
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
                                            .addToast("success", "SQL 日志路径已复制");
                                    } catch {
                                        useToastStore
                                            .getState()
                                            .addToast("error", "复制失败");
                                    }
                                }}
                            >
                                {sqlLogPath || "加载中..."}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={() => logDir && openPath(logDir)}
                            >
                                <FileText className="h-4 w-4" />
                                打开日志目录
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-4 py-2 text-sm hover:bg-[var(--hover)]"
                                type="button"
                                onClick={() => clearSqlLogFile()}
                            >
                                <Trash2 className="h-4 w-4" />
                                清空 SQL 日志
                            </button>
                        </div>
                    </section>
                </>
            );
        }

        return (
            <section>
                <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                    QuantaNote v0.1.0
                </h2>
                <div className="mb-4 text-sm text-[var(--muted)]">
                    本地优先的笔记管理工具
                </div>
                <div className="space-y-2 text-sm text-[var(--muted)]">
                    <div>作者：shenjianZ</div>
                    <div>技术栈：Tauri 2 + React 19 + Rust + SQLite</div>
                    <div>搜索引擎：SQLite FTS5 全文搜索</div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        GitHub 仓库
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote#readme"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        使用文档
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        反馈问题
                    </a>
                </div>
            </section>
        );
    }

    return (
        <div className="flex h-full min-h-0 gap-3 bg-[var(--app-bg)] p-4">
            <nav className="w-28 shrink-0 space-y-1">
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
