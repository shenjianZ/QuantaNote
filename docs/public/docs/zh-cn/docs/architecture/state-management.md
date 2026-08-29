---
title: 状态管理
description: QuantaNote 的 Zustand Store 设计 — 8 个 Store 的职责划分、跨 Store 通信和 DTO 到视图模型的适配器模式
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 状态管理

QuantaNote 使用 Zustand 5 作为前端状态管理方案。Zustand 是一个轻量级、无模板代码的状态管理库，非常适合 Tauri 桌面应用的架构。应用共使用 8 个 Store，每个 Store 职责明确，通过服务层与后端交互。

## Store 概览

| Store | 文件 | 职责 |
|-------|------|------|
| appStore | `stores/appStore.ts` | 应用全局状态（导航、主题、窗口行为） |
| itemStore | `stores/itemStore.ts` | 记录 CRUD 与列表管理 |
| tagStore | `stores/tagStore.ts` | 标签管理与关联 |
| searchStore | `stores/searchStore.ts` | 全文搜索查询与结果 |
| attachmentStore | `stores/attachmentStore.ts` | 附件管理 |
| settingsStore | `stores/settingsStore.ts` | 应用设置、数据管理、备份配置 |
| syncStore | `stores/syncStore.ts` | 同步配置、认证、状态与冲突 |
| toastStore | `stores/toastStore.ts` | 全局消息提示 |

## Store 职责

### appStore

管理应用级别的全局状态，是导航和主题的核心控制点。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| currentPage | AppPage | 当前页面（workspace/library/document/settings） |
| selectedItemId | string \| null | 当前选中的记录 ID |
| theme | ThemeMode | 主题模式（light/dark/system） |
| paletteOpen | boolean | 搜索面板是否打开 |
| alwaysOnTop | boolean | 窗口是否置顶 |

| 关键操作 | 说明 |
|----------|------|
| init() | 从 SQLite 加载保存的主题、页面和窗口行为设置 |
| navigate(page) | 切换页面并持久化当前页面到设置 |
| selectItem(id) | 选中指定记录 |
| setTheme(theme) | 切换主题并持久化 |
| setAlwaysOnTop(value) | 设置窗口置顶状态 |

### itemStore

管理记录的完整生命周期，是应用中使用最频繁的 Store。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| items | ItemDto[] | 记录列表 |
| selectedItem | ItemDto \| null | 当前选中的记录详情 |
| itemTagNames | Record<string, string[]> | 记录-标签名映射 |
| pinnedItems | ItemDto[] | 置顶记录 |
| recentItems | ItemDto[] | 最近记录 |
| loading | boolean | 加载状态 |

| 关键操作 | 说明 |
|----------|------|
| fetchItems(itemType?) | 获取记录列表（支持按类型筛选） |
| fetchLibraryData() | 获取记录库完整数据（items + tags + mappings） |
| getItem(id) | 获取单条记录详情 |
| createItem(title, type, content?) | 创建记录并追加到列表 |
| updateItem(id, updates) | 更新记录并同步到列表 |
| deleteItem(id) | 删除记录并从列表移除 |
| fetchPinned() / fetchRecent() | 获取置顶/最近记录 |

### tagStore

管理标签的 CRUD 和记录-标签关联。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| tags | TagDto[] | 所有标签 |
| itemTags | TagDto[] | 当前记录的标签 |

| 关键操作 | 说明 |
|----------|------|
| fetchTags() | 获取所有标签 |
| createTag(name, color) | 创建标签 |
| removeTag(name) | 删除标签 |
| updateItemTags(itemId, tagNames) | 设置记录的标签 |
| renameTag(oldName, newName) | 重命名标签 |
| updateTagColor(name, color) | 更新标签颜色 |

### searchStore

管理全文搜索的查询和结果，内置防抖序列号机制。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| query | string | 搜索关键词 |
| results | SearchResultDto[] | 搜索结果 |
| total | number | 当前查询的完整匹配数量 |
| searching | boolean | 是否正在搜索 |
| loadingMore | boolean | 是否正在加载下一页 |
| hasMore | boolean | 是否还有下一页 |

| 关键操作 | 说明 |
|----------|------|
| setQuery(q) | 设置搜索关键词 |
| search(q, itemType?, options?) | 执行普通或高级搜索（内置竞序保护） |
| loadMore(itemType?, options?) | 加载下一页结果 |

搜索 Store 使用 `_searchSeq` 序列号机制防止旧请求覆盖新结果：

```typescript
let _searchSeq = 0;

search: async (q, itemType, options) => {
  const seq = ++_searchSeq;
  const page = await invoke("search_items", { query: q, ...options });
  if (seq !== _searchSeq) return; // 丢弃过时的结果
  set({ results: page.results, total: page.total });
}
```

### attachmentStore

管理记录关联的附件文件。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| attachments | AttachmentDto[] | 当前记录的附件列表 |

