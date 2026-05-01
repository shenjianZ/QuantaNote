use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::utils::paths;

fn resolve_user_path(path: &str) -> Result<PathBuf, AppError> {
    let target = PathBuf::from(path);
    if target.as_os_str().is_empty() {
        return Err(AppError::Validation("路径无效".to_string()));
    }
    Ok(target)
}

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

/// 清洗路径组件，仅保留安全字符，防止路径穿越
fn sanitize_path_component(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

#[tauri::command]
pub fn export_data(db: State<'_, DbState>) -> Result<String, AppError> {
    export_data_from_db(&db)
}

fn export_data_from_db(db: &DbState) -> Result<String, AppError> {
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
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?
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
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?
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
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?
    };

    let attachments: Vec<serde_json::Value> = {
        let mut stmt = conn.prepare(
            "SELECT id, item_id, filename, file_path, mime_type, file_size, created_at FROM attachments"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| {
                let relative_path: String = row.get(3)?;
                let full_path = paths::quantanote_dir().join(&relative_path);
                let file_data = std::fs::read(&full_path).ok().map(|bytes| {
                    use base64::engine::general_purpose::STANDARD as BASE64;
                    use base64::Engine;
                    BASE64.encode(bytes)
                });
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "item_id": row.get::<_, String>(1)?,
                    "filename": row.get::<_, String>(2)?,
                    "file_path": relative_path,
                    "mime_type": row.get::<_, String>(4)?,
                    "file_size": row.get::<_, i64>(5)?,
                    "created_at": row.get::<_, String>(6)?,
                    "file_data": file_data,
                }))
            })
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?
    };

    let versions: Vec<serde_json::Value> = {
        let mut stmt = conn.prepare(
            "SELECT id, item_id, version_number, content, change_summary, name, description, created_at FROM versions"
        ).map_err(|e| AppError::Database(e.to_string()))?;
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
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?
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
pub fn import_data(db: State<'_, DbState>, json: String) -> Result<(), AppError> {
    import_data_into_db(&db, json)
}

fn import_data_into_db(db: &DbState, json: String) -> Result<(), AppError> {
    let data: ExportData =
        serde_json::from_str(&json).map_err(|e| AppError::Validation(e.to_string()))?;
    let mut conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    for item in data.items {
        tx.execute(
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
        tx.execute(
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
        tx.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![
                value_str(&item_tag, "item_id"),
                value_i64(&item_tag, "tag_id")
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    let data_dir = paths::quantanote_dir();

    for attachment in data.attachments {
        let id = value_str(&attachment, "id");
        let item_id = sanitize_path_component(&value_str(&attachment, "item_id"));
        let filename = value_str(&attachment, "filename");
        let mut file_path = value_str(&attachment, "file_path");

        // 验证导入的 file_path 不包含路径穿越
        if !file_path.is_empty() && (file_path.contains("..") || file_path.contains('\0')) {
            file_path = String::new();
        }

        if let Some(file_data) = attachment["file_data"].as_str() {
            use base64::engine::general_purpose::STANDARD as BASE64;
            use base64::Engine;

            let bytes = BASE64
                .decode(file_data)
                .map_err(|e| AppError::Validation(format!("附件数据无效: {}", e)))?;
            let relative_path =
                std::path::PathBuf::from("attachments")
                    .join(&item_id)
                    .join(format!(
                        "{}-{}",
                        &id.chars().take(8).collect::<String>(),
                        filename
                    ));
            let dest_path = data_dir.join(&relative_path);
            std::fs::create_dir_all(
                dest_path
                    .parent()
                    .ok_or_else(|| AppError::Validation("附件路径无效".to_string()))?,
            )
            .map_err(|e| AppError::Io(e.to_string()))?;
            std::fs::write(&dest_path, bytes).map_err(|e| AppError::Io(e.to_string()))?;
            file_path = relative_path.to_string_lossy().to_string();
        }

        tx.execute(
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
        tx.execute(
            "INSERT OR IGNORE INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                value_str(&version, "id"),
                value_str(&version, "item_id"),
                value_i64(&version, "version_number"),
                value_str(&version, "content"),
                value_str(&version, "change_summary"),
                value_str(&version, "name"),
                value_str(&version, "description"),
                value_str(&version, "created_at"),
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;
    }

    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn save_to_file(path: String, content: String) -> Result<(), AppError> {
    let validated = resolve_user_path(&path)?;
    std::fs::write(&validated, content).map_err(|e| AppError::Io(e.to_string()))
}

#[tauri::command]
pub fn read_from_file(path: String) -> Result<String, AppError> {
    let validated = resolve_user_path(&path)?;
    std::fs::read_to_string(&validated).map_err(|e| AppError::Io(e.to_string()))
}

// ── ZIP 导出/导入 ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ExportOptions {
    pub include_tags: bool,
    pub include_attachments: bool,
    pub include_versions: bool,
}

#[derive(Deserialize)]
pub struct ImportOptions {
    pub include_tags: bool,
    pub include_attachments: bool,
    pub include_versions: bool,
    pub overwrite: bool,
}

#[derive(Serialize, Clone)]
pub struct ExportSizeEstimate {
    pub items_json: u64,
    pub tags_json: u64,
    pub versions_json: u64,
    pub attachments: u64,
    pub total: u64,
}

fn query_items_json(conn: &rusqlite::Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at FROM items",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
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
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))
}

fn query_tags_json(conn: &rusqlite::Connection) -> Result<Vec<serde_json::Value>, AppError> {
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
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))
}

fn query_item_tags_json(conn: &rusqlite::Connection) -> Result<Vec<serde_json::Value>, AppError> {
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
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))
}

fn query_versions_json(conn: &rusqlite::Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, version_number, content, change_summary, name, description, created_at FROM versions",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
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
        .map_err(|e| AppError::Database(e.to_string()))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))
}

