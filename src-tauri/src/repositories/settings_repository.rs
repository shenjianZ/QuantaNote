use std::collections::HashMap;

use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;

pub fn get_all(db: &DbState) -> Result<HashMap<String, String>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| AppError::Database(e.to_string()))?;

    let rows = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut map = HashMap::new();
    for row in rows {
        let (k, v): (String, String) = row.map_err(|e| AppError::Database(e.to_string()))?;
        map.insert(k, v);
    }
    Ok(map)
}

pub fn upsert_batch(db: &DbState, entries: &HashMap<String, String>) -> Result<(), AppError> {
    let mut conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    {
        let mut stmt = tx
            .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
            .map_err(|e| AppError::Database(e.to_string()))?;

        for (key, value) in entries {
            stmt.execute(params![key, value])
                .map_err(|e| AppError::Database(e.to_string()))?;
        }
    }

    tx.commit().map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}
