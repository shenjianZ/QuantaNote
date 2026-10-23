use serde::{Deserialize, Serialize};

pub const CHAT_ROLE_USER: &str = "user";
pub const CHAT_ROLE_ASSISTANT: &str = "assistant";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessageDto {
    pub id: String,
    pub item_id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatSessionDto {
    pub id: String,
    pub item_id: String,
    pub title: String,
    /// 会话使用的模型；空 = 跟随全局配置/聊天偏好
    pub model: String,
    /// 自定义系统提示词；空 = 默认
    pub system_prompt: String,
    /// 温度；None = 默认
    pub temperature: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}
