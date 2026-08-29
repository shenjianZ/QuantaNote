use crate::db::DbState;
use crate::error::AppError;
use crate::models::sync::*;
use crate::sync::state::SyncStateManager;
use crate::sync::transport::SyncTransport;

pub struct SyncOutput {
    pub result: SyncResult,
    pub pending_state: Option<PendingSyncState>,
}

fn sanitize_sync_component(value: &str, fallback: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_' | '.') {
                c
            } else {
                '_'
            }
        })
        .collect();
    if sanitized.is_empty() || sanitized == "." || sanitized == ".." {
        fallback.to_string()
    } else {
        sanitized
    }
}

pub fn load_sync_config(db: &DbState) -> SyncConfig {
    let conn = match db.conn.lock() {
        Ok(c) => c,
        Err(e) => {
            log::warn!("Failed to acquire DB lock for sync config: {}", e);
            return SyncConfig::default();
        }
    };
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = 'quantanote-sync-config'",
        [],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(json_str) => serde_json::from_str(&json_str).unwrap_or_else(|e| {
            log::warn!("Failed to parse sync config JSON: {}", e);
            SyncConfig::default()
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => SyncConfig::default(),
        Err(e) => {
            log::warn!("Failed to load sync config from DB: {}", e);
            SyncConfig::default()
        }
    }
}

pub fn save_sync_config(db: &DbState, config: &SyncConfig) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let json = serde_json::to_string(config).map_err(|e| AppError::Io(e.to_string()))?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('quantanote-sync-config', ?1)",
        rusqlite::params![json],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

pub async fn run_sync_with_transport(
    transport: &SyncTransport,
    state_manager: &SyncStateManager,
    config: &SyncConfig,
    db: &DbState,
) -> Result<SyncOutput, AppError> {
    use crate::sync::diff::{collect_local_records, compute_diff};
    use crate::sync::{load_baseline_map, save_baseline_map};

    let _ = state_manager.set_status(SyncStatus::Preparing);

    let remote_snapshot = transport.get_latest_snapshot().await?;

    let _ = state_manager.set_progress("计算本地数据", 0, 1);
    let local_records = collect_local_records(db)?;

    let remote_metas = if let Some(ref snapshot) = remote_snapshot {
        transport
            .get_snapshot_records(&snapshot.snapshot_id)
            .await?
    } else {
        Vec::new()
    };

    let baseline_map = load_baseline_map(db)?;

    let _ = state_manager.set_progress("比对差异", 0, 1);
    let diff_result = compute_diff(
        &local_records,
        &remote_metas,
        &baseline_map,
        &config.conflict_resolution,
    );

    if !diff_result.conflicts.is_empty() {
        log::warn!(
            "检测到 {} 条冲突记录，策略: {}",
            diff_result.conflicts.len(),
            config.conflict_resolution
        );
        for conflict in &diff_result.conflicts {
            log::info!(
                "冲突: {} (表: {}) → {:?}",
                conflict.record_id,
                conflict.table_name,
                conflict.resolution
            );
        }
    }

    let mut result = SyncResult {
        pushed: 0,
        pulled: 0,
        skipped: diff_result.unchanged,
        conflicts: diff_result.conflicts.len() as u32,
        pending_conflicts: None,
        attachments_uploaded: 0,
        attachments_downloaded: 0,
        snapshot_id: String::new(),
    };

    if config.conflict_resolution == "manual" && !diff_result.conflicts.is_empty() {
        let conflict_infos: Vec<ConflictInfo> = diff_result
            .conflicts
            .iter()
            .map(|c| ConflictInfo {
                record_id: c.record_id.clone(),
                table_name: c.table_name.clone(),
                local_data: c.local_record.data.clone(),
                local_updated_at: c.local_record.updated_at.clone(),
                remote_updated_at: c.remote_meta.updated_at.clone(),
                content_hash: c.local_record.content_hash.clone(),
            })
            .collect();

        result.pending_conflicts = Some(conflict_infos.clone());
        result.skipped = diff_result.unchanged;
        let _ = state_manager.set_completed();
        return Ok(SyncOutput {
            result,
            pending_state: Some(PendingSyncState {
                pushed_records: Vec::new(),
                conflicts: conflict_infos,
                to_push: diff_result.to_push,
                to_pull: diff_result.to_pull,
            }),
        });
    }

    let mut pushed_records: Vec<PushedRecord> = Vec::new();
    if !diff_result.to_push.is_empty() {
        let _ = state_manager.set_status(SyncStatus::Pushing);
        let total = diff_result.to_push.len() as u32;
        let _ = state_manager.set_progress("推送记录", 0, total);

        pushed_records = diff_result
            .to_push
            .iter()
            .map(|r| PushedRecord {
                record_id: r.record_id.clone(),
                table_name: r.table_name.clone(),
            })
            .collect();
        let push_result = transport.push_records(diff_result.to_push).await?;
        result.pushed = push_result.accepted.len() as u32;
    }

    if !diff_result.to_pull.is_empty() {
        let _ = state_manager.set_status(SyncStatus::Pulling);
        let total = diff_result.to_pull.len() as u32;
        let _ = state_manager.set_progress("拉取记录", 0, total);

        let pull_result = transport
            .pull_records(config.last_snapshot_id.as_deref())
            .await?;

        apply_pulled_records(&pull_result.records, db)?;
        result.pulled = pull_result.records.len() as u32;
    }

    if config.sync_attachments {
        let _ = state_manager.set_status(SyncStatus::SyncingAttachments);
        sync_attachments_upload(transport, state_manager, &mut result, db).await?;
    }

    let attachment_metas = if config.sync_attachments {
        collect_attachment_metas_for_commit(db)?
    } else {
        vec![]
    };

    let _ = state_manager.set_progress("提交同步", 0, 1);
    let commit_result = transport
        .commit_sync(pushed_records, attachment_metas, config.sync_attachments)
        .await?;
    result.snapshot_id = commit_result.snapshot_id;

    if config.sync_attachments {
        let sid = result.snapshot_id.clone();
        sync_attachments_download(transport, &mut result, db, &sid).await?;
    }

    let final_records = collect_local_records(db)?;
    save_baseline_map(db, &final_records, &result.snapshot_id)?;

    let _ = state_manager.set_completed();
    Ok(SyncOutput {
        result,
        pending_state: None,
    })
}

pub async fn sync_attachments_upload(
    transport: &SyncTransport,
    _state_manager: &SyncStateManager,
    result: &mut SyncResult,
    db: &DbState,
) -> Result<(), AppError> {
    let attachments = collect_local_attachments(db)?;
    let local_hashes: Vec<String> = attachments.iter().map(|a| a.1.clone()).collect();

    let diff = transport.diff_attachments(local_hashes).await?;
    let remote_attachment_ids: std::collections::HashSet<&str> = diff
        .remote_attachments
        .iter()
        .map(|a| a.attachment_id.as_str())
        .collect();

    for (_path, hash, data, attachment_id, item_id, filename, mime_type) in &attachments {
        if diff.missing.contains(hash) || !remote_attachment_ids.contains(attachment_id.as_str()) {
            let file_size = data.len() as i64;
            transport
                .upload_attachment(
                    attachment_id,
                    item_id,
                    filename,
                    mime_type,
                    hash,
                    file_size,
                    "pending",
                    data.clone(),
                )
                .await?;
            result.attachments_uploaded += 1;
        }
    }

    Ok(())
}

pub async fn sync_attachments_download(
    transport: &SyncTransport,
    result: &mut SyncResult,
    db: &DbState,
    _snapshot_id: &str,
) -> Result<(), AppError> {
    use crate::repositories::attachment_repository;
    use crate::services::data_io_service::resolve_safe_attachment_path;
    use crate::sync::diff::compute_file_hash;
    use crate::utils::paths;

    let attachments = collect_local_attachments(db)?;
    let local_hashes: Vec<String> = attachments.iter().map(|a| a.1.clone()).collect();
    let diff = transport.diff_attachments(local_hashes).await?;

    for remote in &diff.remote_attachments {
        let local_info: Option<(String, bool)> = {
            let conn = db
                .conn
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            let existing_path: Option<String> = conn
                .query_row(
                    "SELECT file_path FROM attachments WHERE id = ?1",
                    rusqlite::params![remote.attachment_id],
                    |row| row.get(0),
                )
                .ok();
            match existing_path {
                Some(file_path) => {
                    let full_path =
                        resolve_safe_attachment_path(&paths::quantanote_dir(), &file_path)?;
                    Some((file_path, full_path.exists()))
                }
                None => None,
            }
        };

        let (target_path, has_local_row) = match &local_info {
            Some((file_path, true)) => {
                let full_path = resolve_safe_attachment_path(&paths::quantanote_dir(), file_path)?;
                let local_data = std::fs::read(&full_path).unwrap_or_default();
                let local_hash = compute_file_hash(&local_data);
                if local_hash == remote.file_hash {
                    continue;
                }
                (file_path.clone(), true)
            }
            Some((file_path, false)) => (file_path.clone(), true),
            None => (
                format!(
                    "attachments/{}/{}-{}",
                    sanitize_sync_component(&remote.item_id, "unknown-item"),
                    sanitize_sync_component(&remote.attachment_id, "attachment"),
                    sanitize_sync_component(&remote.filename, "attachment.bin")
                ),
                false,
            ),
        };

        let data = transport.download_attachment(&remote.attachment_id).await?;
        if remote.file_size < 0
            || remote.file_size as u64 > 512 * 1024 * 1024
            || remote.file_size as usize != data.len()
        {
            return Err(AppError::SyncError(format!(
                "附件大小校验失败: attachment_id={}, expected={}, actual={}",
                remote.attachment_id,
                remote.file_size,
                data.len()
            )));
        }
        let downloaded_hash = compute_file_hash(&data);
        if downloaded_hash != remote.file_hash {
            return Err(AppError::SyncError(format!(
                "附件下载校验失败: attachment_id={}, expected={}, actual={}",
                remote.attachment_id, remote.file_hash, downloaded_hash
            )));
        }
        let full_path = resolve_safe_attachment_path(&paths::quantanote_dir(), &target_path)?;
        attachment_repository::write_file_atomically(&full_path, &data)?;

        if !has_local_row {
            let conn = db.conn.lock().map_err(|e| {
                let _ = std::fs::remove_file(&full_path);
                AppError::Database(e.to_string())
            })?;
            let now = chrono::Utc::now().to_rfc3339();
            if let Err(error) = conn.execute(
                "INSERT OR IGNORE INTO attachments (id, item_id, filename, file_path, mime_type, file_size, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    remote.attachment_id,
                    remote.item_id,
                    remote.filename,
                    target_path,
                    remote.mime_type,
                    remote.file_size,
                    now
                ],
            ) {
                let _ = std::fs::remove_file(&full_path);
                return Err(AppError::Database(error.to_string()));
            }
        }
        result.attachments_downloaded += 1;
    }

    Ok(())
}

