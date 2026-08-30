---
title: 后端架构
description: QuantaNote Rust 后端的目录结构、Command/Service/Repository 三层架构、同步引擎和错误处理
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# 后端架构

QuantaNote 的后端使用 Rust 编写，运行在 Tauri 2.0 运行时中。后端采用严格的三层架构设计：Command 层、Service 层和 Repository 层，确保关注点分离和代码可维护性。

## 目录结构

```
src-tauri/src/
├── lib.rs                    — 应用入口，注册所有 Tauri commands，初始化数据库
├── main.rs                   — Rust 程序入口点
├── error.rs                  — AppError 错误枚举定义
├── config/
│   └── mod.rs                — 应用配置模块
├── commands/                 — Command 层：Tauri 命令处理器
│   ├── mod.rs                — 模块导出
│   ├── item.rs               — Item CRUD 命令
│   ├── tag.rs                — Tag 管理命令
│   ├── attachment.rs         — 附件管理命令
│   ├── version.rs            — 版本管理命令
│   ├── search.rs             — 全文搜索命令
│   ├── settings.rs           — 设置读写命令
│   ├── data_io.rs            — 数据导入/导出命令
│   ├── auto_backup.rs        — 自动备份调度命令
│   ├── diagnostics.rs        — 诊断工具命令（SQL 日志）
│   └── sync.rs               — 同步相关命令
├── services/                 — Service 层：业务逻辑
│   ├── mod.rs
│   ├── item_service.rs       — Item 业务逻辑
│   ├── tag_service.rs        — Tag 业务逻辑
│   ├── attachment_service.rs — 附件业务逻辑
│   ├── version_service.rs    — 版本业务逻辑
│   ├── search_service.rs     — 搜索业务逻辑
│   └── settings_service.rs   — 设置业务逻辑
├── repositories/             — Repository 层：数据访问
│   ├── mod.rs
│   ├── item_repository.rs    — Item SQL 查询
│   ├── tag_repository.rs     — Tag SQL 查询
│   ├── attachment_repository.rs — 附件 SQL 查询
│   ├── version_repository.rs — 版本 SQL 查询
│   ├── search_repository.rs  — 搜索 SQL 查询
│   └── settings_repository.rs — 设置 SQL 查询
├── models/                   — 数据模型（DTO）
│   ├── mod.rs
│   ├── item.rs               — ItemDto, CreateItemPayload, UpdateItemPayload
│   ├── attachment.rs         — AttachmentDto
│   ├── version.rs            — VersionDto
│   ├── search.rs             — SearchResultDto
│   └── sync.rs               — SyncConfig, SyncState, SyncResult 等
├── sync/                     — 同步引擎
│   ├── mod.rs                — 同步模块入口
│   ├── diff.rs               — 三方差异引擎
│   ├── transport.rs          — 网络传输层
│   └── state.rs              — 同步状态管理
├── db/
│   └── mod.rs                — 数据库连接管理、Schema DDL、迁移
└── utils/
    ├── mod.rs
    ├── paths.rs              — 数据目录路径工具
    ├── ids.rs                — UUID 生成工具
    └── logging.rs            — SQL 日志工具
```

## Command 层

Command 层是前后端通信的入口点，使用 `#[tauri::command]` 宏标注。每个 Command 函数是一个薄层处理器，仅负责参数接收和委托调用：

```rust
#[tauri::command]
pub fn create_item(
    state: tauri::State<'_, DbState>,
    title: String,
    item_type: String,
    content: Option<String>,
) -> Result<ItemDto, AppError> {
    let conn = state.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    let payload = CreateItemPayload {
        title,
        item_type,
        content,
        summary: String::new(),
    };
    ItemService::create(&conn, payload)
}
```

所有 Command 在 `lib.rs` 中通过 `invoke_handler` 注册：

```rust
.invoke_handler(tauri::generate_handler![
    item::create_item,
    item::get_items,
    item::get_item,
    item::update_item,
    item::delete_item,
    // ... 更多命令
    commands::sync::trigger_sync,
    update_window_behavior,
])
```

### 命令模块

