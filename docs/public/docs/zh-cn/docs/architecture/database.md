---
title: 数据库设计
description: QuantaNote 的 SQLite 数据库配置、表结构、FTS5 全文检索和 Schema 迁移系统
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# 数据库设计

QuantaNote 使用 SQLite 作为本地数据存储引擎，配合 FTS5 实现全文检索。数据库文件存储在 `~/.quantanote/quanta_note.sqlite`（Windows 为 `%USERPROFILE%\.quantanote\quanta_note.sqlite`）。

## SQLite 配置

应用启动时，数据库连接会执行以下 PRAGMA 设置：

```rust
conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
```

### WAL 模式

Write-Ahead Logging (WAL) 模式提供了以下优势：
- **读写并发**：读操作不会阻塞写操作，写操作不会阻塞读操作
- **性能提升**：减少了磁盘写入次数，提高事务处理速度
- **应用退出时**：执行 `PRAGMA wal_checkpoint(TRUNCATE)` 将 WAL 日志合并回主数据库文件

### 外键约束

启用 `foreign_keys=ON` 确保了引用完整性。例如 `item_tags` 表的 `item_id` 和 `tag_id` 字段设置了 `ON DELETE CASCADE`，删除记录或标签时会自动清理关联关系。

## 表结构

### items（记录表）

存储所有笔记、链接、文件等记录的核心数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID v4 格式的唯一标识 |
| title | TEXT NOT NULL | 记录标题 |
| item_type | TEXT NOT NULL | 记录类型（note/link/file/image/code/task） |
| content | TEXT NOT NULL DEFAULT '' | Markdown 内容正文 |
| summary | TEXT NOT NULL DEFAULT '' | 摘要/概述 |
| summary_mode | TEXT NOT NULL DEFAULT 'auto' | 摘要模式：auto 或 manual |
| pinned | INTEGER NOT NULL DEFAULT 0 | 是否置顶（0/1） |
| favorite | INTEGER NOT NULL DEFAULT 0 | 是否收藏（0/1） |
| encrypted | INTEGER NOT NULL DEFAULT 0 | 是否加密（0/1） |
| created_at | TEXT NOT NULL | 创建时间（ISO 8601） |
| updated_at | TEXT NOT NULL | 更新时间（ISO 8601） |

