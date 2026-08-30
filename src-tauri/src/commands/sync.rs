use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex as AsyncMutex;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::sync::*;
use crate::services::sync_service;
use crate::sync::state::SyncStateManager;
use crate::sync::transport::SyncTransport;

fn ensure_device_id(config: &mut SyncConfig) {
    if config.device_id.is_empty() {
        config.device_id = uuid::Uuid::new_v4().to_string();
    }
}

struct SyncGuard<'a>(&'a AtomicBool);
impl Drop for SyncGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub struct SyncEngineState {
    pub engine: Mutex<crate::sync::SyncEngine>,
    pub config: Arc<Mutex<SyncConfig>>,
    is_syncing: AtomicBool,
    /// 串行化会自动刷新 token 的同步请求，避免多个请求同时消费同一个 refresh_token。
    auth_request_lock: AsyncMutex<()>,
    pub pending_conflicts: Mutex<Option<PendingSyncState>>,
}

impl SyncEngineState {
    pub fn new(engine: crate::sync::SyncEngine, config: SyncConfig) -> Self {
        Self {
            engine: Mutex::new(engine),
            config: Arc::new(Mutex::new(config)),
            is_syncing: AtomicBool::new(false),
            auth_request_lock: AsyncMutex::new(()),
            pending_conflicts: Mutex::new(None),
        }
    }
}

pub fn init_sync_engine(app: &AppHandle, db: &DbState) {
    let config = sync_service::load_sync_config(db);
    let mut engine = crate::sync::SyncEngine::new(&config);
    engine.set_app_handle(app.clone());
    let queue = sync_service::load_sync_queue_status(db);
    let _ = engine.state_manager().set_queue_status(&queue);
    let state = SyncEngineState::new(engine, config);
    app.manage(state);
}

// ── Tauri Commands ──────────────────────────────────────────────

#[tauri::command]
pub fn get_sync_config(db: State<'_, DbState>) -> Result<SyncConfig, AppError> {
    Ok(sync_service::load_sync_config(&db))
}

#[tauri::command]
pub fn save_sync_config_cmd(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    config: SyncConfig,
) -> Result<(), AppError> {
    let mut config = config;
    if let Ok(current) = sync_state.config.lock() {
        // 前端只接收脱敏后的配置，保存偏好时沿用进程内凭据。
        if config.access_token.is_empty() {
            config.access_token = current.access_token.clone();
        }
        if config.refresh_token.is_empty() {
            config.refresh_token = current.refresh_token.clone();
        }
    }
    config.authenticated = !config.access_token.is_empty();
    sync_service::save_sync_config(&db, &config)?;
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
    Ok(engine.state_manager().get_state()?)
}

