use anyhow::Result;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

use crate::domain::dto::user::UpdateProfileRequest;
use crate::domain::vo::user::ProfileResponse;
use crate::repositories::user_repository::UserRepository;

pub struct UserService {
    user_repo: UserRepository,
}

impl UserService {
    pub fn new(user_repo: UserRepository) -> Self {
        Self { user_repo }
    }

    /// 获取用户资料
    pub async fn get_profile(&self, user_id: &str) -> Result<ProfileResponse> {
        let user = self
            .user_repo
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("用户不存在"))?;

        Ok(ProfileResponse::from(user))
    }

    /// 更新用户资料
    pub async fn update_profile(
        &self,
        user_id: &str,
        request: UpdateProfileRequest,
    ) -> Result<ProfileResponse> {
        let updated = self
            .user_repo
            .update_profile(
                user_id,
                request.nickname,
                request.bio,
                request.phone,
                request.address,
            )
            .await?;

        Ok(ProfileResponse::from(updated))
    }

    /// 修改密码
    pub async fn change_password(
        &self,
        user_id: &str,
        old_password: &str,
        new_password: &str,
    ) -> Result<()> {
        let user = self
            .user_repo
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("用户不存在"))?;

        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|e| anyhow::anyhow!("解析密码哈希失败: {}", e))?;
        let argon2 = Argon2::default();

        argon2
            .verify_password(old_password.as_bytes(), &parsed_hash)
            .map_err(|_| anyhow::anyhow!("旧密码错误"))?;

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let new_hash = argon2
            .hash_password(new_password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("密码哈希失败: {}", e))?
            .to_string();

        self.user_repo.update_password(user_id, &new_hash).await?;

        Ok(())
    }

    /// 更新头像 URL
    #[allow(dead_code)]
    pub async fn update_avatar(&self, user_id: &str, avatar_url: &str) -> Result<()> {
        self.user_repo.update_avatar(user_id, avatar_url).await
    }
}
