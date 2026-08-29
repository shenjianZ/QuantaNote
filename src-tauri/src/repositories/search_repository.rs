use rusqlite::{params_from_iter, types::Value, Row};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::{SearchPageDto, SearchResultDto};

fn row_to_search_result(row: &Row) -> rusqlite::Result<SearchResultDto> {
    Ok(SearchResultDto {
        id: row.get(0)?,
        title: row.get(1)?,
        item_type: row.get(2)?,
        summary: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        pinned: row.get::<_, i32>(6)? != 0,
        favorite: row.get::<_, i32>(7)? != 0,
    })
}

fn append_item_filters(
    conditions: &mut Vec<String>,
    values: &mut Vec<Value>,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
) {
    conditions.push("i.deleted_at IS NULL".to_string());

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
}

fn order_clause(sort: Option<&str>, ranked: bool) -> &'static str {
    match sort {
        Some("created") => "i.created_at DESC, i.id DESC",
        Some("title") => "i.title COLLATE NOCASE ASC, i.id ASC",
        Some("updated") => "i.updated_at DESC, i.id DESC",
        _ if ranked => "rank, i.id ASC",
        _ => "i.updated_at DESC, i.id DESC",
    }
}

pub fn search(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    Ok(search_page(db, query, item_type, None, None, None, 50, 0)?.results)
}

pub fn search_page(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<SearchPageDto, AppError> {
    search_fts_page(
        db,
        "items_fts",
        query,
        item_type,
        tab,
        tag,
        sort,
        limit,
        offset,
    )
}

fn search_fts_page(
    db: &DbState,
    table: &str,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<SearchPageDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut conditions = vec![format!("{} MATCH ?", table)];
    let mut values = vec![Value::Text(query.to_string())];
    append_item_filters(&mut conditions, &mut values, item_type, tab, tag);
    let where_clause = conditions.join(" AND ");

    let count_sql = format!(
        "SELECT COUNT(*) FROM {table} f JOIN items i ON i.rowid = f.rowid WHERE {where_clause}"
    );
    let total = conn
        .query_row(&count_sql, params_from_iter(values.iter()), |row| {
            row.get(0)
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let page_limit = limit.clamp(1, 200);
    let page_offset = offset.max(0);
    let page_sql = format!(
        "SELECT i.id, i.title, i.item_type, COALESCE(i.summary, ''), i.created_at, i.updated_at, i.pinned, i.favorite
         FROM {table} f JOIN items i ON i.rowid = f.rowid
         WHERE {where_clause}
         ORDER BY {} LIMIT ? OFFSET ?",
        order_clause(sort, true)
    );
    let mut page_values = values;
    page_values.push(Value::Integer(page_limit));
    page_values.push(Value::Integer(page_offset));
    let mut stmt = conn
        .prepare(&page_sql)
        .map_err(|e| AppError::Database(e.to_string()))?;
    let results = stmt
        .query_map(params_from_iter(page_values.iter()), row_to_search_result)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(SearchPageDto { results, total })
}

pub fn search_trigram(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    Ok(search_trigram_page(db, query, item_type, None, None, None, 50, 0)?.results)
}

pub fn search_trigram_page(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<SearchPageDto, AppError> {
    search_fts_page(
        db,
        "items_fts_trigram",
        query,
        item_type,
        tab,
        tag,
        sort,
        limit,
        offset,
    )
}

pub fn search_like(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    Ok(search_like_page(db, query, item_type, None, None, None, 50, 0)?.results)
}

pub fn search_like_page(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<SearchPageDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let like_patterns: Vec<String> = query
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(|term| format!("%{}%", escape_like(term)))
        .collect();
    let like_patterns = if like_patterns.is_empty() {
        vec![format!("%{}%", escape_like(query))]
    } else {
        like_patterns
    };

    let mut conditions = Vec::new();
    let mut values = Vec::new();
    append_item_filters(&mut conditions, &mut values, item_type, tab, tag);
    for _ in &like_patterns {
        conditions.push(
            "(i.title LIKE ? ESCAPE '\\' OR i.content LIKE ? ESCAPE '\\' OR i.summary LIKE ? ESCAPE '\\')"
                .to_string(),
        );
    }
    for pattern in &like_patterns {
        values.push(Value::Text(pattern.clone()));
        values.push(Value::Text(pattern.clone()));
        values.push(Value::Text(pattern.clone()));
    }
    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM items i WHERE {}", where_clause);
    let total = conn
        .query_row(&count_sql, params_from_iter(values.iter()), |row| {
            row.get(0)
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let page_limit = limit.clamp(1, 200);
    let page_offset = offset.max(0);
    let page_sql = format!(
        "SELECT i.id, i.title, i.item_type, COALESCE(i.summary, ''), i.created_at, i.updated_at, i.pinned, i.favorite
         FROM items i WHERE {} ORDER BY {} LIMIT ? OFFSET ?",
        where_clause,
        order_clause(sort, false)
    );
    let mut page_values = values;
    page_values.push(Value::Integer(page_limit));
    page_values.push(Value::Integer(page_offset));
    let mut stmt = conn
        .prepare(&page_sql)
        .map_err(|e| AppError::Database(e.to_string()))?;
    let results = stmt
        .query_map(params_from_iter(page_values.iter()), row_to_search_result)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(SearchPageDto { results, total })
}

fn escape_like(term: &str) -> String {
    let mut escaped = String::with_capacity(term.len());
    for c in term.chars() {
        if matches!(c, '\\' | '%' | '_') {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::item::CreateItemPayload;
    use crate::repositories::item_repository;

    fn seed_item(db: &DbState, title: &str, content: &str) {
        seed_item_with_summary(db, title, content, "");
    }

    fn seed_item_with_summary(db: &DbState, title: &str, content: &str, summary: &str) {
        item_repository::create(
            db,
            CreateItemPayload {
                title: title.to_string(),
                item_type: "note".to_string(),
                content: Some(content.to_string()),
                summary: summary.to_string(),
            },
        )
        .unwrap();
    }

    #[test]
    fn search_fts_finds_matching_items() {
        let db = crate::test_support::test_db();
        seed_item(&db, "Rust Guide", "Learn Rust programming");
        seed_item(&db, "Cooking Tips", "How to bake bread");

        let results = search(&db, "rust*", None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Rust Guide");
    }

    #[test]
    fn search_trigram_finds_substring() {
        let db = crate::test_support::test_db();
        seed_item(&db, "笔记", "全文检索系统测试");

        let results = search_trigram(&db, "全文检", None).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "笔记");
    }

    #[test]
    fn search_like_finds_partial_match() {
        let db = crate::test_support::test_db();
        seed_item(&db, "My Document", "Some important content here");

        let results = search_like(&db, "important", None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "My Document");
    }

    #[test]
    fn search_result_uses_item_summary_not_content_excerpt() {
        let db = crate::test_support::test_db();
        seed_item_with_summary(
            &db,
            "Summary Test",
            "content-only match text",
            "manually edited summary",
        );

        let results = search_like(&db, "content-only", None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].summary, "manually edited summary");
    }

    #[test]
    fn search_excludes_items_in_trash() {
        let db = crate::test_support::test_db();
        let item = item_repository::create(
            &db,
            CreateItemPayload {
                title: "回收站内容".to_string(),
                item_type: "note".to_string(),
                content: Some("should not be searchable".to_string()),
                summary: "trash".to_string(),
            },
        )
        .unwrap();
        item_repository::trash(&db, &item.id).unwrap();

        assert!(search(&db, "回收站*", None).unwrap().is_empty());
        assert!(search_like(&db, "should not", None).unwrap().is_empty());
    }
}
