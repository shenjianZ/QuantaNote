use crate::models::item::{CreateItemPayload, ItemDto};
use crate::utils::{ids, time};

pub fn create(payload: CreateItemPayload) -> ItemDto {
    ItemDto {
        id: ids::prefixed_id("item", &payload.title),
        title: payload.title,
        item_type: payload.item_type,
        created_at: time::now_millis(),
    }
}
