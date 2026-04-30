use tauri::{AppHandle, Manager, State};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::services::attachment_service;

#[tauri::command]
pub fn add_attachment(
    app: AppHandle,
    db: State<'_, DbState>,
    item_id: String,
    path: String,
) -> Result<AttachmentDto, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    attachment_service::add_attachment(&db, item_id, path, &data_dir.to_string_lossy())
}

#[tauri::command]
pub fn get_attachments(
    db: State<'_, DbState>,
    item_id: String,
) -> Result<Vec<AttachmentDto>, AppError> {
    attachment_service::get_attachments(&db, &item_id)
}

#[tauri::command]
pub fn delete_attachment(db: State<'_, DbState>, id: String) -> Result<(), AppError> {
    attachment_service::delete_attachment(&db, &id)
}
