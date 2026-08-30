use serde::{Deserialize, Serialize};

/// 同步配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncConfig {
    pub enabled: bool,
    pub server_url: String,
    /// 仅保存在进程内，永不写入 SQLite 或发送给前端。
    #[serde(skip)]
    pub access_token: String,
    /// 仅保存在进程内，永不写入 SQLite 或发送给前端。
    #[serde(skip)]
    pub refresh_token: String,
    pub user_id: String,
    /// 是否已从系统凭据库加载到有效 token。
    #[serde(default)]
    pub authenticated: bool,
    #[serde(default)]
    pub device_id: String,
    pub auto_sync: bool,
    pub sync_interval_minutes: u32,
    pub conflict_resolution: String,
    pub sync_attachments: bool,
    pub last_sync_at: Option<String>,
    pub last_snapshot_id: Option<String>,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            server_url: String::new(),
            access_token: String::new(),
            refresh_token: String::new(),
            user_id: String::new(),
            authenticated: false,
            device_id: String::new(),
            auto_sync: false,
            sync_interval_minutes: 15,
            conflict_resolution: "auto".to_string(),
            sync_attachments: true,
            last_sync_at: None,
            last_snapshot_id: None,
        }
    }
}

/// 同步状态
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncState {
    pub status: SyncStatus,
    pub progress: Option<SyncProgress>,
    pub last_error: Option<String>,
    pub last_sync_at: Option<String>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            status: SyncStatus::Idle,
            progress: None,
            last_error: None,
            last_sync_at: None,
        }
    }
}

/// 同步状态枚举
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    Idle,
    Preparing,
    Pushing,
    Pulling,
    SyncingAttachments,
    Completed,
    Error,
}

/// 同步进度
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncProgress {
    pub phase: String,
    pub current: u32,
    pub total: u32,
}

/// 同步记录（带数据）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncRecordPayload {
    pub table_name: String,
    pub record_id: String,
    pub content_hash: String,
    pub updated_at: String,
    pub data: serde_json::Value,
}

/// 冲突记录信息（传递给前端）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictInfo {
    pub record_id: String,
    pub table_name: String,
    pub local_data: serde_json::Value,
    pub local_updated_at: String,
    pub remote_updated_at: String,
    pub content_hash: String,
}

/// 前端提交的单条冲突解决选择
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictResolutionChoice {
    pub table_name: String,
    pub record_id: String,
    pub choice: String,
}

/// 待解决的同步状态（manual 模式暂停时保存）
#[derive(Debug, Clone)]
pub struct PendingSyncState {
    pub pushed_records: Vec<PushedRecord>,
    pub conflicts: Vec<ConflictInfo>,
    /// 非冲突的待推送记录
    pub to_push: Vec<SyncRecordPayload>,
    /// 非冲突的待拉取记录元信息
    pub to_pull: Vec<crate::sync::transport::RecordMetaInfo>,
}

/// 推送的记录标识（包含 record_id 和 table_name）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PushedRecord {
    pub record_id: String,
    pub table_name: String,
}

/// 同步结果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncResult {
    pub pushed: u32,
    pub pulled: u32,
    pub skipped: u32,
    pub conflicts: u32,
    pub pending_conflicts: Option<Vec<ConflictInfo>>,
    pub attachments_uploaded: u32,
    pub attachments_downloaded: u32,
    pub snapshot_id: String,
}

/// 登录结果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncLoginResult {
    pub user_id: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub access_token: String,
    #[serde(skip_serializing)]
    pub refresh_token: String,
}

/// Token 刷新结果
#[derive(Debug, Deserialize)]
pub struct RefreshResult {
    pub access_token: String,
    pub refresh_token: String,
}
