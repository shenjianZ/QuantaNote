use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::SearchPageDto;
use crate::services::search_service;

#[tauri::command]
pub fn search_items(
    db: State<'_, DbState>,
    query: String,
    item_type: Option<String>,
    tab: Option<String>,
    tag: Option<String>,
    sort: Option<String>,
    mode: Option<String>,
    scopes: Option<Vec<String>>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<SearchPageDto, AppError> {
    search_service::search_items_page_with_options(
        &db,
        &query,
        item_type.as_deref(),
        tab.as_deref(),
        tag.as_deref(),
        sort.as_deref(),
        mode.as_deref().unwrap_or("normal"),
        scopes.as_deref().unwrap_or(&[]),
        limit.unwrap_or(50),
        offset.unwrap_or(0),
    )
}
