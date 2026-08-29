use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SearchResultDto {
    pub id: String,
    pub title: String,
    pub item_type: String,
    pub summary: String,
    pub created_at: String,
    pub updated_at: String,
    pub pinned: bool,
    pub favorite: bool,
}

#[derive(Debug, Serialize)]
pub struct SearchPageDto {
    pub results: Vec<SearchResultDto>,
    pub total: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_result_dto_serializes_correctly() {
        let dto = SearchResultDto {
            id: "item-1".to_string(),
            title: "Test".to_string(),
            item_type: "note".to_string(),
            summary: "sum".to_string(),
            created_at: "2026-01-01".to_string(),
            updated_at: "2026-01-01".to_string(),
            pinned: false,
            favorite: false,
        };
        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("\"id\":\"item-1\""));
        assert!(json.contains("\"title\":\"Test\""));
    }
}
