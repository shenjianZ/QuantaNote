use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateItemPayload {
    pub title: String,
    pub item_type: String,
    pub content: Option<String>,
    pub summary: String,
}

#[derive(Debug, Default, Deserialize)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_dto_roundtrip_json() {
        let dto = ItemDto {
            id: "item-1".to_string(),
            title: "Test".to_string(),
            item_type: "note".to_string(),
            content: "body".to_string(),
            summary: "sum".to_string(),
            pinned: true,
            favorite: false,
            encrypted: false,
            created_at: "2026-01-01".to_string(),
            updated_at: "2026-01-01".to_string(),
        };
        let json = serde_json::to_string(&dto).unwrap();
        let parsed: ItemDto = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, dto.id);
        assert_eq!(parsed.title, dto.title);
        assert!(parsed.pinned);
    }

    #[test]
    fn create_item_payload_deserialize() {
        let json = r#"{"title":"Hello","item_type":"note","content":null,"summary":""}"#;
        let payload: CreateItemPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.title, "Hello");
        assert!(payload.content.is_none());
    }

    #[test]
    fn tag_dto_roundtrip_json() {
        let tag = TagDto {
            name: "rust".to_string(),
            color: "cyan".to_string(),
        };
        let json = serde_json::to_string(&tag).unwrap();
        let parsed: TagDto = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "rust");
        assert_eq!(parsed.color, "cyan");
    }
}
