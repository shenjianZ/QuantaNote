use rusqlite::{params_from_iter, types::Value, Row};

use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::{SearchPageDto, SearchQuery, SearchResultDto, SearchTerm};

struct SearchRow {
    id: String,
    title: String,
    item_type: String,
    summary: String,
    content: String,
    created_at: String,
    updated_at: String,
    pinned: bool,
    favorite: bool,
    tags: String,
    attachments: String,
    versions: String,
}

fn row_to_search_row(row: &Row) -> rusqlite::Result<SearchRow> {
    Ok(SearchRow {
        id: row.get(0)?,
        title: row.get(1)?,
        item_type: row.get(2)?,
        summary: row.get(3)?,
        content: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        pinned: row.get::<_, i32>(7)? != 0,
        favorite: row.get::<_, i32>(8)? != 0,
        tags: row.get(9)?,
        attachments: row.get(10)?,
        versions: row.get(11)?,
    })
}

fn contains_term(text: &str, term: &SearchTerm) -> bool {
    !term.value.is_empty() && text.to_lowercase().contains(&term.value.to_lowercase())
}

fn compact_context(text: &str, term: Option<&SearchTerm>) -> String {
    if text.is_empty() {
        return String::new();
    }

    let Some(term) = term.filter(|term| !term.value.is_empty()) else {
        return text.chars().take(180).collect();
    };
    let lower_text = text.to_lowercase();
    let lower_term = term.value.to_lowercase();
    let Some(start) = lower_text.find(&lower_term) else {
        return text.chars().take(180).collect();
    };
    let end = start + lower_term.len();
    if !text.is_char_boundary(start) || !text.is_char_boundary(end) {
        return text.chars().take(180).collect();
    }

    let prefix: String = text[..start]
        .chars()
        .rev()
        .take(72)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    let suffix: String = text[end..].chars().take(108).collect();
    format!(
        "{}{}{}{}{}",
        if start > prefix.len() { "…" } else { "" },
        prefix,
        &text[start..end],
        suffix,
        if end < text.len() { "…" } else { "" },
    )
}

fn push_unique(values: &mut Vec<String>, value: &str) {
    if !values.iter().any(|existing| existing == value) {
        values.push(value.to_string());
    }
}

fn enrich_search_row(row: SearchRow, query: &SearchQuery) -> SearchResultDto {
    let sources = [
        ("title", row.title.as_str()),
        ("summary", row.summary.as_str()),
        ("content", row.content.as_str()),
        ("tags", row.tags.as_str()),
        ("attachments", row.attachments.as_str()),
        ("versions", row.versions.as_str()),
    ];
    let mut matched_fields = Vec::new();
    let mut highlight_terms = Vec::new();
    for term in query.positive_groups.iter().flatten() {
        for (field, text) in sources {
            if contains_term(text, term) {
                push_unique(&mut matched_fields, field);
                push_unique(&mut highlight_terms, &term.value);
            }
        }
    }

    let context = sources
        .iter()
        .find_map(|(_, text)| {
            query
                .positive_groups
                .iter()
                .flatten()
                .find(|term| contains_term(text, term))
                .map(|term| compact_context(text, Some(term)))
        })
        .unwrap_or_else(|| row.summary.chars().take(180).collect());

    SearchResultDto {
        id: row.id,
        title: row.title,
        item_type: row.item_type,
        summary: row.summary,
        created_at: row.created_at,
        updated_at: row.updated_at,
        pinned: row.pinned,
        favorite: row.favorite,
        matched_fields,
        context,
        highlight_terms,
    }
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

const SEARCH_SELECT_COLUMNS: &str = "
    i.id, i.title, i.item_type, COALESCE(i.summary, ''), COALESCE(i.content, ''),
    i.created_at, i.updated_at, i.pinned, i.favorite,
    COALESCE((
        SELECT GROUP_CONCAT(t.name, char(10))
        FROM item_tags it JOIN tags t ON t.id = it.tag_id
        WHERE it.item_id = i.id
    ), ''),
    COALESCE((
        SELECT GROUP_CONCAT(a.filename, char(10))
        FROM attachments a WHERE a.item_id = i.id
    ), ''),
    COALESCE((
        SELECT GROUP_CONCAT(
            trim(COALESCE(v.name, '') || ' ' || COALESCE(v.description, '') || ' ' ||
                 COALESCE(v.change_summary, '') || ' ' || COALESCE(v.content, '')),
            char(10)
        )
        FROM versions v WHERE v.item_id = i.id
    ), '')";

#[allow(dead_code)]
fn content_scopes() -> [String; 1] {
    ["content".to_string()]
}

fn scope_enabled(scopes: &[String], scope: &str) -> bool {
    scopes.is_empty() || scopes.iter().any(|item| item == scope)
}

fn append_like_condition(
    clauses: &mut Vec<String>,
    values: &mut Vec<Value>,
    expression: &str,
    pattern: &Value,
) {
    clauses.push(format!("{} LIKE ? ESCAPE '\\'", expression));
    values.push(pattern.clone());
}

fn term_match_clause(term: &SearchTerm, scopes: &[String], values: &mut Vec<Value>) -> String {
    let pattern = Value::Text(format!("%{}%", escape_like(&term.value)));
    let mut clauses = Vec::new();

    if scope_enabled(scopes, "content") {
        for expression in ["i.title", "i.content", "i.summary"] {
            append_like_condition(&mut clauses, values, expression, &pattern);
        }
    }
    if scope_enabled(scopes, "tags") {
        clauses.push(
            "EXISTS (
                SELECT 1 FROM item_tags it
                JOIN tags t ON t.id = it.tag_id
                WHERE it.item_id = i.id AND t.name LIKE ? ESCAPE '\\'
            )"
            .to_string(),
        );
        values.push(pattern.clone());
    }
    if scope_enabled(scopes, "attachments") {
        clauses.push(
            "EXISTS (
                SELECT 1 FROM attachments a
                WHERE a.item_id = i.id AND a.filename LIKE ? ESCAPE '\\'
            )"
            .to_string(),
        );
        values.push(pattern.clone());
    }
    if scope_enabled(scopes, "versions") {
        let version_clauses = ["v.name", "v.description", "v.change_summary", "v.content"]
            .into_iter()
            .map(|expression| format!("{} LIKE ? ESCAPE '\\'", expression))
            .collect::<Vec<_>>();
        clauses.push(format!(
            "EXISTS (
                SELECT 1 FROM versions v
                WHERE v.item_id = i.id AND ({})
            )",
            version_clauses.join(" OR ")
        ));
        for _ in 0..4 {
            values.push(pattern.clone());
        }
    }

    if clauses.is_empty() {
        "0".to_string()
    } else {
        format!("({})", clauses.join(" OR "))
    }
}

