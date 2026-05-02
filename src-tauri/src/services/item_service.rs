use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::*;
use crate::repositories::item_repository;
use crate::repositories::version_repository;

pub fn create_item(
    db: &DbState,
    title: String,
    item_type: String,
    content: Option<String>,
) -> Result<ItemDto, AppError> {
    if title.trim().is_empty() {
        return Err(AppError::Validation("标题不能为空".to_string()));
    }
    let content_val = content.unwrap_or_default();
    let summary = if content_val.is_empty() {
        String::new()
    } else {
        let s: String = content_val.chars().take(10).collect();
        s
    };
    let item = item_repository::create(
        db,
        CreateItemPayload {
            title: title.trim().to_string(),
            item_type,
            content: Some(content_val.clone()),
            summary,
        },
    )?;
    if !content_val.is_empty() {
        let _ =
            version_repository::create_version(db, &item.id, &content_val, "创建", "初始版本", "");
    }
    Ok(item)
}

pub fn get_items(
    db: &DbState,
    item_type: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<ItemDto>, AppError> {
    item_repository::get_items(db, item_type, limit, offset)
}

pub fn get_item(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    item_repository::get_item(db, id)
}

pub fn update_item(db: &DbState, payload: UpdateItemPayload) -> Result<ItemDto, AppError> {
    if let Some(ref title) = payload.title {
        if title.trim().is_empty() {
            return Err(AppError::Validation("标题不能为空".to_string()));
        }
    }
    let updated = item_repository::update(db, payload)?;
    Ok(updated)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_item_trims_title_summarizes_content_and_creates_initial_version() {
        let db = crate::test_support::test_db();
        let item = create_item(
            &db,
            "  第一条笔记  ".to_string(),
            "note".to_string(),
            Some("这是一段用于摘要的内容".to_string()),
        )
        .expect("create item");

        assert_eq!(item.title, "第一条笔记");
        assert_eq!(item.summary, "这是一段用于摘要的内");
        assert!(item.id.starts_with("item-"));

        let versions =
            crate::repositories::version_repository::get_versions(&db, &item.id).expect("versions");
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].version_number, 1);
        assert_eq!(versions[0].change_summary, "创建");
        assert_eq!(versions[0].name, "初始版本");
    }

    #[test]
    fn create_item_rejects_blank_title() {
        let db = crate::test_support::test_db();
        let error = create_item(&db, " \n ".to_string(), "note".to_string(), None)
            .expect_err("blank title should fail");

        assert!(matches!(error, AppError::Validation(_)));
        assert!(error.to_string().contains("标题不能为空"));
    }

    #[test]
    fn update_item_keeps_unset_fields_and_updates_flags() {
        let db = crate::test_support::test_db();
        let item = create_item(
            &db,
            "原标题".to_string(),
            "note".to_string(),
            Some("原正文".to_string()),
        )
        .expect("create item");

        let updated = update_item(
            &db,
            UpdateItemPayload {
                id: item.id.clone(),
                title: Some("新标题".to_string()),
                content: None,
                summary: None,
                pinned: Some(true),
                favorite: Some(true),
                encrypted: None,
            },
        )
        .expect("update item");

        assert_eq!(updated.title, "新标题");
        assert_eq!(updated.content, "原正文");
        assert!(updated.pinned);
        assert!(updated.favorite);
        assert_eq!(updated.item_type, "note");
    }

    #[test]
    fn delete_item_removes_related_rows_via_foreign_keys() {
        let db = crate::test_support::test_db();
        let item = create_item(
            &db,
            "待删除".to_string(),
            "note".to_string(),
            Some("正文".to_string()),
        )
        .expect("create item");
        crate::services::tag_service::set_item_tags(
            &db,
            &item.id,
            vec!["rust".to_string(), "tauri".to_string()],
        )
        .expect("set tags");

        delete_item(&db, &item.id).expect("delete item");

        assert!(get_item(&db, &item.id).is_err());
        let conn = db.conn.lock().expect("lock db");
        let mappings: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM item_tags WHERE item_id = ?1",
                [&item.id],
                |row| row.get(0),
            )
            .expect("mapping count");
        let versions: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM versions WHERE item_id = ?1",
                [&item.id],
                |row| row.get(0),
            )
            .expect("version count");
        assert_eq!(mappings, 0);
        assert_eq!(versions, 0);
    }

    #[test]
    fn get_items_returns_created_items() {
        let db = crate::test_support::test_db();
        create_item(&db, "A".to_string(), "note".to_string(), None).unwrap();
        create_item(&db, "B".to_string(), "note".to_string(), None).unwrap();

        let items = get_items(&db, None, 50, 0).unwrap();
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn get_item_returns_full_dto() {
        let db = crate::test_support::test_db();
        let created = create_item(
            &db,
            "详情".to_string(),
            "note".to_string(),
            Some("正文".to_string()),
        )
        .unwrap();

        let fetched = get_item(&db, &created.id).unwrap();
        assert_eq!(fetched.title, "详情");
        assert_eq!(fetched.content, "正文");
    }

    #[test]
    fn get_pinned_returns_only_pinned() {
        let db = crate::test_support::test_db();
        let pinned = create_item(&db, "置顶".to_string(), "note".to_string(), None).unwrap();
        create_item(&db, "普通".to_string(), "note".to_string(), None).unwrap();
        update_item(
            &db,
            UpdateItemPayload {
                id: pinned.id,
                pinned: Some(true),
                ..Default::default()
            },
        )
        .unwrap();

        let pinned_items = get_pinned(&db).unwrap();
        assert_eq!(pinned_items.len(), 1);
    }

    #[test]
    fn get_recent_respects_limit() {
        let db = crate::test_support::test_db();
        create_item(&db, "A".to_string(), "note".to_string(), None).unwrap();
        create_item(&db, "B".to_string(), "note".to_string(), None).unwrap();
        create_item(&db, "C".to_string(), "note".to_string(), None).unwrap();

        let recent = get_recent(&db, 2).unwrap();
        assert_eq!(recent.len(), 2);
    }
}
