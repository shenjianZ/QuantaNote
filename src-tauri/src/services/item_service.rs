use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::*;
use crate::repositories::item_repository;
use crate::repositories::version_repository;
use crate::utils::paths;

const VALID_ITEM_TYPES: &[&str] = &["note", "link", "file", "image", "code", "task"];

fn validate_summary_mode(mode: &str) -> Result<(), AppError> {
    if matches!(mode, SUMMARY_MODE_AUTO | SUMMARY_MODE_MANUAL) {
        Ok(())
    } else {
        Err(AppError::Validation(format!("无效的摘要模式: {}", mode)))
    }
}

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
    let summary = generate_auto_summary(&content_val);
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

pub fn get_items_page(
    db: &DbState,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<ItemPageDto, AppError> {
    if !(1..=200).contains(&limit) {
        return Err(AppError::Validation(
            "列表分页大小必须在 1 到 200 之间".to_string(),
        ));
    }
    if offset < 0 {
        return Err(AppError::Validation("列表偏移量不能为负数".to_string()));
    }
    item_repository::get_items_page(db, item_type, tab, tag, sort, limit, offset)
}

pub fn get_item(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    item_repository::get_item(db, id)
}

fn validate_date_key(date: &str) -> Result<(), AppError> {
    let parsed = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d");
    if parsed
        .map(|value| value.format("%Y-%m-%d").to_string() != date)
        .unwrap_or(true)
    {
        return Err(AppError::Validation(
            "日期必须使用 YYYY-MM-DD 格式".to_string(),
        ));
    }
    Ok(())
}

pub fn get_daily_note(db: &DbState, date: &str) -> Result<Option<ItemDto>, AppError> {
    validate_date_key(date)?;
    item_repository::get_daily_note(db, date)
}

pub fn get_record_date_counts(
    db: &DbState,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<DailyRecordCountDto>, AppError> {
    validate_date_key(start_date)?;
    validate_date_key(end_date)?;
    if start_date > end_date {
        return Err(AppError::Validation("日期范围起点不能晚于终点".to_string()));
    }
    item_repository::get_record_date_counts(db, start_date, end_date)
}

pub fn update_item(db: &DbState, payload: UpdateItemPayload) -> Result<ItemDto, AppError> {
    if let Some(ref title) = payload.title {
        if title.trim().is_empty() {
            return Err(AppError::Validation("标题不能为空".to_string()));
        }
    }
    let existing = item_repository::get_item(db, &payload.id)?;
    let content = payload
        .content
        .clone()
        .unwrap_or_else(|| existing.content.clone());
    let summary_changed = payload
        .summary
        .as_ref()
        .is_some_and(|summary| summary != &existing.summary);
    let summary_mode = payload
        .summary_mode
        .as_deref()
        .unwrap_or(if summary_changed {
            SUMMARY_MODE_MANUAL
        } else {
            existing.summary_mode.as_str()
        });
    validate_summary_mode(summary_mode)?;
    let summary = if summary_mode == SUMMARY_MODE_AUTO {
        generate_auto_summary(&content)
    } else {
        payload
            .summary
            .clone()
            .unwrap_or_else(|| existing.summary.clone())
    };
    let normalized_payload = UpdateItemPayload {
        id: payload.id,
        title: payload.title,
        content: Some(content),
        summary: Some(summary),
        summary_mode: Some(summary_mode.to_string()),
        pinned: payload.pinned,
        favorite: payload.favorite,
        encrypted: payload.encrypted,
    };
    let updated = item_repository::update(db, normalized_payload)?;
    Ok(updated)
}

pub fn regenerate_summary(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    let item = item_repository::get_item(db, id)?;
    update_item(
        db,
        UpdateItemPayload {
            id: item.id,
            content: Some(item.content),
            summary_mode: Some(SUMMARY_MODE_AUTO.to_string()),
            ..Default::default()
        },
    )
}

pub fn delete_item(db: &DbState, id: &str) -> Result<(), AppError> {
    item_repository::trash(db, id)
}

pub fn get_trash_items(db: &DbState) -> Result<Vec<TrashItemDto>, AppError> {
    item_repository::get_trash(db)
}

pub fn restore_item(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    item_repository::restore(db, id)
}

pub fn permanently_delete_item(db: &DbState, id: &str) -> Result<(), AppError> {
    item_repository::delete(db, id)
}

pub fn cleanup_trash(db: &DbState, older_than_days: i64) -> Result<usize, AppError> {
    if !(1..=3650).contains(&older_than_days) {
        return Err(AppError::Validation(
            "回收站清理时间必须在 1 到 3650 天之间".to_string(),
        ));
    }
    item_repository::cleanup_trash(db, older_than_days)
}

pub fn permanently_delete_all_trash(db: &DbState) -> Result<usize, AppError> {
    item_repository::delete_all_trash(db)
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
        assert_eq!(item.summary_mode, SUMMARY_MODE_AUTO);
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
    fn create_item_accepts_all_supported_item_types() {
        let db = crate::test_support::test_db();

        for item_type in ["note", "link", "file", "image", "code", "task"] {
            let item = create_item(
                &db,
                format!("{} item", item_type),
                item_type.to_string(),
                Some("content".to_string()),
            )
            .expect("supported item type should be accepted");
            assert_eq!(item.item_type, item_type);
        }
    }

    #[test]
    fn get_items_page_rejects_invalid_pagination() {
        let db = crate::test_support::test_db();

        assert!(matches!(
            get_items_page(&db, None, None, None, None, 0, 0),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            get_items_page(&db, None, None, None, None, 10, -1),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn daily_note_queries_validate_date_keys() {
        let db = crate::test_support::test_db();

        assert!(matches!(
            get_daily_note(&db, "2026-8-30"),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            get_record_date_counts(&db, "2026-08-31", "2026-08-30"),
            Err(AppError::Validation(_))
        ));
        assert!(matches!(
            get_record_date_counts(&db, "2026-08-30", "not-a-date"),
            Err(AppError::Validation(_))
        ));
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
                summary_mode: None,
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
        assert_eq!(updated.summary_mode, SUMMARY_MODE_AUTO);
    }

    #[test]
    fn summary_mode_controls_updates_and_regeneration() {
        let db = crate::test_support::test_db();
        let item = create_item(
            &db,
            "摘要模式测试".to_string(),
            "note".to_string(),
            Some("abcdefghijkl".to_string()),
        )
        .expect("create item");
        assert_eq!(item.summary, "abcdefghij");
        assert_eq!(item.summary_mode, SUMMARY_MODE_AUTO);

        let auto_updated = update_item(
            &db,
            UpdateItemPayload {
                id: item.id.clone(),
                content: Some("mnopqrstuv".to_string()),
                ..Default::default()
            },
        )
        .expect("update auto summary");
        assert_eq!(auto_updated.summary, "mnopqrstuv");
        assert_eq!(auto_updated.summary_mode, SUMMARY_MODE_AUTO);

        let manual = update_item(
            &db,
            UpdateItemPayload {
                id: item.id.clone(),
                summary: Some("固定摘要".to_string()),
                ..Default::default()
            },
        )
        .expect("set manual summary");
        assert_eq!(manual.summary, "固定摘要");
        assert_eq!(manual.summary_mode, SUMMARY_MODE_MANUAL);

        let content_changed = update_item(
            &db,
            UpdateItemPayload {
                id: item.id.clone(),
                content: Some("wxyz012345".to_string()),
                ..Default::default()
            },
        )
        .expect("update content without replacing manual summary");
        assert_eq!(content_changed.summary, "固定摘要");
        assert_eq!(content_changed.summary_mode, SUMMARY_MODE_MANUAL);

        let regenerated = regenerate_summary(&db, &item.id).expect("regenerate summary");
        assert_eq!(regenerated.summary, "wxyz012345");
        assert_eq!(regenerated.summary_mode, SUMMARY_MODE_AUTO);

        let invalid = update_item(
            &db,
            UpdateItemPayload {
                id: item.id,
                summary_mode: Some("invalid".to_string()),
                ..Default::default()
            },
        )
        .expect_err("invalid summary mode should fail");
        assert!(matches!(invalid, AppError::Validation(_)));
    }

    #[test]
    fn delete_item_moves_to_trash_and_preserves_related_rows() {
        let db = crate::test_support::test_db();
        let item = create_item(
            &db,
            "待删除".to_string(),
            "note".to_string(),
            Some("正文".to_string()),
        )
        .expect("create item");
        update_item(
            &db,
            UpdateItemPayload {
                id: item.id.clone(),
                pinned: Some(true),
                favorite: Some(true),
                ..Default::default()
            },
        )
        .expect("mark item");
        crate::services::tag_service::set_item_tags(
            &db,
            &item.id,
            vec!["rust".to_string(), "tauri".to_string()],
        )
        .expect("set tags");

        delete_item(&db, &item.id).expect("delete item");

        assert!(get_item(&db, &item.id).is_err());
        let trash = get_trash_items(&db).expect("trash items");
        assert_eq!(trash.len(), 1);
        assert_eq!(trash[0].item.id, item.id);
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
        assert_eq!(mappings, 2);
        assert_eq!(versions, 1);
        drop(conn);

        restore_item(&db, &item.id).expect("restore item");
        let restored = get_item(&db, &item.id).expect("restored item");
        assert_eq!(restored.title, "待删除");
        assert!(restored.pinned);
        assert!(restored.favorite);

        permanently_delete_item(&db, &item.id).expect("permanently delete item");
        assert!(get_item(&db, &item.id).is_err());
        let conn = db.conn.lock().expect("lock db");
        let mappings: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM item_tags WHERE item_id = ?1",
                [&item.id],
                |row| row.get(0),
            )
            .expect("mapping count after permanent delete");
        let versions: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM versions WHERE item_id = ?1",
                [&item.id],
                |row| row.get(0),
            )
            .expect("version count after permanent delete");
        assert_eq!(mappings, 0);
        assert_eq!(versions, 0);
    }

    #[test]
    fn cleanup_trash_permanently_deletes_expired_items() {
        let db = crate::test_support::test_db();
        let item = create_item(&db, "过期记录".to_string(), "note".to_string(), None).unwrap();
        delete_item(&db, &item.id).expect("trash item");

        let conn = db.conn.lock().expect("lock db");
        conn.execute(
            "UPDATE items SET deleted_at = '2020-01-01T00:00:00Z' WHERE id = ?1",
            [&item.id],
        )
        .expect("backdate trash item");
        drop(conn);

        assert_eq!(cleanup_trash(&db, 30).expect("cleanup trash"), 1);
        assert!(get_trash_items(&db).unwrap().is_empty());
    }

    #[test]
    fn permanently_delete_all_trash_removes_only_trashed_items() {
        let db = crate::test_support::test_db();
        let first = create_item(&db, "回收站记录一".to_string(), "note".to_string(), None).unwrap();
        let second =
            create_item(&db, "回收站记录二".to_string(), "note".to_string(), None).unwrap();
        let active = create_item(&db, "保留记录".to_string(), "note".to_string(), None).unwrap();

        delete_item(&db, &first.id).expect("trash first item");
        delete_item(&db, &second.id).expect("trash second item");

        assert_eq!(permanently_delete_all_trash(&db).expect("empty trash"), 2);
        assert!(get_item(&db, &first.id).is_err());
        assert!(get_item(&db, &second.id).is_err());
        assert_eq!(
            get_item(&db, &active.id).expect("active item").id,
            active.id
        );
        assert!(get_trash_items(&db).unwrap().is_empty());
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