#[tauri::command]
pub async fn trigger_sync(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
) -> Result<SyncResult, AppError> {
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
    let _auth_guard = sync_state.auth_request_lock.lock().await;

    let config = {
        let mut cfg = sync_state
            .config
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        ensure_device_id(&mut cfg);
        cfg.clone()
    };

    if !config.enabled {
        return Err(AppError::SyncError("同步未启用".to_string()));
    }

    if config.access_token.is_empty() {
        return Err(AppError::SyncError("未登录".to_string()));
    }

    let queue = sync_service::load_sync_queue_status(&db);
    if queue.paused {
        let _ = sync_state
            .engine
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?
            .state_manager()
            .set_queue_status(&queue);
        return Err(AppError::SyncError("同步已暂停，请先继续同步".to_string()));
    }
    let queue = sync_service::enqueue_sync(&db)?;
    let _ = sync_state
        .engine
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?
        .state_manager()
        .set_queue_status(&queue);

    let state_cfg_clone = sync_state.config.clone();
    let (transport, state_manager, _shared_config) = {
        let engine = sync_state
            .engine
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let shared_config = Arc::new(Mutex::new(config.clone()));
        let db_clone = db.inner().clone();
        let shared_cfg_clone = shared_config.clone();
        let transport = SyncTransport::new_with_callback(
            &config.server_url,
            &config.access_token,
            &config.refresh_token,
            &config.device_id,
            Box::new(move |new_access, new_refresh| {
                if let Ok(mut cfg) = shared_cfg_clone.lock() {
                    cfg.access_token = new_access.clone();
                    cfg.refresh_token = new_refresh.clone();
                    let _ = sync_service::save_sync_config(&db_clone, &cfg);
                }
                // 同步更新 sync_state.config，确保后续 command 能拿到最新 token
                if let Ok(mut state_cfg) = state_cfg_clone.lock() {
                    state_cfg.access_token = new_access;
                    state_cfg.refresh_token = new_refresh;
                }
            }),
        );
        let sm = engine.state_manager().clone();
        (transport, sm, shared_config)
    };

    let _ = state_manager.clear_progress();

    let sync_output =
        match sync_service::run_sync_with_transport(&transport, &state_manager, &config, &db).await
        {
            Ok(r) => r,
            Err(e) => {
                let _ = state_manager.set_error(e.to_string());
                if let Ok(queue) = sync_service::record_sync_failure(&db, e.to_string()) {
                    let _ = state_manager.set_queue_status(&queue);
                }
                let (new_access, new_refresh) = transport.get_tokens().await;
                let mut updated_config = config;
                updated_config.access_token = new_access;
                updated_config.refresh_token = new_refresh;
                sync_service::save_sync_config(&db, &updated_config)?;
                if let Ok(mut cfg) = sync_state.config.lock() {
                    *cfg = updated_config;
                }
                return Err(e);
            }
        };

    let (new_access, new_refresh) = transport.get_tokens().await;

    if let Some(pending_state) = sync_output.pending_state {
        if let Ok(mut pending) = sync_state.pending_conflicts.lock() {
            *pending = Some(pending_state);
        }
        let mut updated_config = config;
        updated_config.access_token = new_access;
        updated_config.refresh_token = new_refresh;
        sync_service::save_sync_config(&db, &updated_config)?;
        if let Ok(mut cfg) = sync_state.config.lock() {
            *cfg = updated_config;
        }
        return Ok(sync_output.result);
    }

    let mut updated_config = config;
    updated_config.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    updated_config.last_snapshot_id = Some(sync_output.result.snapshot_id.clone());
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    sync_service::save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    if let Ok(queue) = sync_service::clear_sync_queue(&db) {
        let _ = state_manager.set_queue_status(&queue);
    }

    Ok(sync_output.result)
}

#[tauri::command]
pub fn get_sync_queue_status(db: State<'_, DbState>) -> Result<SyncQueueStatus, AppError> {
    Ok(sync_service::load_sync_queue_status(&db))
}

#[tauri::command]
pub fn pause_sync(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
) -> Result<SyncQueueStatus, AppError> {
    let queue = sync_service::set_sync_paused(&db, true)?;
    let engine = sync_state
        .engine
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    engine.state_manager().set_queue_status(&queue)?;
    Ok(queue)
}

#[tauri::command]
pub fn resume_sync(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
) -> Result<SyncQueueStatus, AppError> {
    let queue = sync_service::set_sync_paused(&db, false)?;
    let engine = sync_state
        .engine
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    engine.state_manager().set_queue_status(&queue)?;
    Ok(queue)
}

