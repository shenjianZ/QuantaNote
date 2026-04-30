use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::ItemDto;
use crate::models::version::VersionDto;
use crate::services::version_service;

#[tauri::command]
pub fn get_versions(db: State<'_, DbState>, item_id: String) -> Result<Vec<VersionDto>, AppError> {
    version_service::get_versions(&db, &item_id)
}

#[tauri::command]
pub fn create_version(
    db: State<'_, DbState>,
    item_id: String,
    content: String,
    change_summary: Option<String>,
    name: Option<String>,
    description: Option<String>,
) -> Result<VersionDto, AppError> {
    version_service::create_version(
        &db,
        &item_id,
        &content,
        &change_summary.unwrap_or_default(),
        name.as_deref(),
        description.as_deref(),
    )
}

#[tauri::command]
pub fn update_version(
    db: State<'_, DbState>,
    id: String,
    name: String,
    description: String,
) -> Result<VersionDto, AppError> {
    version_service::update_version(&db, &id, &name, &description)
}

#[tauri::command]
pub fn restore_version(db: State<'_, DbState>, version_id: String) -> Result<ItemDto, AppError> {
    // Get version to find item_id before restoring
    let version = crate::repositories::version_repository::get_version(&db, &version_id)?;
    let item_id = version.item_id.clone();
    version_service::restore_version(&db, &version_id)?;
    crate::repositories::item_repository::get_item(&db, &item_id)
}
