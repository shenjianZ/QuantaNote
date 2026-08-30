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
    color TEXT NOT NULL DEFAULT 'cyan'
);

CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
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

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
";

const SCHEMA_VERSION: i64 = 8;

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
