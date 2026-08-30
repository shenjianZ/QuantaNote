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
pub fn add_attachment_data(
    db: State<'_, DbState>,
    item_id: String,
    filename: String,
    mime_type: String,
    data: String,
) -> Result<AttachmentDto, AppError> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|error| AppError::Validation(format!("图片数据无效: {}", error)))?;
    attachment_service::add_attachment_data(&db, item_id, filename, mime_type, bytes)
}

#[tauri::command]
pub fn get_attachments(
    db: State<'_, DbState>,
    item_id: String,
) -> Result<Vec<AttachmentDto>, AppError> {
    attachment_service::get_attachments(&db, &item_id)
}

#[tauri::command]
pub fn get_attachment_item_ids(db: State<'_, DbState>) -> Result<Vec<String>, AppError> {
    attachment_service::get_item_ids_with_attachments(&db)
}

#[tauri::command]
pub fn delete_attachment(db: State<'_, DbState>, id: String) -> Result<(), AppError> {
    attachment_service::delete_attachment(&db, &id)
}

#[tauri::command]
pub fn export_attachment(source_path: String, destination_path: String) -> Result<(), AppError> {
    attachment_service::export_attachment(source_path, destination_path)
}