pub fn collect_attachment_metas_for_commit(
    db: &DbState,
) -> Result<Vec<serde_json::Value>, AppError> {
    use crate::sync::diff::compute_file_hash;
    use crate::utils::paths;

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT id, item_id, filename, file_path, mime_type, file_size FROM attachments")
        .map_err(|e| AppError::Database(e.to_string()))?;
    let rows = stmt
        .query_map([], |row| {
            let file_path: String = row.get(3)?;
            let full_path = paths::quantanote_dir().join(&file_path);
            let file_hash = if full_path.exists() {
                std::fs::read(full_path)
                    .map(|data| compute_file_hash(&data))
                    .unwrap_or_default()
            } else {
                String::new()
            };
            Ok(serde_json::json!({
                "attachment_id": row.get::<_, String>(0)?,
                "item_id": row.get::<_, String>(1)?,
                "filename": row.get::<_, String>(2)?,
                "mime_type": row.get::<_, String>(4)?,
                "file_size": row.get::<_, i64>(5)?,
                "file_hash": file_hash,
                "storage_key": "",
            }))
        })
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| AppError::Database(e.to_string()))?);
    }
    Ok(result)
}

pub fn collect_local_attachments(
    db: &DbState,
) -> Result<
    Vec<(
        std::path::PathBuf,
        String,
        Vec<u8>,
        String,
        String,
        String,
        String,
    )>,
    AppError,
