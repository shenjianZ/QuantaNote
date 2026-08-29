use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use crate::db::DbState;
use crate::error::AppError;
use crate::repositories::data_io_repository;
use crate::utils::paths;

#[derive(Serialize, Deserialize)]
pub struct ExportData {
    #[serde(default)]
    pub items: Vec<serde_json::Value>,
    #[serde(default)]
    pub tags: Vec<serde_json::Value>,
    #[serde(default)]
    pub item_tags: Vec<serde_json::Value>,
    #[serde(default)]
    pub attachments: Vec<serde_json::Value>,
    #[serde(default)]
    pub versions: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct ExportOptions {
    pub include_tags: bool,
    pub include_attachments: bool,
    pub include_versions: bool,
}

#[derive(Deserialize)]
pub struct ImportOptions {
    pub include_tags: bool,
    pub include_attachments: bool,
    pub include_versions: bool,
    pub overwrite: bool,
}

const ZIP_FORMAT: &str = "quantanote";
const ZIP_FORMAT_VERSION: u32 = 2;
const MAX_ZIP_ENTRIES: usize = 10_000;
const MAX_ZIP_ENTRY_SIZE: u64 = 512 * 1024 * 1024;
const MAX_ZIP_TOTAL_SIZE: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Deserialize, Serialize)]
struct ZipManifest {
    format: String,
    format_version: u32,
    #[serde(default)]
    attachments: Vec<ZipAttachmentManifest>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct ZipAttachmentManifest {
    id: String,
    item_id: String,
    filename: String,
    file_path: String,
    mime_type: String,
    file_size: u64,
    created_at: String,
    archive_path: String,
    sha256: String,
}

#[derive(Serialize, Clone)]
pub struct ExportSizeEstimate {
    pub items_json: u64,
    pub tags_json: u64,
    pub versions_json: u64,
    pub attachments: u64,
    pub total: u64,
}

fn resolve_user_path(path: &str) -> Result<PathBuf, AppError> {
    let target = PathBuf::from(path);
    if target.as_os_str().is_empty() {
        return Err(AppError::Validation("路径无效".to_string()));
    }
    Ok(target)
}

fn sanitize_path_component(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

pub(crate) fn validate_relative_path(path: &str, required_root: &str) -> Result<PathBuf, AppError> {
    if path.is_empty() || path.contains('\0') {
        return Err(AppError::Validation("附件路径无效".to_string()));
    }

    let normalized = path.replace('\\', "/");
    let mut components = normalized.split('/');
    let root = components.next().unwrap_or_default();
    if root != required_root {
        return Err(AppError::Validation(format!(
            "附件路径必须位于 {} 目录下",
            required_root
        )));
    }

    let mut result = PathBuf::from(root);
    let mut component_count = 0;
    for component in components {
        if component.is_empty() || component == "." || component == ".." || component.contains(':')
        {
            return Err(AppError::Validation("附件路径包含非法路径段".to_string()));
        }
        result.push(component);
        component_count += 1;
    }

    if component_count == 0 {
        return Err(AppError::Validation("附件路径缺少文件名".to_string()));
    }
    Ok(result)
}

pub(crate) fn resolve_safe_attachment_path(
    data_dir: &Path,
    path: &str,
) -> Result<PathBuf, AppError> {
    let relative_path = validate_relative_path(path, "attachments")?;
    let data_root = std::fs::canonicalize(data_dir)
        .map_err(|e| AppError::Io(format!("读取数据目录失败: {}", e)))?;
    let mut current = data_dir.to_path_buf();

    for component in relative_path.components() {
        current.push(component.as_os_str());
        match std::fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err(AppError::Validation(format!(
                        "附件路径不能经过符号链接: {}",
                        path
                    )));
                }
                let resolved = std::fs::canonicalize(&current)
                    .map_err(|e| AppError::Io(format!("解析附件路径失败: {}", e)))?;
                if !resolved.starts_with(&data_root) {
                    return Err(AppError::Validation(format!(
                        "附件路径逃逸数据目录: {}",
                        path
                    )));
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
            Err(error) => return Err(AppError::Io(error.to_string())),
        }
    }

    Ok(data_dir.join(relative_path))
}

fn safe_archive_filename(filename: &str) -> String {
    let normalized = filename.replace('\\', "/");
    let basename = normalized.rsplit('/').next().unwrap_or_default();
    let sanitized: String = basename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect();
    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        "attachment.bin".to_string()
    } else {
        sanitized
    }
}

fn sha256_file(path: &Path) -> Result<(u64, String), AppError> {
    let file = std::fs::File::open(path).map_err(|e| AppError::Io(e.to_string()))?;
    let mut reader = std::io::BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut size = 0_u64;

    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|e| AppError::Io(e.to_string()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        size += read as u64;
    }

    Ok((size, format!("{:x}", hasher.finalize())))
}

