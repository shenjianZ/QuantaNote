pub mod diff;
pub mod state;
pub mod transport;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::sync::*;
use crate::sync::diff::{collect_local_records, compute_diff, compute_file_hash};
use crate::sync::state::SyncStateManager;
use crate::sync::transport::SyncTransport;
use crate::utils::paths;
use std::collections::HashMap;
use tauri::AppHandle;

/// 同步引擎，协调整个同步流程
pub struct SyncEngine {
    transport: SyncTransport,
    state_manager: SyncStateManager,
}

impl SyncEngine {
    pub fn new(config: &SyncConfig) -> Self {
        let transport = SyncTransport::new(
            &config.server_url,
            &config.access_token,
            &config.refresh_token,
            &config.device_id,
        );
        Self {
            transport,
            state_manager: SyncStateManager::new(),
        }
    }

    pub fn update_config(&mut self, config: &SyncConfig) {
        self.transport = SyncTransport::new(
            &config.server_url,
            &config.access_token,
            &config.refresh_token,
            &config.device_id,
        );
    }

    pub fn set_app_handle(&mut self, handle: AppHandle) {
        self.state_manager.set_app_handle(handle);
    }

    pub fn state_manager(&self) -> &SyncStateManager {
        &self.state_manager
    }

    pub fn transport(&self) -> &SyncTransport {
        &self.transport
    }

