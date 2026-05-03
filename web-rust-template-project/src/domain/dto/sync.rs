use serde::{Deserialize, Serialize};

/// 推送记录请求
#[derive(Debug, Deserialize)]
pub struct PushRecordsRequest {
    pub records: Vec<SyncRecordPayload>,
}

/// 单条同步记录
#[derive(Debug, Deserialize, Clone)]
pub struct SyncRecordPayload {
    pub table_name: String,
    pub record_id: String,
    pub content_hash: String,
    pub updated_at: String,
    pub data: serde_json::Value,
}

/// 拉取记录请求
#[derive(Debug, Deserialize)]
pub struct PullRecordsRequest {
    pub since_snapshot_id: Option<String>,
}

/// 附件差异请求
#[derive(Debug, Deserialize)]
pub struct AttachmentDiffRequest {
    pub hashes: Vec<String>,
}

/// 提交同步请求
#[derive(Debug, Deserialize)]
pub struct CommitSyncRequest {
    pub records: Vec<CommitRecordMeta>,
    pub attachments: Vec<CommitAttachmentMeta>,
}

/// 提交记录元数据
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CommitRecordMeta {
    pub table_name: String,
    pub record_id: String,
    pub content_hash: String,
    pub updated_at: String,
    pub storage_key: String,
}

/// 提交附件元数据
#[derive(Debug, Deserialize, Clone)]
pub struct CommitAttachmentMeta {
    pub attachment_id: String,
    pub item_id: String,
    pub filename: String,
    pub mime_type: String,
    pub file_size: i64,
    pub file_hash: String,
    pub storage_key: String,
}
