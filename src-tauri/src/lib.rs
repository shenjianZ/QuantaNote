mod commands;
mod db;
mod error;
mod models;
mod repositories;
mod services;
mod utils;

use commands::{attachment, data_io, item, search, tag, version};
use db::DbState;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};
use utils::logging::tauri_log_plugin;
use utils::paths;

/// 窗口行为设置状态，由前端同步
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
    state.minimize_to_tray.store(minimize_to_tray, Ordering::Relaxed);
    state.close_keep_running.store(close_keep_running, Ordering::Relaxed);
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn emit_tray_command(app: &tauri::AppHandle, command: &str) {
    show_main_window(app);
    let _ = app.emit("quantanote-tray-command", command);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_log_plugin())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(WindowBehavior {
            minimize_to_tray: AtomicBool::new(true),
            close_keep_running: AtomicBool::new(false),
        })
        .setup(|app| {
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

            // 系统托盘
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let new_note_item = MenuItem::with_id(app, "new_note", "新建笔记", true, None::<&str>)?;
            let workspace_item =
                MenuItem::with_id(app, "workspace", "打开工作台", true, None::<&str>)?;
            let library_item =
                MenuItem::with_id(app, "library", "打开记录库", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "打开设置", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &new_note_item,
                    &workspace_item,
                    &library_item,
                    &settings_item,
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
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            show_main_window(app);
                        }
                        "new_note" => emit_tray_command(app, "new-note"),
                        "workspace" => emit_tray_command(app, "open-workspace"),
                        "library" => emit_tray_command(app, "open-library"),
                        "settings" => emit_tray_command(app, "open-settings"),
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
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let behavior = window.state::<WindowBehavior>();
                let keep_running = behavior.close_keep_running.load(Ordering::Relaxed);

                if keep_running {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    if let Some(db_state) = window.try_state::<DbState>() {
                        match db_state.checkpoint_wal() {
                            Ok(()) => log::info!("SQLite WAL checkpoint completed before window close"),
                            Err(error) => log::warn!(
                                "SQLite WAL checkpoint failed before window close: {}",
                                error
                            ),
                        }
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
            item::get_db_size,
            item::optimize_db,
            data_io::export_data,
            data_io::import_data,
            data_io::save_to_file,
            data_io::read_from_file,
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
            update_window_behavior,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