fn build_zip_attachment_manifest(
    attachment_rows: &[serde_json::Value],
    data_dir: &Path,
) -> Result<Vec<ZipAttachmentManifest>, AppError> {
    let mut manifest = Vec::with_capacity(attachment_rows.len());
    let mut archive_paths = HashSet::new();

    for row in attachment_rows {
        let id = row["id"].as_str().unwrap_or_default().to_string();
        let item_id = row["item_id"].as_str().unwrap_or_default().to_string();
        let filename = row["filename"].as_str().unwrap_or_default().to_string();
        let file_path = row["file_path"].as_str().unwrap_or_default().to_string();
        if id.is_empty() || item_id.is_empty() || filename.is_empty() {
            return Err(AppError::Validation("附件元数据不完整".to_string()));
        }

        let source_path = resolve_safe_attachment_path(data_dir, &file_path)?;
        let metadata = std::fs::metadata(&source_path)
            .map_err(|e| AppError::Io(format!("读取附件 {} 失败: {}", file_path, e)))?;
        if !metadata.is_file() {
            return Err(AppError::Validation(format!("附件不是文件: {}", file_path)));
        }
        let (file_size, sha256) = sha256_file(&source_path)?;
        if file_size > MAX_ZIP_ENTRY_SIZE {
            return Err(AppError::Validation(format!(
                "附件超过 ZIP 单文件大小限制: {}",
                file_path
            )));
        }

        let archive_path = format!(
            "attachments/{}/{}-{}",
            sanitize_path_component(&item_id),
            &sanitize_path_component(&id)
                .chars()
                .take(8)
                .collect::<String>(),
            safe_archive_filename(&filename)
        );
        if !archive_paths.insert(archive_path.clone()) {
            return Err(AppError::Validation("ZIP 中存在重复的附件路径".to_string()));
        }

        manifest.push(ZipAttachmentManifest {
            id,
            item_id,
            filename,
            file_path,
            mime_type: row["mime_type"].as_str().unwrap_or_default().to_string(),
            file_size,
            created_at: row["created_at"].as_str().unwrap_or_default().to_string(),
            archive_path,
            sha256,
        });
    }

    Ok(manifest)
}

fn write_zip_attachment_files(
    zip: &mut zip::ZipWriter<std::fs::File>,
    attachments: &[ZipAttachmentManifest],
    data_dir: &Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), AppError> {
    for attachment in attachments {
        let source_path = resolve_safe_attachment_path(data_dir, &attachment.file_path)?;
        zip.start_file(&attachment.archive_path, options)
            .map_err(|e| AppError::Io(e.to_string()))?;
        let mut source = std::io::BufReader::new(
            std::fs::File::open(&source_path).map_err(|e| AppError::Io(e.to_string()))?,
        );
        std::io::copy(&mut source, zip).map_err(|e| AppError::Io(e.to_string()))?;
    }
    Ok(())
}

fn validate_zip_archive_entries(
    archive: &mut zip::ZipArchive<std::fs::File>,
) -> Result<HashSet<String>, AppError> {
    if archive.len() > MAX_ZIP_ENTRIES {
        return Err(AppError::Validation("ZIP 条目数量超过限制".to_string()));
    }

    let mut names = HashSet::new();
    let mut total_size = 0_u64;
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|e| AppError::Io(format!("读取 ZIP 条目失败: {}", e)))?;
        let raw_name = entry.name();
        if raw_name.contains('\\') {
            return Err(AppError::Validation(format!(
                "ZIP 路径必须使用正斜杠: {}",
                raw_name
            )));
        }
        let name = raw_name.to_string();
        if !names.insert(name.clone()) {
            return Err(AppError::Validation(format!(
                "ZIP 中存在重复条目: {}",
                name
            )));
        }
        if entry.is_dir() {
            continue;
        }

        let allowed = matches!(
            name.as_str(),
            "data.json" | "versions.json" | "manifest.json"
        ) || name.starts_with("attachments/");
        if !allowed {
            return Err(AppError::Validation(format!(
                "ZIP 包含不支持的路径: {}",
                name
            )));
        }
        if name.starts_with("attachments/") {
            validate_relative_path(&name, "attachments")?;
        }
        if entry.size() > MAX_ZIP_ENTRY_SIZE {
            return Err(AppError::Validation(format!(
                "ZIP 条目超过单文件大小限制: {}",
                name
            )));
        }
        total_size = total_size.saturating_add(entry.size());
        if total_size > MAX_ZIP_TOTAL_SIZE {
            return Err(AppError::Validation("ZIP 解压总大小超过限制".to_string()));
        }
    }

    if !names.contains("data.json") {
        return Err(AppError::Validation("ZIP 中缺少 data.json".to_string()));
    }
    Ok(names)
}

