use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::version::VersionDto;
use crate::utils::ids;

pub fn create_version(
    db: &DbState,
    item_id: &str,
    content: &str,
    change_summary: &str,
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
        .unwrap_or(0);

    let id = ids::new_id("ver");
    let now = chrono::Utc::now().to_rfc3339();
    let version_number = max_ver + 1;

    conn.execute(
        "INSERT INTO versions (id, item_id, version_number, content, change_summary, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, item_id, version_number, content, change_summary, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(VersionDto {
        id,
        item_id: item_id.to_string(),
        version_number,
        content: content.to_string(),
        change_summary: change_summary.to_string(),
        created_at: now,
    })
}

pub fn get_versions(db: &DbState, item_id: &str) -> Result<Vec<VersionDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, version_number, content, change_summary, created_at
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
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}
