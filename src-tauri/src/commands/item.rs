use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::{ItemDto, UpdateItemPayload};
use crate::services::item_service;
use crate::utils::paths;

#[tauri::command]
pub fn create_item(
    db: State<'_, DbState>,
    title: String,
    item_type: String,
    content: Option<String>,
) -> Result<ItemDto, AppError> {
    item_service::create_item(&db, title, item_type, content)
}

#[tauri::command]
pub fn get_items(
    db: State<'_, DbState>,
    item_type: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<ItemDto>, AppError> {
    item_service::get_items(
        &db,
        item_type.as_deref(),
        limit.unwrap_or(50),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
pub fn get_item(db: State<'_, DbState>, id: String) -> Result<ItemDto, AppError> {
    item_service::get_item(&db, &id)
}

#[tauri::command]
pub fn update_item(
    db: State<'_, DbState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    summary: Option<String>,
    pinned: Option<bool>,
    favorite: Option<bool>,
    encrypted: Option<bool>,
) -> Result<ItemDto, AppError> {
    item_service::update_item(
        &db,
        UpdateItemPayload {
            id,
            title,
            content,
            summary,
            pinned,
            favorite,
            encrypted,
        },
    )
}

#[tauri::command]
pub fn delete_item(db: State<'_, DbState>, id: String) -> Result<(), AppError> {
    item_service::delete_item(&db, &id)
}

#[tauri::command]
pub fn get_pinned_items(db: State<'_, DbState>) -> Result<Vec<ItemDto>, AppError> {
    item_service::get_pinned(&db)
}

#[tauri::command]
pub fn get_recent_items(
    db: State<'_, DbState>,
    limit: Option<i64>,
) -> Result<Vec<ItemDto>, AppError> {
    item_service::get_recent(&db, limit.unwrap_or(20))
}

#[tauri::command]
pub fn get_db_size(db: State<'_, DbState>) -> Result<String, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let page_count: i64 = conn
        .query_row("PRAGMA page_count", [], |r| r.get(0))
        .unwrap_or(0);
    let page_size: i64 = conn
        .query_row("PRAGMA page_size", [], |r| r.get(0))
        .unwrap_or(4096);
    let bytes = page_count * page_size;
    if bytes < 1024 {
        Ok(format!("{} B", bytes))
    } else if bytes < 1024 * 1024 {
        Ok(format!("{:.1} KB", bytes as f64 / 1024.0))
    } else {
        Ok(format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0)))
    }
}

#[tauri::command]
pub fn optimize_db(db: State<'_, DbState>) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute_batch(
        "PRAGMA incremental_vacuum;
         INSERT INTO items_fts(items_fts) VALUES('rebuild');
         INSERT INTO items_fts_trigram(items_fts_trigram) VALUES('rebuild');",
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn get_db_path() -> Result<String, AppError> {
    Ok(paths::quantanote_dir()
        .join("quanta_note.sqlite")
        .to_string_lossy()
        .to_string())
}
