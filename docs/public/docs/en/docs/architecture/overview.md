---
title: Architecture Overview
description: QuantaNote's overall architecture design — Tauri 2.0 high-level structure, layered design pattern, communication model, and data flow
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Architecture Overview

QuantaNote is a local-first desktop information management tool built on Tauri 2.0. It combines a modern web frontend with a high-performance Rust backend, providing a rich feature set while remaining lightweight.

## Tauri 2.0 High-Level Architecture

QuantaNote runs on the Tauri 2.0 framework, which provides a bridge between the web frontend and native system capabilities:

```
+--------------------------------------------------+
|                   Tauri Runtime                    |
|  +--------------------+  +---------------------+  |
|  |   WebView (Frontend)|  |   Rust Backend       |  |
|  |   React 19         |  |   Tauri Commands     |  |
|  |   TypeScript       |  |   Services           |  |
|  |   Zustand Stores   |  |   Repositories       |  |
|  |   TailwindCSS 4    |  |   SQLite (rusqlite)  |  |
|  +--------------------+  +---------------------+  |
|           |                          ^             |
|           |     invoke() / IPC       |             |
|           v                          |             |
|        JSON Serialization / Deserialization       |
+--------------------------------------------------+
           |
           v
   Native System APIs (File System, Tray, Autostart, Dialogs)
```

- **WebView Layer**: Runs the Chromium-based frontend application, responsible for UI rendering and user interaction
- **Rust Layer**: Handles data persistence, business logic, and system API calls
- **Tauri Runtime**: Manages inter-process communication (IPC), window lifecycle, and the plugin system

## Layered Design

The backend follows a strict three-layer architecture ensuring separation of concerns:

```
Commands (Command Layer)
    ↓ Parameter parsing and validation
Services (Service Layer)
    ↓ Business logic and orchestration
Repositories (Data Access Layer)
    ↓ Raw SQL queries
SQLite Database
```

### Command Layer

Thin handlers annotated with `#[tauri::command]`, responsible for receiving frontend requests, parsing parameters, and delegating calls to the corresponding Service. The Command layer contains no business logic — it only performs parameter transformation and error mapping.

### Service Layer

The core of business logic. Responsible for data validation, business rule execution, transaction orchestration, and automatic version creation. For example, when updating an Item, the Service automatically creates a version snapshot.

### Repository Layer

Directly interacts with the SQLite database using `rusqlite` for raw SQL queries. Each Repository corresponds to a data entity (Item, Tag, Attachment, Version, etc.) and encapsulates CRUD operations.

## Communication Model

The frontend and backend communicate through Tauri's `invoke()` mechanism:

1. **Frontend initiates call**: Sends an IPC call via `invoke("command_name", { args })`
2. **Parameter serialization**: Parameters are automatically serialized to JSON and passed to the Rust side
3. **Rust processes request**: The corresponding Command function receives the deserialized parameters
4. **Result returned**: Command returns `Result<T, AppError>`, serialized to JSON on success
5. **Frontend handles result**: Processes success and error cases via `try/catch` or `.catch()`

```typescript
// Frontend call example
const item = await invoke<ItemDto>("create_item", {
  title: "My Note",
  itemType: "note",
  content: "Content...",
});
```

```rust
// Backend Command handler
#[tauri::command]
fn create_item(title: String, item_type: String, content: Option<String>) -> Result<ItemDto, AppError> {
    let service = ItemService::new();
    service.create(title, item_type, content)
}
```

## Data Flow

A typical data operation follows this path:

```
User Action → UI Component → Zustand Store → invoke() → Tauri Command
    → Service → Repository → SQLite → Return Result
    → Store Updates State → UI Re-renders
```

### Read Flow Example

1. User opens the Library page
2. `LibraryPage` component calls `itemStore.fetchLibraryData()` on mount
3. Store initiates IPC call via `invoke("get_library_data")`
4. Rust Command receives the request, delegates to Service for querying
5. Repository executes SQL query, returns a collection of `ItemDto`
6. Result is serialized to JSON and returned to the frontend
7. Store updates the `items` state, triggering UI render

### Write Flow Example

1. User enters content in the Workspace and submits
2. Component calls `itemStore.createItem(title, type, content)`
3. Store initiates call via `invoke("create_item", { ... })`
4. Rust Command delegates to Service to create the record
5. Service validates parameters, Repository executes INSERT SQL
6. FTS triggers automatically update the full-text search index
7. Returns the newly created `ItemDto`, Store appends it to the list
8. UI reflects the new record in real time
