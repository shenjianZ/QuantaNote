use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::*;
use crate::repositories::item_repository;
use crate::repositories::version_repository;
use crate::utils::paths;

const VALID_ITEM_TYPES: &[&str] = &["note"];

pub fn create_item(
    db: &DbState,
    title: String,
    item_type: String,
    content: Option<String>,
) -> Result<ItemDto, AppError> {
    if title.trim().is_empty() {
        return Err(AppError::Validation("标题不能为空".to_string()));
    }
    if !VALID_ITEM_TYPES.contains(&item_type.as_str()) {
        return Err(AppError::Validation(format!(
            "无效的记录类型: {}",
            item_type
        )));
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
        if let Err(e) =
            version_repository::create_version(db, &item.id, &content_val, "创建", "初始版本", "")
        {
            log::warn!(
                "Failed to create initial version for item {}: {}",
                item.id,
                e
            );
        }
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

pub fn get_db_size(db: &DbState) -> Result<String, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let page_count: i64 = conn
        .query_row("PRAGMA page_count", [], |r| r.get(0))
        .unwrap_or(0);
    let page_size: i64 = conn
        .query_row("PRAGMA page_size", [], |r| r.get(0))
        .unwrap_or(4096);
    let bytes = page_count * page_size;
    if bytes < 1024 {
        Ok(format!("{} B", bytes))
    } else if bytes < 1024 * 1024 {
        Ok(format!("{:.1} KB", bytes as f64 / 1024.0))
    } else {
        Ok(format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0)))
    }
}

pub fn optimize_db(db: &DbState) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute_batch(
        "PRAGMA incremental_vacuum;
         INSERT INTO items_fts(items_fts) VALUES('rebuild');
         INSERT INTO items_fts_trigram(items_fts_trigram) VALUES('rebuild');",
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

pub fn get_db_path() -> Result<String, AppError> {
    Ok(paths::quantanote_dir()
        .join("quanta_note.sqlite")
        .to_string_lossy()
        .to_string())
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