#[tauri::command]
pub async fn sync_login(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    server_url: String,
    email: String,
    password: String,
) -> Result<SyncLoginResult, AppError> {
    if password.len() < 8 {
        return Err(AppError::Validation("密码长度不能少于8位".to_string()));
    }
    let mut config = sync_service::load_sync_config(&db);
    ensure_device_id(&mut config);

    let transport = SyncTransport::new(&server_url, "", "", &config.device_id);
    let login_result = transport.login(&email, &password).await?;

    config.enabled = true;
    config.server_url = server_url;
    config.access_token = login_result.access_token.clone();
    config.refresh_token = login_result.refresh_token.clone();
    config.user_id = login_result.user_id.clone();
    config.authenticated = true;
    sync_service::save_sync_config(&db, &config)?;

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
    verify_code: Option<String>,
) -> Result<SyncLoginResult, AppError> {
    if password.len() < 8 {
        return Err(AppError::Validation("密码长度不能少于8位".to_string()));
    }
    let mut config = sync_service::load_sync_config(&db);
    ensure_device_id(&mut config);

    let transport = SyncTransport::new(&server_url, "", "", &config.device_id);
    let register_result = transport
        .register(&email, &password, verify_code.as_deref())
        .await?;

    config.enabled = true;
    config.server_url = server_url;
    config.access_token = register_result.access_token.clone();
    config.refresh_token = register_result.refresh_token.clone();
    config.user_id = register_result.user_id.clone();
    config.authenticated = true;
    sync_service::save_sync_config(&db, &config)?;

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
    let mut config = sync_service::load_sync_config(&db);
    sync_service::clear_sync_credentials(&config)?;
    config.access_token = String::new();
    config.refresh_token = String::new();
    config.user_id = String::new();
    config.enabled = false;
    config.authenticated = false;
    config.last_snapshot_id = None;
    sync_service::save_sync_config(&db, &config)?;
    let queue = sync_service::clear_sync_queue(&db)?;

    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = config;
    }
    if let Ok(engine) = sync_state.engine.lock() {
        let _ = engine.state_manager().set_queue_status(&queue);
    }

    Ok(())
}

#[tauri::command]
pub async fn sync_forgot_password(
    server_url: String,
    email: String,
    lang: String,
) -> Result<Option<String>, AppError> {
    let transport = SyncTransport::new(&server_url, "", "", "");
    transport.forgot_password(&email, &lang).await
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
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    page: u32,
    page_size: u32,
) -> Result<crate::sync::transport::PaginatedSyncHistory, AppError> {
    let _auth_guard = sync_state.auth_request_lock.lock().await;
    let config = {
        let cfg = sync_state
            .config
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        cfg.clone()
    };
    let shared_config = Arc::new(Mutex::new(config.clone()));
    let db_clone = db.inner().clone();
    let shared_cfg_clone = shared_config.clone();
    let state_cfg_clone = sync_state.config.clone();
    let transport = SyncTransport::new_with_callback(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
        Box::new(move |new_access, new_refresh| {
            if let Ok(mut cfg) = shared_cfg_clone.lock() {
                cfg.access_token = new_access.clone();
                cfg.refresh_token = new_refresh.clone();
                let _ = sync_service::save_sync_config(&db_clone, &cfg);
            }
            if let Ok(mut state_cfg) = state_cfg_clone.lock() {
                state_cfg.access_token = new_access;
                state_cfg.refresh_token = new_refresh;
            }
        }),
    );
    let result = transport
        .get_sync_history(page.max(1), page_size.clamp(1, 100))
        .await;

    let (new_access, new_refresh) = transport.get_tokens().await;
    let mut updated_config = config;
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    sync_service::save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    result
}

#[tauri::command]
pub async fn get_sync_devices(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
) -> Result<Vec<crate::sync::transport::DeviceSessionInfo>, AppError> {
    let _auth_guard = sync_state.auth_request_lock.lock().await;
    let config = {
        let cfg = sync_state
            .config
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        cfg.clone()
    };
    let shared_config = Arc::new(Mutex::new(config.clone()));
    let db_clone = db.inner().clone();
    let shared_cfg_clone = shared_config.clone();
    let state_cfg_clone = sync_state.config.clone();
    let transport = SyncTransport::new_with_callback(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
        Box::new(move |new_access, new_refresh| {
            if let Ok(mut cfg) = shared_cfg_clone.lock() {
                cfg.access_token = new_access.clone();
                cfg.refresh_token = new_refresh.clone();
                let _ = sync_service::save_sync_config(&db_clone, &cfg);
            }
            if let Ok(mut state_cfg) = state_cfg_clone.lock() {
                state_cfg.access_token = new_access;
                state_cfg.refresh_token = new_refresh;
            }
        }),
    );
    let result = transport.list_devices().await;

    let (new_access, new_refresh) = transport.get_tokens().await;
    let mut updated_config = config;
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    sync_service::save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    result
}