```sql
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    item_type TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    summary_mode TEXT NOT NULL DEFAULT 'auto',
    pinned INTEGER NOT NULL DEFAULT 0,
    favorite INTEGER NOT NULL DEFAULT 0,
    encrypted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### tags（标签表）

存储用户自定义的标签。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | 自增主键 |
| uuid | TEXT NOT NULL UNIQUE | UUID 标识，用于同步 |
| name | TEXT NOT NULL UNIQUE | 标签名称（唯一） |
| color | TEXT NOT NULL DEFAULT 'cyan' | 标签颜色 |

```sql
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'cyan'
);
```

### item_tags（记录-标签关联表）

多对多关联表，连接记录和标签。

| 字段 | 类型 | 说明 |
|------|------|------|
| item_id | TEXT NOT NULL | 关联记录 ID（外键，CASCADE 删除） |
| tag_id | INTEGER NOT NULL | 关联标签 ID（外键，CASCADE 删除） |

```sql
CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);
```

### attachments（附件表）

存储记录关联的附件文件信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID v4 标识 |
| item_id | TEXT NOT NULL | 所属记录 ID（外键，CASCADE 删除） |
| filename | TEXT NOT NULL | 文件名 |
| file_path | TEXT NOT NULL | 文件在磁盘上的完整路径 |
| mime_type | TEXT NOT NULL DEFAULT '' | MIME 类型 |
| file_size | INTEGER NOT NULL DEFAULT 0 | 文件大小（字节） |
| created_at | TEXT NOT NULL | 创建时间 |

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

### versions（版本表）

存储记录的内容版本历史。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | UUID v4 标识 |
| item_id | TEXT NOT NULL | 所属记录 ID（外键，CASCADE 删除） |
| version_number | INTEGER NOT NULL | 版本号（递增） |
| content | TEXT NOT NULL DEFAULT '' | 该版本的内容快照 |
| change_summary | TEXT NOT NULL DEFAULT '' | 变更摘要 |
| name | TEXT NOT NULL DEFAULT '' | 版本名称 |
| description | TEXT NOT NULL DEFAULT '' | 版本描述 |
| created_at | TEXT NOT NULL | 创建时间 |

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

### settings（设置表）

键值对形式的设置存储。

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PRIMARY KEY | 设置键名 |
| value | TEXT NOT NULL | 设置值（JSON 字符串） |

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### sync_baseline（同步基线表）

记录每条记录最后一次同步的状态，用于三方差异计算。

| 字段 | 类型 | 说明 |
|------|------|------|
| record_id | TEXT NOT NULL | 记录 ID |
| table_name | TEXT NOT NULL | 所属表名 |
| content_hash | TEXT NOT NULL | 内容哈希 |
| synced_at | TEXT NOT NULL | 同步时间 |

```sql
CREATE TABLE IF NOT EXISTS sync_baseline (
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (record_id, table_name)
);
```

### sync_tombstones（同步墓碑表）

记录已删除的记录标识，用于同步时传播删除操作。

| 字段 | 类型 | 说明 |
|------|------|------|
| record_id | TEXT NOT NULL | 已删除的记录 ID |
| table_name | TEXT NOT NULL | 所属表名 |
| deleted_at | TEXT NOT NULL | 删除时间 |

```sql
CREATE TABLE IF NOT EXISTS sync_tombstones (
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (record_id, table_name)
);
```

## FTS 索引

QuantaNote 使用两个 FTS5 虚拟表实现全文搜索，覆盖不同的搜索场景。

### items_fts（分词索引）

使用 `unicode61` 分词器，支持中英文分词。适用于常规的关键词搜索。

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

### items_fts_trigram（三元组索引）

使用 `trigram` 分词器，支持子串匹配。适用于精确的字符串匹配搜索。

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

### 自动同步触发器

每个 FTS 表都配置了 3 个触发器（INSERT/UPDATE/DELETE），确保索引与源表实时同步：

```sql
-- 插入时同步到 FTS
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

-- 更新时先删旧索引再插新索引
CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
    INSERT INTO items_fts(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

-- 删除时清除索引
CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
END;
```

共计 6 个触发器（每个 FTS 表 3 个），自动维护索引的一致性。

## Schema 迁移

QuantaNote 使用基于版本号的迁移系统管理数据库 Schema 变更。

### 迁移机制

1. `schema_version` 表记录当前数据库的 Schema 版本号
2. 每次启动时，`initialize_schema()` 先执行基础 DDL，然后调用 `migrate_schema()`
3. `migrate_schema()` 对比当前版本和目标版本，按顺序执行缺失的迁移

```rust
const SCHEMA_VERSION: i64 = 8;

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
        // 重建 trigram FTS 索引
    }
    if current_version < 3 {
        // 创建 settings 表
    }
    if current_version < 4 {
        // 创建 sync_baseline 表
    }
    if current_version < 5 {
        // 创建 sync_tombstones 表
    }
    if current_version < 8 {
        // 增加 summary_mode，并识别旧摘要的自动/手动模式
    }

    Ok(())
}
```

### 版本历史

| 版本 | 变更内容 |
|------|----------|
| 1 | 初始 Schema — items, tags, item_tags, attachments, versions, items_fts |
| 2 | 添加 items_fts_trigram 三元组索引，重建 FTS 数据 |
| 3 | 添加 settings 键值对存储表 |
| 4 | 添加 sync_baseline 同步基线表 |
| 5 | 添加 sync_tombstones 同步墓碑表 |
