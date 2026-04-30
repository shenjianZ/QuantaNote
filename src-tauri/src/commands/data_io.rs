use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::db::DbState;
use crate::error::AppError;

#[derive(Serialize, Deserialize)]
struct ExportData {
    #[serde(default)]
    items: Vec<serde_json::Value>,
    #[serde(default)]
    tags: Vec<serde_json::Value>,
    #[serde(default)]
    item_tags: Vec<serde_json::Value>,
    #[serde(default)]
    attachments: Vec<serde_json::Value>,
    #[serde(default)]
    versions: Vec<serde_json::Value>,
}

fn value_str(value: &serde_json::Value, key: &str) -> String {
    value[key].as_str().unwrap_or_default().to_string()
}

fn value_i64(value: &serde_json::Value, key: &str) -> i64 {
    value[key].as_i64().unwrap_or_default()
}

fn value_bool(value: &serde_json::Value, key: &str) -> i32 {
    if value[key].as_bool().unwrap_or(false) {
        1
    } else {
        0
    }
}

#[tauri::command]
pub fn export_data(db: State<'_, DbState>) -> Result<String, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<serde_json::Value> = {
        let mut stmt = conn.prepare(
            "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at FROM items"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "item_type": row.get::<_, String>(2)?,
                    "content": row.get::<_, String>(3)?,
                    "summary": row.get::<_, String>(4)?,
                    "pinned": row.get::<_, i32>(5)? != 0,
                    "favorite": row.get::<_, i32>(6)? != 0,
                    "encrypted": row.get::<_, i32>(7)? != 0,
                    "created_at": row.get::<_, String>(8)?,
                    "updated_at": row.get::<_, String>(9)?,
                }))
            })
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let tags: Vec<serde_json::Value> = {
        let mut stmt = conn
            .prepare("SELECT id, name, color FROM tags")
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "color": row.get::<_, String>(2)?,
                }))
            })
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let item_tags: Vec<serde_json::Value> = {
        let mut stmt = conn
            .prepare("SELECT item_id, tag_id FROM item_tags")
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "item_id": row.get::<_, String>(0)?,
                    "tag_id": row.get::<_, i64>(1)?,
                }))
            })
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let attachments: Vec<serde_json::Value> = {
        let mut stmt = conn.prepare(
            "SELECT id, item_id, filename, file_path, mime_type, file_size, created_at FROM attachments"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                let file_path: String = row.get(3)?;
                let file_data = std::fs::read(&file_path).ok().map(|bytes| {
                    use base64::engine::general_purpose::STANDARD as BASE64;
                    use base64::Engine;
                    BASE64.encode(bytes)
                });
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "item_id": row.get::<_, String>(1)?,
                    "filename": row.get::<_, String>(2)?,
                    "file_path": file_path,
                    "mime_type": row.get::<_, String>(4)?,
                    "file_size": row.get::<_, i64>(5)?,
                    "created_at": row.get::<_, String>(6)?,
                    "file_data": file_data,
                }))
            })
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let versions: Vec<serde_json::Value> = {
        let mut stmt = conn.prepare(
            "SELECT id, item_id, version_number, content, change_summary, created_at FROM versions"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "item_id": row.get::<_, String>(1)?,
                    "version_number": row.get::<_, i64>(2)?,
                    "content": row.get::<_, String>(3)?,
                    "change_summary": row.get::<_, String>(4)?,
                    "created_at": row.get::<_, String>(5)?,
                }))
            })
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let data = ExportData {
        items,
        tags,
        item_tags,
        attachments,
        versions,
    };
    serde_json::to_string_pretty(&data).map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn import_data(app: AppHandle, db: State<'_, DbState>, json: String) -> Result<(), AppError> {
    let data: ExportData =
        serde_json::from_str(&json).map_err(|e| AppError::Validation(e.to_string()))?;
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    for item in data.items {
        conn.execute(
            "INSERT OR IGNORE INTO items (id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                value_str(&item, "id"),
                item["title"].as_str().unwrap_or("未命名"),
                item["item_type"].as_str().unwrap_or("note"),
                value_str(&item, "content"),
                value_str(&item, "summary"),
                value_bool(&item, "pinned"),
                value_bool(&item, "favorite"),
                value_bool(&item, "encrypted"),
                value_str(&item, "created_at"),
                value_str(&item, "updated_at"),
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;
    }

    for tag in data.tags {
        conn.execute(
            "INSERT OR REPLACE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
            rusqlite::params![
                value_i64(&tag, "id"),
                value_str(&tag, "name"),
                tag["color"].as_str().unwrap_or("cyan")
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    for item_tag in data.item_tags {
        conn.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![
                value_str(&item_tag, "item_id"),
                value_i64(&item_tag, "tag_id")
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;

    for attachment in data.attachments {
        let id = value_str(&attachment, "id");
        let item_id = value_str(&attachment, "item_id");
        let filename = value_str(&attachment, "filename");
        let mut file_path = value_str(&attachment, "file_path");

        if let Some(file_data) = attachment["file_data"].as_str() {
            use base64::engine::general_purpose::STANDARD as BASE64;
            use base64::Engine;

            let bytes = BASE64
                .decode(file_data)
                .map_err(|e| AppError::Validation(format!("附件数据无效: {}", e)))?;
            let attach_dir = app_data_dir.join("attachments").join(&item_id);
            std::fs::create_dir_all(&attach_dir).map_err(|e| AppError::Io(e.to_string()))?;
            let dest_path = attach_dir.join(format!(
                "{}-{}",
                &id.chars().take(8).collect::<String>(),
                filename
            ));
            std::fs::write(&dest_path, bytes).map_err(|e| AppError::Io(e.to_string()))?;
            file_path = dest_path.to_string_lossy().to_string();
        }

        conn.execute(
            "INSERT OR REPLACE INTO attachments (id, item_id, filename, file_path, mime_type, file_size, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                id,
                item_id,
                filename,
                file_path,
                value_str(&attachment, "mime_type"),
                value_i64(&attachment, "file_size"),
                value_str(&attachment, "created_at"),
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;
    }

    for version in data.versions {
        conn.execute(
            "INSERT OR IGNORE INTO versions (id, item_id, version_number, content, change_summary, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                value_str(&version, "id"),
                value_str(&version, "item_id"),
                value_i64(&version, "version_number"),
                value_str(&version, "content"),
                value_str(&version, "change_summary"),
                value_str(&version, "created_at"),
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;
    }

    Ok(())
}

#[tauri::command]
pub fn save_to_file(path: String, content: String) -> Result<(), AppError> {
    std::fs::write(&path, content).map_err(|e| AppError::Io(e.to_string()))
}

#[tauri::command]
pub fn read_from_file(path: String) -> Result<String, AppError> {
    std::fs::read_to_string(&path).map_err(|e| AppError::Io(e.to_string()))
}
