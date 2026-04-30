use crate::db::DbState;
use crate::error::AppError;
use crate::models::version::VersionDto;
use crate::repositories::{item_repository, version_repository};

pub fn create_version(
    db: &DbState,
    item_id: &str,
    content: &str,
    change_summary: &str,
    name: Option<&str>,
    description: Option<&str>,
) -> Result<VersionDto, AppError> {
    item_repository::get_item(db, item_id)?;
    let default_name = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let version_name = name.unwrap_or(&default_name);
    let version_desc = description.unwrap_or("");
    version_repository::create_version(
        db,
        item_id,
        content,
        change_summary,
        version_name,
        version_desc,
    )
}

pub fn get_versions(db: &DbState, item_id: &str) -> Result<Vec<VersionDto>, AppError> {
    item_repository::get_item(db, item_id)?;
    version_repository::get_versions(db, item_id)
}

pub fn update_version(
    db: &DbState,
    id: &str,
    name: &str,
    description: &str,
) -> Result<VersionDto, AppError> {
    version_repository::update_version(db, id, name, description)
}

pub fn restore_version(db: &DbState, version_id: &str) -> Result<(), AppError> {
    let version = version_repository::get_version(db, version_id)?;
    item_repository::update(
        db,
        crate::models::item::UpdateItemPayload {
            id: version.item_id.clone(),
            title: None,
            content: Some(version.content.clone()),
            summary: None,
            pinned: None,
            favorite: None,
            encrypted: None,
        },
    )?;
    Ok(())
}
