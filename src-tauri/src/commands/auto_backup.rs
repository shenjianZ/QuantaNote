use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::services::backup_service::{
    self, AutoBackupConfig, BackupFileInfo,
};

#[tauri::command]
pub fn get_auto_backup_config() -> Result<AutoBackupConfig, AppError> {
    Ok(backup_service::load_config())
}

#[tauri::command]
pub fn update_auto_backup_config(config: AutoBackupConfig) -> Result<(), AppError> {
    backup_service::save_config(&config)
}

#[tauri::command]
pub fn trigger_backup_now(db: State<'_, DbState>) -> Result<String, AppError> {
    backup_service::trigger_backup_now(&db)
}

#[tauri::command]
pub fn get_backup_dir_path() -> Result<String, AppError> {
    backup_service::get_backup_dir_path()
}

#[tauri::command]
pub fn list_backups() -> Result<Vec<BackupFileInfo>, AppError> {
    backup_service::list_backups()
}

#[tauri::command]
pub fn delete_backup(filename: String) -> Result<(), AppError> {
    backup_service::delete_backup(filename)
}
