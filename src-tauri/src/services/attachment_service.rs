use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::repositories::attachment_repository;

pub fn add_attachment(db: &DbState, item_id: String, path: String, data_dir: &str) -> Result<AttachmentDto, AppError> {
    attachment_repository::add(db, item_id, path, data_dir)
}

pub fn get_attachments(db: &DbState, item_id: &str) -> Result<Vec<AttachmentDto>, AppError> {
    attachment_repository::get_by_item(db, item_id)
}

pub fn delete_attachment(db: &DbState, id: &str) -> Result<(), AppError> {
    attachment_repository::delete(db, id)
}
