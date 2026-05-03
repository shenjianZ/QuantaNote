---
title: Database Design
description: QuantaNote's SQLite database configuration, table structure, FTS5 full-text search indexing, and schema migration system
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Database Design

QuantaNote uses SQLite as its local data storage engine, combined with FTS5 for full-text search. The database file is stored at `~/.quantanote/quanta_note.sqlite` (on Windows: `%USERPROFILE%\.quantanote\quanta_note.sqlite`).

## SQLite Configuration

On application startup, the database connection executes the following PRAGMA settings:

```rust
conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
```

### WAL Mode

Write-Ahead Logging (WAL) mode provides the following benefits:
- **Read-write concurrency**: Read operations do not block writes, and writes do not block reads
- **Performance improvement**: Reduced disk write frequency, improving transaction throughput
- **Application exit**: Executes `PRAGMA wal_checkpoint(TRUNCATE)` to merge WAL logs back into the main database file

### Foreign Key Constraints

Enabling `foreign_keys=ON` ensures referential integrity. For example, the `item_tags` table's `item_id` and `tag_id` fields are set with `ON DELETE CASCADE`, automatically cleaning up associations when records or tags are deleted.

## Table Structure

### items (Records Table)

Stores core data for all notes, links, files, and other records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID v4 unique identifier |
| title | TEXT NOT NULL | Record title |
| item_type | TEXT NOT NULL | Record type (note/link/file/image/code/task) |
| content | TEXT NOT NULL DEFAULT '' | Markdown content body |
| summary | TEXT NOT NULL DEFAULT '' | Summary/overview |
| pinned | INTEGER NOT NULL DEFAULT 0 | Whether pinned (0/1) |
| favorite | INTEGER NOT NULL DEFAULT 0 | Whether favorited (0/1) |
| encrypted | INTEGER NOT NULL DEFAULT 0 | Whether encrypted (0/1) |
| created_at | TEXT NOT NULL | Creation timestamp (ISO 8601) |
| updated_at | TEXT NOT NULL | Update timestamp (ISO 8601) |

```sql
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    item_type TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    favorite INTEGER NOT NULL DEFAULT 0,
    encrypted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### tags (Tags Table)

Stores user-defined tags.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Auto-increment primary key |
| uuid | TEXT NOT NULL UNIQUE | UUID identifier for sync |
| name | TEXT NOT NULL UNIQUE | Tag name (unique) |
| color | TEXT NOT NULL DEFAULT 'cyan' | Tag color |

```sql
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'cyan'
);
```

### item_tags (Item-Tag Association Table)

Many-to-many association table linking records and tags.

| Column | Type | Description |
|--------|------|-------------|
| item_id | TEXT NOT NULL | Associated item ID (FK, CASCADE delete) |
| tag_id | INTEGER NOT NULL | Associated tag ID (FK, CASCADE delete) |

```sql
CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);
```

### attachments (Attachments Table)

Stores information about files attached to records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID v4 identifier |
| item_id | TEXT NOT NULL | Parent item ID (FK, CASCADE delete) |
| filename | TEXT NOT NULL | File name |
| file_path | TEXT NOT NULL | Full file path on disk |
| mime_type | TEXT NOT NULL DEFAULT '' | MIME type |
| file_size | INTEGER NOT NULL DEFAULT 0 | File size in bytes |
| created_at | TEXT NOT NULL | Creation timestamp |

```sql
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
```

### versions (Versions Table)

Stores content version history for records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID v4 identifier |
| item_id | TEXT NOT NULL | Parent item ID (FK, CASCADE delete) |
| version_number | INTEGER NOT NULL | Version number (incrementing) |
| content | TEXT NOT NULL DEFAULT '' | Content snapshot for this version |
| change_summary | TEXT NOT NULL DEFAULT '' | Change summary |
| name | TEXT NOT NULL DEFAULT '' | Version name |
| description | TEXT NOT NULL DEFAULT '' | Version description |
| created_at | TEXT NOT NULL | Creation timestamp |

```sql
CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    change_summary TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
```

### settings (Settings Table)

Key-value pair settings storage.

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PRIMARY KEY | Setting key name |
| value | TEXT NOT NULL | Setting value (JSON string) |

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### sync_baseline (Sync Baseline Table)

Records the last sync state for each record, used for three-way diff computation.

| Column | Type | Description |
|--------|------|-------------|
| record_id | TEXT NOT NULL | Record ID |
| table_name | TEXT NOT NULL | Table name |
| content_hash | TEXT NOT NULL | Content hash |
| synced_at | TEXT NOT NULL | Sync timestamp |

```sql
CREATE TABLE IF NOT EXISTS sync_baseline (
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (record_id, table_name)
);
```

### sync_tombstones (Sync Tombstones Table)

Records identifiers of deleted records for propagating deletions during sync.

| Column | Type | Description |
|--------|------|-------------|
| record_id | TEXT NOT NULL | Deleted record ID |
| table_name | TEXT NOT NULL | Table name |
| deleted_at | TEXT NOT NULL | Deletion timestamp |

```sql
CREATE TABLE IF NOT EXISTS sync_tombstones (
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (record_id, table_name)
);
```

## FTS Indexes

QuantaNote uses two FTS5 virtual tables for full-text search, covering different search scenarios.

### items_fts (Tokenizer Index)

Uses the `unicode61` tokenizer, supporting Chinese and English tokenization. Suitable for general keyword searches.

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title,
    content,
    summary,
    tokenize = 'unicode61',
    content=items,
    content_rowid=rowid
);
```

### items_fts_trigram (Trigram Index)

Uses the `trigram` tokenizer, supporting substring matching. Suitable for exact string match searches.

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts_trigram USING fts5(
    title,
    content,
    summary,
    tokenize = 'trigram',
    content=items,
    content_rowid=rowid
);
```

### Auto-Sync Triggers

Each FTS table is configured with 3 triggers (INSERT/UPDATE/DELETE) to keep indexes in sync with the source table:

```sql
-- Sync to FTS on insert
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

-- Delete old index then insert new index on update
CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
    INSERT INTO items_fts(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

-- Clear index on delete
CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
END;
```

A total of 6 triggers (3 per FTS table) automatically maintain index consistency.

## Schema Migration

QuantaNote uses a version-based migration system to manage database schema changes.

### Migration Mechanism

1. The `schema_version` table records the current database schema version number
2. On each startup, `initialize_schema()` executes the base DDL first, then calls `migrate_schema()`
3. `migrate_schema()` compares the current version with the target version and executes missing migrations in order

```rust
const SCHEMA_VERSION: i64 = 5;

fn migrate_schema(conn: &Connection) -> Result<(), AppError> {
    let current_version: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |row| row.get(0),
    )?;

    if current_version >= SCHEMA_VERSION {
        return Ok(());
    }

    if current_version < 2 {
        // Rebuild trigram FTS index
    }
    if current_version < 3 {
        // Create settings table
    }
    if current_version < 4 {
        // Create sync_baseline table
    }
    if current_version < 5 {
        // Create sync_tombstones table
    }

    Ok(())
}
```

### Version History

| Version | Changes |
|---------|---------|
| 1 | Initial schema — items, tags, item_tags, attachments, versions, items_fts |
| 2 | Added items_fts_trigram trigram index, rebuilt FTS data |
| 3 | Added settings key-value storage table |
| 4 | Added sync_baseline sync baseline table |
| 5 | Added sync_tombstones sync tombstones table |
