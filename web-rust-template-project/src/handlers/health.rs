use crate::db;
use crate::AppState;
use axum::{
    extract::State,
    response::{IntoResponse, Json},
};
use serde_json::json;

/// 健康检查端点
pub async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    match db::health_check(&state.pool).await {
        Ok(_) => Json(json!({"status": "ok"})),
        Err(_) => Json(json!({"status": "unavailable"})),
    }
}

/// 获取服务器信息
pub async fn server_info() -> impl IntoResponse {
    Json(json!({
        "name": "web-rust-template",
        "version": "0.1.0",
        "status": "running",
        "timestamp": chrono::Utc::now().timestamp()
    }))
}
