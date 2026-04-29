use crate::models::vault::UnlockResult;
use crate::services::vault_service;

#[tauri::command]
pub fn unlock_vault(password: String) -> UnlockResult {
    vault_service::unlock_vault(password)
}
