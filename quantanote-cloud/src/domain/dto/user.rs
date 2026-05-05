use serde::Deserialize;
use std::fmt;

/// 更新用户资料请求
#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub nickname: Option<String>,
    pub bio: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
}

impl fmt::Debug for UpdateProfileRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "UpdateProfileRequest {{ nickname: {:?}, bio: {:?}, phone: {:?}, address: {:?} }}",
            self.nickname, self.bio, self.phone, self.address
        )
    }
}

/// 修改密码请求
#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}

impl fmt::Debug for ChangePasswordRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "ChangePasswordRequest {{ old_password: ***, new_password: *** }}"
        )
    }
}
