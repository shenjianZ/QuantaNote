use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::repositories::{attachment_repository, item_repository};

const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB

pub fn add_attachment(db: &DbState, item_id: String, path: String, data_dir: &str) -> Result<AttachmentDto, AppError> {
    item_repository::get_item(db, &item_id)?;

    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::Validation("文件不存在".to_string()));
    }
    let file_size = std::fs::metadata(&path)
        .map(|m| m.len())
        .unwrap_or(0);
    if file_size > MAX_FILE_SIZE {
        return Err(AppError::Validation(format!("文件过大: {:.1}MB (上限 50MB)", file_size as f64 / (1024.0 * 1024.0))));
    }

    attachment_repository::add(db, item_id, path, data_dir)
}

pub fn get_attachments(db: &DbState, item_id: &str) -> Result<Vec<AttachmentDto>, AppError> {
    item_repository::get_item(db, item_id)?;
    attachment_repository::get_by_item(db, item_id)
}

pub fn delete_attachment(db: &DbState, id: &str) -> Result<(), AppError> {
    attachment_repository::delete(db, id)
}