fn read_zip_entry(
    archive: &mut zip::ZipArchive<std::fs::File>,
    name: &str,
) -> Result<Vec<u8>, AppError> {
    let mut entry = archive
        .by_name(name)
        .map_err(|_| AppError::Validation(format!("ZIP 中缺少 {}", name)))?;
    if entry.size() > MAX_ZIP_ENTRY_SIZE {
        return Err(AppError::Validation(format!(
            "ZIP 条目超过大小限制: {}",
            name
        )));
    }
    let mut bytes = Vec::with_capacity(entry.size() as usize);
    entry
        .read_to_end(&mut bytes)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(bytes)
}

fn validate_zip_manifest(
    manifest: &ZipManifest,
    entry_names: &HashSet<String>,
) -> Result<(), AppError> {
    if manifest.format != ZIP_FORMAT || manifest.format_version != ZIP_FORMAT_VERSION {
        return Err(AppError::Validation(
            "不支持的 QuantaNote ZIP 格式".to_string(),
        ));
    }
    if manifest.attachments.len() > MAX_ZIP_ENTRIES {
        return Err(AppError::Validation("ZIP 附件数量超过限制".to_string()));
    }

    let mut ids = HashSet::new();
    let mut archive_paths = HashSet::new();
    for attachment in &manifest.attachments {
        if attachment.id.is_empty()
            || attachment.item_id.is_empty()
            || attachment.filename.is_empty()
            || attachment.sha256.len() != 64
            || !attachment.sha256.chars().all(|c| c.is_ascii_hexdigit())
        {
            return Err(AppError::Validation("ZIP 附件元数据无效".to_string()));
        }
        validate_relative_path(&attachment.file_path, "attachments")?;
        validate_relative_path(&attachment.archive_path, "attachments")?;
        if attachment.file_size > MAX_ZIP_ENTRY_SIZE {
            return Err(AppError::Validation(format!(
                "ZIP 附件超过单文件大小限制: {}",
                attachment.filename
            )));
        }
        if !ids.insert(attachment.id.clone()) {
            return Err(AppError::Validation("ZIP 中存在重复的附件记录".to_string()));
        }
        if !archive_paths.insert(attachment.archive_path.clone()) {
            return Err(AppError::Validation("ZIP 中存在重复的附件路径".to_string()));
        }
        if !entry_names.contains(&attachment.archive_path) {
            return Err(AppError::Validation(format!(
                "ZIP 缺少附件文件: {}",
                attachment.archive_path
            )));
        }
    }

    for name in entry_names {
        if name.starts_with("attachments/") && !name.ends_with('/') && !archive_paths.contains(name)
        {
            return Err(AppError::Validation(format!(
                "ZIP 附件文件没有对应元数据: {}",
                name
            )));
        }
    }
    Ok(())
}

#[derive(Debug)]
struct InstalledAttachment {
    target: PathBuf,
    backup: Option<PathBuf>,
}

fn restore_installed_attachments(installed: &[InstalledAttachment]) {
    for attachment in installed.iter().rev() {
        if attachment.target.exists() {
            let _ = std::fs::remove_file(&attachment.target);
        }
        if let Some(backup) = &attachment.backup {
            let _ = std::fs::rename(backup, &attachment.target);
        }
    }
}

fn remove_attachment_backups(installed: &[InstalledAttachment]) {
    for attachment in installed {
        if let Some(backup) = &attachment.backup {
            let _ = std::fs::remove_file(backup);
        }
    }
}

