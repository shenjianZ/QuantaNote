use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::SearchResultDto;
use crate::repositories::search_repository;

pub fn search_items(db: &DbState, query: &str) -> Result<Vec<SearchResultDto>, AppError> {
    search_repository::search(db, query)
}
