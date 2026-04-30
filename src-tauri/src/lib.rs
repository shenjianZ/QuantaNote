mod commands;
mod db;
mod error;
mod models;
mod repositories;
mod services;
mod utils;

use commands::{attachment, data_io, item, search, tag, version};
use db::DbState;
use repositories::attachment_repository;
use tauri::Manager;
use utils::logging::tauri_log_plugin;
use utils::paths;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_log_plugin())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let quantanote_dir = paths::quantanote_dir();
            std::fs::create_dir_all(&quantanote_dir).expect("failed to create QuantaNote data dir");

            let db_path = quantanote_dir.join("quanta_note.sqlite");
            let db_state =
                DbState::open(&db_path.to_string_lossy()).expect("failed to open database");
            db_state
                .initialize_schema()
                .expect("failed to initialize schema");

            if let Ok(legacy_data_dir) = app.path().app_data_dir() {
                match attachment_repository::migrate_legacy_app_data_attachments(
                    &db_state,
                    &legacy_data_dir,
                    &quantanote_dir,
                ) {
                    Ok(count) if count > 0 => {
                        log::info!("Migrated {} legacy attachments into ~/.quantanote", count);
                    }
                    Ok(_) => {}
                    Err(error) => log::warn!("Legacy attachment migration failed: {}", error),
                }
            }

            app.manage(db_state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
