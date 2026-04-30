use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::*;
use crate::repositories::item_repository;

pub fn create_item(db: &DbState, title: String, item_type: String, content: Option<String>) -> Result<ItemDto, AppError> {
    item_repository::create(db, CreateItemPayload { title, item_type, content })
}

pub fn get_items(db: &DbState, item_type: Option<&str>, limit: i64, offset: i64) -> Result<Vec<ItemDto>, AppError> {
    item_repository::get_items(db, item_type, limit, offset)
}

pub fn get_item(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    item_repository::get_item(db, id)
}

pub fn update_item(db: &DbState, payload: UpdateItemPayload) -> Result<ItemDto, AppError> {
    item_repository::update(db, payload)
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