fn query_attachments_meta(conn: &rusqlite::Connection) -> Result<Vec<serde_json::Value>, AppError> {
    let mut stmt = conn
        .prepare("SELECT id, item_id, filename, file_path, mime_type, file_size, created_at FROM attachments")
        .map_err(|e| AppError::Database(e.to_string()))?;
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
        .map_err(|e| AppError::Database(e.to_string()))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))
}

/// 计算附件目录总大小
fn calc_attachments_size(data_dir: &std::path::Path) -> u64 {
    let att_dir = data_dir.join("attachments");
    if !att_dir.exists() {
        return 0;
    }
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(&att_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(files) = std::fs::read_dir(&path) {
                    for file in files.flatten() {
                        if let Ok(meta) = file.metadata() {
                            total += meta.len();
                        }
                    }
                }
            }
        }
    }
    total
}

#[tauri::command]
pub fn get_export_size_estimate(db: State<'_, DbState>) -> Result<ExportSizeEstimate, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items = query_items_json(&conn)?;
    let tags = query_tags_json(&conn)?;
    let item_tags = query_item_tags_json(&conn)?;

    // items 总是包含
    let items_json = serde_json::to_string(&serde_json::json!({"items": items}))
        .map(|s| s.len() as u64)
        .unwrap_or(0);

    // tags + item_tags 是可选的
    let tags_json =
        serde_json::to_string(&serde_json::json!({"tags": tags, "item_tags": item_tags}))
            .map(|s| s.len() as u64)
            .unwrap_or(0);

    let versions = query_versions_json(&conn)?;
    let versions_json = serde_json::to_string(&versions)
        .map(|s| s.len() as u64)
        .unwrap_or(0);

    let attachments = calc_attachments_size(&paths::quantanote_dir());

    Ok(ExportSizeEstimate {
        items_json,
        tags_json,
        versions_json,
        attachments,
        total: items_json + tags_json + versions_json + attachments,
    })
}

