use crate::models::item::ItemDto;
use crate::services::item_service;

#[tauri::command]
pub fn create_item(title: String, item_type: String) -> ItemDto {
    item_service::create_item(title, item_type)
}