> {
    use crate::sync::diff::compute_file_hash;
    use crate::utils::paths;

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut stmt = conn
        .prepare("SELECT id, item_id, filename, file_path, mime_type FROM attachments")
        .map_err(|e| AppError::Database(e.to_string()))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut result = Vec::new();
    for row in rows {
        let (id, item_id, filename, file_path, mime_type) =
            row.map_err(|e| AppError::Database(e.to_string()))?;
        let full_path = paths::quantanote_dir().join(&file_path);
        if full_path.exists() {
            let data = std::fs::read(&full_path).map_err(|e| AppError::Io(e.to_string()))?;
            let hash = compute_file_hash(&data);
            result.push((full_path, hash, data, id, item_id, filename, mime_type));
        }
    }

    Ok(result)
}

pub fn apply_pulled_records(records: &[SyncRecordPayload], db: &DbState) -> Result<(), AppError> {
    use crate::repositories::attachment_repository;
    use crate::sync::{apply_attachment, apply_item, apply_item_tag, apply_tag, apply_version};

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| AppError::Database(format!("开始事务失败: {}", e)))?;

    let mut sorted_records: Vec<&SyncRecordPayload> = records.iter().collect();
    sorted_records.sort_by_key(|r| table_priority(&r.table_name));
    let mut attachment_cleanup_paths = Vec::new();

    for record in sorted_records {
        if record.data["_deleted"].as_bool().unwrap_or(false) {
            match record.table_name.as_str() {
                "items" => {
                    let item_id = record.data["id"].as_str().unwrap_or_default();
                    let mut stmt = tx
                        .prepare("SELECT file_path FROM attachments WHERE item_id = ?1")
                        .map_err(|e| AppError::Database(e.to_string()))?;
                    let paths = stmt
                        .query_map(rusqlite::params![item_id], |row| row.get::<_, String>(0))
                        .map_err(|e| AppError::Database(e.to_string()))?
                        .collect::<Result<Vec<_>, _>>()
                        .map_err(|e| AppError::Database(e.to_string()))?;
                    attachment_cleanup_paths.extend(paths);
                }
                "attachments" => {
                    let attachment_id = record.data["id"].as_str().unwrap_or_default();
                    if let Ok(file_path) = tx.query_row(
                        "SELECT file_path FROM attachments WHERE id = ?1",
                        rusqlite::params![attachment_id],
                        |row| row.get::<_, String>(0),
                    ) {
                        attachment_cleanup_paths.push(file_path);
                    }
                }
                _ => {}
            }
        }

        let result = match record.table_name.as_str() {
            "items" => apply_item(&tx, &record.data),
            "tags" => apply_tag(&tx, &record.data),
            "item_tags" => apply_item_tag(&tx, &record.data),
            "versions" => apply_version(&tx, &record.data),
            "attachments" => apply_attachment(&tx, &record.data),
            _ => Ok(()),
        };
        if let Err(e) = result {
            tx.rollback()
                .map_err(|re| AppError::Database(format!("回滚事务失败: {}", re)))?;
            return Err(e);
        }
    }

    tx.commit()
        .map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;
    drop(conn);

    attachment_repository::cleanup_file_paths(&attachment_cleanup_paths)?;

    Ok(())
}