#[tauri::command]
pub fn export_data_zip(
    path: String,
    options: ExportOptions,
    db: State<'_, DbState>,
) -> Result<(), AppError> {
    let dest = resolve_user_path(&path)?;
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items = query_items_json(&conn)?;
    let data_json = if options.include_tags {
        let tags = query_tags_json(&conn)?;
        let item_tags = query_item_tags_json(&conn)?;
        serde_json::to_string_pretty(&serde_json::json!({
            "items": items,
            "tags": tags,
            "item_tags": item_tags,
        }))
    } else {
        serde_json::to_string_pretty(&serde_json::json!({
            "items": items,
        }))
    }
    .map_err(|e| AppError::Database(e.to_string()))?;

    let versions_json = if options.include_versions {
        let versions = query_versions_json(&conn)?;
        serde_json::to_string_pretty(&versions).ok()
    } else {
        None
    };

    // 收集附件元数据（无论是否导出附件都需要查询，用于记录）
    let _attachments_meta = query_attachments_meta(&conn)?;

    // 释放锁，后续文件 IO 不需要数据库锁
    drop(conn);

    let file = std::fs::File::create(&dest).map_err(|e| AppError::Io(e.to_string()))?;
    let mut zip = zip::ZipWriter::new(file);
    let zip_options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // data.json
    zip.start_file("data.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(data_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;

    // versions.json
    if let Some(ref vjson) = versions_json {
        zip.start_file("versions.json", zip_options)
            .map_err(|e| AppError::Io(e.to_string()))?;
        zip.write_all(vjson.as_bytes())
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    // attachments/
    if options.include_attachments {
        let data_dir = paths::quantanote_dir();
        let att_dir = data_dir.join("attachments");
        if att_dir.exists() {
            write_attachments_to_zip(&mut zip, &att_dir, &att_dir, zip_options)?;
        }
    }

    zip.finish().map_err(|e| AppError::Io(e.to_string()))?;

    Ok(())
}

pub fn write_attachments_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &std::path::Path,
    current: &std::path::Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), AppError> {
    if !current.exists() {
        return Ok(());
    }
    for entry in std::fs::read_dir(current).map_err(|e| AppError::Io(e.to_string()))? {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();
        let name = path
            .strip_prefix(base)
            .map_err(|e| AppError::Io(e.to_string()))?;
        let zip_path = format!("attachments/{}", name.to_string_lossy().replace('\\', "/"));

        if path.is_file() {
            zip.start_file(&zip_path, options)
                .map_err(|e| AppError::Io(e.to_string()))?;
            let mut f = std::fs::File::open(&path).map_err(|e| AppError::Io(e.to_string()))?;
            std::io::copy(&mut f, zip).map_err(|e| AppError::Io(e.to_string()))?;
        } else if path.is_dir() {
            write_attachments_to_zip(zip, base, &path, options)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn import_data_zip(
    path: String,
    options: ImportOptions,
    db: State<'_, DbState>,
) -> Result<(), AppError> {
    let src = resolve_user_path(&path)?;
    let file = std::fs::File::open(&src).map_err(|e| AppError::Io(e.to_string()))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| AppError::Io(format!("打开 ZIP 失败: {}", e)))?;

    // 读取 data.json
    let data_json = {
        let mut f = archive
            .by_name("data.json")
            .map_err(|_| AppError::Validation("ZIP 中缺少 data.json".to_string()))?;
        let mut buf = String::new();
        std::io::Read::read_to_string(&mut f, &mut buf).map_err(|e| AppError::Io(e.to_string()))?;
        buf
    };

    // 读取 versions.json（可选）
    let versions_json = if options.include_versions {
        let mut f = archive.by_name("versions.json").ok();
        f.as_mut().map(|f| {
            let mut buf = String::new();
            std::io::Read::read_to_string(f, &mut buf).ok();
            buf
        })
    } else {
        None
    };

    // 解析 data.json
    let data: serde_json::Value =
        serde_json::from_str(&data_json).map_err(|e| AppError::Validation(e.to_string()))?;

    let mut conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 导入 items
    if let Some(items) = data["items"].as_array() {
        for item in items {
            if options.overwrite {
                tx.execute(
                    "INSERT OR REPLACE INTO items (id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    rusqlite::params![
                        value_str(item, "id"),
                        item["title"].as_str().unwrap_or("未命名"),
                        item["item_type"].as_str().unwrap_or("note"),
                        value_str(item, "content"),
                        value_str(item, "summary"),
                        value_bool(item, "pinned"),
                        value_bool(item, "favorite"),
                        value_bool(item, "encrypted"),
                        value_str(item, "created_at"),
                        value_str(item, "updated_at"),
                    ],
                ).map_err(|e| AppError::Database(e.to_string()))?;
            } else {
                tx.execute(
                    "INSERT OR IGNORE INTO items (id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    rusqlite::params![
                        value_str(item, "id"),
                        item["title"].as_str().unwrap_or("未命名"),
                        item["item_type"].as_str().unwrap_or("note"),
                        value_str(item, "content"),
                        value_str(item, "summary"),
                        value_bool(item, "pinned"),
                        value_bool(item, "favorite"),
                        value_bool(item, "encrypted"),
                        value_str(item, "created_at"),
                        value_str(item, "updated_at"),
                    ],
                ).map_err(|e| AppError::Database(e.to_string()))?;
            }
        }
    }

    // 导入 tags + item_tags
    if options.include_tags {
        if let Some(tags) = data["tags"].as_array() {
            for tag in tags {
                if options.overwrite {
                    tx.execute(
                        "INSERT OR REPLACE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
                        rusqlite::params![
                            value_i64(tag, "id"),
                            value_str(tag, "name"),
                            tag["color"].as_str().unwrap_or("cyan")
                        ],
                    )
                    .map_err(|e| AppError::Database(e.to_string()))?;
                } else {
                    tx.execute(
                        "INSERT OR IGNORE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
                        rusqlite::params![
                            value_i64(tag, "id"),
                            value_str(tag, "name"),
                            tag["color"].as_str().unwrap_or("cyan")
                        ],
                    )
                    .map_err(|e| AppError::Database(e.to_string()))?;
                }
            }
        }
        if let Some(item_tags) = data["item_tags"].as_array() {
            for it in item_tags {
                tx.execute(
                    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                    rusqlite::params![value_str(it, "item_id"), value_i64(it, "tag_id")],
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
            }
        }
    }

    // 导入 versions
    if let Some(ref vjson) = versions_json {
        let versions: Vec<serde_json::Value> =
            serde_json::from_str(vjson).map_err(|e| AppError::Validation(e.to_string()))?;
        for version in &versions {
            if options.overwrite {
                tx.execute(
                    "INSERT OR REPLACE INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    rusqlite::params![
                        value_str(version, "id"),
                        value_str(version, "item_id"),
                        value_i64(version, "version_number"),
                        value_str(version, "content"),
                        value_str(version, "change_summary"),
                        value_str(version, "name"),
                        value_str(version, "description"),
                        value_str(version, "created_at"),
                    ],
                ).map_err(|e| AppError::Database(e.to_string()))?;
            } else {
                tx.execute(
                    "INSERT OR IGNORE INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    rusqlite::params![
                        value_str(version, "id"),
                        value_str(version, "item_id"),
                        value_i64(version, "version_number"),
                        value_str(version, "content"),
                        value_str(version, "change_summary"),
                        value_str(version, "name"),
                        value_str(version, "description"),
                        value_str(version, "created_at"),
                    ],
                ).map_err(|e| AppError::Database(e.to_string()))?;
            }
        }
    }

    // 导入附件文件
    if options.include_attachments {
        let data_dir = paths::quantanote_dir();
        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| AppError::Io(e.to_string()))?;
            let name = file.name().to_string();
            if !name.starts_with("attachments/") || name.ends_with('/') {
                continue;
            }
            let rel_path = &name; // "attachments/{itemId}/{filename}"
            let dest_path = data_dir.join(rel_path);

            if !options.overwrite && dest_path.exists() {
                continue;
            }

            if let Some(parent) = dest_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
            }
            let mut out =
                std::fs::File::create(&dest_path).map_err(|e| AppError::Io(e.to_string()))?;
            std::io::copy(&mut file, &mut out).map_err(|e| AppError::Io(e.to_string()))?;
        }
    }

    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

