use crate::models::search::SearchResultDto;
use crate::services::search_service;

#[tauri::command]
pub fn search_items(query: String) -> Vec<SearchResultDto> {
    search_service::search_items(query)
}
