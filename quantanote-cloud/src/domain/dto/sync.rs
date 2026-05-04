use serde::Deserialize;

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

/// 推送的记录标识
#[derive(Debug, Deserialize, Clone)]
pub struct PushedRecordId {
    pub record_id: String,
    pub table_name: String,
}

/// 提交同步请求
#[derive(Debug, Deserialize)]
pub struct CommitSyncRequest {
    /// 本次推送的记录列表（只关联这些记录到新快照）
    #[serde(default)]
    pub pushed_records: Vec<PushedRecordId>,
    /// 兼容旧客户端：如果 pushed_records 为空但 pushed_record_ids 不为空，退化为只按 record_id 查询
    #[serde(default)]
    pub pushed_record_ids: Vec<String>,
    /// true 表示 attachments 是客户端当前完整附件视图，服务端可据此删除缺失的旧附件元数据
    #[serde(default)]
    pub attachments_complete: bool,
    #[serde(default)]
    pub attachments: Vec<CommitAttachmentMeta>,
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