/// 创建完整备份 ZIP（供自动备份调用）
pub fn create_backup_zip(db: &DbState, dest: &std::path::Path) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items = query_items_json(&conn)?;
    let tags = query_tags_json(&conn)?;
    let item_tags = query_item_tags_json(&conn)?;
    let versions = query_versions_json(&conn)?;

    let data_json = serde_json::to_string_pretty(&serde_json::json!({
        "items": items,
        "tags": tags,
        "item_tags": item_tags,
    }))
    .map_err(|e| AppError::Database(e.to_string()))?;

    let versions_json =
        serde_json::to_string_pretty(&versions).map_err(|e| AppError::Database(e.to_string()))?;

    drop(conn);

    let file = std::fs::File::create(dest).map_err(|e| AppError::Io(e.to_string()))?;
    let mut zip = zip::ZipWriter::new(file);
    let zip_options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("data.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(data_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;

    zip.start_file("versions.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(versions_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;

    let data_dir = paths::quantanote_dir();
    let att_dir = data_dir.join("attachments");
    if att_dir.exists() {
        write_attachments_to_zip(&mut zip, &att_dir, &att_dir, zip_options)?;
    }

    zip.finish().map_err(|e| AppError::Io(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_and_read_file_round_trip() {
        let dir = crate::test_support::unique_temp_dir("data-io");
        let _guard = crate::test_support::lock_test_data_dir(&dir);
        let file = dir.join("backup.json");

        save_to_file(
            file.to_string_lossy().to_string(),
            "{\"items\":[]}".to_string(),
        )
        .expect("save file");
        let content = read_from_file(file.to_string_lossy().to_string()).expect("read file");

        assert_eq!(content, "{\"items\":[]}");
    }

    #[test]
    fn read_missing_file_returns_io_error() {
        let dir = crate::test_support::unique_temp_dir("data-io-missing");
        let _guard = crate::test_support::lock_test_data_dir(&dir);
        let file = dir.join("missing.json");

        let error = read_from_file(file.to_string_lossy().to_string())
            .expect_err("missing file should fail");

        assert!(matches!(error, AppError::Io(_)));
    }

    #[test]
    fn save_and_read_file_outside_data_dir() {
        let data_dir = crate::test_support::unique_temp_dir("data-io-app-data");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let outside_dir = crate::test_support::unique_temp_dir("data-io-outside");
        let file = outside_dir.join("external.txt");

        save_to_file(file.to_string_lossy().to_string(), "external".to_string())
            .expect("save outside data dir");
        let content =
            read_from_file(file.to_string_lossy().to_string()).expect("read outside data dir");

        assert_eq!(content, "external");
    }

    #[test]
    fn export_and_import_data_round_trip_keeps_items_tags_and_versions() {
        let data_dir = crate::test_support::unique_temp_dir("data-io-round-trip");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let source = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &source,
            "导出导入".to_string(),
            "note".to_string(),
            Some("往返内容".to_string()),
        )
        .expect("create source item");
        crate::services::tag_service::set_item_tags(&source, &item.id, vec!["备份".to_string()])
            .expect("set source tags");
        crate::services::version_service::create_version(
            &source,
            &item.id,
            "第二版",
            "手动保存",
            Some("v2"),
            Some("说明"),
        )
        .expect("create version");

        let json = export_data_from_db(&source).expect("export data");
        let target = crate::test_support::test_db();
        import_data_into_db(&target, json).expect("import data");

        let imported =
            crate::services::item_service::get_item(&target, &item.id).expect("imported item");
        assert_eq!(imported.title, "导出导入");
        assert_eq!(imported.content, "往返内容");

        let tags = crate::services::tag_service::get_tags_for_item(&target, &item.id)
            .expect("imported tags");
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "备份");

        let versions = crate::services::version_service::get_versions(&target, &item.id)
            .expect("imported versions");
        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].name, "v2");

        let _ = std::fs::remove_dir_all(data_dir);
    }
}
