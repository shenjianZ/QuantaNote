mod commands;
mod db;
mod error;
mod models;
mod repositories;
mod services;
mod sync;
mod utils;

use commands::{
    attachment, auto_backup, data_io, diagnostics, item, search, settings, tag, user, version,
};
use db::DbState;
use std::sync::atomic::{AtomicBool, Ordering};
use utils::logging::tauri_log_plugin;
use utils::paths;

// ── Desktop-only: tray, autostart, updater, window behavior ────────────────
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
#[cfg(desktop)]
use tauri::tray::TrayIconBuilder;
#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;
#[cfg(desktop)]
const AUTOSTART_HIDDEN_ARG: &str = "--quantanote-start-hidden";

/// 窗口行为设置状态，由前端同步（桌面端专用功能）
pub struct WindowBehavior {
    pub minimize_to_tray: AtomicBool,
    pub close_keep_running: AtomicBool,
}

#[tauri::command]
fn update_window_behavior(
    state: tauri::State<'_, WindowBehavior>,
    minimize_to_tray: bool,
    close_keep_running: bool,
) {
    state
        .minimize_to_tray
        .store(minimize_to_tray, Ordering::Relaxed);
    state
        .close_keep_running
        .store(close_keep_running, Ordering::Relaxed);
}

#[tauri::command]
fn request_app_exit(app: tauri::AppHandle) {
    if let Some(db_state) = app.try_state::<DbState>() {
        match db_state.checkpoint_wal() {
            Ok(()) => log::info!("SQLite WAL checkpoint completed before app exit"),
            Err(error) => log::warn!("SQLite WAL checkpoint failed before app exit: {}", error),
        }
    }

    app.exit(0);
}

#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        if std::env::var("QUANTANOTE_E2E_FULLSCREEN").as_deref() == Ok("1") {
            let _ = window.maximize();
        }
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn emit_tray_command(app: &tauri::AppHandle, command: &str) {
    show_main_window(app);
    let _ = app.emit("quantanote-tray-command", command);
}

#[cfg(desktop)]
fn should_start_hidden<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .any(|arg| arg.as_ref() == AUTOSTART_HIDDEN_ARG)
}

#[cfg(desktop)]
fn is_hidden_autostart_launch() -> bool {
    should_start_hidden(std::env::args())
}

