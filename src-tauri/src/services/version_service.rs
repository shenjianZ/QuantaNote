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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_version_increments_per_item_and_preserves_metadata() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "版本测试".to_string(),
            "note".to_string(),
            Some("初始内容".to_string()),
        )
        .expect("create item");

        let version = create_version(
            &db,
            &item.id,
            "第二版内容",
            "手动保存",
            Some("v2"),
            Some("说明"),
        )
        .expect("create version");

        assert_eq!(version.version_number, 2);
        assert_eq!(version.name, "v2");
        assert_eq!(version.description, "说明");

        let versions = get_versions(&db, &item.id).expect("get versions");
        assert_eq!(versions[0].version_number, 2);
        assert_eq!(versions[1].version_number, 1);
    }

    #[test]
    fn restore_version_updates_content_without_touching_title_or_flags() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db,
            "恢复测试".to_string(),
            "note".to_string(),
            Some("初始内容".to_string()),
        )
        .expect("create item");
        crate::services::item_service::update_item(
            &db,
            crate::models::item::UpdateItemPayload {
                id: item.id.clone(),
                title: Some("恢复测试-改名".to_string()),
                content: Some("当前内容".to_string()),
                summary: None,
                pinned: Some(true),
                favorite: Some(true),
                encrypted: None,
            },
        )
        .expect("update item");
        let version = create_version(&db, &item.id, "历史内容", "手动保存", Some("history"), None)
            .expect("create version");

        restore_version(&db, &version.id).expect("restore version");

        let restored = crate::services::item_service::get_item(&db, &item.id).expect("get item");
        assert_eq!(restored.title, "恢复测试-改名");
        assert_eq!(restored.content, "历史内容");
        assert!(restored.pinned);
        assert!(restored.favorite);
    }

    #[test]
    fn get_versions_returns_all_for_item() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db, "V".to_string(), "note".to_string(), Some("c1".to_string()),
        ).unwrap();
        create_version(&db, &item.id, "c2", "", None, None).unwrap();

        let versions = get_versions(&db, &item.id).unwrap();
        assert_eq!(versions.len(), 2);
    }

    #[test]
    fn update_version_changes_metadata() {
        let db = crate::test_support::test_db();
        let item = crate::services::item_service::create_item(
            &db, "V".to_string(), "note".to_string(), Some("c".to_string()),
        ).unwrap();
        let v = create_version(&db, &item.id, "c", "", Some("old"), Some("old desc")).unwrap();

        let updated = update_version(&db, &v.id, "new name", "new desc").unwrap();
        assert_eq!(updated.name, "new name");
        assert_eq!(updated.description, "new desc");
    }
}
