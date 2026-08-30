use crate::error::AppError;
use crate::services::ai_service::{self, AiConfig};

#[tauri::command]
pub fn get_ai_config() -> AiConfig {
    ai_service::load_config()
}

#[tauri::command]
pub fn update_ai_config(config: AiConfig) -> Result<(), AppError> {
    ai_service::save_config(&config)
}

#[tauri::command]
pub fn save_ai_api_key(api_key: String) -> Result<(), AppError> {
    ai_service::save_api_key(api_key)
}

#[tauri::command]
pub fn clear_ai_api_key() -> Result<(), AppError> {
    ai_service::clear_api_key()
}

#[tauri::command]
pub async fn generate_ai_summary(title: String, content: String) -> Result<String, AppError> {
    ai_service::generate_summary(&title, &content).await
}

#[tauri::command]
pub async fn generate_ai_tag_suggestions(
    title: String,
    content: String,
) -> Result<Vec<String>, AppError> {
    ai_service::generate_tag_suggestions(&title, &content).await
}

#[tauri::command]
pub async fn answer_ai_question(
    title: String,
    content: String,
    question: String,
) -> Result<String, AppError> {
    ai_service::answer_question(&title, &content, &question).await
}
