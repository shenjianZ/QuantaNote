import { useEffect, useState } from "react";
import {
  Database,
  Download,
  Globe2,
  Keyboard,
  Laptop,
  Moon,
  Palette,
  Sun,
  Upload,
} from "lucide-react";
import type { ThemeMode } from "../hooks/useTheme";
import { useSettingsStore } from "../stores/settingsStore";

const settingsMenu = [
  { icon: Palette, label: "外观" },
  { icon: Keyboard, label: "字体" },
  { icon: Database, label: "数据" },
  { icon: Globe2, label: "关于" },
];

const FONT_OPTIONS = [
  { value: "Noto Sans SC", label: "Noto Sans SC" },
  { value: "Inter", label: "Inter" },
  { value: "LXGW WenKai", label: "霞鹜文楷" },
  { value: "system-ui", label: "系统默认" },
];

const MONO_OPTIONS = [
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "Source Code Pro", label: "Source Code Pro" },
  { value: "Consolas", label: "Consolas" },
];

const ACCENT_COLORS = [
  { value: "#386c5f", label: "松绿" },
  { value: "#2563eb", label: "蓝色" },
  { value: "#7c3aed", label: "紫色" },
  { value: "#c47b12", label: "琥珀" },
  { value: "#b64242", label: "红色" },
];

interface SettingsPageProps {
  theme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

const rowClass = "flex min-h-12 items-center justify-between gap-4 border-b border-[var(--line)] py-2 last:border-b-0";
const selectClass = "h-9 rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none";

export function SettingsPage({ theme = "system", onThemeChange }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState(0);
  const settings = useSettingsStore((s) => s.settings);
  const dbSize = useSettingsStore((s) => s.dbSize);
  const init = useSettingsStore((s) => s.init);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const refreshDbSize = useSettingsStore((s) => s.refreshDbSize);
  const optimizeDb = useSettingsStore((s) => s.optimizeDb);
  const exportData = useSettingsStore((s) => s.exportData);
  const importData = useSettingsStore((s) => s.importData);

  useEffect(() => {
    init();
    refreshDbSize();
  }, [init, refreshDbSize]);

  function renderToggle(value: boolean, onChange: (v: boolean) => void) {
    return (
      <button
        type="button"
        className={`relative h-6 w-11 rounded-full border border-[var(--line)] transition ${value ? "bg-[var(--accent)]" : "bg-[var(--field)]"}`}
        onClick={() => onChange(!value)}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${value ? "left-6" : "left-1"}`} />
      </button>
    );
  }

  function renderSection() {
    if (activeSection === 0) {
      return (
        <>
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">外观主题</h2>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "system" as ThemeMode, icon: Laptop, label: "跟随系统" },
                { value: "light" as ThemeMode, icon: Sun, label: "浅色" },
                { value: "dark" as ThemeMode, icon: Moon, label: "深色" },
              ]).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm ${theme === opt.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]" : "border-[var(--line)] bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"}`}
                    key={opt.value}
                    onClick={() => onThemeChange?.(opt.value)}
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
            <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">强调色</h2>
            <div className="flex gap-3">
              {ACCENT_COLORS.map((c) => (
                <button
                  className={`h-7 w-7 rounded-full border border-[var(--line)] ${c.value === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                  key={c.value}
                  style={{ background: c.value }}
                  title={c.label}
                  type="button"
                  onClick={() => updateSetting("accentColor", c.value)}
                />
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">窗口行为</h2>
            {([
              { key: "minimizeToTray" as const, label: "最小化到托盘" },
              { key: "closeKeepRunning" as const, label: "关闭时保持运行" },
            ]).map((item) => (
              <div className={rowClass} key={item.key}>
                <span className="text-sm text-[var(--text)]">{item.label}</span>
                {renderToggle(settings[item.key], (v) => updateSetting(item.key, v))}
              </div>
            ))}
          </section>
        </>
      );
    }

    if (activeSection === 1) {
      return (
        <>
          <section className="mb-6">
            <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">字体</h2>
            <div className={rowClass}>
              <span className="text-sm text-[var(--text)]">界面字体</span>
              <select className={selectClass} value={settings.fontFamily} onChange={(e) => updateSetting("fontFamily", e.target.value)}>
                {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className={rowClass}>
              <span className="text-sm text-[var(--text)]">等宽字体</span>
              <select className={selectClass} value={settings.fontMono} onChange={(e) => updateSetting("fontMono", e.target.value)}>
                {MONO_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">字号</h2>
            <div className={rowClass}>
              <span className="text-sm text-[var(--text)]">界面字号</span>
              <div className="flex items-center gap-3">
                <input type="range" min={14} max={18} step={1} value={settings.fontSize} onChange={(e) => updateSetting("fontSize", Number(e.target.value))} />
                <span className="font-mono text-xs text-[var(--muted)]">{settings.fontSize}px</span>
              </div>
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
            <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">备份与恢复</h2>
            <div className={rowClass}>
              <span className="text-sm text-[var(--text)]">自动备份</span>
              {renderToggle(settings.autoBackup, (v) => updateSetting("autoBackup", v))}
            </div>
            <div className={rowClass}>
              <span className="text-sm text-[var(--text)]">手动备份</span>
              <button className="rounded-full bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]" type="button" onClick={() => exportData()}>立即备份</button>
            </div>
            <div className={rowClass}>
              <span className="text-sm text-[var(--text)]">恢复数据</span>
              <button className="rounded-full bg-[var(--field)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]" type="button" onClick={() => importData()}>选择文件</button>
            </div>
          </section>
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">导入导出</h2>
            <div className="mb-3 text-sm text-[var(--muted)]">导出为 JSON 格式，包含所有记录和标签。</div>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-3 py-2 text-sm hover:bg-[var(--hover)]" type="button" onClick={() => importData()}><Upload className="h-4 w-4" />导入</button>
              <button className="inline-flex items-center gap-2 rounded-full bg-[var(--field)] px-3 py-2 text-sm hover:bg-[var(--hover)]" type="button" onClick={() => exportData()}><Download className="h-4 w-4" />导出</button>
            </div>
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">数据库</h2>
            <div className={rowClass}><span className="text-sm text-[var(--text)]">数据库大小</span><span className="text-sm text-[var(--muted)]">{dbSize}</span></div>
            <div className={rowClass}><span className="text-sm text-[var(--text)]">存储位置</span><span className="text-sm text-[var(--muted)]">应用数据目录</span></div>
            <div className={rowClass}><span className="text-sm text-[var(--text)]">优化</span><button className="rounded-full bg-[var(--field)] px-3 py-1.5 text-sm hover:bg-[var(--hover)]" type="button" onClick={() => optimizeDb()}>优化与清理</button></div>
          </section>
        </>
      );
    }

    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">QuantaNote</h2>
        <div className="space-y-2 text-sm text-[var(--muted)]">
          <div>版本 0.1.0</div>
          <div>本地优先的笔记管理工具</div>
          <div>技术栈: Tauri 2 + React 19 + Rust + SQLite</div>
          <div>搜索: SQLite FTS5 全文搜索</div>
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
              className={`flex h-10 w-full items-center gap-2 rounded-full px-3 text-sm ${index === activeSection ? "bg-[var(--paper)] text-[var(--text)] shadow-sm" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
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
