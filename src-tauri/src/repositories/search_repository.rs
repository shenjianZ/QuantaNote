use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::SearchResultDto;

pub fn search(db: &DbState, query: &str) -> Result<Vec<SearchResultDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.title, i.item_type, COALESCE(substr(i.content, 1, 100), '') as summary
             FROM items_fts f
             JOIN items i ON i.rowid = f.rowid
             WHERE items_fts MATCH ?1
             ORDER BY rank
             LIMIT 50",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let results: Vec<SearchResultDto> = stmt
        .query_map(params![query], |row| {
            Ok(SearchResultDto {
                id: row.get(0)?,
                title: row.get(1)?,
                item_type: row.get(2)?,
                summary: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}
