use rusqlite::{params, params_from_iter};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::SearchResultDto;

pub fn search(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let sql = if item_type.is_some() {
        "SELECT i.id, i.title, i.item_type, COALESCE(substr(i.content, 1, 100), '') as summary
         FROM items_fts f
         JOIN items i ON i.rowid = f.rowid
         WHERE items_fts MATCH ?1 AND i.item_type = ?2
         ORDER BY rank
         LIMIT 50"
    } else {
        "SELECT i.id, i.title, i.item_type, COALESCE(substr(i.content, 1, 100), '') as summary
         FROM items_fts f
         JOIN items i ON i.rowid = f.rowid
         WHERE items_fts MATCH ?1
         ORDER BY rank
         LIMIT 50"
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let results: Vec<SearchResultDto> = if let Some(t) = item_type {
        stmt.query_map(params![query, t], |row| {
            Ok(SearchResultDto {
                id: row.get(0)?,
                title: row.get(1)?,
                item_type: row.get(2)?,
                summary: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?
    } else {
        stmt.query_map(params![query], |row| {
            Ok(SearchResultDto {
                id: row.get(0)?,
                title: row.get(1)?,
                item_type: row.get(2)?,
                summary: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?
    };

    Ok(results)
}

pub fn search_trigram(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let sql = if item_type.is_some() {
        "SELECT i.id, i.title, i.item_type, COALESCE(substr(i.content, 1, 100), '') as summary
         FROM items_fts_trigram f
         JOIN items i ON i.rowid = f.rowid
         WHERE items_fts_trigram MATCH ?1 AND i.item_type = ?2
         ORDER BY rank
         LIMIT 50"
    } else {
        "SELECT i.id, i.title, i.item_type, COALESCE(substr(i.content, 1, 100), '') as summary
         FROM items_fts_trigram f
         JOIN items i ON i.rowid = f.rowid
         WHERE items_fts_trigram MATCH ?1
         ORDER BY rank
         LIMIT 50"
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let results: Vec<SearchResultDto> = if let Some(t) = item_type {
        stmt.query_map(params![query, t], |row| {
            Ok(SearchResultDto {
                id: row.get(0)?,
                title: row.get(1)?,
                item_type: row.get(2)?,
                summary: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?
    } else {
        stmt.query_map(params![query], |row| {
            Ok(SearchResultDto {
                id: row.get(0)?,
                title: row.get(1)?,
                item_type: row.get(2)?,
                summary: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?
    };

    Ok(results)
}

pub fn search_like(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let terms: Vec<&str> = query
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .collect();
    let terms = if terms.is_empty() { vec![query] } else { terms };
    let like_patterns: Vec<String> = terms
        .into_iter()
        .map(|term| format!("%{}%", escape_like(term)))
        .collect();

    if let Some(t) = item_type {
        let term_filters = vec![
            "(i.title LIKE ? ESCAPE '\\' OR i.content LIKE ? ESCAPE '\\' OR i.summary LIKE ? ESCAPE '\\')";
            like_patterns.len()
        ]
        .join(" AND ");
        let sql = format!(
            "SELECT i.id, i.title, i.item_type, COALESCE(substr(i.content, 1, 100), '') as summary
             FROM items i
             WHERE i.item_type = ? AND ({})
             ORDER BY i.updated_at DESC
             LIMIT 50",
            term_filters
        );
        let mut values = vec![t.to_string()];
        for pattern in &like_patterns {
            values.push(pattern.clone());
            values.push(pattern.clone());
            values.push(pattern.clone());
        }

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| AppError::Database(e.to_string()))?;

        let results: Vec<SearchResultDto> = stmt
            .query_map(params_from_iter(values.iter()), |row| {
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
    } else {
        let term_filters = vec![
            "(i.title LIKE ? ESCAPE '\\' OR i.content LIKE ? ESCAPE '\\' OR i.summary LIKE ? ESCAPE '\\')";
            like_patterns.len()
        ]
        .join(" AND ");
        let sql = format!(
            "SELECT i.id, i.title, i.item_type, COALESCE(substr(i.content, 1, 100), '') as summary
             FROM items i
             WHERE {}
             ORDER BY i.updated_at DESC
             LIMIT 50",
            term_filters
        );
        let mut values = Vec::new();
        for pattern in &like_patterns {
            values.push(pattern.clone());
            values.push(pattern.clone());
            values.push(pattern.clone());
        }

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| AppError::Database(e.to_string()))?;

        let results: Vec<SearchResultDto> = stmt
            .query_map(params_from_iter(values.iter()), |row| {
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
    use crate::repositories::item_repository;
    use crate::models::item::CreateItemPayload;

    fn seed_item(db: &DbState, title: &str, content: &str) {
        item_repository::create(
            db,
            CreateItemPayload {
                title: title.to_string(),
                item_type: "note".to_string(),
                content: Some(content.to_string()),
                summary: String::new(),
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
}
