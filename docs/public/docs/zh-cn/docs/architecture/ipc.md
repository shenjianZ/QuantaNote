---
title: IPC 通信
description: QuantaNote 前后端通信机制 — invoke() 命令调用、JSON 序列化、完整命令参考与类型契约
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# IPC 通信

QuantaNote 的前端（WebView 中的 React 应用）与后端（Rust 进程）通过 Tauri 的 IPC（进程间通信）机制进行交互。所有通信基于 `invoke()` 函数调用，参数和返回值通过 JSON 自动序列化。

## 通信机制

### invoke() 调用流程

前端通过 `@tauri-apps/api/core` 中的 `invoke()` 函数发起 IPC 调用：

```
前端 invoke("command_name", { arg1, arg2 })
  → JSON 序列化参数
    → IPC 通道传输
      → Rust Command 反序列化参数
        → 执行业务逻辑
          → 返回 Result<T, AppError>
            → JSON 序列化结果
              → IPC 通道传输
                → 前端接收结果或捕获错误
```

### 服务层封装

所有 `invoke()` 调用统一封装在 `src/services/tauriCommands.ts` 中，提供类型化的 API：

```typescript
import { invoke } from "@tauri-apps/api/core";

// Item 命令
export async function createItem(title: string, itemType: string, content?: string) {
  return invoke("create_item", { title, itemType, content: content ?? null });
}

export async function getItem(id: string) {
  return invoke("get_item", { id });
}
```

Store 通过服务层间接调用后端，确保调用的一致性和可维护性。

## 命令参考

### Item 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `create_item` | title, itemType, content? | ItemDto | 创建新记录 |
| `get_items` | itemType?, limit?, offset? | ItemDto[] | 获取记录列表 |
| `get_item` | id | ItemDto | 获取单条记录 |
| `update_item` | id, title?, content?, summary?, pinned?, favorite?, encrypted? | ItemDto | 更新记录 |
| `delete_item` | id | void | 删除记录 |
| `get_pinned_items` | (无) | ItemDto[] | 获取置顶记录 |
| `get_recent_items` | limit? | ItemDto[] | 获取最近记录 |
| `get_library_data` | (无) | LibraryData | 获取记录库完整数据 |
| `get_db_size` | (无) | string | 获取数据库大小 |
| `get_db_path` | (无) | string | 获取数据库路径 |
| `optimize_db` | (无) | void | 优化数据库 |

### Search 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `search_items` | query, itemType?, tab?, tag?, sort?, mode?, scopes?, limit?, offset? | SearchPageDto | 普通/高级全文搜索，返回总数、匹配字段、上下文和高亮词 |

### Tag 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `get_all_tags` | (无) | TagDto[] | 获取所有标签 |
| `create_tag` | name, color | TagDto | 创建标签 |
| `delete_tag` | name | void | 删除标签 |
| `get_item_tags` | itemId | TagDto[] | 获取记录的标签 |
| `get_all_item_tag_mappings` | (无) | [string, string][] | 获取所有记录-标签映射 |
| `set_item_tags` | itemId, tagNames | void | 设置记录的标签 |
| `rename_tag` | oldName, newName | TagDto | 重命名标签 |
| `update_tag_color` | name, color | TagDto | 更新标签颜色 |
| `get_tag_item_counts` | (无) | [string, string, number][] | 获取标签关联计数 |

### Attachment 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `add_attachment` | itemId, path | AttachmentResult | 添加附件 |
| `get_attachments` | itemId | AttachmentDto[] | 获取记录的附件 |
| `delete_attachment` | id | void | 删除附件 |

### Version 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `get_versions` | itemId | VersionDto[] | 获取记录的版本列表 |
| `create_version` | itemId, content, changeSummary?, name?, description? | VersionDto | 创建版本 |
| `update_version` | id, name, description | VersionDto | 更新版本信息 |
| `restore_version` | versionId | ItemDto | 恢复到指定版本 |
| `delete_version` | versionId | void | 删除版本 |

### Data I/O 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `export_data` | (无) | string | 导出为 JSON |
| `import_data` | json | void | 从 JSON 导入 |
| `save_to_file` | path, content | void | 保存文件到磁盘 |
| `read_from_file` | path | string | 从磁盘读取文件 |
| `get_export_size_estimate` | (无) | ExportSizeEstimate | 估算导出大小 |
| `export_data_zip` | path, options | void | 导出为 ZIP |
| `import_data_zip` | path, options | void | 从 ZIP 导入 |

