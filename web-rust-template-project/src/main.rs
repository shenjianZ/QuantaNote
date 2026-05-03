mod cli;
mod config;
mod db;
mod domain;
mod error;
mod handlers;
mod infra;
mod repositories;
mod services;
mod utils;

use axum::{
    routing::{get, post},
    Router,
};
use clap::Parser;
use cli::CliArgs;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// 应用状态
#[derive(Clone)]
pub struct AppState {
    pub pool: db::DbPool,
    pub config: config::app::AppConfig,
    pub redis_client: infra::redis::redis_client::RedisClient,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 解析命令行参数
    let args = CliArgs::parse();

    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| args.get_log_filter().into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 打印启动信息
    args.print_startup_info();

    // 设置工作目录（如果指定）
    if let Some(ref work_dir) = args.work_dir {
        std::env::set_current_dir(work_dir).ok();
        println!("Working directory set to: {}", work_dir.display());
    }

    // 解析配置文件路径（可选）
    let config_path = args.resolve_config_path();

    // 加载配置（支持 CLI 覆盖）
    // 如果没有配置文件，将仅使用环境变量和默认值
    let config = config::app::AppConfig::load_with_overrides(
        config_path,
        args.get_overrides(),
        args.env.as_str(),
    )?;

    tracing::info!("Configuration loaded successfully");
    tracing::info!("Environment: {}", args.env.as_str());
    tracing::info!("Debug mode: {}", args.is_debug_enabled());

    // 打印最终生效的配置（敏感字段已掩码）
    utils::config_logger::print_final_config(&config);

    // 初始化数据库（自动创建数据库和表）
    let pool = db::init_database(&config.database).await?;

    // 初始化 Redis 客户端
    let redis_client = infra::redis::redis_client::RedisClient::new(&config.redis.build_url())
        .await
        .map_err(|e| anyhow::anyhow!("Redis 初始化失败: {}", e))?;

    tracing::info!("Redis 连接池初始化成功");

    // 创建应用状态
    let app_state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        redis_client,
    };

    // ========== 公开路由 ==========
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health_check))
        .route("/info", get(handlers::health::server_info))
        .route("/auth/register", post(handlers::auth::register))
        .route("/auth/login", post(handlers::auth::login))
        .route("/auth/refresh", post(handlers::auth::refresh))
        .route("/auth/forgot-password", post(handlers::auth::forgot_password))
        .route("/auth/reset-password", post(handlers::auth::reset_password));

    // ========== 受保护路由 ==========
    let protected_routes = Router::new()
        .route("/auth/delete", post(handlers::auth::delete_account))
        .route(
            "/auth/delete-refresh-token",
            post(handlers::auth::delete_refresh_token),
        )
        // 同步端点
        .route("/sync/snapshot/latest", get(handlers::sync::get_latest_snapshot))
        .route("/sync/snapshot/:snapshot_id/records", get(handlers::sync::get_snapshot_records))
        .route("/sync/records/push", post(handlers::sync::push_records))
        .route("/sync/records/pull", post(handlers::sync::pull_records))
        .route("/sync/attachments/diff", post(handlers::sync::diff_attachments))
        .route("/sync/attachments/upload", post(handlers::sync::upload_attachment))
        .route("/sync/attachments/download/:attachment_id", get(handlers::sync::download_attachment))
        .route("/sync/commit", post(handlers::sync::commit_sync))
        .route("/sync/history", get(handlers::sync::sync_history))
        .route("/sync/reset", post(handlers::sync::reset_sync_data))
        // JWT 认证中间件（仅应用于受保护路由）
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            infra::middleware::auth::auth_middleware,
        ));

    // ========== 合并路由 ==========
    let app = public_routes
        .merge(protected_routes)
        // CORS（应用于所有路由）
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                        .allow_methods(Any)
                .allow_headers(Any)
        )
        // 日志中间件（应用于所有路由）
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            infra::middleware::logging::request_logging_middleware,
        ))
        .with_state(app_state);

    // 启动服务器
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {}", addr);
    tracing::info!("Press Ctrl+C to stop");

    axum::serve(listener, app).await?;

    Ok(())
}
