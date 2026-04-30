use crate::db::DbState;
use crate::error::AppError;
use crate::models::version::VersionDto;
use crate::repositories::{item_repository, version_repository};

pub fn create_version(
    db: &DbState,
    item_id: &str,
    content: &str,
    change_summary: &str,
) -> Result<VersionDto, AppError> {
    item_repository::get_item(db, item_id)?;
    version_repository::create_version(db, item_id, content, change_summary)
}

pub fn get_versions(db: &DbState, item_id: &str) -> Result<Vec<VersionDto>, AppError> {
    item_repository::get_item(db, item_id)?;
    version_repository::get_versions(db, item_id)
}
