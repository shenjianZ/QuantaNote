use anyhow::Result;
use chrono::Timelike;
use rand::Rng;

use crate::config::email::EmailConfig;
use crate::infra::mailer::Mailer;
use crate::infra::redis::{
    redis_client::RedisClient,
    redis_key::{BusinessType, RedisKey},
};
use crate::utils::mail_template::render_verify_code_mail;

pub struct EmailService {
    redis_client: RedisClient,
    mailer: Option<Mailer>,
    #[allow(dead_code)]
    email_config: EmailConfig,
}

impl EmailService {
    #[allow(dead_code)]
    pub fn new(redis_client: RedisClient, email_config: EmailConfig) -> Self {
        let mailer = if email_config.is_configured() {
            Some(Mailer::new(email_config.clone()))
        } else {
            None
        };
        Self {
            redis_client,
            mailer,
            email_config,
        }
    }

    /// 邮件功能是否已启用且配置正确
    #[allow(dead_code)]
    pub fn is_email_enabled(&self) -> bool {
        self.email_config.is_configured()
    }

    /// 发送验证码
    pub async fn send_verification_code(&self, email: &str, lang: &str) -> Result<()> {
        // 检查邮件功能是否启用
        let mailer = self
            .mailer
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("邮件服务未启用或未配置"))?;

        // 频率限制：检查冷却时间
        let cooldown_key = RedisKey::new(BusinessType::RateLimit)
            .add_identifier("email_cooldown")
            .add_identifier(email);

        if self.redis_client.exists_key(&cooldown_key).await? {
            return Err(anyhow::anyhow!("发送过于频繁，请稍后再试"));
        }

        // 每日发送次数限制
        let daily_key = RedisKey::new(BusinessType::RateLimit)
            .add_identifier("email_daily")
            .add_identifier(email)
            .add_identifier(&Self::today_str());

        let daily_count: Option<String> = self.redis_client.get_key(&daily_key).await?;
        let count = daily_count.and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);

        if count >= 10 {
            return Err(anyhow::anyhow!("今日发送次数已达上限"));
        }

        // 生成 6 位数字验证码
        let code = Self::generate_code();

        // 渲染邮件模板并发送
        let (subject, html_body) = render_verify_code_mail(&code, lang);
        mailer.send(email, &subject, &html_body).await?;

        // 发送成功后，存入 Redis，5 分钟过期
        let code_key = RedisKey::new(BusinessType::Auth)
            .add_identifier("verify_code")
            .add_identifier(email);

        self.redis_client
            .set_ex(&code_key.build(), &code, 300)
            .await
            .map_err(|e| anyhow::anyhow!("Redis 保存失败: {}", e))?;

        // 设置冷却时间 60 秒
        self.redis_client
            .set_ex(&cooldown_key.build(), "1", 60)
            .await
            .map_err(|e| anyhow::anyhow!("Redis 保存失败: {}", e))?;

        // 更新每日发送次数
        let new_count = count + 1;
        let remaining_seconds = Self::seconds_until_midnight();
        let count_val = new_count.to_string();
        self.redis_client
            .set_ex(&daily_key.build(), &count_val, remaining_seconds)
            .await
            .map_err(|e| anyhow::anyhow!("Redis 保存失败: {}", e))?;

        tracing::info!("验证码已发送至: {}", email);

        Ok(())
    }

    /// 验证验证码
    pub async fn verify_code(&self, email: &str, code: &str) -> Result<()> {
        let code_key = RedisKey::new(BusinessType::Auth)
            .add_identifier("verify_code")
            .add_identifier(email);

        let stored_code: Option<String> = self.redis_client.get_key(&code_key).await?;

        match stored_code {
            Some(stored) if stored == code => {
                // 验证成功，删除验证码
                self.redis_client.delete_key(&code_key).await?;
                Ok(())
            }
            Some(_) => Err(anyhow::anyhow!("验证码错误")),
            None => Err(anyhow::anyhow!("验证码已过期或不存在")),
        }
    }

    /// 直接发送邮件（不经过验证码 Redis 逻辑）
    pub async fn send_email_direct(&self, to: &str, subject: &str, html_body: &str) -> Result<()> {
        let mailer = self
            .mailer
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("邮件服务未启用或未配置"))?;
        mailer.send(to, subject, html_body).await
    }

    /// 生成 6 位数字验证码
    fn generate_code() -> String {
        let mut rng = rand::thread_rng();
        format!("{:06}", rng.gen_range(0..1000000))
    }

    /// 获取今天的日期字符串（用于每日限制 key）
    fn today_str() -> String {
        chrono::Local::now().format("%Y-%m-%d").to_string()
    }

    /// 计算距离午夜的秒数
    fn seconds_until_midnight() -> u64 {
        let now = chrono::Local::now();
        let today = now.date_naive();
        let tomorrow = today.succ_opt().unwrap();
        let midnight = tomorrow.and_hms_opt(0, 0, 0).unwrap();
        let now_dt = today
            .and_hms_opt(now.hour(), now.minute(), now.second())
            .unwrap();
        let duration = midnight.signed_duration_since(now_dt);
        duration.num_seconds().max(1) as u64
    }
}
