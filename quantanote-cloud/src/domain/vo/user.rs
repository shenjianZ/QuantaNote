use serde::Serialize;

/// 用户资料响应
#[derive(Debug, Serialize)]
pub struct ProfileResponse {
    pub id: String,
    pub email: String,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub created_at: String,
}

impl From<crate::domain::entities::users::Model> for ProfileResponse {
    fn from(user: crate::domain::entities::users::Model) -> Self {
        Self {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            bio: user.bio,
            phone: user.phone,
            address: user.address,
            created_at: user.created_at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        }
    }
}
