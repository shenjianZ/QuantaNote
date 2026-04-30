import { useEffect, useMemo } from "react";
import { FileText } from "lucide-react";
import { useItemStore } from "../stores/itemStore";
import { adaptItem } from "../adapters/itemAdapter";
import type { AppPage } from "../types";

interface HomeDashboardProps {
  onNavigate: (page: AppPage) => void;
  onCreateNote: () => void;
  onOpenItem: (id: string, page?: AppPage) => void;
}

export function HomeDashboard({ onNavigate, onCreateNote, onOpenItem }: HomeDashboardProps) {
  const items = useItemStore((s) => s.items);
  const pinnedItems = useItemStore((s) => s.pinnedItems);
  const recentItems = useItemStore((s) => s.recentItems);
  const fetchItems = useItemStore((s) => s.fetchItems);
  const fetchPinned = useItemStore((s) => s.fetchPinned);
  const fetchRecent = useItemStore((s) => s.fetchRecent);

  useEffect(() => {
    fetchItems().catch(() => {});
    fetchPinned().catch(() => {});
    fetchRecent(10).catch(() => {});
  }, [fetchItems, fetchPinned, fetchRecent]);

  const metrics = useMemo(() => [
    { label: "全部记录", value: String(items.length), delta: "本应用数据", tone: "cyan" },
    { label: "置顶内容", value: String(pinnedItems.length), delta: "快速访问", tone: "purple" },
    { label: "最近更新", value: String(recentItems.length), delta: "活跃记录", tone: "blue" },
  ], [items, pinnedItems, recentItems]);

  const adaptedPinned = useMemo(() => pinnedItems.map(adaptItem), [pinnedItems]);
  const adaptedRecent = useMemo(() => recentItems.map(adaptItem), [recentItems]);

  return (
    <div className="dashboard-layout">
      <section className="dashboard-main">
        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className={`metric-card tone-${metric.tone}`} key={metric.label}>
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value">{metric.value}</div>
              <div className="metric-delta">{metric.delta}</div>
            </article>
          ))}
        </div>

        <section>
          <div className="section-header">
            <h3>置顶内容</h3>
            <button className="section-action" onClick={() => onNavigate("all")} type="button">
              查看全部
            </button>
          </div>
          <div className="pinned-grid">
            {adaptedPinned.length === 0 && (
              <div className="text-muted text-sm" style={{ padding: 8 }}>暂无置顶内容</div>
            )}
            {adaptedPinned.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className="pinned-card"
                  key={item.id}
                  type="button"
                  onClick={() => onOpenItem(item.id, "document")}
                >
                  <div className={`pinned-icon accent-${item.accent}`}>
                    <Icon />
                  </div>
                  <div className="pinned-info">
                    <div className="pinned-title">{item.title}</div>
                    <div className="pinned-summary">{item.summary}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="section-header">
            <h3>最近活动</h3>
          </div>
          <div className="activity-list">
            {adaptedRecent.length === 0 && (
              <div className="text-muted text-sm" style={{ padding: 8 }}>暂无活动记录</div>
            )}
            {adaptedRecent.map((item) => (
                <div className="activity-item" key={item.id}>
                  <span className={`activity-dot tone-${item.accent}`} />
                  <span className="activity-title">{item.title}</span>
                  <span className="activity-time">{item.time}</span>
                </div>
              ))}
          </div>
        </section>
      </section>

      <aside className="dashboard-aside">
        <div className="today-card">
          <h4>数据概览</h4>
          {[
            ["总记录", String(items.length)],
            ["置顶", String(pinnedItems.length)],
            ["收藏", String(items.filter((i) => i.favorite).length)],
          ].map(([label, value]) => (
            <div className="todo-item" key={label}>
              <span className="flex-1 text-muted text-sm">{label}</span>
              <span className="mono">{value}</span>
            </div>
          ))}
        </div>

        <div className="today-card" style={{ marginTop: 4 }}>
          <h4>快捷操作</h4>
          {[
            { label: "新建笔记", action: onCreateNote },
            { label: "浏览全部", page: "all" as AppPage },
            { label: "打开设置", page: "settings" as AppPage },
          ].map((action) => (
            <button
              className="todo-item"
              key={action.label}
              type="button"
              onClick={() => {
                if (action.action) action.action();
                else if (action.page) onNavigate(action.page);
              }}
              style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
            >
              <FileText style={{ width: 14, height: 14 }} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
