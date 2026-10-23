use rusqlite::params;

use crate::db::DbState;
use crate::error::AppError;
use crate::models::ai_chat::{AiChatMessageDto, AiChatSessionDto, CHAT_ROLE_ASSISTANT};
use crate::utils::ids;

fn row_to_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<AiChatMessageDto> {
    Ok(AiChatMessageDto {
        id: row.get(0)?,
        item_id: row.get(1)?,
        session_id: row.get(2)?,
        role: row.get(3)?,
        content: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn row_to_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<AiChatSessionDto> {
    Ok(AiChatSessionDto {
        id: row.get(0)?,
        item_id: row.get(1)?,
        title: row.get(2)?,
        model: row.get(3)?,
        system_prompt: row.get(4)?,
        temperature: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

// --- 会话 ---

/// 列出笔记的全部会话；没有任何会话时自动创建一个默认会话。
pub fn list_sessions(db: &DbState, item_id: &str) -> Result<Vec<AiChatSessionDto>, AppError> {
    {
        let conn = db
            .conn
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM ai_chat_sessions WHERE item_id = ?1",
                params![item_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        if count > 0 {
            let mut stmt = conn
                .prepare(
                    "SELECT id, item_id, title, model, system_prompt, temperature, created_at, updated_at
                     FROM ai_chat_sessions
                     WHERE item_id = ?1
                     ORDER BY updated_at DESC, created_at DESC",
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
            let sessions = stmt
                .query_map(params![item_id], row_to_session)
                .map_err(|e| AppError::Database(e.to_string()))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| AppError::Database(e.to_string()))?;
            return Ok(sessions);
        }
    }
    create_session(db, item_id, "新会话")?;
    list_sessions(db, item_id)
}

pub fn create_session(
    db: &DbState,
    item_id: &str,
    title: &str,
) -> Result<AiChatSessionDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    let id = ids::new_id("chatsess");
    let now = chrono::Utc::now().to_rfc3339();
    let title = if title.trim().is_empty() {
        "新会话"
    } else {
        title.trim()
    };
    conn.execute(
        "INSERT INTO ai_chat_sessions (id, item_id, title, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, item_id, title, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(AiChatSessionDto {
        id,
        item_id: item_id.to_string(),
        title: title.to_string(),
        model: String::new(),
        system_prompt: String::new(),
        temperature: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_session(db: &DbState, session_id: &str) -> Result<AiChatSessionDto, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.query_row(
        "SELECT id, item_id, title, model, system_prompt, temperature, created_at, updated_at
         FROM ai_chat_sessions WHERE id = ?1",
        params![session_id],
        row_to_session,
    )
    .map_err(|e| AppError::Database(e.to_string()))
}

pub fn update_session(
    db: &DbState,
    session_id: &str,
    title: Option<&str>,
    model: Option<&str>,
    system_prompt: Option<&str>,
    temperature: Option<Option<f64>>,
) -> Result<AiChatSessionDto, AppError> {
    {
        let conn = db
            .conn
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE ai_chat_sessions SET
                title = COALESCE(?2, title),
                model = COALESCE(?3, model),
                system_prompt = COALESCE(?4, system_prompt),
                temperature = COALESCE(?5, temperature),
                updated_at = ?6
             WHERE id = ?1",
            params![session_id, title, model, system_prompt, temperature, now],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }
    get_session(db, session_id)
}

pub fn delete_session(db: &DbState, session_id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "DELETE FROM ai_chat_messages WHERE session_id = ?1",
        params![session_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "DELETE FROM ai_chat_summaries WHERE session_id = ?1",
        params![session_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "DELETE FROM ai_chat_sessions WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

// --- 消息 ---

pub fn list_messages(db: &DbState, session_id: &str) -> Result<Vec<AiChatMessageDto>, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, session_id, role, content, created_at
             FROM ai_chat_messages
             WHERE session_id = ?1
             ORDER BY created_at ASC, rowid ASC",
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    let messages = stmt
        .query_map(params![session_id], row_to_message)
        .map_err(|e| AppError::Database(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(messages)
}

pub fn insert_message(
    db: &DbState,
    session_id: &str,
    role: &str,
    content: &str,
) -> Result<AiChatMessageDto, AppError> {
    let session = get_session(db, session_id)?;
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let id = ids::new_id("chat");
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO ai_chat_messages (id, item_id, session_id, role, content, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, session.item_id, session_id, role, content, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "UPDATE ai_chat_sessions SET updated_at = ?2 WHERE id = ?1",
        params![session_id, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(AiChatMessageDto {
        id,
        item_id: session.item_id,
        session_id: session_id.to_string(),
        role: role.to_string(),
        content: content.to_string(),
        created_at: now,
    })
}

pub fn delete_message(db: &DbState, message_id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "DELETE FROM ai_chat_messages WHERE id = ?1",
        params![message_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

/// 重新生成前移除末尾的助手回复（若有），保留其前的用户提问。
pub fn delete_last_assistant_reply(db: &DbState, session_id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    conn.execute(
        "DELETE FROM ai_chat_messages
         WHERE id = (
             SELECT id FROM ai_chat_messages
             WHERE session_id = ?1 AND role = ?2
             ORDER BY created_at DESC, rowid DESC
             LIMIT 1
         )",
        params![session_id, CHAT_ROLE_ASSISTANT],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

pub fn clear_messages(db: &DbState, session_id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    conn.execute(
        "DELETE FROM ai_chat_messages WHERE session_id = ?1",
        params![session_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

// --- 上下文压缩摘要（会话维度） ---

#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatSummaryRecord {
    pub session_id: String,
    pub summary: String,
    pub summarized_until: String,
}

pub fn get_summary(db: &DbState, session_id: &str) -> Result<AiChatSummaryRecord, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    conn.query_row(
        "SELECT session_id, summary, summarized_until FROM ai_chat_summaries WHERE session_id = ?1",
        params![session_id],
        |row| {
            Ok(AiChatSummaryRecord {
                session_id: row.get(0)?,
                summary: row.get(1)?,
                summarized_until: row.get(2)?,
            })
        },
    )
    .or(Ok(AiChatSummaryRecord {
        session_id: session_id.to_string(),
        summary: String::new(),
        summarized_until: String::new(),
    }))
}

pub fn upsert_summary(
    db: &DbState,
    session_id: &str,
    summary: &str,
    summarized_until: &str,
) -> Result<AiChatSummaryRecord, AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO ai_chat_summaries (session_id, summary, summarized_until, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(session_id) DO UPDATE SET
            summary = excluded.summary,
            summarized_until = excluded.summarized_until,
            updated_at = excluded.updated_at",
        params![session_id, summary, summarized_until, now],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(AiChatSummaryRecord {
        session_id: session_id.to_string(),
        summary: summary.to_string(),
        summarized_until: summarized_until.to_string(),
    })
}

pub fn delete_summary(db: &DbState, session_id: &str) -> Result<(), AppError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "DELETE FROM ai_chat_summaries WHERE session_id = ?1",
        params![session_id],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}

/// 会话尚无有效标题时用首条用户消息生成标题。
pub fn maybe_autotitle_session(
    db: &DbState,
    session_id: &str,
    first_question: &str,
) -> Result<(), AppError> {
    let session = get_session(db, session_id)?;
    if !session.title.is_empty() && session.title != "新会话" && session.title != "默认会话"
    {
        return Ok(());
    }
    let title: String = first_question.trim().chars().take(24).collect();
    if title.is_empty() {
        return Ok(());
    }
    let conn = db
        .conn
        .lock()
        .map_err(|e| AppError::Database(e.to_string()))?;
    conn.execute(
        "UPDATE ai_chat_sessions SET title = ?2, updated_at = ?3 WHERE id = ?1",
        params![session_id, title, chrono::Utc::now().to_rfc3339()],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(())
}
