---
title: Backend Architecture
description: QuantaNote Rust backend directory structure, Command/Service/Repository three-layer architecture, sync engine, and error handling
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Backend Architecture

QuantaNote's backend is written in Rust and runs within the Tauri 2.0 runtime. It follows a strict three-layer architecture: Command Layer, Service Layer, and Repository Layer, ensuring separation of concerns and code maintainability.

## Directory Structure

```
src-tauri/src/
├── lib.rs                    — App entry point, registers all Tauri commands, initializes DB
├── main.rs                   — Rust program entry point
├── error.rs                  — AppError enum definition
├── config/
│   └── mod.rs                — Application configuration module
├── commands/                 — Command Layer: Tauri command handlers
│   ├── mod.rs                — Module exports
│   ├── item.rs               — Item CRUD commands
│   ├── tag.rs                — Tag management commands
│   ├── attachment.rs         — Attachment management commands
│   ├── version.rs            — Version management commands
│   ├── search.rs             — Full-text search command
│   ├── settings.rs           — Settings read/write commands
│   ├── data_io.rs            — Data import/export commands
│   ├── auto_backup.rs        — Auto backup scheduler commands
│   ├── diagnostics.rs        — Diagnostic tool commands (SQL logging)
│   └── sync.rs               — Sync-related commands
├── services/                 — Service Layer: Business logic
│   ├── mod.rs
│   ├── item_service.rs       — Item business logic
│   ├── tag_service.rs        — Tag business logic
│   ├── attachment_service.rs — Attachment business logic
│   ├── version_service.rs    — Version business logic
│   ├── search_service.rs     — Search business logic
│   └── settings_service.rs   — Settings business logic
├── repositories/             — Repository Layer: Data access
│   ├── mod.rs
│   ├── item_repository.rs    — Item SQL queries
│   ├── tag_repository.rs     — Tag SQL queries
│   ├── attachment_repository.rs — Attachment SQL queries
│   ├── version_repository.rs — Version SQL queries
│   ├── search_repository.rs  — Search SQL queries
│   └── settings_repository.rs — Settings SQL queries
├── models/                   — Data models (DTOs)
│   ├── mod.rs
│   ├── item.rs               — ItemDto, CreateItemPayload, UpdateItemPayload
│   ├── attachment.rs         — AttachmentDto
│   ├── version.rs            — VersionDto
│   ├── search.rs             — SearchResultDto
│   └── sync.rs               — SyncConfig, SyncState, SyncResult, etc.
├── sync/                     — Sync engine
│   ├── mod.rs                — Sync module entry point
│   ├── diff.rs               — Three-way diff engine
│   ├── transport.rs          — Network transport layer
│   └── state.rs              — Sync state management
├── db/
│   └── mod.rs                — Database connection management, Schema DDL, migrations
└── utils/
    ├── mod.rs
    ├── paths.rs              — Data directory path utilities
    ├── ids.rs                — UUID generation utilities
    └── logging.rs            — SQL logging utilities
```

## Command Layer

The Command Layer is the entry point for frontend-backend communication, with functions annotated using the `#[tauri::command]` macro. Each Command function is a thin handler responsible only for parameter reception and delegation:

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

All Commands are registered in `lib.rs` via the `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    item::create_item,
    item::get_items,
    item::get_item,
    item::update_item,
    item::delete_item,
    // ... more commands
    commands::sync::trigger_sync,
    update_window_behavior,
])
```

### Command Modules

| Module | File | Commands | Description |
|--------|------|----------|-------------|
| item | `commands/item.rs` | 8 | Record CRUD, pinned list, recent items, DB size and optimization |
| tag | `commands/tag.rs` | 8 | Tag CRUD, association management, rename, color update |
| attachment | `commands/attachment.rs` | 3 | Attachment add, query, delete |
| version | `commands/version.rs` | 5 | Version create, query, update, restore, delete |
| search | `commands/search.rs` | 1 | FTS5 full-text search |
| settings | `commands/settings.rs` | 2 | Settings read/write |
| data_io | `commands/data_io.rs` | 6 | JSON/ZIP import/export, file read/write, size estimation |
| auto_backup | `commands/auto_backup.rs` | 6 | Backup config, trigger, list, delete |
| diagnostics | `commands/diagnostics.rs` | 4 | SQL log config, clear, path retrieval |
| sync | `commands/sync.rs` | 12 | Sync config, state, auth, trigger, conflict resolution, history |

## Service Layer

The Service Layer is where core business logic resides, responsible for:

### Data Validation

Validating input data before create and update operations, such as ensuring titles are not empty and types are predefined values.

### Automatic Version Creation

When updating an Item, the Service automatically creates a version snapshot recording the content change history:

```rust
pub fn update(conn: &Connection, payload: UpdateItemPayload) -> Result<ItemDto, AppError> {
    // 1. Get current Item
    let current = ItemRepository::get_by_id(conn, &payload.id)?;
    // 2. Automatically create version snapshot
    VersionRepository::create(conn, &current.id, &current.content, "Auto save")?;
    // 3. Execute update
    ItemRepository::update(conn, payload)
}
```

### Transaction Orchestration

For operations involving multiple entities (e.g., data import), the Service coordinates calls to multiple Repositories within a transaction.

## Repository Layer

The Repository Layer directly interacts with SQLite using the `rusqlite` crate for SQL queries. Each Repository corresponds to a data entity:

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

The Repository Layer leverages Rust's type system to ensure SQL parameter type safety through the `rusqlite::params!` macro for parameter binding.

## Sync Engine

The `sync/` module implements a complete multi-device synchronization feature:

- **diff.rs** — Three-way diff engine that compares local baseline, local current state, and remote snapshot to generate change sets
- **transport.rs** — HTTP transport layer responsible for API communication with the sync server
- **state.rs** — Sync state management, tracking sync progress and conflict information

The sync engine supports two conflict resolution modes:
- **auto** — Automatically resolves conflicts (latest timestamp wins)
- **manual** — Pauses sync and prompts the user to manually choose

## Error Handling

The backend uses a unified `AppError` enum for all error handling:

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("IO error: {0}")]
    Io(String),
    #[error("Sync error: {0}")]
    SyncError(String),
    #[error("Login expired, please log in again")]
    TokenExpired,
}
```

### Error Propagation Flow

```
rusqlite::Error → AppError::Database(msg)
    ↓
Service Layer may convert to AppError::NotFound or AppError::Validation
    ↓
Command Layer returns Result<T, AppError>
    ↓
Tauri serializes AppError to JSON string
    ↓
Frontend catches the error string
```

`AppError` implements the `Serialize` trait, and error messages are serialized to strings for the frontend. The frontend catches errors via `try/catch` and uses `toastStore` to display user-friendly notifications.
