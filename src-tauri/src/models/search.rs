use serde::Serialize;

#[derive(Debug, Clone)]
pub struct SearchTerm {
    pub value: String,
    pub wildcard: bool,
}

#[derive(Debug, Clone, Default)]
pub struct SearchQuery {
    pub positive_groups: Vec<Vec<SearchTerm>>,
    pub excluded_terms: Vec<SearchTerm>,
}

impl SearchQuery {
    pub fn normal(query: &str) -> Self {
        let positive_groups = query
            .split_whitespace()
            .filter(|term| !term.is_empty())
            .map(|term| {
                vec![SearchTerm {
                    value: term.to_string(),
                    wildcard: false,
                }]
            })
            .collect();
        Self {
            positive_groups,
            excluded_terms: Vec::new(),
        }
    }
}

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
    pub matched_fields: Vec<String>,
    pub context: String,
    pub highlight_terms: Vec<String>,
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
            matched_fields: vec!["title".to_string()],
            context: "Test".to_string(),
            highlight_terms: vec!["Test".to_string()],
        };
        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("\"id\":\"item-1\""));
        assert!(json.contains("\"title\":\"Test\""));
    }
}
