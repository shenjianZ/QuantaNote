use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionDto {
    pub id: String,
    pub item_id: String,
    pub version_number: i32,
    pub content: String,
    pub change_summary: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_dto_roundtrip_json() {
        let dto = VersionDto {
            id: "ver-1".to_string(),
            item_id: "item-1".to_string(),
            version_number: 1,
            content: "content".to_string(),
            change_summary: "created".to_string(),
            name: "v1".to_string(),
            description: "first".to_string(),
            created_at: "2026-01-01".to_string(),
        };
        let json = serde_json::to_string(&dto).unwrap();
        let parsed: VersionDto = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, "ver-1");
        assert_eq!(parsed.version_number, 1);
    }
}