fn stage_and_install_zip_attachments(
    archive: &mut zip::ZipArchive<std::fs::File>,
    manifest: &ZipManifest,
    data_dir: &Path,
    overwrite: bool,
    staging_dir: &Path,
) -> Result<Vec<InstalledAttachment>, AppError> {
    std::fs::create_dir_all(staging_dir).map_err(|e| AppError::Io(e.to_string()))?;
    let mut staged_paths = Vec::with_capacity(manifest.attachments.len());

    for (index, attachment) in manifest.attachments.iter().enumerate() {
        let mut entry = archive
            .by_name(&attachment.archive_path)
            .map_err(|e| AppError::Io(format!("读取附件失败: {}", e)))?;
        if entry.size() != attachment.file_size {
            return Err(AppError::Validation(format!(
                "附件大小与元数据不一致: {}",
                attachment.filename
            )));
        }

        let staged_path = staging_dir.join(format!("attachment-{}.bin", index));
        let mut output =
            std::fs::File::create(&staged_path).map_err(|e| AppError::Io(e.to_string()))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; 64 * 1024];
        let mut size = 0_u64;
        loop {
            let read = entry
                .read(&mut buffer)
                .map_err(|e| AppError::Io(e.to_string()))?;
            if read == 0 {
                break;
            }
            output
                .write_all(&buffer[..read])
                .map_err(|e| AppError::Io(e.to_string()))?;
            hasher.update(&buffer[..read]);
            size += read as u64;
        }
        if size != attachment.file_size
            || format!("{:x}", hasher.finalize()) != attachment.sha256.to_lowercase()
        {
            return Err(AppError::Validation(format!(
                "附件校验失败: {}",
                attachment.filename
            )));
        }
        staged_paths.push(staged_path);
    }

    let mut installed = Vec::with_capacity(manifest.attachments.len());
    for (index, attachment) in manifest.attachments.iter().enumerate() {
        let target = resolve_safe_attachment_path(data_dir, &attachment.file_path)?;
        if target.exists() && !overwrite {
            continue;
        }

        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
        }

        let backup = if target.exists() {
            let backup = staging_dir.join(format!("backup-{}.bin", index));
            std::fs::rename(&target, &backup).map_err(|e| AppError::Io(e.to_string()))?;
            Some(backup)
        } else {
            None
        };

        if let Err(error) = std::fs::rename(&staged_paths[index], &target) {
            if let Some(backup_path) = &backup {
                let _ = std::fs::rename(backup_path, &target);
            }
            restore_installed_attachments(&installed);
            return Err(AppError::Io(error.to_string()));
        }
        installed.push(InstalledAttachment { target, backup });
    }

    Ok(installed)
}

pub fn export_data(db: &DbState) -> Result<String, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items = data_io_repository::query_items_json(&conn)?;

    let tags = data_io_repository::query_tags_json(&conn)?;

    let item_tags = data_io_repository::query_item_tags_json(&conn)?;

    let attachments = {
        let meta_rows = data_io_repository::query_attachments_meta(&conn)?;
        meta_rows
            .into_iter()
            .map(|row| {
                let relative_path: String =
                    row["file_path"].as_str().unwrap_or_default().to_string();
                let full_path = paths::quantanote_dir().join(&relative_path);
                let file_data = std::fs::read(&full_path).ok().map(|bytes| {
                    use base64::engine::general_purpose::STANDARD as BASE64;
                    use base64::Engine;
                    BASE64.encode(bytes)
                });
                let mut enriched = row.clone();
                enriched["file_data"] = serde_json::Value::String(file_data.unwrap_or_default());
                enriched
            })
            .collect::<Vec<_>>()
    };

    let versions = data_io_repository::query_versions_json(&conn)?;

    let data = ExportData {
        items,
        tags,
        item_tags,
        attachments,
        versions,
    };
    serde_json::to_string_pretty(&data).map_err(|e| AppError::Database(e.to_string()))
}

