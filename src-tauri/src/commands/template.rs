use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::template::TemplateDto;
use crate::services::template_service;

#[tauri::command]
pub fn get_templates(db: State<'_, DbState>) -> Result<Vec<TemplateDto>, AppError> {
    template_service::get_templates(&db)
}

#[tauri::command]
pub fn create_template(
    db: State<'_, DbState>,
    name: String,
    description: String,
    content: String,
) -> Result<TemplateDto, AppError> {
    template_service::create_template(&db, name, description, content)
}

#[tauri::command]
pub fn update_template(
    db: State<'_, DbState>,
    id: String,
    name: String,
    description: String,
    content: String,
) -> Result<TemplateDto, AppError> {
    template_service::update_template(&db, &id, name, description, content)
}

#[tauri::command]
pub fn delete_template(db: State<'_, DbState>, id: String) -> Result<(), AppError> {
    template_service::delete_template(&db, &id)
}