// ── Entry point ────────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    utils::logging::init_sql_log_state();

    let builder = tauri::Builder::default()
        .plugin(tauri_log_plugin())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WindowBehavior {
            minimize_to_tray: AtomicBool::new(true),
            close_keep_running: AtomicBool::new(false),
        });

    // ── Desktop-only plugins ───────────────────────────────────────────
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_HIDDEN_ARG]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .setup(move |app| {
            #[cfg(target_os = "android")]
            {
                let data_dir = app
                    .path()
                    .app_data_dir()
                    .map_err(|e| format!("解析 Android 数据目录失败: {}", e))?
                    .join("quantanote");
                let _ = data_dir;
            }

            let quantanote_dir = paths::quantanote_dir();
            std::fs::create_dir_all(&quantanote_dir)
                .map_err(|e| format!("创建数据目录失败: {}", e))?;

            let db_path = quantanote_dir.join("quanta_note.sqlite");
            let db_state = DbState::open(&db_path.to_string_lossy())
                .map_err(|e| format!("打开数据库失败: {}", e))?;
            db_state
                .initialize_schema()
                .map_err(|e| format!("初始化数据库表结构失败: {}", e))?;

            app.manage(db_state);

            // 启动自动备份调度器
            services::backup_service::start_backup_scheduler(app.handle());

            let db = app.state::<DbState>();
            commands::sync::init_sync_engine(app.handle(), &db);

            // ── Desktop: sync engine + system tray ─────────────────────
            #[cfg(desktop)]
            {
                // 系统托盘
                let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
                let new_note_item =
                    MenuItem::with_id(app, "new_note", "新建笔记", true, None::<&str>)?;
                let workspace_item =
                    MenuItem::with_id(app, "workspace", "打开工作台", true, None::<&str>)?;
                let library_item =
                    MenuItem::with_id(app, "library", "打开记录库", true, None::<&str>)?;
                let settings_item =
                    MenuItem::with_id(app, "settings", "打开设置", true, None::<&str>)?;
                let show_floating_ball_item =
                    MenuItem::with_id(app, "show_floating_ball", "显示悬浮球", true, None::<&str>)?;
                let hide_floating_ball_item =
                    MenuItem::with_id(app, "hide_floating_ball", "隐藏悬浮球", true, None::<&str>)?;
                let separator = PredefinedMenuItem::separator(app)?;
                let floating_separator = PredefinedMenuItem::separator(app)?;
                let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(
                    app,
                    &[
                        &show_item,
                        &new_note_item,
                        &workspace_item,
                        &library_item,
                        &settings_item,
                        &floating_separator,
                        &show_floating_ball_item,
                        &hide_floating_ball_item,
                        &separator,
                        &quit_item,
                    ],
                )?;

                let _tray = TrayIconBuilder::new()
                    .icon(
                        app.default_window_icon()
                            .ok_or_else(|| "未配置窗口图标".to_string())?
                            .clone(),
                    )
                    .menu(&menu)
                    .tooltip("QuantaNote")
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            show_main_window(app);
                        }
                    })
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "show" => {
                            show_main_window(app);
                        }
                        "new_note" => emit_tray_command(app, "new-note"),
                        "workspace" => emit_tray_command(app, "open-workspace"),
                        "library" => emit_tray_command(app, "open-library"),
                        "settings" => emit_tray_command(app, "open-settings"),
                        "show_floating_ball" => emit_tray_command(app, "show-floating-ball"),
                        "hide_floating_ball" => emit_tray_command(app, "hide-floating-ball"),
                        "quit" => {
                            if let Some(db_state) = app.try_state::<DbState>() {
                                match db_state.checkpoint_wal() {
                                    Ok(()) => log::info!("退出时 WAL checkpoint 完成"),
                                    Err(e) => log::warn!("退出时 WAL checkpoint 失败: {}", e),
                                }
                            }
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .build(app)?;

                // 桌面端：根据 autostart 参数决定是否隐藏窗口
                if is_hidden_autostart_launch() {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                } else {
                    show_main_window(app.handle());
                }
            }

            Ok(())
        })
        // ── Desktop: window close behavior ─────────────────────────────
        .on_window_event(|_window, _event| {
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = _event {
                let behavior = _window.state::<WindowBehavior>();
                let keep_running = behavior.close_keep_running.load(Ordering::Relaxed);

                if keep_running && _window.label() == "main" {
                    api.prevent_close();
                    let _ = _window.hide();
                } else if let Some(db_state) = _window.try_state::<DbState>() {
                    match db_state.checkpoint_wal() {
                        Ok(()) => {
                            log::info!("SQLite WAL checkpoint completed before window close")
                        }
                        Err(error) => log::warn!(
                            "SQLite WAL checkpoint failed before window close: {}",
                            error
                        ),
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            item::create_item,
            item::get_items,
            item::get_item,
            item::update_item,
            item::delete_item,
            item::get_pinned_items,
            item::get_recent_items,
            search::search_items,
            attachment::add_attachment,
            attachment::get_attachments,
            attachment::delete_attachment,
            version::get_versions,
            version::create_version,
            version::update_version,
            version::restore_version,
            version::delete_version,
            item::get_db_size,
            item::optimize_db,
            data_io::export_data,
            data_io::import_data,
            data_io::save_to_file,
            data_io::read_from_file,
            data_io::get_export_size_estimate,
            data_io::export_data_zip,
            data_io::export_data_zip_to_default,
            data_io::import_data_zip,
            data_io::import_data_zip_bytes,
            diagnostics::get_sql_log_config,
            diagnostics::update_sql_log_config,
            diagnostics::clear_sql_log,
            diagnostics::get_log_dir,
            diagnostics::get_sql_log_path,
            auto_backup::get_auto_backup_config,
            auto_backup::update_auto_backup_config,
            auto_backup::trigger_backup_now,
            auto_backup::get_backup_dir_path,
            auto_backup::list_backups,
            auto_backup::delete_backup,
            tag::get_all_tags,
            tag::create_tag,
            tag::delete_tag,
            tag::get_item_tags,
            tag::get_all_item_tag_mappings,
            tag::set_item_tags,
            tag::rename_tag,
            tag::update_tag_color,
            tag::get_tag_item_counts,
            item::get_db_path,
            item::get_library_data,
            settings::load_all_settings,
            settings::save_settings,
            commands::sync::get_sync_config,
            commands::sync::save_sync_config_cmd,
            commands::sync::get_sync_state,
            commands::sync::trigger_sync,
            commands::sync::sync_login,
            commands::sync::sync_register,
            commands::sync::sync_logout,
            commands::sync::sync_forgot_password,
            commands::sync::sync_reset_password,
            commands::sync::test_sync_connection,
            commands::sync::get_sync_history,
            commands::sync::get_pending_conflicts,
            commands::sync::resolve_sync_conflicts,
            commands::sync::cancel_sync_conflicts,
            commands::sync::send_verify_code,
            user::get_user_profile,
            user::update_user_profile,
            user::change_password,
            user::upload_avatar,
            user::delete_account,
            update_window_behavior,
            request_app_exit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[cfg(desktop)]
    use super::{should_start_hidden, AUTOSTART_HIDDEN_ARG};

    #[test]
    #[cfg(desktop)]
    fn detects_hidden_autostart_argument() {
        assert!(should_start_hidden(["quantanote", AUTOSTART_HIDDEN_ARG]));
    }

    #[test]
    #[cfg(desktop)]
    fn ignores_unrelated_arguments() {
        assert!(!should_start_hidden(["quantanote", "--other-flag"]));
    }
}

#[cfg(test)]
mod test_support {
    use std::path::PathBuf;
    use std::sync::{Mutex, MutexGuard, OnceLock};

    use crate::db::DbState;

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    pub fn test_db() -> DbState {
        let db = DbState::open(":memory:").expect("open in-memory database");
        db.initialize_schema().expect("initialize schema");
        db
    }

    pub fn unique_temp_dir(prefix: &str) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("quantanote-{}-{}", prefix, uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    pub fn lock_test_data_dir(path: &PathBuf) -> MutexGuard<'static, ()> {
        let guard = ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("lock test data dir");
        std::env::set_var("QUANTANOTE_DATA_DIR", path);
        guard
    }
}
