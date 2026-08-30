use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::repositories::{attachment_repository, item_repository};

const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB

pub fn add_attachment(
    db: &DbState,
    item_id: String,
    path: String,
) -> Result<AttachmentDto, AppError> {
    item_repository::get_item(db, &item_id)?;

    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::Validation("文件不存在".to_string()));
    }
    let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    if file_size > MAX_FILE_SIZE {
        return Err(AppError::Validation(format!(
            "文件过大: {:.1}MB (上限 50MB)",
            file_size as f64 / (1024.0 * 1024.0)
        )));
    }

    attachment_repository::add(db, item_id, path)
}

pub fn add_attachment_data(
    db: &DbState,
    item_id: String,
    filename: String,
    mime_type: String,
    bytes: Vec<u8>,
) -> Result<AttachmentDto, AppError> {
    item_repository::get_item(db, &item_id)?;
    if bytes.len() as u64 > MAX_FILE_SIZE {
        return Err(AppError::Validation(format!(
            "文件过大: {:.1}MB (上限 50MB)",
            bytes.len() as f64 / (1024.0 * 1024.0)
        )));
    }
    if !mime_type.to_ascii_lowercase().starts_with("image/") {
        return Err(AppError::Validation("粘贴内容不是图片".to_string()));
    }
    attachment_repository::add_bytes(db, item_id, filename, mime_type, bytes)
}

pub fn get_attachments(db: &DbState, item_id: &str) -> Result<Vec<AttachmentDto>, AppError> {
    item_repository::get_item(db, item_id)?;
    attachment_repository::get_by_item(db, item_id)
}

pub fn get_item_ids_with_attachments(db: &DbState) -> Result<Vec<String>, AppError> {
    attachment_repository::get_item_ids_with_attachments(db)
}

pub fn delete_attachment(db: &DbState, id: &str) -> Result<(), AppError> {
    attachment_repository::delete(db, id)
}

pub fn export_attachment(source_path: String, destination_path: String) -> Result<(), AppError> {
    attachment_repository::export_file(&source_path, &destination_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_and_delete_attachment_copies_and_removes_file() {
        let data_dir = crate::test_support::unique_temp_dir("attachment-data");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let source_dir = crate::test_support::unique_temp_dir("attachment-source");
        let source = source_dir.join("note.txt");
        std::fs::write(&source, "attachment body").expect("write source");
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "附件测试".to_string(),
            "note".to_string(),
            None,
        )
        .expect("create item");

        let attachment = add_attachment(&db, item.id.clone(), source.to_string_lossy().to_string())
            .expect("add attachment");

        assert_eq!(attachment.filename, "note.txt");
        assert_eq!(attachment.mime_type, "text/plain");
        assert!(std::path::Path::new(&attachment.file_path).exists());

        let listed = get_attachments(&db, &item.id).expect("get attachments");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, attachment.id);

        delete_attachment(&db, &attachment.id).expect("delete attachment");
        assert!(!std::path::Path::new(&attachment.file_path).exists());

        let _ = std::fs::remove_dir_all(data_dir);
        let _ = std::fs::remove_dir_all(source_dir);
    }

    #[test]
    fn add_attachment_rejects_missing_source_file() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "缺失附件".to_string(),
            "note".to_string(),
            None,
        )
        .expect("create item");

        let error = add_attachment(&db, item.id, "Z:\\missing\\file.txt".to_string())
            .expect_err("missing file should fail");

        assert!(matches!(error, AppError::Validation(_)));
        assert!(error.to_string().contains("文件不存在"));
    }

    #[test]
    fn add_attachment_rejects_unknown_item_before_touching_file() {
        let source_dir = crate::test_support::unique_temp_dir("attachment-source");
        let source = source_dir.join("note.txt");
        std::fs::write(&source, "attachment body").expect("write source");
        let db = crate::test_support::test_db();

        let error = add_attachment(
            &db,
            "item-missing".to_string(),
            source.to_string_lossy().to_string(),
        )
        .expect_err("unknown item should fail");

        assert!(matches!(
            error,
            AppError::Database(_) | AppError::NotFound(_)
        ));
        let _ = std::fs::remove_dir_all(source_dir);
    }

    #[test]
    fn add_attachment_data_persists_pasted_image() {
        let data_dir = crate::test_support::unique_temp_dir("attachment-image-data");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "粘贴图片".to_string(),
            "note".to_string(),
            None,
        )
        .expect("create item");

        let bytes = vec![137, 80, 78, 71, 13, 10];
        let attachment = add_attachment_data(
            &db,
            item.id.clone(),
            "截图.png".to_string(),
            "image/png".to_string(),
            bytes.clone(),
        )
        .expect("add pasted image");

        assert_eq!(attachment.filename, "截图.png");
        assert_eq!(attachment.mime_type, "image/png");
        assert_eq!(
            std::fs::read(&attachment.file_path).expect("read image"),
            bytes
        );
        assert_eq!(get_attachments(&db, &item.id).expect("list image").len(), 1);

        delete_attachment(&db, &attachment.id).expect("delete image");
        let _ = std::fs::remove_dir_all(data_dir);
    }
}
