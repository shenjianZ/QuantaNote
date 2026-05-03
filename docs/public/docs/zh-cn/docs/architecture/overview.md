---
title: 架构概览
description: QuantaNote 的整体架构设计 — Tauri 2.0 高层架构、分层设计模式、通信模型与数据流
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 架构概览

QuantaNote 是一款基于 Tauri 2.0 构建的本地优先桌面信息管理工具。它将现代 Web 前端技术与高性能 Rust 后端相结合，在保持轻量级的同时提供丰富的功能体验。

## Tauri 2.0 高层架构

QuantaNote 运行在 Tauri 2.0 框架之上，该框架提供了 Web 前端与原生系统之间的桥梁：

```
+--------------------------------------------------+
|                   Tauri Runtime                    |
|  +--------------------+  +---------------------+  |
|  |   WebView (前端)    |  |   Rust 后端          |  |
|  |   React 19         |  |   Tauri Commands     |  |
|  |   TypeScript       |  |   Services           |  |
|  |   Zustand Stores   |  |   Repositories       |  |
|  |   TailwindCSS 4    |  |   SQLite (rusqlite)  |  |
|  +--------------------+  +---------------------+  |
|           |                          ^             |
|           |     invoke() / IPC       |             |
|           v                          |             |
|        JSON 序列化 / 反序列化                       |
+--------------------------------------------------+
           |
           v
   系统原生能力 (文件系统、托盘、自启、对话框)
```

- **WebView 层**：运行基于 Chromium 的前端应用，负责 UI 渲染与用户交互
- **Rust 层**：处理数据持久化、业务逻辑、系统 API 调用等底层操作
- **Tauri Runtime**：管理进程间通信（IPC）、窗口生命周期和插件系统

## 分层设计

后端采用严格的三层架构，确保关注点分离：

```
Commands (命令层)
    ↓ 参数解析与验证
Services (服务层)
    ↓ 业务逻辑与编排
Repositories (数据访问层)
    ↓ 原始 SQL 查询
SQLite 数据库
```

### Command 层

`#[tauri::command]` 标注的薄层处理器，负责接收前端请求、解析参数，并将调用委托给对应的 Service。Command 层不包含业务逻辑，仅做参数转换和错误映射。

### Service 层

核心业务逻辑所在。负责数据验证、业务规则执行、事务编排和自动版本创建。例如，更新 Item 时 Service 会自动创建版本快照。

### Repository 层

直接与 SQLite 数据库交互，使用 `rusqlite` 执行原始 SQL 查询。每个 Repository 对应一个数据实体（Item、Tag、Attachment、Version 等），封装了 CRUD 操作。

## 通信模型

前端与后端通过 Tauri 的 `invoke()` 机制进行通信：

1. **前端发起调用**：通过 `invoke("command_name", { args })` 发起 IPC 调用
2. **参数序列化**：参数对象自动通过 JSON 序列化传递给 Rust 端
3. **Rust 处理请求**：对应的 Command 函数接收反序列化后的参数
4. **结果返回**：Command 返回 `Result<T, AppError>`，成功时序列化为 JSON 返回前端
5. **前端处理结果**：通过 `try/catch` 或 `.catch()` 处理成功和错误情况

```typescript
// 前端调用示例
const item = await invoke<ItemDto>("create_item", {
  title: "我的笔记",
  itemType: "note",
  content: "内容...",
});
```

```rust
// 后端 Command 处理
#[tauri::command]
fn create_item(title: String, item_type: String, content: Option<String>) -> Result<ItemDto, AppError> {
    let service = ItemService::new();
    service.create(title, item_type, content)
}
```

## 数据流

典型的数据操作流经以下路径：

```
用户操作 → UI 组件 → Zustand Store → invoke() → Tauri Command
    → Service → Repository → SQLite → 返回结果
    → Store 更新状态 → UI 重新渲染
```

### 读取流程示例

1. 用户打开记录库页面
2. `LibraryPage` 组件挂载时调用 `itemStore.fetchLibraryData()`
3. Store 通过 `invoke("get_library_data")` 发起 IPC 调用
4. Rust Command 接收请求，委托 Service 查询数据
5. Repository 执行 SQL 查询，返回 `ItemDto` 集合
6. 结果序列化为 JSON 返回前端
7. Store 更新 `items` 状态，触发 UI 渲染

### 写入流程示例

1. 用户在工作台输入内容并提交
2. 组件调用 `itemStore.createItem(title, type, content)`
3. Store 通过 `invoke("create_item", { ... })` 发起调用
4. Rust Command 委托 Service 创建记录
5. Service 验证参数，Repository 执行 INSERT SQL
6. FTS 触发器自动更新全文检索索引
7. 返回新创建的 `ItemDto`，Store 将其追加到列表
8. UI 实时反映新记录
