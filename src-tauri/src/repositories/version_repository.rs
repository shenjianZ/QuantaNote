use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::{generate_auto_summary, ItemDto, SUMMARY_MODE_AUTO};
use crate::models::version::VersionDto;
use crate::utils::ids;

pub fn create_version(
    db: &DbState,
    item_id: &str,
    content: &str,
    change_summary: &str,
    name: &str,
    description: &str,
) -> Result<VersionDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let max_ver: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version_number), 0) FROM versions WHERE item_id = ?1",
            params![item_id],
            |row| row.get(0),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let id = ids::new_id("ver");
    let now = chrono::Utc::now().to_rfc3339();
    let version_number = max_ver + 1;

    conn.execute(
        "INSERT INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, item_id, version_number, content, change_summary, name, description, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(VersionDto {
        id,
        item_id: item_id.to_string(),
        version_number,
        content: content.to_string(),
        change_summary: change_summary.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        created_at: now,
    })
}

/// Restore a version and preserve the current content as a new version.
///
/// The snapshot and item update must be committed together. Otherwise a
/// failed second operation could leave the user without a way to undo the
/// restore or leave the editor showing content that was not persisted.
pub fn restore_version_with_snapshot(db: &DbState, version_id: &str) -> Result<ItemDto, AppError> {
    let mut conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let version = tx
        .query_row(
            "SELECT id, item_id, version_number, content, change_summary, name, description, created_at
             FROM versions WHERE id = ?1",
            params![version_id],
            |row| {
                Ok(VersionDto {
                    id: row.get(0)?,
                    item_id: row.get(1)?,
                    version_number: row.get(2)?,
                    content: row.get(3)?,
                    change_summary: row.get(4)?,
                    name: row.get(5)?,
                    description: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Version {}", version_id))
            }
            _ => AppError::Database(e.to_string()),
        })?;

    let current = tx
        .query_row(
            "SELECT id, title, item_type, content, summary, summary_mode, pinned, favorite, encrypted, created_at, updated_at
             FROM items WHERE id = ?1",
            params![version.item_id],
            |row| {
                Ok(ItemDto {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    item_type: row.get(2)?,
                    content: row.get(3)?,
                    summary: row.get(4)?,
                    summary_mode: row.get(5)?,
                    pinned: row.get::<_, i32>(6)? != 0,
                    favorite: row.get::<_, i32>(7)? != 0,
                    encrypted: row.get::<_, i32>(8)? != 0,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Item {}", version.item_id))
            }
            _ => AppError::Database(e.to_string()),
        })?;

    let restored = if current.content == version.content {
        current
    } else {
        let max_ver: i32 = tx
            .query_row(
                "SELECT COALESCE(MAX(version_number), 0) FROM versions WHERE item_id = ?1",
                params![version.item_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        let snapshot_id = ids::new_id("ver");
        let snapshot_created_at = chrono::Utc::now().to_rfc3339();
        let snapshot_name = format!("恢复前快照 · v{}", version.version_number);
        let snapshot_summary = format!("恢复自版本 v{} 前自动快照", version.version_number);

        tx.execute(
            "INSERT INTO versions (id, item_id, version_number, content, change_summary, name, description, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                snapshot_id,
                version.item_id,
                max_ver + 1,
                current.content,
                snapshot_summary,
                snapshot_name,
                "用于撤销本次恢复操作",
                snapshot_created_at,
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        let updated_at = chrono::Utc::now().to_rfc3339();
        let summary = if current.summary_mode == SUMMARY_MODE_AUTO {
            generate_auto_summary(&version.content)
        } else {
            current.summary.clone()
        };
        tx.execute(
            "UPDATE items SET content = ?1, summary = ?2, updated_at = ?3 WHERE id = ?4",
            params![version.content, summary, updated_at, version.item_id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        ItemDto {
            content: version.content,
            summary,
            updated_at,
            ..current
        }
    };

    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    Ok(restored)
}

pub fn get_versions(db: &DbState, item_id: &str) -> Result<Vec<VersionDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, version_number, content, change_summary, name, description, created_at
             FROM versions WHERE item_id = ?1 ORDER BY version_number DESC",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<VersionDto> = stmt
        .query_map(params![item_id], |row| {
            Ok(VersionDto {
                id: row.get(0)?,
                item_id: row.get(1)?,
                version_number: row.get(2)?,
                content: row.get(3)?,
                change_summary: row.get(4)?,
                name: row.get(5)?,
                description: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(items)
}

pub fn get_version(db: &DbState, id: &str) -> Result<VersionDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.query_row(
        "SELECT id, item_id, version_number, content, change_summary, name, description, created_at
         FROM versions WHERE id = ?1",
        params![id],
        |row| {
            Ok(VersionDto {
                id: row.get(0)?,
                item_id: row.get(1)?,
                version_number: row.get(2)?,
                content: row.get(3)?,
                change_summary: row.get(4)?,
                name: row.get(5)?,
                description: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| AppError::Database(e.to_string()))
}

pub fn update_version(
    db: &DbState,
    id: &str,
    name: &str,
    description: &str,
) -> Result<VersionDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    conn.execute(
        "UPDATE versions SET name = ?1, description = ?2 WHERE id = ?3",
        params![name, description, id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    drop(conn);
    get_version(db, id)
}

pub fn delete_version(db: &DbState, id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 先检查记录是否存在
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM versions WHERE id = ?1",
            params![id],
            |row| row.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound(format!("Version {}", id)));
    }

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO sync_tombstones (record_id, table_name, deleted_at) VALUES (?1, 'versions', ?2)",
        params![id, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    conn.execute("DELETE FROM versions WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
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
    fn create_version_auto_increments() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);

        let v1 = create_version(&db, &item_id, "content 1", "", "", "").unwrap();
        let v2 = create_version(&db, &item_id, "content 2", "", "", "").unwrap();

        assert_eq!(v1.version_number, 1);
        assert_eq!(v2.version_number, 2);
    }

    #[test]
    fn get_versions_returns_descending() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);
        create_version(&db, &item_id, "v1", "", "", "").unwrap();
        create_version(&db, &item_id, "v2", "", "", "").unwrap();
        create_version(&db, &item_id, "v3", "", "", "").unwrap();

        let versions = get_versions(&db, &item_id).unwrap();
        assert_eq!(versions.len(), 3);
        assert_eq!(versions[0].version_number, 3);
        assert_eq!(versions[2].version_number, 1);
    }

    #[test]
    fn get_version_by_id() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);
        let created = create_version(&db, &item_id, "content", "summary", "name", "desc").unwrap();

        let fetched = get_version(&db, &created.id).unwrap();
        assert_eq!(fetched.content, "content");
        assert_eq!(fetched.change_summary, "summary");
        assert_eq!(fetched.name, "name");
        assert_eq!(fetched.description, "desc");
    }

    #[test]
    fn update_version_changes_metadata() {
        let db = crate::test_support::test_db();
        let item_id = create_test_item(&db);
        let created = create_version(&db, &item_id, "content", "", "old", "old desc").unwrap();

        let updated = update_version(&db, &created.id, "new name", "new desc").unwrap();
        assert_eq!(updated.name, "new name");
        assert_eq!(updated.description, "new desc");
        assert_eq!(updated.content, "content");
    }
}