    /// 执行完整同步流程
    pub async fn run_sync(&self, config: &SyncConfig, db: &DbState) -> Result<SyncResult, AppError> {
        self.state_manager
            .set_status(SyncStatus::Preparing);

        // 1. 获取服务端最新快照
        let remote_snapshot = self.transport.get_latest_snapshot().await?;

        // 2. 收集本地记录并计算哈希
        self.state_manager.set_progress("计算本地数据", 0, 1);
        let local_records = collect_local_records(db)?;

        // 3. 获取服务端记录元信息
        let remote_metas = if let Some(ref snapshot) = remote_snapshot {
            self.transport
                .get_snapshot_records(&snapshot.snapshot_id)
                .await?
        } else {
            Vec::new()
        };

        // 4. 加载基线映射（三方 diff 的关键）
        let baseline_map = load_baseline_map(db)?;

        // 5. 比对差异（三方 diff）
        self.state_manager.set_progress("比对差异", 0, 1);
        let diff_result = compute_diff(&local_records, &remote_metas, &baseline_map, &config.conflict_resolution);

        // 记录冲突信息
        if !diff_result.conflicts.is_empty() {
            eprintln!(
                "[WARN] 检测到 {} 条冲突记录，策略: {}",
                diff_result.conflicts.len(),
                config.conflict_resolution
            );
            for conflict in &diff_result.conflicts {
                eprintln!(
                    "[INFO] 冲突: {} (表: {}) → {:?}",
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
            attachments_uploaded: 0,
            attachments_downloaded: 0,
            snapshot_id: String::new(),
        };

        // 6. 推送变更
        if !diff_result.to_push.is_empty() {
            self.state_manager.set_status(SyncStatus::Pushing);
            let total = diff_result.to_push.len() as u32;
            self.state_manager.set_progress("推送记录", 0, total);

            let push_result = self.transport.push_records(diff_result.to_push).await?;
            result.pushed = push_result.accepted.len() as u32;
        }

        // 7. 拉取变更并写入本地
        if !diff_result.to_pull.is_empty() {
            self.state_manager.set_status(SyncStatus::Pulling);
            let total = diff_result.to_pull.len() as u32;
            self.state_manager.set_progress("拉取记录", 0, total);

            let pull_result = self
                .transport
                .pull_records(
                    remote_snapshot
                        .as_ref()
                        .map(|s| s.snapshot_id.as_str()),
                )
                .await?;

            self.apply_pulled_records(&pull_result.records, db)?;
            result.pulled = pull_result.records.len() as u32;
        }

        // 8. 同步附件
        if config.sync_attachments {
            self.sync_attachments(&mut result, db).await?;
        }

        // 9. 提交同步
        self.state_manager.set_progress("提交同步", 0, 1);
        let commit_result = self.transport.commit_sync(vec![], vec![]).await?;
        result.snapshot_id = commit_result.snapshot_id;

        // 10. 保存基线映射（同步成功后）
        save_baseline_map(db, &local_records, &result.snapshot_id)?;

        self.state_manager.set_completed();
        Ok(result)
    }

    /// 同步附件
    async fn sync_attachments(&self, result: &mut SyncResult, db: &DbState) -> Result<(), AppError> {
        self.state_manager
            .set_status(SyncStatus::SyncingAttachments);

        let attachments = self.collect_local_attachments(db)?;
        let hashes: Vec<String> = attachments.iter().map(|a| a.1.clone()).collect();

        if hashes.is_empty() {
            return Ok(());
        }

        let diff = self.transport.diff_attachments(hashes).await?;

        for (path, hash, item_id, filename, mime_type) in &attachments {
            if diff.missing.contains(hash) {
                let data = std::fs::read(path).map_err(|e| AppError::Io(e.to_string()))?;
                let attachment_id = filename;
                self.transport
                    .upload_attachment(
                        attachment_id,
                        item_id,
                        filename,
                        mime_type,
                        hash,
                        "",
                        data,
                    )
                    .await?;
                result.attachments_uploaded += 1;
            }
        }

        Ok(())
    }

    fn collect_local_attachments(
        &self,
        db: &DbState,
    ) -> Result<Vec<(std::path::PathBuf, String, String, String, String)>, AppError> {
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
            let (_id, item_id, filename, file_path, mime_type) =
                row.map_err(|e| AppError::Database(e.to_string()))?;
            let full_path = paths::quantanote_dir().join(&file_path);
            if full_path.exists() {
                let data =
                    std::fs::read(&full_path).map_err(|e| AppError::Io(e.to_string()))?;
                let hash = compute_file_hash(&data);
                result.push((full_path, hash, item_id, filename, mime_type));
            }
        }

        Ok(result)
    }

    fn apply_pulled_records(&self, records: &[SyncRecordPayload], db: &DbState) -> Result<(), AppError> {
        let conn = db
            .conn
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;

        for record in records {
            match record.table_name.as_str() {
                "items" => apply_item(&conn, &record.data)?,
                "tags" => apply_tag(&conn, &record.data)?,
                "item_tags" => apply_item_tag(&conn, &record.data)?,
                "versions" => apply_version(&conn, &record.data)?,
                _ => {}
            }
        }

        Ok(())
    }
}

pub fn apply_item(
    conn: &rusqlite::Connection,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let id = data["id"].as_str().unwrap_or_default();
    let title = data["title"].as_str().unwrap_or_default();
    let item_type = data["item_type"].as_str().unwrap_or("note");
    let content = data["content"].as_str().unwrap_or_default();
    let summary = data["summary"].as_str().unwrap_or_default();
    let pinned = data["pinned"].as_bool().unwrap_or(false) as i32;
    let favorite = data["favorite"].as_bool().unwrap_or(false) as i32;
    let encrypted = data["encrypted"].as_bool().unwrap_or(false) as i32;
    let created_at = data["created_at"].as_str().unwrap_or_default();
    let updated_at = data["updated_at"].as_str().unwrap_or_default();

    conn.execute(
        "INSERT OR REPLACE INTO items (id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn apply_tag(
    conn: &rusqlite::Connection,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let id = data["id"].as_i64().unwrap_or_default();
    let name = data["name"].as_str().unwrap_or_default();
    let color = data["color"].as_str().unwrap_or_default();

    conn.execute(
        "INSERT OR REPLACE INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, name, color],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn apply_item_tag(
    conn: &rusqlite::Connection,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let item_id = data["item_id"].as_str().unwrap_or_default();
    let tag_id = data["tag_id"].as_i64().unwrap_or_default();

    conn.execute(
        "INSERT OR REPLACE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
        rusqlite::params![item_id, tag_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn apply_version(
    conn: &rusqlite::Connection,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let id = data["id"].as_str().unwrap_or_default();
    let item_id = data["item_id"].as_str().unwrap_or_default();
    let version_number = data["version_number"].as_i64().unwrap_or_default();
    let content = data["content"].as_str().unwrap_or_default();
    let change_summary = data["change_summary"].as_str().unwrap_or_default();
    let name = data["name"].as_str().unwrap_or_default();
    let description = data["description"].as_str().unwrap_or_default();
    let created_at = data["created_at"].as_str().unwrap_or_default();

    conn.execute(
        "INSERT OR REPLACE INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, item_id, version_number, content, change_summary, name, description, created_at],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

/// 加载基线映射（record_id → content_hash）
pub fn load_baseline_map(db: &DbState) -> Result<HashMap<String, String>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut stmt = conn
        .prepare("SELECT record_id, content_hash FROM sync_baseline")
        .map_err(|e| AppError::Database(e.to_string()))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut map = HashMap::new();
    for row in rows {
        let (id, hash) = row.map_err(|e| AppError::Database(e.to_string()))?;
        map.insert(id, hash);
    }
    Ok(map)
}

/// 保存基线映射（同步成功后调用）
pub fn save_baseline_map(
    db: &DbState,
    records: &[SyncRecordPayload],
    _snapshot_id: &str,
) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 清空旧基线
    conn.execute("DELETE FROM sync_baseline", [])
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 写入新基线
    let mut stmt = conn
        .prepare(
            "INSERT INTO sync_baseline (record_id, table_name, content_hash, synced_at) VALUES (?1, ?2, ?3, ?4)",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    for record in records {
        stmt.execute(rusqlite::params![
            record.record_id,
            record.table_name,
            record.content_hash,
            chrono::Utc::now().to_rfc3339()
        ])
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    Ok(())
}
