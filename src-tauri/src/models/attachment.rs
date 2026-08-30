use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentDto {
    pub id: String,
    pub item_id: String,
    pub filename: String,
    pub file_path: String,
    pub mime_type: String,
    pub file_size: i64,
    pub content_hash: String,
    pub created_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attachment_dto_roundtrip_json() {
        let dto = AttachmentDto {
            id: "att-1".to_string(),
            item_id: "item-1".to_string(),
            filename: "test.pdf".to_string(),
            file_path: "/path/test.pdf".to_string(),
            mime_type: "application/pdf".to_string(),
            file_size: 1024,
            content_hash: "a".repeat(64),
            created_at: "2026-01-01".to_string(),
        };
        let json = serde_json::to_string(&dto).unwrap();
        let parsed: AttachmentDto = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.filename, "test.pdf");
        assert_eq!(parsed.file_size, 1024);
    }
}
