use crate::models::attachment::AttachmentDto;
use crate::services::attachment_service;

#[tauri::command]
pub fn add_attachment(item_id: String, path: String) -> AttachmentDto {
    attachment_service::add_attachment(item_id, path)
}
