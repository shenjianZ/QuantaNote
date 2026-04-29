mod commands;
mod config;
mod db;
mod error;
mod models;
mod repositories;
mod services;
mod utils;

use commands::{attachment, item, search, sync, vault};
use config::AppConfig;
use db::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = AppConfig::default();
    let db_state = DbState::from_config(&config);
    let _startup_context = (config.app_name, db_state.database_name.as_str());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            item::create_item,
            search::search_items,
            vault::unlock_vault,
            sync::sync_now,
            attachment::add_attachment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
