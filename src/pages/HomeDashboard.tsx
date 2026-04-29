import {
  CheckSquare,
  GitBranch,
  Link,
  Network,
  Pencil,
  UploadCloud,
} from "lucide-react";
import { activities, metrics, pinnedItems } from "../data/mockData";
import type { AppPage } from "../types";
import { TagPill } from "../components/common/TagPill";

interface HomeDashboardProps {
  onNavigate: (page: AppPage) => void;
}

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  return (
    <div className="dashboard-layout">
      <section className="dashboard-main">
        <div className="hero-panel">
          <div>
            <h1>晚上好，octocat</h1>
            <p>专注记录，安全同行。你今天已经记录了 12 条内容。</p>
            <div className="quick-actions">
              {[
                { icon: Pencil, label: "新建笔记", page: "document" as AppPage },
                { icon: UploadCloud, label: "上传文件", page: "files" as AppPage },
                { icon: Link, label: "录入链接", page: "all" as AppPage },
                { icon: CheckSquare, label: "新建待办", page: "all" as AppPage },
                { icon: GitBranch, label: "创建思维导图", page: "versions" as AppPage },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button key={action.label} onClick={() => onNavigate(action.page)} type="button">
                    <Icon size={27} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="orbit-card">
            <div className="orbital-rings" />
            <blockquote>记录是为了更好地思考，思考是为了更好地行动。</blockquote>
            <span>知识守护舱</span>
          </div>
        </div>

        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className={`metric-card metric-${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.delta}</small>
              <div className="sparkline" />
            </article>
          ))}
        </div>

        <section className="content-panel">
          <div className="panel-heading">
            <h2>置顶内容</h2>
            <button type="button" onClick={() => onNavigate("all")}>
              查看全部 (6)
            </button>
          </div>
          <div className="pinned-grid">
            {pinnedItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className="pinned-card"
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id === "project-start" ? "document" : "all")}
                >
                  <Icon size={22} />
                  <strong>{item.title}</strong>
                  <div>
                    {item.tags.map((tag) => (
                      <TagPill key={tag.name} tag={tag} />
                    ))}
                  </div>
                  <p>{item.summary}</p>
                  <small>{item.time}</small>
                </button>
              );
            })}
          </div>
        </section>

        <div className="dashboard-bottom">
          <section className="content-panel activity-panel">
            <h2>最近活动</h2>
            {activities.map((activity) => (
              <div className="activity-row" key={activity.title}>
                <span className={`dot ${activity.tone}`} />
                <div>
                  <strong>{activity.title}</strong>
                  <small>{activity.detail}</small>
                </div>
                <time>{activity.time}</time>
              </div>
            ))}
          </section>

          <section className="content-panel graph-panel">
            <h2>知识图谱概览</h2>
            <div className="graph">
              <Network size={110} />
              <i />
              <i />
              <i />
            </div>
            <button type="button" onClick={() => onNavigate("versions")}>
              进入知识图谱
            </button>
          </section>
        </div>
      </section>

      <aside className="dashboard-aside">
        <section className="content-panel">
          <h2>今日概览</h2>
          {[
            ["创建记录", "12"],
            ["更新记录", "8"],
            ["附件数量", "36"],
            ["待办完成", "5"],
          ].map(([label, value]) => (
            <div className="summary-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className="content-panel">
          <h2>最近使用标签</h2>
          {["项目", "文档", "架构", "设计", "法务", "服务器"].map((tag, index) => (
            <div className="summary-row tag-summary" key={tag}>
              <span>#{tag}</span>
              <strong>{[24, 18, 12, 10, 8, 7][index]}</strong>
            </div>
          ))}
        </section>

        <section className="content-panel">
          <h2>待办事项</h2>
          {["完成系统架构设计评审", "更新部署文档", "准备周会汇报材料", "整理客户反馈"].map(
            (todo, index) => (
              <label className="todo-row" key={todo}>
                <input type="checkbox" defaultChecked={index === 3} />
                <span>{todo}</span>
              </label>
            ),
          )}
        </section>
      </aside>
    </div>
  );
}
