use rusqlite::params;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::path::{Component, Path, PathBuf};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::attachment::AttachmentDto;
use crate::utils::{ids, paths};

fn resolve_file_path(relative_path: &str) -> PathBuf {
    paths::quantanote_dir().join(relative_path)
}

const CLEANUP_QUEUE_FILENAME: &str = ".attachment-cleanup-queue.json";

fn cleanup_queue_path() -> PathBuf {
    paths::quantanote_dir().join(CLEANUP_QUEUE_FILENAME)
}

fn read_cleanup_queue() -> Result<Vec<String>, AppError> {
    let path = cleanup_queue_path();
    let content = match std::fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(AppError::Io(error.to_string())),
    };

    serde_json::from_str(&content)
        .map_err(|error| AppError::Io(format!("读取附件清理队列失败: {}", error)))
}

fn write_cleanup_queue(paths: &[String]) -> Result<(), AppError> {
    let queue_path = cleanup_queue_path();
    if paths.is_empty() {
        match std::fs::remove_file(queue_path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(AppError::Io(error.to_string())),
        }
        return Ok(());
    }

    let content = serde_json::to_vec_pretty(paths)
        .map_err(|error| AppError::Io(format!("写入附件清理队列失败: {}", error)))?;
    std::fs::write(queue_path, content).map_err(|error| AppError::Io(error.to_string()))
}

fn enqueue_cleanup_paths(paths: &[String]) -> Result<(), AppError> {
    if paths.is_empty() {
        return Ok(());
    }

    let mut queued = read_cleanup_queue()?;
    for path in paths {
        if !queued.iter().any(|existing| existing == path) {
            queued.push(path.clone());
        }
    }
    write_cleanup_queue(&queued)
}

/// 只允许删除附件目录内的相对文件，避免数据库中的异常路径影响其他文件。
fn resolve_safe_attachment_file_path(relative_path: &str) -> Result<PathBuf, AppError> {
    let path = Path::new(relative_path);
    if path.is_absolute() {
        return Err(AppError::Validation(format!(
            "附件路径必须是相对路径: {}",
            relative_path
        )));
    }

    let mut components = path.components();
    match components.next() {
        Some(Component::Normal(name)) if name == "attachments" => {}
        _ => {
            return Err(AppError::Validation(format!(
                "附件路径必须位于 attachments 目录: {}",
                relative_path
            )))
        }
    }

    if components.any(|component| !matches!(component, Component::Normal(_))) {
        return Err(AppError::Validation(format!(
            "附件路径包含非法组件: {}",
            relative_path
        )));
    }

    Ok(paths::quantanote_dir().join(path))
}

/// 清理附件文件。数据库记录删除后，如果文件暂时无法删除，会进入可重试队列。
pub fn cleanup_file_paths(relative_paths: &[String]) -> Result<(), AppError> {
    let _ = retry_pending_file_cleanup();
    let mut failed = Vec::new();

    for relative_path in relative_paths {
        let full_path = resolve_safe_attachment_file_path(relative_path)?;
        match std::fs::remove_file(&full_path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => failed.push(relative_path.clone()),
        }
    }

    if failed.is_empty() {
        return Ok(());
    }

    enqueue_cleanup_paths(&failed).map_err(|error| {
        AppError::Io(format!(
            "附件记录已删除，但文件清理失败且无法加入重试队列: {}",
            error
        ))
    })?;
    log::warn!("{} 个附件文件暂时无法删除，已加入重试队列", failed.len());
    Ok(())
}

/// 仅清理当前没有任何附件记录引用的文件，避免共享物理文件被提前删除。
pub(crate) fn cleanup_file_paths_if_unreferenced(
    db: &DbState,
    relative_paths: &[String],
) -> Result<(), AppError> {
    let candidates = {
        let conn = db
            .conn
            .lock()
            .map_err(|error| AppError::Database(error.to_string()))?;
        let mut candidates = Vec::new();
        for relative_path in relative_paths {
            if candidates.iter().any(|path| path == relative_path) {
                continue;
            }
            let references: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM attachments WHERE file_path = ?1",
                    params![relative_path],
                    |row| row.get(0),
                )
                .map_err(|error| AppError::Database(error.to_string()))?;
            if references == 0 {
                candidates.push(relative_path.clone());
            }
        }
        candidates
    };

    cleanup_file_paths(&candidates)
}