fn table_priority(table_name: &str) -> u8 {
    match table_name {
        "items" => 0,
        "tags" => 1,
        "item_tags" => 2,
        "versions" => 3,
        "attachments" => 4,
        _ => 5,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::sync::SyncRecordPayload;
    use crate::repositories::{attachment_repository, item_repository};

    fn deleted_record(
        table_name: &str,
        record_id: &str,
        data: serde_json::Value,
    ) -> SyncRecordPayload {
        SyncRecordPayload {
            table_name: table_name.to_string(),
            record_id: record_id.to_string(),
            content_hash: String::new(),
            updated_at: "2026-08-29T00:00:00Z".to_string(),
            data,
        }
    }

    #[test]
    fn pulled_item_deletion_removes_attachment_files_after_transaction_commit() {
        let data_dir = crate::test_support::unique_temp_dir("sync-delete-item-attachments");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let item = item_repository::create(
            &db,
            crate::models::item::CreateItemPayload {
                title: "同步删除笔记".to_string(),
                item_type: "note".to_string(),
                content: None,
                summary: String::new(),
            },
        )
        .expect("create item");
        let attachment = attachment_repository::add_bytes(
            &db,
            item.id.clone(),
            "image.png".to_string(),
            "image/png".to_string(),
            vec![1, 2, 3],
        )
        .expect("add attachment");

        apply_pulled_records(
            &[deleted_record(
                "items",
                &item.id,
                serde_json::json!({
                    "id": item.id,
                    "_deleted": true,
                    "deleted_at": "2026-08-29T00:00:00Z"
                }),
            )],
            &db,
        )
        .expect("apply deleted item");

        assert!(!std::path::Path::new(&attachment.file_path).exists());
        assert!(item_repository::get_item(&db, &item.id).is_err());
        let _ = std::fs::remove_dir_all(data_dir);
    }

    #[test]
    fn pulled_attachment_deletion_removes_attachment_file_after_transaction_commit() {
        let data_dir = crate::test_support::unique_temp_dir("sync-delete-attachment");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let item = item_repository::create(
            &db,
            crate::models::item::CreateItemPayload {
                title: "同步删除附件".to_string(),
                item_type: "note".to_string(),
                content: None,
                summary: String::new(),
            },
        )
        .expect("create item");
        let attachment = attachment_repository::add_bytes(
            &db,
            item.id.clone(),
            "image.png".to_string(),
            "image/png".to_string(),
            vec![4, 5, 6],
        )
        .expect("add attachment");

        apply_pulled_records(
            &[deleted_record(
                "attachments",
                &attachment.id,
                serde_json::json!({
                    "id": attachment.id,
                    "_deleted": true,
                    "deleted_at": "2026-08-29T00:00:00Z"
                }),
            )],
            &db,
        )
        .expect("apply deleted attachment");

        assert!(!std::path::Path::new(&attachment.file_path).exists());
        assert!(attachment_repository::get_by_item(&db, &item.id)
            .expect("list attachments")
            .is_empty());
        let _ = std::fs::remove_dir_all(data_dir);
    }
}
