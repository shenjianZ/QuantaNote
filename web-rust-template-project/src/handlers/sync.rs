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
        .get_snapshot_records(&snapshot_id)
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
    log_info(
        &request_id,
        "拉取记录",
        &format!("user_id={}", user_id),
    );

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
    pub snapshot_id: String,
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
            body,
        )
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(serde_json::json!({
        "storage_key": storage_key
    }))))
}

/// 下载附件
pub async fn download_attachment(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    axum::extract::Path(attachment_id): axum::extract::Path<String>,
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

    Ok(axum::response::Response::builder()
        .header("content-type", mime_type)
        .body(axum::body::Body::from(data))
        .unwrap())
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
            "user_id={}, records={}, attachments={}",
            user_id,
            payload.records.len(),
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

/// 获取同步历史
pub async fn sync_history(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<SyncHistoryEntry>>>, ErrorResponse> {
    log_info(
        &request_id,
        "获取同步历史",
        &format!("user_id={}", user_id),
    );

    let service = create_sync_service(&state).map_err(|e| ErrorResponse::new(e.to_string()))?;
    let history = service
        .get_history(&user_id)
        .await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    Ok(Json(ApiResponse::success(history)))
}
