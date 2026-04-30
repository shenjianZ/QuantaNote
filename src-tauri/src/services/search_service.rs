use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::SearchResultDto;
use crate::repositories::search_repository;

fn is_cjk(c: char) -> bool {
    ('\u{4E00}'..='\u{9FFF}').contains(&c)   // CJK 统一汉字
        || ('\u{3400}'..='\u{4DBF}').contains(&c)  // CJK 扩展 A
        || ('\u{3040}'..='\u{30FF}').contains(&c)  // 日文
        || ('\u{AC00}'..='\u{D7AF}').contains(&c)
    // 韩文
}

fn contains_cjk(query: &str) -> bool {
    query.chars().any(is_cjk)
}

fn cjk_char_count(query: &str) -> usize {
    query.chars().filter(|c| is_cjk(*c)).count()
}

fn is_fts_token_char(c: char) -> bool {
    c == '_' || c.is_alphanumeric() || is_cjk(c)
}

fn build_quoted_fts_query(query: &str) -> Option<String> {
    if query
        .chars()
        .any(|c| !c.is_whitespace() && !is_fts_token_char(c))
    {
        return None;
    }

    let terms: Vec<String> = query
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect();

    if terms.is_empty() {
        return None;
    }

    Some(terms.join(" "))
}

fn build_fts_query(query: &str) -> Option<String> {
    if query
        .chars()
        .any(|c| !c.is_whitespace() && !is_fts_token_char(c))
    {
        return None;
    }

    let mut terms = Vec::new();
    let mut current = String::new();

    for c in query.chars() {
        if is_fts_token_char(c) {
            current.push(c);
        } else if !current.is_empty() {
            terms.push(std::mem::take(&mut current));
        }
    }

    if !current.is_empty() {
        terms.push(current);
    }

    if terms.is_empty() {
        return None;
    }

    Some(
        terms
            .into_iter()
            .map(|term| format!("\"{}\"*", term.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" "),
    )
}

pub fn search_items(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    let cleaned: String = query.chars().filter(|c| !c.is_control()).collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        return Ok(vec![]);
    }

    // trigram 可以让中文在 FTS5 内做子串检索，但 1~2 字查询仍然需要 LIKE。
    if contains_cjk(cleaned) {
        if cjk_char_count(cleaned) >= 3 {
            if let Some(fts_query) = build_quoted_fts_query(cleaned) {
                match search_repository::search_trigram(db, &fts_query, item_type) {
                    Ok(fts_results) if !fts_results.is_empty() => {
                        log::info!(
                            "[search] 中文 trigram FTS5 命中 | query=\"{}\" | fts_query=\"{}\" | results={}",
                            cleaned,
                            fts_query,
                            fts_results.len()
                        );
                        return Ok(fts_results);
                    }
                    Ok(_) => {}
                    Err(error) => {
                        log::warn!(
                            "[search] 中文 trigram FTS5 查询失败，fallback → LIKE | query=\"{}\" | error={}",
                            cleaned,
                            error
                        );
                    }
                }
            }
        }

        log::info!("[search] 中文查询 fallback → LIKE | query=\"{}\"", cleaned);
        let like_results = search_repository::search_like(db, cleaned, item_type)?;
        log::info!(
            "[search] LIKE 命中 | query=\"{}\" | results={}",
            cleaned,
            like_results.len()
        );
        return Ok(like_results);
    }

    // 其余：FTS5 → LIKE fallback
    if let Some(fts_query) = build_fts_query(cleaned) {
        match search_repository::search(db, &fts_query, item_type) {
            Ok(fts_results) if !fts_results.is_empty() => {
                log::info!(
                    "[search] FTS5 命中 | query=\"{}\" | fts_query=\"{}\" | results={}",
                    cleaned,
                    fts_query,
                    fts_results.len()
                );
                return Ok(fts_results);
            }
            Ok(_) => {}
            Err(error) => {
                log::warn!(
                    "[search] FTS5 查询失败，fallback → LIKE | query=\"{}\" | error={}",
                    cleaned,
                    error
                );
            }
        }
    }

    log::info!(
        "[search] FTS5 无结果，fallback → LIKE | query=\"{}\"",
        cleaned
    );
    let like_results = search_repository::search_like(db, cleaned, item_type)?;
    log::info!(
        "[search] LIKE 命中 | query=\"{}\" | results={}",
        cleaned,
        like_results.len()
    );
    Ok(like_results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbState;

    fn test_db() -> DbState {
        let db = DbState::open(":memory:").expect("open in-memory database");
        db.initialize_schema().expect("initialize schema");
        {
            let conn = db.conn.lock().expect("lock connection");
            conn.execute(
                "INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
                 VALUES ('1', 'Rust SQLite', 'note', 'rust sqlite fts5 search', 'backend notes', '2026-01-01', '2026-01-01')",
                [],
            )
            .expect("insert english item");
            conn.execute(
                "INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
                 VALUES ('2', '中文笔记', 'note', '这是一个中文搜索测试', '本地全文检索', '2026-01-01', '2026-01-01')",
                [],
            )
            .expect("insert chinese item");
            conn.execute(
                "INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
                 VALUES ('3', 'C++ notes', 'note', 'C++ foo-bar examples', 'symbols', '2026-01-01', '2026-01-01')",
                [],
            )
            .expect("insert symbol item");
        }
        db
    }

    #[test]
    fn builds_safe_prefix_fts_query() {
        assert_eq!(
            build_fts_query("rus sql").as_deref(),
            Some("\"rus\"* \"sql\"*")
        );
        assert_eq!(build_fts_query("C++"), None);
        assert_eq!(build_fts_query(":").as_deref(), None);
    }

    #[test]
    fn builds_safe_quoted_fts_query() {
        assert_eq!(
            build_quoted_fts_query("中文搜索 rust").as_deref(),
            Some("\"中文搜索\" \"rust\"")
        );
        assert_eq!(build_quoted_fts_query("C++"), None);
    }

    #[test]
    fn searches_english_prefix_with_fts() {
        let db = test_db();
        let results = search_items(&db, "rus", None).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "1");
    }

    #[test]
    fn searches_chinese_long_query_with_trigram_fts() {
        let db = test_db();
        let fts_query = build_quoted_fts_query("中文搜索").expect("fts query");
        let results = search_repository::search_trigram(&db, &fts_query, None).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "2");
    }

    #[test]
    fn searches_chinese_substrings_with_like() {
        let db = test_db();
        let results = search_items(&db, "搜索", None).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "2");
    }

    #[test]
    fn symbol_queries_do_not_fail_fts_syntax() {
        let db = test_db();
        let results = search_items(&db, "C++", None).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "3");
    }
}
