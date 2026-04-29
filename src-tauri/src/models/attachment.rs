use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AttachmentDto {
    pub id: String,
    pub item_id: String,
    pub path: String,
}
