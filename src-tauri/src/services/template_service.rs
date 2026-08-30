use crate::db::DbState;
use crate::error::AppError;
use crate::models::template::TemplateDto;
use crate::repositories::template_repository;

const MAX_NAME_CHARS: usize = 100;
const MAX_DESCRIPTION_CHARS: usize = 500;
const MAX_CONTENT_CHARS: usize = 1_000_000;

fn normalize_fields(
    name: String,
    description: String,
    content: String,
) -> Result<(String, String, String), AppError> {
    let name = name.trim().to_string();
    let description = description.trim().to_string();

    if name.is_empty() {
        return Err(AppError::Validation("模板名称不能为空".to_string()));
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err(AppError::Validation(format!(
            "模板名称不能超过 {} 个字符",
            MAX_NAME_CHARS
        )));
    }
    if description.chars().count() > MAX_DESCRIPTION_CHARS {
        return Err(AppError::Validation(format!(
            "模板说明不能超过 {} 个字符",
            MAX_DESCRIPTION_CHARS
        )));
    }
    if content.chars().count() > MAX_CONTENT_CHARS {
        return Err(AppError::Validation(format!(
            "模板正文不能超过 {} 个字符",
            MAX_CONTENT_CHARS
        )));
    }

    Ok((name, description, content))
}

pub fn get_templates(db: &DbState) -> Result<Vec<TemplateDto>, AppError> {
    template_repository::get_all(db)
}

pub fn create_template(
    db: &DbState,
    name: String,
    description: String,
    content: String,
) -> Result<TemplateDto, AppError> {
    let (name, description, content) = normalize_fields(name, description, content)?;
    template_repository::create(db, name, description, content)
}

pub fn update_template(
    db: &DbState,
    id: &str,
    name: String,
    description: String,
    content: String,
) -> Result<TemplateDto, AppError> {
    let (name, description, content) = normalize_fields(name, description, content)?;
    template_repository::update(db, id, name, description, content)
}

pub fn delete_template(db: &DbState, id: &str) -> Result<(), AppError> {
    template_repository::delete(db, id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_template_trims_metadata_but_preserves_markdown() {
        let db = crate::test_support::test_db();
        let template = create_template(
            &db,
            "  日记  ".to_string(),
            "  每日记录  ".to_string(),
            "# 日记\n\n正文".to_string(),
        )
        .expect("create template");

        assert_eq!(template.name, "日记");
        assert_eq!(template.description, "每日记录");
        assert_eq!(template.content, "# 日记\n\n正文");
    }

    #[test]
    fn rejects_invalid_template_fields() {
        let db = crate::test_support::test_db();
        assert!(matches!(
            create_template(&db, " ".to_string(), String::new(), String::new()),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            create_template(&db, "x".repeat(101), String::new(), String::new()),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            create_template(&db, "x".to_string(), String::new(), "x".repeat(1_000_001)),
            Err(AppError::Validation(_))
        ));
    }
}
