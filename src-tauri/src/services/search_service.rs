use crate::db::DbState;
use crate::error::AppError;
use crate::models::search::{SearchPageDto, SearchQuery, SearchResultDto, SearchTerm};
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

fn tokenize_advanced_query(query: &str) -> Result<Vec<String>, AppError> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quoted = false;

    for character in query.chars() {
        if character == '"' {
            if quoted {
                if current.is_empty() {
                    return Err(AppError::Validation("高级搜索中的引号不能为空".to_string()));
                }
                tokens.push(std::mem::take(&mut current));
                quoted = false;
            } else {
                if !current.is_empty() {
                    return Err(AppError::Validation(
                        "高级搜索的引号必须包围一个完整词组".to_string(),
                    ));
                }
                quoted = true;
            }
        } else if character.is_whitespace() && !quoted {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
        } else {
            if character.is_control() {
                continue;
            }
            current.push(character);
        }
    }

    if quoted {
        return Err(AppError::Validation("高级搜索的引号没有闭合".to_string()));
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    Ok(tokens)
}

fn parse_advanced_query(query: &str) -> Result<SearchQuery, AppError> {
    let tokens = tokenize_advanced_query(query)?;
    let mut parsed = SearchQuery::default();
    let mut join_with_or = false;
    let mut negate_next = false;

    for token in tokens {
        let upper = token.to_ascii_uppercase();
        if upper == "OR" {
            if parsed.positive_groups.last().is_none() || join_with_or {
                return Err(AppError::Validation(
                    "高级搜索中的 OR 必须连接两个关键词".to_string(),
                ));
            }
            join_with_or = true;
            continue;
        }
        if upper == "AND" {
            join_with_or = false;
            continue;
        }
        if upper == "NOT" {
            negate_next = true;
            join_with_or = false;
            continue;
        }

        let mut value = token.as_str();
        let mut negative = negate_next;
        negate_next = false;
        if let Some(rest) = value.strip_prefix('-') {
            negative = true;
            value = rest;
        }
        if value.is_empty() {
            return Err(AppError::Validation(
                "高级搜索中的排除词不能为空".to_string(),
            ));
        }

        let wildcard = value.ends_with('*');
        if wildcard {
            value = value.trim_end_matches('*');
        }
        if value.is_empty() || value.contains('*') {
            return Err(AppError::Validation(
                "高级搜索的通配符只能放在关键词末尾".to_string(),
            ));
        }

        let term = SearchTerm {
            value: value.to_string(),
            wildcard,
        };
        if negative {
            parsed.excluded_terms.push(term);
            join_with_or = false;
        } else if join_with_or {
            if let Some(group) = parsed.positive_groups.last_mut() {
                group.push(term);
            }
            join_with_or = false;
        } else {
            parsed.positive_groups.push(vec![term]);
        }
    }

    if join_with_or || negate_next {
        return Err(AppError::Validation(
            "高级搜索运算符后缺少关键词".to_string(),
        ));
    }
    if parsed.positive_groups.is_empty() && parsed.excluded_terms.is_empty() {
        return Err(AppError::Validation(
            "请输入有效的高级搜索关键词".to_string(),
        ));
    }
    Ok(parsed)
}

fn build_advanced_fts_query(query: &SearchQuery) -> Option<String> {
    fn format_term(term: &SearchTerm) -> Option<String> {
        if term.value.is_empty() || term.value.chars().any(|c| !is_fts_token_char(c)) {
            return None;
        }
        Some(format!(
            "\"{}\"{}",
            term.value.replace('"', "\"\""),
            if term.wildcard { "*" } else { "" }
        ))
    }

    if query.positive_groups.is_empty() {
        return None;
    }
    let groups = query
        .positive_groups
        .iter()
        .map(|group| {
            let terms = group.iter().map(format_term).collect::<Option<Vec<_>>>()?;
            Some(if terms.len() > 1 {
                format!("({})", terms.join(" OR "))
            } else {
                terms[0].clone()
            })
        })
        .collect::<Option<Vec<_>>>()?;
    let mut expression = groups.join(" AND ");
    for term in &query.excluded_terms {
        expression.push_str(" NOT ");
        expression.push_str(&format_term(term)?);
    }
    Some(expression)
}

