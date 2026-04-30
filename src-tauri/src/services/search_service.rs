use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::SearchResultDto;
use crate::repositories::search_repository;

pub fn search_items(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    let cleaned: String = query
        .chars()
        .filter(|c| !c.is_control())
        .collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        return Ok(vec![]);
    }
    search_repository::search(db, cleaned, item_type)
}