| 模块 | 文件 | 命令数量 | 功能说明 |
|------|------|----------|----------|
| item | `commands/item.rs` | 8 | 记录 CRUD、置顶列表、最近记录、数据库大小与优化 |
| tag | `commands/tag.rs` | 8 | 标签 CRUD、关联管理、重命名、颜色更新 |
| attachment | `commands/attachment.rs` | 3 | 附件添加、查询、删除 |
| version | `commands/version.rs` | 5 | 版本创建、查询、更新、恢复、删除 |
| search | `commands/search.rs` | 1 | FTS5 全文搜索 |
| settings | `commands/settings.rs` | 2 | 设置读写 |
| data_io | `commands/data_io.rs` | 6 | JSON/ZIP 导入导出、文件读写、大小估算 |
| auto_backup | `commands/auto_backup.rs` | 7 | 备份配置、触发、列表、删除、完整性校验 |
| diagnostics | `commands/diagnostics.rs` | 4 | SQL 日志配置、清理、路径获取 |
| sync | `commands/sync.rs` | 12 | 同步配置、状态、认证、触发、冲突解决、历史 |

## Service 层

Service 层是业务逻辑的核心所在，负责：

### 数据验证

在创建和更新操作前验证输入数据的合法性，例如标题不能为空、类型必须是预定义值等。

### 摘要模式

记录的 `summary_mode` 为 `auto` 或 `manual`。Service 层统一处理摘要规则：自动模式根据正文前 10 个字符重算，手动模式保留用户摘要；`regenerate_summary` 命令显式切换回自动模式。

### 自动版本创建

更新 Item 时，Service 会自动创建版本快照，记录内容变更历史：

```rust
pub fn update(conn: &Connection, payload: UpdateItemPayload) -> Result<ItemDto, AppError> {
    // 1. 获取当前 Item
    let current = ItemRepository::get_by_id(conn, &payload.id)?;
    // 2. 自动创建版本快照
    VersionRepository::create(conn, &current.id, &current.content, "自动保存")?;
    // 3. 执行更新
    ItemRepository::update(conn, payload)
}
```

### 事务编排

对于涉及多个实体的操作（如导入数据），Service 负责在事务中协调多个 Repository 的调用。

## Repository 层

Repository 层直接与 SQLite 交互，使用 `rusqlite` crate 执行 SQL 查询。每个 Repository 对应一个数据实体：

```rust
pub fn create(conn: &Connection, payload: CreateItemPayload) -> Result<ItemDto, AppError> {
    let id = crate::utils::ids::new_uuid();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO items (id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, 0, ?6, ?7)",
        rusqlite::params![id, payload.title, payload.item_type, content, payload.summary, now, now],
    ).map_err(|e| AppError::Database(e.to_string()))?;
    Self::get_by_id(conn, &id)
}
```

Repository 层使用 Rust 的类型系统确保 SQL 参数的类型安全，通过 `rusqlite::params!` 宏绑定参数。

## 同步引擎

`sync/` 模块实现了完整的多设备同步功能：

- **diff.rs** — 三方差异引擎，对比本地基线、本地当前和远程快照，生成变更集
- **transport.rs** — HTTP 传输层，负责与同步服务器的 API 通信
- **state.rs** — 同步状态管理，跟踪同步进度和冲突信息

同步引擎支持两种冲突解决模式：
- **auto** — 自动解决冲突（最新时间戳优先）
- **manual** — 暂停同步并提示用户手动选择

## 错误处理

后端使用统一的 `AppError` 枚举处理所有错误：

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(String),
    #[error("未找到: {0}")]
    NotFound(String),
    #[error("验证错误: {0}")]
    Validation(String),
    #[error("IO 错误: {0}")]
    Io(String),
    #[error("同步错误: {0}")]
    SyncError(String),
    #[error("登录已过期，请重新登录")]
    TokenExpired,
}
```

### 错误传播流程

```
rusqlite::Error → AppError::Database(msg)
    ↓
Service 层可能转换为 AppError::NotFound 或 AppError::Validation
    ↓
Command 层返回 Result<T, AppError>
    ↓
Tauri 将 AppError 序列化为 JSON 字符串
    ↓
前端 catch 到错误字符串
```

`AppError` 实现了 `Serialize` trait，错误信息会被序列化为字符串传递给前端。前端通过 `try/catch` 捕获错误并使用 `toastStore` 展示用户友好的提示。
