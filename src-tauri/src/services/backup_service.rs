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
    #[serde(default)]
    pub last_backup_filename: Option<String>,
    #[serde(default)]
    pub last_backup_size: Option<u64>,
    #[serde(default)]
    pub last_backup_error: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct BackupFileInfo {
    pub filename: String,
    pub size: u64,
    pub created_at: String,
    pub backup_type: String,
    pub verified: bool,
    pub verification_error: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct BackupVerification {
    pub filename: String,
    pub size: u64,
    pub valid: bool,
    pub checked_at: String,
    pub error: Option<String>,
}

impl Default for AutoBackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_days: 7,
            max_backups: 10,
            expire_days: 90,
            last_backup_at: None,
            last_backup_filename: None,
            last_backup_size: None,
            last_backup_error: None,
        }
    }
}

#[derive(Clone, Copy)]
enum BackupKind {
    Automatic,
    Manual,
}

impl BackupKind {
    fn prefix(self) -> &'static str {
        match self {
            Self::Automatic => "auto-backup",
            Self::Manual => "manual-backup",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Automatic => "automatic",
            Self::Manual => "manual",
        }
    }
}

struct BackupArtifact {
    filename: String,
    size: u64,
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

fn do_backup(db: &DbState, kind: BackupKind) -> Result<BackupArtifact, AppError> {
    let dir = backups_dir();
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Io(e.to_string()))?;

    let now = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let unique_suffix = uuid::Uuid::new_v4().simple().to_string();
    let filename = format!("{}-{}-{}.zip", kind.prefix(), now, &unique_suffix[..8]);
    let dest = dir.join(&filename);
    let temp = dir.join(format!(".{}.{}.tmp", filename, uuid::Uuid::new_v4()));

    let result = (|| {
        data_io_service::create_backup_zip(db, &temp)?;
        data_io_service::verify_backup_zip(&temp)?;
        let size = std::fs::metadata(&temp)
            .map_err(|e| AppError::Io(format!("读取备份大小失败: {}", e)))?
            .len();
        std::fs::rename(&temp, &dest).map_err(|e| AppError::Io(format!("保存备份失败: {}", e)))?;

        Ok(BackupArtifact { filename, size })
    })();

    if result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }

    result
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
            let filename = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default();
            if path.extension().map_or(false, |e| e == "zip")
                && is_automatic_backup_filename(filename)
            {
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

fn is_automatic_backup_filename(filename: &str) -> bool {
    filename.starts_with("auto-backup-") || filename.starts_with("backup-")
}

fn backup_path(filename: &str) -> Result<PathBuf, AppError> {
    let safe_name = sanitize_filename(filename);
    if safe_name != filename || !filename.ends_with(".zip") {
        return Err(AppError::Validation("备份文件名无效".to_string()));
    }
    Ok(backups_dir().join(safe_name))
}

fn mark_backup_success(config: &mut AutoBackupConfig, artifact: &BackupArtifact) {
    config.last_backup_at = Some(chrono::Utc::now().to_rfc3339());
    config.last_backup_filename = Some(artifact.filename.clone());
    config.last_backup_size = Some(artifact.size);
    config.last_backup_error = None;
}

fn mark_backup_failure(config: &mut AutoBackupConfig, error: &AppError) {
    config.last_backup_error = Some(error.to_string());
}

pub fn run_auto_backup(db: &DbState) {
    let mut config = load_config();
    if !should_backup(&config) {
        return;
    }

    match do_backup(db, BackupKind::Automatic) {
        Ok(artifact) => {
            mark_backup_success(&mut config, &artifact);
            let _ = save_config(&config);
            cleanup_old_backups(&config);
            log::info!("自动备份完成");
        }
        Err(e) => {
            mark_backup_failure(&mut config, &e);
            let _ = save_config(&config);
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
    let mut config = load_config();
    match do_backup(db, BackupKind::Manual) {
        Ok(artifact) => {
            mark_backup_success(&mut config, &artifact);
            save_config(&config)?;
            Ok(artifact.filename)
        }
        Err(e) => {
            mark_backup_failure(&mut config, &e);
            let _ = save_config(&config);
            Err(e)
        }
    }
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

            let verification_error = match data_io_service::verify_backup_zip(&path) {
                Ok(()) => None,
                Err(error) => Some(error.to_string()),
            };
            let backup_type = if filename.starts_with("manual-backup-") {
                BackupKind::Manual.label()
            } else {
                BackupKind::Automatic.label()
            };

            files.push(BackupFileInfo {
                filename,
                size: meta.len(),
                created_at,
                backup_type: backup_type.to_string(),
                verified: verification_error.is_none(),
                verification_error,
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

pub fn verify_backup(filename: String) -> Result<BackupVerification, AppError> {
    let path = backup_path(&filename)?;
    let size = std::fs::metadata(&path)
        .map_err(|_| AppError::NotFound("备份文件不存在".to_string()))?
        .len();
    let error = data_io_service::verify_backup_zip(&path)
        .err()
        .map(|error| error.to_string());

    Ok(BackupVerification {
        filename,
        size,
        valid: error.is_none(),
        checked_at: chrono::Utc::now().to_rfc3339(),
        error,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_config_gets_new_status_defaults() {
        let config: AutoBackupConfig = serde_json::from_value(serde_json::json!({
            "enabled": true,
            "interval_days": 7,
            "max_backups": 10,
            "expire_days": 90,
            "last_backup_at": null,
        }))
        .expect("deserialize legacy config");

        assert!(config.last_backup_filename.is_none());
        assert!(config.last_backup_size.is_none());
        assert!(config.last_backup_error.is_none());
    }

    #[test]
    fn manual_backups_are_not_removed_by_automatic_cleanup() {
        let data_dir = crate::test_support::unique_temp_dir("backup-cleanup");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let dir = backups_dir();
        std::fs::create_dir_all(&dir).expect("create backup dir");
        let automatic = dir.join("auto-backup-old.zip");
        let legacy = dir.join("backup-legacy.zip");
        let manual = dir.join("manual-backup-important.zip");
        std::fs::write(&automatic, b"automatic").expect("write automatic backup");
        std::fs::write(&legacy, b"legacy").expect("write legacy backup");
        std::fs::write(&manual, b"manual").expect("write manual backup");

        cleanup_old_backups(&AutoBackupConfig {
            max_backups: 0,
            expire_days: 365,
            ..AutoBackupConfig::default()
        });

        assert!(!automatic.exists());
        assert!(!legacy.exists());
        assert!(manual.exists());
    }

    #[test]
    fn backup_is_verified_before_atomic_rename() {
        let data_dir = crate::test_support::unique_temp_dir("backup-atomic");
        let _guard = crate::test_support::lock_test_data_dir(&data_dir);
        let db = crate::test_support::test_db();

        let artifact = do_backup(&db, BackupKind::Manual).expect("create manual backup");
        assert!(artifact.filename.starts_with("manual-backup-"));
        assert!(artifact.size > 0);
        assert!(backups_dir().join(&artifact.filename).is_file());
        data_io_service::verify_backup_zip(&backups_dir().join(&artifact.filename))
            .expect("renamed backup should remain verifiable");

        let temp_files = std::fs::read_dir(backups_dir())
            .expect("read backup dir")
            .flatten()
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".tmp"))
            .count();
        assert_eq!(temp_files, 0);
    }
}
