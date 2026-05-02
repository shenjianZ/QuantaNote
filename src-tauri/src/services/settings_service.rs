use std::collections::HashMap;

use crate::db::DbState;
use crate::error::AppError;
use crate::repositories::settings_repository;

pub fn load_all_settings(db: &DbState) -> Result<HashMap<String, String>, AppError> {
    settings_repository::get_all(db)
}

pub fn save_settings(db: &DbState, entries: HashMap<String, String>) -> Result<(), AppError> {
    settings_repository::upsert_batch(db, &entries)
}
