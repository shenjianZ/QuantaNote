import {
  Bell,
  Cloud,
  Database,
  Download,
  FlaskConical,
  Globe2,
  HardDrive,
  Keyboard,
  Palette,
  Shield,
  ToggleRight,
  Upload,
} from "lucide-react";

const settingsMenu = [
  { icon: Palette, label: "常规", desc: "外观、语言、窗口与启动" },
  { icon: Shield, label: "安全与隐私", desc: "密码、加密与数据保护" },
  { icon: Cloud, label: "云同步", desc: "账号、同步与设备" },
  { icon: HardDrive, label: "备份与恢复", desc: "备份计划与恢复选项" },
  { icon: Bell, label: "通知", desc: "消息提醒与推送" },
  { icon: Keyboard, label: "快捷键", desc: "全局快捷键与操作" },
  { icon: Database, label: "数据库", desc: "存储、维护与性能" },
  { icon: Download, label: "导入导出", desc: "数据迁移与文件处理" },
  { icon: FlaskConical, label: "实验功能", desc: "Beta 功能与反馈" },
  { icon: Globe2, label: "关于", desc: "版本与许可信息" },
];

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>设置中心</h1>
      <div className="settings-layout">
        <aside className="settings-menu">
          {settingsMenu.map((item, index) => {
            const Icon = item.icon;
            return (
            <button className={index === 0 ? "active" : ""} key={item.label} type="button">
              <Icon size={20} />
              <span>{item.label}</span>
              <small>{item.desc}</small>
            </button>
            );
          })}
        </aside>

        <div className="settings-content">
          <section className="content-panel">
            <h2>外观主题</h2>
            <div className="theme-row">
              <button className="theme-thumb dark active" type="button"><span /></button>
              <button className="theme-thumb light" type="button"><span /></button>
              <button className="theme-thumb system" type="button"><span /></button>
            </div>
            <label>强调色</label>
            <div className="color-row">
              {["#22d3ee", "#38bdf8", "#818cf8", "#c084fc", "#fb7185", "#f59e0b", "#22c55e"].map(
                (color) => <button type="button" key={color} style={{ background: color }} />,
              )}
            </div>
            <div className="select-row"><span>界面缩放</span><strong>100%（推荐）</strong></div>
            <div className="select-row"><span>语言</span><strong>简体中文</strong></div>
          </section>

          <section className="content-panel">
            <h2>窗口行为</h2>
            {["最小化到托盘", "关闭到托盘（非退出）", "显示最近打开的记录"].map((item) => (
              <div className="setting-row" key={item}>
                <span>{item}</span>
                <ToggleRight size={34} />
              </div>
            ))}
            <div className="select-row"><span>启动时</span><strong>打开首页</strong></div>
            <div className="select-row"><span>动画效果</span><strong>跟随系统</strong></div>
          </section>

          <section className="content-panel">
            <h2>快捷键</h2>
            {[
              ["全局搜索", "Ctrl + K"],
              ["新建记录", "Ctrl + N"],
              ["锁定应用", "Ctrl + Shift + L"],
              ["复制用户名", "Ctrl + Alt + U"],
              ["自动填充", "Ctrl + Alt + 空格"],
            ].map(([name, keys]) => (
              <div className="shortcut-row" key={name}>
                <span>{name}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </section>

          <section className="content-panel">
            <h2>云同步</h2>
            <div className="setting-row"><span>同步状态</span><strong className="success-text">同步正常</strong></div>
            <div className="progress"><span style={{ width: "24.5%" }} /></div>
            <div className="select-row"><span>同步方式</span><strong>实时同步</strong></div>
            <div className="setting-row"><span>仅在 Wi-Fi 下同步</span><ToggleRight size={34} /></div>
          </section>

          <section className="content-panel small-panel">
            <h2>端到端加密</h2>
            <div className="select-row"><span>加密算法</span><strong>AES-256-GCM</strong></div>
            <div className="select-row"><span>密钥派生</span><strong>PBKDF2 (600,000)</strong></div>
          </section>

          <section className="content-panel small-panel">
            <h2>数据库维护</h2>
            <div className="setting-row"><span>数据库大小</span><strong>286.4 MB</strong></div>
            <button type="button">优化与清理</button>
          </section>

          <section className="content-panel small-panel">
            <h2>导入导出</h2>
            <button type="button"><Upload size={17} />导入</button>
            <button type="button"><Download size={17} />导出</button>
          </section>

          <section className="content-panel small-panel">
            <h2>实验功能</h2>
            {["AI 智能标签", "Passkey 支持", "智能填充建议"].map((item, index) => (
              <div className="setting-row" key={item}>
                <span>{item}</span>
                <ToggleRight size={32} className={index === 2 ? "muted-toggle" : ""} />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
