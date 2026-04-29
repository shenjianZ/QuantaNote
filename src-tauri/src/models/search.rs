use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SearchResultDto {
    pub id: String,
    pub title: String,
    pub item_type: String,
    pub summary: String,
}
