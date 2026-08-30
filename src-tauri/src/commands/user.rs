use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::user::{ChangePasswordPayload, UpdateProfilePayload, UserProfile};
use crate::services::sync_service;
use crate::sync::transport::SyncTransport;

#[tauri::command]
pub async fn get_user_profile(db: State<'_, DbState>) -> Result<UserProfile, AppError> {
    let config = sync_service::load_sync_config(&db);

    if !config.enabled || config.access_token.is_empty() {
        return Err(AppError::Validation("Not logged in".to_string()));
    }

    let transport = SyncTransport::new(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
    );

    let profile = transport.get_profile().await?;

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "INSERT OR REPLACE INTO user_profile (id, email, nickname, avatar_url, bio, phone, address, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        rusqlite::params![
            profile.id,
            profile.email,
            profile.nickname,
            profile.avatar_url,
            profile.bio,
            profile.phone,
            profile.address,
        ],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    Ok(profile)
}

#[tauri::command]
pub async fn update_user_profile(
    db: State<'_, DbState>,
    updates: UpdateProfilePayload,
) -> Result<UserProfile, AppError> {
    let config = sync_service::load_sync_config(&db);

    if !config.enabled || config.access_token.is_empty() {
        return Err(AppError::Validation("Not logged in".to_string()));
    }

    let transport = SyncTransport::new(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
    );

    let profile = transport.update_profile(&updates).await?;

    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "INSERT OR REPLACE INTO user_profile (id, email, nickname, avatar_url, bio, phone, address, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        rusqlite::params![
            profile.id,
            profile.email,
            profile.nickname,
            profile.avatar_url,
            profile.bio,
            profile.phone,
            profile.address,
        ],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    Ok(profile)
}

#[tauri::command]
pub async fn change_password(
    db: State<'_, DbState>,
    payload: ChangePasswordPayload,
) -> Result<(), AppError> {
    if payload.new_password.len() < 8 {
        return Err(AppError::Validation("新密码长度不能少于8位".to_string()));
    }
    let config = sync_service::load_sync_config(&db);

    if !config.enabled || config.access_token.is_empty() {
        return Err(AppError::Validation("Not logged in".to_string()));
    }

    let transport = SyncTransport::new(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
    );

    transport
        .change_password(&payload.old_password, &payload.new_password)
        .await
}

#[tauri::command]
pub async fn upload_avatar(
    db: State<'_, DbState>,
    file_path: String,
) -> Result<UserProfile, AppError> {
    let config = sync_service::load_sync_config(&db);

    if !config.enabled || config.access_token.is_empty() {
        return Err(AppError::Validation("Not logged in".to_string()));
    }

    // 读取文件
    let data = std::fs::read(&file_path).map_err(|e| AppError::Io(e.to_string()))?;

    // 推断 MIME 类型
    let mime_type = match std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };

    let transport = SyncTransport::new(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
    );

    let profile = transport.upload_avatar(mime_type, data).await?;

    // 更新本地缓存
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "INSERT OR REPLACE INTO user_profile (id, email, nickname, avatar_url, bio, phone, address, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        rusqlite::params![
            profile.id,
            profile.email,
            profile.nickname,
            profile.avatar_url,
            profile.bio,
            profile.phone,
            profile.address,
        ],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    Ok(profile)
}

#[tauri::command]
pub async fn delete_account(
    db: State<'_, DbState>,
    sync_state: State<'_, crate::commands::sync::SyncEngineState>,
) -> Result<(), AppError> {
    let config = sync_service::load_sync_config(&db);

    if !config.enabled || config.access_token.is_empty() {
        return Err(AppError::Validation("Not logged in".to_string()));
    }

    let transport = SyncTransport::new(
        &config.server_url,
        &config.access_token,
        &config.refresh_token,
        &config.device_id,
    );

    transport.delete_account().await?;

    // 清除本地同步配置（等同于退出登录）
    let mut cleared = config;
    sync_service::clear_sync_credentials(&cleared)?;
    cleared.access_token = String::new();
    cleared.refresh_token = String::new();
    cleared.user_id = String::new();
    cleared.enabled = false;
    cleared.authenticated = false;
    cleared.last_snapshot_id = None;
    sync_service::save_sync_config(&db, &cleared)?;

    if let Ok(mut cfg) = sync_state.config.lock() {
        *cfg = cleared;
    }

    // 清除本地用户资料缓存
    if let Ok(conn) = db.conn.lock() {
        let _ = conn.execute("DELETE FROM user_profile", []);
    }

    Ok(())
}
