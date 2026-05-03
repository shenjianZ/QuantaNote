use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::sync::*;
use crate::sync::state::SyncStateManager;
use crate::sync::SyncEngine;
use crate::sync::transport::SyncTransport;

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
    /// 共享的 transport，用于异步命令（避免跨 await 持有 MutexGuard）
    pub transport: Mutex<Option<SyncTransport>>,
    /// 共享的状态管理器
    pub state_manager: Mutex<SyncStateManager>,
    /// 防止并发同步
    is_syncing: AtomicBool,
}

impl SyncEngineState {
    pub fn new(engine: SyncEngine, config: SyncConfig) -> Self {
        let state_manager = engine.state_manager().clone();
        Self {
            engine: Mutex::new(engine),
            config: Mutex::new(config),
            transport: Mutex::new(None),
            state_manager: Mutex::new(state_manager),
            is_syncing: AtomicBool::new(false),
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
pub fn get_sync_state(
    sync_state: State<'_, SyncEngineState>,
) -> Result<SyncState, AppError> {
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
    if sync_state.is_syncing.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err(AppError::SyncError("同步正在进行中，请稍后再试".to_string()));
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

    // 使用独立的 transport 执行同步（不持有 engine 锁）
    let result = run_sync_with_transport(&transport, &state_manager, &config, &db).await?;

    // 获取可能已刷新的 tokens（回调可能已更新了 shared_config）
    let (new_access, new_refresh) = transport.get_tokens().await;

    // 更新配置（含 last_sync_at 等字段）
    let mut updated_config = config;
    updated_config.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    updated_config.last_snapshot_id = Some(result.snapshot_id.clone());
    // 回调可能已更新了 token，以 transport 中的为准
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    Ok(result)
}

/// 使用独立的 transport 执行同步
async fn run_sync_with_transport(
    transport: &SyncTransport,
    state_manager: &SyncStateManager,
    config: &SyncConfig,
    db: &DbState,
) -> Result<SyncResult, AppError> {
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
    let mut pushed_record_ids: Vec<String> = Vec::new();
    if !diff_result.to_push.is_empty() {
        state_manager.set_status(SyncStatus::Pushing);
        let total = diff_result.to_push.len() as u32;
        state_manager.set_progress("推送记录", 0, total);

        pushed_record_ids = diff_result.to_push.iter().map(|r| r.record_id.clone()).collect();
        let push_result = transport.push_records(diff_result.to_push).await?;
        result.pushed = push_result.accepted.len() as u32;
    }

    // 7. 拉取变更并写入本地
    if !diff_result.to_pull.is_empty() {
        state_manager.set_status(SyncStatus::Pulling);
        let total = diff_result.to_pull.len() as u32;
        state_manager.set_progress("拉取记录", 0, total);

        let pull_result = transport
            .pull_records(
                remote_snapshot
                    .as_ref()
                    .map(|s| s.snapshot_id.as_str()),
            )
            .await?;

        apply_pulled_records(&pull_result.records, db)?;
        result.pulled = pull_result.records.len() as u32;
    }

    // 8. 同步附件
    if config.sync_attachments {
        state_manager.set_status(SyncStatus::SyncingAttachments);
        sync_attachments(transport, state_manager, &mut result, db).await?;
    }

    // 9. 提交同步
    state_manager.set_progress("提交同步", 0, 1);
    let commit_result = transport.commit_sync(pushed_record_ids, vec![]).await?;
    result.snapshot_id = commit_result.snapshot_id;

    // 10. 保存基线映射（同步成功后，使用 pull 后的实际数据库状态）
    let final_records = collect_local_records(db)?;
    save_baseline_map(db, &final_records, &result.snapshot_id)?;

    state_manager.set_completed();
    Ok(result)
}

async fn sync_attachments(
    transport: &SyncTransport,
    _state_manager: &SyncStateManager,
    result: &mut SyncResult,
    db: &DbState,
) -> Result<(), AppError> {
    use crate::utils::paths;

    let attachments = collect_local_attachments(db)?;
    let local_hashes: Vec<String> = attachments.iter().map(|a| a.1.clone()).collect();

    let diff = transport.diff_attachments(local_hashes).await?;

    // 构建本地 hash 集合，用于快速查找
    let local_hash_set: std::collections::HashSet<&str> =
        attachments.iter().map(|a| a.1.as_str()).collect();

    // 上传服务端缺少的附件（直接使用预读的文件数据）
    for (_path, hash, data, attachment_id, item_id, filename, mime_type) in &attachments {
        if diff.missing.contains(hash) {
            transport
                .upload_attachment(attachment_id, item_id, filename, mime_type, hash, "", data.clone())
                .await?;
            result.attachments_uploaded += 1;
        }
    }

    // 下载本地缺少的附件
    for remote in &diff.remote_attachments {
        if !local_hash_set.contains(remote.file_hash.as_str()) {
            // 查询本地附件记录（apply_pulled_records 可能已通过 apply_attachment 创建）
            let local_info: Option<(String, bool)> = {
                let conn = db.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
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

            let data = transport.download_attachment(&remote.attachment_id).await?;

            match local_info {
                Some((_file_path, file_exists)) if file_exists => {
                    // 记录存在且文件也在 → 跳过（理论上不会走到这里，hash 不同但文件存在）
                    continue;
                }
                Some((file_path, _)) => {
                    // 记录存在但文件丢失，重新下载到已有路径
                    let full_path = paths::quantanote_dir().join(&file_path);
                    if let Some(parent) = full_path.parent() {
                        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
                    }
                    std::fs::write(&full_path, &data).map_err(|e| AppError::Io(e.to_string()))?;
                    result.attachments_downloaded += 1;
                }
                None => {
                    // 本地无记录（apply_attachment 未覆盖到），创建记录并下载文件
                    let file_path_str = format!("attachments/{}/{}", remote.item_id, remote.filename);
                    let full_path = paths::quantanote_dir().join(&file_path_str);
                    if let Some(parent) = full_path.parent() {
                        std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
                    }
                    std::fs::write(&full_path, &data).map_err(|e| AppError::Io(e.to_string()))?;

                    // 创建本地附件记录
                    let conn = db.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
                    let now = chrono::Utc::now().to_rfc3339();
                    conn.execute(
                        "INSERT OR IGNORE INTO attachments (id, item_id, filename, file_path, mime_type, file_size, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![
                            remote.attachment_id,
                            remote.item_id,
                            remote.filename,
                            file_path_str,
                            remote.mime_type,
                            remote.file_size,
                            now
                        ],
                    ).map_err(|e| AppError::Database(e.to_string()))?;
                    result.attachments_downloaded += 1;
                }
            }
        }
    }

    Ok(())
}

fn collect_local_attachments(
    db: &DbState,
) -> Result<Vec<(std::path::PathBuf, String, Vec<u8>, String, String, String, String)>, AppError> {
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

fn apply_pulled_records(records: &[SyncRecordPayload], db: &DbState) -> Result<(), AppError> {
    use crate::sync::{apply_attachment, apply_item, apply_item_tag, apply_tag, apply_version};

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tx = conn.unchecked_transaction()
        .map_err(|e| AppError::Database(format!("开始事务失败: {}", e)))?;

    for record in records {
        let result = match record.table_name.as_str() {
            "items" => apply_item(&tx, &record.data),
            "tags" => apply_tag(&tx, &record.data),
            "item_tags" => apply_item_tag(&tx, &record.data),
            "versions" => apply_version(&tx, &record.data),
            "attachments" => apply_attachment(&tx, &record.data),
            _ => Ok(()),
        };
        if let Err(e) = result {
            tx.rollback().map_err(|re| AppError::Database(format!("回滚事务失败: {}", re)))?;
            return Err(e);
        }
    }

    tx.commit().map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;

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
pub async fn sync_forgot_password(
    server_url: String,
    email: String,
) -> Result<String, AppError> {
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
) -> Result<Vec<crate::sync::transport::SyncHistoryEntry>, AppError> {
    let transport = sync_state.get_transport()?;
    transport.get_sync_history().await
}
