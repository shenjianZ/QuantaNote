use crate::error::AppError;
use crate::services::storage_service::{self, StorageConsistencyReport};
use crate::utils::logging::{self, SqlLogConfig};

#[tauri::command]
pub fn get_sql_log_config() -> Result<SqlLogConfig, AppError> {
    Ok(logging::get_sql_log_config())
}

#[tauri::command]
pub fn update_sql_log_config(config: SqlLogConfig) -> Result<SqlLogConfig, AppError> {
    Ok(logging::update_sql_log_config(config))
}

#[tauri::command]
pub fn clear_sql_log() -> Result<(), AppError> {
    logging::clear_sql_log_file().map_err(|e| AppError::Io(e.to_string()))
}

#[tauri::command]
pub fn get_log_dir() -> Result<String, AppError> {
    Ok(logging::log_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_sql_log_path() -> Result<String, AppError> {
    Ok(logging::sql_log_path().to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_storage_consistency_report(
    db: tauri::State<'_, crate::db::DbState>,
) -> Result<StorageConsistencyReport, AppError> {
    storage_service::scan_storage_consistency(&db)
}

#[tauri::command]
pub fn repair_storage_consistency(
    db: tauri::State<'_, crate::db::DbState>,
) -> Result<StorageConsistencyReport, AppError> {
    storage_service::repair_storage_consistency(&db)
}
