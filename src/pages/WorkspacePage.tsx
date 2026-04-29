import {
  Archive,
  Copy,
  Edit3,
  Grid2X2,
  List,
  LockKeyhole,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { TagPill } from "../components/common/TagPill";
import type { Item } from "../types";

interface WorkspacePageProps {
  items: Item[];
  selectedItem: Item;
  onSelectItem: (id: string) => void;
  onOpenDocument: () => void;
}

export function WorkspacePage({
  items,
  selectedItem,
  onSelectItem,
  onOpenDocument,
}: WorkspacePageProps) {
  const SelectedIcon = selectedItem.icon;

  return (
    <div className="workspace-page">
      <div className="action-bar">
        <button className="primary" type="button" onClick={onOpenDocument}>
          <Edit3 size={20} />
          新建
        </button>
        <button type="button">
          <Paperclip size={20} />
          附件
        </button>
        <button type="button">
          <RefreshCw size={20} />
          同步
        </button>
        <button type="button">
          <Settings size={20} />
          设置
        </button>
      </div>

      <div className="workspace-grid">
        <section className="list-pane">
          <div className="tabs-row">
            {["置顶", "最近", "收藏", "隐私"].map((tab, index) => (
              <button className={index === 0 ? "active" : ""} key={tab} type="button">
                {tab}
              </button>
            ))}
            <span />
            <button type="button">
              <List size={19} />
            </button>
            <button type="button">
              <Grid2X2 size={18} />
            </button>
          </div>

          <div className="item-list">
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.id === selectedItem.id;
              return (
                <button
                  className={`item-card item-${item.accent} ${active ? "active" : ""}`}
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  type="button"
                >
                  <span className="item-icon">
                    <Icon size={30} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    {item.tags.map((tag) => (
                      <TagPill tag={tag} key={tag.name} />
                    ))}
                  </div>
                  <time>{item.time}</time>
                  {item.encrypted && <LockKeyhole size={16} />}
                  {item.pinned && <Star size={16} />}
                  <MoreHorizontal size={18} className="more-icon" />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="detail-pane">
          <div className="detail-title">
            <div className={`item-icon item-${selectedItem.accent}`}>
              <SelectedIcon size={30} />
            </div>
            <div>
              <h2>{selectedItem.title}</h2>
              {selectedItem.tags.map((tag) => (
                <TagPill tag={tag} key={tag.name} />
              ))}
            </div>
            <span className="encrypted-state">
              <LockKeyhole size={15} />
              加密
            </span>
          </div>

          <div className="code-preview">
            <span>Bash</span>
            <pre>{`# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装依赖
sudo apt install -y nginx htop git

# 启动 nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx --no-pager`}</pre>
          </div>

          <div className="note-box">
            <strong>笔记</strong>
            <p>在 Ubuntu 22.04 服务器上部署常用环境，包含 Nginx、Git 等基础服务。</p>
          </div>

          <dl className="meta-list">
            <dt>创建时间</dt>
            <dd>2024-05-20 14:32</dd>
            <dt>更新时间</dt>
            <dd>2024-05-20 14:35</dd>
            <dt>位置</dt>
            <dd>置顶</dd>
          </dl>

          <div className="detail-actions">
            {[Star, Edit3, Copy, Trash2, Archive].map((Icon, index) => (
              <button type="button" key={index}>
                <Icon size={20} />
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
