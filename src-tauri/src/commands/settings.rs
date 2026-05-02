use std::collections::HashMap;

use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::services::settings_service;

#[tauri::command]
pub fn load_all_settings(db: State<'_, DbState>) -> Result<HashMap<String, String>, AppError> {
    settings_service::load_all_settings(&db)
}

#[tauri::command]
pub fn save_settings(
    db: State<'_, DbState>,
    settings: HashMap<String, String>,
) -> Result<(), AppError> {
    settings_service::save_settings(&db, settings)
}