pub fn import_data(db: &DbState, json: String) -> Result<(), AppError> {
    let data: ExportData =
        serde_json::from_str(&json).map_err(|e| AppError::Validation(e.to_string()))?;
    if data.attachments.len() > MAX_ZIP_ENTRIES {
        return Err(AppError::Validation("JSON 附件数量超过限制".to_string()));
    }
    let mut conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    data_io_repository::import_items(&tx, &data.items, false)?;

    data_io_repository::import_tags(&tx, &data.tags, false)?;
    data_io_repository::import_item_tags(&tx, &data.item_tags)?;

    let data_dir = paths::quantanote_dir();
    let mut total_attachment_size = 0_u64;
    for attachment in &data.attachments {
        let id = attachment["id"].as_str().unwrap_or_default().to_string();
        let item_id = sanitize_path_component(attachment["item_id"].as_str().unwrap_or_default());
        let filename = attachment["filename"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let mut file_path = attachment["file_path"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        if id.is_empty() || item_id.is_empty() || filename.is_empty() {
            return Err(AppError::Validation("附件元数据不完整".to_string()));
        }
        if !file_path.is_empty() {
            let relative_path = validate_relative_path(&file_path, "attachments")?;
            let _ = resolve_safe_attachment_path(&data_dir, &file_path)?;
            file_path = relative_path.to_string_lossy().to_string();
        }

        if let Some(file_data) = attachment["file_data"].as_str() {
            use base64::engine::general_purpose::STANDARD as BASE64;
            use base64::Engine;

            if !file_data.is_empty() {
                if file_data.len() as u64 > MAX_ZIP_ENTRY_SIZE.saturating_mul(4) / 3 + 4 {
                    return Err(AppError::Validation(
                        "JSON 附件数据超过大小限制".to_string(),
                    ));
                }
                let bytes = BASE64
                    .decode(file_data)
                    .map_err(|e| AppError::Validation(format!("附件数据无效: {}", e)))?;
                let attachment_size = bytes.len() as u64;
                if attachment_size > MAX_ZIP_ENTRY_SIZE
                    || total_attachment_size.saturating_add(attachment_size) > MAX_ZIP_TOTAL_SIZE
                {
                    return Err(AppError::Validation("JSON 附件总大小超过限制".to_string()));
                }
                total_attachment_size += attachment_size;
                let relative_path =
                    std::path::PathBuf::from("attachments")
                        .join(&item_id)
                        .join(format!(
                            "{}-{}",
                            &id.chars().take(8).collect::<String>(),
                            safe_archive_filename(&filename)
                        ));
                let relative_path = relative_path.to_string_lossy().to_string();
                let dest_path = resolve_safe_attachment_path(&data_dir, &relative_path)?;
                std::fs::create_dir_all(
                    dest_path
                        .parent()
                        .ok_or_else(|| AppError::Validation("附件路径无效".to_string()))?,
                )
                .map_err(|e| AppError::Io(e.to_string()))?;
                std::fs::write(&dest_path, bytes).map_err(|e| AppError::Io(e.to_string()))?;
                file_path = relative_path;
            }
        }

        if file_path.is_empty() {
            return Err(AppError::Validation(format!(
                "附件缺少安全文件路径: {}",
                id
            )));
        }

        let mut att = attachment.clone();
        att["file_path"] = serde_json::Value::String(file_path);
        data_io_repository::import_attachment_record(&tx, &att)?;
    }

    data_io_repository::import_versions(&tx, &data.versions, false)?;

    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

pub fn save_to_file(path: String, content: String) -> Result<(), AppError> {
    let validated = resolve_user_path(&path)?;
    std::fs::write(&validated, content).map_err(|e| AppError::Io(e.to_string()))
}

pub fn read_from_file(path: String) -> Result<String, AppError> {
    let validated = resolve_user_path(&path)?;
    std::fs::read_to_string(&validated).map_err(|e| AppError::Io(e.to_string()))
}

fn calc_attachments_size(data_dir: &std::path::Path) -> u64 {
    let att_dir = data_dir.join("attachments");
    if !att_dir.exists() {
        return 0;
    }
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(&att_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(files) = std::fs::read_dir(&path) {
                    for file in files.flatten() {
                        if let Ok(meta) = file.metadata() {
                            total += meta.len();
                        }
                    }
                }
            }
        }
    }
    total
}

pub fn get_export_size_estimate(db: &DbState) -> Result<ExportSizeEstimate, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items = data_io_repository::query_items_json(&conn)?;
    let tags = data_io_repository::query_tags_json(&conn)?;
    let item_tags = data_io_repository::query_item_tags_json(&conn)?;

    let items_json = serde_json::to_string(&serde_json::json!({"items": items}))
        .map(|s| s.len() as u64)
        .unwrap_or(0);

    let tags_json =
        serde_json::to_string(&serde_json::json!({"tags": tags, "item_tags": item_tags}))
            .map(|s| s.len() as u64)
            .unwrap_or(0);

    let versions = data_io_repository::query_versions_json(&conn)?;
    let versions_json = serde_json::to_string(&versions)
        .map(|s| s.len() as u64)
        .unwrap_or(0);

    let attachments = calc_attachments_size(&paths::quantanote_dir());

    Ok(ExportSizeEstimate {
        items_json,
        tags_json,
        versions_json,
        attachments,
        total: items_json + tags_json + versions_json + attachments,
    })
}

