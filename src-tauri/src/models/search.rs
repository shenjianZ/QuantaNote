use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SearchResultDto {
    pub id: String,
    pub title: String,
    pub item_type: String,
    pub summary: String,
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
        };
        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("\"id\":\"item-1\""));
        assert!(json.contains("\"title\":\"Test\""));
    }
}
