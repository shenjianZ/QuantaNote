use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateItemPayload {
    pub title: String,
    pub item_type: String,
    pub content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemPayload {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub summary: Option<String>,
    pub pinned: Option<bool>,
    pub favorite: Option<bool>,
    pub encrypted: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ItemDto {
    pub id: String,
    pub title: String,
    pub item_type: String,
    pub content: String,
    pub summary: String,
    pub pinned: bool,
    pub favorite: bool,
    pub encrypted: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagDto {
    pub name: String,
    pub color: String,
}
