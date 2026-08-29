use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::db::DbState;
use crate::error::AppError;
use crate::services::data_io_service::{resolve_safe_attachment_path, validate_relative_path};
use crate::utils::paths;

const ATTACHMENT_PROTOCOL: &str = "attachment://";

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StorageIssue {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    pub size_bytes: u64,
    pub reason: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StorageConsistencyReport {
    pub missing_files: Vec<StorageIssue>,
    pub orphan_files: Vec<StorageIssue>,
    pub broken_references: Vec<StorageIssue>,
    pub scanned_files: u64,
    pub storage_bytes: u64,
}

#[derive(Clone)]
struct AttachmentRecord {
    id: String,
    item_id: String,
    filename: String,
    file_path: String,
    file_size: i64,
}

fn load_storage_records(
    db: &DbState,
) -> Result<(Vec<AttachmentRecord>, Vec<(String, String)>), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|error| AppError::Database(error.to_string()))?;

    let mut attachment_stmt = conn
        .prepare("SELECT id, item_id, filename, file_path, file_size FROM attachments ORDER BY id")
        .map_err(|error| AppError::Database(error.to_string()))?;
    let attachments = attachment_stmt
        .query_map([], |row| {
            Ok(AttachmentRecord {
                id: row.get(0)?,
                item_id: row.get(1)?,
                filename: row.get(2)?,
                file_path: row.get(3)?,
                file_size: row.get(4)?,
            })
        })
        .map_err(|error| AppError::Database(error.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::Database(error.to_string()))?;

    let mut item_stmt = conn
        .prepare("SELECT id, content FROM items ORDER BY id")
        .map_err(|error| AppError::Database(error.to_string()))?;
    let items = item_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|error| AppError::Database(error.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::Database(error.to_string()))?;

    Ok((attachments, items))
}

fn normalize_relative_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn attachment_issue(record: &AttachmentRecord, reason: String) -> StorageIssue {
    StorageIssue {
        path: record.file_path.clone(),
        attachment_id: Some(record.id.clone()),
        item_id: Some(record.item_id.clone()),
        filename: Some(record.filename.clone()),
        size_bytes: record.file_size.max(0) as u64,
        reason,
    }
}

fn decode_percent_component(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let high = hex_value(bytes[index + 1]);
            let low = hex_value(bytes[index + 2]);
            if let (Some(high), Some(low)) = (high, low) {
                decoded.push((high * 16 + low) as u8);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn collect_attachment_references(content: &str) -> Vec<String> {
    let lower = content.to_ascii_lowercase();
    let mut references = Vec::new();
    let mut cursor = 0;

    while let Some(offset) = lower[cursor..].find(ATTACHMENT_PROTOCOL) {
        let protocol_start = cursor + offset;
        let id_start = protocol_start + ATTACHMENT_PROTOCOL.len();
        let id_end = content[id_start..]
            .find(|character: char| {
                character.is_whitespace() || matches!(character, ')' | ']' | '"' | '\'' | '?' | '#')
            })
            .map(|offset| id_start + offset)
            .unwrap_or(content.len());
        let raw_id = &content[id_start..id_end];
        references.push(decode_percent_component(raw_id));
        cursor = id_end.max(id_start);
    }

    references
}

fn collect_attachment_files(
    root: &Path,
    current: &Path,
    files: &mut Vec<(String, u64)>,
) -> Result<(), AppError> {
    let entries = match std::fs::read_dir(current) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(AppError::Io(error.to_string())),
    };

    for entry in entries {
        let entry = entry.map_err(|error| AppError::Io(error.to_string()))?;
        let path = entry.path();
        let metadata =
            std::fs::symlink_metadata(&path).map_err(|error| AppError::Io(error.to_string()))?;
        let file_type = metadata.file_type();
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_attachment_files(root, &path, files)?;
        } else if file_type.is_file() {
            let relative = path
                .strip_prefix(root)
                .map_err(|error| AppError::Io(error.to_string()))?;
            let relative = PathBuf::from("attachments").join(relative);
            files.push((normalize_relative_path(&relative), metadata.len()));
        }
    }

    Ok(())
}

