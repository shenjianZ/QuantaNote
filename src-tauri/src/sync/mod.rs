pub mod diff;
pub mod state;
pub mod transport;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::sync::*;
use crate::sync::state::SyncStateManager;
use std::collections::HashMap;
use tauri::AppHandle;

/// 同步引擎，持有状态管理器
pub struct SyncEngine {
    state_manager: SyncStateManager,
}

impl SyncEngine {
    pub fn new(_config: &SyncConfig) -> Self {
        Self {
            state_manager: SyncStateManager::new(),
        }
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.state_manager.set_app_handle(handle);
    }

    pub fn state_manager(&self) -> &SyncStateManager {
        &self.state_manager
    }
}

pub fn apply_item(conn: &rusqlite::Connection, data: &serde_json::Value) -> Result<(), AppError> {
    let id = data["id"].as_str().unwrap_or_default();

    // 处理删除标记：远程已删除的记录，本地也硬删除
    if data["_deleted"].as_bool().unwrap_or(false) {
        conn.execute("DELETE FROM items WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;
        // 也记录 tombstone，防止再次同步回来
        let deleted_at = data["deleted_at"].as_str().unwrap_or("");
        conn.execute(
            "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'items', ?2)",
            rusqlite::params![id, deleted_at],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        return Ok(());
    }

    let title = data["title"].as_str().unwrap_or_default();
    let item_type = data["item_type"].as_str().unwrap_or("note");
    let content = data["content"].as_str().unwrap_or_default();
    let summary = data["summary"].as_str().unwrap_or_default();
    let pinned = data["pinned"].as_bool().unwrap_or(false) as i32;
    let favorite = data["favorite"].as_bool().unwrap_or(false) as i32;
    let encrypted = data["encrypted"].as_bool().unwrap_or(false) as i32;
    let created_at = data["created_at"].as_str().unwrap_or_default();
    let updated_at = data["updated_at"].as_str().unwrap_or_default();

    conn.execute(
        "INSERT INTO items (id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, item_type=excluded.item_type, content=excluded.content, summary=excluded.summary, pinned=excluded.pinned, favorite=excluded.favorite, encrypted=excluded.encrypted, created_at=excluded.created_at, updated_at=excluded.updated_at",
        rusqlite::params![id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    // 清理可能残留的 tombstone（记录被重新创建的场景）
    conn.execute(
        "DELETE FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'items'",
        rusqlite::params![id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn apply_tag(conn: &rusqlite::Connection, data: &serde_json::Value) -> Result<(), AppError> {
    let uuid = data["uuid"].as_str().unwrap_or_default();

    // 处理删除标记
    if data["_deleted"].as_bool().unwrap_or(false) {
        conn.execute("DELETE FROM tags WHERE uuid = ?1", rusqlite::params![uuid])
            .map_err(|e| AppError::Database(e.to_string()))?;
        let deleted_at = data["deleted_at"].as_str().unwrap_or("");
        conn.execute(
            "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'tags', ?2)",
            rusqlite::params![uuid, deleted_at],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        return Ok(());
    }

    let name = data["name"].as_str().unwrap_or_default();
    let color = data["color"].as_str().unwrap_or_default();

    // 使用 uuid 做冲突判断，避免自增 ID 跨设备冲突
    conn.execute(
        "INSERT INTO tags (uuid, name, color) VALUES (?1, ?2, ?3)
         ON CONFLICT(uuid) DO UPDATE SET name=excluded.name, color=excluded.color",
        rusqlite::params![uuid, name, color],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    // 清理可能残留的 tombstone
    conn.execute(
        "DELETE FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'tags'",
        rusqlite::params![uuid],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn apply_item_tag(
    conn: &rusqlite::Connection,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let item_id = data["item_id"].as_str().unwrap_or_default();
    let tag_uuid = data["tag_uuid"].as_str().unwrap_or_default();

    // 处理删除标记
    if data["_deleted"].as_bool().unwrap_or(false) {
        if let Ok(tag_id) = conn.query_row(
            "SELECT id FROM tags WHERE uuid = ?1",
            rusqlite::params![tag_uuid],
            |row| row.get::<_, i64>(0),
        ) {
            conn.execute(
                "DELETE FROM item_tags WHERE item_id = ?1 AND tag_id = ?2",
                rusqlite::params![item_id, tag_id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
        let deleted_at = data["deleted_at"].as_str().unwrap_or("");
        let tombstone_id = format!("{}_{}", item_id, tag_uuid);
        conn.execute(
            "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'item_tags', ?2)",
            rusqlite::params![tombstone_id, deleted_at],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        return Ok(());
    }

    // 通过 uuid 查找本地 tag_id（自增 ID 跨设备不一致，uuid 才是稳定标识）
    let tag_id: i64 = match conn.query_row(
        "SELECT id FROM tags WHERE uuid = ?1",
        rusqlite::params![tag_uuid],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(_) => return Ok(()), // tag 尚未同步到本地，跳过（下次同步时会补上）
    };

    // 检查父记录 item 是否存在（item 可能已被远程删除）
    let item_exists: bool = conn
        .query_row(
            "SELECT 1 FROM items WHERE id = ?1",
            rusqlite::params![item_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !item_exists {
        return Ok(());
    }

    conn.execute(
        "INSERT OR REPLACE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
        rusqlite::params![item_id, tag_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    // 清理可能残留的 tombstone
    let tombstone_id = format!("{}_{}", item_id, tag_uuid);
    conn.execute(
        "DELETE FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'item_tags'",
        rusqlite::params![tombstone_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn apply_attachment(
    conn: &rusqlite::Connection,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let id = data["id"].as_str().unwrap_or_default();

    // 处理删除标记
    if data["_deleted"].as_bool().unwrap_or(false) {
        conn.execute(
            "DELETE FROM attachments WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        let deleted_at = data["deleted_at"].as_str().unwrap_or("");
        conn.execute(
            "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'attachments', ?2)",
            rusqlite::params![id, deleted_at],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        return Ok(());
    }

    let item_id = data["item_id"].as_str().unwrap_or_default();
    let filename = data["filename"].as_str().unwrap_or_default();
    let file_path = data["file_path"].as_str().unwrap_or_default();
    let mime_type = data["mime_type"].as_str().unwrap_or_default();
    let file_size = data["file_size"].as_i64().unwrap_or_default();
    let created_at = data["created_at"].as_str().unwrap_or_default();

    // 检查父记录 item 是否存在
    let item_exists: bool = conn
        .query_row(
            "SELECT 1 FROM items WHERE id = ?1",
            rusqlite::params![item_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !item_exists {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO attachments (id, item_id, filename, file_path, mime_type, file_size, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET item_id=excluded.item_id, filename=excluded.filename, file_path=excluded.file_path, mime_type=excluded.mime_type, file_size=excluded.file_size, created_at=excluded.created_at",
        rusqlite::params![id, item_id, filename, file_path, mime_type, file_size, created_at],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    // 清理可能残留的 tombstone
    conn.execute(
        "DELETE FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'attachments'",
        rusqlite::params![id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn apply_version(
    conn: &rusqlite::Connection,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let id = data["id"].as_str().unwrap_or_default();

    // 处理删除标记
    if data["_deleted"].as_bool().unwrap_or(false) {
        conn.execute("DELETE FROM versions WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;
        let deleted_at = data["deleted_at"].as_str().unwrap_or("");
        conn.execute(
            "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'versions', ?2)",
            rusqlite::params![id, deleted_at],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        return Ok(());
    }

    let item_id = data["item_id"].as_str().unwrap_or_default();
    let version_number = data["version_number"].as_i64().unwrap_or_default();
    let content = data["content"].as_str().unwrap_or_default();
    let change_summary = data["change_summary"].as_str().unwrap_or_default();
    let name = data["name"].as_str().unwrap_or_default();
    let description = data["description"].as_str().unwrap_or_default();
    let created_at = data["created_at"].as_str().unwrap_or_default();

    // 检查父记录 item 是否存在
    let item_exists: bool = conn
        .query_row(
            "SELECT 1 FROM items WHERE id = ?1",
            rusqlite::params![item_id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !item_exists {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET item_id=excluded.item_id, version_number=excluded.version_number, content=excluded.content, change_summary=excluded.change_summary, name=excluded.name, description=excluded.description, created_at=excluded.created_at",
        rusqlite::params![id, item_id, version_number, content, change_summary, name, description, created_at],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    // 清理可能残留的 tombstone
    conn.execute(
        "DELETE FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'versions'",
        rusqlite::params![id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

/// 加载基线映射（"table_name:record_id" → content_hash）
pub fn load_baseline_map(db: &DbState) -> Result<HashMap<String, String>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut stmt = conn
        .prepare("SELECT record_id, table_name, content_hash FROM sync_baseline")
        .map_err(|e| AppError::Database(e.to_string()))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut map = HashMap::new();
    for row in rows {
        let (record_id, table_name, hash) = row.map_err(|e| AppError::Database(e.to_string()))?;
        let key = format!("{}:{}", table_name, record_id);
        map.insert(key, hash);
    }
    Ok(map)
}

/// 保存基线映射（同步成功后调用）
pub fn save_baseline_map(
    db: &DbState,
    records: &[SyncRecordPayload],
    _snapshot_id: &str,
) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| AppError::Database(format!("开始事务失败: {}", e)))?;

    // 清空旧基线
    tx.execute("DELETE FROM sync_baseline", [])
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 写入新基线
    let now = chrono::Utc::now().to_rfc3339();
    let mut stmt = tx
        .prepare(
            "INSERT INTO sync_baseline (record_id, table_name, content_hash, synced_at) VALUES (?1, ?2, ?3, ?4)",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    for record in records {
        stmt.execute(rusqlite::params![
            record.record_id,
            record.table_name,
            record.content_hash,
            now
        ])
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    drop(stmt);

    // 清理 90 天前的旧 tombstone（保留足够长以覆盖长期离线设备）
    let cutoff = (chrono::Utc::now() - chrono::Duration::days(90)).to_rfc3339();
    tx.execute(
        "DELETE FROM sync_tombstones WHERE deleted_at < ?1",
        rusqlite::params![cutoff],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    tx.commit()
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

    Ok(())
}
