use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::services::attachment_service;

#[tauri::command]
pub fn add_attachment(
    db: State<'_, DbState>,
    item_id: String,
    path: String,
) -> Result<AttachmentDto, AppError> {
    attachment_service::add_attachment(&db, item_id, path)
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
