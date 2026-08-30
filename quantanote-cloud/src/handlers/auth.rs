use crate::domain::dto::auth::{
    DeleteUserRequest, ForgotPasswordRequest, LoginRequest, RefreshRequest, RegisterRequest,
    ResetPasswordRequest, RevokeDeviceRequest, SendVerifyCodeRequest,
};
use crate::domain::vo::auth::{
    DeviceSessionResult, ForgotPasswordResult, LoginResult, RefreshResult, RegisterResult,
    ResetPasswordResult,
};
use crate::domain::vo::ApiResponse;
use crate::error::ErrorResponse;
use crate::infra::middleware::auth::AuthContext;
use crate::infra::middleware::logging::{log_info, RequestId};
use crate::repositories::device_session_repository::DeviceSessionRepository;
use crate::repositories::user_repository::UserRepository;
use crate::services::auth_service::AuthService;
use crate::services::email_service::EmailService;
use crate::utils::jwt::TokenService;
use crate::AppState;
use axum::{
    extract::{Extension, State},
    Json,
};
use chrono::{Duration, Utc};
use serde_json::json;

async fn track_device_session(state: &AppState, user_id: &str, device_id: &str) {
    if device_id.is_empty() {
        return;
    }

    let expires_at =
        Utc::now().naive_utc() + Duration::days(state.config.auth.refresh_token_expiration_days);
    let repository = DeviceSessionRepository::new(state.pool.clone());
    if let Err(error) = repository.upsert(user_id, device_id, expires_at).await {
        tracing::warn!(
            user_id = %user_id,
            device_id = %device_id,
            error = %error,
            "记录设备会话失败"
        );
    }
}

