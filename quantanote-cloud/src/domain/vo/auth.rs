use serde::Serialize;

/// 设备会话信息，不包含任何令牌或凭据。
#[derive(Debug, Serialize)]
pub struct DeviceSessionResult {
    pub device_id: String,
    pub created_at: String,
    pub last_seen_at: String,
    pub expires_at: String,
    pub is_current: bool,
}

/// 注册结果
#[derive(Debug, Serialize)]
pub struct RegisterResult {
    #[serde(rename = "user_id")]
    pub id: String,
    pub email: String,
    pub created_at: String, // ISO 8601 格式
    pub access_token: String,
    pub refresh_token: String,
}

impl From<(crate::domain::entities::users::Model, String, String)> for RegisterResult {
    fn from(
        (user_model, access_token, refresh_token): (
            crate::domain::entities::users::Model,
            String,
            String,
        ),
    ) -> Self {
        Self {
            id: user_model.id,
            email: user_model.email,
            created_at: user_model
                .created_at
                .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                .to_string(),
            access_token,
            refresh_token,
        }
    }
}

/// 登录结果
#[derive(Debug, Serialize)]
pub struct LoginResult {
    #[serde(rename = "user_id")]
    pub id: String,
    pub email: String,
    pub created_at: String, // ISO 8601 格式
    pub access_token: String,
    pub refresh_token: String,
}

impl From<(crate::domain::entities::users::Model, String, String)> for LoginResult {
    fn from(
        (user_model, access_token, refresh_token): (
            crate::domain::entities::users::Model,
            String,
            String,
        ),
    ) -> Self {
        Self {
            id: user_model.id,
            email: user_model.email,
            created_at: user_model
                .created_at
                .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                .to_string(),
            access_token,
            refresh_token,
        }
    }
}

/// 刷新 Token 结果
#[derive(Debug, Serialize)]
pub struct RefreshResult {
    pub access_token: String,
    pub refresh_token: String,
}

/// 忘记密码结果
#[derive(Debug, Serialize)]
pub struct ForgotPasswordResult {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_token: Option<String>,
}

/// 重置密码结果
#[derive(Debug, Serialize)]
pub struct ResetPasswordResult {
    pub message: String,
}