/// 重试之前因权限、占用等原因未能删除的附件文件。
pub fn retry_pending_file_cleanup() -> Result<usize, AppError> {
    let queued = read_cleanup_queue()?;
    if queued.is_empty() {
        return Ok(0);
    }

    let mut remaining = Vec::new();
    let mut cleaned = 0;
    for relative_path in queued {
        let full_path = match resolve_safe_attachment_file_path(&relative_path) {
            Ok(path) => path,
            Err(error) => {
                log::error!("跳过非法附件清理路径 {}: {}", relative_path, error);
                remaining.push(relative_path);
                continue;
            }
        };
        match std::fs::remove_file(full_path) {
            Ok(()) => cleaned += 1,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => cleaned += 1,
            Err(_) => remaining.push(relative_path),
        }
    }

    write_cleanup_queue(&remaining)?;
    Ok(cleaned)
}

/// 清洗路径组件，仅保留安全字符，防止路径穿越
fn sanitize_path_component(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

fn temporary_file_path(dest: &Path) -> Result<PathBuf, AppError> {
    let parent = dest
        .parent()
        .ok_or_else(|| AppError::Validation("附件路径无效".to_string()))?;
    let name = dest
        .file_name()
        .ok_or_else(|| AppError::Validation("附件文件名无效".to_string()))?
        .to_string_lossy();
    Ok(parent.join(format!(".{}.tmp-{}", name, ids::new_id("tmp"))))
}

fn replace_file_with_temp(temp: &Path, dest: &Path) -> Result<(), AppError> {
    let result = match std::fs::rename(temp, dest) {
        Ok(()) => Ok(()),
        Err(_rename_error) if dest.exists() => {
            std::fs::remove_file(dest).map_err(|e| AppError::Io(e.to_string()))?;
            std::fs::rename(temp, dest).map_err(|e| AppError::Io(format!("替换附件失败: {}", e)))
        }
        Err(error) => Err(AppError::Io(format!("写入附件失败: {}", error))),
    };
    if result.is_err() {
        let _ = std::fs::remove_file(temp);
    }
    result
}

pub(crate) fn write_file_atomically(dest: &Path, bytes: &[u8]) -> Result<(), AppError> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
    }
    let temp = temporary_file_path(dest)?;
    if let Err(error) = std::fs::write(&temp, bytes) {
        let _ = std::fs::remove_file(&temp);
        return Err(AppError::Io(error.to_string()));
    }
    replace_file_with_temp(&temp, dest)
}

pub(crate) fn copy_file_atomically(source: &Path, dest: &Path) -> Result<(), AppError> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
    }
    let temp = temporary_file_path(dest)?;
    if let Err(error) = std::fs::copy(source, &temp) {
        let _ = std::fs::remove_file(&temp);
        return Err(AppError::Io(error.to_string()));
    }
    replace_file_with_temp(&temp, dest)
}

