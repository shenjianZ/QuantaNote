use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::*;
use crate::repositories::item_repository;
use crate::repositories::version_repository;

pub fn create_item(
    db: &DbState,
    title: String,
    item_type: String,
    content: Option<String>,
) -> Result<ItemDto, AppError> {
    if title.trim().is_empty() {
        return Err(AppError::Validation("标题不能为空".to_string()));
    }
    let content_val = content.unwrap_or_default();
    let summary = if content_val.is_empty() {
        String::new()
    } else {
        let s: String = content_val.chars().take(100).collect();
        s
    };
    let item = item_repository::create(
        db,
        CreateItemPayload {
            title: title.trim().to_string(),
            item_type,
            content: Some(content_val.clone()),
            summary,
        },
    )?;
    if !content_val.is_empty() {
        let _ =
            version_repository::create_version(db, &item.id, &content_val, "创建", "初始版本", "");
    }
    Ok(item)
}

pub fn get_items(
    db: &DbState,
    item_type: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<ItemDto>, AppError> {
    item_repository::get_items(db, item_type, limit, offset)
}

pub fn get_item(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    item_repository::get_item(db, id)
}

pub fn update_item(db: &DbState, payload: UpdateItemPayload) -> Result<ItemDto, AppError> {
    if let Some(ref title) = payload.title {
        if title.trim().is_empty() {
            return Err(AppError::Validation("标题不能为空".to_string()));
        }
    }
    let updated = item_repository::update(db, payload)?;
    Ok(updated)
}

pub fn delete_item(db: &DbState, id: &str) -> Result<(), AppError> {
    item_repository::delete(db, id)
}

pub fn get_pinned(db: &DbState) -> Result<Vec<ItemDto>, AppError> {
    item_repository::get_pinned(db)
}

pub fn get_recent(db: &DbState, limit: i64) -> Result<Vec<ItemDto>, AppError> {
    item_repository::get_recent(db, limit)
}
