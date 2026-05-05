use crate::config::app::AppConfig;
use crate::config::database::DatabaseType;

/// 将敏感字符串部分掩码（显示前2后2位），空值显示为 `<未设置>`
fn mask_secret(opt: &Option<String>) -> String {
    match opt {
        Some(s) if !s.is_empty() => {
            if s.len() <= 4 {
                "****".to_string()
            } else {
                format!("{}****{}", &s[..2], &s[s.len() - 2..])
            }
        }
        _ => "<未设置>".to_string(),
    }
}

/// 将普通 Option<String> 显示为值或 `<未设置>`
fn display_opt(opt: &Option<String>) -> String {
    match opt {
        Some(s) if !s.is_empty() => s.clone(),
        _ => "<未设置>".to_string(),
    }
}

/// 将 Option<PathBuf> 显示为值或 `<未设置>`
fn display_path(opt: &Option<std::path::PathBuf>) -> String {
    match opt {
        Some(p) => p.display().to_string(),
        _ => "<未设置>".to_string(),
    }
}

/// 将 Option<u16> 显示为值或 `<未设置>`
fn display_port(opt: &Option<u16>) -> String {
    match opt {
        Some(p) => p.to_string(),
        _ => "<未设置>".to_string(),
    }
}

/// 将 String 显示为值或 `<未设置>`（空字符串视为未设置）
fn display_str(s: &str) -> String {
    if s.is_empty() {
        "<未设置>".to_string()
    } else {
        s.to_string()
    }
}

/// 将 String 作为敏感字段掩码（空字符串视为未设置）
fn mask_str(s: &str) -> String {
    if s.is_empty() {
        "<未设置>".to_string()
    } else if s.len() <= 4 {
        "****".to_string()
    } else {
        format!("{}****{}", &s[..2], &s[s.len() - 2..])
    }
}

fn db_type_name(dt: &DatabaseType) -> &'static str {
    match dt {
        DatabaseType::MySQL => "mysql",
        DatabaseType::SQLite => "sqlite",
        DatabaseType::PostgreSQL => "postgresql",
    }
}

/// 打印应用最终使用的全部配置值（敏感字段以 `****` 替代）
pub fn print_final_config(config: &AppConfig) {
    tracing::info!("╔══════════════════════════════════════════════════╗");
    tracing::info!("║           应用最终配置 (Final Config)            ║");
    tracing::info!("╠══════════════════════════════════════════════════╣");

    // ── Server ──
    tracing::info!("║ [server]                                        ║");
    tracing::info!("║   host = {}", config.server.host);
    tracing::info!("║   port = {}", config.server.port);

    // ── Database ──
    tracing::info!("║ [database]                                      ║");
    tracing::info!(
        "║   database_type = {}",
        db_type_name(&config.database.database_type)
    );
    tracing::info!("║   host          = {}", display_opt(&config.database.host));
    tracing::info!(
        "║   port          = {}",
        display_port(&config.database.port)
    );
    tracing::info!("║   user          = {}", display_opt(&config.database.user));
    tracing::info!(
        "║   password      = {}",
        mask_secret(&config.database.password)
    );
    tracing::info!(
        "║   database      = {}",
        display_opt(&config.database.database)
    );
    tracing::info!(
        "║   path          = {}",
        display_path(&config.database.path)
    );
    tracing::info!("║   max_connections = {}", config.database.max_connections);

    // ── Auth ──
    tracing::info!("║ [auth]                                          ║");
    tracing::info!(
        "║   jwt_secret                     = {}",
        mask_secret(&Some(config.auth.jwt_secret.clone()))
    );
    tracing::info!(
        "║   access_token_expiration_minutes = {}",
        config.auth.access_token_expiration_minutes
    );
    tracing::info!(
        "║   refresh_token_expiration_days   = {}",
        config.auth.refresh_token_expiration_days
    );

    // ── Redis ──
    tracing::info!("║ [redis]                                         ║");
    tracing::info!("║   host     = {}", config.redis.host);
    tracing::info!("║   port     = {}", config.redis.port);
    tracing::info!("║   password = {}", mask_secret(&config.redis.password));
    tracing::info!("║   db       = {}", config.redis.db);

    // ── Storage ──
    tracing::info!("║ [storage]                                       ║");
    tracing::info!("║   backend_type    = {}", config.storage.backend_type);
    tracing::info!(
        "║   base_path       = {}",
        display_opt(&config.storage.base_path)
    );
    tracing::info!(
        "║   bucket          = {}",
        display_opt(&config.storage.bucket)
    );
    tracing::info!(
        "║   endpoint        = {}",
        display_opt(&config.storage.endpoint)
    );
    tracing::info!(
        "║   region          = {}",
        display_opt(&config.storage.region)
    );
    tracing::info!(
        "║   access_key      = {}",
        mask_secret(&config.storage.access_key)
    );
    tracing::info!(
        "║   secret_key      = {}",
        mask_secret(&config.storage.secret_key)
    );
    tracing::info!(
        "║   webdav_url      = {}",
        display_opt(&config.storage.webdav_url)
    );
    tracing::info!(
        "║   webdav_username = {}",
        display_opt(&config.storage.webdav_username)
    );
    tracing::info!(
        "║   webdav_password = {}",
        mask_secret(&config.storage.webdav_password)
    );

    // ── Email ──
    tracing::info!("║ [email]                                         ║");
    tracing::info!("║   enabled       = {}", config.email.enabled);
    tracing::info!(
        "║   smtp_host     = {}",
        display_str(&config.email.smtp_host)
    );
    tracing::info!("║   smtp_port     = {}", config.email.smtp_port);
    tracing::info!(
        "║   smtp_username = {}",
        display_str(&config.email.smtp_username)
    );
    tracing::info!(
        "║   smtp_password = {}",
        mask_str(&config.email.smtp_password)
    );
    tracing::info!(
        "║   from_name     = {}",
        display_str(&config.email.from_name)
    );
    tracing::info!(
        "║   from_email    = {}",
        display_str(&config.email.from_email)
    );

    tracing::info!("╚══════════════════════════════════════════════════╝");
}
