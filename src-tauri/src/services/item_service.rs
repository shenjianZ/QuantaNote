use crate::models::item::{CreateItemPayload, ItemDto};
use crate::repositories::item_repository;

pub fn create_item(title: String, item_type: String) -> ItemDto {
    item_repository::create(CreateItemPayload { title, item_type })
}
