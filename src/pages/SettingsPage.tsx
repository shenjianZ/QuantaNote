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
  { value: "Space Grotesk", label: "Space Grotesk" },
  { value: "Inter", label: "Inter" },
  { value: "Noto Sans SC", label: "Noto Sans SC（思源黑体）" },
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
  { value: "#22d3ee", label: "青色" },
  { value: "#38bdf8", label: "天蓝" },
  { value: "#818cf8", label: "靛蓝" },
  { value: "#c084fc", label: "紫色" },
  { value: "#fb7185", label: "玫红" },
  { value: "#f59e0b", label: "琥珀" },
  { value: "#22c55e", label: "绿色" },
];

interface SettingsPageProps {
  theme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

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
        className={`toggle ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
      />
    );
  }

  function renderSection() {
    switch (activeSection) {
      case 0: // 外观
        return (
          <>
            <div className="settings-group">
              <h4>外观主题</h4>
              <div className="theme-options">
                {([
                  { value: "system" as ThemeMode, icon: Laptop, label: "跟随系统" },
                  { value: "light" as ThemeMode, icon: Sun, label: "浅色" },
                  { value: "dark" as ThemeMode, icon: Moon, label: "深色" },
                ]).map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      className={`theme-option ${theme === opt.value ? "active" : ""}`}
                      key={opt.value}
                      onClick={() => onThemeChange?.(opt.value)}
                      type="button"
                    >
                      <Icon />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="settings-group">
              <h4>强调色</h4>
              <div className="color-options">
                {ACCENT_COLORS.map((c) => (
                  <button
                    className={`color-swatch ${c.value === settings.accentColor ? "active" : ""}`}
                    key={c.value}
                    style={{ background: c.value }}
                    title={c.label}
                    type="button"
                    onClick={() => updateSetting("accentColor", c.value)}
                  />
                ))}
              </div>
            </div>
            <div className="settings-group">
              <h4>窗口行为</h4>
              {([
                { key: "minimizeToTray" as const, label: "最小化到托盘" },
                { key: "closeKeepRunning" as const, label: "关闭时保持运行" },
              ]).map((item) => (
                <div className="setting-row" key={item.key}>
                  <div className="setting-label">{item.label}</div>
                  {renderToggle(settings[item.key], (v) => updateSetting(item.key, v))}
                </div>
              ))}
            </div>
          </>
        );

      case 1: // 字体
        return (
          <>
            <div className="settings-group">
              <h4>界面字体</h4>
              <div className="setting-row">
                <span className="setting-label">字体族</span>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => updateSetting("fontFamily", e.target.value)}
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text)",
                    border: "1px solid var(--border-input)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 12,
                  }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="setting-row">
                <span className="setting-label">等宽字体</span>
                <select
                  value={settings.fontMono}
                  onChange={(e) => updateSetting("fontMono", e.target.value)}
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text)",
                    border: "1px solid var(--border-input)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 12,
                  }}
                >
                  {MONO_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="settings-group">
              <h4>字号</h4>
              <div className="setting-row">
                <span className="setting-label">界面字号</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min={11}
                    max={18}
                    step={1}
                    value={settings.fontSize}
                    onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                    style={{ width: 120 }}
                  />
                  <span className="text-sm mono" style={{ minWidth: 32 }}>{settings.fontSize}px</span>
                </div>
              </div>
              <div className="setting-row">
                <span className="setting-label">预览</span>
                <span style={{ fontFamily: `'${settings.fontFamily}', sans-serif`, fontSize: `${settings.fontSize}px` }}>
                  这是一段预览文字 The quick brown fox
                </span>
              </div>
              <div className="setting-row">
                <span className="setting-label">等宽预览</span>
                <span style={{ fontFamily: `'${settings.fontMono}', monospace`, fontSize: `${settings.fontSize}px` }}>
                  {"fn main() { println!(\"Hello\"); }"}
                </span>
              </div>
            </div>
          </>
        );

      case 2: // 数据（备份恢复+数据库+导入导出）
        return (
          <>
            <div className="settings-group">
              <h4>备份与恢复</h4>
              <div className="setting-row">
                <div className="setting-label">自动备份</div>
                {renderToggle(settings.autoBackup, (v) => updateSetting("autoBackup", v))}
              </div>
              <div className="setting-row">
                <span className="setting-label">手动备份</span>
                <button className="btn sm" type="button" onClick={() => exportData()}>立即备份</button>
              </div>
              <div className="setting-row">
                <span className="setting-label">恢复数据</span>
                <button className="btn sm" type="button" onClick={() => importData()}>选择文件</button>
              </div>
            </div>
            <div className="settings-group">
              <h4>导入导出</h4>
              <div className="text-sm text-muted" style={{ marginBottom: 8 }}>
                导出为 JSON 格式，包含所有记录和标签
              </div>
              <div className="flex gap-6">
                <button className="btn" type="button" onClick={() => importData()}><Upload /> 导入</button>
                <button className="btn" type="button" onClick={() => exportData()}><Download /> 导出</button>
              </div>
            </div>
            <div className="settings-group">
              <h4>数据库</h4>
              <div className="setting-row">
                <span className="setting-label">数据库大小</span>
                <span className="text-sm text-muted">{dbSize}</span>
              </div>
              <div className="setting-row">
                <span className="setting-label">存储位置</span>
                <span className="text-sm text-muted">应用数据目录</span>
              </div>
              <div className="setting-row">
                <span className="setting-label">优化</span>
                <button className="btn sm" type="button" onClick={() => optimizeDb()}>优化与清理</button>
              </div>
            </div>
            <div className="settings-group">
              <h4>快捷键</h4>
              {[
                ["全局搜索", "⌘ K"],
                ["新建记录", "⌘ N"],
              ].map(([name, keys]) => (
                <div className="setting-row" key={name}>
                  <span className="setting-label">{name}</span>
                  <kbd>{keys}</kbd>
                </div>
              ))}
            </div>
          </>
        );

      case 3: // 关于
        return (
          <div className="settings-group">
            <h4>QuantaNote</h4>
            <div className="text-sm text-muted" style={{ marginBottom: 4 }}>版本 0.1.0</div>
            <div className="text-sm text-muted" style={{ marginBottom: 12 }}>本地优先的笔记管理工具</div>
            <div className="text-sm text-muted">技术栈: Tauri 2 + React 19 + Rust + SQLite</div>
            <div className="text-sm text-muted">搜索: SQLite FTS5 全文搜索</div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="settings-layout">
      <nav className="settings-menu">
        {settingsMenu.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              className={`settings-nav-item ${index === activeSection ? "active" : ""}`}
              key={item.label}
              onClick={() => setActiveSection(index)}
              type="button"
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="settings-content">
        {renderSection()}
      </div>
    </div>
  );
}
