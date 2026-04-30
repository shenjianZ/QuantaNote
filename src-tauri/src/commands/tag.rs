use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::TagDto;
use crate::services::tag_service;

#[tauri::command]
pub fn get_all_tags(db: State<'_, DbState>) -> Result<Vec<TagDto>, AppError> {
    tag_service::get_all_tags(&db)
}

#[tauri::command]
pub fn create_tag(db: State<'_, DbState>, name: String, color: String) -> Result<TagDto, AppError> {
    tag_service::create_tag(&db, &name, &color)
}

#[tauri::command]
pub fn delete_tag(db: State<'_, DbState>, name: String) -> Result<(), AppError> {
    tag_service::delete_tag(&db, &name)
}

#[tauri::command]
pub fn get_item_tags(db: State<'_, DbState>, item_id: String) -> Result<Vec<TagDto>, AppError> {
    tag_service::get_tags_for_item(&db, &item_id)
}

#[tauri::command]
pub fn get_all_item_tag_mappings(
    db: State<'_, DbState>,
) -> Result<Vec<(String, String)>, AppError> {
    tag_service::get_all_item_tag_mappings(&db)
}

#[tauri::command]
pub fn set_item_tags(
    db: State<'_, DbState>,
    item_id: String,
    tag_names: Vec<String>,
) -> Result<(), AppError> {
    tag_service::set_item_tags(&db, &item_id, tag_names)
}
