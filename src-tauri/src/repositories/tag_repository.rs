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
        .filter_map(|r| r.ok())
        .collect();

    Ok(tags)
}

pub fn create_tag(db: &DbState, name: &str, color: &str) -> Result<TagDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        params![name, color],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(TagDto {
        name: name.to_string(),
        color: color.to_string(),
    })
}

pub fn delete_tag(db: &DbState, name: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute("DELETE FROM tags WHERE name = ?1", params![name])
        .map_err(|e| AppError::Database(e.to_string()))?;
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
        .filter_map(|r| r.ok())
        .collect();

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
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

pub fn set_item_tags(db: &DbState, item_id: &str, tag_names: Vec<String>) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 清除现有关联
    conn.execute("DELETE FROM item_tags WHERE item_id = ?1", params![item_id])
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 添加新关联
    for name in &tag_names {
        // 确保 tag 存在，获取 id
        let tag_id: i64 = conn
            .query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![name],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        conn.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
            params![item_id, tag_id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    Ok(())
}
