use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::SearchResultDto;
use crate::services::search_service;

#[tauri::command]
pub fn search_items(
    db: State<'_, DbState>,
    query: String,
    item_type: Option<String>,
) -> Result<Vec<SearchResultDto>, AppError> {
    search_service::search_items(&db, &query, item_type.as_deref())
}
