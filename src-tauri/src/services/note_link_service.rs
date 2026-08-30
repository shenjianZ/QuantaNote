use crate::db::DbState;
use crate::error::AppError;
use crate::models::note_link::{NoteLinkDto, NoteLinkGraphDto};
use crate::repositories::note_link_repository;

pub fn get_forward_links(db: &DbState, item_id: &str) -> Result<Vec<NoteLinkDto>, AppError> {
    note_link_repository::get_forward_links(db, item_id)
}

pub fn get_back_links(db: &DbState, item_id: &str) -> Result<Vec<NoteLinkDto>, AppError> {
    note_link_repository::get_back_links(db, item_id)
}

pub fn get_graph(db: &DbState) -> Result<NoteLinkGraphDto, AppError> {
    note_link_repository::get_graph(db)
}
