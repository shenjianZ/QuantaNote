---
title: IPC Communication
description: QuantaNote frontend-backend communication mechanism — invoke() command calls, JSON serialization, complete command reference, and type contracts
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# IPC Communication

QuantaNote's frontend (React application in the WebView) and backend (Rust process) interact through Tauri's IPC (Inter-Process Communication) mechanism. All communication is based on `invoke()` function calls, with parameters and return values automatically serialized through JSON.

## Communication Mechanism

### invoke() Call Flow

The frontend initiates IPC calls through the `invoke()` function from `@tauri-apps/api/core`:

```
Frontend invoke("command_name", { arg1, arg2 })
  → JSON serialize parameters
    → IPC channel transport
      → Rust Command deserializes parameters
        → Execute business logic
          → Return Result<T, AppError>
            → JSON serialize result
              → IPC channel transport
                → Frontend receives result or catches error
```

### Service Layer Wrapper

All `invoke()` calls are uniformly wrapped in `src/services/tauriCommands.ts`, providing typed APIs:

```typescript
import { invoke } from "@tauri-apps/api/core";

// Item commands
export async function createItem(title: string, itemType: string, content?: string) {
  return invoke("create_item", { title, itemType, content: content ?? null });
}

export async function getItem(id: string) {
  return invoke("get_item", { id });
}
```

Stores communicate with the backend indirectly through the service layer, ensuring call consistency and maintainability.

## Command Reference

### Item Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `create_item` | title, itemType, content? | ItemDto | Create a new record |
| `get_items` | itemType?, limit?, offset? | ItemDto[] | Get record list |
| `get_item` | id | ItemDto | Get single record |
| `update_item` | id, title?, content?, summary?, pinned?, favorite?, encrypted? | ItemDto | Update record |
| `delete_item` | id | void | Delete record |
| `get_pinned_items` | (none) | ItemDto[] | Get pinned records |
| `get_recent_items` | limit? | ItemDto[] | Get recent records |
| `get_library_data` | (none) | LibraryData | Get complete library data |
| `get_db_size` | (none) | string | Get database size |
| `get_db_path` | (none) | string | Get database path |
| `optimize_db` | (none) | void | Optimize database |

### Search Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `search_items` | query, itemType?, tab?, tag?, sort?, mode?, scopes?, limit?, offset? | SearchPageDto | Normal/advanced search with total, matched fields, context, and highlight terms |

### Tag Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_all_tags` | (none) | TagDto[] | Get all tags |
| `create_tag` | name, color | TagDto | Create tag |
| `delete_tag` | name | void | Delete tag |
| `get_item_tags` | itemId | TagDto[] | Get item's tags |
| `get_all_item_tag_mappings` | (none) | [string, string][] | Get all item-tag mappings |
| `set_item_tags` | itemId, tagNames | void | Set item's tags |
| `rename_tag` | oldName, newName | TagDto | Rename tag |
| `update_tag_color` | name, color | TagDto | Update tag color |
| `get_tag_item_counts` | (none) | [string, string, number][] | Get tag item counts |

### Attachment Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `add_attachment` | itemId, path | AttachmentResult | Add attachment |
| `get_attachments` | itemId | AttachmentDto[] | Get item's attachments |
| `delete_attachment` | id | void | Delete attachment |

### Version Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_versions` | itemId | VersionDto[] | Get item's version list |
| `create_version` | itemId, content, changeSummary?, name?, description? | VersionDto | Create version |
| `update_version` | id, name, description | VersionDto | Update version info |
| `restore_version` | versionId | ItemDto | Restore to specified version |
| `delete_version` | versionId | void | Delete version |

### Data I/O Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `export_data` | (none) | string | Export as JSON |
| `import_data` | json | void | Import from JSON |
| `save_to_file` | path, content | void | Save file to disk |
| `read_from_file` | path | string | Read file from disk |
| `get_export_size_estimate` | (none) | ExportSizeEstimate | Estimate export size |
| `export_data_zip` | path, options | void | Export as ZIP |
| `import_data_zip` | path, options | void | Import from ZIP |

### Sync Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_sync_config` | (none) | SyncConfig | Get sync configuration |
| `save_sync_config_cmd` | config | void | Save sync configuration |
| `get_sync_state` | (none) | SyncState | Get sync state |
| `trigger_sync` | (none) | SyncResult | Trigger sync |
| `sync_login` | serverUrl, email, password | SyncLoginResult | Sync login |
| `sync_register` | serverUrl, email, password | SyncLoginResult | Sync register |
| `sync_logout` | (none) | void | Sync logout |
| `sync_forgot_password` | serverUrl, email | string | Forgot password |
| `sync_reset_password` | serverUrl, email, resetToken, newPassword | void | Reset password |
| `test_sync_connection` | serverUrl | boolean | Test connection |
| `get_sync_history` | page, pageSize | PaginatedSyncHistory | Get sync history |
| `get_pending_conflicts` | (none) | ConflictInfo[]? | Get pending conflicts |
| `resolve_sync_conflicts` | resolutions | SyncResult | Resolve conflicts |
| `cancel_sync_conflicts` | (none) | void | Cancel conflict resolution |

### Settings Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `load_all_settings` | (none) | Record<string, string> | Load all settings |
| `save_settings` | settings | void | Save settings |

### Diagnostics Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_sql_log_config` | (none) | SqlLogConfig | Get SQL log config |
| `update_sql_log_config` | config | SqlLogConfig | Update SQL log config |
| `clear_sql_log` | (none) | void | Clear SQL log |
| `get_log_dir` | (none) | string | Get log directory |
| `get_sql_log_path` | (none) | string | Get SQL log file path |

### Auto Backup Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_auto_backup_config` | (none) | AutoBackupConfig | Get backup config |
| `update_auto_backup_config` | config | void | Update backup config |
| `trigger_backup_now` | (none) | string | Trigger backup now |
| `get_backup_dir_path` | (none) | string | Get backup directory |
| `list_backups` | (none) | BackupFileInfo[] | List backup files |
| `delete_backup` | filename | void | Delete backup |

## Type Contracts

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

## Error Handling

### Backend Error Types

All Commands return `Result<T, AppError>`, where the `AppError` enum is defined as:

```rust
pub enum AppError {
    Database(String),    // Database operation error
    NotFound(String),    // Resource not found
    Validation(String),  // Data validation failure
    Io(String),          // File/IO operation error
    SyncError(String),   // Sync operation error
    TokenExpired,        // Login token expired
}
```

### Frontend Error Handling

The frontend catches errors via `try/catch` or `.catch()` and uses `toastStore` to display user-friendly notifications:

```typescript
try {
  await invoke("create_item", { title, itemType, content });
} catch (e) {
  // e is the serialized AppError string
  useToastStore.getState().addToast("error", "Failed to create record");
}
```

The special `TokenExpired` error triggers an automatic logout flow, clearing sync configuration and stopping the auto-sync timer.
