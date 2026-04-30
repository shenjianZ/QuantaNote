use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::item::*;
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
             FROM items WHERE item_type = ?1 ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows: Vec<ItemDto> = stmt
            .query_map(params![t, limit, offset], row_to_item)
            .map_err(|e| AppError::Database(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();
        rows
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
             FROM items ORDER BY updated_at DESC LIMIT ?1 OFFSET ?2"
        ).map_err(|e| AppError::Database(e.to_string()))?;
        let rows: Vec<ItemDto> = stmt
            .query_map(params![limit, offset], row_to_item)
            .map_err(|e| AppError::Database(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();
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
         FROM items WHERE id = ?1"
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
         FROM items WHERE id = ?1",
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

pub fn delete(db: &DbState, id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let rows = conn
        .execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Item {}", id)));
    }
    Ok(())
}

pub fn get_pinned(db: &DbState) -> Result<Vec<ItemDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn.prepare(
        "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
         FROM items WHERE pinned = 1 ORDER BY updated_at DESC"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<ItemDto> = stmt
        .query_map([], row_to_item)
        .map_err(|e| AppError::Database(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

pub fn get_recent(db: &DbState, limit: i64) -> Result<Vec<ItemDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut stmt = conn.prepare(
        "SELECT id, title, item_type, content, summary, pinned, favorite, encrypted, created_at, updated_at
         FROM items ORDER BY updated_at DESC LIMIT ?1"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let items: Vec<ItemDto> = stmt
        .query_map(params![limit], row_to_item)
        .map_err(|e| AppError::Database(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}
