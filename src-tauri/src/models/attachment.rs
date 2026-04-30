use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentDto {
    pub id: String,
    pub item_id: String,
    pub filename: String,
    pub file_path: String,
    pub mime_type: String,
    pub file_size: i64,
    pub created_at: String,
}
