use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionDto {
    pub id: String,
    pub item_id: String,
    pub version_number: i32,
    pub content: String,
    pub change_summary: String,
    pub created_at: String,
}
