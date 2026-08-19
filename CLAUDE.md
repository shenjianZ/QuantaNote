# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

QuantaNote 是本地优先的桌面信息管理工具，基于 Tauri 2.0。支持 Markdown 笔记、全文搜索、标签管理、附件和版本历史。数据本地存储在 `~/.quantanote/quanta_note.sqlite`（SQLite + WAL 模式）。

# 遵守的约定

修改前端 UI 代码后，需要考虑是否需要同步修改 E2E 测试文件。允许先批量完成前端 UI 修改，再统一修复对应的 E2E 测试文件并运行测试验证

## 常用命令

```bash
# 前端开发（Vite，端口 1420）
pnpm dev

# 前端构建（TypeScript 检查 + Vite 打包）
pnpm build

# Tauri 开发模式（启动前端 + Rust 后端）
pnpm tauri dev

# Tauri 构建（生产包）
pnpm tauri build

# Rust 后端类型检查
cargo check --manifest-path src-tauri/Cargo.toml

# 全项目检查（前端构建 + Rust 类型检查）
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```

## 技术栈

**前端：** React 19, TypeScript (strict), Zustand 5, TailwindCSS 4 (Vite 插件), Vditor 3 (Markdown 编辑器), Lucide React

**后端（Rust）：** Tauri 2.0, rusqlite 0.31 (bundled SQLite), serde_json, chrono, uuid v4

**数据持久化：** SQLite 带 FTS5 全文搜索，WAL 日志模式，应用关闭时执行 checkpoint。

## 架构分层

### 前端 (`src/`)

```
App.tsx → app/QuantaNoteApp.tsx (路由/全局快捷键/状态编排)
  ├── components/layout/AppShell.tsx (外壳布局 + TopBar)
  │     ├── pages/WorkspacePage.tsx   (快速记录：输入+Markdown预览)
  │     ├── pages/LibraryPage.tsx     (记录库：搜索/筛选/阅读器抽屉)
  │     ├── pages/DocumentEditorPage.tsx (全屏Vditor编辑器+版本记录)
  │     └── pages/SettingsPage.tsx    (设置)
  └── components/search/CommandPalette.tsx (Ctrl+K 全局搜索)
```

- **状态管理** — 6 个 Zustand store：
  - `appStore` — 导航(currentPage)、Ctrl+K 面板、选中 item、主题
  - `itemStore` — Item CRUD，列表/详情/置顶/最近
  - `searchStore` — FTS5 搜索查询和结果
  - `tagStore` — 标签 CRUD、item 关联
  - `attachmentStore` — 附件 CRUD
  - `settingsStore` — 字体/字号/主题色等设置，数据导出/导入
- **services/tauriCommands.ts** — 封装所有 `invoke()` 调用，类型化前后端契约
- **adapters/itemAdapter.ts** — 将 Rust `ItemDto` 转为前端 `Item` 视图模型（图标、相对时间、色调）
- **styles/themes.css** — 亮色/暗色主题 CSS 变量（通过 `data-theme` 属性切换）

### 后端 Rust (`src-tauri/src/`)

分层架构：**Tauri Commands → Services → Repositories → SQLite**

```
lib.rs — 应用入口，注册所有 Tauri commands，初始化数据库
commands/    — #[tauri::command] 薄层，参数解析后委托 service
  item.rs, search.rs, tag.rs, attachment.rs, version.rs, data_io.rs
services/    — 业务逻辑（验证、自动版本创建）
repositories/ — 原始 SQL 查询（rusqlite）
db/mod.rs    — DbState (Mutex<Connection>)，Schema DDL，WAL checkpoint
models/      — DTO 和 Payload 结构体 (ItemDto, TagDto, etc.)
utils/       — paths (数据目录), ids (UUID生成), logging (SQL trace)
error.rs     — AppError 枚举 (Database/NotFound/Validation/Io)
```

**数据库表结构：** items, tags, item_tags(多对多), attachments, versions, items_fts(FTS5 虚拟表+触发器)

### 前后端通信

前端通过 `invoke("command_name", { args })` 调用后端 Tauri commands，参数和返回值均为 JSON 序列化。所有 command 返回 `Result<T, AppError>`，前端通过 try/catch 处理错误。

## 关键约定

- **包管理器**：使用 `pnpm`（不可用 npm/yarn）
- **Shell**：Windows 上使用 PowerShell（非 Bash）
- **CSS 变量命名**：`--app-bg`, `--paper`, `--text`, `--muted`, `--line`, `--field`, `--hover`, `--accent`, `--accent-soft`, `--popover`
- **主题**：`data-theme="light"|"dark"`，system 模式下由 `matchMedia` 解析
- **数据目录**：`~/.quantanote/`（Windows：`%USERPROFILE%\.quantanote\`）
- **SQLite pragmas**：启动时设 `journal_mode=WAL` 和 `foreign_keys=ON`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **QuantaNote** (4760 symbols, 9930 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/QuantaNote/context` | Codebase overview, check index freshness |
| `gitnexus://repo/QuantaNote/clusters` | All functional areas |
| `gitnexus://repo/QuantaNote/processes` | All execution flows |
| `gitnexus://repo/QuantaNote/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
