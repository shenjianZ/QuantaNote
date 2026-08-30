use crate::domain::dto::sync::*;
use crate::domain::vo::sync::*;
use crate::domain::vo::ApiResponse;
use crate::error::ErrorResponse;
use crate::infra::middleware::logging::{log_info, RequestId};
use crate::infra::storage;
use crate::repositories::sync_repository::SyncRepository;
use crate::services::sync_service::SyncService;
use crate::AppState;
use axum::{
    extract::{Extension, Query, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use bytes::Bytes;
use serde::Deserialize;

fn create_sync_service(state: &AppState) -> anyhow::Result<SyncService> {
    let repo = SyncRepository::new(state.pool.clone());
    let storage = storage::create_storage_backend(&state.config.storage)?;
    Ok(SyncService::new(repo, storage))
}

/// 获取最新快照
pub async fn get_latest_snapshot(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Option<SnapshotInfo>>>, ErrorResponse> {
    log_info(&request_id, "获取最新快照", &format!("user_id={}", user_id));

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let snapshot = service
        .get_latest_snapshot(&user_id)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(snapshot)))
}

/// 获取快照记录元信息
pub async fn get_snapshot_records(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    axum::extract::Path(snapshot_id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Vec<RecordMetaInfo>>>, ErrorResponse> {
    log_info(
        &request_id,
        "获取快照记录",
        &format!("user_id={}, snapshot_id={}", user_id, snapshot_id),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let records = service
        .get_snapshot_records(&user_id, &snapshot_id)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(records)))
}

/// 推送记录
pub async fn push_records(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Json(payload): Json<PushRecordsRequest>,
) -> Result<Json<ApiResponse<PushResult>>, ErrorResponse> {
    log_info(
        &request_id,
        "推送记录",
        &format!("user_id={}, count={}", user_id, payload.records.len()),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;

    // 临时 snapshot_id，commit 时会替换
    let temp_snapshot_id = "pending";
    let result = service
        .push_records(&user_id, temp_snapshot_id, payload.records)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(result)))
}

/// 拉取记录
pub async fn pull_records(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Json(payload): Json<PullRecordsRequest>,
) -> Result<Json<ApiResponse<PullResult>>, ErrorResponse> {
    log_info(&request_id, "拉取记录", &format!("user_id={}", user_id));

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let result = service
        .pull_records(&user_id, payload.since_snapshot_id.as_deref())
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(result)))
}

/// 附件差异查询
pub async fn diff_attachments(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Json(payload): Json<AttachmentDiffRequest>,
) -> Result<Json<ApiResponse<AttachmentDiffResult>>, ErrorResponse> {
    log_info(
        &request_id,
        "附件差异查询",
        &format!("user_id={}, hashes_count={}", user_id, payload.hashes.len()),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let result = service
        .diff_attachments(&user_id, &payload.hashes)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(result)))
}

/// 上传附件查询参数
#[derive(Debug, Deserialize)]
pub struct UploadAttachmentQuery {
    pub attachment_id: String,
    pub item_id: String,
    pub filename: String,
    pub mime_type: String,
    pub file_hash: String,
    pub file_size: Option<i64>,
    pub snapshot_id: String,
}

/// 分片上传查询参数
#[derive(Debug, Deserialize)]
pub struct UploadAttachmentChunkQuery {
    #[serde(flatten)]
    pub attachment: UploadAttachmentQuery,
    pub chunk_index: u32,
    pub total_chunks: u32,
    pub chunk_hash: String,
}

/// 分片上传完成查询参数
#[derive(Debug, Deserialize)]
pub struct CompleteAttachmentUploadQuery {
    #[serde(flatten)]
    pub attachment: UploadAttachmentQuery,
    pub total_chunks: u32,
}

/// 分片上传状态查询参数
#[derive(Debug, Deserialize)]
pub struct AttachmentUploadStatusQuery {
    pub file_hash: String,
    pub total_chunks: u32,
}

/// 上传附件
pub async fn upload_attachment(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Query(query): Query<UploadAttachmentQuery>,
    body: Bytes,
) -> Result<Json<ApiResponse<serde_json::Value>>, ErrorResponse> {
    log_info(
        &request_id,
        "上传附件",
        &format!("user_id={}, attachment_id={}", user_id, query.attachment_id),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let storage_key = service
        .upload_attachment(
            &user_id,
            &query.snapshot_id,
            &query.attachment_id,
            &query.item_id,
            &query.filename,
            &query.mime_type,
            &query.file_hash,
            query.file_size.unwrap_or(0),
            body,
        )
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(serde_json::json!({
        "storage_key": storage_key
    }))))
}

/// 上传附件分片
pub async fn upload_attachment_chunk(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Query(query): Query<UploadAttachmentChunkQuery>,
    body: Bytes,
) -> Result<Json<ApiResponse<serde_json::Value>>, ErrorResponse> {
    log_info(
        &request_id,
        "上传附件分片",
        &format!(
            "user_id={}, file_hash={}, chunk={}/{}",
            user_id,
            query.attachment.file_hash,
            query.chunk_index + 1,
            query.total_chunks
        ),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    service
        .upload_attachment_chunk(
            &user_id,
            &query.attachment.file_hash,
            query.attachment.file_size.unwrap_or(0),
            query.chunk_index,
            query.total_chunks,
            &query.chunk_hash,
            body,
        )
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(serde_json::json!({
        "chunk_index": query.chunk_index
    }))))
}

