use crate::models::search::SearchResultDto;
use crate::repositories::search_repository;

pub fn search_items(query: String) -> Vec<SearchResultDto> {
    search_repository::search(&query)
}
