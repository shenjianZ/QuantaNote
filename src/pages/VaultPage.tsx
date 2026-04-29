import { useState } from "react";
import {
  Copy,
  Edit3,
  Eye,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { unlockVault } from "../services/tauriCommands";
import { vaultRecords } from "../data/mockData";

export function VaultPage() {
  const [locked, setLocked] = useState(true);
  const [password, setPassword] = useState("");

  async function handleUnlock() {
    const ok = await unlockVault(password || "demo");
    if (ok) setLocked(false);
  }

  return (
    <div className={`vault-page ${locked ? "is-locked" : ""}`}>
      <div className="vault-header">
        <div>
          <h1>保险箱 / 密码与隐私记录</h1>
          <p>安全储存你的密码、密钥和敏感信息，所有字段默认加密。</p>
        </div>
        <span><ShieldCheck size={20} />端到端加密已启用</span>
      </div>

      <div className="vault-actions">
        <button className="primary" type="button"><Plus size={20} />新建密码</button>
        <button type="button"><KeyRound size={20} />生成密码</button>
        <button type="button"><LockKeyhole size={20} />锁定</button>
      </div>

      <div className="vault-layout">
        <section className="vault-list">
          <h2>全部记录 6</h2>
          {vaultRecords.map((record, index) => {
            const Icon = record.icon;
            return (
              <button className={index === 0 ? "active" : ""} type="button" key={record.title}>
                <span className={`vault-icon ${record.tone}`}>
                  <Icon size={25} />
                </span>
                <div>
                  <strong>{record.title}</strong>
                  <small>{record.site}</small>
                  <em>••••••••••••••</em>
                </div>
                <span>{record.risk}</span>
              </button>
            );
          })}
        </section>

        <aside className="vault-detail">
          <div className="vault-card-title">
            <div className="vault-icon purple"><KeyRound size={30} /></div>
            <div>
              <h2>Github 账号</h2>
              <span>github.com · octocat</span>
            </div>
            <Star size={18} />
          </div>
          {[
            ["网站", "https://github.com"],
            ["用户名", "octocat@example.com"],
            ["密码", "••••••••••••••••"],
            ["二次验证", "Authenticator (TOTP)"],
            ["备注", "用于个人开发与开源项目管理。"],
          ].map(([label, value], index) => (
            <div className="secret-field" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              {index === 2 && <Eye size={18} />}
              <Copy size={18} />
            </div>
          ))}
          <div className="score-ring">95</div>
          <div className="vault-detail-actions">
            <button type="button"><Copy size={18} />复制密码</button>
            <button type="button"><Edit3 size={18} />编辑</button>
          </div>
          <div className="content-panel">
            <h2>端到端加密保护</h2>
            <p>此记录已使用 AES-256-GCM 加密，仅你可以解密和访问。</p>
          </div>
        </aside>
      </div>

      {locked && (
        <div className="unlock-overlay">
          <section className="unlock-modal">
            <ShieldCheck size={94} />
            <div className="user-chip">octocat</div>
            <h2>已锁定，输入主密码以继续</h2>
            <p>您的数据已安全加密，仅您可以访问。</p>
            <div className="password-box">
              <input
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="输入主密码"
                type="password"
              />
              <Eye size={20} />
            </div>
            <button className="primary" type="button" onClick={handleUnlock}>解锁</button>
            <div className="divider"><span />或<span /></div>
            <button type="button">使用生物识别解锁</button>
            <div className="sync-state">
              <ShieldCheck size={24} />
              <div>
                <strong>最近同步：1 分钟前</strong>
                <span>数据已安全加密（AES-256-GCM）</span>
              </div>
            </div>
            <button className="modal-close" onClick={() => setLocked(false)} type="button">
              <X size={18} />
            </button>
          </section>
          <aside className="lock-toast">
            <LockKeyhole size={18} />
            <strong>自动锁定已启用</strong>
            <p>为保护您的数据安全，应用会在 5 分钟无操作后自动锁定。</p>
            <span>前往设置调整</span>
          </aside>
        </div>
      )}
    </div>
  );
}
