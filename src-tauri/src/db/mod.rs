use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::error::AppError;
use crate::utils::logging;

#[derive(Clone)]
pub struct DbState {
    pub conn: Arc<Mutex<Connection>>,
}

const SCHEMA_SQL: &str = "
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

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

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'cyan',
    updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z'
);

CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z',
    PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

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

CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title,
    content,
    summary,
    tokenize = 'unicode61',
    content=items,
    content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS items_fts_trigram USING fts5(
    title,
    content,
    summary,
    tokenize = 'trigram',
    content=items,
    content_rowid=rowid
);

CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
    INSERT INTO items_fts(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS items_trigram_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts_trigram(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS items_trigram_ad AFTER DELETE ON items BEGIN
    INSERT INTO items_fts_trigram(items_fts_trigram, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS items_trigram_au AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts_trigram(items_fts_trigram, rowid, title, content, summary)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary);
    INSERT INTO items_fts_trigram(rowid, title, content, summary)
    VALUES (new.rowid, new.title, new.content, new.summary);
END;

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL DEFAULT '',
    temperature REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_chat_summaries (
    session_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL DEFAULT '',
    summarized_until TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_item
    ON ai_chat_messages(item_id, created_at);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
";

const SCHEMA_VERSION: i64 = 15;

impl DbState {
    pub fn open(db_path: &str) -> Result<Self, AppError> {
        let mut conn = Connection::open(db_path).map_err(|e| AppError::Database(e.to_string()))?;

        #[allow(deprecated)]
        conn.trace(Some(logging::log_sql));

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn initialize_schema(&self) -> Result<(), AppError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        conn.execute_batch(SCHEMA_SQL)
            .map_err(|e| AppError::Database(e.to_string()))?;
        Self::migrate_schema(&conn)?;
        Ok(())
    }

    fn migrate_schema(conn: &Connection) -> Result<(), AppError> {
        let current_version: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        if current_version >= SCHEMA_VERSION {
            return Ok(());
        }

        if current_version < 2 {
            conn.execute_batch(
                "INSERT INTO items_fts_trigram(items_fts_trigram) VALUES('rebuild');
                 INSERT OR IGNORE INTO schema_version (version) VALUES (2);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 3 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                 );
                 INSERT OR IGNORE INTO schema_version (version) VALUES (3);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 4 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS sync_baseline (
                    record_id TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    synced_at TEXT NOT NULL,
                    PRIMARY KEY (record_id, table_name)
                 );
                 INSERT OR IGNORE INTO schema_version (version) VALUES (4);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 5 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS sync_tombstones (
                    record_id TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    deleted_at TEXT NOT NULL,
                    PRIMARY KEY (record_id, table_name)
                 );
                 INSERT OR IGNORE INTO schema_version (version) VALUES (5);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 6 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS user_profile (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    nickname TEXT,
                    avatar_url TEXT,
                    bio TEXT,
                    phone TEXT,
                    address TEXT,
                    updated_at TEXT NOT NULL
                 );
                 INSERT OR IGNORE INTO schema_version (version) VALUES (6);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 7 {
            conn.execute_batch(
                "ALTER TABLE items ADD COLUMN deleted_at TEXT;
                 INSERT OR IGNORE INTO schema_version (version) VALUES (7);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 8 {
            conn.execute_batch(
                "ALTER TABLE items ADD COLUMN summary_mode TEXT NOT NULL DEFAULT 'auto';
                 UPDATE items
                 SET summary_mode = 'manual'
                 WHERE length(trim(summary)) > 0
                   AND summary != substr(content, 1, 10);
                 INSERT OR IGNORE INTO schema_version (version) VALUES (8);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 9 {
            let has_tag_updated_at = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('tags') WHERE name = 'updated_at'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|e| AppError::Database(e.to_string()))?
                > 0;
            if !has_tag_updated_at {
                conn.execute_batch(
                    "ALTER TABLE tags ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z';",
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
            }

            let has_item_tag_updated_at = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('item_tags') WHERE name = 'updated_at'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|e| AppError::Database(e.to_string()))?
                > 0;
            if !has_item_tag_updated_at {
                conn.execute_batch(
                    "ALTER TABLE item_tags ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z';",
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
            }

            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE tags SET updated_at = ?1 WHERE updated_at = '1970-01-01T00:00:00Z'",
                [&now],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
            conn.execute(
                "UPDATE item_tags SET updated_at = ?1 WHERE updated_at = '1970-01-01T00:00:00Z'",
                [&now],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
            conn.execute(
                "INSERT OR IGNORE INTO schema_version (version) VALUES (9)",
                [],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 10 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    content TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                 );
                 INSERT OR IGNORE INTO schema_version (version) VALUES (10);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 11 {
            let has_content_hash = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('attachments') WHERE name = 'content_hash'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|e| AppError::Database(e.to_string()))?
                > 0;
            if !has_content_hash {
                conn.execute_batch(
                    "ALTER TABLE attachments ADD COLUMN content_hash TEXT NOT NULL DEFAULT '';",
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
            }
            conn.execute(
                "INSERT OR IGNORE INTO schema_version (version) VALUES (11)",
                [],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 12 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS ai_chat_messages (
                    id TEXT PRIMARY KEY,
                    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                 );
                 CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_item
                    ON ai_chat_messages(item_id, created_at);
                 INSERT OR IGNORE INTO schema_version (version) VALUES (12);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 13 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS ai_chat_summaries (
                    item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
                    summary TEXT NOT NULL DEFAULT '',
                    summarized_until TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL
                 );
                 INSERT OR IGNORE INTO schema_version (version) VALUES (13);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 14 {
            // 会话化：新 sessions 表；messages 挂 session；summaries 由 item 维度改为 session 维度。
            // 旧数据（item 级）自动归入每篇笔记的"默认会话"。新装库（SCHEMA_SQL 已是 v14 结构）
            // 通过结构探测跳过 ALTER/搬运，仅补版本号。
            let has_session_column = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('ai_chat_messages') WHERE name = 'session_id'",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(|e| AppError::Database(e.to_string()))?
                > 0;

            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS ai_chat_sessions (
                    id TEXT PRIMARY KEY,
                    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                    title TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL DEFAULT '',
                    system_prompt TEXT NOT NULL DEFAULT '',
                    temperature REAL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                 );
                 CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session
                    ON ai_chat_messages(session_id, created_at);",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

            if !has_session_column {
                conn.execute_batch(
                    "ALTER TABLE ai_chat_messages ADD COLUMN session_id TEXT NOT NULL DEFAULT '';
                     CREATE TABLE IF NOT EXISTS ai_chat_summaries_v14 (
                        session_id TEXT PRIMARY KEY,
                        summary TEXT NOT NULL DEFAULT '',
                        summarized_until TEXT NOT NULL DEFAULT '',
                        updated_at TEXT NOT NULL
                     );
                     INSERT INTO ai_chat_sessions (id, item_id, title, created_at, updated_at)
                     SELECT 'sess-default-' || item_id, item_id, '默认会话',
                            COALESCE(MIN(created_at), '1970-01-01T00:00:00Z'),
                            COALESCE(MAX(created_at), '1970-01-01T00:00:00Z')
                     FROM ai_chat_messages GROUP BY item_id;
                     UPDATE ai_chat_messages
                     SET session_id = 'sess-default-' || item_id
                     WHERE session_id = '';
                     INSERT OR IGNORE INTO ai_chat_summaries_v14 (session_id, summary, summarized_until, updated_at)
                     SELECT 'sess-default-' || item_id, summary, summarized_until, updated_at
                     FROM ai_chat_summaries;
                     DROP TABLE ai_chat_summaries;
                     ALTER TABLE ai_chat_summaries_v14 RENAME TO ai_chat_summaries;",
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
            }

            conn.execute(
                "INSERT OR IGNORE INTO schema_version (version) VALUES (14)",
                [],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        if current_version < 15 {
            // v14 开发中途存在过一版不含会话配置列的 sessions 结构；
            // 已按旧结构建库的用户不会再走 v14 分支，这里幂等补齐缺失列。
            let missing_columns: Vec<(&str, &str)> = vec![
                ("model", "ALTER TABLE ai_chat_sessions ADD COLUMN model TEXT NOT NULL DEFAULT ''"),
                (
                    "system_prompt",
                    "ALTER TABLE ai_chat_sessions ADD COLUMN system_prompt TEXT NOT NULL DEFAULT ''",
                ),
                (
                    "temperature",
                    "ALTER TABLE ai_chat_sessions ADD COLUMN temperature REAL",
                ),
            ];
            for (column, ddl) in missing_columns {
                let exists = conn
                    .query_row(
                        "SELECT COUNT(*) FROM pragma_table_info('ai_chat_sessions') WHERE name = ?1",
                        [column],
                        |row| row.get::<_, i64>(0),
                    )
                    .map_err(|e| AppError::Database(e.to_string()))?
                    > 0;
                if !exists {
                    conn.execute_batch(ddl)
                        .map_err(|e| AppError::Database(e.to_string()))?;
                }
            }
            conn.execute(
                "INSERT OR IGNORE INTO schema_version (version) VALUES (15)",
                [],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }

        Ok(())
    }

    pub fn checkpoint_wal(&self) -> Result<(), AppError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initializes_schema_with_fts_tables_and_triggers() {
        let db = DbState::open(":memory:").expect("open db");
        db.initialize_schema().expect("initialize schema");
        let conn = db.conn.lock().expect("lock db");

        let item_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name = 'items'",
                [],
                |row| row.get(0),
            )
            .expect("items table count");
        assert_eq!(item_count, 1);

        let summary_mode_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('items') WHERE name = 'summary_mode'",
                [],
                |row| row.get(0),
            )
            .expect("summary mode column count");
        assert_eq!(summary_mode_count, 1);

        let fts_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('items_fts', 'items_fts_trigram')",
                [],
                |row| row.get(0),
            )
            .expect("fts table count");
        assert_eq!(fts_count, 2);

        let trigger_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name IN (
                    'items_ai', 'items_ad', 'items_au',
                    'items_trigram_ai', 'items_trigram_ad', 'items_trigram_au'
                )",
                [],
                |row| row.get(0),
            )
            .expect("trigger count");
        assert_eq!(trigger_count, 6);
    }

    #[test]
    fn migrates_v14_sessions_without_config_columns() {
        // 模拟 v14 开发中途的旧结构：sessions 无 model/system_prompt/temperature 列。
        let db = DbState::open(":memory:").expect("open db");
        {
            let conn = db.conn.lock().expect("lock db");
            conn.execute_batch(SCHEMA_SQL).expect("create base schema");
            conn.execute_batch(
                "DROP TABLE ai_chat_sessions;
                 CREATE TABLE ai_chat_sessions (
                    id TEXT PRIMARY KEY,
                    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                    title TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                 );
                 INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
                 VALUES ('item-1', 'T', 'note', '', '', '2026-01-01', '2026-01-01');
                 INSERT INTO ai_chat_sessions (id, item_id, title, created_at, updated_at)
                 VALUES ('sess-1', 'item-1', '旧会话', '2026-01-01', '2026-01-01');
                 DELETE FROM schema_version WHERE version >= 14;
                 INSERT OR IGNORE INTO schema_version (version) VALUES (14);",
            )
            .expect("seed legacy v14 sessions");
        }

        db.initialize_schema().expect("migrate schema");

        let conn = db.conn.lock().expect("lock db");
        for column in ["model", "system_prompt", "temperature"] {
            let exists = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('ai_chat_sessions') WHERE name = ?1",
                    [column],
                    |row| row.get::<_, i64>(0),
                )
                .expect("column check");
            assert_eq!(exists, 1, "column {column} should exist after migration");
        }
        let title: String = conn
            .query_row(
                "SELECT title FROM ai_chat_sessions WHERE id = 'sess-1'",
                [],
                |row| row.get(0),
            )
            .expect("legacy session preserved");
        assert_eq!(title, "旧会话");
    }

    #[test]
    fn settings_table_exists_after_init() {
        let db = DbState::open(":memory:").expect("open db");
        db.initialize_schema().expect("initialize schema");
        let conn = db.conn.lock().expect("lock db");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
                [],
                |row| row.get(0),
            )
            .expect("settings table count");
        assert_eq!(count, 1);
    }

    #[test]
    fn templates_table_exists_after_init() {
        let db = DbState::open(":memory:").expect("open db");
        db.initialize_schema().expect("initialize schema");
        let conn = db.conn.lock().expect("lock db");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'templates'",
                [],
                |row| row.get(0),
            )
            .expect("templates table count");
        assert_eq!(count, 1);

        let version: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
                row.get(0)
            })
            .expect("schema version");
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn migrates_legacy_summary_values_to_manual_mode() {
        let db = DbState::open(":memory:").expect("open db");
        let conn = db.conn.lock().expect("lock db");
        conn.execute_batch(SCHEMA_SQL)
            .expect("create legacy schema");
        conn.execute_batch(
            "DELETE FROM schema_version;
             INSERT INTO schema_version (version) VALUES (7);
             ALTER TABLE items ADD COLUMN deleted_at TEXT;
             INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
             VALUES ('legacy-manual', 'Legacy', 'note', 'abcdefghijkl', '固定摘要', '2026-01-01', '2026-01-01');
             INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
             VALUES ('legacy-auto', 'Legacy Auto', 'note', 'abcdefghijkl', 'abcdefghij', '2026-01-01', '2026-01-01');",
        )
        .expect("seed legacy items");

        DbState::migrate_schema(&conn).expect("migrate schema");

        let manual_mode: String = conn
            .query_row(
                "SELECT summary_mode FROM items WHERE id = 'legacy-manual'",
                [],
                |row| row.get(0),
            )
            .expect("legacy manual mode");
        let auto_mode: String = conn
            .query_row(
                "SELECT summary_mode FROM items WHERE id = 'legacy-auto'",
                [],
                |row| row.get(0),
            )
            .expect("legacy auto mode");
        assert_eq!(manual_mode, "manual");
        assert_eq!(auto_mode, "auto");
    }

    #[test]
    fn fts_triggers_track_insert_update_and_delete() {
        let db = DbState::open(":memory:").expect("open db");
        db.initialize_schema().expect("initialize schema");
        let conn = db.conn.lock().expect("lock db");

        conn.execute(
            "INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
             VALUES ('item-test', 'Rust search', 'note', 'alpha token', '', '2026-01-01', '2026-01-01')",
            [],
        )
        .expect("insert item");
        let alpha_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM items_fts WHERE items_fts MATCH 'alpha'",
                [],
                |row| row.get(0),
            )
            .expect("alpha fts count");
        assert_eq!(alpha_count, 1);

        conn.execute(
            "UPDATE items SET content = 'beta token' WHERE id = 'item-test'",
            [],
        )
        .expect("update item");
        let beta_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM items_fts WHERE items_fts MATCH 'beta'",
                [],
                |row| row.get(0),
            )
            .expect("beta fts count");
        assert_eq!(beta_count, 1);

        conn.execute("DELETE FROM items WHERE id = 'item-test'", [])
            .expect("delete item");
        let deleted_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM items_fts WHERE items_fts MATCH 'beta'",
                [],
                |row| row.get(0),
            )
            .expect("deleted fts count");
        assert_eq!(deleted_count, 0);
    }
}