### Sync 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `get_sync_config` | (无) | SyncConfig | 获取同步配置 |
| `save_sync_config_cmd` | config | void | 保存同步配置 |
| `get_sync_state` | (无) | SyncState | 获取同步状态 |
| `trigger_sync` | (无) | SyncResult | 触发同步 |
| `sync_login` | serverUrl, email, password | SyncLoginResult | 同步登录 |
| `sync_register` | serverUrl, email, password | SyncLoginResult | 同步注册 |
| `sync_logout` | (无) | void | 同步登出 |
| `sync_forgot_password` | serverUrl, email | string | 忘记密码 |
| `sync_reset_password` | serverUrl, email, resetToken, newPassword | void | 重置密码 |
| `test_sync_connection` | serverUrl | boolean | 测试连接 |
| `get_sync_history` | page, pageSize | PaginatedSyncHistory | 获取同步历史 |
| `get_pending_conflicts` | (无) | ConflictInfo[]? | 获取待解决冲突 |
| `resolve_sync_conflicts` | resolutions | SyncResult | 解决冲突 |
| `cancel_sync_conflicts` | (无) | void | 取消冲突解决 |

### Settings 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `load_all_settings` | (无) | Record<string, string> | 加载所有设置 |
| `save_settings` | settings | void | 保存设置 |

### Diagnostics 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `get_sql_log_config` | (无) | SqlLogConfig | 获取 SQL 日志配置 |
| `update_sql_log_config` | config | SqlLogConfig | 更新 SQL 日志配置 |
| `clear_sql_log` | (无) | void | 清空 SQL 日志 |
| `get_log_dir` | (无) | string | 获取日志目录 |
| `get_sql_log_path` | (无) | string | 获取 SQL 日志文件路径 |

### Auto Backup 命令

| 命令名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| `get_auto_backup_config` | (无) | AutoBackupConfig | 获取备份配置 |
| `update_auto_backup_config` | config | void | 更新备份配置 |
| `trigger_backup_now` | (无) | string | 立即备份 |
| `get_backup_dir_path` | (无) | string | 获取备份目录 |
| `list_backups` | (无) | BackupFileInfo[] | 列出备份文件 |
| `delete_backup` | filename | void | 删除备份 |

## 类型契约

### ItemDto

```typescript
interface ItemDto {
  id: string;
  title: string;
  item_type: string;
  content: string;
  summary: string;
  pinned: boolean;
  favorite: boolean;
  encrypted: boolean;
  created_at: string;
  updated_at: string;
}
```

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ItemDto {
    pub id: String,
    pub title: String,
    pub item_type: String,
    pub content: String,
    pub summary: String,
    pub pinned: bool,
    pub favorite: bool,
    pub encrypted: bool,
    pub created_at: String,
    pub updated_at: String,
}
```

### TagDto

```typescript
interface TagDto {
  name: string;
  color: string;
}
```

### VersionDto

```typescript
interface VersionDto {
  id: string;
  item_id: string;
  version_number: number;
  content: string;
  change_summary: string;
  name: string;
  description: string;
  created_at: string;
}
```

### AttachmentDto

```typescript
interface AttachmentDto {
  id: string;
  item_id: string;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}
```

### SyncConfig

```typescript
interface SyncConfig {
  enabled: boolean;
  server_url: string;
  access_token: string;
  refresh_token: string;
  user_id: string;
  device_id: string;
  auto_sync: boolean;
  sync_interval_minutes: number;
  conflict_resolution: string;
  sync_attachments: boolean;
  last_sync_at: string | null;
  last_snapshot_id: string | null;
}
```

### SearchResultDto

```typescript
interface SearchResultDto {
  id: string;
  title: string;
  item_type: string;
  summary: string;
}
```

## 错误处理

### 后端错误类型

所有 Command 返回 `Result<T, AppError>`，`AppError` 枚举定义如下：

```rust
pub enum AppError {
    Database(String),    // 数据库操作错误
    NotFound(String),    // 资源未找到
    Validation(String),  // 数据验证失败
    Io(String),          // 文件/IO 操作错误
    SyncError(String),   // 同步操作错误
    TokenExpired,        // 登录令牌过期
}
```

### 前端错误处理

前端通过 `try/catch` 或 `.catch()` 捕获错误，并使用 `toastStore` 展示用户友好的提示：

```typescript
try {
  await invoke("create_item", { title, itemType, content });
} catch (e) {
  // e 为 AppError 序列化后的字符串
  useToastStore.getState().addToast("error", "创建记录失败");
}
```

特殊的 `TokenExpired` 错误会触发自动登出流程，清除同步配置并停止自动同步定时器。
