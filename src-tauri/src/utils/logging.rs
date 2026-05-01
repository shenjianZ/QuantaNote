use log::LevelFilter;
use tauri::{plugin::TauriPlugin, Runtime};
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

use crate::utils::paths;

const SQL_KEYWORDS: &[&str] = &[
    "select",
    "insert",
    "update",
    "delete",
    "create",
    "drop",
    "alter",
    "from",
    "where",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "on",
    "and",
    "or",
    "order",
    "group",
    "by",
    "limit",
    "offset",
    "values",
    "set",
    "into",
    "table",
    "trigger",
    "virtual",
    "if",
    "exists",
    "not",
    "null",
    "primary",
    "key",
    "references",
    "default",
    "begin",
    "end",
    "pragma",
    "using",
];

pub fn tauri_log_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::Stdout))
        .target(Target::new(TargetKind::Folder {
            path: paths::quantanote_dir(),
            file_name: Some("quanta-note".to_string()),
        }))
        .level(LevelFilter::Debug)
        .rotation_strategy(RotationStrategy::KeepAll)
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .max_file_size(5_000_000)
        .format(|out, message, record| {
            out.finish(format_args!(
                "{} [{}] [{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                record.level(),
                record.target(),
                message
            ));
        })
        .build()
}

pub fn log_sql(sql: &str) {
    log::debug!(target: "sql", "\n{}", format_sql(sql));
}

pub fn format_sql(sql: &str) -> String {
    let tokens = tokenize_sql(sql);
    if tokens.is_empty() {
        return String::new();
    }

    let mut formatted = String::new();
    let mut previous_was_open_paren = false;
    let mut line_started = false;

    for (index, token) in tokens.iter().enumerate() {
        let text = keyword_text(token);

        if should_break_before(&tokens, index) && line_started {
            trim_end_spaces(&mut formatted);
            formatted.push('\n');
            line_started = false;
        }

        match text.as_str() {
            "," => {
                trim_end_spaces(&mut formatted);
                formatted.push(',');
                formatted.push('\n');
                formatted.push_str("  ");
                line_started = true;
                previous_was_open_paren = false;
            }
            "(" => {
                trim_end_spaces(&mut formatted);
                formatted.push('(');
                previous_was_open_paren = true;
                line_started = true;
            }
            ")" => {
                trim_end_spaces(&mut formatted);
                formatted.push(')');
                previous_was_open_paren = false;
                line_started = true;
            }
            ";" => {
                trim_end_spaces(&mut formatted);
                formatted.push(';');
                previous_was_open_paren = false;
                line_started = true;
            }
            _ => {
                if line_started && !previous_was_open_paren && !formatted.ends_with('\n') {
                    formatted.push(' ');
                }
                formatted.push_str(&text);
                previous_was_open_paren = false;
                line_started = true;
            }
        }
    }

    formatted
}

fn tokenize_sql(sql: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut chars = sql.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '\'' | '"' | '`' => {
                push_current(&mut tokens, &mut current);
                let quoted = read_quoted(ch, &mut chars);
                tokens.push(format!("{ch}{quoted}"));
            }
            '[' => {
                push_current(&mut tokens, &mut current);
                let quoted = read_bracket_quoted(&mut chars);
                tokens.push(format!("[{quoted}"));
            }
            '(' | ')' | ',' | ';' => {
                push_current(&mut tokens, &mut current);
                tokens.push(ch.to_string());
            }
            ch if ch.is_whitespace() => {
                push_current(&mut tokens, &mut current);
            }
            _ => current.push(ch),
        }
    }

    push_current(&mut tokens, &mut current);
    tokens
}

fn read_quoted<I>(quote: char, chars: &mut std::iter::Peekable<I>) -> String
where
    I: Iterator<Item = char>,
{
    let mut quoted = String::new();

    while let Some(ch) = chars.next() {
        quoted.push(ch);
        if ch == quote {
            if chars.peek().copied() == Some(quote) {
                quoted.push(chars.next().unwrap_or(quote));
            } else {
                break;
            }
        }
    }

    quoted
}

fn read_bracket_quoted<I>(chars: &mut std::iter::Peekable<I>) -> String
where
    I: Iterator<Item = char>,
{
    let mut quoted = String::new();

    while let Some(ch) = chars.next() {
        quoted.push(ch);
        if ch == ']' {
            break;
        }
    }

    quoted
}

fn push_current(tokens: &mut Vec<String>, current: &mut String) {
    if !current.is_empty() {
        tokens.push(std::mem::take(current));
    }
}

fn keyword_text(token: &str) -> String {
    if is_quoted(token) {
        return token.to_string();
    }

    let lower = token.to_ascii_lowercase();
    if SQL_KEYWORDS.contains(&lower.as_str()) {
        lower.to_ascii_uppercase()
    } else {
        token.to_string()
    }
}

fn is_quoted(token: &str) -> bool {
    token.starts_with('\'')
        || token.starts_with('"')
        || token.starts_with('`')
        || token.starts_with('[')
}

fn should_break_before(tokens: &[String], index: usize) -> bool {
    if index == 0 || is_quoted(&tokens[index]) {
        return false;
    }

    let current = tokens[index].to_ascii_lowercase();
    let previous = tokens
        .get(index.saturating_sub(1))
        .map(|token| token.to_ascii_lowercase());

    matches!(
        current.as_str(),
        "from"
            | "where"
            | "set"
            | "values"
            | "limit"
            | "offset"
            | "returning"
            | "join"
            | "left"
            | "right"
            | "inner"
            | "outer"
            | "group"
            | "order"
            | "on"
            | "begin"
            | "end"
    ) || matches!(current.as_str(), "and" | "or") && !matches!(previous.as_deref(), Some("between"))
}

fn trim_end_spaces(value: &mut String) {
    while value.ends_with(' ') {
        value.pop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_sql_simple_select() {
        let result = format_sql("SELECT * FROM items");
        assert!(result.contains("SELECT"));
        assert!(result.contains("FROM"));
        assert!(result.contains("items"));
    }

    #[test]
    fn format_sql_preserves_quoted_strings() {
        let result = format_sql("SELECT * FROM items WHERE title = 'hello world'");
        assert!(result.contains("'hello world'"));
    }

    #[test]
    fn tokenize_sql_handles_punctuation() {
        let tokens = tokenize_sql("a, b(c)");
        assert!(tokens.contains(&",".to_string()));
        assert!(tokens.contains(&"(".to_string()));
        assert!(tokens.contains(&")".to_string()));
    }

    #[test]
    fn keyword_text_uppercases_known_keywords() {
        assert_eq!(keyword_text("select"), "SELECT");
        assert_eq!(keyword_text("from"), "FROM");
        assert_eq!(keyword_text(" tablename "), " tablename ");
    }
}
