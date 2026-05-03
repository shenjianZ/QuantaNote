use serde::Serialize;

/// 快照信息
#[derive(Debug, Serialize, Clone)]
pub struct SnapshotInfo {
    pub snapshot_id: String,
    pub data_hash: String,
    pub record_count: i32,
    pub total_size: i64,
    pub created_at: String,
}

/// 记录元信息（用于差异比对）
#[derive(Debug, Serialize, Clone)]
pub struct RecordMetaInfo {
    pub table_name: String,
    pub record_id: String,
    pub content_hash: String,
    pub updated_at: String,
}

/// 推送结果
#[derive(Debug, Serialize)]
pub struct PushResult {
    pub accepted: Vec<String>,
    pub skipped: Vec<String>,
}

/// 拉取结果
#[derive(Debug, Serialize)]
pub struct PullResult {
    pub records: Vec<SyncRecordData>,
    pub snapshot_id: String,
}

/// 同步记录（带数据）
#[derive(Debug, Serialize, Clone)]
pub struct SyncRecordData {
    pub table_name: String,
    pub record_id: String,
    pub content_hash: String,
    pub updated_at: String,
    pub data: serde_json::Value,
}

/// 远程附件元信息（用于客户端判断需要下载哪些附件）
#[derive(Debug, Serialize, Clone)]
pub struct RemoteAttachmentInfo {
    pub attachment_id: String,
    pub file_hash: String,
    pub item_id: String,
    pub filename: String,
    pub mime_type: String,
    pub file_size: i64,
}

/// 附件差异结果
#[derive(Debug, Serialize)]
pub struct AttachmentDiffResult {
    /// 服务端缺少的附件 hash（需要客户端上传）
    pub missing: Vec<String>,
    /// 服务端已有的附件列表（客户端可据此判断需要下载哪些）
    pub remote_attachments: Vec<RemoteAttachmentInfo>,
}

/// 提交结果
#[derive(Debug, Serialize)]
pub struct CommitResult {
    pub snapshot_id: String,
    pub created_at: String,
}

/// 同步历史条目
#[derive(Debug, Serialize)]
pub struct SyncHistoryEntry {
    pub snapshot_id: String,
    pub record_count: i32,
    pub total_size: i64,
    pub created_at: String,
}
