use rusqlite::{params, Connection, Transaction};

use crate::error::AppError;
use crate::models::item::{SUMMARY_MODE_AUTO, SUMMARY_MODE_MANUAL};

fn db_err(e: rusqlite::Error) -> AppError {
    AppError::Database(e.to_string())
}

pub fn query_items_json(conn: &Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, item_type, content, summary, summary_mode, pinned, favorite, encrypted, created_at, updated_at, deleted_at FROM items",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "item_type": row.get::<_, String>(2)?,
                "content": row.get::<_, String>(3)?,
                "summary": row.get::<_, String>(4)?,
                "summary_mode": row.get::<_, String>(5)?,
                "pinned": row.get::<_, i32>(6)? != 0,
                "favorite": row.get::<_, i32>(7)? != 0,
                "encrypted": row.get::<_, i32>(8)? != 0,
                "created_at": row.get::<_, String>(9)?,
                "updated_at": row.get::<_, String>(10)?,
                "deleted_at": row.get::<_, Option<String>>(11)?,
            }))
        })
        .map_err(db_err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(db_err)
}

pub fn query_tags_json(conn: &Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare("SELECT uuid, name, color, updated_at FROM tags")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "uuid": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "color": row.get::<_, String>(2)?,
                "updated_at": row.get::<_, String>(3)?,
            }))
        })
        .map_err(db_err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(db_err)
}

pub fn query_item_tags_json(conn: &Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare("SELECT it.item_id, t.uuid, it.updated_at FROM item_tags it JOIN tags t ON t.id = it.tag_id")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "item_id": row.get::<_, String>(0)?,
                "tag_uuid": row.get::<_, String>(1)?,
                "updated_at": row.get::<_, String>(2)?,
            }))
        })
        .map_err(db_err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(db_err)
}

pub fn query_versions_json(conn: &Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, version_number, content, change_summary, name, description, created_at FROM versions",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "item_id": row.get::<_, String>(1)?,
                "version_number": row.get::<_, i64>(2)?,
                "content": row.get::<_, String>(3)?,
                "change_summary": row.get::<_, String>(4)?,
                "name": row.get::<_, String>(5)?,
                "description": row.get::<_, String>(6)?,
                "created_at": row.get::<_, String>(7)?,
            }))
        })
        .map_err(db_err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(db_err)
}

pub fn query_attachments_meta(conn: &Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare("SELECT id, item_id, filename, file_path, mime_type, file_size, created_at FROM attachments")
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "item_id": row.get::<_, String>(1)?,
                "filename": row.get::<_, String>(2)?,
                "file_path": row.get::<_, String>(3)?,
                "mime_type": row.get::<_, String>(4)?,
                "file_size": row.get::<_, i64>(5)?,
                "created_at": row.get::<_, String>(6)?,
            }))
        })
        .map_err(db_err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(db_err)
}

pub fn import_items(
    tx: &Transaction<'_>,
    items: &[serde_json::Value],
    overwrite: bool,
) -> Result<(), AppError> {
    let sql = if overwrite {
        "INSERT OR REPLACE INTO items (id, title, item_type, content, summary, summary_mode, pinned, favorite, encrypted, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    } else {
        "INSERT OR IGNORE INTO items (id, title, item_type, content, summary, summary_mode, pinned, favorite, encrypted, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"
    };
    for item in items {
        tx.execute(
            sql,
            params![
                val_str(item, "id"),
                item["title"].as_str().unwrap_or("未命名"),
                item["item_type"].as_str().unwrap_or("note"),
                val_str(item, "content"),
                val_str(item, "summary"),
                summary_mode(item),
                val_bool(item, "pinned"),
                val_bool(item, "favorite"),
                val_bool(item, "encrypted"),
                val_str(item, "created_at"),
                val_str(item, "updated_at"),
                item["deleted_at"].as_str(),
            ],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

pub fn import_tags(
    tx: &Transaction<'_>,
    tags: &[serde_json::Value],
    overwrite: bool,
) -> Result<(), AppError> {
    let sql = if overwrite {
        "INSERT OR REPLACE INTO tags (uuid, name, color, updated_at) VALUES (?1, ?2, ?3, ?4)"
    } else {
        "INSERT OR IGNORE INTO tags (uuid, name, color, updated_at) VALUES (?1, ?2, ?3, ?4)"
    };
    for tag in tags {
        let updated_at = tag["updated_at"]
            .as_str()
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        tx.execute(
            sql,
            params![
                val_str(tag, "uuid"),
                val_str(tag, "name"),
                tag["color"].as_str().unwrap_or("cyan"),
                updated_at,
            ],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

pub fn import_item_tags(
    tx: &Transaction<'_>,
    item_tags: &[serde_json::Value],
) -> Result<(), AppError> {
    for it in item_tags {
        let tag_uuid = val_str(it, "tag_uuid");
        let updated_at = it["updated_at"]
            .as_str()
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        let tag_id: i64 = match tx.query_row(
            "SELECT id FROM tags WHERE uuid = ?1",
            params![tag_uuid],
            |row| row.get(0),
        ) {
            Ok(id) => id,
            Err(_) => continue,
        };
        tx.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag_id, updated_at) VALUES (?1, ?2, ?3)",
            params![val_str(it, "item_id"), tag_id, updated_at],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

pub fn import_versions(
    tx: &Transaction<'_>,
    versions: &[serde_json::Value],
    overwrite: bool,
) -> Result<(), AppError> {
    let sql = if overwrite {
        "INSERT OR REPLACE INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    } else {
        "INSERT OR IGNORE INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    };
    for version in versions {
        tx.execute(
            sql,
            params![
                val_str(version, "id"),
                val_str(version, "item_id"),
                val_i64(version, "version_number"),
                val_str(version, "content"),
                val_str(version, "change_summary"),
                val_str(version, "name"),
                val_str(version, "description"),
                val_str(version, "created_at"),
            ],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

pub fn import_attachment_record(
    tx: &Transaction<'_>,
    attachment: &serde_json::Value,
) -> Result<(), AppError> {
    tx.execute(
        "INSERT OR REPLACE INTO attachments (id, item_id, filename, file_path, mime_type, file_size, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            val_str(attachment, "id"),
            val_str(attachment, "item_id"),
            val_str(attachment, "filename"),
            val_str(attachment, "file_path"),
            val_str(attachment, "mime_type"),
            val_i64(attachment, "file_size"),
            val_str(attachment, "created_at"),
        ],
    )
    .map_err(db_err)?;
    Ok(())
}

fn val_str(value: &serde_json::Value, key: &str) -> String {
    value[key].as_str().unwrap_or_default().to_string()
}

fn summary_mode(value: &serde_json::Value) -> &'static str {
    match value["summary_mode"].as_str() {
        Some(SUMMARY_MODE_MANUAL) => SUMMARY_MODE_MANUAL,
        _ => SUMMARY_MODE_AUTO,
    }
}

fn val_i64(value: &serde_json::Value, key: &str) -> i64 {
    value[key].as_i64().unwrap_or_default()
}

fn val_bool(value: &serde_json::Value, key: &str) -> i32 {
    if value[key].as_bool().unwrap_or(false) {
        1
    } else {
        0
    }
}
