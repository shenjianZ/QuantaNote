use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::services::data_io_service::{self, ExportOptions, ExportSizeEstimate, ImportOptions};

#[tauri::command]
pub fn export_data(db: State<'_, DbState>) -> Result<String, AppError> {
    data_io_service::export_data(&db)
}

#[tauri::command]
pub fn import_data(db: State<'_, DbState>, json: String) -> Result<(), AppError> {
    data_io_service::import_data(&db, json)
}

#[tauri::command]
pub fn save_to_file(path: String, content: String) -> Result<(), AppError> {
    data_io_service::save_to_file(path, content)
}

#[tauri::command]
pub fn read_from_file(path: String) -> Result<String, AppError> {
    data_io_service::read_from_file(path)
}

#[tauri::command]
pub fn get_export_size_estimate(db: State<'_, DbState>) -> Result<ExportSizeEstimate, AppError> {
    data_io_service::get_export_size_estimate(&db)
}

#[tauri::command]
pub fn export_data_zip(
    path: String,
    options: ExportOptions,
    db: State<'_, DbState>,
) -> Result<(), AppError> {
    data_io_service::export_data_zip(&db, &path, &options)
}

#[tauri::command]
pub fn export_data_zip_to_default(
    options: ExportOptions,
    db: State<'_, DbState>,
) -> Result<String, AppError> {
    data_io_service::export_data_zip_to_default(&db, &options)
}

#[tauri::command]
pub fn import_data_zip(
    path: String,
    options: ImportOptions,
    db: State<'_, DbState>,
) -> Result<(), AppError> {
    data_io_service::import_data_zip(&db, &path, &options)
}

#[tauri::command]
pub fn import_data_zip_bytes(
    data: Vec<u8>,
    options: ImportOptions,
    db: State<'_, DbState>,
) -> Result<(), AppError> {
    data_io_service::import_data_zip_bytes(&db, data, &options)
}
