use anyhow::Result;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand::Rng;

use crate::config::auth::AuthConfig;
use crate::config::email::EmailConfig;
use crate::domain::dto::auth::{
    DeleteUserRequest, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest,
};
use crate::domain::entities::users;
use crate::infra::redis::{
    redis_client::RedisClient,
    redis_key::{BusinessType, RedisKey},
};
use crate::repositories::user_repository::UserRepository;
use crate::services::email_service::EmailService;
use crate::utils::jwt::TokenService;

pub struct AuthService {
    user_repo: UserRepository,
    redis_client: RedisClient,
    auth_config: AuthConfig,
    email_config: EmailConfig,
}

impl AuthService {
    pub fn new(
        user_repo: UserRepository,
        redis_client: RedisClient,
        auth_config: AuthConfig,
        email_config: EmailConfig,
    ) -> Self {
        Self {
            user_repo,
            redis_client,
            auth_config,
            email_config,
        }
    }

    /// 哈希密码
    pub fn hash_password(&self, password: &str) -> Result<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("密码哈希失败: {}", e))?
            .to_string();
        Ok(password_hash)
    }

    /// 生成用户 ID
    pub fn generate_user_id(&self) -> String {
        let mut rng = rand::thread_rng();
        rng.gen_range(1_000_000_000i64..10_000_000_000i64)
            .to_string()
    }

    /// 生成唯一的用户 ID
    pub async fn generate_unique_user_id(&self) -> Result<String> {
        let mut attempts = 0;
        const MAX_ATTEMPTS: u32 = 10;

        loop {
            let candidate_id = self.generate_user_id();

            let existing = self.user_repo.count_by_id(&candidate_id).await?;
            if existing == 0 {
                return Ok(candidate_id);
            }

            attempts += 1;
            if attempts >= MAX_ATTEMPTS {
                return Err(anyhow::anyhow!("生成唯一用户 ID 失败"));
            }
        }
    }

    /// 保存 refresh_token 到 Redis（按设备隔离）
    async fn save_refresh_token(
        &self,
        user_id: &str,
        device_id: &str,
        refresh_token: &str,
        expiration_days: i64,
    ) -> Result<()> {
        let key = RedisKey::new(BusinessType::Auth)
            .add_identifier("refresh_token")
            .add_identifier(user_id)
            .add_identifier(device_id);

        let expiration_seconds = expiration_days * 24 * 3600;

        self.redis_client
            .set_ex(&key.build(), refresh_token, expiration_seconds as u64)
            .await
            .map_err(|e| anyhow::anyhow!("Redis 保存失败: {}", e))?;

        Ok(())
    }

    /// 获取并删除 refresh_token（按设备隔离）
    async fn get_and_delete_refresh_token(&self, user_id: &str, device_id: &str) -> Result<String> {
        let key = RedisKey::new(BusinessType::Auth)
            .add_identifier("refresh_token")
            .add_identifier(user_id)
            .add_identifier(device_id);

        let token: Option<String> = self
            .redis_client
            .get(&key.build())
            .await
            .map_err(|e| anyhow::anyhow!("Redis 查询失败: {}", e))?;

        if token.is_some() {
            self.redis_client
                .delete_key(&key)
                .await
                .map_err(|e| anyhow::anyhow!("Redis 删除失败: {}", e))?;
        }

        token.ok_or_else(|| anyhow::anyhow!("刷新令牌无效或已过期"))
    }

    /// 删除用户指定设备的 refresh_token
    pub async fn delete_refresh_token(&self, user_id: &str, device_id: &str) -> Result<()> {
        let key = RedisKey::new(BusinessType::Auth)
            .add_identifier("refresh_token")
            .add_identifier(user_id)
            .add_identifier(device_id);

        self.redis_client
            .delete_key(&key)
            .await
            .map_err(|e| anyhow::anyhow!("Redis 删除失败: {}", e))?;

        Ok(())
    }

    /// 注册用户
    pub async fn register(
        &self,
        request: RegisterRequest,
    ) -> Result<(users::Model, String, String)> {
        // 1. 检查邮箱是否已存在
        let existing = self.user_repo.count_by_email(&request.email).await?;

        if existing > 0 {
            return Err(anyhow::anyhow!("邮箱已注册"));
        }

        // 2. 如果邮件服务启用，校验验证码
        if self.email_config.is_configured() {
            let code = request
                .verify_code
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("请提供邮箱验证码"))?;

            let email_service =
                EmailService::new(self.redis_client.clone(), self.email_config.clone());
            email_service.verify_code(&request.email, code).await?;
        }

        // 3. 哈希密码
        let password_hash = self.hash_password(&request.password)?;

        // 4. 生成用户 ID
        let user_id = self.generate_unique_user_id().await?;

        // 5. 插入数据库并获取包含真实 created_at 的用户对象
        let user = self
            .user_repo
            .insert(user_id.clone(), request.email, password_hash)
            .await?;

        // 6. 生成 token（绑定设备）
        let (access_token, refresh_token) = TokenService::generate_token_pair(
            &user_id,
            &request.device_id,
            self.auth_config.access_token_expiration_minutes,
            self.auth_config.refresh_token_expiration_days,
            &self.auth_config.jwt_secret,
        )?;

        // 7. 保存 refresh_token（按设备隔离）
        self.save_refresh_token(
            &user_id,
            &request.device_id,
            &refresh_token,
            self.auth_config.refresh_token_expiration_days as i64,
        )
        .await?;

        Ok((user, access_token, refresh_token))
    }

    /// 登录
    pub async fn login(&self, request: LoginRequest) -> Result<(users::Model, String, String)> {
        // 1. 查询用户
        let user = self
            .user_repo
            .find_by_email(&request.email)
            .await?
            .ok_or_else(|| anyhow::anyhow!("邮箱或密码错误"))?;

        // 2. 验证密码
        let password_hash = self
            .user_repo
            .get_password_hash(&request.email)
            .await?
            .ok_or_else(|| anyhow::anyhow!("邮箱或密码错误"))?;

        let parsed_hash = PasswordHash::new(&password_hash)
            .map_err(|e| anyhow::anyhow!("解析密码哈希失败: {}", e))?;
        let argon2 = Argon2::default();

        argon2
            .verify_password(request.password.as_bytes(), &parsed_hash)
            .map_err(|_| anyhow::anyhow!("邮箱或密码错误"))?;

        // 3. 生成 token（绑定设备）
        let (access_token, refresh_token) = TokenService::generate_token_pair(
            &user.id,
            &request.device_id,
            self.auth_config.access_token_expiration_minutes,
            self.auth_config.refresh_token_expiration_days,
            &self.auth_config.jwt_secret,
        )?;

        // 4. 保存 refresh_token（按设备隔离）
        self.save_refresh_token(
            &user.id,
            &request.device_id,
            &refresh_token,
            self.auth_config.refresh_token_expiration_days as i64,
        )
        .await?;

        Ok((user, access_token, refresh_token))
    }

    /// 使用 refresh_token 刷新 access_token
    pub async fn refresh_access_token(&self, refresh_token: &str) -> Result<(String, String)> {
        // 1. 从 refresh_token 中解码出 user_id 和 device_id
        let user_id = TokenService::decode_user_id(refresh_token, &self.auth_config.jwt_secret)?;
        let device_id =
            TokenService::decode_device_id(refresh_token, &self.auth_config.jwt_secret)?;

        // 2. 从 Redis 获取该设备的存储 token 并删除
        let stored_token = self
            .get_and_delete_refresh_token(&user_id, &device_id)
            .await?;

        // 3. 验证 token 是否匹配
        if stored_token != refresh_token {
            return Err(anyhow::anyhow!("刷新令牌无效"));
        }

        // 4. 生成新的 token 对（绑定同一设备）
        let (new_access_token, new_refresh_token) = TokenService::generate_token_pair(
            &user_id,
            &device_id,
            self.auth_config.access_token_expiration_minutes,
            self.auth_config.refresh_token_expiration_days,
            &self.auth_config.jwt_secret,
        )?;

        // 5. 保存新的 refresh_token（按设备隔离）
        self.save_refresh_token(
            &user_id,
            &device_id,
            &new_refresh_token,
            self.auth_config.refresh_token_expiration_days as i64,
        )
        .await?;

        Ok((new_access_token, new_refresh_token))
    }

    /// 忘记密码 - 生成重置令牌
    /// 邮件启用时发送邮件，否则直接返回 token（开发调试用）
    pub async fn forgot_password(&self, request: ForgotPasswordRequest) -> Result<Option<String>> {
        // 1. 查找用户
        let user = self
            .user_repo
            .find_by_email(&request.email)
            .await?
            .ok_or_else(|| anyhow::anyhow!("邮箱未注册"))?;

        // 2. 生成重置令牌
        let reset_token = uuid::Uuid::new_v4().to_string();

        // 3. 存入 Redis，15 分钟过期
        let key = RedisKey::new(BusinessType::Auth)
            .add_identifier("reset_token")
            .add_identifier(&user.id);

        self.redis_client
            .set_ex(&key.build(), &reset_token, 900) // 15 分钟
            .await
            .map_err(|e| anyhow::anyhow!("Redis 保存失败: {}", e))?;

        // 4. 邮件启用时发送重置码邮件
        if self.email_config.is_configured() {
            let email_service =
                EmailService::new(self.redis_client.clone(), self.email_config.clone());
            let (subject, html_body) =
                crate::utils::mail_template::render_reset_password_mail(&reset_token, &request.lang);
            email_service.send_email_direct(&user.email, &subject, &html_body).await?;
            tracing::info!("重置密码邮件已发送至: {}", user.email);
            Ok(None)
        } else {
            Ok(Some(reset_token))
        }
    }

    /// 重置密码
    pub async fn reset_password(&self, request: ResetPasswordRequest) -> Result<()> {
        // 1. 查找用户
        let user = self
            .user_repo
            .find_by_email(&request.email)
            .await?
            .ok_or_else(|| anyhow::anyhow!("邮箱未注册"))?;

        // 2. 验证重置令牌
        let key = RedisKey::new(BusinessType::Auth)
            .add_identifier("reset_token")
            .add_identifier(&user.id);

        let stored_token: Option<String> = self
            .redis_client
            .get(&key.build())
            .await
            .map_err(|e| anyhow::anyhow!("Redis 查询失败: {}", e))?;

        let stored_token = stored_token.ok_or_else(|| anyhow::anyhow!("重置令牌已过期或无效"))?;

        if stored_token != request.reset_token {
            return Err(anyhow::anyhow!("重置令牌无效"));
        }

        // 3. 删除已使用的令牌
        self.redis_client
            .delete_key(&key)
            .await
            .map_err(|e| anyhow::anyhow!("Redis 删除失败: {}", e))?;

        // 4. 更新密码
        let new_password_hash = self.hash_password(&request.new_password)?;
        self.user_repo
            .update_password(&user.id, &new_password_hash)
            .await?;

        Ok(())
    }

    /// 验证删除用户请求（检查用户存在、可选密码验证）
    pub async fn validate_delete_user(&self, request: &DeleteUserRequest) -> Result<()> {
        let _user = self
            .user_repo
            .find_by_id(&request.user_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("用户不存在"))?;

        if let Some(password) = &request.password {
            let password_hash = self
                .user_repo
                .get_password_hash(&request.user_id)
                .await?
                .ok_or_else(|| anyhow::anyhow!("用户不存在"))?;

            let parsed_hash = PasswordHash::new(&password_hash)
                .map_err(|e| anyhow::anyhow!("解析密码哈希失败: {}", e))?;
            let argon2 = Argon2::default();

            argon2
                .verify_password(password.as_bytes(), &parsed_hash)
                .map_err(|_| anyhow::anyhow!("密码错误"))?;
        }

        Ok(())
    }

    /// 删除用户（仅执行删除，不验证）
    pub async fn delete_user(&self, user_id: &str) -> Result<()> {
        self.user_repo.delete_by_id(user_id).await?;
        Ok(())
    }
}
