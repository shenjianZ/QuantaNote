---
title: 前端架构
description: QuantaNote 前端技术栈、页面组件设计、组件层级关系、Zustand 状态管理和关键依赖库
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 前端架构

QuantaNote 的前端基于 React 19 构建，采用 TypeScript 严格模式，使用 Zustand 进行状态管理，TailwindCSS 进行样式开发。整个前端作为一个单页应用运行在 Tauri 的 WebView 中。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架，函数组件 + Hooks |
| TypeScript | strict | 类型安全的 JavaScript 超集 |
| Zustand | 5 | 轻量级状态管理库 |
| TailwindCSS | 4 (Vite 插件) | 原子化 CSS 框架 |
| Vite | 7 | 前端构建工具与开发服务器 |
| Vditor | 3 | Markdown 编辑器（所见即所得） |
| Lucide React | - | 图标库 |
| i18next | - | 国际化（中文/英文） |
| @tauri-apps/api | 2.0 | Tauri 前端 API（invoke、event、window） |

## 页面组件

QuantaNote 包含 4 个核心页面组件，每个页面对应一个主要功能区：

### WorkspacePage（工作台）

快速记录入口，提供文本输入区域和 Markdown 实时预览。用户可以快速创建笔记，系统会自动从内容中提取标题。

### LibraryPage（记录库）

记录管理主界面，支持搜索、标签筛选、列表展示和侧边抽屉阅读器。集成了全文搜索、标签过滤和分页加载功能。

### DocumentEditorPage（文档编辑器）

全屏 Vditor Markdown 编辑器，支持所见即所得编辑模式。集成了版本历史面板，可查看、对比和恢复历史版本。

### SettingsPage（设置）

应用配置界面，包含外观设置（字体、字号、主题色）、窗口行为、数据管理（导入/导出/备份）、SQL 日志和同步配置。

## 组件层级

前端组件按照以下层级组织：

```
App.tsx
  └── QuantaNoteApp.tsx          — 路由控制、全局快捷键、状态编排
       └── ErrorBoundary         — 全局错误边界
            └── AppShell         — 外壳布局（TopBar + 内容区域）
                 ├── TopBar      — 顶部导航栏（页面切换、搜索、状态指示器）
                 ├── WorkspacePage     (currentPage === "workspace")
                 ├── LibraryPage      (currentPage === "library")
                 ├── DocumentEditorPage (currentPage === "document")
                 ├── SettingsPage     (currentPage === "settings")
                 ├── CommandPalette   — Ctrl+K 全局搜索面板
                 └── ToastContainer   — 全局消息提示
```

### QuantaNoteApp

应用的核心编排组件，负责：
- 监听 `currentPage` 状态切换页面
- 处理全局键盘快捷键（Ctrl+K 搜索、Ctrl+N 新建）
- 监听系统托盘命令事件
- 初始化各 Store（appStore、settingsStore、syncStore）
- 通过 `adaptItem()` 将 `ItemDto` 转换为前端 `Item` 视图模型

### AppShell

布局外壳组件，提供 TopBar 和内容区域的统一布局框架。接收当前页面标识和导航回调。

## 状态管理

前端使用 8 个 Zustand Store 管理应用状态，每个 Store 职责明确、互相独立：

| Store | 文件 | 关键状态 |
|-------|------|----------|
| appStore | `stores/appStore.ts` | currentPage, selectedItemId, theme, paletteOpen |
| itemStore | `stores/itemStore.ts` | items, selectedItem, pinnedItems, recentItems |
| tagStore | `stores/tagStore.ts` | tags, itemTags |
| searchStore | `stores/searchStore.ts` | query, results, searching |
| attachmentStore | `stores/attachmentStore.ts` | attachments |
| settingsStore | `stores/settingsStore.ts` | settings, dbSize, autoBackupConfig |
| syncStore | `stores/syncStore.ts` | config, state, history, pendingConflicts |
| toastStore | `stores/toastStore.ts` | toasts |

详细的 Store 设计请参阅 [状态管理](/docs/architecture/state-management) 章节。

## 关键库

### Tauri API

- `@tauri-apps/api/core` — `invoke()` 函数，用于调用 Rust 后端命令
- `@tauri-apps/api/event` — `listen()` 函数，监听 Rust 端发出的事件（如同步状态变更）
- `@tauri-apps/api/window` — 窗口控制（置顶、最小化等）
- `@tauri-apps/plugin-dialog` — 原生文件选择对话框
- `@tauri-apps/plugin-opener` — 外部链接打开
- `@tauri-apps/plugin-autostart` — 开机自启管理

### Vditor

Markdown 编辑器核心，配置为所见即所得（WYSIWYG）模式。通过 `preloadVditorResources()` 在应用启动时预加载资源，减少首次打开编辑器的延迟。

### i18next

国际化框架，支持中文（zh-CN）和英文（en）两种语言。语言文件位于 `src/i18n/` 目录，通过 `settingsStore` 的 `locale` 设置切换语言。

## 服务层

`src/services/tauriCommands.ts` 封装了所有 Tauri `invoke()` 调用，提供类型化的前后端契约：

```typescript
// 服务层封装示例
export async function createItem(title: string, itemType: string, content?: string) {
  return invoke("create_item", { title, itemType, content: content ?? null });
}

export async function searchItems(query: string, itemType?: string) {
  return invoke("search_items", { query, itemType: itemType ?? null });
}
```

所有 Store 都通过这个服务层与后端通信，而不是直接调用 `invoke()`，确保了调用的一致性和可维护性。

## 适配器模式

`src/adapters/itemAdapter.ts` 负责将后端 `ItemDto` 转换为前端 `Item` 视图模型：

```typescript
export function adaptItem(dto: ItemDto): Item {
  const itemType = (dto.item_type || "note") as ItemType;
  return {
    id: dto.id,
    type: itemType,
    title: dto.title,
    summary: dto.summary || dto.content?.slice(0, 60) || "",
    tags: [] as Tag[],
    time: formatRelativeTime(dto.updated_at || dto.created_at),
    icon: TYPE_TO_ICON[dto.item_type] ?? FileText,
    accent: TYPE_TO_ACCENT[dto.item_type] ?? "cyan",
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}
```

适配器处理了以下转换：
- **图标映射**：根据 `item_type` 选择对应的 Lucide 图标
- **色调映射**：不同类型的记录使用不同的强调色
- **相对时间**：将 ISO 时间戳转换为「刚刚」「3 分钟前」等友好格式
- **摘要截取**：当 `summary` 为空时，从 `content` 中截取前 60 个字符
