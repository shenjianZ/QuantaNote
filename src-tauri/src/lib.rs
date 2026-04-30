mod commands;
mod db;
mod error;
mod models;
mod repositories;
mod services;
mod utils;

use commands::{attachment, data_io, item, search, tag, version};
use db::DbState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data dir");

            let db_path = app_data_dir.join("quanta_note.sqlite");
            let db_state =
                DbState::open(&db_path.to_string_lossy()).expect("failed to open database");
            db_state.initialize_schema().expect("failed to initialize schema");

            app.manage(db_state);
            Ok(())
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
            tag::set_item_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
