use serde::Serialize;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::{ItemDto, ItemPageDto, TagDto, TrashItemDto, UpdateItemPayload};
use crate::services::{item_service, tag_service};

#[derive(Serialize)]
pub struct LibraryData {
    pub items: Vec<ItemDto>,
    pub tags: Vec<TagDto>,
    pub mappings: Vec<(String, String)>,
}

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
pub fn get_items_page(
    db: State<'_, DbState>,
    item_type: Option<String>,
    tab: Option<String>,
    tag: Option<String>,
    sort: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<ItemPageDto, AppError> {
    item_service::get_items_page(
        &db,
        item_type.as_deref(),
        tab.as_deref(),
        tag.as_deref(),
        sort.as_deref(),
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
pub fn get_trash_items(db: State<'_, DbState>) -> Result<Vec<TrashItemDto>, AppError> {
    item_service::get_trash_items(&db)
}

#[tauri::command]
pub fn restore_item(db: State<'_, DbState>, id: String) -> Result<ItemDto, AppError> {
    item_service::restore_item(&db, &id)
}

#[tauri::command]
pub fn permanently_delete_item(db: State<'_, DbState>, id: String) -> Result<(), AppError> {
    item_service::permanently_delete_item(&db, &id)
}

#[tauri::command]
pub fn cleanup_trash(
    db: State<'_, DbState>,
    older_than_days: Option<i64>,
) -> Result<usize, AppError> {
    item_service::cleanup_trash(&db, older_than_days.unwrap_or(30))
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
    item_service::get_db_size(&db)
}

#[tauri::command]
pub fn optimize_db(db: State<'_, DbState>) -> Result<(), AppError> {
    item_service::optimize_db(&db)
}

#[tauri::command]
pub fn get_db_path() -> Result<String, AppError> {
    item_service::get_db_path()
}

#[tauri::command]
pub fn get_library_data(db: State<'_, DbState>) -> Result<LibraryData, AppError> {
    let items = item_service::get_items(&db, None, 200, 0)?;
    let tags = tag_service::get_all_tags(&db)?;
    let mappings = tag_service::get_all_item_tag_mappings(&db)?;
    Ok(LibraryData {
        items,
        tags,
        mappings,
    })
}
