use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::db::DbState;
use crate::error::AppError;
use crate::services::data_io_service;
use crate::utils::paths;

#[derive(Serialize, Deserialize, Clone)]
pub struct AutoBackupConfig {
    pub enabled: bool,
    pub interval_days: u32,
    pub max_backups: u32,
    pub expire_days: u32,
    pub last_backup_at: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct BackupFileInfo {
    pub filename: String,
    pub size: u64,
    pub created_at: String,
}

impl Default for AutoBackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_days: 7,
            max_backups: 10,
            expire_days: 90,
            last_backup_at: None,
        }
    }
}

fn backups_dir() -> PathBuf {
    paths::quantanote_dir().join("backups")
}

fn config_path() -> PathBuf {
    backups_dir().join("auto_backup.json")
}

pub fn load_config() -> AutoBackupConfig {
    let path = config_path();
    if !path.exists() {
        return AutoBackupConfig::default();
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_config(config: &AutoBackupConfig) -> Result<(), AppError> {
    let dir = backups_dir();
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Io(e.to_string()))?;
    let json = serde_json::to_string_pretty(config).map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(config_path(), json).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

fn sanitize_filename(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect()
}

fn should_backup(config: &AutoBackupConfig) -> bool {
    if !config.enabled {
        return false;
    }
    match &config.last_backup_at {
        None => true,
        Some(last) => {
            let Ok(last_time) = chrono::DateTime::parse_from_rfc3339(last) else {
                return true;
            };
            let last_utc = last_time.with_timezone(&chrono::Utc);
            let elapsed = chrono::Utc::now() - last_utc;
            elapsed.num_days() >= config.interval_days as i64
        }
    }
}

fn do_backup(db: &DbState) -> Result<String, AppError> {
    let dir = backups_dir();
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Io(e.to_string()))?;

    let now = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let filename = format!("backup-{}.zip", now);
    let dest = dir.join(&filename);

    data_io_service::create_backup_zip(db, &dest)?;

    Ok(filename)
}

fn cleanup_old_backups(config: &AutoBackupConfig) {
    let dir = backups_dir();
    if !dir.exists() {
        return;
    }

    let mut files: Vec<(PathBuf, std::fs::Metadata)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "zip") {
                if let Ok(meta) = path.metadata() {
                    files.push((path, meta));
                }
            }
        }
    }

    files.sort_by(|a, b| {
        b.1.modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .cmp(&a.1.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH))
    });

    if files.len() > config.max_backups as usize {
        for (path, _) in files.iter().skip(config.max_backups as usize) {
            let _ = std::fs::remove_file(path);
        }
    }

    let expire_duration = Duration::from_secs(config.expire_days as u64 * 86400);
    let now = std::time::SystemTime::now();
    for (path, meta) in &files {
        if let Ok(modified) = meta.modified() {
            if now.duration_since(modified).unwrap_or(Duration::ZERO) > expire_duration {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

pub fn run_auto_backup(db: &DbState) {
    let mut config = load_config();
    if !should_backup(&config) {
        return;
    }

    match do_backup(db) {
        Ok(_) => {
            config.last_backup_at = Some(chrono::Utc::now().to_rfc3339());
            let _ = save_config(&config);
            cleanup_old_backups(&config);
            log::info!("自动备份完成");
        }
        Err(e) => {
            log::warn!("自动备份失败: {}", e);
        }
    }
}

pub fn start_backup_scheduler(app: &AppHandle) {
    let app_handle = app.clone();

    // 移动端使用较短的检查间隔，避免被系统杀死
    #[cfg(mobile)]
    let check_interval = Duration::from_secs(900); // 15 分钟
    #[cfg(not(mobile))]
    let check_interval = Duration::from_secs(3600); // 1 小时

    std::thread::spawn(move || loop {
        std::thread::sleep(check_interval);
        if let Some(db) = app_handle.try_state::<DbState>() {
            run_auto_backup(&db);
        }
    });
}

pub fn trigger_backup_now(db: &DbState) -> Result<String, AppError> {
    let filename = do_backup(db)?;

    let mut config = load_config();
    config.last_backup_at = Some(chrono::Utc::now().to_rfc3339());
    save_config(&config)?;
    cleanup_old_backups(&config);

    Ok(filename)
}

pub fn get_backup_dir_path() -> Result<String, AppError> {
    Ok(backups_dir().to_string_lossy().to_string())
}

pub fn list_backups() -> Result<Vec<BackupFileInfo>, AppError> {
    let dir = backups_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut files: Vec<BackupFileInfo> = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| AppError::Io(e.to_string()))? {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();
        if path.extension().map_or(false, |e| e == "zip") {
            let meta = path.metadata().map_err(|e| AppError::Io(e.to_string()))?;
            let filename = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let created_at = meta
                .modified()
                .ok()
                .and_then(|t| {
                    let datetime: chrono::DateTime<chrono::Local> = t.into();
                    Some(datetime.format("%Y-%m-%d %H:%M:%S").to_string())
                })
                .unwrap_or_default();

            files.push(BackupFileInfo {
                filename,
                size: meta.len(),
                created_at,
            });
        }
    }

    files.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(files)
}

pub fn delete_backup(filename: String) -> Result<(), AppError> {
    let safe_name = sanitize_filename(&filename);
    if safe_name != filename {
        return Err(AppError::Validation("文件名无效".to_string()));
    }
    let path = backups_dir().join(&safe_name);
    if !path.exists() {
        return Err(AppError::NotFound("备份文件不存在".to_string()));
    }
    std::fs::remove_file(&path).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}