/// 获取已上传的附件分片
pub async fn get_attachment_upload_status(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Query(query): Query<AttachmentUploadStatusQuery>,
) -> Result<Json<ApiResponse<AttachmentUploadStatus>>, ErrorResponse> {
    log_info(
        &request_id,
        "查询附件分片状态",
        &format!("user_id={}, file_hash={}", user_id, query.file_hash),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let received_chunks = service
        .get_attachment_upload_status(&user_id, &query.file_hash, query.total_chunks)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(AttachmentUploadStatus {
        file_hash: query.file_hash,
        total_chunks: query.total_chunks,
        received_chunks,
    })))
}

/// 完成附件分片上传并合并文件
pub async fn complete_attachment_upload(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Query(query): Query<CompleteAttachmentUploadQuery>,
) -> Result<Json<ApiResponse<serde_json::Value>>, ErrorResponse> {
    log_info(
        &request_id,
        "完成附件分片上传",
        &format!(
            "user_id={}, attachment_id={}",
            user_id, query.attachment.attachment_id
        ),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let storage_key = service
        .complete_attachment_upload(
            &user_id,
            &query.attachment.snapshot_id,
            &query.attachment.attachment_id,
            &query.attachment.item_id,
            &query.attachment.filename,
            &query.attachment.mime_type,
            &query.attachment.file_hash,
            query.attachment.file_size.unwrap_or(0),
            query.total_chunks,
        )
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(serde_json::json!({
        "storage_key": storage_key
    }))))
}

/// 下载附件
fn parse_byte_range(value: &str, total_size: usize) -> Result<(usize, usize), ()> {
    if total_size == 0 || !value.starts_with("bytes=") {
        return Err(());
    }
    let range = value[6..].split(',').next().ok_or(())?;
    let (start, end) = range.split_once('-').ok_or(())?;

    if start.is_empty() {
        let suffix_len = end.parse::<usize>().map_err(|_| ())?;
        if suffix_len == 0 {
            return Err(());
        }
        let suffix_start = total_size.saturating_sub(suffix_len);
        return Ok((suffix_start, total_size - 1));
    }

    let start = start.parse::<usize>().map_err(|_| ())?;
    if start >= total_size {
        return Err(());
    }
    let end = if end.is_empty() {
        total_size - 1
    } else {
        end.parse::<usize>().map_err(|_| ())?.min(total_size - 1)
    };
    if start > end {
        return Err(());
    }
    Ok((start, end))
}

pub async fn download_attachment(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    axum::extract::Path(attachment_id): axum::extract::Path<String>,
    headers: HeaderMap,
) -> Result<axum::response::Response, ErrorResponse> {
    log_info(
        &request_id,
        "下载附件",
        &format!("user_id={}, attachment_id={}", user_id, attachment_id),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let (data, mime_type) = service
        .download_attachment(&user_id, &attachment_id)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    let total_size = data.len();
    let builder = axum::response::Response::builder()
        .header(header::CONTENT_TYPE, mime_type)
        .header(header::ACCEPT_RANGES, "bytes");

    if let Some(range_header) = headers.get(header::RANGE).and_then(|v| v.to_str().ok()) {
        let (start, end) = match parse_byte_range(range_header, total_size) {
            Ok(range) => range,
            Err(()) => {
                return Ok(builder
                    .status(StatusCode::RANGE_NOT_SATISFIABLE)
                    .header(header::CONTENT_RANGE, format!("bytes */{}", total_size))
                    .body(axum::body::Body::empty())
                    .unwrap());
            }
        };
        let chunk = data.slice(start..end + 1);
        Ok(builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", start, end, total_size),
            )
            .header(header::CONTENT_LENGTH, chunk.len())
            .body(axum::body::Body::from(chunk))
            .unwrap())
    } else {
        Ok(builder
            .status(StatusCode::OK)
            .header(header::CONTENT_LENGTH, total_size)
            .body(axum::body::Body::from(data))
            .unwrap())
    }
}

/// 提交同步
pub async fn commit_sync(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Json(payload): Json<CommitSyncRequest>,
) -> Result<Json<ApiResponse<CommitResult>>, ErrorResponse> {
    log_info(
        &request_id,
        "提交同步",
        &format!(
            "user_id={}, pushed_records={}, attachments={}",
            user_id,
            payload.pushed_records.len(),
            payload.attachments.len()
        ),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let result = service
        .commit(&user_id, payload)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(result)))
}

/// 同步历史查询参数
#[derive(Debug, Deserialize)]
pub struct SyncHistoryQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

/// 获取同步历史（分页）
pub async fn sync_history(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Query(query): Query<SyncHistoryQuery>,
) -> Result<Json<ApiResponse<PaginatedSyncHistory>>, ErrorResponse> {
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(10).clamp(1, 100);

    log_info(
        &request_id,
        "获取同步历史",
        &format!(
            "user_id={}, page={}, page_size={}",
            user_id, page, page_size
        ),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let history = service
        .get_history(&user_id, page, page_size)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(history)))
}

/// 重置用户所有同步数据
pub async fn reset_sync_data(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<()>>, ErrorResponse> {
    log_info(&request_id, "重置同步数据", &format!("user_id={}", user_id));

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    service
        .reset_sync_data(&user_id)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(())))
}

#[cfg(test)]
mod tests {
    use super::parse_byte_range;

    #[test]
    fn parses_supported_byte_ranges() {
        assert_eq!(parse_byte_range("bytes=0-9", 100).unwrap(), (0, 9));
        assert_eq!(parse_byte_range("bytes=10-", 100).unwrap(), (10, 99));
        assert_eq!(parse_byte_range("bytes=-10", 100).unwrap(), (90, 99));
        assert_eq!(parse_byte_range("bytes=90-120", 100).unwrap(), (90, 99));
        assert!(parse_byte_range("bytes=100-", 100).is_err());
        assert!(parse_byte_range("items=0-9", 100).is_err());
    }
}