pub(crate) fn compute_content_hash(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

/// 查找可以复用的物理附件文件。
///
/// 旧版本没有 content_hash，首次遇到时顺便按文件内容补齐，保证升级后的旧附件也能参与去重。
pub(crate) fn find_reusable_file_path(
    conn: &Connection,
    content_hash: &str,
) -> Result<Option<String>, AppError> {
    if content_hash.is_empty() {
        return Ok(None);
    }

    let hashed_paths: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT file_path FROM attachments
                 WHERE content_hash = ?1 ORDER BY created_at ASC, id ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(params![content_hash], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows
    };
    for relative_path in hashed_paths {
        if let Ok(full_path) = resolve_safe_attachment_file_path(&relative_path) {
            let is_regular_file = std::fs::symlink_metadata(&full_path)
                .map(|metadata| metadata.file_type().is_file())
                .unwrap_or(false);
            if is_regular_file
                && std::fs::read(&full_path)
                    .map(|bytes| compute_content_hash(&bytes) == content_hash)
                    .unwrap_or(false)
            {
                return Ok(Some(relative_path));
            }
        }
    }

    let legacy_rows: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare(
                "SELECT id, file_path FROM attachments
                 WHERE content_hash = '' ORDER BY created_at ASC, id ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows
    };
    for (id, relative_path) in legacy_rows {
        let full_path = match resolve_safe_attachment_file_path(&relative_path) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let bytes = match std::fs::read(&full_path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        let hash = compute_content_hash(&bytes);
        conn.execute(
            "UPDATE attachments SET content_hash = ?1 WHERE id = ?2 AND content_hash = ''",
            params![hash, id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        if hash == content_hash {
            return Ok(Some(relative_path));
        }
    }

    Ok(None)
}

/// 将附件复制到用户选择的导出位置。源文件必须来自 QuantaNote 附件目录，
/// 防止前端传入任意路径后借此命令读取或复制其他文件。
pub fn export_file(source_path: &str, destination_path: &str) -> Result<(), AppError> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(AppError::NotFound(format!(
            "附件文件不存在: {}",
            source_path
        )));
    }
    let attachment_root = std::fs::canonicalize(paths::quantanote_dir().join("attachments"))
        .map_err(|error| AppError::Io(format!("附件目录不可用: {}", error)))?;
    let source = std::fs::canonicalize(source)
        .map_err(|error| AppError::Io(format!("读取附件失败: {}", error)))?;
    if !source.starts_with(&attachment_root) {
        return Err(AppError::Validation(
            "只能导出 QuantaNote 附件目录中的文件".to_string(),
        ));
    }

    let destination = Path::new(destination_path);
    if destination.as_os_str().is_empty() || destination.is_dir() {
        return Err(AppError::Validation("导出目标文件无效".to_string()));
    }
    copy_file_atomically(&source, destination)
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
    let mut dest_path = paths::quantanote_dir().join(&relative_path);
    copy_file_atomically(source, &dest_path)?;

    let bytes = std::fs::read(&dest_path).map_err(|error| AppError::Io(error.to_string()))?;
    let file_size = bytes.len() as i64;
    let content_hash = compute_content_hash(&bytes);
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

    let mut relative_str = relative_path.to_string_lossy().to_string();
    let mut owns_file = true;

    let conn = match db.conn.lock() {
        Ok(conn) => conn,
        Err(error) => {
            let _ = std::fs::remove_file(&dest_path);
            return Err(AppError::Database(error.to_string()));
        }
    };
    if let Some(existing_path) = find_reusable_file_path(&conn, &content_hash)? {
        let _ = std::fs::remove_file(&dest_path);
        relative_str = existing_path;
        dest_path = resolve_file_path(&relative_str);
        owns_file = false;
    }
    if let Err(error) = conn.execute(
        "INSERT INTO attachments
         (id, item_id, filename, file_path, mime_type, file_size, content_hash, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            item_id,
            filename,
            relative_str,
            mime_type,
            file_size,
            content_hash,
            now
        ],
    ) {
        if owns_file {
            let _ = std::fs::remove_file(&dest_path);
        }
        return Err(AppError::Database(error.to_string()));
    }

    Ok(AttachmentDto {
        id,
        item_id,
        filename,
        file_path: dest_path.to_string_lossy().to_string(),
        mime_type,
        file_size,
        content_hash,
        created_at: now,
    })
}

pub fn add_bytes(
    db: &DbState,
    item_id: String,
    filename: String,
    mime_type: String,
    bytes: Vec<u8>,
) -> Result<AttachmentDto, AppError> {
    let id = ids::new_id("att");
    let now = chrono::Utc::now().to_rfc3339();
    let safe_item_id = sanitize_path_component(&item_id);
    let filename = std::path::Path::new(&filename)
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "pasted-image.png".to_string());
    let relative_path = PathBuf::from("attachments")
        .join(&safe_item_id)
        .join(format!("{}-{}", &id[..8], filename));
    let mut dest_path = paths::quantanote_dir().join(&relative_path);
    write_file_atomically(&dest_path, &bytes)?;

    let file_size = bytes.len() as i64;
    let content_hash = compute_content_hash(&bytes);
    let mut relative_str = relative_path.to_string_lossy().to_string();
    let mut owns_file = true;
    let conn = match db.conn.lock() {
        Ok(conn) => conn,
        Err(error) => {
            let _ = std::fs::remove_file(&dest_path);
            return Err(AppError::Database(error.to_string()));
        }
    };
    if let Some(existing_path) = find_reusable_file_path(&conn, &content_hash)? {
        let _ = std::fs::remove_file(&dest_path);
        relative_str = existing_path;
        dest_path = resolve_file_path(&relative_str);
        owns_file = false;
    }
    if let Err(error) = conn.execute(
        "INSERT INTO attachments
         (id, item_id, filename, file_path, mime_type, file_size, content_hash, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            item_id,
            filename,
            relative_str,
            mime_type,
            file_size,
            content_hash,
            now
        ],
    ) {
        if owns_file {
            let _ = std::fs::remove_file(&dest_path);
        }
        return Err(AppError::Database(error.to_string()));
    }

    Ok(AttachmentDto {
        id,
        item_id,
        filename,
        file_path: dest_path.to_string_lossy().to_string(),
        mime_type,
        file_size,
        content_hash,
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
            "SELECT id, item_id, filename, file_path, mime_type, file_size, content_hash, created_at
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
                content_hash: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(items)
}

pub fn get_item_ids_with_attachments(db: &DbState) -> Result<Vec<String>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT DISTINCT item_id FROM attachments ORDER BY item_id")
        .map_err(|e| AppError::Database(e.to_string()))?;

    let ids = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| AppError::Database(e.to_string()));
    ids
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
        cleanup_file_paths_if_unreferenced(db, &[rel])?;
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
        assert_eq!(list[0].content_hash, compute_content_hash(b"hello"));
    }

    #[test]
    fn duplicate_content_reuses_file_and_deletes_only_after_last_reference() {
        let (db, first_item_id, _guard) = setup();
        let second_item = item_repository::create(
            &db,
            CreateItemPayload {
                title: "Second".to_string(),
                item_type: "note".to_string(),
                content: None,
                summary: String::new(),
            },
        )
        .unwrap();

        let first = add_bytes(
            &db,
            first_item_id,
            "first.png".to_string(),
            "image/png".to_string(),
            b"same bytes".to_vec(),
        )
        .expect("create first attachment");
        let second = add_bytes(
            &db,
            second_item.id.clone(),
            "renamed.png".to_string(),
            "image/png".to_string(),
            b"same bytes".to_vec(),
        )
        .expect("create duplicate attachment");

        assert_eq!(first.content_hash, second.content_hash);
        assert_eq!(first.file_path, second.file_path);
        assert_eq!(
            std::fs::read_dir(std::path::Path::new(&first.file_path).parent().unwrap())
                .unwrap()
                .filter_map(Result::ok)
                .count(),
            1
        );

        delete(&db, &first.id).expect("delete first reference");
        assert!(std::path::Path::new(&second.file_path).exists());

        delete(&db, &second.id).expect("delete last reference");
        assert!(!std::path::Path::new(&second.file_path).exists());
    }

    #[test]
    fn deleting_item_keeps_shared_attachment_file_for_remaining_item() {
        let (db, first_item_id, _guard) = setup();
        let second_item = item_repository::create(
            &db,
            CreateItemPayload {
                title: "Second item".to_string(),
                item_type: "note".to_string(),
                content: None,
                summary: String::new(),
            },
        )
        .unwrap();
        let first = add_bytes(
            &db,
            first_item_id.clone(),
            "shared.bin".to_string(),
            "application/octet-stream".to_string(),
            b"shared item bytes".to_vec(),
        )
        .expect("create first shared attachment");
        let second = add_bytes(
            &db,
            second_item.id.clone(),
            "shared-copy.bin".to_string(),
            "application/octet-stream".to_string(),
            b"shared item bytes".to_vec(),
        )
        .expect("create second shared attachment");

        item_repository::delete(&db, &first_item_id).expect("delete first item");
        assert!(std::path::Path::new(&second.file_path).exists());
        assert_eq!(get_by_item(&db, &second_item.id).unwrap()[0].id, second.id);

        item_repository::delete(&db, &second_item.id).expect("delete second item");
        assert!(!std::path::Path::new(&first.file_path).exists());
    }

    #[test]
    fn write_file_atomically_replaces_existing_file() {
        let temp_dir = crate::test_support::unique_temp_dir("att-atomic");
        let dest = temp_dir.join("nested").join("file.bin");

        write_file_atomically(&dest, b"before").expect("write initial file");
        write_file_atomically(&dest, b"after").expect("replace file atomically");

        assert_eq!(std::fs::read(&dest).unwrap(), b"after");
        let temp_entries = std::fs::read_dir(dest.parent().unwrap())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp-"))
            .count();
        assert_eq!(temp_entries, 0);

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn add_bytes_removes_file_when_database_insert_fails() {
        let data_dir = crate::test_support::unique_temp_dir("att-db-failure");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();

        let result = add_bytes(
            &db,
            "missing-item".to_string(),
            "failed.bin".to_string(),
            "application/octet-stream".to_string(),
            b"orphan me".to_vec(),
        );

        assert!(result.is_err());
        let attachment_dir = paths::quantanote_dir().join("attachments/missing-item");
        let files = std::fs::read_dir(attachment_dir)
            .unwrap()
            .filter_map(Result::ok)
            .count();
        assert_eq!(files, 0);
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
    fn export_file_copies_attachment_and_rejects_external_source() {
        let (db, item_id, _guard) = setup();
        let attachment = add_bytes(
            &db,
            item_id,
            "export.png".to_string(),
            "image/png".to_string(),
            b"image bytes".to_vec(),
        )
        .expect("create export attachment");
        let export_dir = crate::test_support::unique_temp_dir("att-export");
        let destination = export_dir.join("nested").join("copy.png");

        export_file(
            &attachment.file_path,
            destination.to_string_lossy().as_ref(),
        )
        .expect("export attachment");
        assert_eq!(std::fs::read(&destination).unwrap(), b"image bytes");

        let external_dir = crate::test_support::unique_temp_dir("att-export-external");
        let external_source = external_dir.join("outside.png");
        std::fs::write(&external_source, b"outside").expect("write external source");
        let error = export_file(
            external_source.to_string_lossy().as_ref(),
            destination.to_string_lossy().as_ref(),
        )
        .expect_err("external source must be rejected");
        assert!(matches!(error, AppError::Validation(_)));

        let _ = std::fs::remove_dir_all(export_dir);
        let _ = std::fs::remove_dir_all(external_dir);
    }

    #[test]
    fn retry_pending_file_cleanup_removes_queued_file() {
        let data_dir = crate::test_support::unique_temp_dir("att-cleanup-queue");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let relative_path = format!("attachments/retry-{}/pending.bin", uuid::Uuid::new_v4());
        let full_path = paths::quantanote_dir().join(&relative_path);
        std::fs::create_dir_all(full_path.parent().expect("pending file parent"))
            .expect("create pending file parent");
        std::fs::write(&full_path, b"pending").expect("write pending file");
        write_cleanup_queue(std::slice::from_ref(&relative_path)).expect("write cleanup queue");

        assert_eq!(retry_pending_file_cleanup().expect("retry cleanup"), 1);
        assert!(!full_path.exists());
        assert!(!cleanup_queue_path().exists());

        let _ = std::fs::remove_dir_all(data_dir);
    }

    #[test]
    fn get_by_item_empty_for_unlinked() {
        let (db, _item_id, _guard) = setup();
        let list = get_by_item(&db, "nonexistent-item").unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn get_item_ids_with_attachments_returns_distinct_item_ids() {
        let (db, item_id, _guard) = setup();
        let second = item_repository::create(
            &db,
            CreateItemPayload {
                title: "Second".to_string(),
                item_type: "note".to_string(),
                content: None,
                summary: String::new(),
            },
        )
        .unwrap();

        add_bytes(
            &db,
            item_id.clone(),
            "one.png".to_string(),
            "image/png".to_string(),
            b"one".to_vec(),
        )
        .unwrap();
        add_bytes(
            &db,
            item_id.clone(),
            "two.png".to_string(),
            "image/png".to_string(),
            b"two".to_vec(),
        )
        .unwrap();
        add_bytes(
            &db,
            second.id.clone(),
            "three.png".to_string(),
            "image/png".to_string(),
            b"three".to_vec(),
        )
        .unwrap();

        let ids = get_item_ids_with_attachments(&db).unwrap();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&item_id));
        assert!(ids.contains(&second.id));
    }
}
