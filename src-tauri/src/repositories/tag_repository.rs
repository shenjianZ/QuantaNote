use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::TagDto;

pub fn get_all_tags(db: &DbState) -> Result<Vec<TagDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT name, color FROM tags ORDER BY name")
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tags: Vec<TagDto> = stmt
        .query_map([], |row| {
            Ok(TagDto {
                name: row.get(0)?,
                color: row.get(1)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(tags)
}

pub fn create_tag(db: &DbState, name: &str, color: &str) -> Result<TagDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let uuid = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO tags (uuid, name, color, updated_at) VALUES (?1, ?2, ?3, ?4)",
        params![uuid, name, color, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(TagDto {
        name: name.to_string(),
        color: color.to_string(),
    })
}

pub fn delete_tag(db: &DbState, name: &str) -> Result<(), AppError> {
    let mut conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 查询 uuid 用于同步 tombstone
    let uuid: Option<String> = conn
        .query_row(
            "SELECT uuid FROM tags WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .ok();

    let item_tag_mappings: Vec<String> = if let Some(ref tag_uuid) = uuid {
        let mut stmt = conn
            .prepare(
                "SELECT it.item_id FROM item_tags it
                 JOIN tags t ON t.id = it.tag_id
                 WHERE t.uuid = ?1",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(params![tag_uuid], |row| row.get::<_, String>(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut mappings = Vec::new();
        for row in rows {
            mappings.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }
        mappings
    } else {
        Vec::new()
    };

    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 写入 tombstone（用于同步删除操作）
    if let Some(ref tag_uuid) = uuid {
        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'tags', ?2)",
            params![tag_uuid, now],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        for item_id in &item_tag_mappings {
            let tombstone_id = format!("{}_{}", item_id, tag_uuid);
            tx.execute(
                "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'item_tags', ?2)",
                params![tombstone_id, now],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
    }

    tx.execute("DELETE FROM tags WHERE name = ?1", params![name])
        .map_err(|e| AppError::Database(e.to_string()))?;
    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

pub fn get_tag_by_name(db: &DbState, name: &str) -> Option<TagDto> {
    let conn = db.conn.lock().ok()?;
    conn.query_row(
        "SELECT name, color FROM tags WHERE name = ?1",
        params![name],
        |row| {
            Ok(TagDto {
                name: row.get(0)?,
                color: row.get(1)?,
            })
        },
    )
    .ok()
}

pub fn get_tags_for_item(db: &DbState, item_id: &str) -> Result<Vec<TagDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT t.name, t.color FROM tags t
             JOIN item_tags it ON it.tag_id = t.id
             WHERE it.item_id = ?1 ORDER BY t.name",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tags: Vec<TagDto> = stmt
        .query_map(params![item_id], |row| {
            Ok(TagDto {
                name: row.get(0)?,
                color: row.get(1)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(tags)
}

pub fn get_all_item_tag_mappings(db: &DbState) -> Result<Vec<(String, String)>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT it.item_id, t.name FROM item_tags it
             JOIN tags t ON t.id = it.tag_id
             ORDER BY it.item_id, t.name",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(rows)
}

pub fn set_item_tags(db: &DbState, item_id: &str, tag_names: Vec<String>) -> Result<(), AppError> {
    let mut conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 收集新关联的 tag uuid 集合，用于判断哪些会被删除
    let new_tag_uuids: std::collections::HashSet<String> = {
        let mut set = std::collections::HashSet::new();
        for name in &tag_names {
            if let Ok(uuid) = conn.query_row(
                "SELECT uuid FROM tags WHERE name = ?1",
                params![name],
                |row| row.get::<_, String>(0),
            ) {
                set.insert(uuid);
            }
        }
        set
    };

    // 查询当前关联的 tag uuid，为被移除的写入 tombstone
    let old_mappings: Vec<(String, String, i64)> = {
        let mut stmt = conn
            .prepare(
                "SELECT it.item_id, t.uuid, it.tag_id
                 FROM item_tags it JOIN tags t ON t.id = it.tag_id
                 WHERE it.item_id = ?1",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let rows = stmt
            .query_map(params![item_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }
        result
    };

    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();
    for (iid, tag_uuid, tag_id) in &old_mappings {
        if !new_tag_uuids.contains(tag_uuid) {
            let tombstone_id = format!("{}_{}", iid, tag_uuid);
            tx.execute(
                "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'item_tags', ?2)",
                params![tombstone_id, now],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
            tx.execute(
                "DELETE FROM item_tags WHERE item_id = ?1 AND tag_id = ?2",
                params![item_id, tag_id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
    }

    // 添加新关联
    for name in &tag_names {
        let tag_id: i64 = tx
            .query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![name],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        tx.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag_id, updated_at) VALUES (?1, ?2, ?3)",
            params![item_id, tag_id, now],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        // 清理可能残留的 tombstone（关联被重新添加的场景）
        let tag_uuid: String = tx
            .query_row(
                "SELECT uuid FROM tags WHERE id = ?1",
                params![tag_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let tombstone_id = format!("{}_{}", item_id, tag_uuid);
        tx.execute(
            "DELETE FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'item_tags'",
            params![tombstone_id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

pub fn rename_tag(db: &DbState, old_name: &str, new_name: &str) -> Result<TagDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 检查新名称是否已存在
    let existing: Option<String> = conn
        .query_row(
            "SELECT name FROM tags WHERE name = ?1",
            params![new_name],
            |row| row.get(0),
        )
        .ok();

    if existing.is_some() {
        return Err(AppError::Validation(format!("标签 '{}' 已存在", new_name)));
    }

    conn.execute(
        "UPDATE tags SET name = ?1, updated_at = ?2 WHERE name = ?3",
        params![new_name, chrono::Utc::now().to_rfc3339(), old_name],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(TagDto {
        name: new_name.to_string(),
        color: conn
            .query_row(
                "SELECT color FROM tags WHERE name = ?1",
                params![new_name],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?,
    })
}

pub fn update_tag_color(db: &DbState, name: &str, color: &str) -> Result<TagDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    conn.execute(
        "UPDATE tags SET color = ?1, updated_at = ?2 WHERE name = ?3",
        params![color, chrono::Utc::now().to_rfc3339(), name],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(TagDto {
        name: name.to_string(),
        color: color.to_string(),
    })
}

pub fn get_tag_item_counts(db: &DbState) -> Result<Vec<(String, String, i64)>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT t.name, t.color, COUNT(it.item_id) FROM tags t
             LEFT JOIN item_tags it ON it.tag_id = t.id
             GROUP BY t.id ORDER BY t.name",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let rows: Vec<(String, String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::item::CreateItemPayload;
    use crate::repositories::item_repository;

    fn create_test_item(db: &DbState) -> String {
        let dto = item_repository::create(
            db,
            CreateItemPayload {
                title: "Test".to_string(),
                item_type: "note".to_string(),
                content: None,
                summary: String::new(),
            },
        )
        .unwrap();
        dto.id
    }

    #[test]
    fn create_and_get_all_tags() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();
        create_tag(&db, "react", "blue").unwrap();

        let tags = get_all_tags(&db).unwrap();
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "react");
        assert_eq!(tags[1].name, "rust");
    }

    #[test]
    fn get_tag_by_name_found_and_missing() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();

        let found = get_tag_by_name(&db, "rust");
        assert!(found.is_some());
        assert_eq!(found.unwrap().color, "cyan");

        assert!(get_tag_by_name(&db, "missing").is_none());
    }

    #[test]
    fn delete_tag_removes_from_list() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();
        create_tag(&db, "go", "green").unwrap();

        delete_tag(&db, "rust").unwrap();
        let tags = get_all_tags(&db).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "go");
    }

    #[test]
    fn delete_tag_writes_item_tag_tombstone() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);
        create_tag(&db, "rust", "cyan").unwrap();
        let tag_uuid = {
            let conn = db.conn.lock().unwrap();
            conn.query_row(
                "SELECT uuid FROM tags WHERE name = ?1",
                params!["rust"],
                |row| row.get::<_, String>(0),
            )
            .unwrap()
        };

        set_item_tags(&db, &item_id, vec!["rust".to_string()]).unwrap();
        delete_tag(&db, "rust").unwrap();

        let tombstone_id = format!("{}_{}", item_id, tag_uuid);
        let conn = db.conn.lock().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_tombstones WHERE record_id = ?1 AND table_name = 'item_tags'",
                params![tombstone_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn get_tags_for_item_after_set() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);
        create_tag(&db, "rust", "cyan").unwrap();

        set_item_tags(&db, &item_id, vec!["rust".to_string()]).unwrap();
        let tags = get_tags_for_item(&db, &item_id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "rust");
    }

    #[test]
    fn all_item_tag_mappings_returns_pairs() {
        let db = crate::test_support::test_db();
        let id1 = create_test_item(&db);
        let id2 = create_test_item(&db);
        create_tag(&db, "rust", "cyan").unwrap();

        set_item_tags(&db, &id1, vec!["rust".to_string()]).unwrap();
        set_item_tags(&db, &id2, vec!["rust".to_string()]).unwrap();

        let mappings = get_all_item_tag_mappings(&db).unwrap();
        assert_eq!(mappings.len(), 2);
    }

    #[test]
    fn set_item_tags_replaces_existing() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);
        create_tag(&db, "rust", "cyan").unwrap();
        create_tag(&db, "go", "green").unwrap();

        set_item_tags(&db, &item_id, vec!["rust".to_string()]).unwrap();
        set_item_tags(&db, &item_id, vec!["go".to_string()]).unwrap();

        let tags = get_tags_for_item(&db, &item_id).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "go");
    }

    #[test]
    fn set_item_tags_fails_for_nonexistent_tag() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);

        let result = set_item_tags(&db, &item_id, vec!["nonexistent".to_string()]);
        assert!(result.is_err());
    }

    #[test]
    fn rename_tag_changes_name() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();

        let renamed = rename_tag(&db, "rust", "rust-lang").unwrap();
        assert_eq!(renamed.name, "rust-lang");
        assert_eq!(renamed.color, "cyan");

        assert!(get_tag_by_name(&db, "rust").is_none());
        assert!(get_tag_by_name(&db, "rust-lang").is_some());
    }

    #[test]
    fn rename_tag_fails_on_duplicate() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();
        create_tag(&db, "go", "green").unwrap();

        let result = rename_tag(&db, "rust", "go");
        assert!(result.is_err());
    }

    #[test]
    fn update_tag_color_changes_color() {
        let db = crate::test_support::test_db();
        create_tag(&db, "rust", "cyan").unwrap();

        let updated = update_tag_color(&db, "rust", "red").unwrap();
        assert_eq!(updated.name, "rust");
        assert_eq!(updated.color, "red");

        let tag = get_tag_by_name(&db, "rust").unwrap();
        assert_eq!(tag.color, "red");
    }

    #[test]
    fn get_tag_item_counts_returns_counts() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);
        create_tag(&db, "rust", "cyan").unwrap();
        create_tag(&db, "go", "green").unwrap();
        set_item_tags(&db, &item_id, vec!["rust".to_string()]).unwrap();

        let counts = get_tag_item_counts(&db).unwrap();
        assert_eq!(counts.len(), 2);
        let rust_count = counts.iter().find(|(n, _, _)| n == "rust").unwrap();
        assert_eq!(rust_count.2, 1);
        let go_count = counts.iter().find(|(n, _, _)| n == "go").unwrap();
        assert_eq!(go_count.2, 0);
    }
}
