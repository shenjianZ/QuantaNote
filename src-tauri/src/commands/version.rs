use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::version::VersionDto;
use crate::services::version_service;

#[tauri::command]
pub fn get_versions(
    db: State<'_, DbState>,
    item_id: String,
) -> Result<Vec<VersionDto>, AppError> {
    version_service::get_versions(&db, &item_id)
}

#[tauri::command]
pub fn create_version(
    db: State<'_, DbState>,
    item_id: String,
    content: String,
    change_summary: Option<String>,
) -> Result<VersionDto, AppError> {
    version_service::create_version(
        &db,
        &item_id,
        &content,
        &change_summary.unwrap_or_default(),
    )
}