fn append_query_conditions(
    conditions: &mut Vec<String>,
    values: &mut Vec<Value>,
    query: &SearchQuery,
    scopes: &[String],
) {
    for group in &query.positive_groups {
        let clauses = group
            .iter()
            .map(|term| term_match_clause(term, scopes, values))
            .collect::<Vec<_>>();
        if !clauses.is_empty() {
            conditions.push(format!("({})", clauses.join(" OR ")));
        }
    }
    for term in &query.excluded_terms {
        conditions.push(format!("NOT {}", term_match_clause(term, scopes, values)));
    }
}

#[allow(dead_code)]
pub fn search(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    Ok(search_page(db, query, item_type, None, None, None, 50, 0)?.results)
}

#[allow(dead_code)]
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
    let plan = SearchQuery::normal(query);
    let scopes = content_scopes();
    search_page_with_query(
        db, query, item_type, tab, tag, sort, &scopes, &plan, limit, offset,
    )
}

pub fn search_page_with_query(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    _scopes: &[String],
    plan: &SearchQuery,
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
        plan,
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
    plan: &SearchQuery,
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
        "SELECT {SEARCH_SELECT_COLUMNS}
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
        .query_map(params_from_iter(page_values.iter()), row_to_search_row)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(SearchPageDto {
        results: results
            .into_iter()
            .map(|row| enrich_search_row(row, plan))
            .collect(),
        total,
    })
}

#[allow(dead_code)]
pub fn search_trigram(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    Ok(search_trigram_page(db, query, item_type, None, None, None, 50, 0)?.results)
}

#[allow(dead_code)]
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
    let plan = SearchQuery::normal(query);
    let scopes = content_scopes();
    search_trigram_page_with_query(
        db, query, item_type, tab, tag, sort, &scopes, &plan, limit, offset,
    )
}

pub fn search_trigram_page_with_query(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    _scopes: &[String],
    plan: &SearchQuery,
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
        plan,
    )
}

#[allow(dead_code)]
pub fn search_like(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    Ok(search_like_page(db, query, item_type, None, None, None, 50, 0)?.results)
}

#[allow(dead_code)]
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
    let plan = SearchQuery::normal(query);
    let scopes = content_scopes();
    search_like_page_with_query(db, item_type, tab, tag, sort, &scopes, &plan, limit, offset)
}

pub fn search_like_page_with_query(
    db: &DbState,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    scopes: &[String],
    plan: &SearchQuery,
    limit: i64,
    offset: i64,
) -> Result<SearchPageDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut conditions = Vec::new();
    let mut values = Vec::new();
    append_item_filters(&mut conditions, &mut values, item_type, tab, tag);
    append_query_conditions(&mut conditions, &mut values, plan, scopes);
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
        "SELECT {SEARCH_SELECT_COLUMNS}
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
        .query_map(params_from_iter(page_values.iter()), row_to_search_row)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(SearchPageDto {
        results: results
            .into_iter()
            .map(|row| enrich_search_row(row, plan))
            .collect(),
        total,
    })
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
