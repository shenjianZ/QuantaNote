import {
  FileArchive,
  FileText,
  FolderPlus,
  KeyRound,
  Link,
  LockKeyhole,
  Search,
  Settings,
  Star,
  Terminal,
  Tag,
} from "lucide-react";
import { commandRows } from "../../data/mockData";
import { Kbd } from "../common/Kbd";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenDocument: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onOpenDocument,
}: CommandPaletteProps) {
  if (!open) return null;

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <section className="command-palette" onClick={(event) => event.stopPropagation()}>
        <div className="palette-caption">
          <span>全局搜索 / Command Palette</span>
          <button type="button" onClick={onClose}>
            <Kbd>Esc</Kbd>
            关闭
          </button>
        </div>
        <div className="palette-input">
          <Search size={30} />
          <span>项目</span>
          <Settings size={20} />
        </div>
        <div className="palette-tabs">
          {["全部 (68)", "记录 (23)", "文件 (18)", "命令 (9)", "密码 (6)", "标签 (5)", "建议 (7)"].map(
            (tab, index) => (
              <button className={index === 0 ? "active" : ""} key={tab} type="button">
                {tab}
              </button>
            ),
          )}
        </div>

        <div className="palette-grid">
          <div className="palette-results">
            <section>
              <div className="section-title">最近记录</div>
              {[
                { icon: FileText, title: "项目启动资料", type: "笔记", meta: "#项目 #文档", time: "1 分钟前" },
                { icon: FileArchive, title: "项目需求文档（PRD）.pdf", type: "文件", meta: "#项目 #文档", time: "2 分钟前" },
                { icon: Terminal, title: "项目服务器部署命令", type: "命令", meta: "#服务器 #部署", time: "15 分钟前" },
              ].map((row, index) => {
                const Icon = row.icon;
                return (
                  <button
                    className={`result-row ${index === 0 ? "active" : ""}`}
                    key={row.title}
                    onClick={index === 0 ? onOpenDocument : undefined}
                    type="button"
                  >
                    <Icon size={20} />
                    <strong>{row.title}</strong>
                    <span>{row.type}</span>
                    <em>{row.meta}</em>
                    <small>{row.time}</small>
                    {index === 0 && <Star size={17} />}
                  </button>
                );
              })}
            </section>

            <section>
              <div className="section-title">命令操作</div>
              <div className="command-grid">
                {[
                  { icon: FileText, title: "新建项目需求文档", mark: "快速新建" },
                  { icon: FolderPlus, title: "新建项目文件夹", mark: "快速新建" },
                  { icon: LockKeyhole, title: "项目归档", mark: "记录管理" },
                  { icon: Tag, title: "项目标签：#项目", mark: "标签操作" },
                ].map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button type="button" key={cmd.title}>
                      <Icon size={19} />
                      <span>{cmd.title}</span>
                      <small>{cmd.mark}</small>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="section-title">文件资料</div>
              <div className="compact-list">
                <span>项目合同-终版.docx</span>
                <span>DOCX · 568 KB · 2024-05-19</span>
                <span>项目汇报模板.pptx</span>
                <span>PPTX · 2.4 MB · 2024-05-12</span>
              </div>
            </section>

            <section>
              <div className="section-title">密码保险箱</div>
              <div className="secret-list">
                <span>项目管理系统账号</span>
                <small>admin@project.com</small>
                <span>项目服务器 SSH 账号</span>
                <small>root@10.0.0.12</small>
                <span>项目数据库账号</span>
                <small>db_project@prod</small>
              </div>
            </section>

            <section>
              <div className="section-title">命令快捷方式</div>
              {commandRows.map((row) => (
                <div className="command-row" key={row.title}>
                  <span>{row.title}</span>
                  <small>{row.desc}</small>
                  <Kbd>{row.keys}</Kbd>
                </div>
              ))}
            </section>
          </div>

          <aside className="palette-preview">
            <div className="preview-type">
              <FileText size={20} />
              笔记
              <span>加密</span>
            </div>
            <h2>项目启动资料</h2>
            <div className="tag-row">
              <span className="tag tag-green">#项目</span>
              <span className="tag tag-blue">#文档</span>
              <button type="button">+</button>
            </div>
            <p>
              本项目旨在搭建一套高可用、高性能的后端服务体系，支持核心业务的稳定运行。
              项目将分三个阶段交付，包含需求评审、方案设计、开发测试与上线部署。
            </p>
            <dl>
              <dt>创建时间</dt>
              <dd>2024-05-20 14:32</dd>
              <dt>更新时间</dt>
              <dd>1 分钟前</dd>
              <dt>位置</dt>
              <dd>全部 / 笔记</dd>
              <dt>大小</dt>
              <dd>8.6 MB</dd>
            </dl>
            <div className="preview-actions">
              <button type="button" onClick={onOpenDocument}>
                <Link size={17} />
                打开
              </button>
              <button type="button">
                <KeyRound size={17} />
                复制
              </button>
              <button type="button">
                <Star size={17} />
                收藏
              </button>
            </div>
            <div className="related-box">
              <strong>相关内容</strong>
              <span>项目需求文档（PRD）.pdf</span>
              <span>项目服务器部署命令</span>
              <span>项目合同-终版.docx</span>
            </div>
          </aside>
        </div>

        <footer className="palette-footer">
          <Kbd>↑ ↓</Kbd>
          <span>选择</span>
          <Kbd>Enter</Kbd>
          <span>打开</span>
          <Kbd>Ctrl + C</Kbd>
          <span>复制</span>
          <Kbd>Tab</Kbd>
          <span>切换</span>
        </footer>
      </section>
    </div>
  );
}
