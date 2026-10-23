use crate::db::DbState;
use crate::error::AppError;
use crate::models::ai_chat::{
    AiChatMessageDto, AiChatSessionDto, CHAT_ROLE_ASSISTANT, CHAT_ROLE_USER,
};
use crate::repositories::ai_chat_repository;
use crate::services::ai_service::{self, AiConfig, ChatHistoryMessage};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

#[tauri::command]
pub fn get_ai_config() -> AiConfig {
    ai_service::load_config()
}

#[tauri::command]
pub fn update_ai_config(config: AiConfig) -> Result<(), AppError> {
    ai_service::save_config(&config)
}

#[tauri::command]
pub fn save_ai_api_key(api_key: String) -> Result<(), AppError> {
    ai_service::save_api_key(api_key)
}

#[tauri::command]
pub fn clear_ai_api_key() -> Result<(), AppError> {
    ai_service::clear_api_key()
}

#[tauri::command]
pub async fn generate_ai_summary(title: String, content: String) -> Result<String, AppError> {
    ai_service::generate_summary(&title, &content).await
}

#[tauri::command]
pub async fn generate_ai_tag_suggestions(
    title: String,
    content: String,
) -> Result<Vec<String>, AppError> {
    ai_service::generate_tag_suggestions(&title, &content).await
}

#[tauri::command]
pub async fn answer_ai_question(
    title: String,
    content: String,
    question: String,
) -> Result<String, AppError> {
    ai_service::answer_question(&title, &content, &question).await
}

// ---------------------------------------------------------------------------
// 多轮会话聊天
// ---------------------------------------------------------------------------

/// 聊天流事件：用户消息已入库 / 回答增量 / 回答完成 / 早期对话已压缩。
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatStreamEvent {
    UserMessage {
        message: AiChatMessageDto,
    },
    Chunk {
        delta: String,
    },
    Done {
        message: AiChatMessageDto,
    },
    Compressed {
        summary: String,
        summarized_until: String,
    },
}

/// 聊天引用的附加笔记（加号菜单“引用其他笔记”）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtraNoteArg {
    pub title: String,
    pub content: String,
}

const AUTO_COMPRESS_THRESHOLD_CHARS: usize = 12_000;
const COMPRESS_KEEP_RECENT: usize = 6;

fn load_history(
    db: &DbState,
    session_id: &str,
    summarized_until: &str,
) -> Result<Vec<ChatHistoryMessage>, AppError> {
    let messages = ai_chat_repository::list_messages(db, session_id)?;
    let pending = if summarized_until.is_empty() {
        &messages[..]
    } else {
        match messages.iter().position(|m| m.id == summarized_until) {
            Some(pos) => &messages[pos + 1..],
            None => &messages[..],
        }
    };
    Ok(pending
        .iter()
        .map(|message| ChatHistoryMessage {
            role: message.role.clone(),
            content: message.content.clone(),
        })
        .collect())
}

/// 上下文压缩：把未压缩部分中较早的消息交给 AI 摘要并持久化（会话维度）。
/// force=false 时仅在超过阈值后触发；返回 (summary, summarized_until)。
async fn maybe_compress(
    db: &DbState,
    session_id: &str,
    force: bool,
    on_event: Option<&Channel<ChatStreamEvent>>,
) -> Result<(String, String), AppError> {
    let messages = ai_chat_repository::list_messages(db, session_id)?;
    let record = ai_chat_repository::get_summary(db, session_id)?;
    let pending: Vec<AiChatMessageDto> = if record.summarized_until.is_empty() {
        messages
    } else {
        match messages
            .iter()
            .position(|m| m.id == record.summarized_until)
        {
            Some(pos) => messages[pos + 1..].to_vec(),
            None => messages,
        }
    };

    if pending.len() <= COMPRESS_KEEP_RECENT {
        if force {
            return Err(AppError::Validation("没有可压缩的早期对话".to_string()));
        }
        return Ok((record.summary, record.summarized_until));
    }

    let total_chars: usize = pending.iter().map(|m| m.content.chars().count()).sum();
    if !force && total_chars < AUTO_COMPRESS_THRESHOLD_CHARS {
        return Ok((record.summary, record.summarized_until));
    }

    let to_compress = &pending[..pending.len() - COMPRESS_KEEP_RECENT];
    let history: Vec<ChatHistoryMessage> = to_compress
        .iter()
        .map(|message| ChatHistoryMessage {
            role: message.role.clone(),
            content: message.content.clone(),
        })
        .collect();
    let summary = ai_service::summarize_conversation(&record.summary, &history).await?;
    let summarized_until = to_compress
        .last()
        .map(|message| message.id.clone())
        .unwrap_or_default();
    ai_chat_repository::upsert_summary(db, session_id, &summary, &summarized_until)?;

    if let Some(on_event) = on_event {
        let _ = on_event.send(ChatStreamEvent::Compressed {
            summary: summary.clone(),
            summarized_until: summarized_until.clone(),
        });
    }

    Ok((summary, summarized_until))
}

