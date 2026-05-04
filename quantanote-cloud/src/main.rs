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
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};
use clap::Parser;
use cli::CliArgs;
use services::sync_service::SyncService;
use std::time::Duration;
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
        .route(
            "/auth/forgot-password",
            post(handlers::auth::forgot_password),
        )
        .route("/auth/reset-password", post(handlers::auth::reset_password));

    // ========== 受保护路由 ==========
    let protected_routes = Router::new()
        .route("/auth/delete", post(handlers::auth::delete_account))
        .route(
            "/auth/delete-refresh-token",
            post(handlers::auth::delete_refresh_token),
        )
        // 同步端点
        .route(
            "/sync/snapshot/latest",
            get(handlers::sync::get_latest_snapshot),
        )
        .route(
            "/sync/snapshot/:snapshot_id/records",
            get(handlers::sync::get_snapshot_records),
        )
        .route("/sync/records/push", post(handlers::sync::push_records))
        .route("/sync/records/pull", post(handlers::sync::pull_records))
        .route(
            "/sync/attachments/diff",
            post(handlers::sync::diff_attachments),
        )
        .route(
            "/sync/attachments/upload",
            post(handlers::sync::upload_attachment)
                .layer(DefaultBodyLimit::max(50 * 1024 * 1024)), // 附件上传限制 50MB
        )
        .route(
            "/sync/attachments/download/:attachment_id",
            get(handlers::sync::download_attachment),
        )
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
                .allow_headers(Any),
        )
        // 日志中间件（应用于所有路由）
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            infra::middleware::logging::request_logging_middleware,
        ))
        .with_state(app_state.clone());

    // 启动 pending 孤儿文件定时清理任务
    tokio::spawn(pending_cleanup_task(app_state.clone()));
    tracing::info!("Pending 清理定时任务已启动 (每6小时, 清理超过24小时的孤儿数据)");

    // 启动服务器
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {}", addr);
    tracing::info!("Press Ctrl+C to stop");

    axum::serve(listener, app).await?;

    Ok(())
}

/// Pending 孤儿文件定时清理任务
///
/// 生命周期：
/// 1. 启动后等待 30 秒（给服务启动缓冲）
/// 2. 每 6 小时执行一次清理
/// 3. 清理超过 24 小时的 pending 记录和附件（DB + 存储文件）
/// 4. 每次清理有 5 分钟超时保护
/// 5. 单条文件删除失败不影响其他文件
async fn pending_cleanup_task(state: AppState) {
    let initial_delay = Duration::from_secs(30);
    let interval_duration = Duration::from_secs(6 * 3600);
    let age_hours: i64 = 24;
    let cleanup_timeout = Duration::from_secs(5 * 60);

    tracing::info!("pending 清理任务: 等待 {}s 后首次执行", initial_delay.as_secs());
    tokio::time::sleep(initial_delay).await;

    let mut interval = tokio::time::interval(interval_duration);
    interval.tick().await; // 消耗首次立即触发

    loop {
        interval.tick().await;
        tracing::info!("开始清理过期 pending 数据 (age >= {}h)", age_hours);

        let result = tokio::time::timeout(cleanup_timeout, run_cleanup(&state, age_hours)).await;

        match result {
            Ok(Ok(stats)) => {
                if stats.records_deleted > 0 || stats.attachments_deleted > 0 {
                    tracing::info!(
                        "pending 清理完成: 删除 {} 条记录, {} 个附件, 释放 {} bytes, 存储错误 {} 次",
                        stats.records_deleted,
                        stats.attachments_deleted,
                        stats.bytes_freed,
                        stats.storage_errors,
                    );
                } else {
                    tracing::info!("pending 清理完成: 无过期数据");
                }
            }
            Ok(Err(e)) => {
                tracing::error!("pending 清理执行失败: {}", e);
            }
            Err(_) => {
                tracing::error!("pending 清理超时 (>{:.0}s), 跳过本轮", cleanup_timeout.as_secs_f64());
            }
        }
    }
}

async fn run_cleanup(state: &AppState, age_hours: i64) -> anyhow::Result<services::sync_service::CleanupStats> {
    let repo = repositories::sync_repository::SyncRepository::new(state.pool.clone());
    let storage = infra::storage::create_storage_backend(&state.config.storage)?;
    let service = SyncService::new(repo, storage);
    service.cleanup_stale_pending(age_hours).await
}
