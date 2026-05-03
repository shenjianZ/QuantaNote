use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::sync::*;
use crate::sync::state::SyncStateManager;
use crate::sync::transport::SyncTransport;
use crate::sync::SyncEngine;

/// 确保 config 中有 device_id，如果没有则生成一个
fn ensure_device_id(config: &mut SyncConfig) {
    if config.device_id.is_empty() {
        config.device_id = uuid::Uuid::new_v4().to_string();
    }
}

/// RAII guard，确保同步标记在函数退出时清除
struct SyncGuard<'a>(&'a AtomicBool);
impl Drop for SyncGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// 同步引擎状态，由 Tauri 管理
pub struct SyncEngineState {
    pub engine: Mutex<SyncEngine>,
    pub config: Mutex<SyncConfig>,
    /// 防止并发同步
    is_syncing: AtomicBool,
    /// manual 模式下待解决的冲突
    pub pending_conflicts: Mutex<Option<PendingSyncState>>,
}

impl SyncEngineState {
    pub fn new(engine: SyncEngine, config: SyncConfig) -> Self {
        Self {
            engine: Mutex::new(engine),
            config: Mutex::new(config),
            is_syncing: AtomicBool::new(false),
            pending_conflicts: Mutex::new(None),
        }
    }

    /// 获取或创建 transport（基于当前配置）
    pub fn get_transport(&self) -> Result<SyncTransport, AppError> {
        let config = self
            .config
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(SyncTransport::new(
            &config.server_url,
            &config.access_token,
            &config.refresh_token,
            &config.device_id,
        ))
    }
}

fn load_sync_config(db: &DbState) -> SyncConfig {
    let conn = match db.conn.lock() {
        Ok(c) => c,
        Err(_) => return SyncConfig::default(),
    };
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = 'quantanote-sync-config'",
        [],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(json_str) => serde_json::from_str(&json_str).unwrap_or_default(),
        Err(_) => SyncConfig::default(),
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

/// 初始化同步引擎（在 setup 中调用）
pub fn init_sync_engine(app: &AppHandle, db: &DbState) {
    let config = load_sync_config(db);
    let mut engine = SyncEngine::new(&config);
    engine.set_app_handle(app.clone());
    let state = SyncEngineState::new(engine, config);
    app.manage(state);
}

// ── Tauri Commands ──────────────────────────────────────────────

#[tauri::command]
pub fn get_sync_config(db: State<'_, DbState>) -> Result<SyncConfig, AppError> {
    Ok(load_sync_config(&db))
}

#[tauri::command]
pub fn save_sync_config_cmd(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    config: SyncConfig,
) -> Result<(), AppError> {
    save_sync_config(&db, &config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = config;
    }
    Ok(())
}

#[tauri::command]
pub fn get_sync_state(sync_state: State<'_, SyncEngineState>) -> Result<SyncState, AppError> {
    let engine = sync_state
        .engine
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(engine.state_manager().get_state())
}

#[tauri::command]
pub async fn trigger_sync(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
) -> Result<SyncResult, AppError> {
    // 防止并发同步
    if sync_state
        .is_syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(AppError::SyncError(
            "同步正在进行中，请稍后再试".to_string(),
        ));
    }

    // 确保同步结束后清除标记
    let _guard = SyncGuard(&sync_state.is_syncing);

    let config = {
        let mut cfg = sync_state
            .config
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        // 确保有 device_id
        ensure_device_id(&mut cfg);
        cfg.clone()
    };

    if !config.enabled {
        return Err(AppError::SyncError("同步未启用".to_string()));
    }

    if config.access_token.is_empty() {
        return Err(AppError::SyncError("未登录".to_string()));
    }

    // 获取 transport 和 state_manager 的克隆，然后释放 engine 锁
    let (transport, state_manager, _shared_config) = {
        let engine = sync_state
            .engine
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        // 使用共享 config 的 transport，回调和主流程共享同一份 config
        let shared_config = std::sync::Arc::new(std::sync::Mutex::new(config.clone()));
        let db_clone = db.inner().clone();
        let shared_cfg_clone = shared_config.clone();
        let transport = SyncTransport::new_with_callback(
            &config.server_url,
            &config.access_token,
            &config.refresh_token,
            &config.device_id,
            Box::new(move |new_access, new_refresh| {
                if let Ok(mut cfg) = shared_cfg_clone.lock() {
                    cfg.access_token = new_access;
                    cfg.refresh_token = new_refresh;
                    let _ = save_sync_config(&db_clone, &cfg);
                }
            }),
        );
        let sm = engine.state_manager().clone();
        (transport, sm, shared_config)
    };

    // 清除上次残留的进度状态
    state_manager.clear_progress();

    // 使用独立的 transport 执行同步（不持有 engine 锁）
    let sync_output = match run_sync_with_transport(&transport, &state_manager, &config, &db).await
    {
        Ok(r) => r,
        Err(e) => {
            state_manager.set_error(e.to_string());
            return Err(e);
        }
    };

    // 获取可能已刷新的 tokens（回调可能已更新了 shared_config）
    let (new_access, new_refresh) = transport.get_tokens().await;

    // manual 模式有冲突时：保存 pending 状态，不更新 last_sync_at
    if let Some(pending_state) = sync_output.pending_state {
        if let Ok(mut pending) = sync_state.pending_conflicts.lock() {
            *pending = Some(pending_state);
        }
        // 仍需更新 token
        let mut updated_config = config;
        updated_config.access_token = new_access;
        updated_config.refresh_token = new_refresh;
        save_sync_config(&db, &updated_config)?;
        if let Ok(mut cfg) = sync_state.config.lock() {
            *cfg = updated_config;
        }
        return Ok(sync_output.result);
    }

    // 更新配置（含 last_sync_at 等字段）
    let mut updated_config = config;
    updated_config.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    updated_config.last_snapshot_id = Some(sync_output.result.snapshot_id.clone());
    // 回调可能已更新了 token，以 transport 中的为准
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    Ok(sync_output.result)
}

