use anyhow::{Context, Result};
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::config::email::EmailConfig;

/// 邮件发送器（支持连接池）
#[derive(Clone)]
pub struct Mailer {
    config: Arc<EmailConfig>,
    semaphore: Arc<Semaphore>,
}

impl Mailer {
    pub fn new(config: EmailConfig) -> Self {
        Self {
            config: Arc::new(config),
            semaphore: Arc::new(Semaphore::new(5)),
        }
    }

    /// 发送 HTML 邮件
    pub async fn send(&self, to: &str, subject: &str, html_body: &str) -> Result<()> {
        let _permit = self.semaphore.acquire().await;

        let creds = Credentials::new(
            self.config.smtp_username.clone(),
            self.config.smtp_password.clone(),
        );

        let mailer = SmtpTransport::relay(&self.config.smtp_host)
            .context("Failed to create SMTP relay")?
            .port(self.config.smtp_port)
            .credentials(creds)
            .build();

        let email = Message::builder()
            .from(
                format!("{} <{}>", self.config.from_name, self.config.from_email)
                    .parse()
                    .map_err(|_| anyhow::anyhow!("Invalid from address"))?,
            )
            .to(to
                .parse()
                .map_err(|_| anyhow::anyhow!("Invalid email address: {}", to))?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html_body.to_string())
            .context("Failed to build email body")?;

        mailer
            .send(&email)
            .map_err(|e| {
                let error_msg = e.to_string();
                if error_msg.contains("timeout") || error_msg.contains("timed out") {
                    anyhow::anyhow!("Email sending timeout")
                } else if error_msg.contains("connection") || error_msg.contains("connect") {
                    anyhow::anyhow!("Cannot connect to email server")
                } else {
                    anyhow::anyhow!("Failed to send email via SMTP: {}", error_msg)
                }
            })?;

        Ok(())
    }
}
