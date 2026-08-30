use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::note_link::{NoteLinkDto, NoteLinkGraphDto};
use crate::services::note_link_service;

#[tauri::command]
pub fn get_note_links(
    db: State<'_, DbState>,
    item_id: String,
) -> Result<Vec<NoteLinkDto>, AppError> {
    note_link_service::get_forward_links(&db, &item_id)
}

#[tauri::command]
pub fn get_note_backlinks(
    db: State<'_, DbState>,
    item_id: String,
) -> Result<Vec<NoteLinkDto>, AppError> {
    note_link_service::get_back_links(&db, &item_id)
}

#[tauri::command]
pub fn get_note_link_graph(db: State<'_, DbState>) -> Result<NoteLinkGraphDto, AppError> {
    note_link_service::get_graph(&db)
}