pub fn export_data_zip(db: &DbState, path: &str, options: &ExportOptions) -> Result<(), AppError> {
    let dest = resolve_user_path(path)?;
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items = data_io_repository::query_items_json(&conn)?;
    let data_json = if options.include_tags {
        let tags = data_io_repository::query_tags_json(&conn)?;
        let item_tags = data_io_repository::query_item_tags_json(&conn)?;
        serde_json::to_string_pretty(&serde_json::json!({
            "items": items,
            "tags": tags,
            "item_tags": item_tags,
        }))
    } else {
        serde_json::to_string_pretty(&serde_json::json!({
            "items": items,
        }))
    }
    .map_err(|e| AppError::Database(e.to_string()))?;

    let versions_json = if options.include_versions {
        let versions = data_io_repository::query_versions_json(&conn)?;
        serde_json::to_string_pretty(&versions).ok()
    } else {
        None
    };
    let attachment_rows = if options.include_attachments {
        data_io_repository::query_attachments_meta(&conn)?
    } else {
        Vec::new()
    };

    drop(conn);

    let data_dir = paths::quantanote_dir();
    let attachment_manifest = build_zip_attachment_manifest(&attachment_rows, &data_dir)?;
    let manifest_json = serde_json::to_string_pretty(&ZipManifest {
        format: ZIP_FORMAT.to_string(),
        format_version: ZIP_FORMAT_VERSION,
        attachments: attachment_manifest.clone(),
    })
    .map_err(|e| AppError::Database(e.to_string()))?;

    let file = std::fs::File::create(&dest).map_err(|e| AppError::Io(e.to_string()))?;
    let mut zip = zip::ZipWriter::new(file);
    let zip_options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("data.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(data_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;

    if let Some(ref vjson) = versions_json {
        zip.start_file("versions.json", zip_options)
            .map_err(|e| AppError::Io(e.to_string()))?;
        zip.write_all(vjson.as_bytes())
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    zip.start_file("manifest.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;

    write_zip_attachment_files(&mut zip, &attachment_manifest, &data_dir, zip_options)?;

    zip.finish().map_err(|e| AppError::Io(e.to_string()))?;

    Ok(())
}

pub fn export_data_zip_to_default(
    db: &DbState,
    options: &ExportOptions,
) -> Result<String, AppError> {
    let exports_dir = paths::quantanote_dir().join("exports");
    std::fs::create_dir_all(&exports_dir).map_err(|e| AppError::Io(e.to_string()))?;
    let path = exports_dir.join(format!(
        "quantanote-backup-{}.zip",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    ));

    export_data_zip(db, &path.to_string_lossy(), options)?;
    Ok(path.to_string_lossy().to_string())
}

pub fn import_data_zip_bytes(
    db: &DbState,
    data: Vec<u8>,
    options: &ImportOptions,
) -> Result<(), AppError> {
    if data.is_empty() {
        return Err(AppError::Validation("ZIP 数据为空".to_string()));
    }

    let imports_dir = paths::quantanote_dir().join("imports");
    std::fs::create_dir_all(&imports_dir).map_err(|e| AppError::Io(e.to_string()))?;
    let path = imports_dir.join(format!(
        "quantanote-import-{}.zip",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    ));
    std::fs::write(&path, data).map_err(|e| AppError::Io(e.to_string()))?;

    import_data_zip(db, &path.to_string_lossy(), options)
}

pub fn import_data_zip(db: &DbState, path: &str, options: &ImportOptions) -> Result<(), AppError> {
    let src = resolve_user_path(path)?;
    let file = std::fs::File::open(&src).map_err(|e| AppError::Io(e.to_string()))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| AppError::Io(format!("打开 ZIP 失败: {}", e)))?;

    let entry_names = validate_zip_archive_entries(&mut archive)?;
    let data_json = String::from_utf8(read_zip_entry(&mut archive, "data.json")?)
        .map_err(|e| AppError::Validation(format!("data.json 编码无效: {}", e)))?;
    let data: serde_json::Value =
        serde_json::from_str(&data_json).map_err(|e| AppError::Validation(e.to_string()))?;

    let versions_json = if options.include_versions && entry_names.contains("versions.json") {
        Some(
            String::from_utf8(read_zip_entry(&mut archive, "versions.json")?)
                .map_err(|e| AppError::Validation(format!("versions.json 编码无效: {}", e)))?,
        )
    } else {
        None
    };

    let manifest = if entry_names.contains("manifest.json") {
        let bytes = read_zip_entry(&mut archive, "manifest.json")?;
        let manifest: ZipManifest = serde_json::from_slice(&bytes)
            .map_err(|e| AppError::Validation(format!("manifest.json 无效: {}", e)))?;
        validate_zip_manifest(&manifest, &entry_names)?;
        Some(manifest)
    } else {
        let has_attachment_files = entry_names
            .iter()
            .any(|name| name.starts_with("attachments/") && !name.ends_with('/'));
        if options.include_attachments && has_attachment_files {
            return Err(AppError::Validation(
                "旧版 ZIP 缺少附件清单，请使用新版导出文件".to_string(),
            ));
        }
        None
    };

    let data_dir = paths::quantanote_dir();
    let staging_dir = data_dir
        .join("imports")
        .join(format!(".quantanote-staging-{}", uuid::Uuid::new_v4()));
    let mut installed = Vec::new();
    let result = (|| {
        if options.include_attachments {
            if let Some(manifest) = &manifest {
                installed = stage_and_install_zip_attachments(
                    &mut archive,
                    manifest,
                    &data_dir,
                    options.overwrite,
                    &staging_dir,
                )?;
            }
        }

        let mut conn = db
            .conn
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(items) = data["items"].as_array() {
            data_io_repository::import_items(&tx, items, options.overwrite)?;
        }

        if options.include_tags {
            if let Some(tags) = data["tags"].as_array() {
                data_io_repository::import_tags(&tx, tags, options.overwrite)?;
            }
            if let Some(item_tags) = data["item_tags"].as_array() {
                data_io_repository::import_item_tags(&tx, item_tags)?;
            }
        }

        if let Some(ref vjson) = versions_json {
            let versions: Vec<serde_json::Value> =
                serde_json::from_str(vjson).map_err(|e| AppError::Validation(e.to_string()))?;
            data_io_repository::import_versions(&tx, &versions, options.overwrite)?;
        }

        if options.include_attachments {
            if let Some(manifest) = &manifest {
                for attachment in &manifest.attachments {
                    let mut record = serde_json::to_value(attachment)
                        .map_err(|e| AppError::Database(e.to_string()))?;
                    record["file_path"] = serde_json::Value::String(attachment.file_path.clone());
                    record["file_size"] = serde_json::Value::from(attachment.file_size);
                    data_io_repository::import_attachment_record(&tx, &record)?;
                }
            }
        }

        tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    })();

    if result.is_err() {
        restore_installed_attachments(&installed);
    } else {
        remove_attachment_backups(&installed);
    }
    let _ = std::fs::remove_dir_all(&staging_dir);
    result
}

pub fn create_backup_zip(db: &DbState, dest: &std::path::Path) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items = data_io_repository::query_items_json(&conn)?;
    let tags = data_io_repository::query_tags_json(&conn)?;
    let item_tags = data_io_repository::query_item_tags_json(&conn)?;
    let versions = data_io_repository::query_versions_json(&conn)?;
    let attachment_rows = data_io_repository::query_attachments_meta(&conn)?;

    let data_json = serde_json::to_string_pretty(&serde_json::json!({
        "items": items,
        "tags": tags,
        "item_tags": item_tags,
    }))
    .map_err(|e| AppError::Database(e.to_string()))?;

    let versions_json =
        serde_json::to_string_pretty(&versions).map_err(|e| AppError::Database(e.to_string()))?;

    drop(conn);

    let data_dir = paths::quantanote_dir();
    let attachment_manifest = build_zip_attachment_manifest(&attachment_rows, &data_dir)?;
    let manifest_json = serde_json::to_string_pretty(&ZipManifest {
        format: ZIP_FORMAT.to_string(),
        format_version: ZIP_FORMAT_VERSION,
        attachments: attachment_manifest.clone(),
    })
    .map_err(|e| AppError::Database(e.to_string()))?;

    let file = std::fs::File::create(dest).map_err(|e| AppError::Io(e.to_string()))?;
    let mut zip = zip::ZipWriter::new(file);
    let zip_options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("data.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(data_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;

    zip.start_file("versions.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(versions_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;

    zip.start_file("manifest.json", zip_options)
        .map_err(|e| AppError::Io(e.to_string()))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| AppError::Io(e.to_string()))?;
    write_zip_attachment_files(&mut zip, &attachment_manifest, &data_dir, zip_options)?;

    zip.finish().map_err(|e| AppError::Io(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_and_read_file_round_trip() {
        let dir = crate::test_support::unique_temp_dir("data-io");
        let _guard = crate::test_support::lock_test_data_dir(&dir);
        let file = dir.join("backup.json");

        save_to_file(
            file.to_string_lossy().to_string(),
            "{\"items\":[]}".to_string(),
        )
        .expect("save file");
        let content = read_from_file(file.to_string_lossy().to_string()).expect("read file");

        assert_eq!(content, "{\"items\":[]}");
    }

    #[test]
    fn read_missing_file_returns_io_error() {
        let dir = crate::test_support::unique_temp_dir("data-io-missing");
        let _guard = crate::test_support::lock_test_data_dir(&dir);
        let file = dir.join("missing.json");

        let error = read_from_file(file.to_string_lossy().to_string())
            .expect_err("missing file should fail");

        assert!(matches!(error, AppError::Io(_)));
    }

    #[test]
    fn save_and_read_file_outside_data_dir() {
        let data_dir = crate::test_support::unique_temp_dir("data-io-app-data");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let outside_dir = crate::test_support::unique_temp_dir("data-io-outside");
        let file = outside_dir.join("external.txt");

        save_to_file(file.to_string_lossy().to_string(), "external".to_string())
            .expect("save outside data dir");
        let content =
            read_from_file(file.to_string_lossy().to_string()).expect("read outside data dir");

        assert_eq!(content, "external");
    }

    #[test]
    fn export_and_import_data_round_trip_keeps_items_tags_and_versions() {
        let data_dir = crate::test_support::unique_temp_dir("data-io-round-trip");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let source = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &source,
            "导出导入".to_string(),
            "note".to_string(),
            Some("往返内容".to_string()),
        )
        .expect("create source item");
        crate::services::tag_service::set_item_tags(&source, &item.id, vec!["备份".to_string()])
            .expect("set source tags");
        crate::services::version_service::create_version(
            &source,
            &item.id,
            "第二版",
            "手动保存",
            Some("v2"),
            Some("说明"),
        )
        .expect("create version");

        let json = export_data(&source).expect("export data");
        let target = crate::test_support::test_db();
        import_data(&target, json).expect("import data");

        let imported =
            crate::services::item_service::get_item(&target, &item.id).expect("imported item");
        assert_eq!(imported.title, "导出导入");
        assert_eq!(imported.content, "往返内容");

        let tags = crate::services::tag_service::get_tags_for_item(&target, &item.id)
            .expect("imported tags");
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "备份");

        let versions = crate::services::version_service::get_versions(&target, &item.id)
            .expect("imported versions");
        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].name, "v2");

        let _ = std::fs::remove_dir_all(data_dir);
    }

    #[test]
    fn export_and_import_zip_round_trip_restores_attachment_record_and_file() {
        let data_dir = crate::test_support::unique_temp_dir("data-io-zip-attachment");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "ZIP 附件".to_string(),
            "note".to_string(),
            Some("带图片的内容".to_string()),
        )
        .expect("create item");
        let bytes = b"zip attachment bytes".to_vec();
        let attachment = crate::services::attachment_service::add_attachment_data(
            &db,
            item.id.clone(),
            "截图.png".to_string(),
            "image/png".to_string(),
            bytes.clone(),
        )
        .expect("create attachment");
        let zip_path =
            crate::test_support::unique_temp_dir("data-io-zip-output").join("export.zip");
        let options = ExportOptions {
            include_tags: true,
            include_attachments: true,
            include_versions: true,
        };

        export_data_zip(&db, &zip_path.to_string_lossy(), &options).expect("export zip");
        crate::services::attachment_service::delete_attachment(&db, &attachment.id)
            .expect("delete attachment before import");
        assert!(
            crate::services::attachment_service::get_attachments(&db, &item.id)
                .expect("list after delete")
                .is_empty()
        );

        let import_options = ImportOptions {
            include_tags: true,
            include_attachments: true,
            include_versions: true,
            overwrite: true,
        };
        import_data_zip(&db, &zip_path.to_string_lossy(), &import_options).expect("import zip");

        let imported = crate::services::attachment_service::get_attachments(&db, &item.id)
            .expect("list imported attachments");
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].id, attachment.id);
        assert_eq!(
            std::fs::read(&imported[0].file_path).expect("read imported attachment"),
            bytes
        );

        let _ = std::fs::remove_dir_all(data_dir);
        let _ = std::fs::remove_dir_all(zip_path.parent().expect("zip parent"));
    }

    #[test]
    fn import_zip_rejects_attachment_path_traversal() {
        let data_dir = crate::test_support::unique_temp_dir("data-io-zip-slip");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let zip_dir = crate::test_support::unique_temp_dir("data-io-zip-slip-input");
        let zip_path = zip_dir.join("malicious.zip");
        let outside_path = zip_dir.join("escape.txt");
        let file = std::fs::File::create(&zip_path).expect("create malicious zip");
        let mut zip = zip::ZipWriter::new(file);
        let zip_options = zip::write::SimpleFileOptions::default();
        zip.start_file("data.json", zip_options)
            .expect("write data entry");
        zip.write_all(br#"{"items":[]}"#).expect("write data");
        zip.start_file("attachments/../../escape.txt", zip_options)
            .expect("write malicious entry");
        zip.write_all(b"should not escape")
            .expect("write malicious data");
        zip.finish().expect("finish malicious zip");

        let options = ImportOptions {
            include_tags: false,
            include_attachments: true,
            include_versions: false,
            overwrite: false,
        };
        let error = import_data_zip(&db, &zip_path.to_string_lossy(), &options)
            .expect_err("path traversal should fail");

        assert!(matches!(error, AppError::Validation(_)));
        assert!(!outside_path.exists());

        let _ = std::fs::remove_dir_all(data_dir);
        let _ = std::fs::remove_dir_all(zip_dir);
    }

    #[test]
    fn import_json_rejects_attachment_path_traversal_without_committing_records() {
        let data_dir = crate::test_support::unique_temp_dir("data-io-json-slip");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let json = serde_json::json!({
            "items": [{
                "id": "item-safe",
                "title": "安全测试",
                "item_type": "note",
                "content": "内容",
                "summary": "",
                "pinned": false,
                "favorite": false,
                "encrypted": false,
                "created_at": "2026-08-29T00:00:00Z",
                "updated_at": "2026-08-29T00:00:00Z"
            }],
            "tags": [],
            "item_tags": [],
            "attachments": [{
                "id": "att-unsafe",
                "item_id": "item-safe",
                "filename": "escape.png",
                "file_path": "attachments/../../escape.png",
                "mime_type": "image/png",
                "file_size": 0,
                "created_at": "2026-08-29T00:00:00Z",
                "file_data": ""
            }],
            "versions": []
        });

        let error = import_data(&db, json.to_string()).expect_err("unsafe JSON path should fail");

        assert!(matches!(error, AppError::Validation(_)));
        assert!(crate::services::item_service::get_item(&db, "item-safe").is_err());
        let _ = std::fs::remove_dir_all(data_dir);
    }
}