| 关键操作 | 说明 |
|----------|------|
| fetchAttachments(itemId) | 获取记录的附件 |
| addAttachment(itemId, path) | 添加附件 |
| deleteAttachment(id) | 删除附件 |

### settingsStore

管理应用设置和系统管理功能，是功能最复杂的 Store。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| settings | AppSettings | 应用设置（字体、字号、主题色等） |
| dbSize | string | 数据库大小 |
| dbPath | string | 数据库路径 |
| autoBackupConfig | AutoBackupConfig \| null | 自动备份配置 |
| backupFiles | BackupFileInfo[] | 备份文件列表 |
| sqlLogging | SqlLogSettings | SQL 日志设置 |

| 关键操作 | 说明 |
|----------|------|
| init() | 从 SQLite 加载设置并应用到 DOM |
| updateSetting(key, value) | 更新单个设置项并持久化 |
| refreshDbSize() | 刷新数据库大小 |
| exportDataWithOptions(options) | ZIP 导出数据 |
| importDataWithOptions(options) | ZIP 导入数据 |
| triggerBackupNow() | 立即执行备份 |
| updateSqlLogging(partial) | 更新 SQL 日志配置 |

### syncStore

管理多设备同步的完整生命周期，包括认证、同步调度和冲突解决。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| config | SyncConfig | 同步配置（服务器、认证、间隔等） |
| state | SyncState | 同步运行状态 |
| history | SyncHistoryEntry[] | 同步历史记录 |
| pendingConflicts | ConflictInfo[] \| null | 待解决的冲突列表 |

| 关键操作 | 说明 |
|----------|------|
| init() | 加载配置和状态，注册事件监听，启动自动同步 |
| login(serverUrl, email, password) | 同步服务登录 |
| register(serverUrl, email, password) | 同步服务注册 |
| logout() | 登出并停止自动同步 |
| triggerSync() | 执行同步，成功后刷新 itemStore 和 tagStore |
| resolveConflicts(resolutions) | 手动解决冲突 |
| updateConfig(partial) | 更新同步配置 |

### toastStore

轻量级的全局消息提示 Store。

| 关键状态 | 类型 | 说明 |
|----------|------|------|
| toasts | Toast[] | 当前显示的消息列表 |

| 关键操作 | 说明 |
|----------|------|
| addToast(type, message) | 添加消息（3.5 秒后自动消失） |
| removeToast(id) | 手动移除消息 |

## 跨 Store 通信

Zustand Store 之间通过直接引用实现通信，无需额外的事件总线：

### 同步完成后刷新数据

`syncStore.triggerSync()` 成功后，如果有拉取的数据，会主动触发 `itemStore` 和 `tagStore` 的数据刷新：

```typescript
triggerSync: async () => {
  const result = await triggerSync();
  // 同步成功后刷新应用数据
  if (result.pulled > 0) {
    await useItemStore.getState().fetchItems();
    await useTagStore.getState().fetchTags();
  }
}
```

### 错误提示统一输出

所有 Store 的错误处理统一通过 `toastStore` 展示用户提示：

```typescript
// itemStore 中的错误处理
deleteItem: async (id) => {
  try {
    await invoke("delete_item", { id });
  } catch (e) {
    useToastStore.getState().addToast("error", "删除记录失败");
    throw e;
  }
}
```

### 导入后刷新

`settingsStore` 完成数据导入后，会触发 `itemStore` 刷新：

```typescript
importDataWithOptions: async (options) => {
  await importDataZip(path, options);
  await useItemStore.getState().fetchItems();
  await get().refreshDbSize();
}
```

### Token 过期处理

`syncStore` 检测到 Token 过期时，自动登出并停止同步定时器：

```typescript
if (msg.includes("TokenExpired") || msg.includes("登录已过期")) {
  stopAutoSync();
  await get().logout();
  set({ error: "登录已过期，请重新登录" });
}
```

## 适配器

`src/adapters/itemAdapter.ts` 实现了 DTO 到视图模型的转换，将后端的 `ItemDto` 转换为前端 UI 使用的 `Item` 类型：

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

### 转换内容

| 转换项 | 说明 |
|--------|------|
| 图标映射 | 根据 `item_type` 选择 Lucide 图标组件 |
| 色调映射 | 根据类型分配强调色（note=cyan, link=blue, file=yellow 等） |
| 相对时间 | ISO 时间戳转换为「刚刚」「3 分钟前」「2 天前」格式 |
| 摘要补全 | summary 为空时截取 content 前 60 个字符 |

### 图标映射表

| item_type | 图标 | 色调 |
|-----------|------|------|
| note | FileText | cyan |
| link | Link | blue |
| file | Folder | yellow |
| image | Image | purple |
| code | Braces | cyan |
| task | BookOpen | green |

适配器在 `QuantaNoteApp.tsx` 中通过 `useMemo` 批量调用，将 `ItemDto[]` 转换为 `Item[]`，确保只有数据变化时才重新计算。
