use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::utils::ids;

pub fn add(db: &DbState, item_id: String, source_path: String, data_dir: &str) -> Result<AttachmentDto, AppError> {
    let id = ids::new_id("att");
    let now = chrono::Utc::now().to_rfc3339();

    let source = std::path::Path::new(&source_path);
    let filename = source
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let attach_dir = std::path::PathBuf::from(data_dir)
        .join("attachments")
        .join(&item_id);
    std::fs::create_dir_all(&attach_dir).map_err(|e| AppError::Io(e.to_string()))?;

    let dest_path = attach_dir.join(format!("{}-{}", &id[..8], filename));
    std::fs::copy(&source_path, &dest_path).map_err(|e| AppError::Io(e.to_string()))?;

    let file_size = std::fs::metadata(&dest_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    let mime_type = match source.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "txt" | "md" => "text/plain",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        _ => "application/octet-stream",
    }.to_string();

    let dest_str = dest_path.to_string_lossy().to_string();

    let conn = db.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "INSERT INTO attachments (id, item_id, filename, file_path, mime_type, file_size, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, item_id, filename, dest_str, mime_type, file_size, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(AttachmentDto {
        id,
        item_id,
        filename,
        file_path: dest_str,
        mime_type,
        file_size,
        created_at: now,
    })
}

pub fn get_by_item(db: &DbState, item_id: &str) -> Result<Vec<AttachmentDto>, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, filename, file_path, mime_type, file_size, created_at
             FROM attachments WHERE item_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<AttachmentDto> = stmt
        .query_map(params![item_id], |row| {
            Ok(AttachmentDto {
                id: row.get(0)?,
                item_id: row.get(1)?,
                filename: row.get(2)?,
                file_path: row.get(3)?,
                mime_type: row.get(4)?,
                file_size: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

pub fn delete(db: &DbState, id: &str) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM attachments WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .ok();
    let rows = conn
        .execute("DELETE FROM attachments WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Attachment {}", id)));
    }
    if let Some(path) = file_path {
        let path_ref = std::path::Path::new(&path);
        let is_managed_attachment = path_ref
            .components()
            .any(|component| component.as_os_str() == "attachments");
        if is_managed_attachment && path_ref.exists() {
            std::fs::remove_file(path_ref).map_err(|e| AppError::Io(e.to_string()))?;
        }
    }
    Ok(())
}
