use rusqlite::{params, params_from_iter, types::Value, OptionalExtension};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::*;
use crate::repositories::attachment_repository;
use crate::utils::ids;

fn row_to_item(row: &rusqlite::Row) -> rusqlite::Result<ItemDto> {
    Ok(ItemDto {
        id: row.get(0)?,
        title: row.get(1)?,
        item_type: row.get(2)?,
        content: row.get(3)?,
        summary: row.get(4)?,
        pinned: row.get::<_, i32>(5)? != 0,
        favorite: row.get::<_, i32>(6)? != 0,
        encrypted: row.get::<_, i32>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn row_to_trash_item(row: &rusqlite::Row) -> rusqlite::Result<TrashItemDto> {
    Ok(TrashItemDto {
        item: ItemDto {
            id: row.get(0)?,
            title: row.get(1)?,
            item_type: row.get(2)?,
            content: row.get(3)?,
            summary: row.get(4)?,
            pinned: row.get::<_, i32>(5)? != 0,
            favorite: row.get::<_, i32>(6)? != 0,
            encrypted: row.get::<_, i32>(7)? != 0,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        },
        deleted_at: row.get(10)?,
    })
}

pub fn create(db: &DbState, payload: CreateItemPayload) -> Result<ItemDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let id = ids::new_id("item");
    let now = chrono::Utc::now().to_rfc3339();
    let content = payload.content.unwrap_or_default();

    conn.execute(
        "INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            id,
            payload.title,
            payload.item_type,
            content,
            payload.summary,
            now
        ],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(ItemDto {
        id,
        title: payload.title,
        item_type: payload.item_type,
        content,
        summary: payload.summary,
        pinned: false,
        favorite: false,
        encrypted: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_items(
    db: &DbState,
    item_type: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<ItemDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<ItemDto> = if let Some(t) = item_type {
        let mut stmt = conn.prepare(
            "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
             FROM items WHERE item_type = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows: Vec<ItemDto> = stmt
            .query_map(params![t, limit, offset], row_to_item)
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
             FROM items WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?1 OFFSET ?2"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows: Vec<ItemDto> = stmt
            .query_map(params![limit, offset], row_to_item)
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows
    };

    Ok(items)
}

pub fn get_item(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn.prepare(
        "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
         FROM items WHERE id = ?1 AND deleted_at IS NULL"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    stmt.query_row(params![id], row_to_item)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn update(db: &DbState, payload: UpdateItemPayload) -> Result<ItemDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let now = chrono::Utc::now().to_rfc3339();

    let existing = conn.query_row(
        "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
         FROM items WHERE id = ?1 AND deleted_at IS NULL",
        params![payload.id],
        row_to_item,
    ).map_err(|_| AppError::NotFound(format!("Item {}", payload.id)))?;

    let title = payload.title.unwrap_or(existing.title);
    let content = payload.content.unwrap_or(existing.content);
    let summary = payload.summary.unwrap_or(existing.summary);
    let pinned = payload.pinned.unwrap_or(existing.pinned);
    let favorite = payload.favorite.unwrap_or(existing.favorite);
    let encrypted = payload.encrypted.unwrap_or(existing.encrypted);

    conn.execute(
        "UPDATE items SET title=?1, content=?2, summary=?3, pinned=?4, favorite=?5, encrypted=?6, updated_at=?7
         WHERE id=?8",
        params![title, content, summary, pinned as i32, favorite as i32, encrypted as i32, now, payload.id],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    Ok(ItemDto {
        id: payload.id,
        title,
        item_type: existing.item_type,
        content,
        summary,
        pinned,
        favorite,
        encrypted,
        created_at: existing.created_at,
        updated_at: now,
    })
}

pub fn trash(db: &DbState, id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let state: Option<Option<String>> = conn
        .query_row(
            "SELECT deleted_at FROM items WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::Database(e.to_string()))?;

    match state {
        None => return Err(AppError::NotFound(format!("Item {}", id))),
        Some(Some(_)) => return Ok(()),
        Some(None) => {}
    }

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE items SET deleted_at = ?1, updated_at = ?1
         WHERE id = ?2 AND deleted_at IS NULL",
        params![now, id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

/// Permanently deletes an item and its related records/files.
pub fn delete(db: &DbState, id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 先检查记录是否存在
    let exists: bool = conn
        .query_row("SELECT 1 FROM items WHERE id = ?1", params![id], |_| {
            Ok(true)
        })
        .unwrap_or(false);
    if !exists {
        return Err(AppError::NotFound(format!("Item {}", id)));
    }

    let attachment_paths: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT file_path FROM attachments WHERE item_id = ?1")
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?
    };

    // 记录 tombstone（用于同步删除操作）
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'items', ?2)",
        params![id, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    // 为子记录写入 tombstone（CASCADE 删除后无法查询，需在删除前写入）
    {
        let mut stmt = conn
            .prepare("SELECT id FROM versions WHERE item_id = ?1")
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        for row in rows {
            let ver_id = row.map_err(|e| AppError::Database(e.to_string()))?;
            conn.execute(
                "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'versions', ?2)",
                params![ver_id, now],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
    }
    {
        let mut stmt = conn
            .prepare("SELECT id FROM attachments WHERE item_id = ?1")
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        for row in rows {
            let att_id = row.map_err(|e| AppError::Database(e.to_string()))?;
            conn.execute(
                "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'attachments', ?2)",
                params![att_id, now],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
    }
    {
        let mut stmt = conn
            .prepare(
                "SELECT t.uuid FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = ?1",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(params![id], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        for row in rows {
            let tag_uuid = row.map_err(|e| AppError::Database(e.to_string()))?;
            let tombstone_id = format!("{}_{}", id, tag_uuid);
            conn.execute(
                "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'item_tags', ?2)",
                params![tombstone_id, now],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
    }

    // 硬删除（CASCADE 会清理 item_tags, attachments, versions）
    conn.execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;

    drop(conn);
    attachment_repository::cleanup_file_paths(&attachment_paths)?;

    Ok(())
}

pub fn get_pinned(db: &DbState) -> Result<Vec<ItemDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn.prepare(
        "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
         FROM items WHERE pinned = 1 AND deleted_at IS NULL ORDER BY updated_at DESC"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<ItemDto> = stmt
        .query_map([], row_to_item)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(items)
}

pub fn get_recent(db: &DbState, limit: i64) -> Result<Vec<ItemDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn.prepare(
        "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
         FROM items WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?1"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<ItemDto> = stmt
        .query_map(params![limit], row_to_item)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(items)
}

fn build_item_list_filter(
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
) -> (String, Vec<Value>) {
    let mut conditions = vec!["i.deleted_at IS NULL".to_string()];
    let mut values = Vec::new();

    if let Some(item_type) = item_type.filter(|value| !value.trim().is_empty()) {
        conditions.push("i.item_type = ?".to_string());
        values.push(Value::Text(item_type.to_string()));
    }

    match tab {
        Some("pinned") => conditions.push("i.pinned = 1".to_string()),
        Some("favorite") => conditions.push("i.favorite = 1".to_string()),
        _ => {}
    }

    if let Some(tag) = tag.filter(|value| !value.trim().is_empty() && *value != "all") {
        conditions.push(
            "EXISTS (
                SELECT 1 FROM item_tags it
                JOIN tags t ON t.id = it.tag_id
                WHERE it.item_id = i.id AND t.name = ?
            )"
            .to_string(),
        );
        values.push(Value::Text(tag.to_string()));
    }

    (conditions.join(" AND "), values)
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
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let (where_clause, values) = build_item_list_filter(item_type, tab, tag);
    let order_clause = match sort {
        Some("created") => "i.created_at DESC, i.id DESC",
        Some("title") => "i.title COLLATE NOCASE ASC, i.id ASC",
        _ => "i.updated_at DESC, i.id DESC",
    };

    let count_sql = format!("SELECT COUNT(*) FROM items i WHERE {}", where_clause);
    let total = conn
        .query_row(&count_sql, params_from_iter(values.iter()), |row| {
            row.get(0)
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let page_limit = limit.clamp(1, 200);
    let page_offset = offset.max(0);
    let page_sql = format!(
        "SELECT i.id, i.title, i.item_type, i.content, i.summary, i.pinned, i.favorite, i.encrypted, i.created_at, i.updated_at
         FROM items i WHERE {} ORDER BY {} LIMIT ? OFFSET ?",
        where_clause, order_clause
    );
    let mut page_values = values;
    page_values.push(Value::Integer(page_limit));
    page_values.push(Value::Integer(page_offset));
    let mut stmt = conn
        .prepare(&page_sql)
        .map_err(|e| AppError::Database(e.to_string()))?;
    let items = stmt
        .query_map(params_from_iter(page_values.iter()), row_to_item)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(ItemPageDto { items, total })
}

pub fn get_trash(db: &DbState) -> Result<Vec<TrashItemDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at, deleted_at
             FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    let items = stmt
        .query_map([], row_to_trash_item)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(items)
}

pub fn restore(db: &DbState, id: &str) -> Result<ItemDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let now = chrono::Utc::now().to_rfc3339();
    let changed = conn
        .execute(
            "UPDATE items SET deleted_at = NULL, updated_at = ?1
             WHERE id = ?2 AND deleted_at IS NOT NULL",
            params![now, id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Trash item {}", id)));
    }
    drop(conn);
    get_item(db, id)
}

pub fn cleanup_trash(db: &DbState, older_than_days: i64) -> Result<usize, AppError> {
    let cutoff = (chrono::Utc::now() - chrono::Duration::days(older_than_days)).to_rfc3339();
    let ids = {
        let conn = db
            .conn
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id FROM items
                 WHERE deleted_at IS NOT NULL AND deleted_at <= ?1
                 ORDER BY deleted_at ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let ids = stmt
            .query_map(params![cutoff], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;
        ids
    };

    let mut deleted = 0;
    for id in ids {
        delete(db, &id)?;
        deleted += 1;
    }
    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::item::{CreateItemPayload, UpdateItemPayload};

    fn create_test_item(db: &DbState, title: &str, item_type: &str) -> ItemDto {
        create(
            db,
            CreateItemPayload {
                title: title.to_string(),
                item_type: item_type.to_string(),
                content: Some("test content".to_string()),
                summary: "test summary".to_string(),
            },
        )
        .unwrap()
    }

    #[test]
    fn create_inserts_and_returns_full_dto() {
        let db = crate::test_support::test_db();
        let dto = create_test_item(&db, "Test Note", "note");

        assert!(dto.id.starts_with("item-"));
        assert_eq!(dto.title, "Test Note");
        assert_eq!(dto.item_type, "note");
        assert_eq!(dto.content, "test content");
        assert_eq!(dto.summary, "test summary");
        assert!(!dto.pinned);
        assert!(!dto.favorite);
        assert!(!dto.encrypted);
        assert!(!dto.created_at.is_empty());
        assert_eq!(dto.created_at, dto.updated_at);
    }

    #[test]
    fn get_items_returns_all_unfiltered() {
        let db = crate::test_support::test_db();
        create_test_item(&db, "Note 1", "note");
        create_test_item(&db, "Note 2", "note");

        let items = get_items(&db, None, 10, 0).unwrap();
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn get_items_filters_by_type() {
        let db = crate::test_support::test_db();
        create_test_item(&db, "Note A", "note");
        create_test_item(&db, "Task B", "task");

        let notes = get_items(&db, Some("note"), 10, 0).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].item_type, "note");

        let tasks = get_items(&db, Some("task"), 10, 0).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].item_type, "task");
    }

    #[test]
    fn get_items_paginates_with_limit_and_offset() {
        let db = crate::test_support::test_db();
        create_test_item(&db, "A", "note");
        create_test_item(&db, "B", "note");
        create_test_item(&db, "C", "note");

        let page1 = get_items(&db, None, 2, 0).unwrap();
        assert_eq!(page1.len(), 2);

        let page2 = get_items(&db, None, 2, 2).unwrap();
        assert_eq!(page2.len(), 1);
    }

    #[test]
    fn get_items_page_returns_total_and_applies_list_filters() {
        let db = crate::test_support::test_db();
        let pinned = create_test_item(&db, "Pinned", "note");
        create_test_item(&db, "Normal", "note");
        update(
            &db,
            UpdateItemPayload {
                id: pinned.id,
                pinned: Some(true),
                ..Default::default()
            },
        )
        .unwrap();

        let page = get_items_page(&db, None, Some("pinned"), None, Some("title"), 1, 0)
            .expect("get filtered page");
        assert_eq!(page.total, 1);
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].title, "Pinned");
    }

    #[test]
    fn update_merges_partial_fields() {
        let db = crate::test_support::test_db();
        let created = create_test_item(&db, "Original", "note");

        let updated = update(
            &db,
            UpdateItemPayload {
                id: created.id.clone(),
                title: Some("Updated".to_string()),
                pinned: Some(true),
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(updated.title, "Updated");
        assert_eq!(updated.content, "test content");
        assert!(updated.pinned);
        assert!(!updated.favorite);
    }

    #[test]
    fn delete_removes_item_and_not_found_for_missing() {
        let db = crate::test_support::test_db();
        let created = create_test_item(&db, "To Delete", "note");

        delete(&db, &created.id).unwrap();
        assert!(get_item(&db, &created.id).is_err());

        let err = delete(&db, "nonexistent-id");
        assert!(err.is_err());
    }

    #[test]
    fn delete_removes_item_attachments_and_physical_files() {
        let data_dir = crate::test_support::unique_temp_dir("item-delete-attachments");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();
        let created = create_test_item(&db, "带附件的笔记", "note");
        let attachment = crate::repositories::attachment_repository::add_bytes(
            &db,
            created.id.clone(),
            "image.png".to_string(),
            "image/png".to_string(),
            vec![1, 2, 3],
        )
        .expect("add attachment");
        assert!(std::path::Path::new(&attachment.file_path).exists());

        delete(&db, &created.id).expect("delete item");

        assert!(!std::path::Path::new(&attachment.file_path).exists());
        let conn = db.conn.lock().expect("lock db");
        let attachment_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM attachments WHERE item_id = ?1",
                params![created.id],
                |row| row.get(0),
            )
            .expect("count attachments");
        assert_eq!(attachment_count, 0);
    }

    #[test]
    fn get_pinned_and_get_recent() {
        let db = crate::test_support::test_db();
        let pinned = create_test_item(&db, "Pinned", "note");
        update(
            &db,
            UpdateItemPayload {
                id: pinned.id.clone(),
                pinned: Some(true),
                ..Default::default()
            },
        )
        .unwrap();
        create_test_item(&db, "Normal", "note");

        let pinned_items = get_pinned(&db).unwrap();
        assert_eq!(pinned_items.len(), 1);
        assert!(pinned_items[0].pinned);

        let recent = get_recent(&db, 5).unwrap();
        assert_eq!(recent.len(), 2);
    }
}
