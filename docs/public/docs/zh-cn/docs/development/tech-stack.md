---
title: 技术栈
description: QuantaNote 所使用的前后端技术选型和核心依赖
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 技术栈

QuantaNote 采用前后端分离的桌面应用架构，基于 Tauri 2.0 框架将 Web 前端与 Rust 后端结合。以下是各层所使用的技术选型和核心依赖。

## 前端

前端使用现代 React 生态，注重类型安全和开发体验：

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 19 | UI 框架，组件化构建用户界面 |
| **TypeScript** | strict 模式 | 类型安全的 JavaScript 超集 |
| **Zustand** | 5 | 轻量级状态管理库 |
| **TailwindCSS** | 4 (Vite 插件) | 原子化 CSS 框架 |
| **Vditor** | 3 | Markdown 编辑器，支持所见即所得 |
| **Lucide React** | - | 图标库，提供一致的图标风格 |

### 状态管理

QuantaNote 使用 6 个 Zustand store 管理应用状态：

- `appStore` — 导航、全局面板、选中项、主题
- `itemStore` — Item CRUD 操作、列表和详情管理
- `searchStore` — FTS5 全文搜索查询和结果
- `tagStore` — 标签 CRUD、Item 关联
- `attachmentStore` — 附件 CRUD 管理
- `settingsStore` — 字体、字号、主题色等偏好设置

### 前后端通信

前端通过 Tauri 的 `invoke()` API 调用后端命令，参数和返回值均为 JSON 序列化。所有调用封装在 `services/tauriCommands.ts` 中，提供完整的类型定义。

## 后端

后端使用 Rust 编写，通过 Tauri 框架提供原生桌面能力：

| 技术 | 版本 | 用途 |
|------|------|------|
| **Rust** | stable | 后端开发语言，保证内存安全和性能 |
| **Tauri** | 2.0 | 桌面应用框架，连接前后端 |
| **rusqlite** | 0.31 (bundled SQLite) | SQLite 数据库绑定 |
| **serde_json** | - | JSON 序列化/反序列化 |
| **chrono** | - | 日期时间处理 |
| **uuid** | v4 | UUID 生成 |

### 分层架构

后端采用严格的分层架构，职责清晰：

```
Tauri Commands (commands/)     — 薄层，参数解析和委托
    ↓
Services (services/)           — 业务逻辑层
    ↓
Repositories (repositories/)   — 数据访问层，原始 SQL
    ↓
SQLite (db/)                   — 数据库连接和 Schema
```

## 数据库

QuantaNote 使用 SQLite 作为本地数据库，提供可靠的数据持久化：

| 特性 | 说明 |
|------|------|
| **SQLite** | 嵌入式关系型数据库 |
| **WAL 模式** | Write-Ahead Logging，提高并发读写性能 |
| **FTS5** | 全文搜索引擎，支持中文分词 |
| **外键约束** | 启用 `foreign_keys=ON`，保证数据完整性 |

### 核心数据表

- `items` — 笔记条目
- `tags` — 标签
- `item_tags` — 条目-标签多对多关联
- `attachments` — 附件
- `versions` — 版本历史
- `items_fts` — FTS5 全文搜索虚拟表

数据库文件存储在 `~/.quantanote/quanta_note.sqlite`，应用关闭时执行 WAL checkpoint。

## 测试

QuantaNote 采用三层测试策略：

| 测试类型 | 工具 | 范围 |
|----------|------|------|
| **前端单元测试** | Vitest + jsdom | 组件、Store、工具函数 |
| **前端组件测试** | @testing-library/react | 组件交互行为 |
| **Rust 单元测试** | cargo test | 业务逻辑、数据访问 |
| **E2E 测试** | WebdriverIO | 完整用户流程 |

## 构建工具

| 工具 | 用途 |
|------|------|
| **Vite 7** | 前端构建和开发服务器 |
| **pnpm** | 包管理器（严格使用，不支持 npm/yarn） |
| **cargo** | Rust 编译和包管理 |
| **tauri-cli** | Tauri 构建和开发工具链 |

## 主题系统

QuantaNote 支持亮色和暗色主题，通过 CSS 变量实现：

- `data-theme="light"` — 亮色主题
- `data-theme="dark"` — 暗色主题
- 系统模式下通过 `matchMedia` 自动适配

核心 CSS 变量包括：`--app-bg`、`--paper`、`--text`、`--muted`、`--line`、`--field`、`--hover`、`--accent`、`--accent-soft`、`--popover`。