fn normalize_scopes(raw_scopes: &[String]) -> Result<Vec<String>, AppError> {
    let scopes = if raw_scopes.is_empty() {
        vec!["content".to_string()]
    } else {
        raw_scopes.to_vec()
    };
    let mut normalized = Vec::new();
    for scope in scopes {
        if !matches!(
            scope.as_str(),
            "content" | "tags" | "attachments" | "versions"
        ) {
            return Err(AppError::Validation(format!("不支持的搜索范围: {}", scope)));
        }
        if !normalized.contains(&scope) {
            normalized.push(scope);
        }
    }
    Ok(normalized)
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

#[allow(dead_code)]
pub fn search_items(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
) -> Result<Vec<SearchResultDto>, AppError> {
    Ok(search_items_page(db, query, item_type, None, None, None, 50, 0)?.results)
}

#[allow(dead_code)]
pub fn search_items_page(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<SearchPageDto, AppError> {
    search_items_page_with_options(
        db,
        query,
        item_type,
        tab,
        tag,
        sort,
        "normal",
        &[],
        limit,
        offset,
    )
}

pub fn search_items_page_with_options(
    db: &DbState,
    query: &str,
    item_type: Option<&str>,
    tab: Option<&str>,
    tag: Option<&str>,
    sort: Option<&str>,
    mode: &str,
    raw_scopes: &[String],
    limit: i64,
    offset: i64,
) -> Result<SearchPageDto, AppError> {
    if !(1..=200).contains(&limit) {
        return Err(AppError::Validation(
            "搜索分页大小必须在 1 到 200 之间".to_string(),
        ));
    }
    if offset < 0 {
        return Err(AppError::Validation("搜索偏移量不能为负数".to_string()));
    }
    if !matches!(mode, "normal" | "advanced") {
        return Err(AppError::Validation(format!("不支持的搜索模式: {}", mode)));
    }
    let scopes = normalize_scopes(raw_scopes)?;
    let cleaned: String = query.chars().filter(|c| !c.is_control()).collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        return Ok(SearchPageDto {
            results: vec![],
            total: 0,
        });
    }

    let plan = if mode == "advanced" {
        parse_advanced_query(cleaned)?
    } else {
        SearchQuery::normal(cleaned)
    };

    // 关联标签、附件和版本不在 FTS 表中，选择这些范围时使用安全的参数化 LIKE 查询。
    let content_only = scopes.len() == 1 && scopes[0] == "content";
    if !content_only {
        return search_repository::search_like_page_with_query(
            db, item_type, tab, tag, sort, &scopes, &plan, limit, offset,
        );
    }

    // trigram 可以让中文在 FTS5 内做子串检索，但 1~2 字查询仍然需要 LIKE。
    if contains_cjk(cleaned) {
        let fts_query = if mode == "advanced" {
            build_advanced_fts_query(&plan)
        } else if cjk_char_count(cleaned) >= 3 {
            build_quoted_fts_query(cleaned)
        } else {
            None
        };
        if let Some(fts_query) = fts_query {
            match search_repository::search_trigram_page_with_query(
                db, &fts_query, item_type, tab, tag, sort, &scopes, &plan, limit, offset,
            ) {
                Ok(fts_page) if fts_page.total > 0 => {
                    log::info!(
                            "[search] 中文 trigram FTS5 命中 | query=\"{}\" | fts_query=\"{}\" | results={}",
                            cleaned,
                            fts_query,
                            fts_page.results.len()
                        );
                    return Ok(fts_page);
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

        log::info!("[search] 中文查询 fallback → LIKE | query=\"{}\"", cleaned);
        let like_results = search_repository::search_like_page_with_query(
            db, item_type, tab, tag, sort, &scopes, &plan, limit, offset,
        )?;
        log::info!(
            "[search] LIKE 命中 | query=\"{}\" | results={}",
            cleaned,
            like_results.results.len()
        );
        return Ok(like_results);
    }

    // 其余：FTS5 → LIKE fallback
    let fts_query = if mode == "advanced" {
        build_advanced_fts_query(&plan)
    } else {
        build_fts_query(cleaned)
    };
    if let Some(fts_query) = fts_query {
        match search_repository::search_page_with_query(
            db, &fts_query, item_type, tab, tag, sort, &scopes, &plan, limit, offset,
        ) {
            Ok(fts_page) if fts_page.total > 0 => {
                log::info!(
                    "[search] FTS5 命中 | query=\"{}\" | fts_query=\"{}\" | results={}",
                    cleaned,
                    fts_query,
                    fts_page.results.len()
                );
                return Ok(fts_page);
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
    let like_results = search_repository::search_like_page_with_query(
        db, item_type, tab, tag, sort, &scopes, &plan, limit, offset,
    )?;
    log::info!(
        "[search] LIKE 命中 | query=\"{}\" | results={}",
        cleaned,
        like_results.results.len()
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
    fn parses_advanced_boolean_query_and_wildcard() {
        let plan = parse_advanced_query("rust OR cook* -draft").expect("parse advanced query");
        assert_eq!(plan.positive_groups.len(), 1);
        assert_eq!(plan.positive_groups[0].len(), 2);
        assert_eq!(plan.positive_groups[1 - 1][1].value, "cook");
        assert!(plan.positive_groups[0][1].wildcard);
        assert_eq!(plan.excluded_terms[0].value, "draft");
        assert_eq!(
            build_advanced_fts_query(&plan).as_deref(),
            Some("(\"rust\" OR \"cook\"*) NOT \"draft\"")
        );
    }

    #[test]
    fn advanced_search_applies_or_and_exclusion() {
        let db = test_db();
        let page = search_items_page_with_options(
            &db,
            "rust OR 中文 -sqlite",
            None,
            None,
            None,
            None,
            "advanced",
            &[],
            10,
            0,
        )
        .expect("advanced search");
        assert_eq!(page.total, 1);
        assert_eq!(page.results[0].id, "2");
        assert!(page.results[0]
            .matched_fields
            .contains(&"content".to_string()));
        assert!(page.results[0].context.contains("中文"));
        assert!(page.results[0]
            .highlight_terms
            .contains(&"中文".to_string()));
    }

    #[test]
    fn search_can_include_tags_attachments_and_versions() {
        let db = test_db();
        {
            let conn = db.conn.lock().expect("lock connection");
            conn.execute(
                "INSERT INTO items (id, title, item_type, content, summary, created_at, updated_at)
                 VALUES ('4', 'Related fields', 'note', 'ordinary body', '', '2026-01-01', '2026-01-01')",
                [],
            )
            .expect("insert related item");
            conn.execute(
                "INSERT INTO tags (uuid, name) VALUES ('tag-4', 'project')",
                [],
            )
            .expect("insert tag");
            let tag_id: i64 = conn
                .query_row("SELECT id FROM tags WHERE name = 'project'", [], |row| {
                    row.get(0)
                })
                .expect("tag id");
            conn.execute(
                "INSERT INTO item_tags (item_id, tag_id) VALUES ('4', ?1)",
                [tag_id],
            )
            .expect("link tag");
            conn.execute(
                "INSERT INTO attachments (id, item_id, filename, file_path, created_at)
                 VALUES ('att-4', '4', 'invoice.pdf', 'attachments/4/invoice.pdf', '2026-01-01')",
                [],
            )
            .expect("insert attachment");
            conn.execute(
                "INSERT INTO versions (id, item_id, version_number, content, name, created_at)
                 VALUES ('ver-4', '4', 1, 'legacy contract text', 'v1', '2026-01-01')",
                [],
            )
            .expect("insert version");
        }

        for (query, scope, expected_field) in [
            ("project", "tags", "tags"),
            ("invoice", "attachments", "attachments"),
            ("legacy", "versions", "versions"),
        ] {
            let scopes = vec![scope.to_string()];
            let page = search_items_page_with_options(
                &db, query, None, None, None, None, "normal", &scopes, 10, 0,
            )
            .expect("related field search");
            assert_eq!(page.total, 1, "query={query}");
            assert_eq!(page.results[0].id, "4", "query={query}");
            assert!(
                page.results[0]
                    .matched_fields
                    .contains(&expected_field.to_string()),
                "query={query} fields={:?}",
                page.results[0].matched_fields
            );
        }
    }

    #[test]
    fn searches_english_prefix_with_fts() {
        let db = test_db();
        let results = search_items(&db, "rus", None).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "1");
    }

    #[test]
    fn search_items_page_returns_total_and_offset_page() {
        let db = test_db();
        let page =
            search_items_page(&db, "rust", None, None, None, None, 1, 0).expect("search page");
        assert_eq!(page.total, 1);
        assert_eq!(page.results.len(), 1);
        assert_eq!(page.results[0].created_at, "2026-01-01");
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
