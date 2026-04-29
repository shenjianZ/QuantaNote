import {
  CheckCircle2,
  Cloud,
  Database,
  Folder,
  HardDrive,
  Laptop,
  LockKeyhole,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  ToggleRight,
} from "lucide-react";

export function SyncSecurityPage() {
  const providers = [
    { icon: Cloud, name: "官方云", active: true },
    { icon: Database, name: "WebDAV", active: false },
    { icon: HardDrive, name: "Amazon S3", active: false },
    { icon: Folder, name: "本地文件夹", active: false },
  ];

  const devices = [
    { icon: Monitor, name: "我的 Windows 设备（本机）", meta: "Windows 11 · 桌面应用 · v1.8.0" },
    { icon: Laptop, name: "我的 MacBook Pro", meta: "macOS 14.4 · 最后活跃：5 分钟前" },
    { icon: Smartphone, name: "我的 iPhone 15 Pro", meta: "iOS 17.4 · 最后活跃：1 小时前" },
  ];

  return (
    <div className="sync-page">
      <h1>同步与安全</h1>
      <div className="sync-grid">
        <section className="content-panel account-panel">
          <h2>账户</h2>
          <div className="avatar">QN</div>
          <strong>个人账户</strong>
          <span>user@example.com</span>
          <button type="button">管理账户</button>
          <dl>
            <dt>账户类型</dt><dd>高级版</dd>
            <dt>会员有效期</dt><dd>2025-12-31</dd>
            <dt>账户存储空间</dt><dd>已使用 2.45 GB / 10 GB</dd>
          </dl>
          <div className="progress"><span style={{ width: "24.5%" }} /></div>
        </section>

        <section className="content-panel cloud-panel">
          <div className="panel-heading">
            <h2>云同步</h2>
            <span className="success-pill">同步正常</span>
          </div>
          <div className="provider-grid">
            {providers.map((provider) => {
              const Icon = provider.icon;
              return (
              <button className={provider.active ? "active" : ""} type="button" key={provider.name}>
                <Icon size={30} />
                <span>{provider.name}</span>
              </button>
              );
            })}
          </div>
          <div className="storage-row">
            <span>已使用 2.45 GB / 10 GB</span>
            <strong>24.5%</strong>
          </div>
          <div className="progress"><span style={{ width: "24.5%" }} /></div>
          <div className="stat-row">
            <span>记录数量 <strong>1,248</strong></span>
            <span>附件数量 <strong>342</strong></span>
            <span>同步文件数 <strong>1,590</strong></span>
          </div>
          <div className="button-row">
            <button type="button"><RefreshCw size={18} />立即同步</button>
            <button type="button">同步设置</button>
          </div>
        </section>

        <section className="content-panel shield-panel">
          <ShieldCheck size={94} />
          <h2>安全同步，始终保护</h2>
          <p>端到端加密确保只有您可以访问您的数据，随时随地安全可用。</p>
          <span><CheckCircle2 size={16} />所有数据均已加密</span>
        </section>

        <section className="content-panel devices-panel">
          <h2>设备管理</h2>
          {devices.map((device) => {
            const Icon = device.icon;
            return (
            <div className="device-row" key={device.name}>
              <Icon size={24} />
              <div>
                <strong>{device.name}</strong>
                <span>{device.meta}</span>
              </div>
            </div>
            );
          })}
          <button type="button">管理设备</button>
        </section>

        <section className="content-panel security-panel">
          <h2>端到端加密</h2>
          {[
            ["主密码", "已设置"],
            ["生物识别解锁", "已启用"],
            ["剪贴板自动清除", "已启用（30 秒后）"],
            ["敏感内容隐藏", "已启用"],
          ].map(([name, value], index) => (
            <div className="setting-row" key={name}>
              <span>{name}</span>
              <strong>{value}</strong>
              {index > 0 && <ToggleRight size={34} />}
            </div>
          ))}
          <div className="setting-row">
            <span>自动锁定</span>
            <strong>5 分钟后</strong>
            <LockKeyhole size={20} />
          </div>
        </section>

        <section className="content-panel backup-panel">
          <h2>备份与恢复</h2>
          <div className="setting-row"><span>自动备份</span><strong>已启用</strong><ToggleRight size={34} /></div>
          <div className="setting-row"><span>手动备份</span><button type="button">立即备份</button></div>
          <div className="setting-row"><span>恢复数据</span><button type="button">选择备份文件</button></div>
          <div className="setting-row"><span>备份保留策略</span><strong>保留最近 30 天</strong></div>
        </section>
      </div>
    </div>
  );
}