/// 注册
pub async fn register(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<RegisterResult>>, ErrorResponse> {
    log_info(&request_id, "注册请求参数", &payload);

    let user_repo = UserRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );
    let device_id = payload.device_id.clone();

    match service.register(payload).await {
        Ok((user_model, access_token, refresh_token)) => {
            track_device_session(&state, &user_model.id, &device_id).await;
            let data = RegisterResult::from((user_model, access_token, refresh_token));
            let response = ApiResponse::success(data);
            log_info(&request_id, "注册成功", &response);
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "注册失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 登录
pub async fn login(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<ApiResponse<LoginResult>>, ErrorResponse> {
    log_info(&request_id, "登录请求参数", &payload);

    let user_repo = UserRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );
    let device_id = payload.device_id.clone();

    match service.login(payload).await {
        Ok((user_model, access_token, refresh_token)) => {
            track_device_session(&state, &user_model.id, &device_id).await;
            let data = LoginResult::from((user_model, access_token, refresh_token));
            let response = ApiResponse::success(data);
            log_info(&request_id, "登录成功", &response);
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "登录失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 刷新 Token
pub async fn refresh(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<ApiResponse<RefreshResult>>, ErrorResponse> {
    let device_id =
        TokenService::decode_device_id(&payload.refresh_token, &state.config.auth.jwt_secret)
            .unwrap_or_else(|_| "unknown".to_string());

    log_info(
        &request_id,
        "刷新 token 请求",
        &json!({"device_id": device_id}),
    );

    let user_repo = UserRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );

    match service.refresh_access_token(&payload.refresh_token).await {
        Ok((access_token, refresh_token)) => {
            if let Ok(user_id) =
                TokenService::decode_user_id(&payload.refresh_token, &state.config.auth.jwt_secret)
            {
                track_device_session(&state, &user_id, &device_id).await;
            }
            let data = RefreshResult {
                access_token,
                refresh_token,
            };
            let response = ApiResponse::success(data);

            log_info(&request_id, "刷新成功", &json!({"access_token": "***"}));
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "刷新失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 删除账号
pub async fn delete_account(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<DeleteUserRequest>,
) -> Result<Json<ApiResponse<()>>, ErrorResponse> {
    log_info(&request_id, "删除账号请求", &format!("user_id={}", user_id));

    let user_repo = UserRepository::new(state.pool.clone());
    let sync_repo = crate::repositories::sync_repository::SyncRepository::new(state.pool.clone());
    let device_repo = DeviceSessionRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );

    let delete_request = DeleteUserRequest {
        user_id: user_id.clone(),
        password: payload.password,
    };

    // 先验证用户存在且密码正确
    service
        .validate_delete_user(&delete_request)
        .await
        .map_err(|e| {
            log_info(&request_id, "账号删除验证失败", &e.to_string());
            ErrorResponse::new(e.to_string())
        })?;

    // 先清理关联的同步数据（必须在删除用户之前，因为有外键约束）
    if let Err(e) = sync_repo.delete_user_records(&user_id).await {
        log_info(&request_id, "清理同步记录失败", &e.to_string());
    }
    if let Err(e) = sync_repo.delete_user_attachments(&user_id).await {
        log_info(&request_id, "清理同步附件失败", &e.to_string());
    }
    if let Err(e) = sync_repo.delete_all_snapshots(&user_id).await {
        log_info(&request_id, "清理同步快照失败", &e.to_string());
    }
    if let Err(e) = device_repo.delete_all(&user_id).await {
        log_info(&request_id, "清理设备会话失败", &e.to_string());
    }

    // 最后删除用户
    match service.delete_user(&user_id).await {
        Ok(_) => {
            log_info(&request_id, "账号删除成功", &format!("user_id={}", user_id));
            let response = ApiResponse::success_with_message((), "账号删除成功");
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "账号删除失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 删除刷新令牌
pub async fn delete_refresh_token(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<ApiResponse<()>>, ErrorResponse> {
    let device_id = params
        .get("device_id")
        .cloned()
        .unwrap_or_else(|| "default".to_string());
    log_info(
        &request_id,
        "删除刷新令牌请求",
        &format!("user_id={}, device_id={}", user_id, device_id),
    );

    let user_repo = UserRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );

    match service.delete_refresh_token(&user_id, &device_id).await {
        Ok(_) => {
            let device_repo = DeviceSessionRepository::new(state.pool.clone());
            if let Err(error) = device_repo.delete(&user_id, &device_id).await {
                log_info(&request_id, "清理设备会话失败", &error.to_string());
            }
            log_info(
                &request_id,
                "刷新令牌删除成功",
                &format!("user_id={}", user_id),
            );
            let response = ApiResponse::success_with_message((), "刷新令牌删除成功");
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "刷新令牌删除失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 获取当前账号的有效设备会话列表
pub async fn list_devices(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Extension(auth_context): Extension<AuthContext>,
) -> Result<Json<ApiResponse<Vec<DeviceSessionResult>>>, ErrorResponse> {
    let repository = DeviceSessionRepository::new(state.pool.clone());
    let sessions = repository.list_active(&user_id).await.map_err(|error| {
        log_info(&request_id, "获取设备列表失败", &error.to_string());
        ErrorResponse::new(error.to_string())
    })?;

    let devices: Vec<DeviceSessionResult> = sessions
        .into_iter()
        .map(|session| DeviceSessionResult {
            is_current: session.device_id == auth_context.device_id,
            device_id: session.device_id,
            created_at: session
                .created_at
                .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                .to_string(),
            last_seen_at: session
                .last_seen_at
                .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                .to_string(),
            expires_at: session
                .expires_at
                .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                .to_string(),
        })
        .collect();

    log_info(
        &request_id,
        "获取设备列表成功",
        &json!({"count": devices.len()}),
    );
    Ok(Json(ApiResponse::success(devices)))
}

/// 撤销指定的其他设备会话
pub async fn revoke_device(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Extension(auth_context): Extension<AuthContext>,
    Json(payload): Json<RevokeDeviceRequest>,
) -> Result<Json<ApiResponse<()>>, ErrorResponse> {
    let device_id = payload.device_id.trim();
    if device_id.is_empty() {
        return Err(ErrorResponse::new("设备 ID 不能为空"));
    }
    if device_id == auth_context.device_id {
        return Err(ErrorResponse::new("不能从当前设备撤销当前设备会话"));
    }

    let user_repo = UserRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );
    service
        .delete_refresh_token(&user_id, device_id)
        .await
        .map_err(|error| {
            log_info(&request_id, "撤销设备会话失败", &error.to_string());
            ErrorResponse::new(error.to_string())
        })?;

    let repository = DeviceSessionRepository::new(state.pool.clone());
    repository
        .delete(&user_id, device_id)
        .await
        .map_err(|error| {
            log_info(&request_id, "清理设备会话失败", &error.to_string());
            ErrorResponse::new(error.to_string())
        })?;

    log_info(
        &request_id,
        "撤销设备会话成功",
        &format!("user_id={}, device_id={}", user_id, device_id),
    );
    Ok(Json(ApiResponse::success_with_message(
        (),
        "设备会话已撤销",
    )))
}

/// 忘记密码
pub async fn forgot_password(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<Json<ApiResponse<ForgotPasswordResult>>, ErrorResponse> {
    log_info(&request_id, "忘记密码请求", &payload);

    let user_repo = UserRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );

    match service.forgot_password(payload).await {
        Ok(reset_token) => {
            log_info(&request_id, "重置令牌生成成功", &"");
            let response = ApiResponse::success(ForgotPasswordResult {
                message: "重置码已发送".to_string(),
                reset_token,
            });
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "忘记密码失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 重置密码
pub async fn reset_password(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<Json<ApiResponse<ResetPasswordResult>>, ErrorResponse> {
    log_info(&request_id, "重置密码请求", &payload);

    let user_repo = UserRepository::new(state.pool.clone());
    let service = AuthService::new(
        user_repo,
        state.redis_client.clone(),
        state.config.auth.clone(),
        state.config.email.clone(),
    );

    match service.reset_password(payload).await {
        Ok(_) => {
            log_info(&request_id, "密码重置成功", &"");
            let response = ApiResponse::success(ResetPasswordResult {
                message: "密码重置成功".to_string(),
            });
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "密码重置失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}

/// 发送注册验证码
pub async fn send_verify_code(
    Extension(request_id): Extension<RequestId>,
    State(state): State<AppState>,
    Json(payload): Json<SendVerifyCodeRequest>,
) -> Result<Json<ApiResponse<()>>, ErrorResponse> {
    log_info(&request_id, "发送验证码请求", &payload);

    let email_service = EmailService::new(state.redis_client.clone(), state.config.email.clone());

    match email_service
        .send_verification_code(&payload.email, &payload.lang)
        .await
    {
        Ok(_) => {
            log_info(
                &request_id,
                "验证码发送成功",
                &format!("email={}", payload.email),
            );
            let response = ApiResponse::success_with_message((), "验证码已发送");
            Ok(Json(response))
        }
        Err(e) => {
            log_info(&request_id, "验证码发送失败", &e.to_string());
            Err(ErrorResponse::new(e.to_string()))
        }
    }
}
