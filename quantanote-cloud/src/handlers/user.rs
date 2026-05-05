use crate::domain::dto::user::{ChangePasswordRequest, UpdateProfileRequest};
use crate::domain::vo::ApiResponse;
use crate::error::ErrorResponse;
use crate::infra::middleware::logging::{log_info, RequestId};
use crate::infra::storage::create_storage_backend;
use crate::repositories::user_repository::UserRepository;
use crate::services::user_service::UserService;
use crate::AppState;
use axum::{
    body::Bytes,
    extract::{Extension, Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

/// 获取用户资料
pub async fn get_profile(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<ApiResponse<crate::domain::vo::user::ProfileResponse>>, ErrorResponse> {
    log_info(&request_id, "获取用户资料", &format!("user_id={}", user_id));

    let user_repo = UserRepository::new(state.pool.clone());
    let service = UserService::new(user_repo);

    match service.get_profile(&user_id).await {
        Ok(profile) => {
            let response = ApiResponse::success(profile);
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "获取用户资料失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 更新用户资料
pub async fn update_profile(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<ApiResponse<crate::domain::vo::user::ProfileResponse>>, ErrorResponse> {
    log_info(
        &request_id,
        "更新用户资料",
        &format!("user_id={}, payload={:?}", user_id, payload),
    );

    let user_repo = UserRepository::new(state.pool.clone());
    let service = UserService::new(user_repo);

    match service.update_profile(&user_id, payload).await {
        Ok(profile) => {
            let response = ApiResponse::success_with_message(profile, "资料更新成功");
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "更新用户资料失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 修改密码
pub async fn change_password(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<ApiResponse<()>>, ErrorResponse> {
    log_info(&request_id, "修改密码", &format!("user_id={}", user_id));

    let user_repo = UserRepository::new(state.pool.clone());
    let service = UserService::new(user_repo);

    match service
        .change_password(&user_id, &payload.old_password, &payload.new_password)
        .await
    {
        Ok(()) => {
            let response = ApiResponse::success_with_message((), "密码修改成功");
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "修改密码失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UploadAvatarQuery {
    pub mime_type: String,
}

/// 上传头像
pub async fn upload_avatar(
    Extension(request_id): Extension<RequestId>,
    Extension(user_id): Extension<String>,
    State(state): State<AppState>,
    Query(query): Query<UploadAvatarQuery>,
    body: Bytes,
) -> Result<Json<ApiResponse<crate::domain::vo::user::ProfileResponse>>, ErrorResponse> {
    log_info(&request_id, "上传头像", &format!("user_id={}, size={}", user_id, body.len()));

    // 验证 MIME 类型
    if !query.mime_type.starts_with("image/") {
        return Err(ErrorResponse::new("仅支持图片文件".to_string()));
    }

    // 限制大小 5MB
    if body.len() > 5 * 1024 * 1024 {
        return Err(ErrorResponse::new("头像文件不能超过 5MB".to_string()));
    }

    // 确定扩展名
    let ext = match query.mime_type.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "bin",
    };

    // 生成存储 key
    let storage_key = format!(
        "avatars/{}/{}.{}",
        user_id,
        chrono::Utc::now().timestamp_millis(),
        ext
    );

    // 存储文件
    let storage = create_storage_backend(&state.config.storage)
        .map_err(|e| ErrorResponse::new(format!("存储初始化失败: {}", e)))?;
    storage
        .put_object(&storage_key, body, &query.mime_type)
        .await
        .map_err(|e| ErrorResponse::new(format!("存储头像失败: {}", e)))?;

    // 更新数据库
    let user_repo = UserRepository::new(state.pool.clone());
    let service = UserService::new(user_repo);
    service.update_avatar(&user_id, &storage_key).await
        .map_err(|e| ErrorResponse::new(e.to_string()))?;

    // 返回更新后的 profile
    let user_repo = UserRepository::new(state.pool.clone());
    let profile = user_repo.find_by_id(&user_id).await
        .map_err(|e| ErrorResponse::new(e.to_string()))?
        .ok_or_else(|| ErrorResponse::new("用户不存在".to_string()))?;

    Ok(Json(ApiResponse::success(crate::domain::vo::user::ProfileResponse::from(profile))))
}

/// 获取头像图片（公开端点）
pub async fn get_avatar(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> Result<axum::response::Response, ErrorResponse> {
    // 查询用户的 avatar_url
    let user_repo = UserRepository::new(state.pool.clone());
    let user = user_repo.find_by_id(&user_id).await
        .map_err(|e| ErrorResponse::new(e.to_string()))?
        .ok_or_else(|| ErrorResponse::new("用户不存在".to_string()))?;

    let avatar_key = user.avatar_url
        .ok_or_else(|| ErrorResponse::new("未设置头像".to_string()))?;

    // 从存储读取文件
    let storage = create_storage_backend(&state.config.storage)
        .map_err(|e| ErrorResponse::new(format!("存储初始化失败: {}", e)))?;
    let obj = storage.get_object(&avatar_key).await
        .map_err(|e| ErrorResponse::new(format!("读取头像失败: {}", e)))?;

    // 推断 content type
    let content_type = if avatar_key.ends_with(".png") {
        "image/png"
    } else if avatar_key.ends_with(".jpg") || avatar_key.ends_with(".jpeg") {
        "image/jpeg"
    } else if avatar_key.ends_with(".gif") {
        "image/gif"
    } else if avatar_key.ends_with(".webp") {
        "image/webp"
    } else {
        "application/octet-stream"
    };

    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, content_type)],
        obj.data,
    ).into_response())
}