/// 同步输出（包含结果和可选的待解决冲突状态）
struct SyncOutput {
    result: SyncResult,
    pending_state: Option<PendingSyncState>,
}

/// 使用独立的 transport 执行同步
async fn run_sync_with_transport(
    transport: &SyncTransport,
    state_manager: &SyncStateManager,
    config: &SyncConfig,
    db: &DbState,
) -> Result<SyncOutput, AppError> {
    use crate::sync::diff::{collect_local_records, compute_diff};
    use crate::sync::{load_baseline_map, save_baseline_map};

    state_manager.set_status(SyncStatus::Preparing);

    // 1. 获取服务端最新快照
    let remote_snapshot = transport.get_latest_snapshot().await?;

    // 2. 收集本地记录并计算哈希
    state_manager.set_progress("计算本地数据", 0, 1);
    let local_records = collect_local_records(db)?;

    // 3. 获取服务端记录元信息
    let remote_metas = if let Some(ref snapshot) = remote_snapshot {
        transport
            .get_snapshot_records(&snapshot.snapshot_id)
            .await?
    } else {
        Vec::new()
    };

    // 4. 加载基线映射（三方 diff 的关键）
    let baseline_map = load_baseline_map(db)?;

    // 5. 比对差异（三方 diff）
    state_manager.set_progress("比对差异", 0, 1);
    let diff_result = compute_diff(
        &local_records,
        &remote_metas,
        &baseline_map,
        &config.conflict_resolution,
    );

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
                conflict.record_id, conflict.table_name, conflict.resolution
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

    // 6. manual 模式：有冲突时立即返回，不执行 push/pull（避免提前产生副作用）
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
        state_manager.set_completed();
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

    // 7. 推送变更
    let mut pushed_records: Vec<PushedRecord> = Vec::new();
    if !diff_result.to_push.is_empty() {
        state_manager.set_status(SyncStatus::Pushing);
        let total = diff_result.to_push.len() as u32;
        state_manager.set_progress("推送记录", 0, total);

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

    // 8. 拉取变更并写入本地
    // 使用上次同步的快照 ID 作为 since_snapshot_id，而非刚获取的最新快照
    // 否则服务端发现 since == latest 会直接返回空
    if !diff_result.to_pull.is_empty() {
        state_manager.set_status(SyncStatus::Pulling);
        let total = diff_result.to_pull.len() as u32;
        state_manager.set_progress("拉取记录", 0, total);

        let pull_result = transport
            .pull_records(config.last_snapshot_id.as_deref())
            .await?;

        apply_pulled_records(&pull_result.records, db)?;
        result.pulled = pull_result.records.len() as u32;
    }

    // 9. 上传附件（使用 "pending" snapshot_id，commit 后服务端会移动到新快照）
    if config.sync_attachments {
        state_manager.set_status(SyncStatus::SyncingAttachments);
        sync_attachments_upload(transport, state_manager, &mut result, db).await?;
    }

    // 10. 收集附件元数据供 commit 使用
    let attachment_metas = if config.sync_attachments {
        collect_attachment_metas_for_commit(db)?
    } else {
        vec![]
    };

    // 11. 提交同步（服务端将 pending 文件移动到新 snapshot_id）
    state_manager.set_progress("提交同步", 0, 1);
    let commit_result = transport
        .commit_sync(pushed_records, attachment_metas, config.sync_attachments)
        .await?;
    result.snapshot_id = commit_result.snapshot_id;

    // 12. 下载本地缺少的附件
    if config.sync_attachments {
        let sid = result.snapshot_id.clone();
        sync_attachments_download(transport, &mut result, db, &sid).await?;
    }

    // 11. 保存基线映射（同步成功后，使用 pull 后的实际数据库状态）
    let final_records = collect_local_records(db)?;
    save_baseline_map(db, &final_records, &result.snapshot_id)?;

    state_manager.set_completed();
    Ok(SyncOutput {
        result,
        pending_state: None,
    })
}

/// 上传本地附件到服务端（在 commit 之前调用）
async fn sync_attachments_upload(
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

    // 上传服务端缺少的附件（使用 "pending" snapshot_id）
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

/// 下载服务端附件到本地（在 commit 之后调用）
async fn sync_attachments_download(
    transport: &SyncTransport,
    result: &mut SyncResult,
    db: &DbState,
    _snapshot_id: &str,
) -> Result<(), AppError> {
    use crate::sync::diff::compute_file_hash;
    use crate::utils::paths;

    let attachments = collect_local_attachments(db)?;
    let local_hashes: Vec<String> = attachments.iter().map(|a| a.1.clone()).collect();
    let diff = transport.diff_attachments(local_hashes).await?;

    // 下载本地缺少或损坏的附件
    for remote in &diff.remote_attachments {
        let local_info: Option<(String, bool)> = {
            let conn = db
                .conn
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            conn.query_row(
                "SELECT file_path FROM attachments WHERE id = ?1",
                rusqlite::params![remote.attachment_id],
                |row| {
                    let fp: String = row.get(0)?;
                    let full = paths::quantanote_dir().join(&fp);
                    Ok((fp, full.exists()))
                },
            )
            .ok()
        };

        let (target_path, has_local_row) = match &local_info {
            Some((file_path, true)) => {
                // 本地行存在且文件存在，比较 hash 判断是否损坏
                let full_path = paths::quantanote_dir().join(file_path);
                let local_data = std::fs::read(&full_path).unwrap_or_default();
                let local_hash = compute_file_hash(&local_data);
                if local_hash == remote.file_hash {
                    continue; // 文件完好，跳过
                }
                // hash 不匹配，需要重新下载
                (file_path.clone(), true)
            }
            Some((file_path, false)) => (file_path.clone(), true),
            None => (
                format!("attachments/{}/{}", remote.item_id, remote.filename),
                false,
            ),
        };

        let data = transport.download_attachment(&remote.attachment_id).await?;
        let downloaded_hash = compute_file_hash(&data);
        if downloaded_hash != remote.file_hash {
            return Err(AppError::SyncError(format!(
                "附件下载校验失败: attachment_id={}, expected={}, actual={}",
                remote.attachment_id, remote.file_hash, downloaded_hash
            )));
        }
        let full_path = paths::quantanote_dir().join(&target_path);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
        }
        std::fs::write(&full_path, &data).map_err(|e| AppError::Io(e.to_string()))?;

        if !has_local_row {
            let conn = db
                .conn
                .lock()
                .map_err(|e| AppError::Database(e.to_string()))?;
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
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
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
        result.attachments_downloaded += 1;
    }

    Ok(())
}

/// 收集附件元数据供 commit 时上报
fn collect_attachment_metas_for_commit(db: &DbState) -> Result<Vec<serde_json::Value>, AppError> {
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

fn collect_local_attachments(
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

/// 获取表的依赖优先级（数值小的先应用）
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

fn apply_pulled_records(records: &[SyncRecordPayload], db: &DbState) -> Result<(), AppError> {
    use crate::sync::{apply_attachment, apply_item, apply_item_tag, apply_tag, apply_version};

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| AppError::Database(format!("开始事务失败: {}", e)))?;

    // 按依赖顺序排序：items → tags → item_tags → versions → attachments
    let mut sorted_records: Vec<&SyncRecordPayload> = records.iter().collect();
    sorted_records.sort_by_key(|r| table_priority(&r.table_name));

    for record in sorted_records {
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

    Ok(())
}

#[tauri::command]
pub async fn sync_login(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    server_url: String,
    email: String,
    password: String,
) -> Result<SyncLoginResult, AppError> {
    let mut config = load_sync_config(&db);
    // 确保有 device_id（首次登录时生成）
    ensure_device_id(&mut config);

    let transport = SyncTransport::new(&server_url, "", "", &config.device_id);
    let login_result = transport.login(&email, &password).await?;

    config.enabled = true;
    config.server_url = server_url;
    config.access_token = login_result.access_token.clone();
    config.refresh_token = login_result.refresh_token.clone();
    config.user_id = login_result.user_id.clone();
    save_sync_config(&db, &config)?;

    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = config;
    }

    Ok(login_result)
}

#[tauri::command]
pub async fn sync_register(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    server_url: String,
    email: String,
    password: String,
) -> Result<SyncLoginResult, AppError> {
    let mut config = load_sync_config(&db);
    // 确保有 device_id（首次注册时生成）
    ensure_device_id(&mut config);

    let transport = SyncTransport::new(&server_url, "", "", &config.device_id);
    let register_result = transport.register(&email, &password).await?;

    config.enabled = true;
    config.server_url = server_url;
    config.access_token = register_result.access_token.clone();
    config.refresh_token = register_result.refresh_token.clone();
    config.user_id = register_result.user_id.clone();
    save_sync_config(&db, &config)?;

    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = config;
    }

    Ok(register_result)
}

#[tauri::command]
pub fn sync_logout(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
) -> Result<(), AppError> {
    let mut config = load_sync_config(&db);
    config.access_token = String::new();
    config.refresh_token = String::new();
    config.user_id = String::new();
    config.enabled = false;
    config.last_snapshot_id = None;
    save_sync_config(&db, &config)?;

    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = config;
    }

    Ok(())
}

#[tauri::command]
pub async fn sync_forgot_password(server_url: String, email: String) -> Result<String, AppError> {
    let transport = SyncTransport::new(&server_url, "", "", "");
    transport.forgot_password(&email).await
}

#[tauri::command]
pub async fn sync_reset_password(
    server_url: String,
    email: String,
    reset_token: String,
    new_password: String,
) -> Result<(), AppError> {
    let transport = SyncTransport::new(&server_url, "", "", "");
    transport
        .reset_password(&email, &reset_token, &new_password)
        .await
}

#[tauri::command]
pub async fn test_sync_connection(server_url: String) -> Result<bool, AppError> {
    let transport = SyncTransport::new(&server_url, "", "", "");
    transport.test_connection().await
}

#[tauri::command]
pub async fn get_sync_history(
    sync_state: State<'_, SyncEngineState>,
    page: u32,
    page_size: u32,
) -> Result<crate::sync::transport::PaginatedSyncHistory, AppError> {
    let transport = sync_state.get_transport()?;
    transport
        .get_sync_history(page.max(1), page_size.clamp(1, 100))
        .await
}

/// 获取待解决的冲突列表
#[tauri::command]
pub fn get_pending_conflicts(
    sync_state: State<'_, SyncEngineState>,
) -> Result<Option<Vec<ConflictInfo>>, AppError> {
    let pending = sync_state
        .pending_conflicts
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(pending.as_ref().map(|p| p.conflicts.clone()))
}

/// 解决手动冲突并完成同步
#[tauri::command]
pub async fn resolve_sync_conflicts(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    resolutions: Vec<ConflictResolutionChoice>,
) -> Result<SyncResult, AppError> {
    use crate::sync::diff::collect_local_records;
    use crate::sync::save_baseline_map;

    // 防止并发同步
    if sync_state
        .is_syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(AppError::SyncError(
            "同步正在进行中，请稍后再试".to_string(),
        ));
    }
    let _guard = SyncGuard(&sync_state.is_syncing);

    // 克隆 pending 状态（不立即 take），成功后再清空
    let pending = {
        let pending_lock = sync_state
            .pending_conflicts
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        pending_lock.clone()
    };
    let pending = pending.ok_or_else(|| AppError::SyncError("没有待解决的冲突".to_string()))?;

    let config = {
        let cfg = sync_state
            .config
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        cfg.clone()
    };

    // 构建冲突 map: (table_name, record_id) → ConflictInfo，避免跨表 record_id 碰撞。
    let conflict_map: std::collections::HashMap<(&str, &str), &ConflictInfo> = pending
        .conflicts
        .iter()
        .map(|c| ((c.table_name.as_str(), c.record_id.as_str()), c))
        .collect();

    let transport = sync_state.get_transport()?;

    let mut result = SyncResult {
        pushed: 0,
        pulled: 0,
        skipped: 0,
        conflicts: resolutions.len() as u32,
        pending_conflicts: None,
        attachments_uploaded: 0,
        attachments_downloaded: 0,
        snapshot_id: String::new(),
    };

    let mut all_pushed_records = pending.pushed_records.clone();

    // 先处理非冲突的待推送记录
    if !pending.to_push.is_empty() {
        let push_result = transport.push_records(pending.to_push.clone()).await?;
        for r in &pending.to_push {
            all_pushed_records.push(PushedRecord {
                record_id: r.record_id.clone(),
                table_name: r.table_name.clone(),
            });
        }
        result.pushed += push_result.accepted.len() as u32;
    }

    // 先处理非冲突的待拉取记录
    if !pending.to_pull.is_empty() {
        let pull_result = transport.pull_records(config.last_snapshot_id.as_deref()).await?;
        apply_pulled_records(&pull_result.records, &db)?;
        result.pulled += pull_result.records.len() as u32;
    }

    // 按用户选择处理每条冲突
    for resolution in &resolutions {
        let conflict = match conflict_map.get(&(
            resolution.table_name.as_str(),
            resolution.record_id.as_str(),
        )) {
            Some(c) => c,
            None => {
                return Err(AppError::SyncError(format!(
                    "待解决冲突不存在: {}:{}",
                    resolution.table_name, resolution.record_id
                )));
            }
        };

        match resolution.choice.as_str() {
            "local" => {
                // 推送本地记录到服务端
                let payload = crate::models::sync::SyncRecordPayload {
                    table_name: conflict.table_name.clone(),
                    record_id: conflict.record_id.clone(),
                    content_hash: conflict.content_hash.clone(),
                    updated_at: conflict.local_updated_at.clone(),
                    data: conflict.local_data.clone(),
                };
                transport.push_records(vec![payload]).await?;
                all_pushed_records.push(PushedRecord {
                    record_id: conflict.record_id.clone(),
                    table_name: conflict.table_name.clone(),
                });
                result.pushed += 1;
            }
            "remote" => {
                // 从服务端拉取该记录并 apply 到本地
                // 传 None 获取最新快照的所有记录（传 since==latest 会返回空）
                let pull_result = transport.pull_records(None).await?;
                // 只 apply 与当前冲突 record_id 匹配的记录
                let matching: Vec<_> = pull_result
                    .records
                    .into_iter()
                    .filter(|r| {
                        r.table_name == conflict.table_name && r.record_id == conflict.record_id
                    })
                    .collect();
                if matching.is_empty() {
                    return Err(AppError::SyncError(format!(
                        "远端冲突记录不存在: {}:{}",
                        conflict.table_name, conflict.record_id
                    )));
                }
                apply_pulled_records(&matching, &db)?;
                result.pulled += 1;
            }
            _ => {
                return Err(AppError::SyncError(format!(
                    "无效的解决选择: {}，必须为 'local' 或 'remote'",
                    resolution.choice
                )));
            }
        }
    }

    // 上传附件（在 commit 之前）
    if config.sync_attachments {
        let dummy_sm = SyncStateManager::new();
        sync_attachments_upload(&transport, &dummy_sm, &mut result, &db).await?;
    }

    // 收集附件元数据
    let attachment_metas = if config.sync_attachments {
        collect_attachment_metas_for_commit(&db)?
    } else {
        vec![]
    };

    // 提交同步
    let commit_result = transport
        .commit_sync(
            all_pushed_records,
            attachment_metas,
            config.sync_attachments,
        )
        .await?;
    result.snapshot_id = commit_result.snapshot_id;

    // 下载本地缺少的附件
    if config.sync_attachments {
        let sid = result.snapshot_id.clone();
        sync_attachments_download(&transport, &mut result, &db, &sid).await?;
    }

    // 保存基线
    let final_records = collect_local_records(&db)?;
    save_baseline_map(&db, &final_records, &result.snapshot_id)?;

    // 更新配置
    let (new_access, new_refresh) = transport.get_tokens().await;
    let mut updated_config = config;
    updated_config.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    updated_config.last_snapshot_id = Some(result.snapshot_id.clone());
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    // 成功后清空 pending 状态
    if let Ok(mut pending_lock) = sync_state.pending_conflicts.lock() {
        *pending_lock = None;
    }

    Ok(result)
}

/// 取消待解决的冲突同步
#[tauri::command]
pub fn cancel_sync_conflicts(sync_state: State<'_, SyncEngineState>) -> Result<(), AppError> {
    let mut pending = sync_state
        .pending_conflicts
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    *pending = None;
    Ok(())
}
