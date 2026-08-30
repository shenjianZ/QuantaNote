use serde::Deserialize;
use std::fmt;

/// 发送验证码请求
#[derive(Deserialize)]
pub struct SendVerifyCodeRequest {
    pub email: String,
    #[serde(default = "default_lang")]
    pub lang: String,
}

impl fmt::Debug for SendVerifyCodeRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SendVerifyCodeRequest {{ email: {} }}", self.email)
    }
}

fn default_lang() -> String {
    "zh-CN".to_string()
}

/// 注册请求
#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    #[serde(default = "default_device_id")]
    pub device_id: String,
    /// 邮件验证码（当邮件服务启用时必填）
    pub verify_code: Option<String>,
}

// 实现 Debug trait，对密码进行脱敏
impl fmt::Debug for RegisterRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "RegisterRequest {{ email: {}, device_id: {}, password: *** }}",
            self.email, self.device_id
        )
    }
}

/// 登录请求
#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    #[serde(default = "default_device_id")]
    pub device_id: String,
}

// 实现 Debug trait
impl fmt::Debug for LoginRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "LoginRequest {{ email: {}, device_id: {}, password: *** }}",
            self.email, self.device_id
        )
    }
}

fn default_device_id() -> String {
    "default".to_string()
}

/// 删除用户请求
#[derive(Deserialize)]
pub struct DeleteUserRequest {
    #[serde(default)]
    pub user_id: String,
    pub password: Option<String>,
}

// 实现 Debug trait
impl fmt::Debug for DeleteUserRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "DeleteUserRequest {{ user_id: {}, password: *** }}",
            self.user_id
        )
    }
}

/// 刷新令牌请求
#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// 撤销设备会话请求
#[derive(Debug, Deserialize)]
pub struct RevokeDeviceRequest {
    pub device_id: String,
}

// RefreshRequest 的 refresh_token 是敏感字段，需要脱敏
impl fmt::Debug for RefreshRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "RefreshRequest {{ refresh_token: *** }}")
    }
}

/// 忘记密码请求
#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
    #[serde(default = "default_lang")]
    pub lang: String,
}

impl fmt::Debug for ForgotPasswordRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "ForgotPasswordRequest {{ email: {} }}", self.email)
    }
}

/// 重置密码请求
#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub email: String,
    pub reset_token: String,
    pub new_password: String,
}

impl fmt::Debug for ResetPasswordRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "ResetPasswordRequest {{ email: {}, reset_token: ***, new_password: *** }}",
            self.email
        )
    }
}