async fn stream_reply(
    db: &DbState,
    session_id: &str,
    title: &str,
    content: &str,
    extra_notes: &[ExtraNoteArg],
    summary: &str,
    model_fallback: Option<&str>,
    history: Vec<ChatHistoryMessage>,
    on_event: &Channel<ChatStreamEvent>,
) -> Result<(), AppError> {
    // 全局串行：前端"停止"只是停显，旧流仍会跑完落库；串行锁保证并发的
    // 后续提问排在旧流之后执行，避免消息乱序写入。
    static CHAT_STREAM_GUARD: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _guard = CHAT_STREAM_GUARD.lock().await;

    let session = ai_chat_repository::get_session(db, session_id)?;
    // 会话级模型优先，其次前端传入的聊天偏好，最后全局配置。
    let model = if !session.model.trim().is_empty() {
        Some(session.model.trim().to_string())
    } else {
        model_fallback.map(str::to_string)
    };
    let extra_notes: Vec<ai_service::ExtraNote> = extra_notes
        .iter()
        .map(|note| ai_service::ExtraNote {
            title: note.title.clone(),
            content: note.content.clone(),
        })
        .collect();

    let answer = ai_service::answer_question_stream(
        title,
        content,
        &extra_notes,
        summary,
        Some(session.system_prompt.as_str()),
        session.temperature.map(|value| value as f32),
        model.as_deref(),
        &history,
        |delta| {
            let _ = on_event.send(ChatStreamEvent::Chunk {
                delta: delta.to_string(),
            });
        },
    )
    .await?;

    let assistant_message =
        ai_chat_repository::insert_message(db, session_id, CHAT_ROLE_ASSISTANT, &answer)?;
    let _ = on_event.send(ChatStreamEvent::Done {
        message: assistant_message,
    });
    Ok(())
}

#[tauri::command]
pub async fn get_ai_models() -> Result<Vec<String>, AppError> {
    ai_service::list_models().await
}

#[tauri::command]
pub async fn list_ai_chat_sessions(
    db: tauri::State<'_, DbState>,
    item_id: String,
) -> Result<Vec<AiChatSessionDto>, AppError> {
    ai_chat_repository::list_sessions(&db, &item_id)
}

#[tauri::command]
pub async fn create_ai_chat_session(
    db: tauri::State<'_, DbState>,
    item_id: String,
    title: Option<String>,
) -> Result<AiChatSessionDto, AppError> {
    ai_chat_repository::create_session(&db, &item_id, title.as_deref().unwrap_or("新会话"))
}

#[tauri::command]
pub async fn update_ai_chat_session(
    db: tauri::State<'_, DbState>,
    session_id: String,
    title: Option<String>,
    model: Option<String>,
    system_prompt: Option<String>,
    temperature: Option<Option<f64>>,
) -> Result<AiChatSessionDto, AppError> {
    ai_chat_repository::update_session(
        &db,
        &session_id,
        title.as_deref(),
        model.as_deref(),
        system_prompt.as_deref(),
        temperature,
    )
}

#[tauri::command]
pub async fn delete_ai_chat_session(
    db: tauri::State<'_, DbState>,
    session_id: String,
) -> Result<(), AppError> {
    ai_chat_repository::delete_session(&db, &session_id)
}

