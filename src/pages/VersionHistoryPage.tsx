import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  GitBranch,
  HelpCircle,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";

const versionItems = [
  ["v15. 当前版本", "5 分钟前（自动保存）", "张三（后端工程师）"],
  ["v14. 优化部署方案", "18 分钟前（手动保存）", "张三（后端工程师）"],
  ["v13. 调整需求范围", "昨天 16:45", "李四（产品经理）"],
  ["v12. 初版需求确认", "昨天 11:20", "系统自动保存"],
  ["v11. 创建文档", "昨天 10:02", "张三（后端工程师）"],
];

export function VersionHistoryPage() {
  return (
    <div className="versions-page">
      <div className="versions-header">
        <div>
          <ArrowLeft size={20} />
          <span>历史版本与恢复</span>
          <strong>项目启动资料</strong>
        </div>
        <div>
          <button className="active" type="button">对比视图</button>
          <button type="button">统一视图</button>
          <label>高亮差异 <input type="checkbox" defaultChecked /></label>
          <button type="button"><HelpCircle size={18} />版本对比帮助</button>
          <button type="button"><MoreHorizontal size={18} /></button>
        </div>
      </div>

      <div className="versions-layout">
        <aside className="history-sidebar">
          <h2>版本历史</h2>
          <div className="timeline">
            {versionItems.map(([title, time, author], index) => (
              <button className={index === 1 ? "active" : ""} type="button" key={title}>
                <span className="timeline-dot" />
                {index === 0 && <em>当前版本</em>}
                <strong>{title}</strong>
                <small>{time}</small>
                <small>{author}</small>
              </button>
            ))}
          </div>
          <button type="button">加载更早的版本</button>
          <div className="autosave">
            <strong>自动保存</strong>
            <span>已开启（每 5 分钟）</span>
            <a>管理设置</a>
          </div>
        </aside>

        <section className="diff-panel">
          <div className="diff-heading">
            <div>
              <strong>v14. 优化部署方案</strong>
              <span>18 分钟前（手动保存）</span>
            </div>
            <button type="button">⇄</button>
            <div>
              <strong>v15. 当前版本</strong>
              <span>5 分钟前（自动保存）</span>
            </div>
          </div>
          <div className="diff-columns">
            <article>
              <h2># 1. 项目概述</h2>
              <p>本项目旨在搭建一套高可用、高性能的后端服务框架，支撑核心业务的稳定运行。</p>
              <h3>## 1.1 目标与范围</h3>
              <ul className="removed">
                <li>提供稳定的 API 服务</li>
                <li>支持用户管理与权限控制</li>
                <li>实现订单处理与支付功能</li>
              </ul>
              <h3>## 1.2 非功能需求</h3>
              <ul className="removed">
                <li>系统可用性 ≥ 99.9%</li>
                <li>响应时间 &lt; 200ms</li>
                <li>支持 10,000+ 并发连接</li>
              </ul>
              <h2># 2. 架构设计</h2>
              <p>采用微服务架构，基于 Docker + Kubernetes 部署。</p>
            </article>
            <article>
              <h2># 1. 项目概述</h2>
              <p>本项目旨在搭建一套高可用、高性能的后端服务体系，支持核心业务的稳定运行。</p>
              <h3>## 1.1 目标与范围</h3>
              <ul className="added">
                <li>提供稳定的 API 服务</li>
                <li>支持用户管理、权限控制与角色分级</li>
                <li>实现订单处理、支付、退款与对账功能</li>
                <li>提供数据统计与报表分析能力</li>
              </ul>
              <h3>## 1.2 非功能需求</h3>
              <ul className="added">
                <li>系统可用性 ≥ 99.95%</li>
                <li>响应时间 &lt; 150ms</li>
                <li>支持 20,000+ 并发连接</li>
                <li>支持多可用区部署与故障自动切换</li>
              </ul>
              <h2># 2. 架构设计</h2>
              <p>采用微服务架构，基于 Docker + Kubernetes 部署。</p>
            </article>
          </div>
          <footer className="diff-footer">
            <span><i className="removed-dot" />已删除</span>
            <span><i className="added-dot" />已添加</span>
            <button type="button"><ChevronLeft size={18} /></button>
            <span>第 1 处差异，共 12 处</span>
            <button type="button"><ChevronRight size={18} /></button>
          </footer>
        </section>

        <aside className="version-detail">
          <h2>版本详情</h2>
          <section>
            <h3>版本说明</h3>
            <p>优化项目目标与范围，扩展非功能需求，补充服务组件与部署策略。</p>
          </section>
          <section>
            <h3>变更摘要</h3>
            <div className="change-pills">
              <span>新增 28 处</span>
              <span>删除 12 处</span>
              <span>修改 6 处</span>
            </div>
          </section>
          <section>
            <h3>提交信息</h3>
            <dl>
              <dt>更新人</dt><dd>张三（后端工程师）</dd>
              <dt>提交时间</dt><dd>2024-05-20 15:08</dd>
              <dt>版本类型</dt><dd>手动保存</dd>
            </dl>
          </section>
          <section>
            <h3>恢复此版本</h3>
            <p>将文档恢复到此版本的内容，当前内容将作为新版本保留。</p>
            <button className="primary" type="button"><RotateCcw size={18} />恢复到此版本</button>
            <button type="button"><GitBranch size={18} />创建分支版本</button>
          </section>
          <section>
            <h3>更多操作</h3>
            <button type="button"><Download size={18} />导出此版本内容</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
