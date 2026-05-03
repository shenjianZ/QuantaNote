use rusqlite::params;
use std::path::PathBuf;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::utils::{ids, paths};

fn resolve_file_path(relative_path: &str) -> PathBuf {
    paths::quantanote_dir().join(relative_path)
}

/// 清洗路径组件，仅保留安全字符，防止路径穿越
fn sanitize_path_component(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

pub fn add(db: &DbState, item_id: String, source_path: String) -> Result<AttachmentDto, AppError> {
    let id = ids::new_id("att");
    let now = chrono::Utc::now().to_rfc3339();
    let safe_item_id = sanitize_path_component(&item_id);

    let source = std::path::Path::new(&source_path);
    let filename = source
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let relative_path = PathBuf::from("attachments")
        .join(&safe_item_id)
        .join(format!("{}-{}", &id[..8], filename));
    let dest_path = paths::quantanote_dir().join(&relative_path);
    std::fs::create_dir_all(
        dest_path
            .parent()
            .ok_or_else(|| AppError::Validation("附件路径无效".to_string()))?,
    )
    .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::copy(&source_path, &dest_path).map_err(|e| AppError::Io(e.to_string()))?;

    let file_size = std::fs::metadata(&dest_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);
    let mime_type = match source
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        // Images
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "tiff" | "tif" => "image/tiff",
        "avif" => "image/avif",
        // Audio
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" | "oga" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",
        "wma" => "audio/x-ms-wma",
        "mid" | "midi" => "audio/midi",
        // Video
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mov" | "qt" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "wmv" => "video/x-ms-wmv",
        "flv" => "video/x-flv",
        "mpeg" | "mpg" => "video/mpeg",
        "3gp" => "video/3gpp",
        // Documents
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        // Text & Code
        "txt" | "md" | "markdown" => "text/plain",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "xml" => "text/xml",
        "css" => "text/css",
        "js" | "mjs" => "text/javascript",
        "ts" => "text/typescript",
        "jsx" => "text/jsx",
        "tsx" => "text/tsx",
        "py" => "text/x-python",
        "rs" => "text/x-rust",
        "go" => "text/x-go",
        "java" => "text/x-java",
        "c" | "h" => "text/x-c",
        "cpp" | "hpp" | "cc" => "text/x-c++",
        "cs" => "text/x-csharp",
        "rb" => "text/x-ruby",
        "php" => "text/x-php",
        "swift" => "text/x-swift",
        "kt" => "text/x-kotlin",
        "sh" | "bash" => "text/x-shellscript",
        "bat" | "cmd" => "text/x-bat",
        "ps1" => "text/x-powershell",
        "sql" => "text/x-sql",
        "yaml" | "yml" => "text/yaml",
        "toml" => "text/x-toml",
        "ini" | "cfg" | "conf" => "text/x-ini",
        "csv" => "text/csv",
        "log" => "text/x-log",
        // Archives
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" | "gzip" => "application/gzip",
        "rar" => "application/vnd.rar",
        "7z" => "application/x-7z-compressed",
        // Ebooks
        "epub" => "application/epub+zip",
        "mobi" => "application/x-mobipocket-ebook",
        _ => "application/octet-stream",
    }
    .to_string();

    let relative_str = relative_path.to_string_lossy().to_string();

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "INSERT INTO attachments (id, item_id, filename, file_path, mime_type, file_size, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, item_id, filename, relative_str, mime_type, file_size, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(AttachmentDto {
        id,
        item_id,
        filename,
        file_path: dest_path.to_string_lossy().to_string(),
        mime_type,
        file_size,
        created_at: now,
    })
}

pub fn get_by_item(db: &DbState, item_id: &str) -> Result<Vec<AttachmentDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, filename, file_path, mime_type, file_size, created_at
             FROM attachments WHERE item_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<AttachmentDto> = stmt
        .query_map(params![item_id], |row| {
            let relative_path: String = row.get(3)?;
            Ok(AttachmentDto {
                id: row.get(0)?,
                item_id: row.get(1)?,
                filename: row.get(2)?,
                file_path: resolve_file_path(&relative_path)
                    .to_string_lossy()
                    .to_string(),
                mime_type: row.get(4)?,
                file_size: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(items)
}

pub fn delete(db: &DbState, id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 先检查记录是否存在
    let relative_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM attachments WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .ok();

    if relative_path.is_none() {
        return Err(AppError::NotFound(format!("Attachment {}", id)));
    }

    // 写入 tombstone（用于同步删除操作）— 只有记录存在时才写
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'attachments', ?2)",
        params![id, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    // 删除 DB 记录
    conn.execute("DELETE FROM attachments WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;

    drop(conn);

    // 删除文件（在 DB 记录删除之后，避免删了文件但 DB 记录还在的不一致状态）
    if let Some(rel) = relative_path {
        let full_path = resolve_file_path(&rel);
        if full_path.exists() {
            std::fs::remove_file(&full_path).map_err(|e| AppError::Io(e.to_string()))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::item::CreateItemPayload;
    use crate::repositories::item_repository;

    fn setup() -> (DbState, String, std::sync::MutexGuard<'static, ()>) {
        let data_dir = crate::test_support::unique_temp_dir("att-repo");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let dto = item_repository::create(
            &db,
            CreateItemPayload {
                title: "Test".to_string(),
                item_type: "note".to_string(),
                content: None,
                summary: String::new(),
            },
        )
        .unwrap();
        (db, dto.id, _guard)
    }

    #[test]
    fn add_and_get_by_item() {
        let (db, item_id, _guard) = setup();
        let temp_dir = crate::test_support::unique_temp_dir("att-src");
        let src = temp_dir.join("test.txt");
        std::fs::write(&src, "hello").unwrap();

        let att = add(&db, item_id.clone(), src.to_string_lossy().to_string()).unwrap();
        assert_eq!(att.filename, "test.txt");
        assert_eq!(att.mime_type, "text/plain");
        assert!(att.file_size > 0);

        let list = get_by_item(&db, &item_id).unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn delete_removes_record() {
        let (db, item_id, _guard) = setup();
        let temp_dir = crate::test_support::unique_temp_dir("att-src2");
        let src = temp_dir.join("del.txt");
        std::fs::write(&src, "bye").unwrap();

        let att = add(&db, item_id.clone(), src.to_string_lossy().to_string()).unwrap();
        delete(&db, &att.id).unwrap();

        let list = get_by_item(&db, &item_id).unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn get_by_item_empty_for_unlinked() {
        let (db, _item_id, _guard) = setup();
        let list = get_by_item(&db, "nonexistent-item").unwrap();
        assert!(list.is_empty());
    }
}
