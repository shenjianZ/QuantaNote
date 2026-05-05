use serde::Deserialize;

fn default_enabled() -> bool {
    false
}

fn default_smtp_port() -> u16 {
    465
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct EmailConfig {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub smtp_host: String,
    #[serde(default = "default_smtp_port")]
    pub smtp_port: u16,
    #[serde(default)]
    pub smtp_username: String,
    #[serde(default)]
    pub smtp_password: String,
    #[serde(default = "default_from_name")]
    pub from_name: String,
    #[serde(default)]
    pub from_email: String,
}

fn default_from_name() -> String {
    "QuantaNote".to_string()
}

impl EmailConfig {
    pub fn is_configured(&self) -> bool {
        self.enabled && !self.smtp_host.is_empty() && !self.smtp_username.is_empty()
    }
}
