import {
  Bold,
  CheckSquare,
  Code2,
  FileArchive,
  FileText,
  Image,
  Italic,
  Link,
  List,
  MoreHorizontal,
  Plus,
  Quote,
  Save,
  Share2,
  Star,
  Underline,
} from "lucide-react";
import { docRelations } from "../data/mockData";

export function DocumentEditorPage() {
  return (
    <div className="document-page">
      <div className="doc-breadcrumb">
        <span>文件</span>
        <span>项目文档库</span>
        <strong>项目规划文档</strong>
        <em>已保存到 14:32</em>
        <div>
          <button type="button">
            <Share2 size={18} />
            分享
          </button>
          <button type="button">协作</button>
          <button className="secure" type="button">
            已加密
          </button>
          <button type="button">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className="document-grid">
        <article className="editor-surface">
          <div className="doc-title">
            <button type="button">←</button>
            <h1>项目规划文档</h1>
            <Star size={18} />
          </div>
          <div className="tag-row">
            <span className="tag tag-green">#项目</span>
            <span className="tag tag-blue">#规划</span>
            <span className="tag tag-purple">#文档</span>
            <button type="button">+ 添加标签</button>
          </div>

          <div className="format-toolbar">
            {["H1", "H2", "H3"].map((item) => (
              <button type="button" key={item}>
                {item}
              </button>
            ))}
            {[Bold, Italic, Underline, Code2, Link, List, CheckSquare, Quote, MoreHorizontal].map(
              (Icon, index) => (
                <button type="button" key={index}>
                  <Icon size={18} />
                </button>
              ),
            )}
          </div>

          <section className="doc-content">
            <h2># 1. 项目背景与目标</h2>
            <p>
              本项目旨在搭建一套高可用、高性能的后端服务体系，支持核心业务的稳定运行，
              并为未来的功能扩展和技术演进提供良好的基础设施和工程化支撑。
            </p>
            <h2># 2. 主要目标</h2>
            <label><input type="checkbox" defaultChecked /> 完成高可用架构设计与部署</label>
            <label><input type="checkbox" defaultChecked /> 支持水平扩展与弹性伸缩</label>
            <label><input type="checkbox" /> 提升系统可观测性</label>
            <label><input type="checkbox" /> 降低运维复杂度</label>
            <h2># 3. 技术栈</h2>
            <pre>{`1  docker-compose up -d
2  # 查看服务状态
3  docker-compose ps
4  # 查看日志
5  docker-compose logs -f app`}</pre>
            <h2># 4. 架构图</h2>
            <div className="architecture-strip">
              <span>客户端</span>
              <span>负载均衡 Nginx</span>
              <span>API 网关</span>
              <span>用户服务</span>
              <span>订单服务</span>
              <span>MySQL</span>
            </div>
            <blockquote>设计的核心在于权衡复杂度与可维护性，优先保证系统的可演进性。</blockquote>
            <div className="related-doc">
              <Link size={19} />
              相关文档：《系统架构设计规范 v1.0》
            </div>
          </section>

          <div className="editor-input">
            <span>输入 / 呼出命令菜单，输入内容或粘贴链接，或拖拽文件到此处</span>
            {[Save, Code2, Image, Link, FileText].map((Icon, index) => (
              <button type="button" key={index}>
                <Icon size={18} />
              </button>
            ))}
          </div>
        </article>

        <aside className="doc-inspector">
          <div className="inspector-tabs">
            <button className="active" type="button">属性</button>
            <button type="button">活动</button>
          </div>
          <section>
            <h3>标签</h3>
            <div className="tag-row">
              <span className="tag tag-green">#项目</span>
              <span className="tag tag-blue">#规划</span>
              <span className="tag tag-purple">#文档</span>
              <button type="button"><Plus size={16} /></button>
            </div>
          </section>
          <section>
            <h3>关联记录 (4)</h3>
            {docRelations.map((relation) => {
              const Icon = relation.icon;
              return (
                <div className="relation-row" key={relation.title}>
                  <Icon size={18} />
                  <span>{relation.title}</span>
                  <small>{relation.tag}</small>
                </div>
              );
            })}
          </section>
          <section>
            <h3>版本历史</h3>
            {["v1.3 张三 更新了文档内容", "v1.2 李四 更新了文档内容", "v1.1 张三 创建了文档"].map(
              (version, index) => (
                <div className={`version-row ${index === 0 ? "active" : ""}`} key={version}>
                  {version}
                </div>
              ),
            )}
          </section>
          <section>
            <h3>附件 (3)</h3>
            {[
              ["架构图 v1.0.png", "PNG · 2.4 MB", Image],
              ["项目规划草案.xlsx", "Excel · 1.8 MB", FileText],
              ["技术选型对比表.pdf", "PDF · 1.2 MB", FileArchive],
            ].map(([name, meta, Icon]) => (
              <div className="relation-row" key={name as string}>
                {typeof Icon !== "string" && <Icon size={18} />}
                <span>{name as string}</span>
                <small>{meta as string}</small>
              </div>
            ))}
          </section>
          <section className="ai-summary">
            <h3>AI 摘要</h3>
            <p>本文档为项目规划文档，明确了项目背景、目标、技术栈、架构设计和里程碑计划。</p>
            <button type="button">重新生成摘要</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
