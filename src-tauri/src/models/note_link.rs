use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteLinkDto {
    pub source_id: String,
    pub source_title: String,
    pub target_title: String,
    pub target_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteLinkGraphNodeDto {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteLinkGraphEdgeDto {
    pub source_id: String,
    pub target_id: Option<String>,
    pub target_title: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteLinkGraphDto {
    pub nodes: Vec<NoteLinkGraphNodeDto>,
    pub edges: Vec<NoteLinkGraphEdgeDto>,
}