#[tauri::command]
pub async fn get_ai_chat_messages(
    db: tauri::State<'_, DbState>,
    session_id: String,
) -> Result<Vec<AiChatMessageDto>, AppError> {
    ai_chat_repository::list_messages(&db, &session_id)
}

#[tauri::command]
pub async fn delete_ai_chat_message(
    db: tauri::State<'_, DbState>,
    message_id: String,
) -> Result<(), AppError> {
    ai_chat_repository::delete_message(&db, &message_id)
}

#[tauri::command]
pub async fn get_ai_chat_summary(
    db: tauri::State<'_, DbState>,
    session_id: String,
) -> Result<ai_chat_repository::AiChatSummaryRecord, AppError> {
    ai_chat_repository::get_summary(&db, &session_id)
}

#[tauri::command]
pub async fn clear_ai_chat_messages(
    db: tauri::State<'_, DbState>,
    session_id: String,
) -> Result<(), AppError> {
    ai_chat_repository::clear_messages(&db, &session_id)?;
    ai_chat_repository::delete_summary(&db, &session_id)
}

#[tauri::command]
pub async fn compress_ai_chat_messages(
    db: tauri::State<'_, DbState>,
    session_id: String,
) -> Result<ai_chat_repository::AiChatSummaryRecord, AppError> {
    let (summary, summarized_until) = maybe_compress(&db, &session_id, true, None).await?;
    Ok(ai_chat_repository::AiChatSummaryRecord {
        session_id,
        summary,
        summarized_until,
    })
}

#[tauri::command]
pub async fn send_ai_chat_message(
    db: tauri::State<'_, DbState>,
    session_id: String,
    title: String,
    content: String,
    question: String,
    model: Option<String>,
    extra_notes: Option<Vec<ExtraNoteArg>>,
    on_event: Channel<ChatStreamEvent>,
) -> Result<(), AppError> {
    let question = question.trim().to_string();
    if question.is_empty() {
        return Err(AppError::Validation("问题不能为空".to_string()));
    }

    let user_message =
        ai_chat_repository::insert_message(&db, &session_id, CHAT_ROLE_USER, &question)?;
    let _ = on_event.send(ChatStreamEvent::UserMessage {
        message: user_message,
    });
    let _ = ai_chat_repository::maybe_autotitle_session(&db, &session_id, &question);

    // 发送前自动压缩（失败降级为沿用旧摘要，不阻断本次回答）
    let (summary, summarized_until) =
        match maybe_compress(&db, &session_id, false, Some(&on_event)).await {
            Ok(state) => state,
            Err(_) => {
                let record = ai_chat_repository::get_summary(&db, &session_id)?;
                (record.summary, record.summarized_until)
            }
        };

    let history = load_history(&db, &session_id, &summarized_until)?;
    let extra_notes = extra_notes.unwrap_or_default();
    stream_reply(
        &db,
        &session_id,
        &title,
        &content,
        &extra_notes,
        &summary,
        model.as_deref(),
        history,
        &on_event,
    )
    .await
}

#[tauri::command]
pub async fn regenerate_ai_chat_reply(
    db: tauri::State<'_, DbState>,
    session_id: String,
    title: String,
    content: String,
    model: Option<String>,
    extra_notes: Option<Vec<ExtraNoteArg>>,
    on_event: Channel<ChatStreamEvent>,
) -> Result<(), AppError> {
    ai_chat_repository::delete_last_assistant_reply(&db, &session_id)?;

    let history_probe = load_history(&db, &session_id, "")?;
    if !history_probe
        .iter()
        .any(|message| message.role == CHAT_ROLE_USER)
    {
        return Err(AppError::Validation("没有可重新生成的回答".to_string()));
    }

    let (summary, summarized_until) = ai_chat_repository::get_summary(&db, &session_id)
        .map(|record| (record.summary, record.summarized_until))?;

    let history = load_history(&db, &session_id, &summarized_until)?;
    let extra_notes = extra_notes.unwrap_or_default();
    stream_reply(
        &db,
        &session_id,
        &title,
        &content,
        &extra_notes,
        &summary,
        model.as_deref(),
        history,
        &on_event,
    )
    .await
}
