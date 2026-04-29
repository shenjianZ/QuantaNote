use crate::models::sync::SyncResult;
use crate::services::sync_service;

#[tauri::command]
pub fn sync_now() -> SyncResult {
    sync_service::sync_now()
}
