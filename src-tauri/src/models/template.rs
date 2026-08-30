use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub content: String,
    pub built_in: bool,
    pub created_at: String,
    pub updated_at: String,
}
