use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateItemPayload {
    pub title: String,
    pub item_type: String,
}

#[derive(Debug, Serialize)]
pub struct ItemDto {
    pub id: String,
    pub title: String,
    pub item_type: String,
    pub created_at: i64,
}
