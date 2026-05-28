use log::LevelFilter;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::OnceLock;
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

const SQL_LOG_FILE_NAME: &str = "quanta-note-sql.log";
const DEFAULT_SQL_LOG_MAX_LEN: usize = 4_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlLogConfig {
    pub enabled: bool,
    pub to_console: bool,
    pub to_file: bool,
    pub pretty: bool,
    pub max_len: usize,
}

impl Default for SqlLogConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            to_console: false,
            to_file: true,
            pretty: false,
            max_len: DEFAULT_SQL_LOG_MAX_LEN,
        }
    }
}

pub struct SqlLogState {
    enabled: AtomicBool,
    to_console: AtomicBool,
    to_file: AtomicBool,
    pretty: AtomicBool,
    max_len: AtomicUsize,
}

impl SqlLogState {
    fn new(config: SqlLogConfig) -> Self {
        Self {
            enabled: AtomicBool::new(config.enabled),
            to_console: AtomicBool::new(config.to_console),
            to_file: AtomicBool::new(config.to_file),
            pretty: AtomicBool::new(config.pretty),
            max_len: AtomicUsize::new(normalize_max_len(config.max_len)),
        }
    }

    fn config(&self) -> SqlLogConfig {
        SqlLogConfig {
            enabled: self.enabled.load(Ordering::Relaxed),
            to_console: self.to_console.load(Ordering::Relaxed),
            to_file: self.to_file.load(Ordering::Relaxed),
            pretty: self.pretty.load(Ordering::Relaxed),
            max_len: self.max_len.load(Ordering::Relaxed),
        }
    }

    fn update(&self, config: SqlLogConfig) {
        self.enabled.store(config.enabled, Ordering::Relaxed);
        self.to_console.store(config.to_console, Ordering::Relaxed);
        self.to_file.store(config.to_file, Ordering::Relaxed);
        self.pretty.store(config.pretty, Ordering::Relaxed);
        self.max_len
            .store(normalize_max_len(config.max_len), Ordering::Relaxed);
    }
}

static SQL_LOG_STATE: OnceLock<SqlLogState> = OnceLock::new();

pub fn init_sql_log_state() -> &'static SqlLogState {
    SQL_LOG_STATE.get_or_init(|| SqlLogState::new(SqlLogConfig::default()))
}

pub fn get_sql_log_config() -> SqlLogConfig {
    init_sql_log_state().config()
}

pub fn update_sql_log_config(config: SqlLogConfig) -> SqlLogConfig {
    let normalized = SqlLogConfig {
        max_len: normalize_max_len(config.max_len),
        ..config
    };
    init_sql_log_state().update(normalized.clone());
    normalized
}

pub fn log_dir() -> PathBuf {
    paths::quantanote_dir()
}

pub fn sql_log_path() -> PathBuf {
    log_dir().join(SQL_LOG_FILE_NAME)
}

pub fn clear_sql_log_file() -> std::io::Result<()> {
    let path = sql_log_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, "")
}

pub fn tauri_log_plugin<R: Runtime>() -> TauriPlugin<R> {
    let builder = tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::Stdout));

    #[cfg(target_os = "android")]
    let builder = builder.target(Target::new(TargetKind::LogDir {
        file_name: Some("quanta-note".to_string()),
    }));

    #[cfg(not(target_os = "android"))]
    let builder = builder.target(Target::new(TargetKind::Folder {
        path: paths::quantanote_dir(),
        file_name: Some("quanta-note".to_string()),
    }));

    builder
        .level(LevelFilter::Debug)
        .level_for("reqwest", LevelFilter::Warn)
        .rotation_strategy(RotationStrategy::KeepSome(10))
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
    let state = init_sql_log_state();
    if !state.enabled.load(Ordering::Relaxed) {
        return;
    }

    let pretty = state.pretty.load(Ordering::Relaxed);
    let max_len = state.max_len.load(Ordering::Relaxed);
    let sql = if pretty {
        format_sql(sql)
    } else {
        sql.trim().to_string()
    };
    let sql = truncate_for_log(&sql, max_len);
    let entry = format!(
        "{} [SQL]\n{}\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
        sql
    );

    if state.to_console.load(Ordering::Relaxed) {
        println!("{}", entry.trim_end());
    }

    if state.to_file.load(Ordering::Relaxed) {
        if let Err(error) = append_sql_log(&entry) {
            log::warn!("写入 SQL 日志失败: {}", error);
        }
    }
}

fn append_sql_log(entry: &str) -> std::io::Result<()> {
    let path = sql_log_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    file.write_all(entry.as_bytes())?;
    file.write_all(b"\n")?;
    Ok(())
}

fn normalize_max_len(max_len: usize) -> usize {
    max_len.clamp(200, 50_000)
}

fn truncate_for_log(value: &str, max_len: usize) -> String {
    if value.len() <= max_len {
        return value.to_string();
    }

    let mut end = max_len;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}... [truncated]", &value[..end])
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
