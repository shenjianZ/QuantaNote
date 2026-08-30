use crate::AppState;
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;

#[derive(Clone, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    #[serde(default)]
    pub device_id: String,
    #[allow(dead_code)]
    pub exp: usize,
}

/// 已通过 JWT 校验的用户和设备上下文。
#[derive(Clone)]
pub struct AuthContext {
    pub device_id: String,
}

/// JWT 认证中间件
pub async fn auth_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. 提取 Authorization header
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..];

    // 2. 验证 JWT
    let jwt_secret = &state.config.auth.jwt_secret;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // 3. 将用户和设备上下文添加到请求扩展。
    let claims = token_data.claims;
    req.extensions_mut().insert(claims.sub.clone());
    req.extensions_mut().insert(AuthContext {
        device_id: claims.device_id,
    });

    Ok(next.run(req).await)
}
