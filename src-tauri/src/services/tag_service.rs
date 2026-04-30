use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::TagDto;
use crate::repositories::tag_repository;

pub fn get_all_tags(db: &DbState) -> Result<Vec<TagDto>, AppError> {
    tag_repository::get_all_tags(db)
}

pub fn get_all_item_tag_mappings(db: &DbState) -> Result<Vec<(String, String)>, AppError> {
    tag_repository::get_all_item_tag_mappings(db)
}

pub fn create_tag(db: &DbState, name: &str, color: &str) -> Result<TagDto, AppError> {
    tag_repository::create_tag(db, name, color)
}

pub fn delete_tag(db: &DbState, name: &str) -> Result<(), AppError> {
    tag_repository::delete_tag(db, name)
}

pub fn get_tags_for_item(db: &DbState, item_id: &str) -> Result<Vec<TagDto>, AppError> {
    tag_repository::get_tags_for_item(db, item_id)
}

pub fn set_item_tags(db: &DbState, item_id: &str, tag_names: Vec<String>) -> Result<(), AppError> {
    for name in &tag_names {
        if name.trim().is_empty() {
            continue;
        }
        let existing = tag_repository::get_tag_by_name(db, name);
        if existing.is_none() {
            tag_repository::create_tag(db, name, "cyan")?;
        }
    }
    tag_repository::set_item_tags(db, item_id, tag_names)
}