#[tauri::command]
pub async fn revoke_sync_device(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    device_id: String,
) -> Result<(), AppError> {
    let _auth_guard = sync_state.auth_request_lock.lock().await;
    let config = {
        let cfg = sync_state
            .config
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        cfg.clone()
    };
    let shared_config = Arc::new(Mutex::new(config.clone()));
    let db_clone = db.inner().clone();
    let shared_cfg_clone = shared_config.clone();
    let state_cfg_clone = sync_state.config.clone();
    let transport = SyncTransport::new_with_callback(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
        Box::new(move |new_access, new_refresh| {
            if let Ok(mut cfg) = shared_cfg_clone.lock() {
                cfg.access_token = new_access.clone();
                cfg.refresh_token = new_refresh.clone();
                let _ = sync_service::save_sync_config(&db_clone, &cfg);
            }
            if let Ok(mut state_cfg) = state_cfg_clone.lock() {
                state_cfg.access_token = new_access;
                state_cfg.refresh_token = new_refresh;
            }
        }),
    );
    let result = transport.revoke_device(&device_id).await;

    let (new_access, new_refresh) = transport.get_tokens().await;
    let mut updated_config = config;
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    sync_service::save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    result
}

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

#[tauri::command]
pub async fn resolve_sync_conflicts(
    db: State<'_, DbState>,
    sync_state: State<'_, SyncEngineState>,
    resolutions: Vec<ConflictResolutionChoice>,
) -> Result<SyncResult, AppError> {
    use crate::sync::diff::{collect_local_records, compute_record_hash};
    use crate::sync::save_baseline_map;

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
    let _auth_guard = sync_state.auth_request_lock.lock().await;

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

    let conflict_map: std::collections::HashMap<(&str, &str), &ConflictInfo> = pending
        .conflicts
        .iter()
        .map(|c| ((c.table_name.as_str(), c.record_id.as_str()), c))
        .collect();

    let shared_config = Arc::new(Mutex::new(config.clone()));
    let db_clone = db.inner().clone();
    let shared_cfg_clone = shared_config.clone();
    let state_cfg_clone = sync_state.config.clone();
    let transport = SyncTransport::new_with_callback(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
        Box::new(move |new_access, new_refresh| {
            if let Ok(mut cfg) = shared_cfg_clone.lock() {
                cfg.access_token = new_access.clone();
                cfg.refresh_token = new_refresh.clone();
                let _ = sync_service::save_sync_config(&db_clone, &cfg);
            }
            if let Ok(mut state_cfg) = state_cfg_clone.lock() {
                state_cfg.access_token = new_access;
                state_cfg.refresh_token = new_refresh;
            }
        }),
    );

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

    if !pending.to_pull.is_empty() {
        let pull_result = transport
            .pull_records(config.last_snapshot_id.as_deref())
            .await?;
        sync_service::apply_pulled_records(&pull_result.records, &db)?;
        result.pulled += pull_result.records.len() as u32;
    }

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
                let payload = SyncRecordPayload {
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
            "merged" => {
                let mut data = resolution.merged_data.clone().ok_or_else(|| {
                    AppError::SyncError(format!(
                        "冲突 {}:{} 缺少合并结果",
                        conflict.table_name, conflict.record_id
                    ))
                })?;
                validate_merged_record(&conflict.table_name, &conflict.record_id, &data)?;
                let updated_at = chrono::Utc::now().to_rfc3339();
                if matches!(conflict.table_name.as_str(), "items" | "tags" | "item_tags") {
                    if let Some(object) = data.as_object_mut() {
                        object.insert("updated_at".to_string(), serde_json::json!(updated_at));
                    }
                }
                let payload = SyncRecordPayload {
                    table_name: conflict.table_name.clone(),
                    record_id: conflict.record_id.clone(),
                    content_hash: compute_record_hash(&data),
                    updated_at,
                    data,
                };
                transport.push_records(vec![payload]).await?;
                all_pushed_records.push(PushedRecord {
                    record_id: conflict.record_id.clone(),
                    table_name: conflict.table_name.clone(),
                });
                result.pushed += 1;
            }
            "remote" => {
                let pull_result = transport.pull_records(None).await?;
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
                sync_service::apply_pulled_records(&matching, &db)?;
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

    let dummy_sm = SyncStateManager::new();
    if config.sync_attachments {
        sync_service::sync_attachments_upload(&transport, &dummy_sm, &mut result, &db).await?;
    }

    let attachment_metas = if config.sync_attachments {
        sync_service::collect_attachment_metas_for_commit(&db)?
    } else {
        vec![]
    };

    let commit_result = transport
        .commit_sync(
            all_pushed_records,
            attachment_metas,
            config.sync_attachments,
        )
        .await?;
    result.snapshot_id = commit_result.snapshot_id;

    if config.sync_attachments {
        let sid = result.snapshot_id.clone();
        sync_service::sync_attachments_download(&transport, &dummy_sm, &mut result, &db, &sid)
            .await?;
    }

    let final_records = collect_local_records(&db)?;
    save_baseline_map(&db, &final_records, &result.snapshot_id)?;

    let (new_access, new_refresh) = transport.get_tokens().await;
    let mut updated_config = config;
    updated_config.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    updated_config.last_snapshot_id = Some(result.snapshot_id.clone());
    updated_config.access_token = new_access;
    updated_config.refresh_token = new_refresh;
    sync_service::save_sync_config(&db, &updated_config)?;
    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = updated_config;
    }

    if let Ok(mut pending_lock) = sync_state.pending_conflicts.lock() {
        *pending_lock = None;
    }

    Ok(result)
}

fn validate_merged_record(
    table_name: &str,
    record_id: &str,
    data: &serde_json::Value,
) -> Result<(), AppError> {
    let object = data
        .as_object()
        .ok_or_else(|| AppError::Validation("合并结果必须是 JSON 对象".to_string()))?;
    if object.get("_deleted").and_then(|value| value.as_bool()) == Some(true) {
        return Err(AppError::Validation("合并结果不能是删除标记".to_string()));
    }

    let valid_identity = match table_name {
        "items" | "versions" | "attachments" => {
            object.get("id").and_then(|value| value.as_str()) == Some(record_id)
        }
        "tags" => object.get("uuid").and_then(|value| value.as_str()) == Some(record_id),
        "item_tags" => {
            let mut parts = record_id.splitn(2, '_');
            object.get("item_id").and_then(|value| value.as_str()) == parts.next()
                && object.get("tag_uuid").and_then(|value| value.as_str()) == parts.next()
        }
        _ => false,
    };
    if !valid_identity {
        return Err(AppError::Validation(format!(
            "合并结果的标识与冲突记录不一致: {}:{}",
            table_name, record_id
        )));
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_sync_conflicts(sync_state: State<'_, SyncEngineState>) -> Result<(), AppError> {
    let mut pending = sync_state
        .pending_conflicts
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    *pending = None;
    Ok(())
}

#[tauri::command]
pub async fn send_verify_code(
    server_url: String,
    email: String,
    lang: String,
) -> Result<(), AppError> {
    let transport = SyncTransport::new(&server_url, "", "", "default");
    transport.send_verify_code(&email, &lang).await
}