pub(crate) fn scan_storage_consistency(db: &DbState) -> Result<StorageConsistencyReport, AppError> {
    let (attachments, items) = load_storage_records(db)?;
    let data_dir = paths::quantanote_dir();
    let mut referenced_paths = HashSet::new();
    let mut missing_files = Vec::new();
    let attachment_root = data_dir.join("attachments");

    for attachment in &attachments {
        match resolve_safe_attachment_path(&data_dir, &attachment.file_path) {
            Ok(full_path) => {
                if let Ok(relative_path) =
                    validate_relative_path(&attachment.file_path, "attachments")
                {
                    referenced_paths.insert(normalize_relative_path(&relative_path));
                }
                match std::fs::symlink_metadata(&full_path) {
                    Ok(metadata) if metadata.file_type().is_file() => {}
                    Ok(_) => missing_files.push(attachment_issue(
                        attachment,
                        "附件路径不是普通文件".to_string(),
                    )),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                        missing_files.push(attachment_issue(
                            attachment,
                            "数据库记录存在，但附件文件不存在".to_string(),
                        ));
                    }
                    Err(error) => missing_files.push(attachment_issue(
                        attachment,
                        format!("读取附件失败: {}", error),
                    )),
                }
            }
            Err(error) => missing_files.push(attachment_issue(
                attachment,
                format!("附件路径无效: {}", error),
            )),
        }
    }

    let mut physical_files = Vec::new();
    collect_attachment_files(&attachment_root, &attachment_root, &mut physical_files)?;
    let scanned_files = physical_files.len() as u64;
    let storage_bytes = physical_files.iter().map(|(_, size)| *size).sum::<u64>();
    let orphan_files = physical_files
        .into_iter()
        .filter(|(path, _)| !referenced_paths.contains(path))
        .map(|(path, size)| StorageIssue {
            path,
            attachment_id: None,
            item_id: None,
            filename: None,
            size_bytes: size,
            reason: "文件存在，但数据库没有对应附件记录".to_string(),
        })
        .collect();

    let attachment_ids: HashSet<&str> = attachments.iter().map(|item| item.id.as_str()).collect();
    let mut seen_references = HashSet::new();
    let mut broken_references = Vec::new();
    for (item_id, content) in items {
        for reference in collect_attachment_references(&content) {
            if !seen_references.insert((item_id.clone(), reference.clone())) {
                continue;
            }
            if reference.is_empty() || !attachment_ids.contains(reference.as_str()) {
                broken_references.push(StorageIssue {
                    path: format!("item://{}", item_id),
                    attachment_id: (!reference.is_empty()).then_some(reference),
                    item_id: Some(item_id.clone()),
                    filename: None,
                    size_bytes: 0,
                    reason: "正文引用了不存在的附件".to_string(),
                });
            }
        }
    }

    Ok(StorageConsistencyReport {
        missing_files,
        orphan_files,
        broken_references,
        scanned_files,
        storage_bytes,
    })
}

pub(crate) fn repair_storage_consistency(
    db: &DbState,
) -> Result<StorageConsistencyReport, AppError> {
    let report = scan_storage_consistency(db)?;
    let data_dir = paths::quantanote_dir();
    let (attachments, _) = load_storage_records(db)?;
    let referenced_paths: HashSet<String> = attachments
        .iter()
        .filter_map(|attachment| {
            validate_relative_path(&attachment.file_path, "attachments")
                .ok()
                .map(|path| normalize_relative_path(&path))
        })
        .collect();

    for orphan in report.orphan_files {
        if referenced_paths.contains(&orphan.path) {
            continue;
        }
        let path = match resolve_safe_attachment_path(&data_dir, &orphan.path) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let metadata = match std::fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        if !metadata.file_type().is_file() {
            continue;
        }
        if let Err(error) = std::fs::remove_file(&path) {
            log::warn!("清理孤立附件失败 {}: {}", path.display(), error);
        }
    }

    scan_storage_consistency(db)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_missing_orphan_and_broken_attachment_storage() {
        let data_dir = crate::test_support::unique_temp_dir("storage-consistency");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "存储检查".to_string(),
            "note".to_string(),
            Some("![失效](attachment://missing-attachment)".to_string()),
        )
        .expect("create item");
        let attachment = crate::services::attachment_service::add_attachment_data(
            &db,
            item.id,
            "missing.png".to_string(),
            "image/png".to_string(),
            b"missing after scan".to_vec(),
        )
        .expect("create attachment");
        std::fs::remove_file(&attachment.file_path).expect("remove attachment file");

        let orphan_name = format!("orphan-{}.bin", uuid::Uuid::new_v4());
        let orphan_relative = format!("attachments/orphan/{}", orphan_name);
        let orphan = paths::quantanote_dir().join(&orphan_relative);
        std::fs::create_dir_all(orphan.parent().unwrap()).expect("create orphan directory");
        std::fs::write(&orphan, b"orphan").expect("write orphan");

        let report = scan_storage_consistency(&db).expect("scan storage");
        assert_eq!(report.missing_files.len(), 1);
        assert!(report
            .orphan_files
            .iter()
            .any(|issue| issue.path == orphan_relative));
        assert_eq!(report.broken_references.len(), 1);
        assert!(report.scanned_files >= 1);

        let repaired = repair_storage_consistency(&db).expect("repair storage");
        assert!(!orphan.exists());
        assert_eq!(repaired.missing_files.len(), 1);
        assert!(!repaired
            .orphan_files
            .iter()
            .any(|issue| issue.path == orphan_relative));
        assert_eq!(repaired.broken_references.len(), 1);

        let _ = std::fs::remove_dir_all(data_dir);
    }
}
